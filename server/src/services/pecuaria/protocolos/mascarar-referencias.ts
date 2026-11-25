/** Referências financeiras de modelos são opcionais e devem ser omitidas integralmente sem verValores. */
export function mascararReferenciasModelo<T>(valor: T, verValores: boolean): T {
  if (verValores || valor == null || typeof valor !== "object" || valor instanceof Date) return valor;
  if (Object.getPrototypeOf(valor) !== Object.prototype && !Array.isArray(valor)) return valor;
  if (Array.isArray(valor)) return valor.map(v => mascararReferenciasModelo(v, false)) as T;
  return Object.fromEntries(Object.entries(valor).filter(([chave]) => chave !== "referenciasCusto").map(([chave, v]) => [chave, mascararReferenciasModelo(v, false)])) as T;
}

/** Na visita, o snapshot pode misturar tarefas sanitárias e reprodutivas. */
export function mascararReferenciasVisita<T>(valor: T, verValores: boolean): T {
  if (verValores || valor == null || typeof valor !== "object" || valor instanceof Date) return valor;
  if (Object.getPrototypeOf(valor) !== Object.prototype && !Array.isArray(valor)) return valor;
  if (Array.isArray(valor)) return valor.map(item => mascararReferenciasVisita(item, false)) as T;
  const obj = valor as Record<string, unknown>;
  if (obj.origem === "REPRODUTIVA" && "tarefa" in obj) return mascararReferenciasModelo(valor, false);
  return Object.fromEntries(Object.entries(obj).map(([chave, item]) => [chave,
    chave === "protocolosIatf" || chave === "tarefasIatf" ? mascararReferenciasModelo(item, false) : mascararReferenciasVisita(item, false),
  ])) as T;
}
