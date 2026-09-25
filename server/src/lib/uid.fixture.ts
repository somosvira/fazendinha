/** Determinístico — os testes de ordenação dependem de ids previsíveis. */
export const uid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
