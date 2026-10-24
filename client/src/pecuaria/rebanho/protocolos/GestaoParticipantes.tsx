import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Paginacao } from "../ui";
import { consultaProtocolo, reqProtocolo } from "./api";
import type { ParticipanteIatf } from "../reproducao/Iatf";
import type { PaginaProtocolo } from "./EtapasProtocolo";
type Participante = Omit<ParticipanteIatf, "tarefas">;
export function GestaoParticipantes({ id, propriedadeId, podeLancar, revisao, aoRetirar }: { id: string; propriedadeId?: number; podeLancar: boolean; revisao: number; aoRetirar: (id: string) => void }) {
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaProtocolo<Participante> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { let vivo = true; setDados(null); setErro(null); reqProtocolo<PaginaProtocolo<Participante>>(`/programacoes/${encodeURIComponent(id)}/participantes${consultaProtocolo({ pagina, busca })}`, propriedadeId).then(d => { if (vivo) setDados(d); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [id, propriedadeId, pagina, busca, revisao, tentativa]);
  return <SecaoRecolhivel titulo="Gestão das participações" abertaInicial={false}><div className="grid gap-3"><label className="text-sm">Buscar participação<input className={classeInput} type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>{erro ? <><ErrorBox erro={erro} /><Button secondary onClick={() => setTentativa(v => v + 1)}>Atualizar participações</Button></> : !dados ? <p role="status">Consultando participantes…</p> : <>{dados.itens.map(p => <article key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><a className="underline" href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}?participacaoId=${encodeURIComponent(p.id)}&programacaoId=${encodeURIComponent(id)}${propriedadeId != null ? `&sitio=${propriedadeId}` : ""}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#reproducao`}>{p.animal?.brinco ?? p.animalId}</a><p>{p.encerradoEm ? "Encerrada" : p.inicioEfetivo ? "Iniciada" : "Prevista"}{p.motivoEncerramento ? ` · ${p.motivoEncerramento}` : ""}</p>{podeLancar && !p.encerradoEm && <Button secondary onClick={() => aoRetirar(p.id)}>Retirar participação</Button>}</article>)}{!dados.total && <p>Nenhuma participação corresponde à busca.</p>}<Paginacao paginaAtual={dados.pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} totalItens={dados.total} itensPorPagina={dados.porPagina} onPaginaChange={setPagina} rotulo="participações" idSelect={`gestao-${id}`} /></>}</div></SecaoRecolhivel>;
}
