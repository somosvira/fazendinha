/** Uma conclusão é uma observação identificável, não a realização inteira do exame. */
export function resultadoConclusivoPorFinalidade<T extends { campo: string; valor: unknown }>(
  finalidade: string,
  resultados: readonly T[],
): T | undefined {
  if (!["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"].includes(finalidade)) return undefined;
  return resultados.find(r => finalidade === "SEXAGEM"
    ? r.campo === "SEXO_FETAL" && (r.valor === "F" || r.valor === "M")
    : r.campo === "CONCLUSAO_GESTACIONAL" && (r.valor === "POSITIVO" || r.valor === "NEGATIVO"));
}

/** Referencia a evidência original, sem criar outro fato ou copiar aptidão. */
export type ReferenciaConclusaoReprodutiva =
  | { fonte: "RESULTADO"; id: string; tipo: "CONCLUSAO_GESTACIONAL" | "SEXO_FETAL" }
  | { fonte: "INTERPRETACAO"; id: string; tipo: "APTIDAO_REPRODUTIVA" };

export function referenciaConclusaoReprodutiva(
  tipo: ReferenciaConclusaoReprodutiva["tipo"],
  exame: { status: string; realizacao: string; resultados: readonly { id: string; campo: string; valor: unknown; vigente: boolean }[]; interpretacao: { id: string; resultadoAptidao: string | null } | null },
): ReferenciaConclusaoReprodutiva | null {
  if (exame.status !== "VALIDO" || exame.realizacao !== "REALIZADO") return null;
  if (tipo === "APTIDAO_REPRODUTIVA") {
    const i = exame.interpretacao;
    return i && (i.resultadoAptidao === "APTO" || i.resultadoAptidao === "NAO_APTO")
      ? { fonte: "INTERPRETACAO", id: i.id, tipo } : null;
  }
  const finalidade = tipo === "SEXO_FETAL" ? "SEXAGEM" : "DIAGNOSTICO";
  const r = resultadoConclusivoPorFinalidade(finalidade, exame.resultados.filter(r => r.vigente));
  return r ? { fonte: "RESULTADO", id: r.id, tipo } : null;
}
