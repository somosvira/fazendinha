export interface ControleIn { data: string; pesoTotal: number }
export interface ResumoProducao { producaoMediaDia: number | null; producao305: number | null; producaoTendencia: string | null }

export const JANELA_CONTROLES = 3;
export const DIAS_LACTACAO = 305;

const round1 = (n: number) => Math.round(n * 10) / 10;
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// projeção 305d linear simples (refino via curva deferido)
export function producao305De(mediaDia: number | null, temLactacaoAberta: boolean): number | null {
  if (temLactacaoAberta && mediaDia != null) return Math.round(mediaDia * DIAS_LACTACAO);
  return null;
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

  let producaoTendencia: string | null = null;
  if (ord.length >= 2) {
    const recentes = media(ord.slice(0, 2).map((c) => c.pesoTotal));
    const anteriores = ord.length >= 3 ? media(ord.slice(2, 4).map((c) => c.pesoTotal)) : ord[ord.length - 1].pesoTotal;
    producaoTendencia = recentes > anteriores ? "subindo" : recentes < anteriores ? "descendo" : "estavel";
  }

  return { producaoMediaDia, producao305: producao305De(producaoMediaDia, temLactacaoAberta), producaoTendencia };
}
