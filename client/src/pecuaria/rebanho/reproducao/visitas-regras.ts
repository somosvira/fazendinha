import type { ParticipanteVisita, RascunhoVisita } from "./visitas-api";
export function motivosParticipante(p: ParticipanteVisita): string[] {
  if (p.snapshot.motivos?.length) return p.snapshot.motivos;
  const motivos: string[] = [];
  if (p.tarefaSanitariaId) motivos.push("Tarefa sanitária pendente");
  if (p.tarefaIatfId) motivos.push("Etapa IATF pendente");
  if (p.snapshot.gestacao) motivos.push("Gestação conhecida");
  if (
    !p.snapshot.gestacao &&
    p.snapshot.tentativa &&
    (!p.snapshot.ultimoParto ||
      p.snapshot.tentativa.data > p.snapshot.ultimoParto.data)
  )
    motivos.push("Diagnóstico pós-tentativa");
  if (p.snapshot.restricoes?.length) motivos.push("Restrição reprodutiva");
  return motivos.length ? motivos : ["Avaliação / atividade extra"];
}
/** A ordem persistida também orienta impressão e entrada pelo teclado. */
export function ordenarParticipantes(itens: ParticipanteVisita[]) {
  return [...itens].sort((a, b) => a.ordem - b.ordem);
}

/** Cada bloco tem sua própria transação/idempotência no servidor. */
export function blocosConfirmacao(ids: string[], limite = 100): string[][] {
  if (!Number.isInteger(limite) || limite < 1 || limite > 100)
    throw new Error("O limite de confirmação deve ficar entre 1 e 100.");
  const blocos: string[][] = [];
  for (let inicio = 0; inicio < ids.length; inicio += limite)
    blocos.push(ids.slice(inicio, inicio + limite));
  return blocos;
}
export function filtrarParticipantes(
  itens: ParticipanteVisita[],
  filtros: { q: string; status: string; motivos: string[]; loteId?: string },
) {
  return ordenarParticipantes(itens).filter(
    (p) =>
      (!filtros.q ||
        `${p.snapshot.brinco ?? ""} ${p.snapshot.nome ?? ""}`
          .toLowerCase()
          .includes(filtros.q.toLowerCase())) &&
      (!filtros.status || p.status === filtros.status) &&
      (!filtros.loteId || p.snapshot.lote?.id === filtros.loteId) &&
      (!filtros.motivos.length ||
        filtros.motivos.some((m) => motivosParticipante(p).includes(m))),
  );
}
export function pendenciaRascunho(
  r: RascunhoVisita | undefined,
): string | null {
  if (!r) return "Informe o atendimento.";
  if (r.status === "ADIADO" || r.status === "NAO_ATENDIDO")
    return r.motivo && r.motivo.trim().length >= 5
      ? null
      : "Informe o motivo do atendimento pendente.";
  if (
    r.resultado === "POSITIVO" &&
    !r.tentativaId &&
    !r.gestacaoId &&
    (!r.motivoVinculoDesconhecido ||
      r.motivoVinculoDesconhecido.trim().length < 5)
  )
    return "Vincule a tentativa ou explique o vínculo desconhecido.";
  if (!r.resultado) return "Informe o resultado, inclusive não avaliado.";
  if (r.resultado === "SEXAGEM" && !r.sexoFetal) return "Informe o sexo fetal.";
  if (r.conduta === "DESCARTE" && (!r.motivo || r.motivo.trim().length < 5))
    return "Informe o motivo do descarte.";
  return null;
}
