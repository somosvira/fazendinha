import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import type { EventoTimeline } from "./mock.js";
import type { CriarOperacaoInput, EditarOperacaoInput } from "./schemas.js";
import { planejarBaixaAplicacao } from "./aplicacao-estoque.calc.js";
import { resolverCentroSaida } from "../estoque/centro.calc.js";
import { estornarMovimentoTx } from "../estoque/estoque.js";
import { propriedadePrincipalId } from "../propriedade.js";

export class PlantioEventoError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO", message: string) {
    super(message);
  }
}

// ── Builder da timeline tecida do talhão ─────────────────────────────────────
// Espelha rebanho/timeline.ts: lê as 5 tabelas de eventos estruturados do
// talhão, mapeia cada linha para o DTO editorial (EventoTimeline) e ordena por
// data DESC. A forma do DTO casa com client/src/plantio/types.ts.

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const num = (x: any) => (x != null ? Number(x) : undefined);

// Domínio derivado do tipo de operação agrícola.
function dominioDaOperacao(tipo: string): EventoTimeline["dominio"] {
  if (/ADUBACAO|CALAGEM|GESSAGEM/.test(tipo)) return "nutricao";
  if (/APLICACAO|MONITORAMENTO_MIP/.test(tipo)) return "fitossanidade";
  return "fenologia"; // podas, desbrota, roçagem, irrigação, replantio, capina
}

// Título humano legível a partir do tipo da operação.
const TITULO_OPERACAO: Record<string, string> = {
  ADUBACAO_SOLO: "Adubação de solo",
  ADUBACAO_FOLIAR: "Adubação foliar",
  CALAGEM: "Calagem",
  GESSAGEM: "Gessagem",
  APLICACAO_FUNGICIDA: "Aplicação fungicida",
  APLICACAO_INSETICIDA: "Aplicação inseticida",
  APLICACAO_HERBICIDA: "Aplicação herbicida",
  ROCAGEM_MECANICA: "Roçagem mecânica",
  CAPINA_MANUAL: "Capina manual",
  PODA_RECEPA: "Poda de recepa",
  PODA_DECOTE: "Poda de decote",
  PODA_ESQUELETAMENTO: "Esqueletamento",
  PODA_DESPONTE: "Desponte",
  DESBROTA: "Desbrota",
  IRRIGACAO: "Irrigação",
  REPLANTIO: "Replantio",
  AMOSTRAGEM_SOLO: "Amostragem de solo",
  AMOSTRAGEM_FOLIAR: "Amostragem foliar",
  MONITORAMENTO_MIP: "Monitoramento MIP",
};

const METODO_TITULO: Record<string, string> = {
  DERRICA_PANO: "derriça no pano",
  DERRICA_MECANIZADA: "derriça mecanizada",
  SELETIVA: "colheita seletiva",
  VARRICAO: "varrição",
};

const ORDINAL = ["", "1ª", "2ª", "3ª", "4ª", "5ª", "6ª"];

export function operacaoToTimeline(o: any): EventoTimeline {
  return {
    id: `op-${o.id}`,
    talhaoId: String(o.talhaoId),
    data: iso(o.data),
    dominio: dominioDaOperacao(o.tipo),
    titulo: TITULO_OPERACAO[o.tipo] ?? "Operação agrícola",
    detalhe: o.produto ?? o.observacao ?? undefined,
    responsavel: o.responsavel ?? undefined,
  };
}

export function inspecaoToTimeline(i: any): EventoTimeline {
  // Alerta quando há incidência relevante registrada (ferrugem ≥5% ou broca ≥3%).
  const ferr = num(i.ferrugem);
  const broca = num(i.broca);
  const alerta = (ferr != null && ferr >= 5) || (broca != null && broca >= 3) || undefined;
  const partes = [
    ferr != null ? `ferrugem ${ferr}%` : null,
    num(i.bichoMineiro) != null ? `bicho-mineiro ${num(i.bichoMineiro)}%` : null,
    broca != null ? `broca ${broca}%` : null,
  ].filter(Boolean);
  return {
    id: `insp-${i.id}`,
    talhaoId: String(i.talhaoId),
    data: iso(i.data),
    dominio: "fitossanidade",
    titulo: "Inspeção MIP",
    detalhe: partes.length ? partes.join(" · ") : i.observacao ?? undefined,
    alerta,
    responsavel: i.responsavel ?? undefined,
  };
}

export function amostraSoloToTimeline(s: any): EventoTimeline {
  const partes = [
    num(s.pH) != null ? `pH ${num(s.pH)}` : null,
    num(s.v) != null ? `V ${num(s.v)}%` : null,
  ].filter(Boolean);
  return {
    id: `sol-${s.id}`,
    talhaoId: String(s.talhaoId),
    data: iso(s.data),
    dominio: "nutricao",
    titulo: "Análise de solo",
    detalhe: partes.length ? partes.join(" · ") : s.observacao ?? undefined,
  };
}

export function amostraFoliarToTimeline(f: any): EventoTimeline {
  const partes = [
    num(f.nFoliar) != null ? `N ${num(f.nFoliar)}%` : null,
    num(f.kFoliar) != null ? `K ${num(f.kFoliar)}%` : null,
  ].filter(Boolean);
  return {
    id: `fol-${f.id}`,
    talhaoId: String(f.talhaoId),
    data: iso(f.data),
    dominio: "nutricao",
    titulo: "Análise foliar",
    detalhe: partes.length ? partes.join(" · ") : f.observacao ?? undefined,
  };
}

export function passadaToTimeline(p: any): EventoTimeline {
  const ord = ORDINAL[p.numero] ?? `${p.numero}ª`;
  const metodo = METODO_TITULO[p.metodo] ?? "passada";
  const sacas = num(p.sacasBeneficiadas);
  return {
    id: `col-${p.id}`,
    talhaoId: String(p.talhaoId),
    data: iso(p.data),
    dominio: "colheita",
    titulo: `${ord} passada — ${metodo}`,
    detalhe: p.observacao ?? undefined,
    impacto: sacas != null && sacas > 0 ? `≈ ${sacas} sc beneficiadas` : undefined,
    responsavel: p.responsavel ?? undefined,
  };
}

// Cria uma OperacaoAgricola e devolve o evento já no formato da timeline, para
// a OperacaoForm do cliente reaproveitar direto na lista. Respeita
// FechamentoMensal (regra do domínio): não registra em mês de caixa fechado.
async function assertPeriodoAberto(tx: Prisma.TransactionClient, propriedadeId: number, data: Date) {
  const periodo = await tx.periodoFinanceiro.findUnique({
    where: { propriedadeId_ano_mes: { propriedadeId, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } },
  });
  if (periodo?.status === "FECHADO") throw new PlantioEventoError("MES_FECHADO", "mês fechado — operação não pode ser registrada");
}

// Monta o payload da SAIDA de estoque (origem APLICACAO) para uma operação
// agrícola que consome um produto do estoque, ou null quando não deve baixar.
async function planejarMovimento(
  tx: Prisma.TransactionClient,
  input: CriarOperacaoInput | EditarOperacaoInput,
  talhao: { areaHa: Prisma.Decimal | number | null; codigo?: string },
  data: Date,
  propriedadeId: number,
) {
  if (input.produtoId == null) return null;
  const produto = await tx.produto.findUnique({ where: { id: input.produtoId }, select: { id: true, nome: true, estocavel: true, custoUnitario: true, unidade: true, centrosCusto: { select: { centroCustoId: true } } } });
  if (!produto) throw new PlantioEventoError("NAO_ENCONTRADO", "produto do estoque não encontrado");
  if (input.centroCustoId != null) {
    const centro = await tx.centroCusto.findFirst({ where: { id: input.centroCustoId, ativo: true } });
    if (!centro) throw new PlantioEventoError("NAO_ENCONTRADO", "centro de custo não encontrado");
  }
  const plano = planejarBaixaAplicacao({
    produtoId: input.produtoId,
    estocavel: produto.estocavel,
    doseValor: input.doseValor ?? null,
    doseUnidade: input.doseUnidade ?? null,
    areaHa: talhao.areaHa != null ? Number(talhao.areaHa) : null,
    quantidadeTotalInformada: input.quantidadeTotal ?? null,
  });
  if (!plano.deveBaixar) return { produto, plano: null as null };
  const custoUnitario = produto.custoUnitario != null ? new Prisma.Decimal(produto.custoUnitario) : new Prisma.Decimal(0);
  const centroCustoId = resolverCentroSaida({
    produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId),
    contextoCentroId: input.centroCustoId,
  });
  const quantidade = new Prisma.Decimal(plano.quantidade);
  const valorTotal = quantidade.mul(custoUnitario).toDecimalPlaces(2);
  return {
    produto,
    plano: {
      produtoId: produto.id,
      tipo: "SAIDA" as const,
      origem: "APLICACAO" as const,
      data,
      quantidade,
      custoUnitario,
      valorTotal,
      propriedadeId,
      centroCustoId,
      observacao: `Aplicação em ${talhao.codigo ?? "talhão"}`,
    },
  };
}

export async function criarOperacao(talhaoId: number, input: CriarOperacaoInput, usuarioId: number | null = null): Promise<EventoTimeline> {
  const talhao = await prisma.talhao.findUnique({
    where: { id: talhaoId },
    select: { id: true, codigo: true, propriedadeId: true, areaHa: true },
  });
  if (!talhao) {
    throw new PlantioEventoError("NAO_ENCONTRADO", "talhão não encontrado");
  }
  const propriedadeId = talhao.propriedadeId ?? (await propriedadePrincipalId());
  const data = new Date(input.data);

  const o = await prisma.$transaction(async (tx) => {
    await assertPeriodoAberto(tx, propriedadeId, data);
    const movimento = await planejarMovimento(tx, input, talhao, data, propriedadeId);
    const mov = movimento?.plano ? await tx.movimentoEstoque.create({ data: { ...movimento.plano, criadoPorId: usuarioId } }) : null;
    return tx.operacaoAgricola.create({
      data: {
        talhaoId,
        // Domínio é derivado do tipo (server-authoritative): nunca diverge do que a
        // timeline reconstrói na leitura. O input.dominio do cliente é ignorado aqui.
        dominio: dominioDaOperacao(input.tipo).toUpperCase() as CriarOperacaoInput["dominio"],
        tipo: input.tipo,
        data,
        responsavel: input.responsavel ?? null,
        produto: input.produto ?? (movimento?.produto.nome ?? null),
        observacao: input.observacao ?? null,
        doseValor: input.doseValor ?? null,
        doseUnidade: input.doseUnidade ?? null,
        pragaAlvo: input.pragaAlvo ?? null,
        produtoId: input.produtoId ?? null,
        quantidadeTotal: mov ? mov.quantidade : (input.quantidadeTotal ?? null),
        movimentoEstoqueId: mov?.id ?? null,
      },
    });
  });
  return operacaoToTimeline(o);
}

export async function editarOperacao(operacaoId: number, input: EditarOperacaoInput, usuarioId: number | null = null): Promise<EventoTimeline> {
  const existente = await prisma.operacaoAgricola.findUnique({
    where: { id: operacaoId },
    include: { talhao: { select: { id: true, codigo: true, propriedadeId: true, areaHa: true } } },
  });
  if (!existente) throw new PlantioEventoError("NAO_ENCONTRADO", "operação não encontrada");
  const propriedadeId = existente.talhao.propriedadeId ?? (await propriedadePrincipalId());

  // OperacaoAgricola não guarda o centro de custo — ele só existe no movimento
  // de estoque gerado. Lido ANTES de planejar a edição: se o input não manda
  // centroCustoId, o contexto passado ao planejamento é o centro que já estava
  // gravado no movimento anterior (nunca o centro inferido do produto de novo).
  const movimentoAnterior = existente.movimentoEstoqueId != null
    ? await prisma.movimentoEstoque.findUnique({ where: { id: existente.movimentoEstoqueId } })
    : null;

  // PATCH parcial: campos ausentes no input mantêm o valor existente.
  const tipoMerged = (input.tipo ?? existente.tipo) as CriarOperacaoInput["tipo"];
  const merged = {
    dominio: dominioDaOperacao(tipoMerged).toUpperCase() as CriarOperacaoInput["dominio"],
    tipo: tipoMerged,
    data: input.data ?? iso(existente.data),
    responsavel: input.responsavel !== undefined ? input.responsavel : existente.responsavel,
    produto: input.produto !== undefined ? input.produto : existente.produto,
    observacao: input.observacao !== undefined ? input.observacao : existente.observacao,
    doseValor: input.doseValor !== undefined ? input.doseValor : num(existente.doseValor) ?? null,
    doseUnidade: input.doseUnidade !== undefined ? input.doseUnidade : existente.doseUnidade,
    pragaAlvo: input.pragaAlvo !== undefined ? input.pragaAlvo : (existente.pragaAlvo as CriarOperacaoInput["pragaAlvo"]),
    produtoId: input.produtoId !== undefined ? input.produtoId : existente.produtoId,
    quantidadeTotal: input.quantidadeTotal !== undefined ? input.quantidadeTotal : num(existente.quantidadeTotal) ?? null,
    centroCustoId: input.centroCustoId !== undefined ? input.centroCustoId : movimentoAnterior?.centroCustoId ?? null,
  } satisfies CriarOperacaoInput;

  const data = new Date(merged.data);

  const o = await prisma.$transaction(async (tx) => {
    await assertPeriodoAberto(tx, propriedadeId, data);
    if (existente.data.getTime() !== data.getTime()) await assertPeriodoAberto(tx, propriedadeId, existente.data);
    const movimento = await planejarMovimento(tx, merged, existente.talhao, data, propriedadeId);
    let movimentoEstoqueId = existente.movimentoEstoqueId;
    let quantidadeTotal: Prisma.Decimal | null = null;
    const plano = movimento?.plano ?? null;
    const anterior = movimentoEstoqueId != null ? await tx.movimentoEstoque.findUnique({ where: { id: movimentoEstoqueId } }) : null;
    // Movimento confirmado não é editado nem apagado: se algo relevante ao
    // estoque mudou, estorna o antigo e cria um novo (contrato do financeiro).
    const mudouBaixa = plano != null && (
      anterior == null
      || anterior.produtoId !== plano.produtoId
      || !anterior.quantidade.equals(plano.quantidade)
      || anterior.data.getTime() !== plano.data.getTime()
      || (anterior.centroCustoId ?? null) !== (plano.centroCustoId ?? null)
    );
    if (plano && !mudouBaixa) {
      quantidadeTotal = anterior!.quantidade;
    } else if (plano) {
      if (anterior) {
        await estornarMovimentoTx(tx, anterior.id, { usuarioId, observacao: `Estorno: operação agrícola #${operacaoId} editada` });
      }
      const criado = await tx.movimentoEstoque.create({ data: { ...plano, criadoPorId: usuarioId } });
      movimentoEstoqueId = criado.id;
      quantidadeTotal = criado.quantidade;
    } else if (movimentoEstoqueId != null) {
      // Edição removeu o produto/dose: estorna o movimento gerado antes.
      await estornarMovimentoTx(tx, movimentoEstoqueId, { usuarioId, observacao: `Estorno: operação agrícola #${operacaoId} editada` });
      movimentoEstoqueId = null;
    } else {
      quantidadeTotal = merged.quantidadeTotal != null ? new Prisma.Decimal(merged.quantidadeTotal) : null;
    }
    return tx.operacaoAgricola.update({
      where: { id: operacaoId },
      data: {
        dominio: dominioDaOperacao(merged.tipo).toUpperCase() as CriarOperacaoInput["dominio"],
        tipo: merged.tipo,
        data,
        responsavel: merged.responsavel ?? null,
        produto: merged.produto ?? (movimento?.produto.nome ?? null),
        observacao: merged.observacao ?? null,
        doseValor: merged.doseValor ?? null,
        doseUnidade: merged.doseUnidade ?? null,
        pragaAlvo: merged.pragaAlvo ?? null,
        produtoId: merged.produtoId ?? null,
        quantidadeTotal,
        movimentoEstoqueId,
      },
    });
  });
  return operacaoToTimeline(o);
}

export async function excluirOperacao(operacaoId: number, usuarioId: number | null = null): Promise<void> {
  const existente = await prisma.operacaoAgricola.findUnique({
    where: { id: operacaoId },
    include: { talhao: { select: { propriedadeId: true } } },
  });
  if (!existente) throw new PlantioEventoError("NAO_ENCONTRADO", "operação não encontrada");
  const propriedadeId = existente.talhao.propriedadeId ?? (await propriedadePrincipalId());
  await prisma.$transaction(async (tx) => {
    await assertPeriodoAberto(tx, propriedadeId, existente.data);
    // O fato operacional é apagado; o movimento de estoque (confirmado) é
    // estornado, nunca deletado — o original REVERTIDO e o inverso ficam no razão.
    if (existente.movimentoEstoqueId != null) {
      await estornarMovimentoTx(tx, existente.movimentoEstoqueId, { usuarioId, observacao: `Estorno: operação agrícola #${operacaoId} excluída` });
    }
    await tx.operacaoAgricola.delete({ where: { id: operacaoId } });
  });
}

export async function montarTimeline(talhaoId: number): Promise<EventoTimeline[]> {
  const [ops, insps, solos, foliares, passadas] = await Promise.all([
    prisma.operacaoAgricola.findMany({ where: { talhaoId } }),
    prisma.inspecaoMIP.findMany({ where: { talhaoId } }),
    prisma.amostraSolo.findMany({ where: { talhaoId } }),
    prisma.amostraFoliar.findMany({ where: { talhaoId } }),
    prisma.passadaColheita.findMany({ where: { talhaoId } }),
  ]);
  return [
    ...ops.map(operacaoToTimeline),
    ...insps.map(inspecaoToTimeline),
    ...solos.map(amostraSoloToTimeline),
    ...foliares.map(amostraFoliarToTimeline),
    ...passadas.map(passadaToTimeline),
  ].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
