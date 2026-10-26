import type { MouseEvent, ReactNode } from "react";
import { Pill } from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import type { CabecalhoProtocolo } from "../protocolos/api";
import type { SnapshotRelatorioPartos } from "./RelatorioPartos";
import { horarioIatf } from "./CampoDataIatf";
import { navegarConsultaComSitio, urlConsultaComSitio } from "./contexto-consulta";
import "./reproducao-consultas.css";

/** Navegação mantém nova aba, cliques modificados e o sítio da consulta. */
export function LinkReproducao({ href, sitio, children, botao = false, aoAbrir }: { href: string; sitio?: number; children: ReactNode; botao?: boolean; aoAbrir?: () => void }) {
  const destino = urlConsultaComSitio(href, sitio);
  function abrir(e: MouseEvent<HTMLAnchorElement>) {
    e.stopPropagation();
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (aoAbrir) aoAbrir(); else navegarConsultaComSitio(href, sitio);
  }
  return <a href={destino} onClick={abrir} className={botao ? "reproducao-link-botao" : "reproducao-identificacao"}>{children}</a>;
}
export function IdentificacaoReproducao({ id, brinco, nome, sitio }: { id: string; brinco: string | null; nome?: string | null; sitio: number }) {
  return <LinkReproducao href={`/pecuaria/rebanho/animais/${id}#reproducao`} sitio={sitio}><strong>{brinco ?? "Sem brinco"}</strong>{nome && <span>{nome}</span>}</LinkReproducao>;
}
export function CartaoProtocoloReprodutivo({ grupo: p, sitio, aoAbrir }: { grupo: CabecalhoProtocolo; sitio?: number; aoAbrir: () => void }) {
  const href = `/pecuaria/reproducao/programacoes/${encodeURIComponent(p.id)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  return <article className="reproducao-cartao"><header><div><h2><LinkReproducao href={href} sitio={sitio} aoAbrir={aoAbrir}>{p.nome}</LinkReproducao></h2><p>{p.protocolo.nome} · versão {p.protocolo.versao}</p></div><Pill>{p.status === "ABERTA" ? "Aberta" : p.status === "ENCERRADA" ? "Encerrada" : "A conferir"}</Pill></header><dl><div><dt>Início previsto</dt><dd>{horarioIatf(p.inicioReferencia, p.precisaoTemporal)}</dd></div><div><dt>Participantes</dt><dd>{p.participantesTotal ?? "Não informado"}</dd></div></dl><div className="reproducao-cartao-acompanhamento"><span>Procedimentos</span><strong>{p.contagens.atendidos} atendidos · {p.contagens.pendentes} pendentes</strong></div><footer><LinkReproducao href={href} sitio={sitio} aoAbrir={aoAbrir} botao>Abrir acompanhamento</LinkReproducao></footer></article>;
}
export function CartaoParto({ parto: p, sitio }: { parto: SnapshotRelatorioPartos["partos"][number]; sitio: number }) {
  return <article className="reproducao-cartao"><header><div><IdentificacaoReproducao id={p.matriz.id} brinco={p.matriz.brinco} nome={p.matriz.nome} sitio={sitio}/><p>Parto em {formatBRDateISO(p.data)}</p></div><Pill>{p.desfecho === "ABORTO" ? "Aborto" : p.desfecho === "NASCIMENTO" ? "Nascimento" : "Não informado"}</Pill></header><dl><div><dt>Crias</dt><dd>{p.crias.length} · {p.crias.filter(c => c.viva).length} vivas</dd></div><div><dt>Retenção de placenta</dt><dd>{p.retencaoPlacenta === null ? "Não informado" : p.retencaoPlacenta ? "Sim" : "Não"}</dd></div></dl><div className="reproducao-cartao-acompanhamento"><span>Registros da matriz</span><strong>{p.escoresMatriz.length} escores · {p.pesosMatriz.length} pesagens vinculadas</strong></div><footer><LinkReproducao botao sitio={sitio} href={`/pecuaria/reproducao/partos/${p.id}?retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Ver parto e pós-parto</LinkReproducao></footer></article>;
}
