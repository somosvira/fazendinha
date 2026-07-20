// Cálculo puro da conversão de unidade animal (UA) — sem I/O. Converte o efetivo por categoria
// em UA totais (peso-referência da categoria ÷ peso vivo de 1 UA) e, se houver área, UA/ha
// (lotação). Espelha "Ajuste de U.A. de referência" (Nutrição) do IDEagri. Sem schema novo: os
// pesos-referência vêm dos parâmetros PESO_REF_* / PESO_UA_REF_KG (ParametroManejo).

export interface EfetivoCategoria {
  categoria: string;
  cabecas: number;
}

export interface LinhaUA {
  categoria: string;
  cabecas: number;
  pesoRef: number; // kg — peso-referência da categoria (0 quando não parametrizado)
  ua: number; // unidades animais
  semPeso: boolean; // true quando a categoria não tem peso-ref → não entra no total
}

export interface ConversaoUA {
  linhas: LinhaUA[]; // por UA desc
  totalCabecas: number;
  totalUA: number;
  uaPorHa: number | null; // lotação — null quando não há área válida
  areaHa: number | null; // eco da área usada
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function converterUA(
  efetivo: readonly EfetivoCategoria[],
  pesosRef: Readonly<Record<string, number>>,
  pesoUaRefKg: number,
  areaHa?: number,
): ConversaoUA {
  const uaValido = pesoUaRefKg > 0;

  const linhas: LinhaUA[] = efetivo.map((e) => {
    const pesoRef = pesosRef[e.categoria] ?? 0;
    const semPeso = pesoRef <= 0;
    const ua = !semPeso && uaValido ? (e.cabecas * pesoRef) / pesoUaRefKg : 0;
    return { categoria: e.categoria, cabecas: e.cabecas, pesoRef: semPeso ? 0 : pesoRef, ua: r2(ua), semPeso };
  });

  linhas.sort((a, b) => b.ua - a.ua || a.categoria.localeCompare(b.categoria));

  const totalCabecas = linhas.reduce((s, l) => s + l.cabecas, 0);
  const totalUA = r2(linhas.reduce((s, l) => s + l.ua, 0));

  const areaValida = typeof areaHa === "number" && areaHa > 0;
  const uaPorHa = areaValida ? r2(totalUA / areaHa!) : null;

  return { linhas, totalCabecas, totalUA, uaPorHa, areaHa: areaValida ? areaHa! : null };
}
