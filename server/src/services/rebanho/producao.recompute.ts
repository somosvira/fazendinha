export interface ControleIn { data: string; pesoTotal: number }
export interface ResumoProducao { producaoMediaDia: number | null; producao305: number | null; producaoTendencia: string | null }

export const JANELA_CONTROLES = 3;
export const DIAS_LACTACAO = 305;
// Materialidade da queda de produção: só chamamos de "descendo" quedas ≥ este % entre a média
// dos 2 controles recentes e a dos 2 anteriores. Abaixo disso é ruído de medição (ex.: 0,1 L)
// e não deve virar alerta acionável.
export const LIMIAR_QUEDA_PCT = 8;

const round1 = (n: number) => Math.round(n * 10) / 10;
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Queda percentual dos controles recentes vs. anteriores. Positiva = produção caiu.
// recentes = média dos 2 mais novos; anteriores = média dos 2 seguintes (ou o mais antigo
// quando só há 2). null quando não há ao menos 2 controles. Ordena por data desc internamente.
export function quedaProducaoPct(controles: ControleIn[]): number | null {
  const ord = controles.slice().sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  if (ord.length < 2) return null;
  const recentes = media(ord.slice(0, 2).map((c) => c.pesoTotal));
  const anteriores = ord.length >= 3 ? media(ord.slice(2, 4).map((c) => c.pesoTotal)) : ord[ord.length - 1].pesoTotal;
  if (anteriores === 0) return null;
  return round1(((anteriores - recentes) / anteriores) * 100);
}

// projeção 305d linear simples (refino via curva deferido)
export function producao305De(mediaDia: number | null, temLactacaoAberta: boolean): number | null {
  if (temLactacaoAberta && mediaDia != null) return Math.round(mediaDia * DIAS_LACTACAO);
  return null;
}

// Correção 305 oficial > estimativa: o valor zootécnico corrigido do Ideagri (importado na
// lactação corrente) é a fonte de verdade; a projeção linear só cobre quem não tem o oficial.
// Ex.: uma lactação seca com 305 oficial passa a exibir o número real, que a estimativa zerava.
export function selecionarProducao305(oficial: number | null | undefined, estimativa: number | null): number | null {
  return oficial != null ? oficial : estimativa;
}

// rateio do tanque/lote para o animal
export function ratearProducao(litros: number, vacasEmLactacao: number): number | null {
  if (vacasEmLactacao > 0) return round1(litros / vacasEmLactacao);
  return null;
}

export function recomputarProducaoAnimal(controles: ControleIn[], temLactacaoAberta: boolean): ResumoProducao {
  const ord = controles.slice().sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  if (ord.length === 0) return { producaoMediaDia: null, producao305: null, producaoTendencia: null };

  const janela = ord.slice(0, JANELA_CONTROLES).map((c) => c.pesoTotal);
  const producaoMediaDia = round1(media(janela));

  // Tendência com materialidade na QUEDA: "descendo" só quando a queda ≥ LIMIAR_QUEDA_PCT
  // (evita transformar ruído de 0,1 L em alerta). Subida mantém o comportamento antigo.
  let producaoTendencia: string | null = null;
  if (ord.length >= 2) {
    const recentes = media(ord.slice(0, 2).map((c) => c.pesoTotal));
    const anteriores = ord.length >= 3 ? media(ord.slice(2, 4).map((c) => c.pesoTotal)) : ord[ord.length - 1].pesoTotal;
    const queda = quedaProducaoPct(ord); // % positivo = caiu
    if (recentes > anteriores) producaoTendencia = "subindo";
    else if (queda != null && queda >= LIMIAR_QUEDA_PCT) producaoTendencia = "descendo";
    else producaoTendencia = "estavel";
  }

  return { producaoMediaDia, producao305: producao305De(producaoMediaDia, temLactacaoAberta), producaoTendencia };
}
