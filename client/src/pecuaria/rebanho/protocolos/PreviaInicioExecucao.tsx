import { useEffect, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { horarioIatf } from "../reproducao/CampoDataIatf";
import { reqProtocolo } from "./api";
type Previa = { exigeCiencia: boolean; modoLegado: boolean; itens: Array<{ id: string; nome: string; previstaAnterior: string; previstaNova: string; precisaoAnterior: "DIA" | "HORA"; precisaoNova: "DIA" | "HORA"; previsaoPendente: boolean; previsaoPendenteAnterior: boolean }>; total: number; pagina: number; porPagina: number };
export function usePreviaInicioExecucao(tarefaId: string, propriedadeId: number | null, realizadaEm: string, cienciaInicial = false) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [ciencia, setCiencia] = useState(cienciaInicial);
  useEffect(() => { setCiencia(cienciaInicial); setPagina(1); }, [tarefaId, propriedadeId, realizadaEm]);
  useEffect(() => { let vivo = true; setPrevia(null); setErro(null); if (!realizadaEm || !propriedadeId) return; const q = new URLSearchParams({ realizadaEm, pagina: String(pagina), porPagina: "10" }); reqProtocolo<Previa>(`/tarefas/${encodeURIComponent(tarefaId)}/previa-execucao?${q}`, propriedadeId).then(p => { if (vivo) setPrevia(p); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [tarefaId, propriedadeId, realizadaEm, pagina]);
  const conteudo = <><ErrorBox erro={erro} />{realizadaEm && !previa && !erro && <p role="status">Conferindo efeito no calendário…</p>}{previa && (previa.exigeCiencia ? <section className="grid gap-3 rounded-lg border border-border p-3" aria-label="Impacto no calendário legado"><h3 className="font-semibold">Alteração do calendário legado</h3><p>A primeira execução confirma o início e recalcula estas tarefas pendentes. Registros já realizados serão preservados.</p>{previa.itens.map(i => <p key={i.id}><strong>{i.nome}</strong> · {i.previsaoPendenteAnterior ? "Previsão anterior a definir" : horarioIatf(i.previstaAnterior, i.precisaoAnterior)} → {i.previsaoPendente ? "Nova previsão a definir" : horarioIatf(i.previstaNova, i.precisaoNova)}</p>)}{previa.total > 10 && <Paginacao paginaAtual={previa.pagina} totalPaginas={Math.ceil(previa.total / 10)} totalItens={previa.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="tarefas recalculadas" idSelect={`previa-inicio-${tarefaId}`} />}<label className="flex gap-2"><input type="checkbox" checked={ciencia} onChange={e => setCiencia(e.target.checked)} />Conferi e autorizo o recálculo das tarefas pendentes deste calendário legado.</label></section> : <p className="text-sm text-ink-3">Esta execução preserva as previsões das demais tarefas.</p>)}</>;
  return { conteudo, ciencia, podeConfirmar: !!previa && (!previa.exigeCiencia || ciencia) && !erro };
}
