import { CalendarDays, ChevronRight, MapPin, UserRound } from "lucide-react";
import { Empty, Pill, dataBR } from "../../../financeiro/financeiro-ui";
import type { VisitaResumo } from "./visitas-api";
import "./consulta-visitas.css";

/** A lista usa somente o resumo autorizado; não presume procedimentos ou animais atendidos. */
export function ConsultaVisitas({ visitas, propriedades, podeLancar, sitioSelecionado, onAbrir }: {
  visitas: VisitaResumo[];
  propriedades: { id: number; nome: string }[];
  podeLancar: boolean;
  sitioSelecionado: boolean;
  onAbrir: (id: string) => void;
}) {
  if (!visitas.length) return <Empty><strong className="block font-semibold text-foreground">{sitioSelecionado ? "Nenhuma visita neste sítio." : "Nenhuma visita nos sítios disponíveis."}</strong><p className="mt-2">{podeLancar ? "Use Nova visita para organizar os animais e preparar o atendimento." : "As visitas preparadas para os sítios aos quais você tem acesso aparecerão aqui."}</p></Empty>;
  const grupos = [
    { nome: "Visitas em aberto", itens: visitas.filter(v => v.status !== "ENCERRADA"), encerradas: false },
    { nome: "Visitas encerradas", itens: visitas.filter(v => v.status === "ENCERRADA"), encerradas: true },
  ];
  return <div className="consulta-visitas">{grupos.filter(g => g.itens.length).map(grupo => <section key={grupo.nome} aria-label={grupo.nome} className={grupo.encerradas ? "visitas-grupo visitas-grupo-historico" : "visitas-grupo"}>
    <header className="visitas-grupo-cabecalho"><h2>{grupo.nome}</h2><span>{grupo.itens.length} {grupo.itens.length === 1 ? "visita" : "visitas"}</span></header>
    <div className="consulta-visitas-grade">{grupo.itens.map(visita => {
      const [ano, mes, dia] = visita.data.slice(0, 10).split("-");
      const mesNome = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mes) - 1];
      const situacao = visita.status === "ABERTA" ? "Aberta" : visita.status === "ENCERRADA" ? "Encerrada" : visita.status === "PARCIAL" ? "Em andamento" : visita.status;
      return <button type="button" className="consulta-visita" key={visita.id} onClick={() => onAbrir(visita.id)}>
        <time className="consulta-visita-data" dateTime={visita.data.slice(0, 10)} aria-label={dataBR(visita.data)}><CalendarDays size={17} aria-hidden/><strong>{dia}</strong><span>{mesNome} {ano}</span></time>
        <span className="consulta-visita-conteudo"><span className="consulta-visita-identidade"><strong>{visita.nome}</strong><Pill tone={grupo.encerradas ? "neutral" : "amber"}>{situacao}</Pill></span>
          <span className="consulta-visita-fatos"><span><MapPin size={16} aria-hidden/>{propriedades.find(p => p.id === visita.propriedadeId)?.nome ?? "Sítio não informado"}</span><span><UserRound size={16} aria-hidden/>{visita.responsavel || "Responsável não informado"}</span></span>
          <span className="consulta-visita-abrir">{grupo.encerradas ? "Consultar visita" : podeLancar ? "Abrir atendimento" : "Consultar visita"}<ChevronRight size={16} aria-hidden/></span>
        </span>
      </button>;
    })}</div>
  </section>)}</div>;
}
