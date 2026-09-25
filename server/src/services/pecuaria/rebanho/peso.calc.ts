// GMD (ganho médio diário) e agregados de peso do rebanho — cálculo puro, sem I/O.
//
// GMD = (peso final − peso inicial) ÷ dias entre as duas pesagens, em kg/dia, com 3 casas.
// Precisa de 2 pesagens com pelo menos 1 dia de diferença; sem isso não há GMD (a tela mostra
// "—" com "pesagens insuficientes" — aqui isso é `null`).
//
//   - GMD recente: última pesagem × a anterior.
//   - GMD do período: primeira × última pesagem dentro de uma janela (30/90/180/365 dias, ou
//     "desde a entrada" — aqui representado por `periodoDias: null`, sem limite inferior).
//   - GMD desde a entrada: primeira × última pesagem do animal (todo o histórico).
//   - Baixado: tudo calculado só com as pesagens até a data da baixa (`ateData`).

const DIA_MS = 86_400_000;

function paraData(v: Date | string): Date {
  return typeof v === "string" ? new Date(v) : v;
}

function t(v: Date | string): number {
  return paraData(v).getTime();
}

function iso(v: Date | string): string {
  return typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10);
}

function arredondar(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

const arredondar3 = (v: number) => arredondar(v, 3);
/** Peso sempre com 2 casas (mesma convenção de `pesoKgSchema` em schemas.ts). */
export const arredondarPeso = (v: number) => arredondar(v, 2);

/** dias entre duas datas (`@db.Date`, sem hora) — negativo se `b` for antes de `a`. */
export function diasEntre(a: Date | string, b: Date | string): number {
  return Math.round((t(b) - t(a)) / DIA_MS);
}

export interface PesagemPeso {
  data: Date | string;
  pesoKg: number;
}

/** GMD entre duas pesagens (kg/dia, 3 casas). `null` se forem do mesmo dia ou fora de ordem. */
export function gmdEntre(inicial: PesagemPeso, final: PesagemPeso): number | null {
  const dias = diasEntre(inicial.data, final.data);
  if (dias < 1) return null;
  return arredondar3((final.pesoKg - inicial.pesoKg) / dias);
}

export interface ResultadoGmdPeriodo {
  dias: number | null;
  valor: number | null;
  /** pesagens dentro da janela, mesmo quando insuficientes para calcular o GMD (0 ou 1) */
  pesagens: number;
}

/**
 * GMD entre a primeira e a última pesagem dentro de `[de, ate]` (`de` nulo = sem limite inferior,
 * ou seja "desde a entrada"/todo o histórico até `ate`).
 */
export function gmdPeriodo(pesagens: PesagemPeso[], de: Date | string | null, ate: Date | string): ResultadoGmdPeriodo {
  const ateT = t(ate);
  const deT = de == null ? null : t(de);
  const janela = pesagens
    .filter((p) => t(p.data) <= ateT && (deT == null || t(p.data) >= deT))
    .sort((a, b) => t(a.data) - t(b.data));

  if (janela.length < 2) return { dias: null, valor: null, pesagens: janela.length };

  const primeira = janela[0];
  const ultima = janela[janela.length - 1];
  const dias = diasEntre(primeira.data, ultima.data);
  if (dias < 1) return { dias: null, valor: null, pesagens: janela.length };
  return { dias, valor: arredondar3((ultima.pesoKg - primeira.pesoKg) / dias), pesagens: janela.length };
}

export interface ResumoPeso {
  ultimo: { kg: number; data: string } | null;
  gmdRecente: number | null;
  gmdDesdeEntrada: number | null;
  gmdPeriodo: ResultadoGmdPeriodo;
}

/**
 * Resumo de peso/GMD de um animal a partir de todo o seu histórico de pesagens.
 * `hoje` é a referência ("agora"); `ateData` (a data da baixa, quando o animal foi baixado)
 * substitui `hoje` como limite superior — nenhuma pesagem depois dela entra em nada.
 */
export function resumoPeso(
  pesagens: PesagemPeso[],
  opts: { hoje: Date | string; periodoDias: number | null; ateData?: Date | string | null },
): ResumoPeso {
  const limite = opts.ateData ?? opts.hoje;
  const ordenadas = pesagens
    .filter((p) => t(p.data) <= t(limite))
    .sort((a, b) => t(a.data) - t(b.data));

  const ultimaPesagem = ordenadas[ordenadas.length - 1] ?? null;
  const ultimo = ultimaPesagem ? { kg: arredondarPeso(ultimaPesagem.pesoKg), data: iso(ultimaPesagem.data) } : null;

  const gmdRecente = ordenadas.length >= 2 ? gmdEntre(ordenadas[ordenadas.length - 2], ultimaPesagem!) : null;
  const gmdDesdeEntrada = ordenadas.length >= 2 ? gmdEntre(ordenadas[0], ultimaPesagem!) : null;

  const de = opts.periodoDias == null ? null : new Date(t(limite) - opts.periodoDias * DIA_MS);
  const periodo = gmdPeriodo(ordenadas, de, limite);

  return { ultimo, gmdRecente, gmdDesdeEntrada, gmdPeriodo: periodo };
}

export interface ItemPesoLote {
  ultimoKg: number | null;
  gmdPeriodo: number | null;
}

export interface AgregadoPesoLote {
  peso: { medioKg: number | null; minKg: number | null; maxKg: number | null; semPeso: number };
  gmd: { medio: number | null; comGmd: number };
}

/** Agrega peso/GMD de um lote a partir dos resumos por animal (cada um já calculado com `resumoPeso`). */
export function agregarPesoLote(itens: ItemPesoLote[]): AgregadoPesoLote {
  const pesos = itens.map((i) => i.ultimoKg).filter((v): v is number => v != null);
  const gmds = itens.map((i) => i.gmdPeriodo).filter((v): v is number => v != null);
  const media = (lista: number[]) => lista.reduce((s, v) => s + v, 0) / lista.length;
  return {
    peso: {
      medioKg: pesos.length ? arredondarPeso(media(pesos)) : null,
      minKg: pesos.length ? arredondarPeso(Math.min(...pesos)) : null,
      maxKg: pesos.length ? arredondarPeso(Math.max(...pesos)) : null,
      semPeso: itens.length - pesos.length,
    },
    gmd: {
      medio: gmds.length ? arredondar3(media(gmds)) : null,
      comGmd: gmds.length,
    },
  };
}
