import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Paginacao } from "@/financeiro/financeiro-ui";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { listarAnimais, listarCategorias, obterCatalogos } from "../api";
import { linkFichaAnimal } from "../lib/navegacao";
import { rotuloLactacao } from "../lib/lactacao";
import { ROTULO_APTIDAO, ROTULO_SITUACAO } from "../lib/rotulos";
import type { AnimalResumo, Aptidao, Catalogos, CategoriaRef, ListarFiltros, ListarResultado } from "../types";
import "./busca-animais.css";

const POR_PAGINA = 20;
const REPRODUCAO: Record<string, string> = { GESTANTE: "Gestante", VAZIA: "Vazia", APTA: "Apta", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico" };
type Filtros = { situacao: "TODOS" | "ATIVO" | "BAIXADO"; sexo: "" | "F" | "M"; loteId: string; propriedadeId: string; categoriaId: string; aptidao: "" | Aptidao };
const VAZIOS: Filtros = { situacao: "TODOS", sexo: "", loteId: "", propriedadeId: "", categoriaId: "", aptidao: "" };
type Retorno = { chave: string; dados?: ListarResultado; erro?: string };
type Props = {
  aberto: boolean; escopo: string; podeConsultar: boolean;
  podeVerCaminho?: (caminho: string) => boolean;
  onFechar: () => void; onAbrir: (id: string, caminho: string) => void;
};

function caminhoAnimal(animal: AnimalResumo): string {
  const url = new URL(linkFichaAnimal(animal.id), window.location.origin);
  if (animal.propriedade) {
    url.searchParams.set("propriedadeId", String(animal.propriedade.id));
    url.searchParams.set("sitio", String(animal.propriedade.id));
  }
  return url.pathname + url.search;
}

export function BuscaAnimais({ aberto, escopo, podeConsultar, podeVerCaminho, onFechar, onAbrir }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const corpoTabela = useRef<HTMLTableSectionElement>(null);
  const id = useId();
  const sitioDoShell = getPropriedadeAtiva();
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(VAZIOS);
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState(0);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaRef[]>([]);
  const [erroCatalogos, setErroCatalogos] = useState(false);
  const [tentativaCatalogos, setTentativaCatalogos] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const sitio = sitioDoShell ?? (filtros.propriedadeId ? Number(filtros.propriedadeId) : undefined);
  const consulta = useMemo<ListarFiltros>(() => ({
    busca: busca.trim() || undefined, situacao: filtros.situacao, sexo: filtros.sexo || undefined,
    loteId: filtros.loteId || undefined, propriedadeId: sitio, categoriaId: filtros.categoriaId || undefined,
    aptidao: filtros.aptidao || undefined, page: pagina, pageSize: POR_PAGINA, ordenar: "brinco", direcao: "asc", comContexto: true,
  }), [busca, filtros, pagina, sitio]);
  const chave = JSON.stringify(consulta);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;
  const aguardandoTermo = texto.trim() !== busca.trim();
  const atual = retorno?.chave === chave && !aguardandoTermo && podeConsultar ? retorno : null;
  const dados = atual?.dados;
  const erro = atual?.erro;
  const carregando = podeConsultar && !dados && !erro;
  const itens = dados?.itens ?? [];

  useEffect(() => {
    if (!aberto || !podeConsultar || texto.trim() === busca) return;
    const timer = window.setTimeout(() => { setBusca(texto.trim()); setPagina(1); }, 200);
    return () => window.clearTimeout(timer);
  }, [texto, busca, aberto, podeConsultar]);

  useEffect(() => {
    if (!aberto || !podeConsultar) return;
    const controller = new AbortController();
    let vivo = true;
    setRetorno(null);
    const paginaConsultada = consultaRef.current.page ?? 1;
    listarAnimais(consultaRef.current, undefined, controller.signal).then(dados => {
      if (!vivo) return;
      const ultimaPagina = Math.max(1, Math.ceil(dados.total / POR_PAGINA));
      if (paginaConsultada > ultimaPagina) { setPagina(ultimaPagina); return; }
      setRetorno({ chave, dados });
    }).catch(() => { if (vivo) setRetorno({ chave, erro: "Não foi possível carregar os animais" }); });
    return () => { vivo = false; controller.abort(); };
  }, [aberto, podeConsultar, chave, tentativa]);

  useEffect(() => {
    if (!aberto || !podeConsultar) return;
    const controller = new AbortController();
    let vivo = true;
    setErroCatalogos(false);
    Promise.all([obterCatalogos(controller.signal), listarCategorias(undefined, controller.signal)]).then(([catalogos, categorias]) => {
      if (vivo) { setCatalogos(catalogos); setCategorias(categorias.itens); }
    }).catch(() => { if (vivo) setErroCatalogos(true); });
    return () => { vivo = false; controller.abort(); };
  }, [aberto, podeConsultar, tentativaCatalogos]);

  useEffect(() => {
    if (!aberto) { setTexto(""); setBusca(""); setFiltros(VAZIOS); setPagina(1); setRetorno(null); setMaisFiltros(false); }
  }, [aberto]);
  useEffect(() => { setSelecionado(0); }, [chave]);
  useEffect(() => { corpoTabela.current?.children[selecionado]?.scrollIntoView?.({ block: "nearest" }); }, [selecionado]);

  const mudar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    setFiltros(atuais => ({ ...atuais, [campo]: valor, ...(campo === "propriedadeId" ? { loteId: "" } : {}) }));
    setPagina(1);
  };
  const abrir = (animal: AnimalResumo | undefined) => {
    if (!animal || !podeConsultar || !dados) return;
    const caminho = caminhoAnimal(animal);
    if (podeVerCaminho && !podeVerCaminho(caminho)) return;
    onAbrir(animal.id, caminho);
  };
  const navegar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !itens.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const proximo = Math.max(0, Math.min(itens.length - 1, selecionado + (e.key === "ArrowDown" ? 1 : -1)));
      setSelecionado(proximo);
      if (e.target !== input.current) corpoTabela.current?.children[proximo]?.querySelector<HTMLButtonElement>("button")?.focus();
    } else if (e.key === "Enter" && e.target === input.current) { e.preventDefault(); abrir(itens[selecionado]); }
  };
  const limpar = () => { setTexto(""); setBusca(""); setFiltros(VAZIOS); setPagina(1); input.current?.focus(); };
  const propriedades = (catalogos?.propriedades ?? []).filter(p => sitioDoShell == null || p.id === sitioDoShell);
  const lotes = (catalogos?.lotes ?? []).filter(l => sitio == null || l.propriedadeId === sitio);
  const escopoVisivel = sitioDoShell == null ? escopo : propriedades.find(p => p.id === sitioDoShell)?.nome ?? escopo;

  return <Dialog open={aberto} onOpenChange={valor => { if (!valor) onFechar(); }}>
    <DialogContent className="busca-animais" showCloseButton={false} onOpenAutoFocus={e => { e.preventDefault(); input.current?.focus(); }}>
      <header className="busca-animais-cabecalho">
        <div><DialogTitle>Buscar animais</DialogTitle><DialogDescription>{escopoVisivel}</DialogDescription></div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar busca"><X aria-hidden /></Button>
      </header>
      {!podeConsultar ? <p className="busca-animais-estado" role="alert">Acesso restrito ao Rebanho</p> : <>
        <div className="busca-animais-filtros">
          <label>Animal<span className="busca-animais-entrada"><Search size={20} aria-hidden /><input ref={input} type="search" aria-label="Buscar animal" aria-controls={`${id}-tabela`} aria-describedby={`${id}-teclas`} value={texto} maxLength={60} placeholder="Buscar por brinco ou nome" onChange={e => setTexto(e.target.value)} onKeyDown={navegar}/></span></label>
          <label>Situação<SelectCampo aria-label="Situação" value={filtros.situacao} onValueChange={v => mudar("situacao", v as Filtros["situacao"])}><option value="TODOS">Todos</option><option value="ATIVO">Ativos</option><option value="BAIXADO">Baixados</option></SelectCampo></label>
          <label>Sexo<SelectCampo aria-label="Sexo" value={filtros.sexo} onValueChange={v => mudar("sexo", v as Filtros["sexo"])}><option value="">Todos</option><option value="F">Fêmeas</option><option value="M">Machos</option></SelectCampo></label>
          <label>Lote<SelectCampo aria-label="Lote" value={filtros.loteId} onValueChange={v => mudar("loteId", v)} disabled={!catalogos}><option value="">Todos</option>{lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></label>
          <Button variant="outline" className="busca-animais-mais" aria-expanded={maisFiltros} aria-controls={`${id}-filtros`} onClick={() => setMaisFiltros(v => !v)}><SlidersHorizontal aria-hidden />Mais filtros</Button>
        </div>
        {maisFiltros && <div id={`${id}-filtros`} className="busca-animais-filtros-extra">
          <label>Sítio<SelectCampo aria-label="Sítio" value={sitioDoShell ?? filtros.propriedadeId} onValueChange={v => mudar("propriedadeId", v)} disabled={sitioDoShell != null || !catalogos}>{sitioDoShell == null && <option value="">Todos os sítios</option>}{propriedades.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelectCampo></label>
          <label>Categoria<SelectCampo aria-label="Categoria" value={filtros.categoriaId} onValueChange={v => mudar("categoriaId", v)} disabled={!catalogos}><option value="">Todas</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label>
          <label>Finalidade<SelectCampo aria-label="Finalidade" value={filtros.aptidao} onValueChange={v => mudar("aptidao", v as Filtros["aptidao"])}><option value="">Todas</option>{Object.entries(ROTULO_APTIDAO).map(([valor,rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</SelectCampo></label>
        </div>}
        {erroCatalogos && <div className="busca-animais-aviso" role="status">Não foi possível carregar as opções de lote, sítio e categoria. <Button variant="link" onClick={() => setTentativaCatalogos(v => v + 1)}>Tentar carregar filtros</Button></div>}
        <div className="busca-animais-resultados" aria-busy={carregando}>
          {carregando ? <p className="busca-animais-estado" role="status">Consultando animais…</p> : erro ? <div className="busca-animais-estado" role="alert"><h3>{erro}</h3><p>Confira sua conexão e tente novamente.</p><Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</Button></div> : dados && !itens.length ? <div className="busca-animais-estado"><h3>Nenhum animal encontrado</h3><p>Altere o termo ou os filtros para tentar novamente.</p><Button variant="outline" onClick={limpar}>Limpar busca e filtros</Button></div> : <table id={`${id}-tabela`} aria-label="Animais encontrados">
            <thead><tr>{["Brinco / nome","Situação","Categoria","Reprodução","Produção","Lote","Sítio"].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead>
            <tbody ref={corpoTabela}>{itens.map((animal,i) => <tr key={animal.id} data-selecionado={i === selecionado || undefined} onClick={() => abrir(animal)}>
              <td><button type="button" data-animal-id={animal.id} onFocus={() => setSelecionado(i)} onKeyDown={navegar} onClick={e => { e.stopPropagation(); abrir(animal); }} disabled={podeVerCaminho && !podeVerCaminho(caminhoAnimal(animal))} aria-label={`Abrir ficha de ${animal.brinco}${animal.nome ? ` — ${animal.nome}` : ""}`}>{animal.brinco}</button><small>{animal.nome ?? "Nome não informado"}</small></td>
              <td><span className={`busca-animais-situacao ${animal.situacao === "ATIVO" ? "ativa" : ""}`}>{ROTULO_SITUACAO[animal.situacao]}</span></td>
              <td>{animal.categoria?.nome ?? "Não informada"}</td>
              <td>{animal.sexo === "M" ? "Não se aplica" : REPRODUCAO[animal.contextoCartao?.situacaoReprodutiva ?? ""] ?? "Não informada"}</td>
              <td>{animal.sexo === "M" ? "Não se aplica" : rotuloLactacao(animal.contextoCartao?.produtivo?.situacaoProdutiva)}</td>
              <td>{animal.lote?.nome ?? "Sem lote"}</td><td>{animal.propriedade?.nome ?? "Não informado"}</td>
            </tr>)}</tbody>
          </table>}
        </div>
        <footer className="busca-animais-rodape">
          {itens[selecionado] && <span className="sr-only" role="status" aria-atomic="true">{dados?.total} animais encontrados. Selecionado: {itens[selecionado].brinco}{itens[selecionado].nome ? ` — ${itens[selecionado].nome}` : ""}.</span>}
          <p id={`${id}-teclas`} className="busca-animais-teclas"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir ficha <kbd>Esc</kbd> fechar <span><kbd>Ctrl/⌘ K</kbd> buscar em tudo</span></p>
          {dados && dados.total > 0 && <Paginacao pagina={pagina} totalPaginas={Math.max(1,Math.ceil(dados.total/POR_PAGINA))} total={dados.total} porPagina={POR_PAGINA} rotulo="Paginação dos animais" substantivo="animais" idSelect={`${id}-pagina`} onPagina={setPagina}/>}
          {dados?.total === 0 && <p className="busca-animais-contagem" role="status">0 animais</p>}
        </footer>
      </>}
    </DialogContent>
  </Dialog>;
}
