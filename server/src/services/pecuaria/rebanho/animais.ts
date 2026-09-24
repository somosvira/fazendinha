import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, dadosAuditoria, traduzirConflitoUnico, travarBrinco, RebanhoError, type DbPecuaria } from "./regras.js";
import { brincoDisponivel, normalizarBrinco } from "./brinco.calc.js";
import { validarDatasAnimal, validarDataBaixa, validarDataPesagem, validarDataDestino, planejarAjusteEntrada } from "./datas.calc.js";
import { validarComposicao } from "./composicao.calc.js";
import { planejarDestino, planejarDesfazer, planejarDesfazerMovimentacao, planejarMovimentacaoEmMassa, MovimentacaoError } from "./movimentacao.calc.js";
import { avaliarCategoria, type RegraCategoria } from "./categoria.calc.js";
import { carregarRegras, manualDe, SELECT_MANUAL_ABERTA, whereCategoria } from "./categorias.js";
import { planejarBaixa, planejarEstornoBaixa, motivoAceito, mensagemMotivoRecusado, BaixaError } from "./baixa.calc.js";
import { agregarPainel, mapearAnimalResumo, resumoAuditoria, type AnimalResumo, type AnimalFicha, type ItemComposicaoFicha, type PainelRebanho } from "./mappers.js";
import type {
  CadastrarAnimalInput, EditarAnimalInput, MovimentarInput, MudarDestinoInput,
  BaixaInput, EstornoBaixaInput, PesagemInput, EditarPesagemInput, ListarFiltrosInput,
  SubstituirComposicaoInput, CategoriaManualInput, RemoverCategoriaManualInput,
} from "./schemas.js";

// ---------- helpers de leitura (escopados por propriedade quando informado) ----------

async function localizacaoAberta(db: DbPecuaria, animalId: string) {
  return db.localizacaoAnimal.findFirst({ where: { animalId, ate: null }, orderBy: { desde: "desc" } });
}

async function destinoAberto(db: DbPecuaria, animalId: string) {
  return db.destinoAnimal.findFirst({ where: { animalId, ate: null }, orderBy: { desde: "desc" } });
}

async function baixaAberta(db: DbPecuaria, animalId: string) {
  return db.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null }, orderBy: { data: "desc" } });
}

async function exigirAnimalAtivo(db: DbPecuaria, animalId: string) {
  const baixa = await baixaAberta(db, animalId);
  if (baixa) throw new RebanhoError("ANIMAL_INATIVO", "Animal está inativo (baixa não estornada)");
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
  const baixasAbertas = await db.baixaAnimal.findMany({
    where: { estornadaEm: null, animalId: { in: localizacoesAbertas.map((l) => l.animalId) } },
    select: { animalId: true },
  });
  const inativos = new Set(baixasAbertas.map((s) => s.animalId));
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
    if (e instanceof BaixaError) {
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
  await travarBrinco(db, propriedadeId, normalizarBrinco(brinco));
  const ativos = await ativosNoSitioParaBrinco(db, propriedadeId);
  if (!brincoDisponivel({ brinco, propriedadeId, ativosNoSitio: ativos, ignorarAnimalId })) {
    throw new RebanhoError("BRINCO_DUPLICADO", `Já existe um animal ativo com o brinco ${normalizarBrinco(brinco)} ${sufixo}`, "brinco");
  }
}

async function composicaoDaFicha(db: DbPecuaria, animalId: string): Promise<ItemComposicaoFicha[]> {
  const itens = await db.composicaoRacial.findMany({ where: { animalId }, include: { raca: true } });
  return itens
    .map((i) => ({ racaId: i.racaId, sigla: i.raca.sigla, nome: i.raca.nome, racaAtiva: i.raca.ativo, fracao64: i.fracao64 }))
    .sort((a, b) => b.fracao64 - a.fracao64);
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

    await auditar(tx, { entidade: "Animal", entidadeId: animal.id, animalId: animal.id, acao: "CADASTRO", usuarioId, depois: { ...animal, propriedadeId: input.propriedadeId, loteId: input.loteId ?? null } });

    return animal;
  });

  return buscarFicha(criado.id, null).then((f) => f as AnimalResumo);
}

// ---------- editar (só campos fixos) ----------

export async function editar(id: string, input: EditarAnimalInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, id, escopo);

  const nascimentoNovo = input.dataNascimento != null ? new Date(input.dataNascimento) : animal.dataNascimento;
  const entradaNova = input.dataEntrada != null ? new Date(input.dataEntrada) : animal.dataEntrada;
  const origemNova = input.origem ?? animal.origem;
  const mudaDatas = nascimentoNovo.getTime() !== animal.dataNascimento.getTime()
    || entradaNova.getTime() !== animal.dataEntrada.getTime() || origemNova !== animal.origem;

  const atualizado = await prisma.$transaction(async (tx) => {
    let ajuste: ReturnType<typeof planejarAjusteEntrada> | null = null;
    if (mudaDatas) {
      const errosBase = validarDatasAnimal({ dataNascimento: nascimentoNovo, dataEntrada: entradaNova, origem: origemNova });
      if (errosBase.length) throw new RebanhoError("VALIDACAO", errosBase[0].mensagem, errosBase[0].campo);

      const [localizacoes, destinos, pesagens, primeiraBaixa] = await Promise.all([
        tx.localizacaoAnimal.findMany({ where: { animalId: id }, select: { id: true, desde: true, ate: true } }),
        tx.destinoAnimal.findMany({ where: { animalId: id }, select: { id: true, desde: true, ate: true } }),
        tx.pesagem.findMany({ where: { animalId: id }, select: { id: true, data: true, tipo: true } }),
        tx.baixaAnimal.findFirst({ where: { animalId: id, estornadaEm: null }, orderBy: { data: "asc" } }),
      ]);
      ajuste = planejarAjusteEntrada({
        entradaAntiga: animal.dataEntrada, entradaNova,
        nascimentoAntigo: animal.dataNascimento, nascimentoNovo,
        localizacoes, destinos, pesagens,
        primeiraBaixaData: primeiraBaixa?.data ?? null,
      });
      if (ajuste.erros.length) throw new RebanhoError("VALIDACAO", ajuste.erros[0].mensagem, ajuste.erros[0].campo);
    }

    // a categoria manual tem sexo: trocar o sexo do animal exige voltar ao automático antes
    if (input.sexo && input.sexo !== animal.sexo) {
      const manual = await tx.categoriaManualAnimal.findFirst({ where: { animalId: id, ate: null }, include: { categoria: true } });
      if (manual && manual.categoria.sexo !== input.sexo) {
        throw new RebanhoError("VALIDACAO", `A categoria manual "${manual.categoria.nome}" é de outro sexo; volte ao cálculo automático antes de trocar o sexo`, "sexo");
      }
    }

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
        sexo: input.sexo ?? undefined,
        dataNascimento: input.dataNascimento != null ? nascimentoNovo : undefined,
        nascimentoEstimado: input.nascimentoEstimado ?? undefined,
        origem: input.origem ?? undefined,
        dataEntrada: input.dataEntrada != null ? entradaNova : undefined,
        partosAntesDaEntrada: input.partosAntesDaEntrada ?? undefined,
        observacao: input.observacao === undefined ? undefined : input.observacao,
      },
    }).catch((e) => traduzirConflitoUnico(e, {
      brincoEletronico: "Já existe um animal com esse brinco eletrônico",
      sisbov: "Já existe um animal com esse SISBOV",
    }));

    // o histórico que começava na entrada/nascimento antigos acompanha as novas datas
    if (ajuste) {
      if (ajuste.moverLocalizacao) await tx.localizacaoAnimal.update({ where: { id: ajuste.moverLocalizacao }, data: { desde: entradaNova } });
      if (ajuste.moverDestino) await tx.destinoAnimal.update({ where: { id: ajuste.moverDestino }, data: { desde: entradaNova } });
      if (ajuste.moverPesagensEntrada.length) await tx.pesagem.updateMany({ where: { id: { in: ajuste.moverPesagensEntrada } }, data: { data: entradaNova } });
      if (ajuste.moverPesagensNascimento.length) await tx.pesagem.updateMany({ where: { id: { in: ajuste.moverPesagensNascimento } }, data: { data: nascimentoNovo } });
    }

    await auditar(tx, {
      entidade: "Animal", entidadeId: id, animalId: id, acao: "EDICAO", usuarioId, antes: animal,
      depois: ajuste ? { ...salvo, historicoAjustado: { localizacao: ajuste.moverLocalizacao, destino: ajuste.moverDestino, pesagens: [...ajuste.moverPesagensEntrada, ...ajuste.moverPesagensNascimento] } } : salvo,
    });
    return salvo;
  });

  return buscarFicha(atualizado.id, null).then((f) => f as AnimalResumo);
}

// ---------- composição racial (substituição integral) ----------

export async function substituirComposicao(
  animalId: string,
  input: SubstituirComposicaoInput,
  usuarioId: number | null,
  escopo: number | null = null,
): Promise<ItemComposicaoFicha[]> {
  await exigirNoEscopo(prisma, animalId, escopo);

  const errosComposicao = validarComposicao(input.itens.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })));
  if (errosComposicao.length) throw new RebanhoError("VALIDACAO", errosComposicao[0].mensagem, errosComposicao[0].campo);

  if (input.itens.length) {
    // raça inativa só é aceita se já estiver na composição atual (desativar não trava a edição)
    const racaIds = [...new Set(input.itens.map((c) => c.racaId))];
    const [racas, atuais] = await Promise.all([
      prisma.raca.findMany({ where: { id: { in: racaIds } }, select: { id: true, ativo: true } }),
      prisma.composicaoRacial.findMany({ where: { animalId }, select: { racaId: true } }),
    ]);
    const jaPresentes = new Set(atuais.map((a) => a.racaId));
    const aceitas = racas.filter((r) => r.ativo || jaPresentes.has(r.id));
    if (aceitas.length !== racaIds.length) throw new RebanhoError("NAO_ENCONTRADO", "Raça da composição não encontrada ou inativa", "itens");
  }

  const composicao = await prisma.$transaction(async (tx) => {
    const antes = await tx.composicaoRacial.findMany({ where: { animalId } });
    await tx.composicaoRacial.deleteMany({ where: { animalId } });
    if (input.itens.length) {
      await tx.composicaoRacial.createMany({
        data: input.itens.map((c) => ({ animalId, racaId: c.racaId, fracao64: c.fracao64, origem: "INFORMADA" as const, criadoPorId: usuarioId })),
      });
    }
    const depois = await tx.composicaoRacial.findMany({ where: { animalId }, include: { raca: true } });
    await auditar(tx, { entidade: "ComposicaoRacial", entidadeId: animalId, animalId, acao: "EDICAO", usuarioId, antes, depois });
    return depois;
  });

  return composicao
    .map((c) => ({ racaId: c.racaId, sigla: c.raca.sigla, nome: c.raca.nome, racaAtiva: c.raca.ativo, fracao64: c.fracao64 }))
    .sort((a, b) => b.fracao64 - a.fracao64);
}

// ---------- categoria manual (vale sobre o cálculo até ser removida) ----------

export async function definirCategoriaManual(animalId: string, input: CategoriaManualInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, animalId, escopo);
  const categoria = await prisma.categoriaAnimal.findUnique({ where: { id: input.categoriaId } });
  if (!categoria || !categoria.ativo) throw new RebanhoError("NAO_ENCONTRADO", "Categoria não encontrada ou inativa", "categoriaId");
  if (categoria.sexo !== animal.sexo) throw new RebanhoError("VALIDACAO", "A categoria é de outro sexo", "categoriaId");
  const data = new Date(input.data);
  if (data.getTime() < animal.dataEntrada.getTime()) throw new RebanhoError("VALIDACAO", "A data não pode ser anterior à entrada do animal", "data");

  await prisma.$transaction(async (tx) => {
    await exigirAnimalAtivo(tx, animalId);
    const aberta = await tx.categoriaManualAnimal.findFirst({ where: { animalId, ate: null } });
    if (aberta?.categoriaId === input.categoriaId) throw new RebanhoError("CONFLITO", `O animal já está como "${categoria.nome}"`, "categoriaId");
    if (aberta && data.getTime() < aberta.desde.getTime()) throw new RebanhoError("VALIDACAO", "A data não pode ser anterior à troca manual atual", "data");
    if (aberta) await tx.categoriaManualAnimal.update({ where: { id: aberta.id }, data: { ate: data, motivoEncerramento: `Trocada por "${categoria.nome}"` } });
    const nova = await tx.categoriaManualAnimal.create({ data: { animalId, categoriaId: input.categoriaId, desde: data, motivo: input.motivo, criadoPorId: usuarioId } });
    await auditar(tx, { entidade: "CategoriaManualAnimal", entidadeId: nova.id, animalId, acao: "DEFINICAO", usuarioId, antes: aberta, depois: nova });
  });
  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

export async function removerCategoriaManual(animalId: string, input: RemoverCategoriaManualInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, animalId, escopo);
  await prisma.$transaction(async (tx) => {
    const aberta = await tx.categoriaManualAnimal.findFirst({ where: { animalId, ate: null } });
    if (!aberta) throw new RebanhoError("CONFLITO", "O animal já está no cálculo automático");
    const hoje = new Date();
    const ate = hoje.getTime() < aberta.desde.getTime() ? aberta.desde : hoje;
    const fechada = await tx.categoriaManualAnimal.update({ where: { id: aberta.id }, data: { ate, motivoEncerramento: input.motivo } });
    await auditar(tx, { entidade: "CategoriaManualAnimal", entidadeId: aberta.id, animalId, acao: "REMOCAO", usuarioId, antes: aberta, depois: fechada });
  });
  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

// ---------- ficha ----------

export async function buscarFicha(id: string, propriedadeEscopo: number | null): Promise<AnimalFicha> {
  const animal = await prisma.animal.findUnique({ where: { id } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");

  const [localizacoes, destinos, pesagens, baixas, composicao, manuais, regras] = await Promise.all([
    prisma.localizacaoAnimal.findMany({ where: { animalId: id }, include: { propriedade: true, lote: true, movimentacao: { select: { motivo: true } } }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    prisma.destinoAnimal.findMany({ where: { animalId: id }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    prisma.pesagem.findMany({ where: { animalId: id }, orderBy: { data: "desc" } }),
    prisma.baixaAnimal.findMany({ where: { animalId: id }, include: { motivo: true }, orderBy: { data: "desc" } }),
    composicaoDaFicha(prisma, id),
    prisma.categoriaManualAnimal.findMany({ where: { animalId: id }, include: { categoria: { select: { id: true, nome: true } } }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    carregarRegras(),
  ]);

  const locAtual = localizacoes.find((l) => l.ate == null) ?? null;
  // animal que já saiu não tem linha aberta: o escopo vale pela última localização
  const locReferencia = locAtual ?? localizacoes.find((l) => l.ate != null) ?? null;
  if (propriedadeEscopo != null && locReferencia && locReferencia.propriedadeId !== propriedadeEscopo) {
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado nesse sítio");
  }

  const destinoAtual = destinos.find((d) => d.ate == null) ?? null;
  const baixaAtual = baixas.find((s) => s.estornadaEm == null) ?? null;
  const ultimoPeso = pesagens[0] ? { pesoKg: Number(pesagens[0].pesoKg), data: pesagens[0].data } : null;
  const hoje = new Date();
  const manualAberta = manuais.find((m) => m.ate == null)?.categoria ?? null;

  const resumo = mapearAnimalResumo({
    animal,
    categoria: avaliarCategoria({ sexo: animal.sexo, dataNascimento: animal.dataNascimento, partos: animal.partosAntesDaEntrada }, regras, manualAberta, hoje),
    hoje,
    propriedade: locAtual ? { id: locAtual.propriedade.id, nome: locAtual.propriedade.nome } : null,
    lote: locAtual?.lote ? { id: locAtual.lote.id, nome: locAtual.lote.nome } : null,
    destino: destinoAtual ? { aptidao: destinoAtual.aptidao, papelReprodutivo: destinoAtual.papelReprodutivo } : null,
    composicao,
    ultimoPeso,
    situacao: baixaAtual ? "BAIXADO" : "ATIVO",
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
      motivo: l.movimentacao?.motivo ?? null,
      movimentacaoId: l.movimentacaoId,
    })),
    historicoDestinos: destinos.map((d) => ({
      id: d.id, aptidao: d.aptidao, papelReprodutivo: d.papelReprodutivo,
      desde: d.desde.toISOString().slice(0, 10), ate: d.ate ? d.ate.toISOString().slice(0, 10) : null,
    })),
    historicoCategoriasManuais: manuais.map((m) => ({
      id: m.id, categoria: m.categoria, desde: m.desde.toISOString().slice(0, 10), ate: m.ate ? m.ate.toISOString().slice(0, 10) : null,
      motivo: m.motivo, motivoEncerramento: m.motivoEncerramento,
    })),
    historicoPesagens: pesagens.map((p) => ({ id: p.id, data: p.data.toISOString().slice(0, 10), pesoKg: Number(p.pesoKg), tipo: p.tipo, origem: p.origem })),
    baixa: baixaAtual ? {
      id: baixaAtual.id, data: baixaAtual.data.toISOString().slice(0, 10), tipo: baixaAtual.tipo,
      motivo: baixaAtual.motivo ? { nome: baixaAtual.motivo.nome, classe: baixaAtual.motivo.classe } : null, observacao: baixaAtual.observacao,
      estornadaEm: baixaAtual.estornadaEm ? baixaAtual.estornadaEm.toISOString() : null, estornoMotivo: baixaAtual.estornoMotivo,
    } : (baixas[0] ? {
      id: baixas[0].id, data: baixas[0].data.toISOString().slice(0, 10), tipo: baixas[0].tipo,
      motivo: baixas[0].motivo ? { nome: baixas[0].motivo.nome, classe: baixas[0].motivo.classe } : null, observacao: baixas[0].observacao,
      estornadaEm: baixas[0].estornadaEm ? baixas[0].estornadaEm.toISOString() : null, estornoMotivo: baixas[0].estornoMotivo,
    } : null),
  };
}

// ---------- listar ----------

/**
 * Onde o animal "está" para fins de escopo e filtro: o ativo, na localização aberta; o que saiu,
 * na localização (e no destino) que a saída fechou. Assim a lista, o detalhe e o painel usam o
 * mesmo critério — um animal que só passou por um sítio não aparece nele.
 */
export function whereSituacao(input: {
  situacao: "ATIVO" | "BAIXADO" | "TODOS";
  propriedadeId?: number | null;
  loteId?: string | null;
  aptidao?: "LEITE" | "CORTE" | null;
  papelReprodutivo?: "NENHUM" | "RECEPTORA" | "DOADORA" | null;
}): Prisma.AnimalWhereInput {
  const lugar = {
    ...(input.propriedadeId != null ? { propriedadeId: input.propriedadeId } : {}),
    ...(input.loteId ? { loteId: input.loteId } : {}),
  };
  const destino = {
    ...(input.aptidao ? { aptidao: input.aptidao } : {}),
    ...(input.papelReprodutivo ? { papelReprodutivo: input.papelReprodutivo } : {}),
  };
  const temDestino = Object.keys(destino).length > 0;

  const ativo: Prisma.AnimalWhereInput = {
    localizacoes: { some: { ate: null, ...lugar } },
    baixas: { none: { estornadaEm: null } },
    ...(temDestino ? { destinos: { some: { ate: null, ...destino } } } : {}),
  };
  const baixado: Prisma.AnimalWhereInput = {
    baixas: {
      some: {
        estornadaEm: null,
        ...(Object.keys(lugar).length ? { localizacaoFechada: lugar } : {}),
        ...(temDestino ? { destinoFechado: destino } : {}),
      },
    },
  };
  if (input.situacao === "ATIVO") return ativo;
  if (input.situacao === "BAIXADO") return baixado;
  return { OR: [ativo, baixado] };
}


const ORDEM_HISTORICO = [{ desde: "desc" as const }, { criadoEm: "desc" as const }];

const INCLUDE_RESUMO = {
  localizacoes: { orderBy: ORDEM_HISTORICO, take: 1, include: { propriedade: true, lote: true } },
  destinos: { orderBy: ORDEM_HISTORICO, take: 1 },
  baixas: { where: { estornadaEm: null }, take: 1, select: { id: true } },
  composicao: { include: { raca: true } },
  pesagens: { orderBy: { data: "desc" as const }, take: 1 },
  categoriasManuais: SELECT_MANUAL_ABERTA,
} satisfies Prisma.AnimalInclude;

type AnimalComResumo = Prisma.AnimalGetPayload<{ include: typeof INCLUDE_RESUMO }>;

function resumoDe(animal: AnimalComResumo, regras: RegraCategoria[], hoje: Date): AnimalResumo {
  const loc = animal.localizacoes[0] ?? null;
  const destino = animal.destinos[0] ?? null;
  return mapearAnimalResumo({
    animal,
    categoria: avaliarCategoria({ sexo: animal.sexo, dataNascimento: animal.dataNascimento, partos: animal.partosAntesDaEntrada }, regras, manualDe(animal.categoriasManuais), hoje),
    hoje,
    propriedade: loc ? { id: loc.propriedade.id, nome: loc.propriedade.nome } : null,
    lote: loc?.lote ? { id: loc.lote.id, nome: loc.lote.nome } : null,
    destino: destino ? { aptidao: destino.aptidao, papelReprodutivo: destino.papelReprodutivo } : null,
    composicao: animal.composicao.map((c) => ({ sigla: c.raca.sigla, fracao64: c.fracao64 })),
    ultimoPeso: animal.pesagens[0] ? { pesoKg: Number(animal.pesagens[0].pesoKg), data: animal.pesagens[0].data } : null,
    situacao: animal.baixas.length ? "BAIXADO" : "ATIVO",
  });
}

export async function listar(filtros: ListarFiltrosInput, propriedadeEscopo: number | null): Promise<{ itens: AnimalResumo[]; total: number; painel: PainelRebanho }> {
  // o escopo do request (seletor global de sítio) prevalece; o filtro só refina dentro dele
  if (propriedadeEscopo != null && filtros.propriedadeId != null && filtros.propriedadeId !== propriedadeEscopo) {
    return { itens: [], total: 0, painel: agregarPainel([]) };
  }
  const hoje = new Date();
  const regras = await carregarRegras();
  const ordem = new Map(regras.map((r) => [r.id, r.ordem]));
  const where: Prisma.AnimalWhereInput = {
    AND: [
      whereSituacao({
        situacao: filtros.situacao,
        propriedadeId: propriedadeEscopo ?? filtros.propriedadeId ?? null,
        loteId: filtros.loteId ?? null,
        aptidao: filtros.aptidao ?? null,
        papelReprodutivo: filtros.papelReprodutivo ?? null,
      }),
      whereCategoria(filtros.categoriaId, regras, hoje),
      filtros.busca ? { OR: [
        { brinco: { contains: filtros.busca, mode: "insensitive" } },
        { nome: { contains: filtros.busca, mode: "insensitive" } },
      ] } : {},
    ],
  };

  const [total, pagina, paraPainel] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      include: INCLUDE_RESUMO,
      orderBy: [{ brinco: "asc" }, { id: "asc" }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    // painel sobre TODO o conjunto filtrado, com o mínimo de colunas
    prisma.animal.findMany({
      where,
      select: {
        id: true, brinco: true, nome: true, sexo: true, dataNascimento: true, dataEntrada: true, origem: true, partosAntesDaEntrada: true,
        localizacoes: { orderBy: ORDEM_HISTORICO, take: 1, select: { propriedade: { select: { id: true, nome: true } } } },
        destinos: { orderBy: ORDEM_HISTORICO, take: 1, select: { aptidao: true, papelReprodutivo: true } },
        baixas: { where: { estornadaEm: null }, take: 1, select: { id: true } },
        categoriasManuais: SELECT_MANUAL_ABERTA,
      },
    }),
  ]);

  const leves = paraPainel.map((a) => mapearAnimalResumo({
    animal: a,
    categoria: avaliarCategoria({ sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada }, regras, manualDe(a.categoriasManuais), hoje),
    hoje,
    propriedade: a.localizacoes[0]?.propriedade ?? null,
    lote: null,
    destino: a.destinos[0] ?? null,
    composicao: [],
    ultimoPeso: null,
    situacao: a.baixas.length ? "BAIXADO" : "ATIVO",
  }));

  return { itens: pagina.map((a) => resumoDe(a, regras, hoje)), total, painel: agregarPainel(leves, ordem) };
}

// ---------- movimentar (individual ou em massa) ----------

export async function movimentar(input: MovimentarInput, usuarioId: number | null, escopo: number | null = null): Promise<{ movimentacaoId: string; movidos: number }> {
  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  if (input.loteId) {
    const lote = await prisma.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado nesse sítio ou inativo", "loteId");
  }

  const ids = [...new Set(input.animalIds)];
  const movimentacaoId = crypto.randomUUID();
  const data = new Date(input.data);

  // Tudo é lido em lote e planejado antes de gravar: poucas queries por requisição, seja 1 animal
  // ou 300 (o laço antigo fazia ~8 queries por animal e estourava o timeout da transação).
  const movidos = await prisma.$transaction(async (tx) => {
    const animais = await tx.animal.findMany({ where: { id: { in: ids } }, select: { id: true, brinco: true, dataEntrada: true } });
    if (animais.length !== ids.length) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");

    // trava os brincos que chegam ao destino (ordem fixa evita deadlock entre movimentações)
    const brincos = [...new Set(animais.map((a) => normalizarBrinco(a.brinco)))].sort();
    for (const brinco of brincos) await travarBrinco(tx, input.propriedadeId, brinco);

    const [abertas, ultimas, baixasAtivas, ativosDestino] = await Promise.all([
      tx.localizacaoAnimal.findMany({ where: { animalId: { in: ids }, ate: null } }),
      escopo == null ? Promise.resolve([]) : tx.localizacaoAnimal.findMany({
        where: { animalId: { in: ids } }, orderBy: ORDEM_HISTORICO, distinct: ["animalId"], select: { animalId: true, propriedadeId: true },
      }),
      tx.baixaAnimal.findMany({ where: { animalId: { in: ids }, estornadaEm: null }, select: { animalId: true } }),
      ativosNoSitioParaBrinco(tx, input.propriedadeId),
    ]);

    const abertaPorAnimal = new Map(abertas.map((l) => [l.animalId, l]));
    const sitioPorAnimal = new Map(ultimas.map((l) => [l.animalId, l.propriedadeId]));
    const inativos = new Set(baixasAtivas.map((s) => s.animalId));

    const plano = planejarMovimentacaoEmMassa({
      animais: animais.map((a) => {
        const atual = abertaPorAnimal.get(a.id) ?? null;
        return {
          id: a.id,
          brinco: a.brinco,
          dataEntrada: a.dataEntrada,
          ativo: !inativos.has(a.id),
          noEscopo: escopo == null || !sitioPorAnimal.has(a.id) || sitioPorAnimal.get(a.id) === escopo,
          atual: atual ? { id: atual.id, propriedadeId: atual.propriedadeId, loteId: atual.loteId, desde: atual.desde } : null,
        };
      }),
      destino: { propriedadeId: input.propriedadeId, loteId: input.loteId ?? null },
      data,
      ativosDestino: new Map(ativosDestino.map((a) => [normalizarBrinco(a.brinco), a.animalId])),
      normalizar: normalizarBrinco,
    });

    if (plano.erros.length) {
      const lista = plano.erros.slice(0, 10).map((e) => `${e.brinco}: ${e.mensagem}`).join("; ");
      const resto = plano.erros.length > 10 ? ` (e mais ${plano.erros.length - 10})` : "";
      throw new RebanhoError(plano.erros.some((e) => e.mensagem.startsWith("brinco")) ? "BRINCO_DUPLICADO" : "VALIDACAO", `Nenhum animal foi movido. ${lista}${resto}`, "data");
    }
    if (!plano.abrir.length) return 0;

    if (plano.fechar.length) await tx.localizacaoAnimal.updateMany({ where: { id: { in: plano.fechar } }, data: { ate: data } });

    // o cabeçalho (data, destino, motivo) é o evento; cada animal ganha uma linha apontando para ele
    const cabecalho = await tx.movimentacao.create({
      data: {
        id: movimentacaoId, data, propriedadeDestinoId: input.propriedadeId, loteDestinoId: input.loteId ?? null,
        motivo: input.motivo ?? null, quantidade: plano.abrir.length, criadoPorId: usuarioId,
      },
    });

    const novas = plano.abrir.map((a) => ({
      id: crypto.randomUUID(),
      animalId: a.animalId,
      propriedadeId: input.propriedadeId,
      loteId: input.loteId ?? null,
      desde: data,
      movimentacaoId,
      criadoPorId: usuarioId,
    }));
    await tx.localizacaoAnimal.createMany({ data: novas });
    // itens: registro permanente de quem foi movido e de onde (sobrevive ao desfazer)
    await tx.movimentacaoAnimal.createMany({
      data: plano.abrir.map((a, i) => {
        const origem = abertaPorAnimal.get(a.animalId);
        return { movimentacaoId, animalId: a.animalId, origemPropriedadeId: origem?.propriedadeId ?? null, origemLoteId: origem?.loteId ?? null, localizacaoId: novas[i].id };
      }),
    });

    await tx.auditoriaPecuaria.createMany({
      data: [
        dadosAuditoria({ entidade: "Movimentacao", entidadeId: movimentacaoId, acao: "MOVIMENTACAO", usuarioId, depois: cabecalho }),
        ...plano.abrir.map((a, i) => dadosAuditoria({
          entidade: "LocalizacaoAnimal", entidadeId: novas[i].id, animalId: a.animalId, acao: "MOVIMENTACAO", usuarioId,
          antes: a.anteriorId ? abertaPorAnimal.get(a.animalId) : null, depois: novas[i],
        })),
      ],
    });
    return novas.length;
  }, { timeout: 30_000, maxWait: 10_000 });

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

    await auditar(tx, { entidade: "DestinoAnimal", entidadeId: novo.id, animalId: input.animalId, acao: "MUDANCA_DESTINO", usuarioId, antes: atual, depois: novo });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

// ---------- desfazer (localização / destino) ----------

/** Converte MovimentacaoError de planejarDesfazer em RebanhoError (422). */
function planejarDesfazerOuFalha(linhas: Array<{ id: string; desde: Date; ate: Date | null; criadoEm: Date }>) {
  try {
    return planejarDesfazer(linhas);
  } catch (e) {
    if (e instanceof MovimentacaoError) throw new RebanhoError("VALIDACAO", e.message);
    throw e;
  }
}

export async function desfazerLocalizacao(animalId: string, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await exigirAnimalAtivo(tx, animalId);

    const linhas = await tx.localizacaoAnimal.findMany({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] });
    const plano = planejarDesfazerOuFalha(linhas.map((l) => ({ id: l.id, desde: l.desde, ate: l.ate, criadoEm: l.criadoEm })));

    const referenciada = await tx.baixaAnimal.findFirst({ where: { localizacaoFechadaId: plano.remover.id } });
    if (referenciada) throw new RebanhoError("CONFLITO", "Essa movimentação já foi usada em uma baixa e não pode ser desfeita");

    const removida = linhas.find((l) => l.id === plano.remover.id)!;
    const anterior = linhas.find((l) => l.id === plano.reabrir.id)!;

    // o brinco pode ter sido reutilizado no sítio anterior enquanto o animal esteve fora dele
    await exigirBrincoLivre(tx, animal.brinco, anterior.propriedadeId, animalId, "no sítio anterior");

    await tx.localizacaoAnimal.delete({ where: { id: removida.id } });
    const reaberta = await tx.localizacaoAnimal.update({ where: { id: anterior.id }, data: { ate: null } });

    await auditar(tx, { entidade: "LocalizacaoAnimal", entidadeId: removida.id, animalId, acao: "DESFAZER", usuarioId, antes: { removida, anteriorFechada: anterior }, depois: { reaberta } });

    // desfeita animal a animal até o último: a movimentação inteira passa a constar como desfeita
    if (removida.movimentacaoId) {
      await tx.movimentacaoAnimal.updateMany({ where: { movimentacaoId: removida.movimentacaoId, animalId }, data: { desfeitoEm: new Date() } });
      const restantes = await tx.localizacaoAnimal.count({ where: { movimentacaoId: removida.movimentacaoId } });
      if (restantes === 0) {
        await tx.movimentacao.update({ where: { id: removida.movimentacaoId }, data: { desfeitaEm: new Date(), desfeitaMotivo: "Desfeita animal a animal" } });
      }
    }
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

/**
 * Desfaz a movimentação inteira: para cada animal, apaga a linha que ela abriu e reabre a
 * anterior; a movimentação fica marcada como desfeita (histórico, como um estorno). Tudo ou
 * nada — se um animal já foi movido de novo, saiu ou teve a linha usada numa saída, nada muda.
 */
export async function desfazerMovimentacao(id: string, motivo: string, usuarioId: number | null, escopo: number | null = null): Promise<{ desfeitos: number }> {
  const mov = await prisma.movimentacao.findUnique({ where: { id } });
  if (!mov || (escopo != null && mov.propriedadeDestinoId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Movimentação não encontrada");
  if (mov.desfeitaEm) throw new RebanhoError("JA_ESTORNADA", "Essa movimentação já foi desfeita");

  return prisma.$transaction(async (tx) => {
    const linhas = await tx.localizacaoAnimal.findMany({ where: { movimentacaoId: id }, include: { animal: { select: { brinco: true } } } });
    if (!linhas.length) throw new RebanhoError("CONFLITO", "Essa movimentação não tem mais animais para desfazer");
    const animalIds = linhas.map((l) => l.animalId);

    const [historico, baixasAtivas, usadasEmBaixa] = await Promise.all([
      tx.localizacaoAnimal.findMany({ where: { animalId: { in: animalIds } } }),
      tx.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null }, select: { animalId: true } }),
      tx.baixaAnimal.findMany({ where: { localizacaoFechadaId: { in: linhas.map((l) => l.id) } }, select: { localizacaoFechadaId: true } }),
    ]);
    const porId = new Map(historico.map((h) => [h.id, h]));
    const historicoPorAnimal = new Map<string, Array<{ id: string; desde: Date; ate: Date | null; criadoEm: Date }>>();
    for (const h of historico) {
      const lista = historicoPorAnimal.get(h.animalId) ?? [];
      lista.push({ id: h.id, desde: h.desde, ate: h.ate, criadoEm: h.criadoEm });
      historicoPorAnimal.set(h.animalId, lista);
    }

    const plano = planejarDesfazerMovimentacao({
      linhas: linhas.map((l) => ({ id: l.id, animalId: l.animalId, brinco: l.animal.brinco })),
      historicoPorAnimal,
      animaisInativos: new Set(baixasAtivas.map((s) => s.animalId)),
      linhasUsadasEmBaixa: new Set(usadasEmBaixa.map((s) => s.localizacaoFechadaId).filter((v): v is string => v != null)),
    });
    if (plano.erros.length) {
      const lista = plano.erros.slice(0, 10).map((e) => `${e.brinco}: ${e.mensagem}`).join("; ");
      const resto = plano.erros.length > 10 ? ` (e mais ${plano.erros.length - 10})` : "";
      throw new RebanhoError("CONFLITO", `Nada foi desfeito. ${lista}${resto}`);
    }

    // o brinco pode ter sido reutilizado no sítio de origem enquanto o animal esteve fora;
    // trava (sítio, brinco) em ordem fixa e lê os ativos de cada sítio uma vez só
    const brincoPorAnimal = new Map(linhas.map((l) => [l.animalId, l.animal.brinco]));
    const porSitio = new Map<number, string[]>();
    for (const p of plano.passos) {
      const sitio = porId.get(p.reabrir)!.propriedadeId;
      porSitio.set(sitio, [...(porSitio.get(sitio) ?? []), p.animalId]);
    }
    for (const [sitio, ids] of [...porSitio].sort((a, b) => a[0] - b[0])) {
      const brincos = [...new Set(ids.map((a) => normalizarBrinco(brincoPorAnimal.get(a)!)))].sort();
      for (const brinco of brincos) await travarBrinco(tx, sitio, brinco);
      const ativos = await ativosNoSitioParaBrinco(tx, sitio);
      for (const animalId of ids) {
        const brinco = brincoPorAnimal.get(animalId)!;
        if (!brincoDisponivel({ brinco, propriedadeId: sitio, ativosNoSitio: ativos, ignorarAnimalId: animalId })) {
          throw new RebanhoError("BRINCO_DUPLICADO", `Nada foi desfeito. Já existe um animal ativo com o brinco ${normalizarBrinco(brinco)} no sítio anterior`);
        }
      }
    }

    // apaga antes de reabrir: o índice parcial não admite duas linhas abertas por animal
    await tx.localizacaoAnimal.deleteMany({ where: { id: { in: plano.passos.map((p) => p.remover) } } });
    await tx.localizacaoAnimal.updateMany({ where: { id: { in: plano.passos.map((p) => p.reabrir) } }, data: { ate: null } });
    const agora = new Date();
    await tx.movimentacaoAnimal.updateMany({ where: { movimentacaoId: id, desfeitoEm: null }, data: { desfeitoEm: agora } });
    const desfeita = await tx.movimentacao.update({ where: { id }, data: { desfeitaEm: agora, desfeitaMotivo: motivo } });

    await tx.auditoriaPecuaria.createMany({
      data: [
        dadosAuditoria({ entidade: "Movimentacao", entidadeId: id, acao: "DESFAZER", usuarioId, antes: mov, depois: desfeita }),
        ...plano.passos.map((p) => dadosAuditoria({
          entidade: "LocalizacaoAnimal", entidadeId: p.remover, animalId: p.animalId, acao: "DESFAZER", usuarioId,
          antes: { removida: porId.get(p.remover), anteriorFechada: porId.get(p.reabrir) }, depois: { reaberta: { ...porId.get(p.reabrir), ate: null } },
        })),
      ],
    });
    return { desfeitos: plano.passos.length };
  }, { timeout: 30_000, maxWait: 10_000 });
}

export async function desfazerDestino(animalId: string, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await exigirAnimalAtivo(tx, animalId);

    const linhas = await tx.destinoAnimal.findMany({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] });
    const plano = planejarDesfazerOuFalha(linhas.map((l) => ({ id: l.id, desde: l.desde, ate: l.ate, criadoEm: l.criadoEm })));

    const referenciada = await tx.baixaAnimal.findFirst({ where: { destinoFechadoId: plano.remover.id } });
    if (referenciada) throw new RebanhoError("CONFLITO", "Essa mudança de destino já foi usada em uma baixa e não pode ser desfeita");

    const removida = linhas.find((l) => l.id === plano.remover.id)!;
    const anterior = linhas.find((l) => l.id === plano.reabrir.id)!;

    await tx.destinoAnimal.delete({ where: { id: removida.id } });
    const reaberta = await tx.destinoAnimal.update({ where: { id: anterior.id }, data: { ate: null } });

    await auditar(tx, { entidade: "DestinoAnimal", entidadeId: removida.id, animalId, acao: "DESFAZER", usuarioId, antes: { removida, anteriorFechada: anterior }, depois: { reaberta } });
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

// ---------- baixa ----------

export async function darBaixa(input: BaixaInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, input.animalId, escopo);

  const errosData = validarDataBaixa({ dataEntrada: animal.dataEntrada, dataBaixa: input.data });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  if (input.motivoId) {
    const motivo = await prisma.motivoBaixa.findFirst({ where: { id: input.motivoId, ativo: true } });
    if (!motivo) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de baixa não encontrado", "motivoId");
    if (!motivoAceito(input.tipo, motivo.classe)) {
      throw new RebanhoError("VALIDACAO", mensagemMotivoRecusado(input.tipo, motivo.classe), "motivoId");
    }
  }

  await prisma.$transaction(async (tx) => {
    const [ativa, localAberta, destAberto] = await Promise.all([
      baixaAberta(tx, input.animalId),
      localizacaoAberta(tx, input.animalId),
      destinoAberto(tx, input.animalId),
    ]);

    const plano = planejar(() => planejarBaixa({
      animalAtivo: !ativa,
      localizacaoAberta: localAberta ? { id: localAberta.id, desde: localAberta.desde } : null,
      destinoAberto: destAberto ? { id: destAberto.id, desde: destAberto.desde } : null,
      data: input.data,
    }));

    if (plano.fecharLocalizacao) await tx.localizacaoAnimal.update({ where: { id: plano.fecharLocalizacao.id }, data: { ate: new Date(plano.fecharLocalizacao.ate) } });
    if (plano.fecharDestino) await tx.destinoAnimal.update({ where: { id: plano.fecharDestino.id }, data: { ate: new Date(plano.fecharDestino.ate) } });

    const baixa = await tx.baixaAnimal.create({
      data: {
        animalId: input.animalId, data: new Date(input.data), tipo: input.tipo, motivoId: input.motivoId ?? null, observacao: input.observacao ?? null,
        localizacaoFechadaId: plano.fecharLocalizacao?.id ?? null, destinoFechadoId: plano.fecharDestino?.id ?? null, criadoPorId: usuarioId,
      },
    });

    await auditar(tx, { entidade: "BaixaAnimal", entidadeId: baixa.id, animalId: input.animalId, acao: "BAIXA", usuarioId, depois: baixa });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

export async function estornarBaixa(animalId: string, input: EstornoBaixaInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const animal = await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    const baixa = await baixaAberta(tx, animalId);
    if (!baixa) throw new RebanhoError("JA_ESTORNADA", "Não há baixa ativa para estornar (ou já foi estornada)");

    const [localAberta, destAberto] = await Promise.all([localizacaoAberta(tx, animalId), destinoAberto(tx, animalId)]);
    const plano = planejar(() => planejarEstornoBaixa({
      baixa: { localizacaoFechadaId: baixa.localizacaoFechadaId, destinoFechadoId: baixa.destinoFechadoId },
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

    const atualizada = await tx.baixaAnimal.update({
      where: { id: baixa.id },
      data: { estornadaEm: new Date(), estornoMotivo: input.motivo },
    });

    await auditar(tx, { entidade: "BaixaAnimal", entidadeId: baixa.id, animalId, acao: "ESTORNO", usuarioId, antes: baixa, depois: atualizada });
  });

  return buscarFicha(animal.id, null).then((f) => f as AnimalResumo);
}

// ---------- pesagem ----------

export async function registrarPesagem(input: PesagemInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null) {
  const animal = await exigirNoEscopo(prisma, input.animalId, escopo);
  const baixa = await prisma.baixaAnimal.findFirst({ where: { animalId: input.animalId, estornadaEm: null } });

  const errosData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem: input.data });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  const pesagem = await prisma.$transaction(async (tx) => {
    const criada = await tx.pesagem.create({
      data: { animalId: input.animalId, data: new Date(input.data), pesoKg: new Prisma.Decimal(input.pesoKg), tipo: input.tipo, origem: input.origem, observacao: input.observacao ?? null, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "Pesagem", entidadeId: criada.id, animalId: input.animalId, acao: "REGISTRO", usuarioId, depois: criada });
    return criada;
  });

  return { id: pesagem.id, animalId: pesagem.animalId, data: pesagem.data.toISOString().slice(0, 10), pesoKg: Number(pesagem.pesoKg), tipo: pesagem.tipo, origem: pesagem.origem };
}

export async function editarPesagem(id: string, input: EditarPesagemInput, usuarioId: number | null, escopo: number | null = null) {
  const existente = await prisma.pesagem.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Pesagem não encontrada");

  const animal = await exigirNoEscopo(prisma, existente.animalId, escopo);
  const baixa = await prisma.baixaAnimal.findFirst({ where: { animalId: existente.animalId, estornadaEm: null } });

  const dataPesagem = input.data ?? existente.data;
  const errosData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem });
  if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

  const atualizada = await prisma.$transaction(async (tx) => {
    const salva = await tx.pesagem.update({
      where: { id },
      data: {
        data: input.data != null ? new Date(input.data) : undefined,
        pesoKg: input.pesoKg != null ? new Prisma.Decimal(input.pesoKg) : undefined,
        tipo: input.tipo ?? undefined,
        origem: input.origem ?? undefined,
        observacao: input.observacao === undefined ? undefined : input.observacao,
      },
    });
    await auditar(tx, { entidade: "Pesagem", entidadeId: id, animalId: existente.animalId, acao: "EDICAO", usuarioId, antes: existente, depois: salva });
    return salva;
  });

  return { id: atualizada.id, animalId: atualizada.animalId, data: atualizada.data.toISOString().slice(0, 10), pesoKg: Number(atualizada.pesoKg), tipo: atualizada.tipo, origem: atualizada.origem, observacao: atualizada.observacao };
}

export async function excluirPesagem(id: string, usuarioId: number | null, escopo: number | null = null): Promise<void> {
  const existente = await prisma.pesagem.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Pesagem não encontrada");
  await exigirNoEscopo(prisma, existente.animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await tx.pesagem.delete({ where: { id } });
    await auditar(tx, { entidade: "Pesagem", entidadeId: id, animalId: existente.animalId, acao: "EXCLUSAO", usuarioId, antes: existente });
  });
}

// ---------- auditoria ----------

export interface EntradaAuditoriaDTO {
  em: string;
  acao: string;
  entidade: string;
  usuarioNome: string | null;
  resumo: string;
}

export async function buscarAuditoriaAnimal(animalId: string, escopo: number | null = null): Promise<EntradaAuditoriaDTO[]> {
  await exigirNoEscopo(prisma, animalId, escopo);

  // por animalId: inclui o que já foi apagado (pesagem excluída, movimentação/destino desfeitos)
  const entradas = await prisma.auditoriaPecuaria.findMany({
    where: { animalId },
    include: { usuario: { select: { nome: true } } },
    orderBy: { em: "desc" },
    take: 50,
  });

  return entradas.map((e) => ({
    em: e.em.toISOString(),
    acao: e.acao,
    entidade: e.entidade,
    usuarioNome: e.usuario?.nome ?? null,
    resumo: resumoAuditoria(e.entidade, e.acao),
  }));
}
