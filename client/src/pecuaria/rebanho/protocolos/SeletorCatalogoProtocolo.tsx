import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useEffect, useId, useRef, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Button } from "../../../components/ui/button";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { reqProtocolo, consultaProtocolo } from "./api";
import { EsqueletoLinhas } from "../../../components/Esqueleto";
export type OpcaoCatalogoProtocolo = "PRODUTO" | "MATERIAL" | "TIPO_EXAME" | "TIPO_APLICACAO";
export type EscolhaCatalogoProtocolo = {id:string;nome:string;unidade?:string;tipo?:string;ativo?:boolean;perfilSanitario?:{viaPadrao?:string|null;orientacaoUso?:string|null;tipoAplicacaoId?:string|null}|null};
export type PaginaCatalogo = {itens:EscolhaCatalogoProtocolo[];total:number;pagina:number;porPagina:number};
export function SeletorCatalogoProtocolo({ propriedadeId, opcao, origem, rotulo, valor, tipoTentativa, somenteLeitura, listarOpcoes, erroCampo, aparencia, onChange }: {
  aparencia?: "campo";
  listarOpcoes?: (f: { pagina: number; porPagina: number; busca: string; selecionadoId?: string }) => Promise<PaginaCatalogo>;
  erroCampo?: string;
  somenteLeitura?: boolean; tipoTentativa?: "IA" | "TE"; propriedadeId?: number; opcao: OpcaoCatalogoProtocolo; origem: "SANITARIO" | "REPRODUTIVO"; rotulo: string; valor: string;
  onChange: (valor: string, opcao?: EscolhaCatalogoProtocolo) => void;
}) {
  const id = useId();
  const botaoSelecao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false), [pagina, setPagina] = useState(1), [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaCatalogo | null>(null);
  const [selecionada, setSelecionada] = useState<EscolhaCatalogoProtocolo | null>(null);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false), [revisao, setRevisao] = useState(0);
  useEffect(() => {
    if (!aberto && !valor) return;
    let vivo = true; setCarregando(true); setErro(null); setDados(null);
    const consulta = { pagina, porPagina: 10, busca, selecionadoId: !aberto ? valor : undefined };
    const pedidoBase = listarOpcoes ? listarOpcoes(consulta) : reqProtocolo<PaginaCatalogo>(`/cadastros/opcoes${consultaProtocolo({ opcao, origem, tipoTentativa, ...consulta })}`, propriedadeId);
    const pedido = async () => {
      const primeira = await pedidoBase;
      if (aparencia !== "campo" || !aberto) return primeira;
      const itens = [...primeira.itens];
      for (let proxima = 2; proxima <= Math.ceil(primeira.total / primeira.porPagina); proxima++) {
        const filtros = { ...consulta, pagina: proxima };
        const seguinte = await (listarOpcoes ? listarOpcoes(filtros) : reqProtocolo<PaginaCatalogo>(`/cadastros/opcoes${consultaProtocolo({ opcao, origem, tipoTentativa, ...filtros })}`, propriedadeId));
        if (!vivo) return primeira;
        itens.push(...seguinte.itens);
      }
      return { ...primeira, itens };
    };
    pedido().then(p => {
      if (!vivo) return; setDados(p);
      const escolha = p.itens.find(i => i.id === valor);
      if (escolha && selecionada?.id !== escolha.id) { setSelecionada(escolha); }
    }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberto, propriedadeId, opcao, origem, tipoTentativa, pagina, busca, valor, revisao, listarOpcoes, aparencia]);
  if(somenteLeitura)return <span>{selecionada?.id === valor ? selecionada.nome : erro ? "Referência indisponível" : "Consultando referência…"}</span>;
  const opcoes = <><label>Buscar {rotulo}<input type="search" className={classeInput} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>{dados && !dados.itens.length && <p className="text-sm">Nenhuma opção disponível para este catálogo.</p>}<ul className="divide-y divide-border">{dados?.itens.map(i => <li key={i.id} className="flex items-center justify-between gap-3 py-2"><span>{i.nome}{i.ativo === false ? " · Inativo" : ""}</span><Button variant="outline" type="button" aria-label={`Usar ${i.nome}`} onClick={() => { setSelecionada(i); onChange(i.id, i); setAberto(false); botaoSelecao.current?.focus(); }}>Usar</Button></li>)}</ul>{dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo={rotulo} idSelect={id} />}</>;
  if (aparencia === "campo") return <div>
    <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
    <Select open={aberto} onOpenChange={setAberto} value={valor || "__nao_selecionado__"} onValueChange={v => {
      const proximo = v === "__nao_selecionado__" ? "" : v;
      setSelecionada(dados?.itens.find(i => i.id === proximo) ?? null);
      onChange(proximo, dados?.itens.find(i => i.id === proximo));
    }}>
      <SelectTrigger id={id} ref={botaoSelecao} aria-label={rotulo} aria-invalid={!!erroCampo} aria-describedby={erroCampo ? `${id}-erro` : undefined} className={`${classeInput} flex`}><SelectValue>{valor ? selecionada?.id === valor ? selecionada.nome : "Referência indisponível" : "Não selecionado"}</SelectValue></SelectTrigger>
      <SelectContent pesquisavel={false} className="z-[1200]">
        <SelectItem data-value="__nao_selecionado__" value="__nao_selecionado__">Não selecionado</SelectItem>
        {carregando ? <SelectItem value="__carregando__" disabled>Carregando…</SelectItem> : dados?.itens.map(i => <SelectItem key={i.id} data-value={i.id} value={i.id} disabled={i.ativo === false}>{i.nome}{i.ativo === false ? " (inativo)" : ""}</SelectItem>)}
        {selecionada?.id === valor && !dados?.itens.some(i => i.id === valor) && <SelectItem value={valor} disabled>{selecionada.nome}</SelectItem>}
      </SelectContent>
    </Select>
    {erroCampo && <p id={`${id}-erro`} role="alert" className="text-xs text-destructive">{erroCampo}</p>}
    <ErrorBox erro={erro} />
    {erro && <Button variant="outline" type="button" onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button>}
  </div>;
  return <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{rotulo}: {valor ? selecionada?.id === valor ? selecionada.nome : "Referência planejada" : "Não selecionado"}</span><Button ref={botaoSelecao} variant="outline" type="button" aria-label={`Selecionar ${rotulo}`} aria-invalid={!!erroCampo} aria-describedby={erroCampo ? `${id}-erro` : undefined} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Fechar seleção" : "Selecionar"}</Button>{valor && <Button variant="outline" type="button" aria-label={`Limpar ${rotulo}`} onClick={() => { setSelecionada(null); onChange(""); botaoSelecao.current?.focus(); }}>Limpar</Button>}</div>{opcao === "PRODUTO" && selecionada?.id === valor && <>{selecionada.perfilSanitario?.viaPadrao && <p className="text-sm">Via: {selecionada.perfilSanitario.viaPadrao}</p>}{selecionada.perfilSanitario?.orientacaoUso && <p className="text-sm">Orientação de uso: {selecionada.perfilSanitario.orientacaoUso}</p>}</>}{erroCampo && <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">{erroCampo}</p>}<ErrorBox erro={erro} />{erro && <Button variant="outline" type="button" onClick={() => setRevisao(v => v + 1)}>Tentar carregar {rotulo} novamente</Button>}{carregando && <EsqueletoLinhas label={`Carregando ${rotulo}`} linhas={2} />}{aberto && opcoes}</div>;
}
