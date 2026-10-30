export const FINALIDADE_APTIDAO = "APTIDAO_REPRODUTIVA";
export type EvidenciaToqueAptidao = {
  id: string; animalId: string; propriedadeId: number | null; data: Date; atualizadoEm: Date;
  status: string; finalidadePrincipal: string | null; resultadoOpcao: string | null; retornoEm: Date | null;
};
export type AptidaoClinica = { estado: "APTA" | "NAO_APTA" | "NAO_DETERMINADA"; exameId: string | null; data: string | null; retornoEm: string | null; resultado: string | null };
export function concluirAptidaoClinica(exames: readonly EvidenciaToqueAptidao[], referencia: Date): AptidaoClinica {
  const e = [...exames].filter(e => e.status === "VALIDO" && e.finalidadePrincipal === FINALIDADE_APTIDAO && e.data <= referencia)
    .sort((a, b) => b.data.getTime() - a.data.getTime() || b.atualizadoEm.getTime() - a.atualizadoEm.getTime() || b.id.localeCompare(a.id))[0];
  return { estado: e?.resultadoOpcao === "APTO" ? "APTA" : e?.resultadoOpcao === "NAO_APTO" ? "NAO_APTA" : "NAO_DETERMINADA", exameId: e?.id ?? null,
    data: e?.data.toISOString().slice(0,10) ?? null, retornoEm: e?.retornoEm?.toISOString().slice(0,10) ?? null, resultado: e?.resultadoOpcao ?? null };
}
export function snapshotToqueAptidao(e: EvidenciaToqueAptidao) {
  return { id: e.id, data: e.data.toISOString().slice(0,10), atualizadoEm: e.atualizadoEm.toISOString(), resultado: e.resultadoOpcao };
}
/** Revisão é obrigatória após qualquer correção da evidência, mesmo que o resultado continue apto. */
export function evidenciaDecisaoAptidaoVigente(exame: EvidenciaToqueAptidao | undefined, snapshot: unknown): boolean {
  if (!exame || exame.status !== "VALIDO" || exame.finalidadePrincipal !== FINALIDADE_APTIDAO || exame.resultadoOpcao !== "APTO") return false;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return false;
  const s = snapshot as Record<string, unknown>;
  const atual = snapshotToqueAptidao(exame);
  return s.id === atual.id && s.data === atual.data && s.atualizadoEm === atual.atualizadoEm && s.resultado === atual.resultado;
}
