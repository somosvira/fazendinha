/** O CI externo tem seu banco efêmero próprio. Localmente só o seedatev3 é aceito. */
export function exigirBancoIntegracaoPecuaria(): string {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalido");
  const ciExterno = process.env.CI === "true" && process.env.GITHUB_ACTIONS === "true";
  const banco = ciExterno ? "fazendinha_test" : "fazendinha_seedatev3";
  if (url.pathname !== `/${banco}` || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error(`Integração exige PostgreSQL ${banco} neste ambiente`);
  return banco;
}
