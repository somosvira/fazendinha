import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "../financeiro/financeiro-ui";
import { FormProduto } from "../financeiro/FormProduto";
import { buscarProdutosUnificado, type BuscaProdutosDTO, type ItemCatalogoBusca, type ProdutoDTO, type UsoProduto } from "./api";
import type { UnidadeMedida } from "../lib/unidades";

/** Produto da fazenda ("Meus produtos") ou item do catálogo ainda não adotado (docs/produtos.md, Adoção e Interface). */
export type ProdutoEscolhido =
  | { tipo: "produto"; produtoId: string; nome: string; produto?: ProdutoDTO }
  | { tipo: "catalogo"; produtoCatalogoId: string; nomeCompleto: string; unidadeSugerida: UnidadeMedida; categoriaSugeridaId: string | null; fabricante?: string | null };

export const escolherProduto = (produto: Pick<ProdutoDTO, "id" | "nome">): ProdutoEscolhido => ({ tipo: "produto", produtoId: produto.id, nome: produto.nome, produto: produto as ProdutoDTO });
export const escolherCatalogo = (item: ItemCatalogoBusca): ProdutoEscolhido => ({ tipo: "catalogo", produtoCatalogoId: item.id, nomeCompleto: item.nomeCompleto, unidadeSugerida: item.unidadeSugerida, categoriaSugeridaId: item.categoriaSugeridaId, fabricante: item.fabricante?.nome ?? null });
export const nomeEscolhido = (v: ProdutoEscolhido) => (v.tipo === "produto" ? v.nome : v.nomeCompleto);

type Linha = { chave: string; grupo: "meus" | "catalogo"; escolha: ProdutoEscolhido; titulo: string; detalhe: string };
type Estado = { fase: "carregando" } | { fase: "erro"; mensagem: string } | { fase: "pronto"; dados: BuscaProdutosDTO };

const detalheMeu = (p: ProdutoDTO) => [p.apresentacao, p.fabricante?.nome].filter(Boolean).join(" · ");

/**
 * Seletor unificado de produto: busca em "Meus produtos" e no "Catálogo" ao mesmo tempo.
 * Escolher um item do catálogo não abre diálogo: quem usa o seletor preenche a linha e envia `produtoCatalogoId`.
 * Combobox com lista (ARIA 1.2): foco permanece no campo, setas navegam, Enter escolhe, Esc fecha.
 */
export function SeletorProdutoCatalogo({ id, rotulo, value, onChange, uso, somenteMeus = false, obrigatorio = false, disabled = false, invalido = false, propriedadeId, limite = 10, debounceMs = 250, placeholder = "Buscar produto", descricaoId, onCadastrado }: {
  id?: string; rotulo: string; value: ProdutoEscolhido | null; onChange: (valor: ProdutoEscolhido | null) => void;
  uso?: UsoProduto;
  /** Oculta o grupo Catálogo: para fluxos cujo contrato não aceita `produtoCatalogoId`. */
  somenteMeus?: boolean;
  obrigatorio?: boolean; disabled?: boolean; invalido?: boolean; propriedadeId?: number; limite?: number; debounceMs?: number;
  placeholder?: string; descricaoId?: string;
  /** Chamado depois de cadastrar um produto novo pelo seletor (o produto já vem escolhido). */
  onCadastrado?: (produto: ProdutoDTO) => void;
}) {
  const gerado = useId();
  const campoId = id ?? `produto-${gerado}`;
  const listaId = `${campoId}-lista`;
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [termo, setTermo] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [ativo, setAtivo] = useState(0);
  const [cadastrando, setCadastrando] = useState(false);
  const devolvendoFoco = useRef(false);

  // Termo da busca: imediato ao abrir, adiado enquanto a pessoa digita.
  useEffect(() => {
    if (!aberto) return;
    const t = window.setTimeout(() => setTermo(texto.trim()), digitando ? debounceMs : 0);
    return () => window.clearTimeout(t);
  }, [aberto, texto, digitando, debounceMs]);

  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController();
    setEstado({ fase: "carregando" });
    buscarProdutosUnificado({ q: termo || undefined, uso, limite }, { propriedadeId, signal: controle.signal })
      .then((dados) => { if (!controle.signal.aborted) { setEstado({ fase: "pronto", dados }); setAtivo(0); } })
      .catch((e: unknown) => { if (!controle.signal.aborted) setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : String(e) }); });
    return () => controle.abort();
  }, [aberto, termo, uso, limite, propriedadeId, tentativa]);

  const linhas = useMemo<Linha[]>(() => {
    if (estado.fase !== "pronto") return [];
    return [
      ...(estado.dados.meus ?? []).map((p): Linha => ({ chave: `p-${p.id}`, grupo: "meus", escolha: escolherProduto(p), titulo: p.nome, detalhe: detalheMeu(p) })),
      ...(somenteMeus ? [] : estado.dados.catalogo ?? []).map((i): Linha => ({ chave: `c-${i.id}`, grupo: "catalogo", escolha: escolherCatalogo(i), titulo: i.nomeCompleto, detalhe: i.fabricante?.nome ?? "" })),
    ];
  }, [estado, somenteMeus]);
  const semResultado = estado.fase === "pronto" && linhas.length === 0;
  const opcaoId = (i: number) => `${campoId}-opcao-${i}`;

  const fechar = useCallback(() => { setAberto(false); setDigitando(false); setTexto(""); setTermo(""); }, []);
  /** Devolve o foco ao campo depois de escolher/limpar sem reabrir a lista. */
  const focarCampo = () => { devolvendoFoco.current = true; campo.current?.focus(); devolvendoFoco.current = false; };
  const escolher = (linha: Linha) => { onChange(linha.escolha); fechar(); focarCampo(); };

  const teclado = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) { setAberto(true); return; }
      if (!linhas.length) return;
      setAtivo((a) => (e.key === "ArrowDown" ? (a + 1) % linhas.length : (a - 1 + linhas.length) % linhas.length));
    } else if (e.key === "Home" && aberto && linhas.length) { e.preventDefault(); setAtivo(0); }
    else if (e.key === "End" && aberto && linhas.length) { e.preventDefault(); setAtivo(linhas.length - 1); }
    else if (e.key === "Enter" && aberto) { e.preventDefault(); const linha = linhas[ativo]; if (linha) escolher(linha); }
    else if (e.key === "Escape" && aberto) { e.stopPropagation(); fechar(); }
    else if (e.key === "Tab" && aberto) fechar();
  };

  const mostrado = aberto && digitando ? texto : aberto && !texto ? "" : value ? nomeEscolhido(value) : "";
  const grupos = [
    { grupo: "meus" as const, titulo: "Meus produtos" },
    { grupo: "catalogo" as const, titulo: "Catálogo" },
  ].map((g) => ({ ...g, itens: linhas.map((l, indice) => ({ l, indice })).filter(({ l }) => l.grupo === g.grupo) })).filter((g) => g.itens.length);

  return <div ref={raiz} className="relative min-w-0" onBlur={(e) => { if (!raiz.current?.contains(e.relatedTarget as Node | null)) fechar(); }}>
    <div className="relative">
      <input ref={campo} id={campoId} type="text" role="combobox" autoComplete="off" aria-label={rotulo} aria-expanded={aberto} aria-controls={listaId} aria-autocomplete="list" aria-haspopup="listbox"
        aria-activedescendant={aberto && linhas.length ? opcaoId(ativo) : undefined} aria-invalid={invalido || undefined} aria-required={obrigatorio || undefined} aria-describedby={descricaoId}
        disabled={disabled} placeholder={value ? nomeEscolhido(value) : placeholder} value={mostrado} title={value ? nomeEscolhido(value) : undefined}
        onFocus={() => { if (!disabled && !devolvendoFoco.current) setAberto(true); }} onClick={() => { if (!disabled) setAberto(true); }}
        onChange={(e) => { setTexto(e.target.value); setDigitando(true); setAberto(true); }} onKeyDown={teclado}
        className="mt-1.5 block w-full rounded-lg border border-border bg-card py-2.5 pl-3 pr-16 font-normal disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 aria-[invalid=true]:border-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
      <span className="absolute inset-y-0 right-1 flex items-center gap-0.5 pt-1.5">
        {value && !obrigatorio && !disabled && <button type="button" aria-label={`Limpar ${rotulo.toLocaleLowerCase("pt-BR")}`} onClick={() => { onChange(null); fechar(); focarCampo(); }} className="inline-flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X size={15} aria-hidden /></button>}
        <ChevronDown size={16} aria-hidden className="mr-2 text-ink-3" />
      </span>
    </div>
    {aberto && <div className="absolute left-0 right-0 top-full z-[1300] mt-1 max-h-[min(22rem,60dvh)] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
      {estado.fase === "carregando" && <p role="status" className="px-3 py-3 text-sm text-ink-3">Buscando produtos…</p>}
      {estado.fase === "erro" && <div role="alert" className="grid gap-2 px-3 py-3 text-sm"><p className="text-destructive">{estado.mensagem}</p><div><Button type="button" secondary onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</Button></div></div>}
      {semResultado && <div className="grid gap-2 px-3 py-3 text-sm"><p role="status">{termo ? `Nenhum produto encontrado para “${termo}”.` : "Nenhum produto encontrado."}</p><div><Button type="button" secondary onClick={() => setCadastrando(true)}><Plus size={15} aria-hidden />Cadastrar produto</Button></div></div>}
      <div id={listaId} role="listbox" aria-label={rotulo} hidden={!grupos.length}>
        {grupos.map((g) => <div key={g.grupo} role="group" aria-labelledby={`${campoId}-grupo-${g.grupo}`}>
          <div id={`${campoId}-grupo-${g.grupo}`} className="sticky top-0 border-b border-border bg-popover px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{g.titulo}</div>
          {g.itens.map(({ l, indice }) => {
            const escolhida = !!value && (l.escolha.tipo === "produto" ? value.tipo === "produto" && value.produtoId === l.escolha.produtoId : value.tipo === "catalogo" && value.produtoCatalogoId === l.escolha.produtoCatalogoId);
            return <div key={l.chave} id={opcaoId(indice)} role="option" aria-selected={escolhida} data-ativo={indice === ativo || undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(l)} onMouseMove={() => setAtivo(indice)}
              className={`cursor-pointer break-words px-3 py-2 text-sm ${indice === ativo ? "bg-accent text-accent-foreground" : ""} ${escolhida ? "font-semibold" : ""}`}>
              <span className="block">{l.titulo}</span>
              {l.detalhe && <span className="block text-xs font-normal text-ink-3">{l.detalhe}</span>}
            </div>;
          })}
        </div>)}
      </div>
    </div>}
    {cadastrando && <FormProduto produto={null} onFechar={() => setCadastrando(false)}
      onSalvo={(salvo) => { setCadastrando(false); onChange(escolherProduto(salvo)); onCadastrado?.(salvo); fechar(); }} />}
  </div>;
}
