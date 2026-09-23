import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, traduzirConflitoUnico, RebanhoError, type DbPecuaria } from "./regras.js";
import { brincoDisponivel, normalizarBrinco } from "./brinco.calc.js";
import { validarDatasAnimal, validarDataSaida, validarDataPesagem, validarDataLocalizacao, validarDataDestino } from "./datas.calc.js";
import { validarComposicao, type FracaoRaca } from "./composicao.calc.js";
import { planejarMovimentacao, planejarDestino, MovimentacaoError } from "./movimentacao.calc.js";
import { planejarSaida, planejarEstornoSaida, SaidaError } from "./saida.calc.js";
import { agregarPainel, mapearAnimalResumo, type AnimalResumo, type AnimalFicha, type PainelRebanho } from "./mappers.js";
import type {
  CadastrarAnimalInput, EditarAnimalInput, MovimentarInput, MudarDestinoInput,
  SaidaInput, EstornoSaidaInput, PesagemInput, ListarFiltrosInput,
} from "./schemas.js";

// ---------- helpers de leitura (escopados por propriedade quando informado) ----------

async function localizacaoAberta(db: DbPecuaria, animalId: string) {
  return db.localizacaoAnimal.findFirst({ where: { animalId, ate: null }, orderBy: { desde: "desc" } });
}

async function destinoAberto(db: DbPecuaria, animalId: string) {
  return db.destinoAnimal.findFirst({ where: { animalId, ate: null }, orderBy: { desde: "desc" } });
}

async function saidaAberta(db: DbPecuaria, animalId: string) {
  return db.saidaAnimal.findFirst({ where: { animalId, estornadaEm: null }, orderBy: { data: "desc" } });
}

async function exigirAnimalAtivo(db: DbPecuaria, animalId: string) {
  const saida = await saidaAberta(db, animalId);
  if (saida) throw new RebanhoError("ANIMAL_INATIVO", "Animal está inativo (saída não estornada)");
}

async function exigirAnimal(db: DbPecuaria, animalId: string) {
  const animal = await db.animal.findUnique({ where: { id: animalId } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  return animal;
}

async function ativosNoSitioParaBrinco(db: DbPecuaria, propriedadeId: number) {
  const localizacoesAbertas = await db.localizacaoAnimal.findMany({
    where: { propriedadeId, ate: null },
    select: { animalId: true, animal: { select: { brinco: true } } },
  });
  const saidasAbertas = await db.saidaAnimal.findMany({
    where: { estornadaEm: null, animalId: { in: localizacoesAbertas.map((l) => l.animalId) } },
    select: { animalId: true },
  });
  const inativos = new Set(saidasAbertas.map((s) => s.animalId));
  return localizacoesAbertas
    .filter((l) => !inativos.has(l.animalId))
    .map((l) => ({ animalId: l.animalId, propriedadeId, brinco: l.animal.brinco }));
}

/** Converte erros dos planejadores puros (*.calc.ts) em RebanhoError (422/409 na rota). */
function planejar<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MovimentacaoError) throw new RebanhoError("VALIDACAO", e.message, "data");
    if (e instanceof SaidaError) {
      if (e.codigo === "INATIVO") throw new RebanhoError("ANIMAL_INATIVO", e.message);
      if (e.codigo === "CONFLITO") throw new RebanhoError("CONFLITO", e.message);
      throw new RebanhoError("VALIDACAO", e.message, "data");
    }
    throw e;
  }
}

/**
 * Escopo de sítio para operar sobre um animal existente: o sítio é o da localização aberta
 * (ou da última, se o animal já saiu). Fora do escopo = "não encontrado" (não vaza existência).
 */
async function exigirNoEscopo(db: DbPecuaria, animalId: string, escopo: number | null) {
  const animal = await exigirAnimal(db, animalId);
  if (escopo == null) return animal;
  const ultima = await db.localizacaoAnimal.findFirst({ where: { animalId }, orderBy: [{ ate: { sort: "desc", nulls: "first" } }, { desde: "desc" }] });
  if (ultima && ultima.propriedadeId !== escopo) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado nesse sítio");
  return animal;
}

async function exigirBrincoLivre(db: DbPecuaria, brinco: string, propriedadeId: number, ignorarAnimalId?: string, sufixo = "nesse sítio") {
  const ativos = await ativosNoSitioParaBrinco(db, propriedadeId);
  if (!brincoDisponivel({ brinco, propriedadeId, ativosNoSitio: ativos, ignorarAnimalId })) {
    throw new RebanhoError("BRINCO_DUPLICADO", `Já existe um animal ativo com o brinco ${normalizarBrinco(brinco)} ${sufixo}`, "brinco");
  }
}

async function frasaoComposicaoAnimal(db: DbPecuaria, animalId: string): Promise<FracaoRaca[]> {
  const itens = await db.composicaoRacial.findMany({ where: { animalId }, include: { raca: true } });
  return itens.map((i) => ({ sigla: i.raca.sigla, fracao64: i.fracao64 }));
}

// ---------- cadastrar ----------

export async function cadastrar(input: CadastrarAnimalInput, usuarioId: number | null): Promise<AnimalResumo> {
  const erosDatas = validarDatasAnimal({ dataNascimento: input.dataNascimento, dataEntrada: input.dataEntrada, origem: input.origem });
  if (erosDatas.length) throw new RebanhoError("VALIDACAO", erosDatas[0].mensagem, erosDatas[0].campo);

  if (input.composicao.length) {
    const errosComposicao = validarComposicao(input.composicao.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })));
    if (errosComposicao.length) throw new RebanhoError("VALIDACAO", errosComposicao[0].mensagem, errosComposicao[0].campo);
  }

  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  if (input.loteId) {
    const lote = await prisma.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado nesse sítio ou inativo", "loteId");
  }

  if (input.composicao.length) {
    const racaIds = [...new Set(input.composicao.map((c) => c.racaId))];
    const encontradas = await prisma.raca.count({ where: { id: { in: racaIds }, ativo: true } });
    if (encontradas !== racaIds.length) throw new RebanhoError("NAO_ENCONTRADO", "Raça da composição não encontrada ou inativa", "composicao");
  }

  const criado = await prisma.$transaction(async (tx) => {
    await exigirBrincoLivre(tx, input.brinco, input.propriedadeId);

    const animal = await tx.animal.create({
      data: {
        brinco: input.brinco,
        nome: input.nome ?? null,
        brincoEletronico: input.brincoEletronico ?? null,
        sisbov: input.sisbov ?? null,
        sexo: input.sexo,
        dataNascimento: new Date(input.dataNascimento),
        nascimentoEstimado: input.nascimentoEstimado,
        origem: input.origem,
        dataEntrada: new Date(input.dataEntrada),
        partosAntesDaEntrada: input.partosAntesDaEntrada,
        observacao: input.observacao ?? null,
        criadoPorId: usuarioId,
      },
    }).catch((e) => traduzirConflitoUnico(e, {
      brincoEletronico: "Já existe um animal com esse brinco eletrônico",
      sisbov: "Já existe um animal com esse SISBOV",
    }));

    await tx.localizacaoAnimal.create({
      data: { animalId: animal.id, propriedadeId: input.propriedadeId, loteId: input.loteId ?? null, desde: new Date(input.dataEntrada), criadoPorId: usuarioId },
    });

    await tx.destinoAnimal.create({
      data: { animalId: animal.id, aptidao: input.aptidao, papelReprodutivo: input.papelReprodutivo, desde: new Date(input.dataEntrada), criadoPorId: usuarioId },
    });

    if (input.composicao.length) {
      await tx.composicaoRacial.createMany({
        data: input.composicao.map((c) => ({ animalId: animal.id, racaId: c.racaId, fracao64: c.fracao64, origem: "INFORMADA" as const, criadoPorId: usuarioId })),
      });
    }

    if (input.pesoEntradaKg != null) {
      const errosPesagem = validarDataPesagem({ dataNascimento: input.dataNascimento, dataPesagem: input.dataEntrada });
      if (errosPesagem.length) throw new RebanhoError("VALIDACAO", errosPesagem[0].mensagem, errosPesagem[0].campo);
      await tx.pesagem.create({
        data: { animalId: animal.id, data: new Date(input.dataEntrada), pesoKg: new Prisma.Decimal(input.pesoEntradaKg), tipo: "ENTRADA", origem: "MANUAL", criadoPorId: usuarioId },
      });
    }

    await auditar(tx, { entidade: "Animal", entidadeId: animal.id, acao: "CADASTRO", usuarioId, depois: { ...animal, propriedadeId: input.propriedadeId, loteId: input.loteId ?? null } });

    return animal;
  });

  return buscarFicha(criado.id, null).then((f) => f as AnimalResumo);
}

// ---------- editar (só campos fixos) ----------

export async function editar(id: string, input: EditarAnimalInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, id, escopo);

  const atualizado = await prisma.$transaction(async (tx) => {
    if (input.brinco != null && normalizarBrinco(input.brinco) !== normalizarBrinco(animal.brinco)) {
      const loc = await localizacaoAberta(tx, id);
      if (loc) await exigirBrincoLivre(tx, input.brinco, loc.propriedadeId, id);
    }

    const salvo = await tx.animal.update({
      where: { id },
      data: {
        brinco: input.brinco ?? undefined,
        nome: input.nome === undefined ? undefined : input.nome,
        brincoEletronico: input.brincoEletronico === undefined ? undefined : input.brincoEletronico,
        sisbov: input.sisbov === undefined ? undefined : input.sisbov,
        nascimentoEstimado: input.nascimentoEstimado ?? undefined,
        observacao: input.observacao === undefined ? undefined : input.observacao,
      },
    }).catch((e) => traduzirConflitoUnico(e, {
      brincoEletronico: "Já existe um animal com esse brinco eletrônico",
      sisbov: "Já existe um animal com esse SISBOV",
    }));

    await auditar(tx, { entidade: "Animal", entidadeId: id, acao: "EDICAO", usuarioId, antes: animal, depois: salvo });
    return salvo;
  });

  return buscarFicha(atualizado.id, null).then((f) => f as AnimalResumo);
}

// ---------- ficha ----------

export async function buscarFicha(id: string, propriedadeEscopo: number | null): Promise<AnimalFicha> {
  const animal = await prisma.animal.findUnique({ where: { id } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");

  const [localizacoes, destinos, pesagens, saidas, composicao] = await Promise.all([
    prisma.localizacaoAnimal.findMany({ where: { animalId: id }, include: { propriedade: true, lote: true }, orderBy: { desde: "desc" } }),
    prisma.destinoAnimal.findMany({ where: { animalId: id }, orderBy: { desde: "desc" } }),
    prisma.pesagem.findMany({ where: { animalId: id }, orderBy: { data: "desc" } }),
    prisma.saidaAnimal.findMany({ where: { animalId: id }, include: { motivo: true }, orderBy: { data: "desc" } }),
    frasaoComposicaoAnimal(prisma, id),
  ]);

  const locAtual = localizacoes.find((l) => l.ate == null) ?? null;
  // animal que já saiu não tem linha aberta: o escopo vale pela última localização
  const locReferencia = locAtual ?? localizacoes.find((l) => l.ate != null) ?? null;
  if (propriedadeEscopo != null && locReferencia && locReferencia.propriedadeId !== propriedadeEscopo) {
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado nesse sítio");
  }

  const destinoAtual = destinos.find((d) => d.ate == null) ?? null;
  const saidaAtual = saidas.find((s) => s.estornadaEm == null) ?? null;
  const partos = animal.partosAntesDaEntrada;
  const ultimoPeso = pesagens[0] ? { pesoKg: Number(pesagens[0].pesoKg), data: pesagens[0].data } : null;

  const resumo = mapearAnimalResumo({
    animal,
    partos,
    hoje: new Date(),
    propriedade: locAtual ? { id: locAtual.propriedade.id, nome: locAtual.propriedade.nome } : null,
    lote: locAtual?.lote ? { id: locAtual.lote.id, nome: locAtual.lote.nome } : null,
    destino: destinoAtual ? { aptidao: destinoAtual.aptidao, papelReprodutivo: destinoAtual.papelReprodutivo } : null,
    composicao,
    ultimoPeso,
    situacao: saidaAtual ? "SAIU" : "ATIVO",
  });

  return {
    ...resumo,
    brincoEletronico: animal.brincoEletronico,
    sisbov: animal.sisbov,
    nascimentoEstimado: animal.nascimentoEstimado,
    partosAntesDaEntrada: animal.partosAntesDaEntrada,
    observacao: animal.observacao,
    composicao,
    historicoLocalizacoes: localizacoes.map((l) => ({
      id: l.id,
      propriedade: { id: l.propriedade.id, nome: l.propriedade.nome },
      lote: l.lote ? { id: l.lote.id, nome: l.lote.nome } : null,
      desde: l.desde.toISOString().slice(0, 10),
      ate: l.ate ? l.ate.toISOString().slice(0, 10) : null,
      motivo: l.motivo,
    })),
    historicoDestinos: destinos.map((d) => ({
      id: d.id, aptidao: d.aptidao, papelReprodutivo: d.papelReprodutivo,
      desde: d.desde.toISOString().slice(0, 10), ate: d.ate ? d.ate.toISOString().slice(0, 10) : null,
    })),
    historicoPesagens: pesagens.map((p) => ({ id: p.id, data: p.data.toISOString().slice(0, 10), pesoKg: Number(p.pesoKg), tipo: p.tipo, origem: p.origem })),
    saida: saidaAtual ? {
      id: saidaAtual.id, data: saidaAtual.data.toISOString().slice(0, 10), tipo: saidaAtual.tipo,
      motivo: saidaAtual.motivo?.nome ?? null, observacao: saidaAtual.observacao,
      estornadaEm: saidaAtual.estornadaEm ? saidaAtual.estornadaEm.toISOString() : null, estornoMotivo: saidaAtual.estornoMotivo,
    } : (saidas[0] ? {
      id: saidas[0].id, data: saidas[0].data.toISOString().slice(0, 10), tipo: saidas[0].tipo,
      motivo: saidas[0].motivo?.nome ?? null, observacao: saidas[0].observacao,
      estornadaEm: saidas[0].estornadaEm ? saidas[0].estornadaEm.toISOString() : null, estornoMotivo: saidas[0].estornoMotivo,
    } : null),
  };
}

// ---------- listar ----------

export async function listar(filtros: ListarFiltrosInput, propriedadeEscopo: number | null): Promise<{ itens: AnimalResumo[]; total: number; painel: PainelRebanho }> {
  // o escopo do request (seletor global de sítio) prevalece; o filtro só refina dentro dele
  if (propriedadeEscopo != null && filtros.propriedadeId != null && filtros.propriedadeId !== propriedadeEscopo) {
    return { itens: [], total: 0, painel: agregarPainel([]) };
  }
  const propriedadeId = propriedadeEscopo ?? filtros.propriedadeId ?? undefined;

  const localizacaoWhere: Prisma.LocalizacaoAnimalWhereInput = { ate: null };
  if (propriedadeId != null) localizacaoWhere.propriedadeId = propriedadeId;
  if (filtros.loteId) localizacaoWhere.loteId = filtros.loteId;

  const animalWhere: Prisma.AnimalWhereInput = {
    localizacoes: { some: localizacaoWhere },
  };
  if (filtros.busca) {
    animalWhere.OR = [
      { brinco: { contains: filtros.busca, mode: "insensitive" } },
      { nome: { contains: filtros.busca, mode: "insensitive" } },
    ];
  }

  const todosCandidatos = await prisma.animal.findMany({
    where: animalWhere,
    include: {
      localizacoes: { where: localizacaoWhere, include: { propriedade: true, lote: true }, take: 1 },
      destinos: { where: { ate: null }, take: 1 },
      saidas: { where: { estornadaEm: null }, take: 1 },
      composicao: { include: { raca: true } },
      pesagens: { orderBy: { data: "desc" }, take: 1 },
    },
    orderBy: { brinco: "asc" },
  });

  const hoje = new Date();
  let resumos: AnimalResumo[] = todosCandidatos.map((animal) => {
    const loc = animal.localizacoes[0] ?? null;
    const destino = animal.destinos[0] ?? null;
    const saida = animal.saidas[0] ?? null;
    return mapearAnimalResumo({
      animal,
      partos: animal.partosAntesDaEntrada,
      hoje,
      propriedade: loc ? { id: loc.propriedade.id, nome: loc.propriedade.nome } : null,
      lote: loc?.lote ? { id: loc.lote.id, nome: loc.lote.nome } : null,
      destino: destino ? { aptidao: destino.aptidao, papelReprodutivo: destino.papelReprodutivo } : null,
      composicao: animal.composicao.map((c) => ({ sigla: c.raca.sigla, fracao64: c.fracao64 })),
      ultimoPeso: animal.pesagens[0] ? { pesoKg: Number(animal.pesagens[0].pesoKg), data: animal.pesagens[0].data } : null,
      situacao: saida ? "SAIU" : "ATIVO",
    });
  });

  // filtro de situação: por padrão só a localização ATUAL entra no where; para SAIU/TODOS
  // buscamos também os que já saíram (sem localização aberta no filtro de sítio/lote).
  if (filtros.situacao !== "ATIVO") {
    const whereBase: Prisma.AnimalWhereInput = {};
    if (propriedadeId != null || filtros.loteId) {
      whereBase.localizacoes = { some: { ...(propriedadeId != null ? { propriedadeId } : {}), ...(filtros.loteId ? { loteId: filtros.loteId } : {}) } };
    }
    if (filtros.busca) {
      whereBase.OR = [
        { brinco: { contains: filtros.busca, mode: "insensitive" } },
        { nome: { contains: filtros.busca, mode: "insensitive" } },
      ];
    }
    whereBase.saidas = { some: { estornadaEm: null } };

    const saidosCandidatos = await prisma.animal.findMany({
      where: whereBase,
      include: {
        localizacoes: { orderBy: { desde: "desc" }, take: 1, include: { propriedade: true, lote: true } },
        destinos: { orderBy: { desde: "desc" }, take: 1 },
        saidas: { where: { estornadaEm: null }, take: 1 },
        composicao: { include: { raca: true } },
        pesagens: { orderBy: { data: "desc" }, take: 1 },
      },
      orderBy: { brinco: "asc" },
    });

    const saidosResumos: AnimalResumo[] = saidosCandidatos.map((animal) => {
      const loc = animal.localizacoes[0] ?? null;
      const destino = animal.destinos[0] ?? null;
      return mapearAnimalResumo({
        animal,
        partos: animal.partosAntesDaEntrada,
        hoje,
        propriedade: loc ? { id: loc.propriedade.id, nome: loc.propriedade.nome } : null,
        lote: loc?.lote ? { id: loc.lote.id, nome: loc.lote.nome } : null,
        destino: destino ? { aptidao: destino.aptidao, papelReprodutivo: destino.papelReprodutivo } : null,
        composicao: animal.composicao.map((c) => ({ sigla: c.raca.sigla, fracao64: c.fracao64 })),
        ultimoPeso: animal.pesagens[0] ? { pesoKg: Number(animal.pesagens[0].pesoKg), data: animal.pesagens[0].data } : null,
        situacao: "SAIU",
      });
    });

    resumos = filtros.situacao === "SAIU" ? saidosResumos : [...resumos, ...saidosResumos];
  }

  if (filtros.categoria) resumos = resumos.filter((r) => r.categoria === filtros.categoria);
  if (filtros.aptidao) resumos = resumos.filter((r) => r.aptidao === filtros.aptidao);
  if (filtros.papelReprodutivo) resumos = resumos.filter((r) => r.papelReprodutivo === filtros.papelReprodutivo);

  const total = resumos.length;
  const inicio = (filtros.page - 1) * filtros.pageSize;
  const itens = resumos.slice(inicio, inicio + filtros.pageSize);

  return { itens, total, painel: agregarPainel(resumos) };
}

// ---------- movimentar (individual ou em massa) ----------

export async function movimentar(input: MovimentarInput, usuarioId: number | null, escopo: number | null = null): Promise<{ movimentacaoId: string; movidos: number }> {
  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  if (input.loteId) {
    const lote = await prisma.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado nesse sítio ou inativo", "loteId");
  }

  const movimentacaoId = crypto.randomUUID();
  let movidos = 0;

  await prisma.$transaction(async (tx) => {
    for (const animalId of input.animalIds) {
      const animal = await exigirNoEscopo(tx, animalId, escopo);
      await exigirAnimalAtivo(tx, animalId);

      const atual = await localizacaoAberta(tx, animalId);

      const errosData = validarDataLocalizacao({ dataEntrada: animal.dataEntrada, desde: input.data });
      if (errosData.length) throw new RebanhoError("VALIDACAO", `${animal.brinco}: ${errosData[0].mensagem}`, errosData[0].campo);

      // brinco por sítio: só relevante quando muda de sítio
      if (!atual || atual.propriedadeId !== input.propriedadeId) {
        await exigirBrincoLivre(tx, animal.brinco, input.propriedadeId, animalId, "no sítio de destino");
      }

      const plano = planejar(() => planejarMovimentacao({
        atual: atual ? { propriedadeId: atual.propriedadeId, loteId: atual.loteId, desde: atual.desde } : null,
        destino: { propriedadeId: input.propriedadeId, loteId: input.loteId ?? null },
        data: input.data,
      }));

      if (plano.tipo === "SEM_MUDANCA") continue;

      if (plano.fechar && atual) {
        await tx.localizacaoAnimal.update({ where: { id: atual.id }, data: { ate: new Date(plano.fechar.ate) } });
      }
      const nova = await tx.localizacaoAnimal.create({
        data: {
          animalId, propriedadeId: plano.abrir.propriedadeId, loteId: plano.abrir.loteId,
          desde: new Date(plano.abrir.desde), motivo: input.motivo ?? null, movimentacaoId, criadoPorId: usuarioId,
        },
      });

      await auditar(tx, { entidade: "LocalizacaoAnimal", entidadeId: nova.id, acao: "MOVIMENTACAO", usuarioId, antes: atual, depois: nova });
      movidos += 1;
    }
  });

  return { movimentacaoId, movidos };
}

// ---------- mudar destino ----------

export async function mudarDestino(input: MudarDestinoInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, input.animalId, escopo);

  const errosData = validarDataDestino({ dataEntrada: animal.dataEntrada, desde: input.data });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  await prisma.$transaction(async (tx) => {
    await exigirAnimalAtivo(tx, input.animalId);
    const atual = await destinoAberto(tx, input.animalId);
    const plano = planejar(() => planejarDestino({
      atual: atual ? { aptidao: atual.aptidao, papelReprodutivo: atual.papelReprodutivo, desde: atual.desde } : null,
      novo: { aptidao: input.aptidao, papelReprodutivo: input.papelReprodutivo },
      data: input.data,
    }));

    if (plano.tipo === "SEM_MUDANCA") return;

    if (plano.fechar && atual) {
      await tx.destinoAnimal.update({ where: { id: atual.id }, data: { ate: new Date(plano.fechar.ate) } });
    }
    const novo = await tx.destinoAnimal.create({
      data: { animalId: input.animalId, aptidao: plano.abrir.aptidao, papelReprodutivo: plano.abrir.papelReprodutivo, desde: new Date(plano.abrir.desde), criadoPorId: usuarioId },
    });

    await auditar(tx, { entidade: "DestinoAnimal", entidadeId: novo.id, acao: "MUDANCA_DESTINO", usuarioId, antes: atual, depois: novo });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

// ---------- saída ----------

export async function darSaida(input: SaidaInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, input.animalId, escopo);

  const errosData = validarDataSaida({ dataEntrada: animal.dataEntrada, dataSaida: input.data });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  if (input.motivoId) {
    const motivo = await prisma.motivoSaida.findFirst({ where: { id: input.motivoId, tipo: input.tipo, ativo: true } });
    if (!motivo) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de saída não encontrado para esse tipo", "motivoId");
  }

  await prisma.$transaction(async (tx) => {
    const [ativa, localAberta, destAberto] = await Promise.all([
      saidaAberta(tx, input.animalId),
      localizacaoAberta(tx, input.animalId),
      destinoAberto(tx, input.animalId),
    ]);

    const plano = planejar(() => planejarSaida({
      animalAtivo: !ativa,
      localizacaoAberta: localAberta ? { id: localAberta.id, desde: localAberta.desde } : null,
      destinoAberto: destAberto ? { id: destAberto.id, desde: destAberto.desde } : null,
      data: input.data,
    }));

    if (plano.fecharLocalizacao) await tx.localizacaoAnimal.update({ where: { id: plano.fecharLocalizacao.id }, data: { ate: new Date(plano.fecharLocalizacao.ate) } });
    if (plano.fecharDestino) await tx.destinoAnimal.update({ where: { id: plano.fecharDestino.id }, data: { ate: new Date(plano.fecharDestino.ate) } });

    const saida = await tx.saidaAnimal.create({
      data: {
        animalId: input.animalId, data: new Date(input.data), tipo: input.tipo, motivoId: input.motivoId ?? null, observacao: input.observacao ?? null,
        localizacaoFechadaId: plano.fecharLocalizacao?.id ?? null, destinoFechadoId: plano.fecharDestino?.id ?? null, criadoPorId: usuarioId,
      },
    });

    await auditar(tx, { entidade: "SaidaAnimal", entidadeId: saida.id, acao: "SAIDA", usuarioId, depois: saida });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

export async function estornarSaida(animalId: string, input: EstornoSaidaInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    const saida = await saidaAberta(tx, animalId);
    if (!saida) throw new RebanhoError("JA_ESTORNADA", "Não há saída ativa para estornar (ou já foi estornada)");

    const [localAberta, destAberto] = await Promise.all([localizacaoAberta(tx, animalId), destinoAberto(tx, animalId)]);
    const plano = planejar(() => planejarEstornoSaida({
      saida: { localizacaoFechadaId: saida.localizacaoFechadaId, destinoFechadoId: saida.destinoFechadoId },
      localizacaoAberta: localAberta ? { id: localAberta.id } : null,
      destinoAberto: destAberto ? { id: destAberto.id } : null,
    }));

    if (plano.reabrirLocalizacao) {
      const linha = await tx.localizacaoAnimal.findUniqueOrThrow({ where: { id: plano.reabrirLocalizacao.id } });
      // o brinco pode ter sido reutilizado no sítio enquanto o animal esteve fora
      await exigirBrincoLivre(tx, animal.brinco, linha.propriedadeId, animalId);
      await tx.localizacaoAnimal.update({ where: { id: linha.id }, data: { ate: null } });
    }
    if (plano.reabrirDestino) await tx.destinoAnimal.update({ where: { id: plano.reabrirDestino.id }, data: { ate: null } });

    const atualizada = await tx.saidaAnimal.update({
      where: { id: saida.id },
      data: { estornadaEm: new Date(), estornoMotivo: input.motivo },
    });

    await auditar(tx, { entidade: "SaidaAnimal", entidadeId: saida.id, acao: "ESTORNO", usuarioId, antes: saida, depois: atualizada });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

// ---------- pesagem ----------

export async function registrarPesagem(input: PesagemInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null) {
  const animal = await exigirNoEscopo(prisma, input.animalId, escopo);
  const saida = await prisma.saidaAnimal.findFirst({ where: { animalId: input.animalId, estornadaEm: null } });

  const errosData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataSaida: saida?.data ?? null, dataPesagem: input.data });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  const pesagem = await prisma.$transaction(async (tx) => {
    const criada = await tx.pesagem.create({
      data: { animalId: input.animalId, data: new Date(input.data), pesoKg: new Prisma.Decimal(input.pesoKg), tipo: input.tipo, origem: input.origem, observacao: input.observacao ?? null, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "Pesagem", entidadeId: criada.id, acao: "REGISTRO", usuarioId, depois: criada });
    return criada;
  });

  return { id: pesagem.id, animalId: pesagem.animalId, data: pesagem.data.toISOString().slice(0, 10), pesoKg: Number(pesagem.pesoKg), tipo: pesagem.tipo, origem: pesagem.origem };
}
