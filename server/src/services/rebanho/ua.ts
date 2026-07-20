import { obterQuantitativo } from "./quantitativo.js";
import { getParametros, getNumero } from "./parametros.js";
import { converterUA, type ConversaoUA, type EfetivoCategoria } from "./ua.calc.js";

// Prefixo das chaves de peso-referência por categoria (PESO_REF_VACA, PESO_REF_TOURO, …).
const PREFIXO_PESO_REF = "PESO_REF_";

// Lê os parâmetros PESO_REF_* → Record<CATEGORIA, pesoRefKg>. As chaves batem 1:1 com o enum
// CategoriaAnimal (VACA/NOVILHA/…), então o sufixo da chave é a própria categoria.
function pesosRefDosParametros(params: { chave: string; valorNumero: number | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of params) {
    if (p.chave.startsWith(PREFIXO_PESO_REF) && p.valorNumero != null) {
      out[p.chave.slice(PREFIXO_PESO_REF.length)] = p.valorNumero;
    }
  }
  return out;
}

// Conversão de UA: efetivo (por categoria) → UA totais e, com área, UA/ha (lotação).
export async function obterUA(propriedadeId: number | null, areaHa?: number): Promise<ConversaoUA> {
  const [quant, params, pesoUaRef] = await Promise.all([
    obterQuantitativo(propriedadeId),
    getParametros(),
    getNumero("PESO_UA_REF_KG"),
  ]);

  const efetivo: EfetivoCategoria[] = quant.linhas.map((l) => ({ categoria: l.categoria, cabecas: l.totalCategoria }));
  const pesosRef = pesosRefDosParametros(params);

  return converterUA(efetivo, pesosRef, pesoUaRef ?? 0, areaHa);
}
