import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { consultaProtocolo, reqProtocolo } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";
type Versao = { id: string; nome: string; versao: number };
export function SeletorVersaoProtocolo({ tipo, valor, onChange, propriedadeId, fixa, invalido, rotulo = "Protocolo publicado" }: { tipo: "SANITARIO" | "REPRODUTIVO"; valor: string; onChange: (id: string) => void; propriedadeId?: number; fixa?: Versao; invalido?: boolean; rotulo?: string }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaProtocolo<Versao> | null>(null);
  const [escolhida, setEscolhida] = useState<Versao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => { if (fixa) return; let vivo = true; setDados(null); setErro(null); reqProtocolo<PaginaProtocolo<Versao>>(`/versoes${consultaProtocolo({ tipo, busca, pagina })}`, propriedadeId).then(p => { if (vivo) setDados(p); }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }); return () => { vivo = false; }; }, [tipo, busca, pagina, propriedadeId, tentativa, fixa?.id]);
  const itens = fixa ? [fixa] : dados?.itens ?? [];
  return <div className="grid gap-2">{!fixa && <label className="text-sm">Buscar protocolo publicado<input className={classeInput} type="search" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>}<label>{rotulo}<select required disabled={!!fixa} aria-invalid={invalido || undefined} className={classeInput} value={valor} onChange={e => { setEscolhida(itens.find(i => i.id === e.target.value) ?? null); onChange(e.target.value); }}><option value="">Selecione</option>{escolhida && escolhida.id === valor && !itens.some(i => i.id === valor) && <option value={escolhida.id}>{escolhida.nome} · v{escolhida.versao}</option>}{itens.map(i => <option value={i.id} key={i.id}>{i.nome} · v{i.versao}</option>)}</select></label>{erro && <><ErrorBox erro={erro} /><Button secondary onClick={() => setTentativa(v => v + 1)}>Atualizar versões</Button></>}{!fixa && !dados && !erro && <p role="status">Consultando versões publicadas…</p>}{dados && !dados.total && <p>Nenhuma versão publicada corresponde à busca.</p>}{!fixa && dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="versões publicadas" idSelect={`versoes-${tipo}`} />}</div>;
}
