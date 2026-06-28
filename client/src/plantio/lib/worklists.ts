import type { ResumoTalhao } from "../types";

/* Worklists — listas de tarefas que aparecem na tab de cada domínio.
 * Espelham aInseminar/dgPendente/aSecar do rebanho. Critérios calibrados
 * com base na literatura Embrapa/Procafé/MIP cafeeiro. */

// FITOSSANIDADE -----------------------------------------------------------

// Limiares de ação clássicos (MIP café arábica):
//   ferrugem: 5% de folhas com pústulas
//   bicho-mineiro: 30% de folhas minadas
//   broca: 3% de frutos brocados (talhões em formação) / 5% (em produção)
//   cercosporiose: 5% das folhas
export function comFerrugemAlta(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.ferrugem ?? 0) >= 5);
}
export function comBichoMineiroAlto(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.bichoMineiro ?? 0) >= 30 || (r.bichoMineiro ?? 0) >= 20);
  // Usamos limiar mais conservador para destacar antes do dano máximo.
}
export function comBrocaAlta(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.broca ?? 0) >= 3);
}
export function comCercosporioseAlta(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.cercosporiose ?? 0) >= 5);
}
export function inspecaoVencida(rs: ResumoTalhao[], hoje: string) {
  // Sem inspeção nos últimos 30 dias.
  const d0 = new Date(hoje).getTime();
  return rs.filter((r) => {
    if (!r.ultimaInspecaoData) return true;
    const dias = (d0 - new Date(r.ultimaInspecaoData).getTime()) / 86_400_000;
    return dias > 30;
  });
}

// NUTRIÇÃO ----------------------------------------------------------------

export function pHBaixo(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.pH ?? 7) < 5.2);
}
export function vBaixo(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.v ?? 100) < 50);
}
export function potassioBaixo(rs: ResumoTalhao[]) {
  return rs.filter((r) => (r.potassio ?? 999) < 80);
}
export function foliarVencida(rs: ResumoTalhao[], hoje: string) {
  const d0 = new Date(hoje).getTime();
  return rs.filter((r) => {
    if (!r.ultimaAnaliseFoliar) return true;
    const dias = (d0 - new Date(r.ultimaAnaliseFoliar).getTime()) / 86_400_000;
    return dias > 120; // análise foliar a cada 4 meses no ciclo
  });
}
export function soloVencida(rs: ResumoTalhao[], hoje: string) {
  const d0 = new Date(hoje).getTime();
  return rs.filter((r) => {
    if (!r.ultimaAnaliseSolo) return true;
    const dias = (d0 - new Date(r.ultimaAnaliseSolo).getTime()) / 86_400_000;
    return dias > 365; // análise de solo anual
  });
}

// FENOLOGIA / COLHEITA ----------------------------------------------------

export function prontosParaColher(rs: ResumoTalhao[]) {
  // Maturação cereja ≥ 60% e talhão ainda não em "COLHEITA"
  return rs.filter((r) => (r.maturacaoCereja ?? 0) >= 60 && r.fase === "MATURACAO_CEREJA");
}
export function emColheita(rs: ResumoTalhao[]) {
  return rs.filter((r) => r.fase === "COLHEITA");
}
export function emFloradaOuPegamento(rs: ResumoTalhao[]) {
  return rs.filter((r) => r.fase === "FLORADA" || r.fase === "CHUMBINHO");
}
export function emGranacao(rs: ResumoTalhao[]) {
  return rs.filter((r) => r.fase === "GRANACAO" || r.fase === "EXPANSAO");
}
export function emFormacao(rs: ResumoTalhao[]) {
  return rs.filter((r) => r.fase === "REPOUSO" && (r.produtividadeUltima ?? 0) === 0);
}
export function bienalidadeNegativa(rs: ResumoTalhao[]) {
  return rs.filter((r) => r.bienalidade === "NEGATIVA");
}

// TALHÃO geral ------------------------------------------------------------

export function todos(rs: ResumoTalhao[]) {
  return rs;
}
