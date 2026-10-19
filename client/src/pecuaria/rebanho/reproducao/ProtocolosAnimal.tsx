import { useEffect, useState } from "react";
import { Paginacao } from "../ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Button } from "../../../components/ui/button";
import { Pill } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { horarioIatf } from "./CampoDataIatf";
import { consultaProtocolo, reqProtocolo } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";

export type VinculoColetivoAnimal = { id: string; animalId: string; protocolo: { id: string; nome: string; versao: number }; programacao: { id: string; nome: string }; inicioReferencia: string; inicioEfetivo: string | null; precisaoTemporal?: "DIA" | "HORA"; precisaoInicioEfetivo?: "DIA" | "HORA" | null; encerradoEm: string | null; motivoEncerramento: string | null };
export function ProtocolosAnimal({ animalId, propriedadeId, revisao = 0 }: { animalId: string; propriedadeId?: number | null; revisao?: number }) {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaProtocolo<VinculoColetivoAnimal> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [selecionada, setSelecionada] = useState<VinculoColetivoAnimal | null>(null);
  const params = new URLSearchParams(window.location.search);
  const selecionadaId = window.location.hash === "#reproducao" && params.has("programacaoId") ? params.get("participacaoId") : null;
  useEffect(() => { let vivo = true; setDados(null); setErro(null); reqProtocolo<PaginaProtocolo<VinculoColetivoAnimal>>(`/vinculos-coletivos${consultaProtocolo({ animalId, tipo: "REPRODUTIVO", pagina, busca })}`, propriedadeId ?? undefined).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, propriedadeId, pagina, busca, tentativa, revisao]);
  useEffect(() => { let vivo = true; setSelecionada(null); if (selecionadaId) reqProtocolo<PaginaProtocolo<VinculoColetivoAnimal>>(`/vinculos-coletivos${consultaProtocolo({ animalId, tipo: "REPRODUTIVO", participacaoId: selecionadaId, pagina: 1 })}`, propriedadeId ?? undefined).then(d => { if (vivo) setSelecionada(d.itens.find(p => p.id === selecionadaId && p.animalId === animalId) ?? null); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [animalId, propriedadeId, selecionadaId, revisao]);
  useEffect(() => { if (!selecionada) return; document.getElementById("protocolos-reprodutivos-animal")?.dispatchEvent(new Event("revelar-secao")); requestAnimationFrame(() => document.getElementById(`participacao-protocolo-${selecionada.id}`)?.scrollIntoView?.({ block: "center" })); }, [selecionada]);
  const cartao = (p: VinculoColetivoAnimal, destaque = false) => {
    const url = `/pecuaria/reproducao/programacoes/${encodeURIComponent(p.programacao.id)}?retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}${propriedadeId != null ? `&sitio=${propriedadeId}` : ""}`;
    return <article id={`participacao-protocolo-${p.id}`} className={`protocolo-animal-card ${destaque ? "ring-2 ring-primary bg-muted/30" : ""}`} key={p.id} aria-label={destaque ? "Participação selecionada" : undefined}><header className="protocolo-animal-cabecalho"><div><h3>{p.protocolo.nome} · v{p.protocolo.versao}</h3><Pill tone={p.encerradoEm ? "neutral" : "green"}>{p.encerradoEm ? "Participação encerrada" : p.inicioEfetivo ? "Em acompanhamento" : "Início previsto"}</Pill></div><Button variant="outline" asChild><a href={url} onClick={e => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara(url); } }}>Ver programação</a></Button></header><dl className="protocolo-animal-resumo"><div><dt>Programação</dt><dd>{p.programacao.nome}</dd></div><div><dt>Início efetivo</dt><dd>{p.inicioEfetivo ? horarioIatf(p.inicioEfetivo, p.precisaoInicioEfetivo ?? p.precisaoTemporal ?? "HORA") : "Não confirmado"}</dd></div></dl>{destaque && <p className="text-sm font-semibold">Participação selecionada a partir do protocolo.</p>}</article>;
  };
  return <div className="grid gap-3">{selecionada && cartao(selecionada, true)}<label className="text-sm">Buscar protocolo coletivo<input className={classeInput} type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>{erro && <><ErrorBox erro={erro}/><Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Atualizar protocolos coletivos</Button></>}{!dados && !erro && <p role="status">Carregando protocolos coletivos…</p>}{dados && <>{dados.itens.filter(p => p.id !== selecionada?.id).map(p => cartao(p))}{!dados.total && <p className="text-ink-3">Nenhuma participação coletiva corresponde a este contexto e busca.</p>}{dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="participações coletivas" idSelect="protocolos-coletivos-animal" />}</>}</div>;
}
