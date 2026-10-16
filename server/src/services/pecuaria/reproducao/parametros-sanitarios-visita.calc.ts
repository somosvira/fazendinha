/** Contrato de preparação: somente parâmetros congelados da tarefa comum. */
export function parametrosSanitariosVisita(parametros: unknown) {
  const dados = parametros && typeof parametros === "object" && !Array.isArray(parametros)
    ? parametros as Record<string, unknown> : {};
  const texto = (campo: string) => typeof dados[campo] === "string" ? dados[campo] as string : null;
  return {
    produtoId: texto("produtoId"),
    dose: typeof dados.dose === "number" && Number.isFinite(dados.dose) ? String(dados.dose) : texto("dose"),
    unidade: texto("unidade"),
    via: texto("via"),
    tipoAplicacaoId: texto("tipoAplicacaoId"),
    tipoExameId: texto("tipoExameId"),
  };
}
