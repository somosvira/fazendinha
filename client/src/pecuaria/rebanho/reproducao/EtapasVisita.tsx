import type { EtapaVisita } from "../../../router";

const etapas: { id: EtapaVisita; nome: string; descricao: string }[] = [
  { id: "planejamento", nome: "Planejamento", descricao: "Escolher os grupos" },
  { id: "revisao", nome: "Revisão dos animais", descricao: "Conferir a seleção" },
  { id: "atendimento", nome: "Atendimento", descricao: "Registrar os procedimentos" },
];

export function EtapasVisita({ modo = "agenda", etapa, podeRevisar, podeAtender, ocupado, bloqueado, onNavegar }: {
  modo?: "agenda" | "livre";
  etapa: EtapaVisita;
  podeRevisar: boolean;
  podeAtender: boolean;
  ocupado?: boolean;
  bloqueado?: boolean;
  onNavegar: (etapa: EtapaVisita) => void;
}) {
  const percurso = modo === "livre" ? [
    { id: "selecao" as const, nome: "Seleção livre", descricao: "Definir os filtros" },
    { id: "revisao" as const, nome: "Revisão dos animais", descricao: "Conferir o grupo" },
    { id: "atividade" as const, nome: "Atividade", descricao: "Definir o atendimento" },
    etapas[2],
  ] : [{...etapas[0], nome: "Agenda do dia"}, ...etapas.slice(1)];
  return <nav className="visita-etapas" aria-label="Etapas da visita">{percurso.map((item, indice) => <button
    key={item.id} type="button" aria-current={etapa === item.id ? "step" : undefined}
    disabled={ocupado || (bloqueado && item.id !== etapa) || (["revisao", "atividade"].includes(item.id) && !podeRevisar) || (item.id === "atendimento" && !podeAtender)}
    onClick={() => onNavegar(item.id)}
  ><span className="visita-etapa-numero">{indice + 1}</span><span><strong>{item.nome}</strong><small>{item.descricao}</small></span></button>)}</nav>;
}
