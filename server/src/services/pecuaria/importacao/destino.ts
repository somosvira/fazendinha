export function identificarDestinoImportacao(databaseUrl: string, namespace: string) {
  const url = new URL(databaseUrl);
  return { ambiente: namespace, host: url.host, banco: decodeURIComponent(url.pathname.slice(1)) };
}
/** Confirmações são do operador da ferramenta, não autorização de uma carga.
 * Produção nunca é um destino desta reconciliação. Não retorna credenciais. */
export function validarDestinoImportacao(input: {
  databaseUrl: string; namespace: string; bancoConfirmado?: string;
  ambienteConfirmado?: string; destinoConfirmado?: string; manifestoConfirmado?: string;
}) {
  const url = new URL(input.databaseUrl);
  const destino = identificarDestinoImportacao(input.databaseUrl, input.namespace);
  if (input.namespace === "prod") throw new Error("Execução técnica bloqueada em produção.");
  if (!/^[a-f0-9]{64}$/.test(input.manifestoConfirmado ?? ""))
    throw new Error("Informe o hash do manifesto da prévia revisada.");
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    if (destino.banco !== "fazendinha_seedatev3" || input.bancoConfirmado !== destino.banco)
      throw new Error("Execução local exige confirmação do único banco fazendinha_seedatev3.");
  } else {
    if (input.namespace !== "staging" || input.ambienteConfirmado !== "staging" || input.destinoConfirmado !== `${destino.host}/${destino.banco}`)
      throw new Error("Confirme explicitamente STG e seu destino host/banco antes da execução remota.");
    if (!url.hostname.endsWith(".neon.tech") || url.searchParams.get("sslmode") !== "require")
      throw new Error("O destino STG exige Neon e conexão TLS declarada (sslmode=require).");
  }
  return destino;
}
