import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { ResultadoExame, type ExameResultado } from "../sanidade/ResultadoExame";
import { nomeCampoExame } from "../sanidade/CamposExame";
import { formatBRDateISO } from "../../../lib/hoje";
import { reqProtocolo, consultaProtocolo, type TarefaOperacional } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";
type ExameTarefa = ExameResultado & { status: string; data: string; realizacao: string; observacao: string | null; responsavel: string | null; demandaAcompanhamentoId: string | null };
export function ExamesTarefaProtocolo({ tarefa, podeLancar, onSalvo }: { tarefa: TarefaOperacional; podeLancar: boolean; onSalvo: () => void }) {
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<PaginaProtocolo<ExameTarefa> | null>(null), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true; setDados(null); setErro(null);
    reqProtocolo<PaginaProtocolo<ExameTarefa>>(`/tarefas/${encodeURIComponent(tarefa.id)}/exames${consultaProtocolo({ pagina })}`, tarefa.propriedadeId).then(p => { if (vivo) setDados(p); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [tarefa.id, tarefa.propriedadeId, pagina, revisao]);
  return <section className="grid gap-3" aria-label="Exames e acompanhamento desta tarefa"><h4 className="font-semibold">Exames e avaliações registrados</h4><ErrorBox erro={erro} />{erro && <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar carregar exames novamente</Button>}{!dados && !erro && <p role="status">Carregando exames…</p>}{dados?.itens.map(e => <article className="grid gap-2 border-t border-border pt-3 text-sm" key={e.id}><p><strong>{formatBRDateISO(e.data)}</strong> · {e.status === "ANULADO" ? "Exame anulado" : e.realizacao === "COLETA_REGISTRADA" ? "Coleta registrada, aguardando resultado" : e.realizacao === "NAO_REALIZADO" ? "Registro legado de exame não realizado" : "Exame realizado"}{e.demandaAcompanhamentoId ? " · avaliação do acompanhamento" : ""}</p>{e.resultadoTexto != null && <p>Resultado: {e.resultadoTexto}</p>}{e.resultadoNumero != null && <p>Resultado: {e.resultadoNumero} {e.formatoSnapshot.unidade}</p>}{e.resultadoOpcao != null && <p>Resultado: {e.resultadoOpcao}</p>}{e.resultados?.map(r => <p key={r.campo}>{nomeCampoExame(e.formatoSnapshot.campos?.find(c => c.codigo === r.campo) ?? { codigo: r.campo })}: {typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : String(r.valor)}</p>)}{e.observacao && <p className="break-words">Observação: {e.observacao}</p>}{e.responsavel && <p>Responsável: {e.responsavel}</p>}<a className="underline" href={tarefa.tarefaOrigem.tipo === "AVALIACAO" ? `/pecuaria/reproducao?animalId=${tarefa.animal.id}&fatoId=${e.id}&sitio=${tarefa.propriedadeId}` : `/pecuaria/sanidade?animalId=${tarefa.animal.id}&detalheTipo=exame&detalheId=${e.id}&propriedadeId=${tarefa.propriedadeId}`}>Abrir exame na ficha</a>{podeLancar && tarefa.tarefaOrigem.tipo === "EXAME" && e.status === "VALIDO" && <div className="flex gap-2"><ResultadoExame exame={e} propriedadeId={tarefa.propriedadeId} onSalvo={() => { setRevisao(v => v + 1); onSalvo(); }} /></div>}</article>)}{dados && !dados.total && <p>Nenhum exame vinculado a esta tarefa.</p>}{dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="exames da tarefa" idSelect={`exames-tarefa-${tarefa.id}`} />}</section>;
}
