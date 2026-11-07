import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Button as BotaoUI } from "../../../components/ui/button";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { PainelCadastro, classeInput } from "../../../financeiro/PainelCadastro";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Paginacao } from "../ui";
import "./protocolos.css";
import { Empty } from "@/financeiro/financeiro-ui";
import { EsqueletoLista } from "../../../components/Esqueleto";

export type EtapaApresentacao = { id: string; nome: string; referencia: string; previsao: string; resumo: string };
export type LinhaProtocolo = { id: string; identificacao: string; href: string; situacao: string; realizada: string; excecaoPrevisao?: string; resultado?: string; pendencia?: string };
export type PaginaProtocolo<T> = { itens: T[]; total: number; pagina: number; porPagina: number };
type Props<T extends LinhaProtocolo> = {
  compacta?: boolean; individual?: boolean; referencia: string; etapas: PaginaProtocolo<EtapaApresentacao> | null;
  etapaId: string; aoSelecionarEtapa: (id: string) => void; aoPaginarEtapas: (pagina: number) => void;
  tarefas: PaginaProtocolo<T> | null; aoPaginar: (pagina: number) => void;
  busca: string; aoBuscar: (busca: string) => void; pendentes: boolean; aoFiltrarPendentes: (valor: boolean) => void;
  acompanhamentos?: boolean; aoFiltrarAcompanhamentos?: () => void; acompanhamentosEtapa?: number;
  totalEtapa?: number; pendentesEtapa?: number; erro?: string | null; aoTentarNovamente: () => void;
  cabecalhoEtapa?: ReactNode; tituloDetalhe?: string; acoes?: ReactNode; acoesLinha: (tarefa: T) => ReactNode; detalhesLinha: (tarefa: T) => ReactNode;
  expandida?: string | null; atendimento?: ReactNode; selecaoLinha?: (tarefa: T) => ReactNode; selecaoPagina?: ReactNode; aoFecharDetalhe?: () => void; detalheBloqueado?: boolean;
};

/** Uma única tabela consulta a etapa selecionada; filtros e paginação pertencem ao servidor. */
export function EtapasProtocolo<T extends LinhaProtocolo>({ compacta, individual, referencia, etapas, etapaId, aoSelecionarEtapa, aoPaginarEtapas, tarefas, aoPaginar, busca, aoBuscar, pendentes, aoFiltrarPendentes, acompanhamentos, aoFiltrarAcompanhamentos, acompanhamentosEtapa, totalEtapa, pendentesEtapa, erro, aoTentarNovamente, cabecalhoEtapa, tituloDetalhe, acoes, acoesLinha, detalhesLinha, expandida, atendimento, selecaoLinha, selecaoPagina, aoFecharDetalhe, detalheBloqueado }: Props<T>) {
  const faixa=useRef<HTMLDivElement>(null);
  useEffect(()=>{const grupo=faixa.current;const selecionada=grupo?.querySelector<HTMLElement>('[aria-pressed="true"]');if(grupo && selecionada && grupo.scrollWidth>grupo.clientWidth) grupo.scrollTo?.({left:selecionada.offsetLeft-(grupo.clientWidth-selecionada.offsetWidth)/2});},[etapaId,etapas]);
  return <SecaoRecolhivel titulo={individual ? "Etapas desta participação" : "Etapas e animais"} resumo={referencia} acoes={acoes} recolherAposAcoes className={`protocolo-operacao${compacta ? " protocolo-operacao-compacta" : ""}`}>
    {erro && <div className="p-4"><ErrorBox erro={erro} /><Button secondary onClick={aoTentarNovamente}>Tentar novamente</Button></div>}
    {!etapas && !erro && <EsqueletoLista label="Carregando etapas" />}
    {etapas && <><div ref={faixa} className="protocolo-etapas" role="group" aria-label="Etapas do protocolo">{etapas.itens.map(e => <button type="button" key={e.id} aria-label={`${e.referencia} ${e.nome} · ${e.previsao} · ${e.resumo}`} aria-pressed={e.id === etapaId} onClick={() => aoSelecionarEtapa(e.id)}><strong className="protocolo-etapa-titulo"><span>{e.referencia}</span> {e.nome}</strong><span>{e.previsao}</span><small>{e.resumo}</small></button>)}</div>{etapas.total > etapas.porPagina && <Paginacao paginaAtual={etapas.pagina} totalPaginas={Math.ceil(etapas.total / etapas.porPagina)} totalItens={etapas.total} itensPorPagina={etapas.porPagina} onPaginaChange={aoPaginarEtapas} rotulo="etapas" idSelect="protocolo-pagina-etapas" />}{!etapas.total && <Empty>Nenhuma etapa disponível neste contexto.</Empty>}</>}
    {etapaId && <SecaoRecolhivel recolhivel={!compacta} className={compacta ? "ficha-geral-secao protocolo-etapa-ficha" : ""} titulo={etapas?.itens.find(e=>e.id===etapaId)?.nome ?? "Etapa selecionada"} acoes={cabecalhoEtapa}><div className="protocolo-filtros">{compacta ? <SelectCampo aria-label="Situação" value={acompanhamentos ? "acompanhamentos" : pendentes ? "pendentes" : "todos"} onValueChange={v => v === "acompanhamentos" ? aoFiltrarAcompanhamentos?.() : aoFiltrarPendentes(v === "pendentes")}><option value="todos">Todos ({totalEtapa ?? 0})</option><option value="pendentes">Pendentes ({pendentesEtapa ?? 0})</option>{aoFiltrarAcompanhamentos && <option value="acompanhamentos">Acompanhamentos ({acompanhamentosEtapa ?? 0})</option>}</SelectCampo> : <div role="group" aria-label="Filtrar tarefas da etapa" className="protocolo-situacoes flex flex-wrap gap-2">
        <BotaoUI variant={pendentes || acompanhamentos ? "outline" : "default"} onClick={() => aoFiltrarPendentes(false)} aria-pressed={!pendentes && !acompanhamentos}>Todos{totalEtapa != null ? ` (${totalEtapa})` : ""}</BotaoUI>
        <BotaoUI variant={!pendentes || acompanhamentos ? "outline" : "default"} onClick={() => aoFiltrarPendentes(true)} aria-pressed={pendentes && !acompanhamentos}>Pendentes{pendentesEtapa != null ? ` (${pendentesEtapa})` : ""}</BotaoUI>
        {aoFiltrarAcompanhamentos && <BotaoUI variant={!acompanhamentos ? "outline" : "default"} aria-pressed={!!acompanhamentos} onClick={aoFiltrarAcompanhamentos}>Acompanhamentos{acompanhamentosEtapa != null ? ` (${acompanhamentosEtapa})` : ""}</BotaoUI>}
      </div>}{!individual && <label className="text-sm"><span className={compacta ? "sr-only" : undefined}>Buscar animal</span><input className={classeInput} type="search" value={busca} onChange={e => aoBuscar(e.target.value)} placeholder="Brinco ou nome" /></label>}{compacta && acoes}</div>
      {!tarefas && !erro && <p role="status">Consultando tarefas da etapa…</p>}
      {tarefas && <><div className="protocolo-tabela"><table className="protocolo-tabela-dados" aria-label={individual ? "Tarefas da participação" : "Animais da etapa selecionada"}><thead><tr>{selecaoLinha && <th className="w-12">{selecaoPagina}</th>}<th>{individual ? "Etapa" : "Animal"}</th><th>Situação</th><th>{compacta ? "Data prevista / realizada" : "Data realizada"}</th><th>Ações</th></tr></thead><tbody>{tarefas.itens.map(t => <Fragment key={t.id}><tr id={`protocolo-tarefa-${t.id}`}>{selecaoLinha && <td data-label="Selecionar">{selecaoLinha(t)}</td>}<td data-label={individual ? "Etapa" : "Animal"}><a href={t.href}>{t.identificacao}</a>{t.excecaoPrevisao && <small className="block">Previsão individual: {t.excecaoPrevisao}</small>}</td><td data-label="Situação"><Pill tone={t.situacao === "Atendido" ? "green" : ["Não atendido", "Adiado"].includes(t.situacao) ? "amber" : t.situacao === "A regularizar" ? "red" : "neutral"}>{t.situacao}</Pill>{t.resultado && <span className="mt-1 block text-sm">{t.resultado}</span>}{t.pendencia && <span className="mt-1 block text-sm text-amber-800">{t.pendencia}</span>}</td><td data-label="Data realizada">{t.realizada}</td><td data-label="Ações"><div className="flex flex-wrap gap-2">{acoesLinha(t)}</div></td></tr>{expandida === t.id && !aoFecharDetalhe && <tr className="protocolo-detalhe-linha"><td colSpan={4}>{detalhesLinha(t)}</td></tr>}</Fragment>)}</tbody></table></div>{!tarefas.total && <p className="p-4">{busca ? "Nenhum animal corresponde à busca." : acompanhamentos ? "Nenhum acompanhamento pendente nesta etapa." : pendentes ? "Nenhuma pendência nesta etapa." : "Nenhuma tarefa nesta etapa."}</p>}<Paginacao paginaAtual={tarefas.pagina} totalPaginas={Math.max(1, Math.ceil(tarefas.total / tarefas.porPagina))} totalItens={tarefas.total} itensPorPagina={tarefas.porPagina} onPaginaChange={aoPaginar} rotulo={individual ? "tarefas" : "animais"} idSelect="protocolo-pagina-tarefas" /></>}
    </SecaoRecolhivel>}{atendimento}{aoFecharDetalhe && tarefas?.itens.filter(t => t.id === expandida).map(t => <PainelCadastro key={t.id} aberto titulo={tituloDetalhe ? `${tituloDetalhe} · ${t.identificacao}` : t.identificacao} bloqueado={detalheBloqueado} rodape={<Button secondary disabled={detalheBloqueado} onClick={aoFecharDetalhe}>Fechar</Button>} onFechar={aoFecharDetalhe}>{detalhesLinha(t)}</PainelCadastro>)}
  </SecaoRecolhivel>;
}
