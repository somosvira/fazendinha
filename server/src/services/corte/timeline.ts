/* Builder da timeline tecida do lote (Corte · Onda 2).
 *
 * Espelha plantio/timeline.ts: lê as 4 tabelas de fatos do lote (pesagens,
 * manejos sanitários, suplementações, operações comerciais), mapeia cada linha
 * para o DTO editorial EventoTimeline e ordena por data DESC. A forma do DTO é o
 * contrato com client/src/corte/types.ts.
 *
 * Domínios: "pesagem" | "sanidade" | "nutricao" | "comercial".
 * Ids prefixados por tabela: pes- / san- / nut- / com-.
 */
import { prisma } from "../../db.js";
import { TITULO_SANITARIO, TITULO_PESAGEM_LOTE } from "@rionovo/shared";
import type { EventoTimeline } from "./mock.js";
import { HOJE_ANCORA, RENDIMENTO_CARCACA, KG_POR_ARROBA } from "./resumos.recompute.js";

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const num = (x: any) => (x != null ? Number(x) : undefined);
const MS = 86_400_000;

const fmtMoney = (n: number) =>
  "R$ " + Math.round(n).toLocaleString("pt-BR");

// ── Pesagem ──────────────────────────────────────────────────────────────────
export function pesagemToTimeline(p: any): EventoTimeline {
  const partes = [
    `peso médio ${Number(p.pesoMedio)} kg`,
    p.gmdDesdeUltima != null ? `GMD ${Number(p.gmdDesdeUltima)} kg/dia` : null,
  ].filter(Boolean);
  return {
    id: `pes-${p.id}`,
    loteId: String(p.loteId),
    data: iso(p.data),
    dominio: "pesagem",
    titulo: TITULO_PESAGEM_LOTE,
    detalhe: partes.join(" · "),
    responsavel: p.responsavel ?? undefined,
  };
}

// ── Manejo sanitário ─────────────────────────────────────────────────────────
export function manejoToTimeline(m: any, hoje = HOJE_ANCORA): EventoTimeline {
  const partes = [
    `${m.numCabecas} cabeças`,
    m.produto ? m.produto : null,
    m.doseMl != null ? `${Number(m.doseMl)} ml/cab` : null,
  ].filter(Boolean);
  // Carência ativa: data + carenciaDias ainda no futuro relativo a hoje.
  let alerta: boolean | undefined;
  if (m.carenciaDias != null && m.carenciaDias > 0) {
    const fim = Date.parse(iso(m.data)) + m.carenciaDias * MS;
    if (fim >= Date.parse(hoje)) alerta = true;
  }
  const proximoPasso = m.proximaDose ? `próxima dose ${iso(m.proximaDose)}` : undefined;
  return {
    id: `san-${m.id}`,
    loteId: String(m.loteId),
    data: iso(m.data),
    dominio: "sanidade",
    titulo: TITULO_SANITARIO[m.tipo] ?? "Manejo sanitário",
    detalhe: partes.join(" · ") || undefined,
    alerta,
    responsavel: m.responsavel ?? undefined,
    proximoPasso,
  };
}

// ── Suplementação ────────────────────────────────────────────────────────────
const TITULO_SUPLEMENTO: Record<string, string> = {
  MINERAL: "mineral",
  PROTEICO_SECA: "proteico (seca)",
  ENERGETICO_AGUAS: "energético (águas)",
  RACAO_CONFINAMENTO: "ração de confinamento",
  SAL_BRANCO: "sal branco",
};

export function suplementacaoToTimeline(s: any): EventoTimeline {
  const rotulo = TITULO_SUPLEMENTO[s.tipo] ?? "suplemento";
  const partes = [
    s.produto,
    `${Number(s.consumoCabecaDiaG)} g/cab/dia`,
    s.custoKg != null ? `${fmtMoney(Number(s.custoKg))}/kg` : null,
  ].filter(Boolean);
  return {
    id: `nut-${s.id}`,
    loteId: String(s.loteId),
    data: iso(s.dataInicio),
    dominio: "nutricao",
    titulo: `Início suplementação ${rotulo}`,
    detalhe: partes.join(" · ") || undefined,
    // dataFim null = suplementação ainda ativa.
    marcador: s.dataFim == null ? "ativa" : undefined,
  };
}

// ── Operação comercial ───────────────────────────────────────────────────────
const TITULO_COMERCIAL: Record<string, string> = {
  VENDA_ABATE: "Venda ao abate",
  VENDA_REPRODUCAO: "Venda para reprodução",
  DESCARTE: "Descarte",
  COMPRA: "Compra de animais",
  TRANSFERENCIA_ATIVIDADE: "Transferência de atividade",
};

export function operacaoToTimeline(o: any): EventoTimeline {
  const arrobas = num(o.arrobas);
  const partes = [
    `${o.numCabecas} cabeças`,
    arrobas != null ? `${arrobas} @` : null,
    o.receitaTotal != null ? fmtMoney(Number(o.receitaTotal)) : null,
  ].filter(Boolean);
  const impacto =
    o.receitaTotal != null
      ? `${o.tipo === "COMPRA" ? "−" : "+"}${fmtMoney(Number(o.receitaTotal))}`
      : undefined;
  return {
    id: `com-${o.id}`,
    loteId: o.loteId != null ? String(o.loteId) : "",
    data: iso(o.data),
    dominio: "comercial",
    titulo: TITULO_COMERCIAL[o.tipo] ?? "Operação comercial",
    detalhe: partes.join(" · ") || undefined,
    impacto,
    responsavel: o.comprador ?? undefined,
  };
}

export async function montarTimeline(loteId: number): Promise<EventoTimeline[]> {
  const [pesagens, manejos, suplementacoes, operacoes] = await Promise.all([
    prisma.pesagemLote.findMany({ where: { loteId } }),
    prisma.manejoSanitario.findMany({ where: { loteId } }),
    prisma.suplementacao.findMany({ where: { loteId } }),
    prisma.operacaoComercial.findMany({ where: { loteId } }),
  ]);
  return [
    ...pesagens.map(pesagemToTimeline),
    ...manejos.map((m) => manejoToTimeline(m)),
    ...suplementacoes.map(suplementacaoToTimeline),
    ...operacoes.map(operacaoToTimeline),
  ].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}
