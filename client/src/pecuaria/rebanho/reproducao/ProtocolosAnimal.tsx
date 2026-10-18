import { ChevronDown, ClipboardList } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Pill } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { horarioIatf } from "./CampoDataIatf";
import type { ProgramacaoIatf } from "./Iatf";
import { estadoEtapa, proximaEtapa, ProtocoloTimeline } from "./ProtocoloTimeline";

export function ProtocolosAnimal({ programacoes, animalId, propriedadeId }: { programacoes: ProgramacaoIatf[]; animalId: string; propriedadeId?: number | null }) {
  const participacoes = programacoes.flatMap(programacao => programacao.participantes.filter(p => p.animalId === animalId).map(participante => ({ programacao, participante })));
  if (!participacoes.length) return <p className="text-ink-3">Nenhuma participação em protocolo reprodutivo registrada neste contexto. Uma IA avulsa não comprova participação em IATF.</p>;
  return <>{participacoes.map(({ programacao: g, participante: p }) => {
    const proxima = proximaEtapa(p);
    const encerrada = !!p.encerradoEm;
    const concluidas = p.tarefas.filter(t => estadoEtapa(t, p) === "Concluída").length;
    const url = `/pecuaria/reproducao?rotina=programacoes&programacaoId=${encodeURIComponent(g.id)}${propriedadeId != null ? `&sitio=${propriedadeId}` : ""}`;
    return <article className="protocolo-animal-card" key={p.id}>
      <header className="protocolo-animal-cabecalho"><div><h3>{g.protocolo?.nome ?? "Protocolo reprodutivo"}{g.protocolo?.versao != null ? ` · v${g.protocolo.versao}` : " · versão não informada"}</h3><Pill tone={encerrada ? "neutral" : "green"}>{encerrada ? "Participação encerrada" : p.inicioEfetivo ? "Em acompanhamento" : "Início previsto"}</Pill></div><Button variant="outline" asChild><a href={url} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(url); } }}>Ver programação</a></Button></header>
      <dl className="protocolo-animal-resumo"><div><dt>Programação</dt><dd>{g.nome}</dd></div><div><dt>Início efetivo</dt><dd>{p.inicioEfetivo ? horarioIatf(p.inicioEfetivo, p.precisaoInicioEfetivo ?? "HORA") : "Não confirmado"}</dd></div><div><dt>Próxima atividade</dt><dd>{proxima ? <>{proxima.nome ?? proxima.tipo} · {proxima.previsaoPendente ? "previsão a definir" : horarioIatf(proxima.previstaEm, proxima.precisaoTemporal)}</> : encerrada ? "Participação encerrada" : "Sem atividade pendente"}</dd></div></dl>
      <ProtocoloTimeline participante={p}/>
      <details className="protocolo-animal-etapas"><summary><ClipboardList size={18} aria-hidden="true"/><span><strong>Etapas do protocolo</strong><small>{concluidas} de {p.tarefas.length} concluídas</small></span><ChevronDown size={18} aria-hidden="true"/></summary><ol>{p.tarefas.map(t => <li key={t.id}><strong>{t.nome ?? t.tipo} · {estadoEtapa(t, p)}</strong><p>{t.previsaoPendente ? "Previsão a definir: início sem horário conhecido" : `Previsto: ${horarioIatf(t.previstaEm, t.precisaoTemporal)}`}{t.realizadaEm && ` · Realização registrada: ${horarioIatf(t.realizadaEm, t.precisaoRealizacao ?? "HORA")}`}</p>{t.desviosSnapshot?.motivo && <p>Motivo de desvio: {t.desviosSnapshot.motivo}</p>}</li>)}</ol></details>
    </article>;
  })}</>;
}
