export function validarRetornoInterno(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || /[\\\u0000-\u001f]/.test(valor)) return null;
  try {
    const url = new URL(valor, "https://fazendinha.local");
    if (url.origin !== "https://fazendinha.local" || !["/pecuaria/rebanho/sanidade", "/estoque", "/financeiro/operacoes"].includes(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function linkOperacaoFinanceira(id: string, returnTo?: string): string {
  const retorno = validarRetornoInterno(returnTo);
  return `/financeiro/operacoes/${encodeURIComponent(id)}${retorno ? `?${new URLSearchParams({ returnTo: retorno })}` : ""}`;
}
