import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import type { PaginaProtocolo } from "./EtapasProtocolo";
import { consultaProtocolo, reqProtocolo } from "./api";
type OrigemFato = { participacaoId: string; protocolo: { id: string; nome: string; versao: number }; programacao: { id: string; nome: string } | null };
/** Consulta os vínculos persistidos somente quando a pessoa expande a origem do fato. */
export function OrigensFatoProtocolo({ animalId, fatoId, exameId, propriedadeId }: { animalId: string; fatoId: string; exameId?: string; propriedadeId?: number }) {
  const [aberta, setAberta] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaProtocolo<OrigemFato> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { if (!aberta) return; let vivo = true; setDados(null); setErro(null); reqProtocolo<PaginaProtocolo<OrigemFato>>(`/origens-fato${consultaProtocolo({ animalId, fatoId, exameId, pagina })}`, propriedadeId).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [aberta, animalId, fatoId, exameId, propriedadeId, pagina, tentativa]);
  return <details onToggle={e => setAberta(e.currentTarget.open)}><summary>Consultar origem no protocolo</summary>{aberta && <div className="grid gap-2 py-2">{erro ? <><ErrorBox erro={erro}/><Button secondary onClick={() => setTentativa(v => v + 1)}>Tentar consultar origem novamente</Button></> : !dados ? <p role="status">Consultando origem…</p> : <>{dados.itens.map(o => <p key={`${o.participacaoId}:${o.programacao?.id ?? "individual"}`}><a className="underline" href={`/pecuaria/reproducao/${o.programacao ? `programacoes/${encodeURIComponent(o.programacao.id)}` : `participacoes/${encodeURIComponent(o.participacaoId)}`}?retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}${propriedadeId != null ? `&sitio=${propriedadeId}` : ""}`}>{o.protocolo.nome} · v{o.protocolo.versao}{o.programacao ? ` · ${o.programacao.nome}` : " · Participação individual"}</a></p>)}{!dados.total && <p>Sem vínculo registrado.</p>}{dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="vínculos de origem" idSelect={`origens-${fatoId}`}/>}</>}</div>}</details>;
}
