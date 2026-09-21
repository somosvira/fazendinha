/**
 * Preserva o período nos acessos da rastreabilidade ao detalhamento.
 *
 * `permitirVazio` trata `?inicio=&fim=` (as duas chaves presentes e vazias)
 * como "todo o período" em vez de cair no padrão do chamador. Isso importa
 * quando o padrão não é vazio (ex.: Contas usa o ano atual): sem essa opção,
 * recarregar um link gerado com "Todo o período" selecionado silenciosamente
 * voltaria para o ano atual, podendo esconder o registro apontado pela URL.
 */
export function periodoInicial(padrao: { inicio: string; fim: string }, opcoes: { permitirVazio?: boolean } = {}) {
  if (typeof window === "undefined") return padrao;
  const query = new URLSearchParams(window.location.search);
  if (!query.has("inicio") && !query.has("fim")) return padrao;
  const inicio = query.get("inicio"); const fim = query.get("fim");
  if (opcoes.permitirVazio && inicio === "" && fim === "") return { inicio: "", fim: "" };
  const valido = (data: string | null): data is string => !!data && /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(new Date(data).getTime()) && new Date(data).toISOString().slice(0, 10) === data;
  return valido(inicio) && valido(fim) && inicio <= fim ? { inicio, fim } : padrao;
}
