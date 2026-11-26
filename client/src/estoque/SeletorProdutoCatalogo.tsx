import { ChevronDown, Plus } from "lucide-react";
import { obterReferenciaCatalogo } from "./catalogos-api";
import { FormProduto } from "../financeiro/FormProduto";
import { useEffect, useId, useRef, useState } from "react";
import { DialogoSelecaoProdutos } from "./DialogoSelecaoProdutos";
import { Button } from "../financeiro/financeiro-ui";
import { buscarPaginaProdutos, type ItemCatalogoBusca, type ProdutoDTO, type UsoProduto } from "./api";
import type { UnidadeMedida } from "../lib/unidades";

export type ProdutoLocal = Pick<ProdutoDTO, "id" | "nome"> & Partial<ProdutoDTO>;

/** Produto da fazenda ("Meus produtos") ou item do catálogo ainda não adotado (docs/produtos.md, Adoção e Interface). */
export type ProdutoEscolhido =
  | { tipo: "produto"; produtoId: string; nome: string; produto?: ProdutoDTO }
  | { tipo: "catalogo"; produtoCatalogoId: string; nomeCompleto: string; conteudoEmbalagem?: string | null; rotuloEmbalagem?: string | null; unidadeSugerida: UnidadeMedida; categoriaSugeridaId: string | null; fabricante?: string | null; item?: ItemCatalogoBusca };

export const escolherProduto = (produto: ProdutoLocal): ProdutoEscolhido => ({ tipo: "produto", produtoId: produto.id, nome: produto.nome, ...(produto.unidade ? { produto: { ...produto, unidade: produto.unidade } } : {}) });
export const escolherCatalogo = (item: ItemCatalogoBusca): ProdutoEscolhido => ({ tipo: "catalogo", produtoCatalogoId: item.id, nomeCompleto: item.nomeCompleto, unidadeSugerida: item.unidadeSugerida, categoriaSugeridaId: item.categoriaSugeridaId, conteudoEmbalagem: item.conteudoEmbalagem, rotuloEmbalagem: item.rotuloEmbalagem, fabricante: item.fabricante?.nome ?? null, item });
export const nomeEscolhido = (v: ProdutoEscolhido) => (v.tipo === "produto" ? v.nome : v.nomeCompleto);

export function SeletorProdutoCatalogo({ id, rotulo, value, onChange, uso, somenteMeus = false, somenteCatalogo = false, obrigatorio = false, disabled = false, invalido = false, propriedadeId, placeholder = "Selecionar produto", descricaoId, onCadastrado, permitirCadastro = false, contexto, produtosPermitidos }: {
  id?: string; rotulo: string; value: ProdutoEscolhido | null; onChange: (valor: ProdutoEscolhido | null) => void;
  contexto?: string; produtosPermitidos?: ProdutoLocal[]; uso?: UsoProduto; somenteMeus?: boolean; somenteCatalogo?: boolean; obrigatorio?: boolean; disabled?: boolean; invalido?: boolean; propriedadeId?: number; placeholder?: string; descricaoId?: string; permitirCadastro?: boolean; onCadastrado?: (produto: ProdutoDTO) => void;
}) {
  const gerado = useId(), campoId = id ?? `produto-${gerado}`;
  const gatilho = useRef<HTMLButtonElement>(null);
  const [erroObrigatorio, setErroObrigatorio] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [itemDetalhe, setItemDetalhe] = useState<{ apresentacao?: string | null; fabricante?: { nome: string } | null; classificacaoTecnica?: { nome: string } | null } | null>(null);
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1);
  const [aba, setAba] = useState<"meus" | "catalogo">(somenteCatalogo ? "catalogo" : "meus");
  const [selecionado, setSelecionado] = useState<ProdutoEscolhido | null>(null);
  const [dados, setDados] = useState<{ itens: (ProdutoLocal | ItemCatalogoBusca)[]; total: number; pagina: number; porPagina: number } | null>(null);
  const [erro, setErro] = useState(""), [tentativa, setTentativa] = useState(0), [carregando, setCarregando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController(); setCarregando(true); setErro("");
    if (aba === "meus" && produtosPermitidos) {
      const itens = produtosPermitidos.filter(p => p.nome.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR")));
      const paginaEfetiva = Math.min(pagina, Math.max(1, Math.ceil(itens.length / 10)));
      setDados({ itens: itens.slice((paginaEfetiva - 1) * 10, paginaEfetiva * 10), total: itens.length, pagina: paginaEfetiva, porPagina: 10 }); setCarregando(false); return () => controle.abort();
    }
    const timer = window.setTimeout(() => buscarPaginaProdutos({ q: busca || undefined, uso, origem: aba, pagina, porPagina: 10 }, { propriedadeId, signal: controle.signal }).then(d => { if (!controle.signal.aborted) setDados(d); }).catch(e => { if (!controle.signal.aborted) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (!controle.signal.aborted) setCarregando(false); }), 200);
    return () => { clearTimeout(timer); controle.abort(); };
  }, [aberto, busca, aba, pagina, uso, propriedadeId, tentativa, produtosPermitidos]);
  useEffect(() => {
    if (!aberto || value?.tipo !== "catalogo" || value.item || itemDetalhe) return;
    let vivo = true;
    obterReferenciaCatalogo(value.produtoCatalogoId).then(item => { if (vivo) setItemDetalhe(item); }).catch(() => {});
    return () => { vivo = false; };
  }, [aberto, value, itemDetalhe]);
  const abrir = () => { setSelecionado(value); setItemDetalhe(value?.tipo === "produto" ? value.produto ?? null : value?.item ?? null); setDados(null); setBusca(""); setPagina(1); setAba(somenteCatalogo || value?.tipo === "catalogo" ? "catalogo" : "meus"); setAberto(true); };
  return <>
    <button ref={gatilho} type="button" id={campoId} aria-label={rotulo} aria-haspopup="dialog" aria-expanded={aberto} aria-invalid={invalido || (erroObrigatorio && !value) || undefined} aria-required={obrigatorio || undefined} aria-describedby={[descricaoId, erroObrigatorio && !value ? `${campoId}-obrigatorio` : null].filter(Boolean).join(" ") || undefined} disabled={disabled} onClick={abrir} className="mt-1.5 flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-left font-normal disabled:opacity-60"><span>{value ? nomeEscolhido(value) : placeholder}</span><ChevronDown size={16} aria-hidden /></button>
    {obrigatorio && <input aria-hidden="true" tabIndex={-1} className="sr-only" required disabled={disabled} value={value ? nomeEscolhido(value) : ""} onChange={() => {}} onInvalid={e => { e.preventDefault(); setErroObrigatorio(true); gatilho.current?.focus(); }} />}
    {erroObrigatorio && !value && <p id={`${campoId}-obrigatorio`} role="alert" className="text-xs text-destructive">Selecione um produto.</p>}
    <DialogoSelecaoProdutos aberto={aberto && !cadastrando} onAberto={setAberto} gatilho={gatilho} titulo="Selecionar produto" contexto={contexto || (somenteCatalogo ? "Referência do catálogo" : rotulo)} busca={busca} onBusca={v => { setBusca(v); setPagina(1); setSelecionado(null); setItemDetalhe(null); setDados(null); }} aba={aba} onAba={a => { setAba(a); setPagina(1); setSelecionado(null); setItemDetalhe(null); setDados(null); }} mostrarAbas={!somenteMeus && !somenteCatalogo} paginacao={dados && !carregando ? { pagina: dados.pagina, total: dados.total, porPagina: dados.porPagina, onPagina: p => { setPagina(p); setDados(null); setSelecionado(null); setItemDetalhe(null); } } : undefined} resumo={selecionado && <div className="mx-5 shrink-0 rounded-lg bg-muted p-3 text-sm"><strong>{nomeEscolhido(selecionado)}</strong><dl className="mt-2 grid gap-2 sm:grid-cols-3">{[["Apresentação", itemDetalhe?.apresentacao], ["Fabricante", itemDetalhe?.fabricante?.nome], ["Classificação", itemDetalhe?.classificacaoTecnica?.nome]].map(([rotulo, valor]) => <div key={rotulo}><dt className="text-xs text-ink-3">{rotulo}</dt><dd>{itemDetalhe ? valor || "Não informado" : "Detalhes indisponíveis"}</dd></div>)}</dl></div>} acoes={<><Button secondary onClick={() => setAberto(false)}>Cancelar</Button>{value && !obrigatorio && <Button secondary onClick={() => { onChange(null); setAberto(false); }}>Limpar seleção</Button>}<Button disabled={!selecionado} onClick={() => { const igual = value && selecionado && (value.tipo === "produto" ? selecionado.tipo === "produto" && value.produtoId === selecionado.produtoId : selecionado.tipo === "catalogo" && value.produtoCatalogoId === selecionado.produtoCatalogoId); if (!igual) onChange(selecionado); setErroObrigatorio(false); setAberto(false); }}>Confirmar seleção</Button></>}>
      {carregando ? <p role="status">Buscando produtos…</p> : erro ? <div role="alert">{erro} <Button secondary onClick={() => setTentativa(n => n + 1)}>Tentar novamente</Button></div> : <div role="radiogroup" aria-label="Produtos encontrados" className="divide-y divide-border rounded-lg border border-border">{dados?.itens.map(item => {
        const escolha = aba === "meus" ? escolherProduto(item as ProdutoLocal) : escolherCatalogo(item as ItemCatalogoBusca);
        const marcado = selecionado && (escolha.tipo === "produto" ? selecionado.tipo === "produto" && selecionado.produtoId === escolha.produtoId : selecionado.tipo === "catalogo" && selecionado.produtoCatalogoId === escolha.produtoCatalogoId);
        return <label key={item.id} className={`flex cursor-pointer items-start gap-3 p-3 text-sm ${marcado ? "bg-primary/10 text-primary" : ""}`}><input className="accent-primary" type="radio" name={`${campoId}-escolha`} checked={!!marcado} onChange={() => { setSelecionado(escolha); setItemDetalhe(item); }} /><span><strong className="block">{aba === "catalogo" ? (item as ItemCatalogoBusca).nome : nomeEscolhido(escolha)}</strong><span className="text-ink-3">{[item.apresentacao, item.fabricante?.nome].filter(Boolean).join(" · ")}</span></span></label>;
      })}{dados?.itens.length === 0 && <p className="p-4 text-sm">Nenhum produto encontrado.{permitirCadastro && <Button secondary onClick={() => setCadastrando(true)}><Plus size={15} />Cadastrar produto</Button>}</p>}</div>}
    </DialogoSelecaoProdutos>
    {cadastrando && <FormProduto produto={null} onFechar={() => setCadastrando(false)} onSalvo={p => { setCadastrando(false); setAberto(false); onChange(escolherProduto(p)); onCadastrado?.(p); }} />}
  </>;
}
