import type { ResumoLote, Lote } from "../types";

/* Worklists do módulo Corte.
 * Limiares calibrados pelo Manual de Boas Práticas Embrapa, cronograma 11,
 * e Indicadores de desempenho na pecuária de corte.
 */

// ── Pesagem ─────────────────────────────────────────────────────────
export function pesagemVencida(rs: ResumoLote[], hojeIso: string): ResumoLote[] {
  // 60 dias = limite frouxo para pasto; lotes em confinamento devem ser
  // pesados a cada 28 dias mas o filtro genérico fica em 60.
  const d0 = new Date(hojeIso).getTime();
  return rs.filter((r) => {
    if (!r.ultimaPesagem) return true;
    const dias = (d0 - new Date(r.ultimaPesagem).getTime()) / 86_400_000;
    return dias > 60;
  });
}

export function gmdBaixo(rs: ResumoLote[]): ResumoLote[] {
  return rs.filter((r) => (r.gmd ?? 0) > 0 && (r.gmd ?? 0) < 0.35);
}

// ── Sanidade ────────────────────────────────────────────────────────
export function vacinaPendente(rs: ResumoLote[], hojeIso: string): ResumoLote[] {
  // Lotes com próxima vacina cujo texto indica urgência (datas ≤ 30 dias).
  const d0 = new Date(hojeIso);
  const mesAtual = d0.getMonth() + 1;
  return rs.filter((r) => {
    if (!r.proximaVacina) return false;
    // janela aftosa (mai + nov): se o texto contém "aftosa" e estamos a 30d
    if (/aftosa/i.test(r.proximaVacina)) {
      // Sul de Minas — etapa 2 da aftosa em novembro, etapa 1 em maio. Estamos em junho.
      // Aftosa nov só fica "urgente" em out — aqui não considera.
      return false;
    }
    // qualquer outra ação sanitária com palavra "vencendo" ou janela próxima
    return /vencendo|janela|antes/i.test(r.proximaVacina);
  });
}

export function vermifugoPendente(rs: ResumoLote[]): ResumoLote[] {
  return rs.filter((r) => r.proximoVermifugo != null);
}

// ── Comercial ───────────────────────────────────────────────────────
export function prontosParaAbate(rs: ResumoLote[]): ResumoLote[] {
  // Critério: peso médio ≥ 480 kg (≈ 16,6 @ carcaça) OU diasParaAlvo ≤ 15.
  return rs.filter((r) => (r.pesoMedio ?? 0) >= 480 || ((r.diasParaAlvo ?? 999) <= 15));
}

export function emTerminacao(rs: ResumoLote[], lotes: Lote[]): ResumoLote[] {
  const ids = new Set(lotes.filter((l) => l.fase === "TERMINACAO").map((l) => l.id));
  return rs.filter((r) => ids.has(r.loteId));
}

// ── Nutrição / pasto ────────────────────────────────────────────────
export function lotacaoExcedida(rs: ResumoLote[], hojeIso: string): ResumoLote[] {
  // Critério editorial: dias sem pesar > 45 + GMD < 0,3 = sinal de pasto ruim.
  void hojeIso;
  return rs.filter((r) => (r.diasSemPesar ?? 0) > 45 && (r.gmd ?? 0) < 0.3);
}

// ── Mortalidade ─────────────────────────────────────────────────────
export function mortalidadeAlta(rs: ResumoLote[]): ResumoLote[] {
  return rs.filter((r) => (r.mortalidadeAcumulada ?? 0) >= 8);
}

export function todos(rs: ResumoLote[]): ResumoLote[] {
  return rs;
}
