import { chaveGrupo, type AnimalPlanner, type GrupoPlannerInput, type GrupoRevisado } from "./planner-api";
import type { Visita } from "./visitas-api";

/** Consulta a composição persistida, inclusive quando a preparação dividiu o grupo em atividades. */
export function revisaoGrupoPreparado(visita: Visita, grupo: GrupoPlannerInput): GrupoRevisado | null {
  const atividades = visita.atividades.filter(a => a.contexto?.grupoPlanner
    && chaveGrupo(a.contexto.grupoPlanner as GrupoPlannerInput) === chaveGrupo(grupo));
  const primeira = atividades[0];
  if (!primeira) return null;
  const animais = new Map<string, AnimalPlanner>();
  const excluidos = new Map<string, AnimalPlanner>();
  for (const atividade of atividades) {
    for (const p of [...atividade.participantes].sort((a, b) => a.ordem - b.ordem)) {
      animais.set(p.animalId, { ...p.snapshot, animalId: p.animalId, tarefaId: null,
        motivos: p.snapshot.motivos ?? [], visitasAbertas: [] });
    }
    const ajustes = atividade.contexto?.ajustesManuais;
    const referencias: unknown[] = ajustes && typeof ajustes === "object" && "excluidos" in ajustes && Array.isArray(ajustes.excluidos)
      ? ajustes.excluidos : [];
    const ids = Array.isArray(atividade.contexto?.excluidos) ? atividade.contexto.excluidos : [];
    for (const id of ids) {
      if (typeof id !== "string") continue;
      const referencia = referencias.find(r => r && typeof r === "object" && "animalId" in r && r.animalId === id);
      const identificacao = referencia && typeof referencia === "object" ? referencia : {};
      excluidos.set(id, { animalId: id, tarefaId: null,
        brinco: "brinco" in identificacao && typeof identificacao.brinco === "string" ? identificacao.brinco : undefined,
        nome: "nome" in identificacao && typeof identificacao.nome === "string" ? identificacao.nome : null,
        motivos: ["Excluído na preparação. Contexto clínico não preservado."], visitasAbertas: [] });
    }
  }
  // Os participantes são a fonte da inclusão efetiva, inclusive em listas antigas.
  for (const id of animais.keys()) excluidos.delete(id);
  const linhas = [...animais.values(), ...excluidos.values()];
  return { chave: primeira.id, excluidos: [...excluidos.keys()], previa: {
    grupo: { grupo, nome: "nome" in grupo ? grupo.nome : primeira.nome, tipo: primeira.tipo,
      contexto: primeira.contexto ?? undefined,
      secao: ["APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO"].includes(primeira.tipo) ? "SANIDADE" : "REPRODUCAO",
      janela: "EXTRA", protocolo: null, turma: null, etapa: null, previstaPara: null, precisaoTemporal: null,
      criterios: "criterios" in grupo ? grupo.criterios : null,
      totalAnimais: linhas.length, totalProcedimentos: linhas.length, emVisitaAberta: 0 },
    animais: linhas, total: linhas.length, pagina: 1, tamanhoPagina: linhas.length,
    fingerprint: typeof primeira.contexto?.fingerprint === "string" ? primeira.contexto.fingerprint : "",
  } };
}
