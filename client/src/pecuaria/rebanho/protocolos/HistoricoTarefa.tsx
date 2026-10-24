import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { horarioIatf } from "../reproducao/CampoDataIatf";
import { consultaProtocolo, reqProtocolo } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";
type Evento = { id: string; tipo: string; motivo: string; ocorridaEm: string; registradoEm: string; usuarioId: number | null; eventoCorrigidoId: string | null; previstaPara: string | null; previsaoAnterior: string | null };
const rotulos: Record<string, string> = { NAO_ATENDIDO: "Não atendimento", ADIAMENTO: "Adiamento", RETIFICACAO_JUSTIFICATIVA: "Retificação da justificativa" };
export function HistoricoTarefa({ id, propriedadeId }: { id: string; propriedadeId: number }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaProtocolo<Evento> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { let vivo = true; setDados(null); setErro(null); reqProtocolo<PaginaProtocolo<Evento>>(`/tarefas/${encodeURIComponent(id)}/eventos${consultaProtocolo({ pagina })}`, propriedadeId).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [id, propriedadeId, pagina, tentativa]);
  return <section className="grid gap-2" aria-label="Histórico da tarefa"><h4 className="font-semibold">Histórico da tarefa</h4>{erro ? <><ErrorBox erro={erro} /><Button secondary onClick={() => setTentativa(v => v + 1)}>Atualizar histórico</Button></> : !dados ? <p role="status">Consultando histórico…</p> : <>{dados.itens.map(e => <article className="border-t border-border py-2 text-sm" key={e.id}><strong>{rotulos[e.tipo] ?? e.tipo}</strong><p>{e.motivo}</p><p className="text-ink-3">Ocorrido em {horarioIatf(e.ocorridaEm)} · registrado em {horarioIatf(e.registradoEm)}{e.eventoCorrigidoId ? " · retificação de registro anterior" : ""}</p>{e.previstaPara && <p>Nova previsão: {horarioIatf(e.previstaPara, "DIA")}</p>}</article>)}{!dados.total && <p>Nenhum evento operacional registrado.</p>}{dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="eventos" idSelect={`eventos-${id}`} />}</>}</section>;
}
