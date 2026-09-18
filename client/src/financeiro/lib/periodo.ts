/** Preserva o período nos acessos da rastreabilidade ao detalhamento. */
export function periodoInicial(padrao: { inicio: string; fim: string }) {
  if (typeof window === "undefined") return padrao;
  const query = new URLSearchParams(window.location.search);
  const inicio = query.get("inicio"); const fim = query.get("fim");
  const valido = (data: string | null): data is string => !!data && /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(new Date(data).getTime()) && new Date(data).toISOString().slice(0, 10) === data;
  return valido(inicio) && valido(fim) && inicio <= fim ? { inicio, fim } : padrao;
}
