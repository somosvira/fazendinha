import { Fragment, type ReactNode } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Button, ErrorBox, Pill } from "../../../financeiro/financeiro-ui";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Paginacao } from "../ui";
import "./protocolos.css";

export type EtapaApresentacao = { id: string; nome: string; referencia: string; previsao: string; resumo: string };
export type LinhaProtocolo = { id: string; identificacao: string; href: string; situacao: string; realizada: string; excecaoPrevisao?: string };
export type PaginaProtocolo<T> = { itens: T[]; total: number; pagina: number; porPagina: number };
type Props<T extends LinhaProtocolo> = {
  individual?: boolean; referencia: string; etapas: PaginaProtocolo<EtapaApresentacao> | null;
  etapaId: string; aoSelecionarEtapa: (id: string) => void; aoPaginarEtapas: (pagina: number) => void;
  tarefas: PaginaProtocolo<T> | null; aoPaginar: (pagina: number) => void;
  busca: string; aoBuscar: (busca: string) => void; pendentes: boolean; aoFiltrarPendentes: (valor: boolean) => void;
  totalEtapa?: number; pendentesEtapa?: number; erro?: string | null; aoTentarNovamente: () => void;
  acoes?: ReactNode; acoesLinha: (tarefa: T) => ReactNode; detalhesLinha: (tarefa: T) => ReactNode;
  expandida?: string | null; atendimento?: ReactNode;
};

/** Uma única tabela consulta a etapa selecionada; filtros e paginação pertencem ao servidor. */
export function EtapasProtocolo<T extends LinhaProtocolo>({ individual, referencia, etapas, etapaId, aoSelecionarEtapa, aoPaginarEtapas, tarefas, aoPaginar, busca, aoBuscar, pendentes, aoFiltrarPendentes, totalEtapa, pendentesEtapa, erro, aoTentarNovamente, acoes, acoesLinha, detalhesLinha, expandida, atendimento }: Props<T>) {
  return <SecaoRecolhivel titulo={individual ? "Etapas desta participação" : "Etapas e animais"} resumo={referencia} acoes={acoes} recolherAposAcoes className="protocolo-operacao">
    {erro && <div className="p-4"><ErrorBox erro={erro} /><Button secondary onClick={aoTentarNovamente}>Tentar novamente</Button></div>}
    {!etapas && !erro && <p role="status">Carregando etapas…</p>}
    {etapas && <><div className="protocolo-etapas" role="group" aria-label="Etapas do protocolo">{etapas.itens.map(e => <button type="button" key={e.id} aria-label={`${e.referencia} ${e.nome} · ${e.previsao} · ${e.resumo}`} aria-pressed={e.id === etapaId} onClick={() => aoSelecionarEtapa(e.id)}><small>{e.referencia}</small><strong>{e.nome}</strong><span>{e.previsao}</span><small>{e.resumo}</small></button>)}</div>{etapas.total > etapas.porPagina && <Paginacao paginaAtual={etapas.pagina} totalPaginas={Math.ceil(etapas.total / etapas.porPagina)} totalItens={etapas.total} itensPorPagina={etapas.porPagina} onPaginaChange={aoPaginarEtapas} rotulo="etapas" idSelect="protocolo-pagina-etapas" />}{!etapas.total && <p className="p-4">Nenhuma etapa disponível neste contexto.</p>}</>}
    {etapaId && <><div className="protocolo-filtros"><div role="group" aria-label="Filtrar tarefas da etapa" className="flex gap-2"><Button secondary={pendentes} onClick={() => aoFiltrarPendentes(false)} aria-pressed={!pendentes}>Todos{totalEtapa != null ? ` (${totalEtapa})` : ""}</Button><Button secondary={!pendentes} onClick={() => aoFiltrarPendentes(true)} aria-pressed={pendentes}>Pendentes{pendentesEtapa != null ? ` (${pendentesEtapa})` : ""}</Button></div>{!individual && <label className="text-sm">Buscar animal<input className={classeInput} type="search" value={busca} onChange={e => aoBuscar(e.target.value)} placeholder="Brinco ou nome" /></label>}</div>
      {!tarefas && !erro && <p role="status">Consultando tarefas da etapa…</p>}
      {tarefas && <><div className="protocolo-tabela"><table aria-label={individual ? "Tarefas da participação" : "Animais da etapa selecionada"}><thead><tr><th>{individual ? "Etapa" : "Animal"}</th><th>Situação</th><th>Data realizada</th><th>Ações</th></tr></thead><tbody>{tarefas.itens.map(t => <Fragment key={t.id}><tr id={`protocolo-tarefa-${t.id}`}><td data-label={individual ? "Etapa" : "Animal"}><a href={t.href}>{t.identificacao}</a>{t.excecaoPrevisao && <small className="block">Previsão individual: {t.excecaoPrevisao}</small>}</td><td data-label="Situação"><Pill tone={t.situacao === "Atendido" ? "green" : ["Não atendido", "Adiado"].includes(t.situacao) ? "amber" : t.situacao === "A regularizar" ? "red" : "neutral"}>{t.situacao}</Pill></td><td data-label="Data realizada">{t.realizada}</td><td data-label="Ações"><div className="flex flex-wrap gap-2">{acoesLinha(t)}</div></td></tr>{expandida === t.id && <tr className="protocolo-detalhe-linha"><td colSpan={4}>{detalhesLinha(t)}</td></tr>}</Fragment>)}</tbody></table></div>{!tarefas.total && <p className="p-4">{busca ? "Nenhum animal corresponde à busca." : pendentes ? "Nenhuma pendência nesta etapa." : "Nenhuma tarefa nesta etapa."}</p>}<Paginacao paginaAtual={tarefas.pagina} totalPaginas={Math.max(1, Math.ceil(tarefas.total / tarefas.porPagina))} totalItens={tarefas.total} itensPorPagina={tarefas.porPagina} onPaginaChange={aoPaginar} rotulo={individual ? "tarefas" : "animais"} idSelect="protocolo-pagina-tarefas" /></>}
    </>}{atendimento}
  </SecaoRecolhivel>;
}
