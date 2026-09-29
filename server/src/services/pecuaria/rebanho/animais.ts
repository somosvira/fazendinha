import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import {
  auditar, dadosAuditoria, exigirAfetadas, hojeFazenda, hojeFazendaDate, traduzirConflitoUnico, travarAnimais, travarBrinco, travarBrincos, travarLoteAtivo,
  RebanhoError, type DbPecuaria,
} from "./regras.js";
import { brincoDisponivel, normalizarBrinco } from "./brinco.calc.js";
import { validarDatasAnimal, validarDataBaixa, validarDataPesagem, validarDataDestino, planejarAjusteEntrada } from "./datas.calc.js";
import { validarComposicao, rotuloComposicao, composicaoRespeitaHerdanca, type FracaoRaca } from "./composicao.calc.js";
import { validarFiliacao, validarIntervaloPartos, genitorEhDescendente, composicaoDosGenitores, type GenitorRef } from "./genetica.calc.js";
import { planejarDestino, planejarDesfazer, planejarDesfazerMovimentacao, planejarMovimentacaoEmMassa, MovimentacaoError, type LinhaHistorico } from "./movimentacao.calc.js";
import { avaliarCategoria, faixaNascimentoParaIdade, validarDataCategoriaManual, type RegraCategoria } from "./categoria.calc.js";
import { carregarRegras, manualDe, SELECT_MANUAL_ABERTA, whereCategoria, whereSemCategoria } from "./categorias.js";
import { planejarBaixa, planejarEstornoBaixa, motivoAceito, mensagemMotivoRecusado, BaixaError } from "./baixa.calc.js";
import { agregarPainel, mapearAnimalResumo, resumoAuditoria, type AnimalResumo, type AnimalFicha, type ItemComposicaoFicha, type PainelRebanho, type FiliacaoLadoDTO } from "./mappers.js";
import { resumoPeso } from "./peso.calc.js";
import { diferencas, type CampoAlteracao } from "./auditoria.calc.js";
import type {
  CadastrarAnimalInput, EditarAnimalInput, MovimentarInput, MudarDestinoInput,
  BaixaInput, EstornoBaixaInput, PesagemInput, EditarPesagemInput, ListarFiltrosInput,
  SubstituirComposicaoInput, CategoriaManualInput, RemoverCategoriaManualInput,
  DefinirFiliacaoInput,
} from "./schemas.js";

/** Entidades de cadastro que `/auditoria` (fora do animal) pode consultar. */
export const ENTIDADES_AUDITORIA_CADASTRO = ["Lote", "Raca", "MotivoBaixa", "CategoriaAnimal", "GenitorExterno", "MaterialGenetico"] as const;
export type EntidadeAuditoriaCadastro = (typeof ENTIDADES_AUDITORIA_CADASTRO)[number];

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
  // mesma mensagem de "não existe": fora do escopo não pode revelar que o animal existe noutro sítio (S3)
  if (ultima && ultima.propriedadeId !== escopo) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
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
    .map((i) => ({ racaId: i.racaId, sigla: i.raca.sigla, nome: i.raca.nome, racaAtiva: i.raca.ativo, fracao64: i.fracao64, fracaoCalculada64: i.fracaoCalculada64, origem: i.origem }))
    .sort((a, b) => b.fracao64 - a.fracao64);
}

// ---------- filiação (v2 · Genética) ----------
//
// Composição do filho é calculada agrupando por `racaId` (não por sigla — duas raças podem ter
// a mesma sigla em teoria, `racaId` é a chave real). `composicaoDosGenitores`/`calcularComposicaoFilho`
// são agnósticos ao significado do campo `sigla` de `FracaoRaca`; aqui ele carrega o `racaId`.

async function composicaoAnimalComoFracao(db: DbPecuaria, animalId: string): Promise<FracaoRaca[]> {
  const itens = await db.composicaoRacial.findMany({ where: { animalId } });
  return itens.map((i) => ({ sigla: i.racaId, fracao64: i.fracao64 }));
}

async function composicaoGenitorExternoComoFracao(db: DbPecuaria, genitorId: string): Promise<FracaoRaca[]> {
  const itens = await db.composicaoGenitorExterno.findMany({ where: { genitorId } });
  return itens.map((i) => ({ sigla: i.racaId, fracao64: i.fracao64 }));
}

async function composicaoHerdada(db: DbPecuaria, animal: { maeId: string | null; maeExternaId: string | null; paiId: string | null; paiExternoId: string | null }): Promise<FracaoRaca[]> {
  const [mae, pai] = await Promise.all([
    animal.maeId ? composicaoAnimalComoFracao(db, animal.maeId) : animal.maeExternaId ? composicaoGenitorExternoComoFracao(db, animal.maeExternaId) : Promise.resolve(null),
    animal.paiId ? composicaoAnimalComoFracao(db, animal.paiId) : animal.paiExternoId ? composicaoGenitorExternoComoFracao(db, animal.paiExternoId) : Promise.resolve(null),
  ]);
  return composicaoDosGenitores(mae, pai) ?? [];
}

function exigirHerdanca(itens: FracaoRaca[], herdada: FracaoRaca[], justificativa?: string): void {
  if (composicaoRespeitaHerdanca(itens, herdada)) return;
  if (justificativa?.trim() && justificativa.trim().length >= 10) return;
  throw new RebanhoError("VALIDACAO", "A composição não pode alterar a parcela calculada dos genitores. Para registrar uma exceção, informe uma justificativa de pelo menos 10 caracteres.", "composicao");
}

function linhasComposicao(animalId: string, itens: Array<{ racaId: string; fracao64: number }>, herdada: FracaoRaca[], usuarioId: number | null, excecao = false) {
  const porRaca = new Map(herdada.map((c) => [c.sigla, c.fracao64]));
  return itens.map((c) => {
    const fracaoCalculada64 = excecao ? 0 : (porRaca.get(c.racaId) ?? 0);
    return { animalId, racaId: c.racaId, fracao64: c.fracao64, fracaoCalculada64, origem: fracaoCalculada64 === c.fracao64 ? "CALCULADA" as const : "INFORMADA" as const, criadoPorId: usuarioId };
  });
}

/** Sobe de `raizIds` por até 3 gerações (filhos, netos, bisnetos) — usado para checar ciclo. */
async function carregarDescendentes(db: DbPecuaria, raizId: string): Promise<Set<string>> {
  const vistos = new Set<string>();
  let atual = [raizId];
  for (let nivel = 0; nivel < 3 && atual.length; nivel += 1) {
    const filhos = await db.animal.findMany({ where: { OR: [{ maeId: { in: atual } }, { paiId: { in: atual } }] }, select: { id: true } });
    const novos = filhos.map((f) => f.id).filter((id) => !vistos.has(id));
    novos.forEach((id) => vistos.add(id));
    atual = novos;
  }
  return vistos;
}

interface FiliacaoResolvida {
  maeId: string | null;
  paiId: string | null;
  maeExternaId: string | null;
  paiExternoId: string | null;
  maeComposicao: FracaoRaca[] | null;
  paiComposicao: FracaoRaca[] | null;
  avisos: Array<{ campo: string; mensagem: string }>;
}

/**
 * Valida e resolve a filiação proposta (mãe/pai, animal nosso ou genitor externo): sexo, o
 * próprio animal, nascimento anterior, ciclo de ancestralidade (até 3 gerações) e o aviso de
 * intervalo entre partos. Não grava nada — só lê e valida. `input` já vem no formato "estado
 * final" (campo ausente/null = sem genitor daquele lado).
 */
async function resolverFiliacao(
  db: DbPecuaria,
  filho: { id: string; dataNascimento: Date },
  input: { maeId?: string | null; paiId?: string | null; maeExternaId?: string | null; paiExternoId?: string | null },
  atual: { maeExternaId: string | null; paiExternoId: string | null } = { maeExternaId: null, paiExternoId: null },
): Promise<FiliacaoResolvida> {
  const maeId = input.maeId ?? null;
  const paiId = input.paiId ?? null;
  const maeExternaId = input.maeExternaId ?? null;
  const paiExternoId = input.paiExternoId ?? null;

  async function carregarLado(animalId: string | null, externoId: string | null, campo: "maeId" | "paiId" | "maeExternaId" | "paiExternoId"): Promise<{ ref: GenitorRef | null; composicao: FracaoRaca[] | null }> {
    if (animalId) {
      const a = await db.animal.findUnique({ where: { id: animalId } });
      if (!a) throw new RebanhoError("NAO_ENCONTRADO", "Genitor não encontrado", campo);
      return {
        ref: { tipo: "ANIMAL", id: a.id, sexo: a.sexo, dataNascimento: a.dataNascimento.toISOString().slice(0, 10) },
        composicao: await composicaoAnimalComoFracao(db, a.id),
      };
    }
    if (externoId) {
      const g = await db.genitorExterno.findUnique({ where: { id: externoId } });
      if (!g) throw new RebanhoError("NAO_ENCONTRADO", "Genitor externo não encontrado", campo);
      // inativo só é aceito se já era o genitor atual daquele lado
      const atualDoLado = campo === "maeExternaId" ? atual.maeExternaId : atual.paiExternoId;
      if (!g.ativo && g.id !== atualDoLado) throw new RebanhoError("NAO_ENCONTRADO", "Genitor externo não encontrado ou inativo", campo);
      return {
        ref: { tipo: "EXTERNO", id: g.id, sexo: g.sexo, ativo: g.ativo },
        composicao: await composicaoGenitorExternoComoFracao(db, g.id),
      };
    }
    return { ref: null, composicao: null };
  }

  const [mae, pai] = await Promise.all([
    carregarLado(maeId, maeExternaId, maeId ? "maeId" : "maeExternaId"),
    carregarLado(paiId, paiExternoId, paiId ? "paiId" : "paiExternoId"),
  ]);

  const filhoRef = { id: filho.id, dataNascimento: filho.dataNascimento.toISOString().slice(0, 10) };
  const { erros, avisos } = validarFiliacao(filhoRef, mae.ref, pai.ref);
  if (erros.length) throw new RebanhoError("VALIDACAO", erros[0].mensagem, erros[0].campo);

  const idsAnimaisPropostos = [
    mae.ref?.tipo === "ANIMAL" ? { campo: "maeId" as const, id: mae.ref.id } : null,
    pai.ref?.tipo === "ANIMAL" ? { campo: "paiId" as const, id: pai.ref.id } : null,
  ].filter((x): x is { campo: "maeId" | "paiId"; id: string } => x != null);

  if (idsAnimaisPropostos.length) {
    const descendentes = await carregarDescendentes(db, filho.id);
    for (const { campo, id } of idsAnimaisPropostos) {
      if (genitorEhDescendente(id, descendentes)) {
        throw new RebanhoError("VALIDACAO", "Esse animal é descendente do próprio filho — não pode ser seu genitor", campo);
      }
    }
  }

  let avisosFinais = avisos;
  if (mae.ref?.tipo === "ANIMAL") {
    const outrosPartos = await db.animal.findMany({ where: { maeId: mae.ref.id, id: { not: filho.id } }, select: { dataNascimento: true } });
    avisosFinais = [...avisos, ...validarIntervaloPartos(filhoRef.dataNascimento, outrosPartos.map((p) => p.dataNascimento.toISOString().slice(0, 10)))];
  }

  return { maeId, paiId, maeExternaId, paiExternoId, maeComposicao: mae.composicao, paiComposicao: pai.composicao, avisos: avisosFinais };
}

/**
 * Recalcula a parcela herdada e preserva a manual quando couber. Ao retirar a filiação,
 * remove apenas a parcela antes atribuída aos genitores.
 */
async function aplicarComposicaoCalculada(tx: DbPecuaria, animalId: string, sugerida: FracaoRaca[] | null, usuarioId: number | null): Promise<boolean> {
  const atual = await tx.composicaoRacial.findMany({ where: { animalId } });
  if (sugerida == null && atual.length === 0) return false;
  if (sugerida == null && atual.some((c) => c.origem === "INFORMADA")) {
    await tx.composicaoRacial.deleteMany({ where: { animalId } });
    const informada = atual.map((c) => ({ racaId: c.racaId, fracao64: c.fracao64 - c.fracaoCalculada64 })).filter((c) => c.fracao64 > 0);
    if (informada.length) await tx.composicaoRacial.createMany({ data: linhasComposicao(animalId, informada, [], usuarioId) });
    const depois = await tx.composicaoRacial.findMany({ where: { animalId } });
    await auditar(tx, { entidade: "ComposicaoRacial", entidadeId: animalId, animalId, acao: "EDICAO", usuarioId, antes: atual, depois });
    return true;
  }
  const podeSubstituir = atual.length === 0 || atual.every((c) => c.origem === "CALCULADA");
  if (!podeSubstituir && sugerida && composicaoRespeitaHerdanca(atual.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })), sugerida)) {
    // A parte manual cabe no lado desconhecido: preserva o total e atualiza sua proveniência.
    const fixa = new Map(sugerida.map((c) => [c.sigla, c.fracao64]));
    for (const item of atual) {
      const fracaoCalculada64 = fixa.get(item.racaId) ?? 0;
      await tx.composicaoRacial.update({ where: { id: item.id }, data: { fracaoCalculada64, origem: fracaoCalculada64 === item.fracao64 ? "CALCULADA" : "INFORMADA" } });
    }
    const depois = await tx.composicaoRacial.findMany({ where: { animalId } });
    await auditar(tx, { entidade: "ComposicaoRacial", entidadeId: animalId, animalId, acao: "EDICAO", usuarioId, antes: atual, depois });
    return true;
  }
  await tx.composicaoRacial.deleteMany({ where: { animalId } });
  if (sugerida?.length) {
    await tx.composicaoRacial.createMany({
        data: sugerida.map((c) => ({ animalId, racaId: c.sigla, fracao64: c.fracao64, fracaoCalculada64: c.fracao64, origem: "CALCULADA" as const, criadoPorId: usuarioId })),
    });
  }
  const depois = await tx.composicaoRacial.findMany({ where: { animalId } });
  await auditar(tx, { entidade: "ComposicaoRacial", entidadeId: animalId, animalId, acao: "EDICAO", usuarioId, antes: atual, depois });
  return true;
}

/** Rótulo de uma composição calculada (sigla=racaId): resolve os nomes reais antes de formatar. */
async function rotularComposicaoCalculada(db: DbPecuaria, itens: FracaoRaca[] | null): Promise<{ itens: Array<{ racaId: string; sigla: string; fracao64: number }>; rotulo: string } | null> {
  if (itens == null) return null;
  const racas = await db.raca.findMany({ where: { id: { in: itens.map((i) => i.sigla) } } });
  const mapa = new Map(racas.map((r) => [r.id, r.sigla]));
  const comSigla = itens.map((i) => ({ racaId: i.sigla, sigla: mapa.get(i.sigla) ?? "?", fracao64: i.fracao64 }));
  return { itens: comSigla, rotulo: rotuloComposicao(comSigla.map((i) => ({ sigla: i.sigla, fracao64: i.fracao64 }))) };
}

// ---------- cadastrar ----------

export async function cadastrar(input: CadastrarAnimalInput, usuarioId: number | null): Promise<AnimalResumo & { avisos: Array<{ campo: string; mensagem: string }> }> {
  const erosDatas = validarDatasAnimal({ dataNascimento: input.dataNascimento, dataEntrada: input.dataEntrada, origem: input.origem });
  if (erosDatas.length) throw new RebanhoError("VALIDACAO", erosDatas[0].mensagem, erosDatas[0].campo);

  // receptora/doadora e partos anteriores só existem em fêmea (R1)
  if (input.sexo === "M" && input.papelReprodutivo !== "NENHUM") {
    throw new RebanhoError("VALIDACAO", "Receptora/doadora só se aplica a fêmeas", "papelReprodutivo");
  }
  if (input.sexo === "M" && input.partosAntesDaEntrada > 0) {
    throw new RebanhoError("VALIDACAO", "Partos antes da entrada só se aplica a fêmeas", "partosAntesDaEntrada");
  }

  if (input.composicao.length) {
    const errosComposicao = validarComposicao(input.composicao.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })));
    if (errosComposicao.length) throw new RebanhoError("VALIDACAO", errosComposicao[0].mensagem, errosComposicao[0].campo);
  }

  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  // filiação (v2 · Genética): validada antes da transação — o animal ainda não existe, então o
  // "ciclo" não pode ocorrer (nenhum descendente aponta pra um id que ainda não foi gerado).
  const temFiliacao = input.maeId != null || input.paiId != null || input.maeExternaId != null || input.paiExternoId != null;
  const filiacaoResolvida = temFiliacao
    ? await resolverFiliacao(prisma, { id: crypto.randomUUID(), dataNascimento: new Date(input.dataNascimento) }, input)
    : null;
  const composicaoSugeridaCadastro = filiacaoResolvida ? composicaoDosGenitores(filiacaoResolvida.maeComposicao, filiacaoResolvida.paiComposicao) : null;
  const herdadaCadastro = composicaoSugeridaCadastro ?? [];
  if (input.composicao.length) exigirHerdanca(input.composicao.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })), herdadaCadastro);
  if (input.composicao.length) {
    const herdadas = new Set(herdadaCadastro.map((c) => c.sigla));
    const racaIds = [...new Set(input.composicao.map((c) => c.racaId))];
    const encontradas = await prisma.raca.findMany({ where: { id: { in: racaIds } }, select: { id: true, ativo: true } });
    if (encontradas.length !== racaIds.length || encontradas.some((r) => !r.ativo && !herdadas.has(r.id))) {
      throw new RebanhoError("NAO_ENCONTRADO", "Raça da composição não encontrada ou inativa", "composicao");
    }
  }

  // animal novo (id ainda não existe): não há trava de animal; lote antes do brinco (ordem em regras.ts)
  const criado = await prisma.$transaction(async (tx) => {
    if (input.loteId) await travarLoteAtivo(tx, input.loteId, input.propriedadeId);
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
        maeId: filiacaoResolvida?.maeId ?? null,
        paiId: filiacaoResolvida?.paiId ?? null,
        maeExternaId: filiacaoResolvida?.maeExternaId ?? null,
        paiExternoId: filiacaoResolvida?.paiExternoId ?? null,
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
        data: linhasComposicao(animal.id, input.composicao, herdadaCadastro, usuarioId),
      });
    } else if (composicaoSugeridaCadastro && composicaoSugeridaCadastro.length) {
      // sem composição informada mas com genitores conhecidos: grava como CALCULADA (sigla=racaId)
      await tx.composicaoRacial.createMany({
        data: composicaoSugeridaCadastro.map((c) => ({ animalId: animal.id, racaId: c.sigla, fracao64: c.fracao64, fracaoCalculada64: c.fracao64, origem: "CALCULADA" as const, criadoPorId: usuarioId })),
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

  return buscarFicha(criado.id, null).then((f) => ({ ...f, avisos: filiacaoResolvida?.avisos ?? [] }) as AnimalResumo & { avisos: Array<{ campo: string; mensagem: string }> });
}

// ---------- editar (só campos fixos) ----------

/** Nascimento novo precisa continuar depois dos genitores (animais) e antes de todos os filhos. */
async function exigirOrdemNascimento(db: DbPecuaria, animal: { id: string; maeId: string | null; paiId: string | null }, nascimento: Date): Promise<void> {
  const genitorIds = [animal.maeId, animal.paiId].filter((x): x is string => x != null);
  const [genitores, filhoMaisVelho] = await Promise.all([
    genitorIds.length ? db.animal.findMany({ where: { id: { in: genitorIds } }, select: { dataNascimento: true } }) : Promise.resolve([]),
    db.animal.findFirst({ where: { OR: [{ maeId: animal.id }, { paiId: animal.id }] }, orderBy: { dataNascimento: "asc" }, select: { dataNascimento: true } }),
  ]);
  if (genitores.some((g) => g.dataNascimento.getTime() >= nascimento.getTime())) {
    throw new RebanhoError("VALIDACAO", "O animal precisa ter nascido depois da mãe e do pai", "dataNascimento");
  }
  if (filhoMaisVelho && filhoMaisVelho.dataNascimento.getTime() <= nascimento.getTime()) {
    throw new RebanhoError("VALIDACAO", "O animal precisa ter nascido antes dos seus filhos", "dataNascimento");
  }
}

export async function editar(id: string, input: EditarAnimalInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, id, escopo);

  const atualizado = await prisma.$transaction(async (tx) => {
    // datas e sexo são comparados com o histórico: trava o animal e relê tudo depois da trava
    await travarAnimais(tx, [id]);
    const animal = await exigirAnimal(tx, id);

    const nascimentoNovo = input.dataNascimento != null ? new Date(input.dataNascimento) : animal.dataNascimento;
    const entradaNova = input.dataEntrada != null ? new Date(input.dataEntrada) : animal.dataEntrada;
    const origemNova = input.origem ?? animal.origem;
    const mudaDatas = nascimentoNovo.getTime() !== animal.dataNascimento.getTime()
      || entradaNova.getTime() !== animal.dataEntrada.getTime() || origemNova !== animal.origem;

    let ajuste: ReturnType<typeof planejarAjusteEntrada> | null = null;
    if (mudaDatas) {
      const errosBase = validarDatasAnimal({ dataNascimento: nascimentoNovo, dataEntrada: entradaNova, origem: origemNova });
      if (errosBase.length) throw new RebanhoError("VALIDACAO", errosBase[0].mensagem, errosBase[0].campo);

      const [localizacoes, destinos, pesagens, primeiraBaixa, primeiraCategoriaManual] = await Promise.all([
        tx.localizacaoAnimal.findMany({ where: { animalId: id }, select: { id: true, desde: true, ate: true } }),
        tx.destinoAnimal.findMany({ where: { animalId: id }, select: { id: true, desde: true, ate: true } }),
        tx.pesagem.findMany({ where: { animalId: id }, select: { id: true, data: true, tipo: true } }),
        tx.baixaAnimal.findFirst({ where: { animalId: id, estornadaEm: null }, orderBy: { data: "asc" } }),
        tx.categoriaManualAnimal.findFirst({ where: { animalId: id }, orderBy: { desde: "asc" }, select: { desde: true } }),
      ]);
      ajuste = planejarAjusteEntrada({
        entradaAntiga: animal.dataEntrada, entradaNova,
        nascimentoAntigo: animal.dataNascimento, nascimentoNovo,
        localizacoes, destinos, pesagens,
        primeiraBaixaData: primeiraBaixa?.data ?? null,
        primeiraCategoriaManualDesde: primeiraCategoriaManual?.desde ?? null,
      });
      if (ajuste.erros.length) throw new RebanhoError("VALIDACAO", ajuste.erros[0].mensagem, ajuste.erros[0].campo);
    }

    if (input.dataNascimento != null && nascimentoNovo.getTime() !== animal.dataNascimento.getTime()) {
      // mexendo na filiação junto, os genitores são validados por resolverFiliacao com a data nova
      const mexeFiliacao = input.maeId !== undefined || input.maeExternaId !== undefined || input.paiId !== undefined || input.paiExternoId !== undefined;
      await exigirOrdemNascimento(tx, mexeFiliacao ? { ...animal, maeId: null, paiId: null } : animal, nascimentoNovo);
    }

    if (input.sexo && input.sexo !== animal.sexo) {
      const [filhos, materiais] = await Promise.all([
        tx.animal.count({ where: { OR: [{ maeId: id }, { paiId: id }] } }),
        tx.materialGenetico.count({ where: { OR: [{ touroId: id }, { doadoraId: id }] } }),
      ]);
      if (filhos > 0) throw new RebanhoError("CONFLITO", "Este animal já é mãe/pai de outros animais; não é possível trocar o sexo", "sexo");
      if (materiais > 0) throw new RebanhoError("CONFLITO", "Este animal é usado em material genético (sêmen/embrião); não é possível trocar o sexo", "sexo");
    }

    // a categoria manual tem sexo: trocar o sexo do animal exige voltar ao automático antes
    if (input.sexo && input.sexo !== animal.sexo) {
      const manual = await tx.categoriaManualAnimal.findFirst({ where: { animalId: id, ate: null }, include: { categoria: true } });
      if (manual && manual.categoria.sexo !== input.sexo) {
        throw new RebanhoError("VALIDACAO", `A categoria manual "${manual.categoria.nome}" é de outro sexo; volte ao cálculo automático antes de trocar o sexo`, "sexo");
      }
    }

    // receptora/doadora e partos anteriores só existem em fêmea (R1): ao virar macho, fecha o
    // destino aberto com papel e abre outro igual (mesma aptidão) com papel NENHUM, e zera os
    // partos — mais amigável do que simplesmente recusar a edição.
    const trocaParaMacho = input.sexo === "M" && input.sexo !== animal.sexo;
    let ajusteDestino: { fechado: { id: string; aptidao: string; papelReprodutivo: string; desde: Date }; aberto: { id: string; aptidao: string; papelReprodutivo: string; desde: Date } } | null = null;
    if (trocaParaMacho) {
      const destinoAtual = await destinoAberto(tx, id);
      if (destinoAtual && destinoAtual.papelReprodutivo !== "NENHUM") {
        const dataFechamento = new Date(hojeFazenda());
        exigirAfetadas(await tx.destinoAnimal.updateMany({ where: { id: destinoAtual.id, ate: null }, data: { ate: dataFechamento } }), 1);
        const novoDestino = await tx.destinoAnimal.create({
          data: { animalId: id, aptidao: destinoAtual.aptidao, papelReprodutivo: "NENHUM", desde: dataFechamento, criadoPorId: usuarioId },
        });
        ajusteDestino = { fechado: destinoAtual, aberto: novoDestino };
      }
    }

    if (input.brinco != null && normalizarBrinco(input.brinco) !== normalizarBrinco(animal.brinco)) {
      const loc = await localizacaoAberta(tx, id);
      if (loc) await exigirBrincoLivre(tx, input.brinco, loc.propriedadeId, id);
    }

    // filiação (v2 · Genética): campo ausente = não mexe; qualquer um presente resolve o lado
    // inteiro (mãe/pai são pares — não dá pra só trocar maeExternaId sem saber o maeId atual).
    const tocaMae = input.maeId !== undefined || input.maeExternaId !== undefined;
    const tocaPai = input.paiId !== undefined || input.paiExternoId !== undefined;
    let filiacaoResolvidaEdicao: Awaited<ReturnType<typeof resolverFiliacao>> | null = null;
    let composicaoSugeridaEdicao: FracaoRaca[] | null = null;
    if (tocaMae || tocaPai) {
      const propostaMaeId = tocaMae ? (input.maeId ?? null) : animal.maeId;
      const propostaMaeExternaId = tocaMae ? (input.maeExternaId ?? null) : animal.maeExternaId;
      const propostaPaiId = tocaPai ? (input.paiId ?? null) : animal.paiId;
      const propostaPaiExternoId = tocaPai ? (input.paiExternoId ?? null) : animal.paiExternoId;
      filiacaoResolvidaEdicao = await resolverFiliacao(tx, { id, dataNascimento: nascimentoNovo }, {
        maeId: propostaMaeId, maeExternaId: propostaMaeExternaId, paiId: propostaPaiId, paiExternoId: propostaPaiExternoId,
      }, animal);
      composicaoSugeridaEdicao = composicaoDosGenitores(filiacaoResolvidaEdicao.maeComposicao, filiacaoResolvidaEdicao.paiComposicao);
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
        partosAntesDaEntrada: trocaParaMacho ? 0 : (input.partosAntesDaEntrada ?? undefined),
        observacao: input.observacao === undefined ? undefined : input.observacao,
        maeId: tocaMae ? (filiacaoResolvidaEdicao?.maeId ?? null) : undefined,
        maeExternaId: tocaMae ? (filiacaoResolvidaEdicao?.maeExternaId ?? null) : undefined,
        paiId: tocaPai ? (filiacaoResolvidaEdicao?.paiId ?? null) : undefined,
        paiExternoId: tocaPai ? (filiacaoResolvidaEdicao?.paiExternoId ?? null) : undefined,
      },
    }).catch((e) => traduzirConflitoUnico(e, {
      brincoEletronico: "Já existe um animal com esse brinco eletrônico",
      sisbov: "Já existe um animal com esse SISBOV",
    }));

    if (tocaMae || tocaPai) {
      await aplicarComposicaoCalculada(tx, id, composicaoSugeridaEdicao, usuarioId);
    }

    // o histórico que começava na entrada/nascimento antigos acompanha as novas datas
    if (ajuste) {
      if (ajuste.moverLocalizacao) await tx.localizacaoAnimal.update({ where: { id: ajuste.moverLocalizacao }, data: { desde: entradaNova } });
      if (ajuste.moverDestino) await tx.destinoAnimal.update({ where: { id: ajuste.moverDestino }, data: { desde: entradaNova } });
      if (ajuste.moverPesagensEntrada.length) await tx.pesagem.updateMany({ where: { id: { in: ajuste.moverPesagensEntrada } }, data: { data: entradaNova } });
      if (ajuste.moverPesagensNascimento.length) await tx.pesagem.updateMany({ where: { id: { in: ajuste.moverPesagensNascimento } }, data: { data: nascimentoNovo } });
    }

    if (ajusteDestino) {
      await auditar(tx, {
        entidade: "DestinoAnimal", entidadeId: ajusteDestino.aberto.id, animalId: id, acao: "MUDANCA_DESTINO", usuarioId,
        antes: ajusteDestino.fechado, depois: ajusteDestino.aberto,
      });
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
  origem: "INFORMADA" | "CALCULADA" = "INFORMADA",
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
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
    const herdada = await composicaoHerdada(tx, animal);
    const itens = input.itens.length ? input.itens : herdada.map((c) => ({ racaId: c.sigla, fracao64: c.fracao64 }));
    const excecao = !composicaoRespeitaHerdanca(itens.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })), herdada);
    exigirHerdanca(itens.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })), herdada, input.justificativaExcecao);
    if (origem === "CALCULADA" && (excecao || itens.some((c) => c.fracao64 !== herdada.find((h) => h.sigla === c.racaId)?.fracao64))) {
      throw new RebanhoError("VALIDACAO", "A composição calculada deve ser exatamente a herdada dos genitores.", "itens");
    }
    const antes = await tx.composicaoRacial.findMany({ where: { animalId } });
    await tx.composicaoRacial.deleteMany({ where: { animalId } });
    if (itens.length) {
      await tx.composicaoRacial.createMany({
        data: linhasComposicao(animalId, itens, herdada, usuarioId, excecao),
      });
    }
    const depois = await tx.composicaoRacial.findMany({ where: { animalId }, include: { raca: true } });
    await auditar(tx, { entidade: "ComposicaoRacial", entidadeId: animalId, animalId, acao: "EDICAO", usuarioId, antes, depois: { itens: depois, justificativaExcecao: input.justificativaExcecao?.trim() ?? null } });
    return depois;
  });

  return composicao
    .map((c) => ({ racaId: c.racaId, sigla: c.raca.sigla, nome: c.raca.nome, racaAtiva: c.raca.ativo, fracao64: c.fracao64, fracaoCalculada64: c.fracaoCalculada64, origem: c.origem }))
    .sort((a, b) => b.fracao64 - a.fracao64);
}

/** Prévia para o cadastro, antes de existir o id do filho. */
export async function preverComposicao(input: DefinirFiliacaoInput & { dataNascimento: string }) {
  const resolvida = await resolverFiliacao(prisma, { id: crypto.randomUUID(), dataNascimento: new Date(input.dataNascimento) }, input);
  return rotularComposicaoCalculada(prisma, composicaoDosGenitores(resolvida.maeComposicao, resolvida.paiComposicao));
}

// ---------- filiação: definir, filhos, sugestão de composição ----------

/** Ficha simplificada de um genitor (para `filiacao.mae`/`filiacao.pai` da ficha). */
async function fichaFiliacaoLado(db: DbPecuaria, animalId: string | null, externoId: string | null): Promise<FiliacaoLadoDTO | null> {
  if (animalId) {
    const a = await db.animal.findUnique({ where: { id: animalId } });
    if (!a) return null;
    const baixa = await baixaAberta(db, animalId);
    return { tipo: "ANIMAL", id: a.id, nome: a.nome, sexo: a.sexo, brinco: a.brinco, baixado: baixa != null };
  }
  if (externoId) {
    const g = await db.genitorExterno.findUnique({ where: { id: externoId } });
    if (!g) return null;
    return { tipo: "EXTERNO", id: g.id, nome: g.nome, codigo: g.codigo, fornecedor: g.fornecedor };
  }
  return null;
}

/**
 * Define a filiação e reconcilia a parcela herdada na mesma transação. Se o registro manual
 * anterior divergir da nova filiação, o valor antigo permanece na auditoria e o cálculo vigora.
 */
export async function definirFiliacao(
  animalId: string,
  input: DefinirFiliacaoInput,
  usuarioId: number | null,
  escopo: number | null = null,
): Promise<AnimalFicha & { avisos: Array<{ campo: string; mensagem: string }>; composicaoSugerida: { itens: Array<{ racaId: string; sigla: string; fracao64: number }>; rotulo: string } | null }> {
  await exigirNoEscopo(prisma, animalId, escopo);

  let avisos: Array<{ campo: string; mensagem: string }> = [];
  let composicaoSubstituida = false;

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
    const antes = { maeId: animal.maeId, paiId: animal.paiId, maeExternaId: animal.maeExternaId, paiExternoId: animal.paiExternoId };

    const resolvida = await resolverFiliacao(tx, { id: animalId, dataNascimento: animal.dataNascimento }, input, animal);
    avisos = resolvida.avisos;
    const mudouFiliacao = animal.maeId !== resolvida.maeId || animal.maeExternaId !== resolvida.maeExternaId || animal.paiId !== resolvida.paiId || animal.paiExternoId !== resolvida.paiExternoId;
    const sugerida = composicaoDosGenitores(resolvida.maeComposicao, resolvida.paiComposicao);
    if (mudouFiliacao) {
      const atual = await tx.composicaoRacial.findMany({ where: { animalId } });
      composicaoSubstituida = atual.some((c) => c.origem === "INFORMADA") && sugerida != null && !composicaoRespeitaHerdanca(atual.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })), sugerida);
    }

    const salvo = await tx.animal.update({
      where: { id: animalId },
      data: { maeId: resolvida.maeId, paiId: resolvida.paiId, maeExternaId: resolvida.maeExternaId, paiExternoId: resolvida.paiExternoId },
    });
    await auditar(tx, { entidade: "Animal", entidadeId: animalId, animalId, acao: "FILIACAO", usuarioId, antes, depois: { maeId: salvo.maeId, paiId: salvo.paiId, maeExternaId: salvo.maeExternaId, paiExternoId: salvo.paiExternoId } });

    if (mudouFiliacao) await aplicarComposicaoCalculada(tx, animalId, sugerida, usuarioId);
  });

  const ficha = await buscarFicha(animalId, null);
  if (composicaoSubstituida) avisos = [...avisos, { campo: "composicao", mensagem: "A composição anterior divergia da nova filiação e foi substituída pelo cálculo; o valor anterior permanece na auditoria." }];
  return { ...ficha, avisos, composicaoSugerida: null };
}

/** Composição que os genitores atuais do animal sugerem — sem gravar nada. */
export async function composicaoSugerida(animalId: string, escopo: number | null = null): Promise<{ itens: Array<{ racaId: string; sigla: string; fracao64: number }>; rotulo: string } | null> {
  await exigirNoEscopo(prisma, animalId, escopo);
  const animal = await exigirAnimal(prisma, animalId);
  const [maeComposicao, paiComposicao] = await Promise.all([
    animal.maeId ? composicaoAnimalComoFracao(prisma, animal.maeId) : animal.maeExternaId ? composicaoGenitorExternoComoFracao(prisma, animal.maeExternaId) : Promise.resolve(null),
    animal.paiId ? composicaoAnimalComoFracao(prisma, animal.paiId) : animal.paiExternoId ? composicaoGenitorExternoComoFracao(prisma, animal.paiExternoId) : Promise.resolve(null),
  ]);
  const sugerida = composicaoDosGenitores(maeComposicao, paiComposicao);
  return rotularComposicaoCalculada(prisma, sugerida);
}

export interface FilhoResumo {
  id: string;
  brinco: string;
  nome: string | null;
  sexo: "F" | "M";
  dataNascimento: string;
  situacao: "ATIVO" | "BAIXADO";
}

/** Filhos do animal (como mãe ou pai), pela filiação registrada — não pela ficha genealógica dele. */
export async function listarFilhos(animalId: string, escopo: number | null = null): Promise<FilhoResumo[]> {
  await exigirNoEscopo(prisma, animalId, escopo);
  const filhos = await prisma.animal.findMany({
    where: { OR: [{ maeId: animalId }, { paiId: animalId }] },
    orderBy: { dataNascimento: "desc" },
  });
  const baixas = await prisma.baixaAnimal.findMany({ where: { animalId: { in: filhos.map((f) => f.id) }, estornadaEm: null }, select: { animalId: true } });
  const baixados = new Set(baixas.map((b) => b.animalId));
  return filhos.map((f) => ({
    id: f.id, brinco: f.brinco, nome: f.nome, sexo: f.sexo,
    dataNascimento: f.dataNascimento.toISOString().slice(0, 10),
    situacao: baixados.has(f.id) ? "BAIXADO" : "ATIVO",
  }));
}

// ---------- categoria manual (vale sobre o cálculo até ser removida) ----------

export async function definirCategoriaManual(animalId: string, input: CategoriaManualInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, animalId, escopo);
  const categoria = await prisma.categoriaAnimal.findUnique({ where: { id: input.categoriaId } });
  if (!categoria || !categoria.ativo) throw new RebanhoError("NAO_ENCONTRADO", "Categoria não encontrada ou inativa", "categoriaId");
  const data = new Date(input.data);

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    // sexo e entrada relidos depois da trava (uma edição do animal pode ter acabado de gravar)
    const animal = await exigirAnimal(tx, animalId);
    if (categoria.sexo !== animal.sexo) throw new RebanhoError("VALIDACAO", "A categoria é de outro sexo", "categoriaId");
    await exigirAnimalAtivo(tx, animalId);
    // não pode começar antes da entrada nem sobrepor uma troca manual já registrada (R4)
    const ultima = await tx.categoriaManualAnimal.findFirst({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] });
    const erroData = validarDataCategoriaManual({ dataEntrada: animal.dataEntrada, ultima: ultima ? { desde: ultima.desde, ate: ultima.ate } : null, data });
    if (erroData) throw new RebanhoError("VALIDACAO", erroData, "data");
    const aberta = ultima && ultima.ate == null ? ultima : null;
    if (aberta?.categoriaId === input.categoriaId) throw new RebanhoError("CONFLITO", `O animal já está como "${categoria.nome}"`, "categoriaId");
    if (aberta) {
      exigirAfetadas(await tx.categoriaManualAnimal.updateMany({
        where: { id: aberta.id, ate: null },
        data: { ate: data, motivoEncerramento: `Trocada por "${categoria.nome}"` },
      }), 1);
    }
    const nova = await tx.categoriaManualAnimal.create({ data: { animalId, categoriaId: input.categoriaId, desde: data, motivo: input.motivo, criadoPorId: usuarioId } });
    await auditar(tx, { entidade: "CategoriaManualAnimal", entidadeId: nova.id, animalId, acao: "DEFINICAO", usuarioId, antes: aberta, depois: nova });
  });
  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

export async function removerCategoriaManual(animalId: string, input: RemoverCategoriaManualInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, animalId, escopo);
  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const aberta = await tx.categoriaManualAnimal.findFirst({ where: { animalId, ate: null } });
    if (!aberta) throw new RebanhoError("CONFLITO", "O animal já está no cálculo automático");
    const hoje = hojeFazendaDate();
    const ate = hoje.getTime() < aberta.desde.getTime() ? aberta.desde : hoje;
    exigirAfetadas(await tx.categoriaManualAnimal.updateMany({ where: { id: aberta.id, ate: null }, data: { ate, motivoEncerramento: input.motivo } }), 1);
    const fechada = await tx.categoriaManualAnimal.findUniqueOrThrow({ where: { id: aberta.id } });
    await auditar(tx, { entidade: "CategoriaManualAnimal", entidadeId: aberta.id, animalId, acao: "REMOCAO", usuarioId, antes: aberta, depois: fechada });
  });
  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

// ---------- ficha ----------

export async function buscarFicha(id: string, propriedadeEscopo: number | null, periodoDias: number | null = 90): Promise<AnimalFicha> {
  const animal = await prisma.animal.findUnique({ where: { id } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");

  const [localizacoes, destinos, pesagens, baixas, composicao, manuais, regras] = await Promise.all([
    prisma.localizacaoAnimal.findMany({ where: { animalId: id }, include: { propriedade: true, lote: true, movimentacao: { select: { motivo: true } } }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    prisma.destinoAnimal.findMany({ where: { animalId: id }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    prisma.pesagem.findMany({ where: { animalId: id }, orderBy: { data: "desc" } }),
    prisma.baixaAnimal.findMany({
      where: { animalId: id },
      include: { motivo: true, localizacaoFechada: { include: { propriedade: true, lote: true } }, destinoFechado: true, criadoPor: { select: { nome: true } } },
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    }),
    composicaoDaFicha(prisma, id),
    prisma.categoriaManualAnimal.findMany({ where: { animalId: id }, include: { categoria: { select: { id: true, nome: true } } }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] }),
    carregarRegras(),
  ]);

  const [mae, pai, filhosCount] = await Promise.all([
    fichaFiliacaoLado(prisma, animal.maeId, animal.maeExternaId),
    fichaFiliacaoLado(prisma, animal.paiId, animal.paiExternoId),
    prisma.animal.count({ where: { OR: [{ maeId: id }, { paiId: id }] } }),
  ]);

  const locAtual = localizacoes.find((l) => l.ate == null) ?? null;
  // animal que já saiu não tem linha aberta: o escopo vale pela última localização
  const locReferencia = locAtual ?? localizacoes.find((l) => l.ate != null) ?? null;
  if (propriedadeEscopo != null && locReferencia && locReferencia.propriedadeId !== propriedadeEscopo) {
    throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  }

  const destinoAtual = destinos.find((d) => d.ate == null) ?? null;
  const baixaAtual = baixas.find((s) => s.estornadaEm == null) ?? null;
  const ultimoPeso = pesagens[0] ? { pesoKg: Number(pesagens[0].pesoKg), data: pesagens[0].data } : null;
  // baixado: idade/categoria contam até a data da baixa, não até hoje (K5)
  const hoje = baixaAtual ? baixaAtual.data : hojeFazendaDate();
  const manualAberta = manuais.find((m) => m.ate == null)?.categoria ?? null;

  // baixado não tem localização/destino abertos: sítio, lote e destino vêm da linha que a
  // própria baixa fechou, como a lista já faz (K4) — sem isso a ficha mostrava "sem sítio"
  const propriedadeFicha = locAtual
    ? { id: locAtual.propriedade.id, nome: locAtual.propriedade.nome }
    : baixaAtual?.localizacaoFechada ? { id: baixaAtual.localizacaoFechada.propriedade.id, nome: baixaAtual.localizacaoFechada.propriedade.nome } : null;
  const loteFicha = locAtual?.lote
    ? { id: locAtual.lote.id, nome: locAtual.lote.nome }
    : baixaAtual?.localizacaoFechada?.lote ? { id: baixaAtual.localizacaoFechada.lote.id, nome: baixaAtual.localizacaoFechada.lote.nome } : null;
  const destinoFicha = destinoAtual
    ? { aptidao: destinoAtual.aptidao, papelReprodutivo: destinoAtual.papelReprodutivo }
    : baixaAtual?.destinoFechado ? { aptidao: baixaAtual.destinoFechado.aptidao, papelReprodutivo: baixaAtual.destinoFechado.papelReprodutivo } : null;

  const resumo = mapearAnimalResumo({
    animal,
    categoria: avaliarCategoria({ sexo: animal.sexo, dataNascimento: animal.dataNascimento, partos: animal.partosAntesDaEntrada }, regras, manualAberta, hoje),
    hoje,
    propriedade: propriedadeFicha,
    lote: loteFicha,
    destino: destinoFicha,
    composicao,
    ultimoPeso,
    pesagemAnterior: pesagens[1] ? { pesoKg: Number(pesagens[1].pesoKg), data: pesagens[1].data } : null,
    situacao: baixaAtual ? "BAIXADO" : "ATIVO",
    idadeNaBaixa: baixaAtual != null,
    noLocalDesde: locAtual ? locAtual.desde : null,
    baixa: baixaAtual ? { data: baixaAtual.data, tipo: baixaAtual.tipo } : null,
  });

  const peso = resumoPeso(pesagens.map((p) => ({ pesoKg: Number(p.pesoKg), data: p.data })), {
    hoje: hojeFazendaDate(),
    periodoDias,
    ateData: baixaAtual ? baixaAtual.data : null,
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
    historicoPesagens: pesagens.map((p) => ({ id: p.id, data: p.data.toISOString().slice(0, 10), pesoKg: Number(p.pesoKg), tipo: p.tipo, origem: p.origem, observacao: p.observacao })),
    baixa: baixaAtual ? {
      id: baixaAtual.id, data: baixaAtual.data.toISOString().slice(0, 10), tipo: baixaAtual.tipo,
      motivo: baixaAtual.motivo ? { nome: baixaAtual.motivo.nome, classe: baixaAtual.motivo.classe } : null, observacao: baixaAtual.observacao,
      estornadaEm: baixaAtual.estornadaEm ? baixaAtual.estornadaEm.toISOString() : null, estornoMotivo: baixaAtual.estornoMotivo,
    } : (baixas[0] ? {
      id: baixas[0].id, data: baixas[0].data.toISOString().slice(0, 10), tipo: baixas[0].tipo,
      motivo: baixas[0].motivo ? { nome: baixas[0].motivo.nome, classe: baixas[0].motivo.classe } : null, observacao: baixas[0].observacao,
      estornadaEm: baixas[0].estornadaEm ? baixas[0].estornadaEm.toISOString() : null, estornoMotivo: baixas[0].estornoMotivo,
    } : null),
    // todas as baixas do animal, inclusive as estornadas (já ordenadas: data desc, criadoEm desc)
    historicoBaixas: baixas.map((b) => ({
      id: b.id, data: b.data.toISOString().slice(0, 10), tipo: b.tipo,
      motivo: b.motivo ? { nome: b.motivo.nome, classe: b.motivo.classe } : null, observacao: b.observacao,
      estornadaEm: b.estornadaEm ? b.estornadaEm.toISOString() : null, estornoMotivo: b.estornoMotivo,
      criadoPor: b.criadoPor?.nome ?? null,
    })),
    peso,
    filiacao: { mae, pai },
    filhosCount,
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


// ---------- filtros da lista (tudo no banco: a paginação e o painel usam o mesmo `where`) ----------

type FiltrosAnimal = Pick<ListarFiltrosInput,
  "sexo" | "origem" | "racaId" | "categoriaOrigem" | "tipoBaixa" | "baixaDe" | "baixaAte" | "situacao">;

/**
 * Filtros de atributo do animal (não dependem de "hoje"). Os da baixa valem para a baixa em
 * vigor (não estornada); com `situacao=ATIVO` não há baixa em vigor, então são ignorados em vez
 * de zerar a lista — o cliente pode manter o filtro montado ao trocar de aba.
 */
export function whereAtributos(f: FiltrosAnimal): Prisma.AnimalWhereInput[] {
  const partes: Prisma.AnimalWhereInput[] = [];
  if (f.sexo) partes.push({ sexo: f.sexo });
  if (f.origem) partes.push({ origem: f.origem });
  if (f.racaId) partes.push({ composicao: { some: { racaId: f.racaId } } });
  if (f.categoriaOrigem === "MANUAL") partes.push({ categoriasManuais: { some: { ate: null } } });
  if (f.situacao !== "ATIVO" && (f.tipoBaixa || f.baixaDe || f.baixaAte)) {
    partes.push({
      baixas: {
        some: {
          estornadaEm: null,
          ...(f.tipoBaixa ? { tipo: f.tipoBaixa } : {}),
          ...(f.baixaDe || f.baixaAte ? { data: { ...(f.baixaDe ? { gte: new Date(f.baixaDe) } : {}), ...(f.baixaAte ? { lte: new Date(f.baixaAte) } : {}) } } : {}),
        },
      },
    });
  }
  return partes;
}

/** Faixa de idade de hoje como limites de `dataNascimento` (mesma borda de `idadeEmMeses`). */
export function whereIdadeHoje(hoje: Date, idadeMinMeses: number | undefined, idadeMaxMeses: number | undefined): Prisma.AnimalWhereInput {
  const { nascidoAte, nascidoApos } = faixaNascimentoParaIdade(hoje, idadeMinMeses, idadeMaxMeses);
  if (!nascidoAte && !nascidoApos) return {};
  return { dataNascimento: { ...(nascidoAte ? { lte: nascidoAte } : {}), ...(nascidoApos ? { gt: nascidoApos } : {}) } };
}

/**
 * Animais com baixa em vigor cuja idade NA DATA DA BAIXA está na faixa. A referência muda por
 * linha (a data da baixa), o que o `where` do Prisma não expressa: a idade é calculada no SQL
 * transcrevendo `idadeEmMeses` (meses de calendário, menos 1 se o dia do mês ainda não chegou,
 * nunca negativa) — o teste de integração confere a paridade nas bordas.
 */
async function baixadosNaFaixaDeIdade(idadeMinMeses: number | undefined, idadeMaxMeses: number | undefined): Promise<string[]> {
  const min = idadeMinMeses ?? 0;
  const max = idadeMaxMeses ?? 2_147_483_647;
  const linhas = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT b."animalId" AS id
    FROM "pecuaria"."BaixaAnimal" b
    JOIN "pecuaria"."Animal" a ON a."id" = b."animalId"
    WHERE b."estornadaEm" IS NULL
      AND GREATEST(0,
            (EXTRACT(YEAR FROM b."data") - EXTRACT(YEAR FROM a."dataNascimento"))::int * 12
          + (EXTRACT(MONTH FROM b."data") - EXTRACT(MONTH FROM a."dataNascimento"))::int
          - CASE WHEN EXTRACT(DAY FROM b."data") < EXTRACT(DAY FROM a."dataNascimento") THEN 1 ELSE 0 END
        ) BETWEEN ${min}::int AND ${max}::int`;
  return linhas.map((l) => l.id);
}

/**
 * Filtro de idade coerente com o que a lista mostra (K5): o ativo pela idade de hoje; o baixado
 * pela idade na data da baixa em vigor (ex.: "bezerras de 0 a 12 meses que morreram" acha a
 * bezerra que morreu com 3 meses há dois anos, que é o que a coluna de idade dela mostra).
 */
async function whereIdade(situacao: ListarFiltrosInput["situacao"], hoje: Date, idadeMinMeses: number | undefined, idadeMaxMeses: number | undefined): Promise<Prisma.AnimalWhereInput> {
  // sem máximo e mínimo 0 (ou nenhum): qualquer idade serve
  if (!idadeMinMeses && idadeMaxMeses == null) return {};
  const ativos = whereIdadeHoje(hoje, idadeMinMeses, idadeMaxMeses);
  if (situacao === "ATIVO") return ativos;
  const baixados: Prisma.AnimalWhereInput = { id: { in: await baixadosNaFaixaDeIdade(idadeMinMeses, idadeMaxMeses) } };
  if (situacao === "BAIXADO") return baixados;
  return { OR: [{ AND: [{ baixas: { none: { estornadaEm: null } } }, ativos] }, baixados] };
}

const CAMPO_ORDEM = { brinco: "brinco", nascimento: "dataNascimento", entrada: "dataEntrada" } as const;

/** Ordem da lista: o campo escolhido e, para desempate estável entre páginas, brinco e id. */
export function ordemListagem(ordenar: ListarFiltrosInput["ordenar"], direcao: ListarFiltrosInput["direcao"]): Prisma.AnimalOrderByWithRelationInput[] {
  const campo = CAMPO_ORDEM[ordenar];
  return [
    { [campo]: direcao },
    ...(campo === "brinco" ? [] : [{ brinco: "asc" as const }]),
    { id: "asc" as const },
  ];
}

const ORDEM_HISTORICO = [{ desde: "desc" as const }, { criadoEm: "desc" as const }];

const INCLUDE_RESUMO = {
  localizacoes: { orderBy: ORDEM_HISTORICO, take: 1, include: { propriedade: true, lote: true } },
  destinos: { orderBy: ORDEM_HISTORICO, take: 1 },
  baixas: { where: { estornadaEm: null }, take: 1, select: { id: true, data: true, tipo: true } },
  composicao: { include: { raca: true } },
  // 2 mais recentes: a última pesagem (ultimoPeso) e a anterior a ela (gmdRecente)
  pesagens: { orderBy: { data: "desc" as const }, take: 2 },
  categoriasManuais: SELECT_MANUAL_ABERTA,
} satisfies Prisma.AnimalInclude;

type AnimalComResumo = Prisma.AnimalGetPayload<{ include: typeof INCLUDE_RESUMO }>;

function resumoDe(animal: AnimalComResumo, regras: RegraCategoria[], hoje: Date): AnimalResumo {
  const loc = animal.localizacoes[0] ?? null;
  const destino = animal.destinos[0] ?? null;
  const baixa = animal.baixas[0] ?? null;
  // baixado: idade/categoria contam até a data da baixa, não até hoje (K5)
  const hojeReferencia = baixa ? baixa.data : hoje;
  return mapearAnimalResumo({
    animal,
    categoria: avaliarCategoria({ sexo: animal.sexo, dataNascimento: animal.dataNascimento, partos: animal.partosAntesDaEntrada }, regras, manualDe(animal.categoriasManuais), hojeReferencia),
    hoje: hojeReferencia,
    propriedade: loc ? { id: loc.propriedade.id, nome: loc.propriedade.nome } : null,
    lote: loc?.lote ? { id: loc.lote.id, nome: loc.lote.nome } : null,
    destino: destino ? { aptidao: destino.aptidao, papelReprodutivo: destino.papelReprodutivo } : null,
    composicao: animal.composicao.map((c) => ({ sigla: c.raca.sigla, fracao64: c.fracao64 })),
    ultimoPeso: animal.pesagens[0] ? { pesoKg: Number(animal.pesagens[0].pesoKg), data: animal.pesagens[0].data } : null,
    pesagemAnterior: animal.pesagens[1] ? { pesoKg: Number(animal.pesagens[1].pesoKg), data: animal.pesagens[1].data } : null,
    situacao: baixa ? "BAIXADO" : "ATIVO",
    idadeNaBaixa: baixa != null,
    noLocalDesde: loc ? loc.desde : null,
    baixa: baixa ? { data: baixa.data, tipo: baixa.tipo } : null,
  });
}

/** Filtros de `listar`: os com default no schema podem faltar para quem chama direto (ex.: painel). */
type ListarEntrada = Omit<ListarFiltrosInput, "semCategoria" | "ordenar" | "direcao">
  & Partial<Pick<ListarFiltrosInput, "semCategoria" | "ordenar" | "direcao">>;

export async function listar(filtros: ListarEntrada, propriedadeEscopo: number | null): Promise<{ itens: AnimalResumo[]; total: number; painel: PainelRebanho }> {
  // o escopo do request (seletor global de sítio) prevalece; o filtro só refina dentro dele
  if (propriedadeEscopo != null && filtros.propriedadeId != null && filtros.propriedadeId !== propriedadeEscopo) {
    return { itens: [], total: 0, painel: agregarPainel([]) };
  }
  const hoje = hojeFazendaDate();
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
      // categoria/sem categoria contam em "hoje" para todos (inclusive baixados), como sempre fez o filtro de categoria
      whereCategoria(filtros.categoriaId, regras, hoje),
      filtros.semCategoria ? whereSemCategoria(regras, hoje) : {},
      ...whereAtributos(filtros),
      await whereIdade(filtros.situacao, hoje, filtros.idadeMinMeses, filtros.idadeMaxMeses),
      filtros.busca ? { OR: [
        { brinco: { contains: filtros.busca, mode: "insensitive" } },
        { nome: { contains: filtros.busca, mode: "insensitive" } },
      ] } : {},
      // "Trazer animais": exclui quem já está com a localização aberta neste lote (U1)
      filtros.excluirLoteId ? { NOT: { localizacoes: { some: { ate: null, loteId: filtros.excluirLoteId } } } } : {},
    ],
  };

  const [total, pagina, paraPainel] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      include: INCLUDE_RESUMO,
      orderBy: ordemListagem(filtros.ordenar ?? "brinco", filtros.direcao ?? "asc"),
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

  const ids = [...new Set(input.animalIds)];
  const movimentacaoId = crypto.randomUUID();
  const data = new Date(input.data);

  // Tudo é lido em lote e planejado antes de gravar: poucas queries por requisição, seja 1 animal
  // ou 300 (o laço antigo fazia ~8 queries por animal e estourava o timeout da transação).
  const movidos = await prisma.$transaction(async (tx) => {
    // ordem das travas (regras.ts): animais → lote → brincos; todo o estado é lido depois delas
    await travarAnimais(tx, ids);
    if (input.loteId) await travarLoteAtivo(tx, input.loteId, input.propriedadeId);

    const animais = await tx.animal.findMany({ where: { id: { in: ids } }, select: { id: true, brinco: true, dataEntrada: true } });
    if (animais.length !== ids.length) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");

    // trava os brincos que chegam ao destino, todos numa query só
    await travarBrincos(tx, animais.map((a) => ({ propriedadeId: input.propriedadeId, brincoNormalizado: normalizarBrinco(a.brinco) })));

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
      // fora do escopo não leva o brinco na mensagem: não revela a identidade de um animal
      // que o usuário não deveria enxergar (S3) — os demais erros seguem citando o brinco
      const lista = plano.erros.slice(0, 10).map((e) => e.mensagem === "não encontrado nesse sítio" ? "animal não encontrado nesse sítio" : `${e.brinco}: ${e.mensagem}`).join("; ");
      const resto = plano.erros.length > 10 ? ` (e mais ${plano.erros.length - 10})` : "";
      throw new RebanhoError(plano.erros.some((e) => e.mensagem.startsWith("brinco")) ? "BRINCO_DUPLICADO" : "VALIDACAO", `Nenhum animal foi movido. ${lista}${resto}`, "data");
    }
    if (!plano.abrir.length) return 0;

    if (plano.fechar.length) {
      exigirAfetadas(await tx.localizacaoAnimal.updateMany({ where: { id: { in: plano.fechar }, ate: null }, data: { ate: data } }), plano.fechar.length);
    }

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
  const { id: animalId } = await exigirNoEscopo(prisma, input.animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
    // receptora/doadora só se aplica a fêmeas (R1)
    if (input.papelReprodutivo !== "NENHUM" && animal.sexo === "M") {
      throw new RebanhoError("VALIDACAO", "Receptora/doadora só se aplica a fêmeas", "papelReprodutivo");
    }
    const errosData = validarDataDestino({ dataEntrada: animal.dataEntrada, desde: input.data });
    if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

    await exigirAnimalAtivo(tx, input.animalId);
    const atual = await destinoAberto(tx, input.animalId);
    const plano = planejar(() => planejarDestino({
      atual: atual ? { aptidao: atual.aptidao, papelReprodutivo: atual.papelReprodutivo, desde: atual.desde } : null,
      novo: { aptidao: input.aptidao, papelReprodutivo: input.papelReprodutivo },
      data: input.data,
    }));

    if (plano.tipo === "SEM_MUDANCA") return;

    if (plano.fechar && atual) {
      exigirAfetadas(await tx.destinoAnimal.updateMany({ where: { id: atual.id, ate: null }, data: { ate: new Date(plano.fechar.ate) } }), 1);
    }
    const novo = await tx.destinoAnimal.create({
      data: { animalId: input.animalId, aptidao: plano.abrir.aptidao, papelReprodutivo: plano.abrir.papelReprodutivo, desde: new Date(plano.abrir.desde), criadoPorId: usuarioId },
    });

    await auditar(tx, { entidade: "DestinoAnimal", entidadeId: novo.id, animalId: input.animalId, acao: "MUDANCA_DESTINO", usuarioId, antes: atual, depois: novo });
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
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
  await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
    await exigirAnimalAtivo(tx, animalId);

    const linhas = await tx.localizacaoAnimal.findMany({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] });
    const plano = planejarDesfazerOuFalha(linhas.map((l) => ({ id: l.id, desde: l.desde, ate: l.ate, criadoEm: l.criadoEm })));

    // só baixa ativa protege a linha; a estornada perde o vínculo (FK ON DELETE SET NULL)
    const referenciada = await tx.baixaAnimal.findFirst({ where: { localizacaoFechadaId: plano.remover.id, estornadaEm: null } });
    if (referenciada) throw new RebanhoError("CONFLITO", "Essa movimentação já foi usada em uma baixa e não pode ser desfeita");

    const removida = linhas.find((l) => l.id === plano.remover.id)!;
    const anterior = linhas.find((l) => l.id === plano.reabrir.id)!;

    // o brinco pode ter sido reutilizado no sítio anterior enquanto o animal esteve fora dele
    await exigirBrincoLivre(tx, animal.brinco, anterior.propriedadeId, animalId, "no sítio anterior");

    // apaga antes de reabrir: o índice parcial não admite duas linhas abertas por animal
    exigirAfetadas(await tx.localizacaoAnimal.deleteMany({ where: { id: removida.id, ate: null } }), 1);
    exigirAfetadas(await tx.localizacaoAnimal.updateMany({ where: { id: anterior.id, ate: { not: null } }, data: { ate: null } }), 1);
    const reaberta = { ...anterior, ate: null };

    await auditar(tx, { entidade: "LocalizacaoAnimal", entidadeId: removida.id, animalId, acao: "DESFAZER", usuarioId, antes: { removida, anteriorFechada: anterior }, depois: { reaberta } });

    // desfeita animal a animal até o último: a movimentação inteira passa a constar como desfeita
    if (removida.movimentacaoId) {
      const agora = new Date();
      await tx.movimentacaoAnimal.updateMany({ where: { movimentacaoId: removida.movimentacaoId, animalId }, data: { desfeitoEm: agora } });
      const restantes = await tx.localizacaoAnimal.count({ where: { movimentacaoId: removida.movimentacaoId } });
      if (restantes === 0) {
        const antes = await tx.movimentacao.findUnique({ where: { id: removida.movimentacaoId } });
        const marcada = await tx.movimentacao.updateMany({
          where: { id: removida.movimentacaoId, desfeitaEm: null },
          data: { desfeitaEm: agora, desfeitaMotivo: "Desfeita animal a animal" },
        });
        if (marcada.count === 1) {
          const depois = await tx.movimentacao.findUnique({ where: { id: removida.movimentacaoId } });
          await auditar(tx, { entidade: "Movimentacao", entidadeId: removida.movimentacaoId, acao: "DESFAZER", usuarioId, antes, depois });
        }
      }
    }
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

/**
 * Desfaz a movimentação inteira: para cada animal, apaga a linha que ela abriu e reabre a
 * anterior; a movimentação fica marcada como desfeita (histórico, como um estorno). Tudo ou
 * nada — se um animal já foi movido de novo, saiu ou teve a linha usada numa baixa ativa, nada muda.
 */
export async function desfazerMovimentacao(id: string, motivo: string, usuarioId: number | null, escopo: number | null = null): Promise<{ desfeitos: number }> {
  const previa = await prisma.movimentacao.findUnique({ where: { id }, include: { animais: { select: { origemPropriedadeId: true } } } });
  if (!previa) throw new RebanhoError("NAO_ENCONTRADO", "Movimentação não encontrada");
  // no escopo: destino da movimentação OU origem de algum animal dela (K2) — mesmo critério de
  // `noSitio` em movimentacoes.ts, que já lista/mostra a movimentação a quem está no sítio de origem
  if (escopo != null && previa.propriedadeDestinoId !== escopo && !previa.animais.some((a) => a.origemPropriedadeId === escopo)) {
    throw new RebanhoError("NAO_ENCONTRADO", "Movimentação não encontrada");
  }
  if (previa.desfeitaEm) throw new RebanhoError("JA_ESTORNADA", "Essa movimentação já foi desfeita");

  return prisma.$transaction(async (tx) => {
    // Os animais da movimentação só diminuem (linhas são apagadas, nunca criadas com este id):
    // travar os de agora cobre os que sobrarem na releitura depois da trava.
    const candidatos = await tx.localizacaoAnimal.findMany({ where: { movimentacaoId: id }, select: { animalId: true } });
    await travarAnimais(tx, candidatos.map((l) => l.animalId));

    // releitura depois da trava: outro "desfazer" pode ter terminado enquanto esperávamos
    const mov = await tx.movimentacao.findUnique({ where: { id } });
    if (!mov) throw new RebanhoError("NAO_ENCONTRADO", "Movimentação não encontrada");
    if (mov.desfeitaEm) throw new RebanhoError("JA_ESTORNADA", "Essa movimentação já foi desfeita");

    const linhas = await tx.localizacaoAnimal.findMany({ where: { movimentacaoId: id }, include: { animal: { select: { brinco: true } } } });
    if (!linhas.length) throw new RebanhoError("CONFLITO", "Essa movimentação não tem mais animais para desfazer");
    const animalIds = linhas.map((l) => l.animalId);

    const [historico, baixasAtivas, baixasDasLinhas] = await Promise.all([
      tx.localizacaoAnimal.findMany({ where: { animalId: { in: animalIds } } }),
      tx.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null }, select: { animalId: true } }),
      tx.baixaAnimal.findMany({ where: { localizacaoFechadaId: { in: linhas.map((l) => l.id) } }, select: { localizacaoFechadaId: true, estornadaEm: true } }),
    ]);
    const porId = new Map(historico.map((h) => [h.id, h]));
    const historicoPorAnimal = new Map<string, LinhaHistorico[]>();
    for (const h of historico) {
      const lista = historicoPorAnimal.get(h.animalId) ?? [];
      lista.push({ id: h.id, desde: h.desde, ate: h.ate, criadoEm: h.criadoEm });
      historicoPorAnimal.set(h.animalId, lista);
    }

    const plano = planejarDesfazerMovimentacao({
      linhas: linhas.map((l) => ({ id: l.id, animalId: l.animalId, brinco: l.animal.brinco })),
      historicoPorAnimal,
      animaisInativos: new Set(baixasAtivas.map((s) => s.animalId)),
      baixasDasLinhas,
    });
    if (plano.erros.length) {
      const lista = plano.erros.slice(0, 10).map((e) => `${e.brinco}: ${e.mensagem}`).join("; ");
      const resto = plano.erros.length > 10 ? ` (e mais ${plano.erros.length - 10})` : "";
      throw new RebanhoError("CONFLITO", `Nada foi desfeito. ${lista}${resto}`);
    }

    // o brinco pode ter sido reutilizado no sítio de origem enquanto o animal esteve fora:
    // trava todos os (sítio, brinco) numa query só e lê os ativos de cada sítio uma vez
    const brincoPorAnimal = new Map(linhas.map((l) => [l.animalId, l.animal.brinco]));
    const porSitio = new Map<number, string[]>();
    for (const p of plano.passos) {
      const sitio = porId.get(p.reabrir)!.propriedadeId;
      porSitio.set(sitio, [...(porSitio.get(sitio) ?? []), p.animalId]);
    }
    await travarBrincos(tx, [...porSitio].flatMap(([sitio, ids]) =>
      ids.map((a) => ({ propriedadeId: sitio, brincoNormalizado: normalizarBrinco(brincoPorAnimal.get(a)!) }))));
    for (const [sitio, ids] of porSitio) {
      const ativos = await ativosNoSitioParaBrinco(tx, sitio);
      for (const animalId of ids) {
        const brinco = brincoPorAnimal.get(animalId)!;
        if (!brincoDisponivel({ brinco, propriedadeId: sitio, ativosNoSitio: ativos, ignorarAnimalId: animalId })) {
          throw new RebanhoError("BRINCO_DUPLICADO", `Nada foi desfeito. Já existe um animal ativo com o brinco ${normalizarBrinco(brinco)} no sítio anterior`);
        }
      }
    }

    // apaga antes de reabrir: o índice parcial não admite duas linhas abertas por animal
    const remover = plano.passos.map((p) => p.remover);
    const reabrir = plano.passos.map((p) => p.reabrir);
    exigirAfetadas(await tx.localizacaoAnimal.deleteMany({ where: { id: { in: remover }, ate: null } }), remover.length);
    exigirAfetadas(await tx.localizacaoAnimal.updateMany({ where: { id: { in: reabrir }, ate: { not: null } }, data: { ate: null } }), reabrir.length);
    const agora = new Date();
    await tx.movimentacaoAnimal.updateMany({ where: { movimentacaoId: id, desfeitoEm: null }, data: { desfeitoEm: agora } });
    const marcada = await tx.movimentacao.updateMany({ where: { id, desfeitaEm: null }, data: { desfeitaEm: agora, desfeitaMotivo: motivo } });
    exigirAfetadas(marcada, 1);
    const desfeita = { ...mov, desfeitaEm: agora, desfeitaMotivo: motivo };

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
    await travarAnimais(tx, [animalId]);
    await exigirAnimalAtivo(tx, animalId);

    const linhas = await tx.destinoAnimal.findMany({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }] });
    const plano = planejarDesfazerOuFalha(linhas.map((l) => ({ id: l.id, desde: l.desde, ate: l.ate, criadoEm: l.criadoEm })));

    // só baixa ativa protege a linha; a estornada perde o vínculo (FK ON DELETE SET NULL)
    const referenciada = await tx.baixaAnimal.findFirst({ where: { destinoFechadoId: plano.remover.id, estornadaEm: null } });
    if (referenciada) throw new RebanhoError("CONFLITO", "Essa mudança de finalidade já foi usada em uma baixa e não pode ser desfeita");

    const removida = linhas.find((l) => l.id === plano.remover.id)!;
    const anterior = linhas.find((l) => l.id === plano.reabrir.id)!;

    exigirAfetadas(await tx.destinoAnimal.deleteMany({ where: { id: removida.id, ate: null } }), 1);
    exigirAfetadas(await tx.destinoAnimal.updateMany({ where: { id: anterior.id, ate: { not: null } }, data: { ate: null } }), 1);
    const reaberta = { ...anterior, ate: null };

    await auditar(tx, { entidade: "DestinoAnimal", entidadeId: removida.id, animalId, acao: "DESFAZER", usuarioId, antes: { removida, anteriorFechada: anterior }, depois: { reaberta } });
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

// ---------- baixa ----------

export async function darBaixa(input: BaixaInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  const { id: animalId } = await exigirNoEscopo(prisma, input.animalId, escopo);

  if (input.motivoId) {
    const motivo = await prisma.motivoBaixa.findFirst({ where: { id: input.motivoId, ativo: true } });
    if (!motivo) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de baixa não encontrado", "motivoId");
    if (!motivoAceito(input.tipo, motivo.classe)) {
      throw new RebanhoError("VALIDACAO", mensagemMotivoRecusado(input.tipo, motivo.classe), "motivoId");
    }
  }

  await prisma.$transaction(async (tx) => {
    // trava antes de ler a linha aberta: uma movimentação/mudança de destino simultânea
    // esperaria aqui e depois veria o animal baixado (sem trava, ficava baixado com linha aberta)
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
    const [ativa, localAberta, destAberto, ultimaPesagem] = await Promise.all([
      baixaAberta(tx, animalId),
      localizacaoAberta(tx, animalId),
      destinoAberto(tx, animalId),
      tx.pesagem.findFirst({ where: { animalId }, orderBy: { data: "desc" } }),
    ]);
    // baixa não pode voltar no tempo antes de uma pesagem já registrada (R2)
    const errosData = validarDataBaixa({ dataEntrada: animal.dataEntrada, dataBaixa: input.data, ultimaPesagemData: ultimaPesagem?.data ?? null });
    if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

    const plano = planejar(() => planejarBaixa({
      animalAtivo: !ativa,
      localizacaoAberta: localAberta ? { id: localAberta.id, desde: localAberta.desde } : null,
      destinoAberto: destAberto ? { id: destAberto.id, desde: destAberto.desde } : null,
      data: input.data,
    }));

    if (plano.fecharLocalizacao) {
      exigirAfetadas(await tx.localizacaoAnimal.updateMany({ where: { id: plano.fecharLocalizacao.id, ate: null }, data: { ate: new Date(plano.fecharLocalizacao.ate) } }), 1);
    }
    if (plano.fecharDestino) {
      exigirAfetadas(await tx.destinoAnimal.updateMany({ where: { id: plano.fecharDestino.id, ate: null }, data: { ate: new Date(plano.fecharDestino.ate) } }), 1);
    }

    const baixa = await tx.baixaAnimal.create({
      data: {
        animalId, data: new Date(input.data), tipo: input.tipo, motivoId: input.motivoId ?? null, observacao: input.observacao ?? null,
        localizacaoFechadaId: plano.fecharLocalizacao?.id ?? null, destinoFechadoId: plano.fecharDestino?.id ?? null, criadoPorId: usuarioId,
      },
    });

    await auditar(tx, { entidade: "BaixaAnimal", entidadeId: baixa.id, animalId, acao: "BAIXA", usuarioId, depois: baixa });
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

export async function estornarBaixa(animalId: string, input: EstornoBaixaInput, usuarioId: number | null, escopo: number | null = null): Promise<AnimalResumo> {
  await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const animal = await exigirAnimal(tx, animalId);
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
      exigirAfetadas(await tx.localizacaoAnimal.updateMany({ where: { id: linha.id, ate: { not: null } }, data: { ate: null } }), 1);
    }
    if (plano.reabrirDestino) {
      exigirAfetadas(await tx.destinoAnimal.updateMany({ where: { id: plano.reabrirDestino.id, ate: { not: null } }, data: { ate: null } }), 1);
    }

    const marcada = await tx.baixaAnimal.updateMany({
      where: { id: baixa.id, estornadaEm: null },
      data: { estornadaEm: new Date(), estornoMotivo: input.motivo },
    });
    if (marcada.count !== 1) throw new RebanhoError("JA_ESTORNADA", "Não há baixa ativa para estornar (ou já foi estornada)");
    const atualizada = await tx.baixaAnimal.findUniqueOrThrow({ where: { id: baixa.id } });

    await auditar(tx, { entidade: "BaixaAnimal", entidadeId: baixa.id, animalId, acao: "ESTORNO", usuarioId, antes: baixa, depois: atualizada });
  });

  return buscarFicha(animalId, null).then((f) => f as AnimalResumo);
}

// ---------- pesagem ----------
// Pesagens também travam o animal: a data da pesagem é validada contra a baixa (e a baixa,
// contra as pesagens), então as duas escritas não podem se cruzar.

export async function registrarPesagem(input: PesagemInput & { animalId: string }, usuarioId: number | null, escopo: number | null = null) {
  await exigirNoEscopo(prisma, input.animalId, escopo);

  const pesagem = await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const animal = await exigirAnimal(tx, input.animalId);
    const baixa = await baixaAberta(tx, input.animalId);
    const errosData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem: input.data });
    if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

    const criada = await tx.pesagem.create({
      data: { animalId: input.animalId, data: new Date(input.data), pesoKg: new Prisma.Decimal(input.pesoKg), tipo: input.tipo, origem: input.origem, observacao: input.observacao ?? null, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "Pesagem", entidadeId: criada.id, animalId: input.animalId, acao: "REGISTRO", usuarioId, depois: criada });
    return criada;
  });

  return { id: pesagem.id, animalId: pesagem.animalId, data: pesagem.data.toISOString().slice(0, 10), pesoKg: Number(pesagem.pesoKg), tipo: pesagem.tipo, origem: pesagem.origem };
}

async function exigirPesagem(db: DbPecuaria, id: string) {
  const pesagem = await db.pesagem.findUnique({ where: { id } });
  if (!pesagem) throw new RebanhoError("NAO_ENCONTRADO", "Pesagem não encontrada");
  return pesagem;
}

export async function editarPesagem(id: string, input: EditarPesagemInput, usuarioId: number | null, escopo: number | null = null) {
  const { animalId } = await exigirPesagem(prisma, id);
  await exigirNoEscopo(prisma, animalId, escopo);

  const atualizada = await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const existente = await exigirPesagem(tx, id);
    const animal = await exigirAnimal(tx, animalId);
    const baixa = await baixaAberta(tx, animalId);
    const dataPesagem = input.data ?? existente.data;
    const errosData = validarDataPesagem({ dataNascimento: animal.dataNascimento, dataBaixa: baixa?.data ?? null, dataPesagem });
    if (errosData.length) throw new RebanhoError("VALIDACAO", errosData[0].mensagem, errosData[0].campo);

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
    await auditar(tx, { entidade: "Pesagem", entidadeId: id, animalId, acao: "EDICAO", usuarioId, antes: existente, depois: salva });
    return salva;
  });

  return { id: atualizada.id, animalId: atualizada.animalId, data: atualizada.data.toISOString().slice(0, 10), pesoKg: Number(atualizada.pesoKg), tipo: atualizada.tipo, origem: atualizada.origem, observacao: atualizada.observacao };
}

export async function excluirPesagem(id: string, usuarioId: number | null, escopo: number | null = null): Promise<void> {
  const { animalId } = await exigirPesagem(prisma, id);
  await exigirNoEscopo(prisma, animalId, escopo);

  await prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [animalId]);
    const existente = await exigirPesagem(tx, id);
    await tx.pesagem.delete({ where: { id } });
    await auditar(tx, { entidade: "Pesagem", entidadeId: id, animalId, acao: "EXCLUSAO", usuarioId, antes: existente });
  });
}

// ---------- auditoria ----------

export interface EntradaAuditoriaDTO {
  em: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  usuarioNome: string | null;
  resumo: string;
  alteracoes: CampoAlteracao[];
}

function mapearEntradaAuditoria(e: {
  em: Date; acao: string; entidade: string; entidadeId: string; antes: unknown; depois: unknown;
  usuario: { nome: string } | null;
}, nomesRacas: Record<string, string> = {}, nomeGenitor?: string): EntradaAuditoriaDTO {
  const justificativa = e.entidade === "ComposicaoRacial" && e.depois && typeof e.depois === "object" && !Array.isArray(e.depois)
    ? (e.depois as Record<string, unknown>).justificativaExcecao : null;
  const genitor = e.entidade === "GenitorExterno" && e.depois && typeof e.depois === "object" && !Array.isArray(e.depois)
    ? (e.depois as Record<string, unknown>).nome : e.entidade === "GenitorExterno" && e.antes && typeof e.antes === "object" && !Array.isArray(e.antes)
      ? (e.antes as Record<string, unknown>).nome : null;
  return {
    em: e.em.toISOString(),
    acao: e.acao,
    entidade: e.entidade,
    entidadeId: e.entidadeId,
    usuarioNome: e.usuario?.nome ?? null,
    resumo: `${typeof justificativa === "string" ? "Exceção na composição racial" : resumoAuditoria(e.entidade, e.acao)}${typeof genitor === "string" ? ` · ${genitor}` : nomeGenitor ? ` · ${nomeGenitor}` : ""}`,
    alteracoes: [
      ...diferencas(e.entidade, e.antes, e.depois, nomesRacas),
      ...(typeof justificativa === "string" ? [{ campo: "justificativaExcecao", rotulo: "Justificativa", antes: null, depois: justificativa }] : []),
    ],
  };
}

export async function buscarAuditoriaAnimal(
  animalId: string, escopo: number | null = null, page = 1, pageSize = 20,
): Promise<{ itens: EntradaAuditoriaDTO[]; total: number }> {
  await exigirNoEscopo(prisma, animalId, escopo);

  // por animalId: inclui o que já foi apagado (pesagem excluída, movimentação/destino desfeitos)
  const where = { animalId };
  const [total, entradas] = await Promise.all([
    prisma.auditoriaPecuaria.count({ where }),
    prisma.auditoriaPecuaria.findMany({
      where,
      include: { usuario: { select: { nome: true } } },
      orderBy: { em: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { itens: entradas.map((e) => mapearEntradaAuditoria(e)), total };
}

/**
 * Auditoria de uma entidade de cadastro (não presa a um animal) — Lote, Raça, Motivo de baixa ou
 * Categoria. Sem escopo de sítio: essas entidades são compartilhadas, como os próprios cadastros.
 */
export async function buscarAuditoriaCadastro(
  entidade: EntidadeAuditoriaCadastro, entidadeId: string | undefined, page = 1, pageSize = 20,
): Promise<{ itens: EntradaAuditoriaDTO[]; total: number }> {
  const where = { entidade, ...(entidadeId ? { entidadeId } : {}) };
  const [total, entradas] = await Promise.all([
    prisma.auditoriaPecuaria.count({ where }),
    prisma.auditoriaPecuaria.findMany({
      where,
      include: { usuario: { select: { nome: true } } },
      orderBy: { em: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const idsRacas = new Set<string>();
  if (entidade === "GenitorExterno") {
    for (const entrada of entradas) {
      for (const valor of [entrada.antes, entrada.depois]) {
        const itens = Array.isArray(valor) ? valor : valor && typeof valor === "object" ? (valor as Record<string, unknown>).composicao : null;
        if (Array.isArray(itens)) for (const item of itens) {
          if (item && typeof item === "object" && typeof item.racaId === "string") idsRacas.add(item.racaId);
        }
      }
    }
  }
  const nomesRacas = Object.fromEntries((await prisma.raca.findMany({ where: { id: { in: [...idsRacas] } }, select: { id: true, nome: true } })).map((r) => [r.id, r.nome]));
  const nomesGenitores = entidade === "GenitorExterno"
    ? Object.fromEntries((await prisma.genitorExterno.findMany({ where: { id: { in: entradas.map((e) => e.entidadeId) } }, select: { id: true, nome: true } })).map((g) => [g.id, g.nome]))
    : {};
  return { itens: entradas.map((e) => mapearEntradaAuditoria(e, nomesRacas, nomesGenitores[e.entidadeId])), total };
}
