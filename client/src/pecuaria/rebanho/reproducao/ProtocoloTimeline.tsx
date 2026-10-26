import { Check, Circle, Clock3 } from "lucide-react";
import { getHojeISO } from "../../../lib/hoje";
import { horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import type { ParticipanteIatf, TarefaIatf } from "./Iatf";
import "./protocolo-timeline.css";

/** Regularização e precisão desconhecida nunca viram conclusão ou atraso presumido. */
export function estadoEtapa(t: TarefaIatf, p: ParticipanteIatf): string {
  if (t.regularizacaoPendente) return "Regularização pendente";
  if (t.historicoRegularizacao?.at(-1)?.acao === "ENCERRAR_SEM_SUBSTITUICAO") return "Encerrada sem substituição";
  if (t.dispensadaEm) return "Dispensada";
  if (t.realizadaEm) return "Concluída";
  if (p.encerradoEm) return "Participação encerrada";
  if (t.situacaoOperacional === "NAO_ATENDIDO") return "Não atendido";
  if (t.situacaoOperacional === "ADIADO") return "Adiado";
  if (t.previsaoPendente) return "Previsão a definir";
  if (!p.inicioEfetivo) return "Aguardando início";
  const atrasada = t.precisaoTemporal === "DIA" || t.previstaEm.length === 10
    ? inputHorarioIatf(t.previstaEm, t.precisaoTemporal).slice(0, 10) < getHojeISO()
    : new Date(t.previstaEm).getTime() < Date.now();
  return atrasada ? "Atrasada" : "Pendente";
}
export function proximaEtapa(p: ParticipanteIatf) {
  if (p.encerradoEm) return undefined;
  return [...p.tarefas].filter(t => !t.realizadaEm && !t.dispensadaEm && !t.regularizacaoPendente && t.historicoRegularizacao?.at(-1)?.acao !== "ENCERRAR_SEM_SUBSTITUICAO")
    .sort((a, b) => Number(!!a.previsaoPendente) - Number(!!b.previsaoPendente) || a.previstaEm.localeCompare(b.previstaEm) || (a.etapa ?? 0) - (b.etapa ?? 0))[0];
}
export function ProtocoloTimeline({ participante }: { participante: ParticipanteIatf }) {
  const etapas = [...participante.tarefas].sort((a, b) => (a.etapa ?? 0) - (b.etapa ?? 0));
  return <div className="protocolo-timeline-scroll"><ol className="protocolo-timeline" aria-label="Etapas da participação">
    <li data-estado={participante.inicioEfetivo ? "Concluída" : "Pendente"}><span className="protocolo-timeline-marca">{participante.inicioEfetivo ? <Check size={18} aria-hidden="true"/> : <Circle size={18} aria-hidden="true"/>}</span><strong>Início efetivo</strong><span>{participante.inicioEfetivo ? horarioIatf(participante.inicioEfetivo, participante.precisaoInicioEfetivo ?? "HORA") : "Não confirmado"}</span></li>
    {etapas.map(t => { const estado = estadoEtapa(t, participante); return <li key={t.id} data-estado={estado}><span className="protocolo-timeline-marca">{estado === "Concluída" ? <Check size={18} aria-hidden="true"/> : estado === "Atrasada" ? <Clock3 size={18} aria-hidden="true"/> : <Circle size={18} aria-hidden="true"/>}</span><strong>{t.nome ?? t.planejadoSnapshot?.etapa.nome ?? t.tipo}</strong><span>{estado}</span><span>{t.realizadaEm && estado === "Concluída" ? horarioIatf(t.realizadaEm, t.precisaoRealizacao ?? t.realizadoSnapshot?.precisaoRealizacao ?? "HORA") : t.previsaoPendente ? "Horário de referência desconhecido" : `Previsto: ${horarioIatf(t.previstaEm, t.precisaoTemporal)}`}</span>{t.motivoOperacional && <span>{t.motivoOperacional}</span>}</li>; })}
  </ol></div>;
}
