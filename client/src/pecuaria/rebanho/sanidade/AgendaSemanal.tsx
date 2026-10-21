import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Button, ErrorBox } from "@/financeiro/financeiro-ui";
import { reqSanidade } from "./api";
import { consultaRodadas, type PaginaSanitaria } from "./rodadas-api";
import { dataSanitaria, nomeAnimalSanitario } from "./rotulos";
import { EstadoSanitario, rotuloTarefaSanitaria } from "./IndicadoresSanitarios";

export type TarefaVisual = { id: string; etapaId: string; previstaPara: string; situacao: string; rodada?: { id: string; nome: string } | null; parametros: { tipo: string; tipoAplicacaoNomeSnapshot?: string; tipoExameNomeSnapshot?: string; produtoNomeSnapshot?: string }; execucao: { animalId: string; animal?: { id: string; brinco: string; nome: string | null }; rodada?: { id: string; nome: string } | null; protocolo: { nome: string; versao: number } } };
export const hojeSanidade = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
export function somarDiasSanitarios(data: string, dias: number) { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); }
export function inicioSemanaSanitaria(data: string) { const dia = new Date(`${data}T12:00:00Z`).getUTCDay(); return somarDiasSanitarios(data, -(dia === 0 ? 6 : dia - 1)); }
export function agruparTarefasVisuais<T extends TarefaVisual>(itens: T[]) {
  const grupos = new Map<string, { chave: string; nome: string; ciclo: string; data: string; itens: T[] }>();
  for (const t of itens) {
    const rodada = t.execucao.rodada ?? t.rodada;
    // Etapa separa procedimentos distintos do mesmo ciclo e dia; sem ciclo, a versão também participa da chave.
    const chave = JSON.stringify([t.previstaPara.slice(0, 10), rodada?.id ?? [t.execucao.protocolo.nome, t.execucao.protocolo.versao], t.etapaId]);
    const grupo = grupos.get(chave) ?? { chave, nome: t.parametros.tipoAplicacaoNomeSnapshot ?? t.parametros.tipoExameNomeSnapshot ?? (t.parametros.tipo === "APLICACAO" ? "Aplicação" : "Exame"), ciclo: rodada?.nome ?? `${t.execucao.protocolo.nome} · sem ciclo`, data: t.previstaPara.slice(0, 10), itens: [] };
    grupo.itens.push(t); grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}
type Grupo<T> = { chave: string; nome: string; ciclo: string; data: string; itens: T[] };
type Filtros = Record<string, string | number | undefined>;
function FaixaTarefas<T extends TarefaVisual>({ dia, atrasadas = false, filtros, revisao, onGrupo }: { dia: string; atrasadas?: boolean; filtros: Filtros; revisao: number; onGrupo: (grupo: Grupo<T>) => void }) {
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaSanitaria<T> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const deFiltro = String(filtros.de ?? ""); const ateFiltro = String(filtros.ate ?? "");
  const de = atrasadas ? deFiltro : dia;
  const ate = atrasadas ? (ateFiltro && ateFiltro < somarDiasSanitarios(hojeSanidade(), -1) ? ateFiltro : somarDiasSanitarios(hojeSanidade(), -1)) : dia;
  const fora = !atrasadas && (deFiltro && dia < deFiltro || ateFiltro && dia > ateFiltro) || atrasadas && !!de && de > ate;
  const consulta = consultaRodadas({ ...filtros, de, ate, situacao: atrasadas ? "ATRASADA" : filtros.situacao, pagina, porPagina: 50, paginado: "true", ordenacaoTarefas: "prioridade" });
  useEffect(() => { let vivo = true; setDados(null); setErro(null); if (fora) return; reqSanidade<PaginaSanitaria<T>>(`/tarefas${consulta}`).then(v => { if (vivo) setDados(v); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível consultar as tarefas."); }); return () => { vivo = false; }; }, [consulta, revisao, tentativa, fora]);
  const grupos = agruparTarefasVisuais(dados?.itens ?? []);
  return <section className={atrasadas ? "san-semana-atrasadas" : "san-semana-dia"} aria-label={atrasadas ? "Tarefas atrasadas" : `Tarefas de ${dataSanitaria(dia)}`}>
    <header>{atrasadas ? <><TriangleAlert size={17} aria-hidden /><h3>Atrasadas</h3></> : <div><span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`))}</span><h3 data-hoje={dia === hojeSanidade() || undefined}>{Number(dia.slice(8, 10))}</h3></div>}{dados && <span className="san-dia-contagem">{dados.total} {dados.total === 1 ? "tarefa" : "tarefas"}</span>}</header>
    {fora ? <p className="san-dia-vazio">Fora do período selecionado</p> : erro ? <div className="san-dia-erro"><ErrorBox erro={erro}/><Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></div> : !dados ? <p className="san-dia-vazio" role="status">Consultando tarefas…</p> : <>
      {dados.total > dados.porPagina && <p className="san-dia-aviso">Grupos desta página · {dados.itens.length} de {dados.total} tarefas</p>}
      {grupos.map(g => <button key={g.chave} type="button" className="san-tarefa-grupo san-tarefa-abrir" onClick={() => onGrupo(g)}><strong>{g.nome}</strong><span>{new Set(g.itens.map(t => t.execucao.animalId)).size} {new Set(g.itens.map(t => t.execucao.animalId)).size === 1 ? "animal" : "animais"} · {g.itens.length} {g.itens.length === 1 ? "tarefa" : "tarefas"}</span><small>{g.ciclo}</small>{atrasadas && <time>{dataSanitaria(g.data)}</time>}<span className="san-grupo-abrir">Ver tarefas</span></button>)}
      {!dados.total && <p className="san-dia-vazio">{atrasadas ? "Nenhuma tarefa atrasada neste recorte." : "Nenhuma tarefa neste dia."}</p>}
      {dados.total > dados.porPagina && <nav className="san-dia-paginas" aria-label={atrasadas ? "Páginas de atrasadas" : `Páginas de ${dia}`}><button type="button" disabled={pagina === 1} onClick={() => setPagina(v => v - 1)} aria-label="Página anterior"><ChevronLeft size={16}/></button><span>{pagina}/{Math.ceil(dados.total / dados.porPagina)}</span><button type="button" disabled={pagina * dados.porPagina >= dados.total} onClick={() => setPagina(v => v + 1)} aria-label="Próxima página"><ChevronRight size={16}/></button></nav>}
    </>}
  </section>;
}
export function AgendaSemanal<T extends TarefaVisual>({ filtros, revisao, ...acoes }: { filtros: Filtros; revisao: number; acoes: (t: T) => ReactNode; regularizacao: (t: T) => ReactNode; onExecutar: (itens: T[]) => void; podeLancar: boolean }) {
  const ler = () => { const valor = new URLSearchParams(window.location.search).get("semanaSanitaria"); return inicioSemanaSanitaria(valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && Number.isFinite(Date.parse(valor)) ? valor : hojeSanidade()); };
  const [inicio, setInicio] = useState(ler);
  useEffect(() => { const voltar = () => setInicio(ler()); window.addEventListener("popstate", voltar); return () => window.removeEventListener("popstate", voltar); }, []);
  function mudar(data: string) { setInicio(data); const url = new URL(window.location.href); url.searchParams.set("semanaSanitaria", data); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); }
  const contexto = consultaRodadas(filtros);
  const cabecalhoGrupo = useRef<HTMLHeadingElement>(null);
  const [grupo, setGrupo] = useState<Grupo<T> | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  useEffect(() => { setGrupo(null); setSelecionadas(new Set()); }, [contexto, inicio, revisao]);
  useEffect(()=>{if(grupo)cabecalhoGrupo.current?.focus();},[grupo]);
  function abrirGrupo(valor: Grupo<T>) { setGrupo(valor); setSelecionadas(new Set()); }

  const mostrarAtrasadas = !filtros.situacao || ["PENDENTE", "ATRASADA"].includes(String(filtros.situacao));
  return <div className="san-agenda-semanal"><div className="san-semana-navegacao"><h2>Semana de trabalho</h2><div><Button secondary aria-label="Semana anterior" onClick={() => mudar(somarDiasSanitarios(inicio,-7))}><ChevronLeft size={17}/></Button><Button secondary onClick={() => mudar(inicioSemanaSanitaria(hojeSanidade()))}>Hoje</Button><Button secondary aria-label="Próxima semana" onClick={() => mudar(somarDiasSanitarios(inicio,7))}><ChevronRight size={17}/></Button><strong>{dataSanitaria(inicio)} a {dataSanitaria(somarDiasSanitarios(inicio,6))}</strong></div></div>
    <div className={`san-semana-corpo ${mostrarAtrasadas ? "" : "san-semana-sem-atrasadas"}`}>
      {mostrarAtrasadas && <FaixaTarefas<T> key={`atrasadas-${contexto}`} dia={hojeSanidade()} atrasadas filtros={filtros} revisao={revisao} onGrupo={abrirGrupo}/>}
      <div className="san-semana-rolagem"><div className="san-semana-grade">{Array.from({length:7},(_,i)=>somarDiasSanitarios(inicio,i)).map(dia => <FaixaTarefas<T> key={`${dia}-${contexto}`} dia={dia} filtros={filtros} revisao={revisao} onGrupo={abrirGrupo}/>)}</div></div>
    </div>
    {grupo && <section className="san-semana-grupo-aberto" aria-label="Tarefas do grupo selecionado"><header><div><h3 ref={cabecalhoGrupo} tabIndex={-1}>{grupo.nome} · {dataSanitaria(grupo.data)}</h3><p>{grupo.ciclo} · {grupo.itens.length} tarefas nesta página</p></div><Button secondary onClick={()=>setGrupo(null)}>Fechar grupo</Button></header>
      {grupo.itens.map(t=><div className="san-grupo-animal" key={t.id}><div className="san-grupo-identificacao">{acoes.podeLancar && t.situacao === "PENDENTE" && <input type="checkbox" aria-label={`Selecionar tarefa de ${t.execucao.animal?.brinco ?? t.execucao.animalId}`} checked={selecionadas.has(t.id)} onChange={e=>setSelecionadas(v=>{const novo=new Set(v);if(e.target.checked)novo.add(t.id);else novo.delete(t.id);return novo;})}/>}<strong>{t.execucao.animal ? nomeAnimalSanitario(t.execucao.animal) : t.execucao.animalId}</strong></div><EstadoSanitario tom={t.situacao === "PENDENTE" ? t.previstaPara.slice(0,10) < hojeSanidade() ? "alerta" : "atencao" : t.situacao === "REALIZADA" ? "verde" : "neutro"}>{rotuloTarefaSanitaria(t.situacao,t.previstaPara,hojeSanidade())}</EstadoSanitario>{acoes.regularizacao(t)}<div className="san-grupo-acoes">{acoes.acoes(t)}</div></div>)}
      {acoes.podeLancar && selecionadas.size > 0 && <footer><Button disabled={selecionadas.size > 100} onClick={()=>acoes.onExecutar(grupo.itens.filter(t=>selecionadas.has(t.id) && t.situacao === "PENDENTE"))}>Executar selecionadas ({selecionadas.size})</Button></footer>}
    </section>}
  </div>;
}
