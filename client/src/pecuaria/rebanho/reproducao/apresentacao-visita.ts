import type { AtividadeVisita } from "./visitas-api";

/** Usa somente nomes preservados na preparação, sem completar com cadastros atuais. */
export function nomeAtividadeVisita(atividade: AtividadeVisita): string {
  const nomes = atividade.participantes.map(p => p.snapshot.tarefaPlanejada?.tarefa.nome);
  return nomes.length && nomes.every(nome => nome && nome === nomes[0]) ? nomes[0]! : atividade.nome;
}

export function lotesAtividadeVisita(atividade: AtividadeVisita): string {
  const nomes = [...new Set(atividade.participantes.flatMap(p => p.snapshot.lote?.nome ? [p.snapshot.lote.nome] : []))];
  if (!nomes.length) return "Lote não preservado";
  const desconhecidos = atividade.participantes.some(p => !p.snapshot.lote?.nome);
  return `${nomes.length === 1 ? nomes[0] : `${nomes.length} lotes`}${desconhecidos ? " · há lotes não informados" : ""}`;
}

/** Origem de navegação comprovada, independente da origem clínica ou de estoque. */
export function origemAtividadeVisita(atividade: AtividadeVisita): "agenda" | "livre" | null {
  const percurso = atividade.contexto?.percursoVisita;
  if (percurso && typeof percurso === "object" && "origem" in percurso) {
    if (percurso.origem === "AGENDA") return "agenda";
    if (percurso.origem === "LIVRE") return "livre";
  }
  const grupo = atividade.contexto?.grupoPlanner;
  if (grupo && typeof grupo === "object" && "origem" in grupo) {
    if (grupo.origem === "PROTOCOLO" || grupo.origem === "RETORNO") return "agenda";
    if (["LIVRE", "EXTRA", "SELECAO"].includes(String(grupo.origem))) return "livre";
  }
  return null;
}
