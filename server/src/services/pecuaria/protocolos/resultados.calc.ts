const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
/** Nome/data não classificam acompanhamento; somente a ação estruturada publicada. */
export function faseEtapaReprodutiva(
  configuracao: unknown,
): "EXECUCAO" | "RESULTADOS" {
  const c = objeto(configuracao),
    p = objeto(c.planoAvaliacao);
  return c.tipo === "AVALIACAO" &&
    ["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"].includes(String(p.tipo))
    ? "RESULTADOS"
    : "EXECUCAO";
}
export function resumirPreparo(
  tarefas: ReadonlyArray<{
    situacao: string;
    tipo: string;
    motivoDispensa?: string | null;
  }>,
  retirada: boolean,
) {
  const preparo = tarefas.filter((t) => t.tipo !== "TENTATIVA");
  const atendidas = preparo.filter((t) => t.situacao === "ATENDIDO").length;
  const situacao = !preparo.length
    ? "SEM_ETAPAS"
    : atendidas === preparo.length
      ? "CONCLUIDO"
      : preparo.some((t) => t.situacao === "REGULARIZACAO_PENDENTE")
        ? "A_REGULARIZAR"
        : retirada
          ? "RETIRADO"
          : preparo.some((t) => t.situacao === "DISPENSADO")
            ? "DISPENSADO"
            : "PENDENTE";
  const execucaoEncerrada =
    tarefas.length > 0 &&
    tarefas.every(
      (t) =>
        t.situacao === "ATENDIDO" ||
        t.situacao === "RETIRADO" ||
        t.situacao === "ENCERRADO" ||
        (t.situacao === "DISPENSADO" && !!t.motivoDispensa?.trim()),
    );
  return { situacao, total: preparo.length, atendidas, execucaoEncerrada };
}
export type ExameResultado = {
  id: string;
  data: string;
  finalidades: string[];
  resultado: string | null;
  conduta: string | null;
  retornoEm: string | null;
};
export function resumirDiagnostico(
  exames: readonly ExameResultado[],
  perda: boolean,
) {
  const dgs = exames.filter(
    (e) =>
      e.finalidades.includes("DIAGNOSTICO") &&
      ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(e.resultado ?? ""),
  );
  const primeiroDg = dgs[0] ?? null;
  const conclusivo =
    dgs
      .filter((e) => ["POSITIVO", "NEGATIVO"].includes(e.resultado ?? ""))
      .at(-1) ?? null;
  return {
    primeiroDg,
    conclusao:
      conclusivo?.resultado ??
      (primeiroDg ? "INCONCLUSIVO" : "AGUARDANDO_DIAGNOSTICO"),
    perdaPosterior: perda,
    posteriores: exames.filter((e) => e.id !== primeiroDg?.id),
  };
}
export function taxaResultado(numerador: number, denominador: number) {
  return {
    numerador,
    denominador,
    percentual: denominador ? (numerador / denominador) * 100 : null,
  };
}
