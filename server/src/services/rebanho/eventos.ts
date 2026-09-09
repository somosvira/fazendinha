import { prisma } from "../../db.js";
import type { Prisma } from "@prisma/client";
import { toTimeline, type EventoTimelineDTO } from "./eventos.mappers.js";
import type { CriarEventoInput } from "./eventos.schemas.js";
import {
  reconstruirLactacoes,
  recomputarResumoReproducao,
  planejarSincronizacaoLactacoes,
  categoriaAposParto,
  type EvtRepro,
  type LactacaoEstrutural,
  type MutacaoEvento,
} from "./reproducao.recompute.js";
import { calcularTaxaConcepcao, type TaxaConcepcaoMetodo } from "./reproducao.concepcao.js";
import { getNumero } from "./parametros.js";
import { planejarCrias, type NovaCriaPlano } from "./parto-cria.calc.js";
import { planejarBaixaDose, planejarDevolucaoDose } from "./semen-baixa.calc.js";
import { planejarDevolucaoEmbriao, planejarTransferenciaEmbriao } from "./embriao-estoque.calc.js";

export { ConflitoLactacaoError } from "./reproducao.recompute.js";

export class EventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) { super(message); }
}
const d = (s?: string) => (s ? new Date(s) : undefined);
const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

// Cliente de transação Prisma (mesma superfície do PrismaClient p/ os models usados aqui).
type Tx = Prisma.TransactionClient;

// Filtro de fato-filho de Animal: herda o escopo via animal.propriedadeId.
function viaAnimal(propriedadeId: number | null) {
  return propriedadeId != null ? { animal: { propriedadeId } } : {};
}

// Animal no sítio ativo (consolidado = qualquer).
function animalNoEscopo(animalId: number, propriedadeId: number | null) {
  return {
    id: animalId,
    ...(propriedadeId != null ? { propriedadeId } : {}),
  };
}

// Recomputa o read-model do animal SEM destruir o histórico enriquecido de lactações.
// A `mutacao` (evento recém-criado/excluído) guia quais ciclos criar/encerrar/reabrir;
// os demais campos (producaoTotal, producao305, tipoAleitamento, induzida, duracaoDias)
// nunca são tocados. Roda dentro da transação do chamador — um conflito estrutural
// (ConflitoLactacaoError) aborta a mutação inteira em vez de apagar dados.
export async function recomputarAnimal(tx: Tx, animalId: number, mutacao: MutacaoEvento): Promise<void> {
  const animal = await tx.animal.findUnique({ where: { id: animalId }, include: { eventosReprodutivos: true } });
  if (!animal) return;
  const evs: EvtRepro[] = animal.eventosReprodutivos.map((e) => ({ id: e.id, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado, dtPartoPrevista: iso(e.dtPartoPrevista), reprodutor: e.reprodutor, protocolo: e.protocolo, tipoParto: e.tipoParto, motivoSecagem: e.motivoSecagem }));

  // Sincronização pontual das lactações persistidas (não destrutiva).
  const [lactacoesDb, controles] = await Promise.all([
    tx.lactacao.findMany({
      where: { animalId },
      select: {
        id: true,
        numero: true,
        dtInicio: true,
        dtFim: true,
        motivoSecagem: true,
        tipoAleitamento: true,
        induzida: true,
        producaoTotal: true,
        producao305: true,
        duracaoDias: true,
      },
    }),
    tx.controleLeiteiro.findMany({ where: { animalId }, select: { data: true } }),
  ]);
  const persistidas: LactacaoEstrutural[] = lactacoesDb.map((l) => ({
    id: l.id,
    numero: l.numero,
    dtInicio: iso(l.dtInicio)!,
    dtFim: iso(l.dtFim),
    motivoSecagem: l.motivoSecagem,
    enriquecida: l.tipoAleitamento != null || l.induzida || l.producaoTotal != null
      || l.producao305 != null || l.duracaoDias != null
      || controles.some((c) => c.data >= l.dtInicio && (l.dtFim == null || c.data <= l.dtFim)),
  }));
  const operacoes = planejarSincronizacaoLactacoes(persistidas, mutacao, animal.numPartosEntrada);
  for (const op of operacoes) {
    if (op.tipo === "CRIAR") await tx.lactacao.create({ data: { animalId, numero: op.numero, dtInicio: new Date(op.dtInicio) } });
    else if (op.tipo === "ENCERRAR") await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: new Date(op.dtFim), motivoSecagem: op.motivoSecagem } });
    else if (op.tipo === "REABRIR") await tx.lactacao.update({ where: { id: op.lactacaoId }, data: { dtFim: null, motivoSecagem: null } });
    else await tx.lactacao.delete({ where: { id: op.lactacaoId } });
  }

  const tipoParto = (mutacao.evento.tipoParto ?? "").toLowerCase();
  const partoValido = mutacao.tipo === "CRIACAO" && mutacao.evento.tipo === "PARTO"
    && tipoParto !== "3" && tipoParto !== "aborto" && tipoParto !== "ab";
  const categoria = categoriaAposParto(animal.categoria);
  if (partoValido && categoria !== animal.categoria) {
    await tx.animal.update({ where: { id: animalId }, data: { categoria: categoria as typeof animal.categoria } });
  }

  // O resumo usa a estrutura persistida depois da sincronização. Assim, ciclos
  // importados sem evento PARTO correspondente continuam fornecendo DEL e ordem.
  const lactsPersistidas = (await tx.lactacao.findMany({
    where: { animalId },
    select: { numero: true, dtInicio: true, dtFim: true },
  })).map((l) => ({ numero: l.numero, dtInicio: iso(l.dtInicio)!, dtFim: iso(l.dtFim) }));
  const lactsDerivadas = lactsPersistidas.length
    ? lactsPersistidas
    : reconstruirLactacoes(evs, animal.numPartosEntrada);
  const [pevDias, gestacaoDias, secagemAntec] = await Promise.all([
    getNumero("PEV_DIAS"),
    getNumero("GESTACAO_DIAS"),
    getNumero("SECAGEM_ANTEC"),
  ]);
  const r = recomputarResumoReproducao(evs, lactsDerivadas, animal.numPartosEntrada, new Date().toISOString().slice(0, 10), {
    pevDias:      pevDias      ?? undefined,
    gestacaoDias: gestacaoDias ?? undefined,
    secagemAntec: secagemAntec ?? undefined,
  });
  await tx.resumoAnimal.upsert({
    where: { animalId },
    create: {
      animalId,
      statusReprodutivo: r.statusReprodutivo,
      del: r.del,
      ordemLactacao: r.ordemLactacao,
      ultimoDgData: d(r.ultimoDgData ?? undefined),
      ultimoDgResultado: r.ultimoDgResultado,
      diasGestacao: r.diasGestacao,
      iepProjetado: r.iepProjetado,
      previsaoSecagem: d(r.previsaoSecagem ?? undefined),
      ultimaInseminacao: d(r.ultimaInseminacao ?? undefined),
      protocoloAtual: r.protocoloAtual,
    },
    update: {
      statusReprodutivo: r.statusReprodutivo,
      del: r.del,
      ordemLactacao: r.ordemLactacao,
      ultimoDgData: d(r.ultimoDgData ?? undefined) ?? null,
      ultimoDgResultado: r.ultimoDgResultado,
      diasGestacao: r.diasGestacao,
      iepProjetado: r.iepProjetado,
      previsaoSecagem: d(r.previsaoSecagem ?? undefined) ?? null,
      ultimaInseminacao: d(r.ultimaInseminacao ?? undefined) ?? null,
      protocoloAtual: r.protocoloAtual,
    },
  });
}

// KPI de reprodução: taxa de concepção por método (IA × TE) no sítio (ou consolidado).
// Lê os eventos e delega ao cálculo puro (que pareia diagnóstico → cobertura).
export async function taxaConcepcaoRebanho(propriedadeId: number | null = null): Promise<TaxaConcepcaoMetodo[]> {
  const evs = await prisma.eventoReprodutivo.findMany({
    where: {
      tipo: { in: ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO"] },
      ...viaAnimal(propriedadeId),
    },
    select: { animalId: true, tipo: true, data: true, resultado: true },
  });
  return calcularTaxaConcepcao(evs.map((e) => ({ animalId: e.animalId, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado })));
}

export async function listarEventos(animalId: number, propriedadeId: number | null = null): Promise<EventoTimelineDTO[]> {
  const animal = await prisma.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true },
  });
  if (!animal) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
  const evs = await prisma.eventoReprodutivo.findMany({ where: { animalId }, orderBy: { data: "desc" } });
  return evs.map(toTimeline);
}

async function persistirPlanosDeCria(
  tx: Tx,
  planos: readonly NovaCriaPlano[],
  propriedadeId: number | null,
): Promise<number[]> {
  const criacoes = planos.filter((plano): plano is Extract<NovaCriaPlano, { tipo: "CRIAR" }> => plano.tipo === "CRIAR");
  if (criacoes.length > 0) {
    const existentes = await tx.animal.findMany({
      where: { numero: { in: criacoes.map((plano) => plano.numero) } },
      select: { numero: true },
    });
    if (existentes.length > 0) {
      throw new EventoError("CONFLITO", `número ${existentes[0].numero} já existe`);
    }
  }

  const ids: number[] = [];
  for (const plano of planos) {
    if (plano.tipo === "VINCULAR") {
      const cria = await tx.animal.findFirst({
        where: animalNoEscopo(plano.criaId, propriedadeId),
        select: {
          id: true,
          sexo: true,
          categoria: true,
          maeId: true,
          dataNascimento: true,
          partoDeOrigem: { select: { id: true } },
        },
      });
      if (!cria) throw new EventoError("NAO_ENCONTRADO", "cria não encontrada");
      if (cria.categoria !== plano.categoria || cria.sexo !== plano.sexo) {
        throw new EventoError("CONFLITO", "sexo ou categoria da cria não confere com o parto");
      }
      if (cria.partoDeOrigem) {
        throw new EventoError("CONFLITO", "cria já está vinculada a outro parto");
      }
      if (cria.maeId != null && cria.maeId !== plano.maeId) {
        throw new EventoError("CONFLITO", "mãe cadastrada da cria não confere com este parto");
      }
      const dataNascimento = new Date(`${plano.dataNascimento}T00:00:00Z`);
      if (cria.dataNascimento != null && cria.dataNascimento.getTime() !== dataNascimento.getTime()) {
        throw new EventoError("CONFLITO", "data de nascimento da cria não confere com o parto");
      }
      if (cria.maeId == null || cria.dataNascimento == null) {
        await tx.animal.update({
          where: { id: plano.criaId },
          data: {
            ...(cria.maeId == null ? { maeId: plano.maeId } : {}),
            ...(cria.dataNascimento == null ? { dataNascimento } : {}),
          },
        });
      }
      ids.push(cria.id);
      continue;
    }
    const dataNascimento = new Date(`${plano.dataNascimento}T00:00:00Z`);
    const cria = await tx.animal.create({
      data: {
        numero: plano.numero,
        sexo: plano.sexo,
        categoria: plano.categoria,
        dataNascimento,
        dataEntrada: dataNascimento,
        maeId: plano.maeId,
        propriedadeId,
        resumo: { create: { statusReprodutivo: "VAZIA" } },
      },
      select: { id: true },
    });
    ids.push(cria.id);
  }
  return ids;
}

type AnimalEventoValidado = { id: number; propriedadeId: number | null };

async function validarContextoEvento(
  cliente: Pick<Prisma.TransactionClient, "animal" | "resultadoExameGinecologico">,
  animalId: number,
  input: CriarEventoInput,
  propriedadeId: number | null,
): Promise<AnimalEventoValidado> {
  const animal = await cliente.animal.findFirst({
    where: animalNoEscopo(animalId, propriedadeId),
    select: { id: true, propriedadeId: true },
  });
  if (!animal) throw new EventoError("NAO_ENCONTRADO", "animal não encontrado");
  if (input.tipo === "PARTO" && input.criaId === animalId) {
    throw new EventoError("CONFLITO", "a paridora não pode ser vinculada como própria cria");
  }
  const doadoraIdInformada = (input as any).doadoraId as number | undefined;
  const embriaoColetaId = input.tipo === "TRANSFERENCIA_EMBRIAO" ? input.embriaoColetaId : undefined;
  if (doadoraIdInformada != null && embriaoColetaId == null) {
    const doadora = await cliente.animal.findFirst({
      where: animalNoEscopo(doadoraIdInformada, propriedadeId),
      select: { id: true },
    });
    if (!doadora) throw new EventoError("NAO_ENCONTRADO", "doadora não encontrada");
  }
  const resultadoGinecologicoId = input.tipo === "EXAME_GINECOLOGICO" ? input.resultadoGinecologicoId : undefined;
  if (resultadoGinecologicoId != null) {
    const resultado = await cliente.resultadoExameGinecologico.findUnique({ where: { id: resultadoGinecologicoId }, select: { id: true } });
    if (!resultado) throw new EventoError("NAO_ENCONTRADO", "resultado ginecológico não encontrado");
  }
  return animal;
}

async function persistirEventoNaTransacao(
  tx: Tx,
  animal: AnimalEventoValidado,
  animalId: number,
  input: CriarEventoInput,
  propriedadeId: number | null,
): Promise<EventoTimelineDTO & { aviso?: string }> {
  const doadoraIdInformada = (input as any).doadoraId as number | undefined;
  const embriaoColetaId = input.tipo === "TRANSFERENCIA_EMBRIAO" ? input.embriaoColetaId : undefined;
  const resultadoGinecologicoId = input.tipo === "EXAME_GINECOLOGICO" ? input.resultadoGinecologicoId : undefined;
  let estoqueSemenDoseBaixada = false;
  let aviso: string | null = null;
  let doadoraId = doadoraIdInformada;
  let doadoraNumero: string | undefined;
  let doadoraNome: string | undefined;
  let reprodutor = (input as any).reprodutor as string | undefined;
  const propriedadeEventoId = animal.propriedadeId ?? propriedadeId;
    if (embriaoColetaId != null) {
      const embriao = await tx.embriaoColeta.findFirst({
        where: { id: embriaoColetaId, ...(propriedadeEventoId != null ? { propriedadeId: propriedadeEventoId } : {}) },
        include: {
          fertilizacao: {
            include: {
              reprodutor: { select: { nome: true, codigo: true } },
              coleta: { include: { doadora: { select: { numero: true, nome: true } } } },
            },
          },
        },
      });
      if (!embriao) throw new EventoError("NAO_ENCONTRADO", "embrião não encontrado");
      const plano = planejarTransferenciaEmbriao({ estadoAtual: embriao.estado as "DISPONIVEL" | "TRANSFERIDO" | "DESCARTADO" });
      if (!plano.transferir) throw new EventoError("CONFLITO", "embrião indisponível para transferência");
      const baixa = await tx.embriaoColeta.updateMany({
        where: { id: embriaoColetaId, ...(propriedadeEventoId != null ? { propriedadeId: propriedadeEventoId } : {}), estado: "DISPONIVEL", viavel: true },
        data: { estado: "TRANSFERIDO" },
      });
      if (baixa.count !== 1) throw new EventoError("CONFLITO", "embrião indisponível para transferência");
      doadoraId = embriao.fertilizacao.coleta.doadoraId;
      doadoraNumero = embriao.fertilizacao.coleta.doadora.numero;
      doadoraNome = embriao.fertilizacao.coleta.doadora.nome ?? undefined;
      const touro = embriao.fertilizacao.reprodutor;
      reprodutor = [touro.nome, touro.codigo].filter(Boolean).join(" · ");
    }
    const estoqueSemenId = input.tipo === "INSEMINACAO" ? input.estoqueSemenId : undefined;
    const propriedadeEstoqueId = animal.propriedadeId ?? propriedadeId;
    if (estoqueSemenId != null) {
      const estoque = await tx.estoqueSemen.findFirst({
        where: { id: estoqueSemenId, ...(propriedadeEstoqueId != null ? { propriedadeId: propriedadeEstoqueId } : {}) },
        select: { id: true, dosesDisponiveis: true },
      });
      if (!estoque) throw new EventoError("NAO_ENCONTRADO", "lote de sêmen não encontrado");
      const plano = planejarBaixaDose({ estoqueSemenId, dosesDisponiveis: estoque.dosesDisponiveis });
      aviso = plano.aviso;
      if (plano.consumir) {
        const baixa = await tx.estoqueSemen.updateMany({
          where: {
            id: estoqueSemenId,
            ...(propriedadeEstoqueId != null ? { propriedadeId: propriedadeEstoqueId } : {}),
            dosesDisponiveis: { gte: 1 },
          },
          data: { dosesDisponiveis: { decrement: 1 } },
        });
        estoqueSemenDoseBaixada = baixa.count === 1;
        if (!estoqueSemenDoseBaixada) {
          aviso = planejarBaixaDose({ estoqueSemenId, dosesDisponiveis: 0 }).aviso;
        }
      }
    }

    let criaId: number | undefined;
    if (input.tipo === "PARTO") {
      const dataParto = new Date(`${input.data}T00:00:00Z`);
      const ultimoServico = await tx.eventoReprodutivo.findFirst({
        where: {
          animalId,
          tipo: { in: ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "PARTO"] },
          data: { lte: dataParto },
        },
        orderBy: [{ data: "desc" }, { id: "desc" }],
        select: { tipo: true, doadoraId: true },
      });
      const maeGeneticaId = ultimoServico?.tipo === "TRANSFERENCIA_EMBRIAO"
        ? ultimoServico.doadoraId
        : null;
      const planos = planejarCrias(input, animalId, maeGeneticaId);
      const ids = await persistirPlanosDeCria(tx, planos, animal.propriedadeId);
      criaId = ids[0];
    }
    const e = await tx.eventoReprodutivo.create({
      data: {
        animalId, tipo: input.tipo, data: new Date(input.data), observacao: (input as any).observacao,
        reprodutor, protocolo: (input as any).protocolo ?? (input as any).metodo,
        // DESMAME guarda o peso opcional no campo livre `resultado` (sem coluna nova).
        resultado: (input as any).resultado ?? ((input as any).pesoKg != null ? String((input as any).pesoKg) : undefined),
        resultadoGinecologicoId,
        dtPartoPrevista: d((input as any).dtPartoPrevista),
        tipoParto: (input as any).tipoParto, auxilioParto: (input as any).auxilioParto,
        numCrias: (input as any).numCrias, criasVivas: (input as any).criasVivas, criasNatimortas: (input as any).criasNatimortas,
        sexoCria: (input as any).sexoCria,
        criaId,
        estoqueSemenId,
        estoqueSemenDoseBaixada,
        embriaoColetaId,
        doadoraNumero,
        doadoraNome,
        motivoSecagem: (input as any).motivoSecagem, doadoraId,
      },
    });
    // Uma transferência de embrião marca o papel de receptora do animal que recebe
    // (barriga de aluguel). Flag sticky: fica marcada mesmo que o evento seja excluído.
    if (input.tipo === "TRANSFERENCIA_EMBRIAO") await tx.animal.update({ where: { id: animalId }, data: { ehReceptora: true } });
    await recomputarAnimal(tx, animalId, { tipo: "CRIACAO", evento: { id: e.id, tipo: e.tipo, data: iso(e.data)!, motivoSecagem: e.motivoSecagem, tipoParto: e.tipoParto } });
    const timeline = toTimeline(e);
  return aviso ? { ...timeline, aviso } : timeline;
}

export async function registrarEventoNaTransacao(
  tx: Tx,
  animalId: number,
  input: CriarEventoInput,
  propriedadeId: number | null = null,
): Promise<EventoTimelineDTO & { aviso?: string }> {
  const animal = await validarContextoEvento(tx, animalId, input, propriedadeId);
  return persistirEventoNaTransacao(tx, animal, animalId, input, propriedadeId);
}

export async function registrarEvento(
  animalId: number,
  input: CriarEventoInput,
  propriedadeId: number | null = null,
): Promise<EventoTimelineDTO & { aviso?: string }> {
  // Preserva as validações pré-transação do endpoint individual. Folhas usam a
  // variante com `tx`, para que várias linhas compartilhem a mesma atomicidade.
  const animal = await validarContextoEvento(prisma, animalId, input, propriedadeId);
  return prisma.$transaction((tx) => persistirEventoNaTransacao(tx, animal, animalId, input, propriedadeId));
}

export async function excluirEvento(eventoId: number, propriedadeId: number | null = null): Promise<void> {
  const e = await prisma.eventoReprodutivo.findFirst({
    where: {
      id: eventoId,
      ...viaAnimal(propriedadeId),
    },
    include: { animal: { select: { propriedadeId: true } } },
  });
  if (!e) throw new EventoError("NAO_ENCONTRADO", "evento não encontrado");
  await prisma.$transaction(async (tx) => {
    if (e.embriaoColetaId != null) {
      const propriedadeEmbriaoId = e.animal.propriedadeId ?? propriedadeId;
      const embriao = await tx.embriaoColeta.findFirst({
        where: { id: e.embriaoColetaId, ...(propriedadeEmbriaoId != null ? { propriedadeId: propriedadeEmbriaoId } : {}) },
        select: { id: true, estado: true },
      });
      if (!embriao) throw new EventoError("NAO_ENCONTRADO", "embrião não encontrado");
      const plano = planejarDevolucaoEmbriao({ estadoAtual: embriao.estado as "DISPONIVEL" | "TRANSFERIDO" | "DESCARTADO" });
      if (plano.devolver) await tx.embriaoColeta.update({ where: { id: e.embriaoColetaId }, data: { estado: "DISPONIVEL" } });
    }
    if (e.estoqueSemenId != null && e.estoqueSemenDoseBaixada) {
      const propriedadeEstoqueId = e.animal.propriedadeId ?? propriedadeId;
      const estoque = await tx.estoqueSemen.findFirst({
        where: { id: e.estoqueSemenId, ...(propriedadeEstoqueId != null ? { propriedadeId: propriedadeEstoqueId } : {}) },
        select: { id: true, dosesDisponiveis: true },
      });
      if (!estoque) throw new EventoError("NAO_ENCONTRADO", "lote de sêmen não encontrado");
      const plano = planejarDevolucaoDose({
        doseBaixada: e.estoqueSemenDoseBaixada,
        dosesDisponiveis: estoque.dosesDisponiveis,
      });
      if (plano.devolver) {
        await tx.estoqueSemen.update({
          where: { id: e.estoqueSemenId },
          data: { dosesDisponiveis: { increment: 1 } },
        });
      }
    }
    await tx.eventoReprodutivo.delete({ where: { id: eventoId } });
    await recomputarAnimal(tx, e.animalId, { tipo: "EXCLUSAO", evento: { id: e.id, tipo: e.tipo, data: iso(e.data)!, motivoSecagem: e.motivoSecagem, tipoParto: e.tipoParto } });
  });
}
