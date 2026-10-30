/** Simula a leitura JSONB: a ordem das chaves não é preservada, a dos arrays é. */
export function reordenarChavesJson<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(reordenarChavesJson) as T;
  if (valor !== null && typeof valor === 'object') return Object.fromEntries(
    Object.entries(valor).sort(([a], [b]) => b.localeCompare(a)).map(([chave, item]) => [chave, reordenarChavesJson(item)]),
  ) as T;
  return valor;
}
