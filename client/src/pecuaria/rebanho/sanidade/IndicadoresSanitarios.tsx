import type { CarenciaAnimal } from "./api";
import type { ContagensRodada } from "./rodadas-api";
import { resumoCarencia } from "./carenciaRotulos";
import { Clock3, CircleCheck, CircleHelp, CircleMinus, TriangleAlert } from "lucide-react";
import { dataHoraSanitaria } from "./rotulos";

export function EstadoSanitario({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "verde" | "atencao" | "alerta" }) {
  return <span className={`pec-estado pec-estado-${tom}`}>{children}</span>;
}

export function rotuloTarefaSanitaria(situacao: string, previstaPara: string, hoje: string): string {
  if (situacao === "REALIZADA") return "Realizada";
  if (situacao === "DISPENSADA") return "Dispensada";
  if (situacao === "EXECUCAO_CANCELADA") return "Execução cancelada";
  if (situacao === "PENDENTE") return previstaPara.slice(0, 10) < hoje ? "Atrasada" : "Pendente";
  return situacao;
}

export function CarenciaIndicador({ estado, agora, revisao = false }: { estado: CarenciaAnimal["leite"]; agora: number; revisao?: boolean }) {
  const tom = revisao || estado.estado === "NAO_INFORMADO" ? "alerta"
    : estado.estado === "CONHECIDO" ? (!estado.prazoZero && new Date(estado.ate).getTime() > agora ? "atencao" : "verde") : "neutro";
  return <EstadoSanitario tom={tom}>{revisao ? "Aplicabilidade pendente — revisar" : resumoCarencia(estado, agora)}</EstadoSanitario>;
}

/** Prazo e situação separados para facilitar a conferência da lista. */
export function PrazoCarencia({ estado, agora, revisao = false }: { estado: CarenciaAnimal["leite"]; agora: number; revisao?: boolean }) {
  const vigente = estado.estado === "CONHECIDO" && !estado.prazoZero && new Date(estado.ate).getTime() > agora;
  const Icone = revisao ? TriangleAlert : estado.estado === "NAO_INFORMADO" ? CircleHelp : vigente ? Clock3 : estado.estado === "CONHECIDO" ? CircleCheck : CircleMinus;
  const titulo = revisao ? "Revisar aplicabilidade" : estado.estado === "NAO_INFORMADO" ? "Prazo desconhecido" : estado.estado === "NENHUMA" ? "Sem aplicações válidas" : estado.estado === "NAO_APLICAVEL" ? "Não se aplica" : estado.estado === "CONHECIDO" && estado.prazoZero ? "Prazo zero confirmado" : vigente ? "Carência vigente" : "Carência encerrada";
  const tom = revisao || estado.estado === "NAO_INFORMADO" ? "alerta" : vigente ? "atencao" : estado.estado === "CONHECIDO" ? "verde" : "neutro";
  return <div className={`sanidade-prazo sanidade-prazo-${tom}`}>
    <span className="sanidade-prazo-titulo"><Icone size={15} aria-hidden="true" />{titulo}</span>
    {estado.estado === "CONHECIDO" && !estado.prazoZero && <small style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>{vigente ? "Até" : "Encerrada em"} {estado.precisaoAproximada ? "≈ " : ""}{dataHoraSanitaria(estado.ate)}</small>}
    {revisao && <small>Finalidade alterada · conferir no histórico</small>}
    {estado.estado === "NAO_INFORMADO" && !revisao && <small>Consultar aplicação e revisar o prazo</small>}
    {estado.estado === "NAO_APLICAVEL" && !revisao && <small>Aplicabilidade confirmada</small>}
  </div>;
}

export function ContagensEtapa({ contagens: c, compacto = false }: { contagens: ContagensRodada; compacto?: boolean }) {
  const visiveis = ([["previstas", "prevista", c.total], ["pendentes", "pendente", c.pendentes], ["realizadas", "realizada", c.realizadas], ["dispensadas", "dispensada", c.dispensadas], ["atrasadas", "atrasada", c.atrasadas], ["canceladas", "cancelada", c.canceladas ?? 0]] as const).filter(([, , qtd]) => qtd > 0);
  if (compacto) return <div className="pec-contagens-etapa pec-contagens-etapa-compactas" aria-label={visiveis.map(([plural, singular, qtd]) => `${qtd} ${qtd === 1 ? singular : plural}`).join(" · ") || "Sem tarefas"}>{visiveis.map(([plural, singular, qtd]) => <span key={plural}><strong>{qtd}</strong> {qtd === 1 ? singular : plural}</span>)}{c.total === 0 && <small>Sem tarefas</small>}</div>;
  return <div className="pec-contagens-etapa" aria-label={`${c.total} previstas · ${c.pendentes} pendentes · ${c.realizadas} realizadas · ${c.dispensadas} dispensadas · ${c.atrasadas} atrasadas · ${c.canceladas ?? 0} canceladas`}><span><strong>{c.total}</strong> previstas</span><span><strong>{c.pendentes}</strong> pendentes</span><span><strong>{c.realizadas}</strong> realizadas</span><span><strong>{c.dispensadas}</strong> dispensadas</span><span><strong>{c.atrasadas}</strong> atrasadas</span><span><strong>{c.canceladas ?? 0}</strong> canceladas</span></div>;
}

export function ResumoPaginaSanitaria({ itens }: { itens: Array<{ nome: string; qtd: number }> }) {
  return <div className="pec-resumo-sanitario-inline" aria-label="Resumo da página sanitária">{itens.map(i => <span key={i.nome}><strong>{i.qtd}</strong> {i.nome}</span>)}</div>;
}
