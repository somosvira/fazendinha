import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, MapPin, X, CornerDownLeft } from "lucide-react";
import type { Tab } from "./Shell";
import { COMANDOS, buscar, type ResultadoBusca } from "../lib/searchIndex";
import { comPropriedade } from "../propriedadeScope";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import "./busca-global.css";

type FiltroBusca = "Tudo" | "Registros" | "Páginas" | "Ações";
type Props = {
  aberto: boolean; onFechar: () => void;
  onNav: (t: Tab, entidadeId?: string, caminho?: string) => void;
  podeVer: (t: Tab) => boolean;
  podeVerCaminho?: (caminho: string) => boolean;
  podeLancar?: boolean; podeVerValores?: boolean; escopo?: string;
};
const filtros: FiltroBusca[] = ["Tudo", "Registros", "Páginas", "Ações"];
const consultaValida = (q: string) => q.length >= 2 || /^\d$/.test(q);
function eResultadoBusca(v: unknown): v is ResultadoBusca {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return ["tipo", "entidadeId", "label", "sublabel", "tab", "grupo", "caminho"].every(k => typeof r[k] === "string")
    && (r.caminho as string).startsWith("/") && !(r.caminho as string).startsWith("//");
}

export function CommandPalette({ aberto, onFechar, onNav, podeVer, podeVerCaminho, podeLancar = true, podeVerValores = true, escopo = "Consolidado" }: Props) {
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState<FiltroBusca>("Tudo");
  const [valorSelecionado, setValorSelecionado] = useState("");
  const [resposta, setResposta] = useState<{ q: string; itens: ResultadoBusca[] } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const termo = query.trim();
  const visiveis = useMemo(() => COMANDOS.filter(c => podeVer(c.tab) && (!podeVerCaminho || podeVerCaminho(c.caminho)) && (!c.exigeLancamento || podeLancar) && (!c.exigeValores || podeVerValores)), [podeVer, podeVerCaminho, podeLancar, podeVerValores]);
  const comandos = useMemo(() => buscar(visiveis, query), [visiveis, query]);
  const paginas = filtro === "Tudo" || filtro === "Páginas" ? comandos.filter(c => !c.acao) : [];
  const acoes = filtro === "Tudo" || filtro === "Ações" ? comandos.filter(c => c.acao) : [];
  const entidades = useMemo(() => resposta?.q === termo ? resposta.itens.filter(e => podeVer(e.tab as Tab) && (!podeVerCaminho || podeVerCaminho(e.caminho))) : [], [resposta, termo, podeVer, podeVerCaminho]);
  const registros = filtro === "Tudo" || filtro === "Registros" ? entidades : [];
  const primeiroId = registros[0] ? `${registros[0].tipo}:${registros[0].entidadeId}` : paginas[0]?.id ?? acoes[0]?.id ?? "";
  useEffect(() => { setValorSelecionado(primeiroId); if (listaRef.current) listaRef.current.scrollTop = 0; }, [primeiroId, termo, filtro]);

  useEffect(() => {
    if (aberto) { setQuery(""); setFiltro("Tudo"); setResposta(null); setErro(false); }
  }, [aberto]);
  useEffect(() => {
    if (!aberto || !consultaValida(termo)) { setResposta(null); setBuscando(false); setErro(false); return; }
    const controller = new AbortController();
    let vivo = true;
    setErro(false); setBuscando(true); setResposta(null);
    const timer = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { headers: comPropriedade(), signal: controller.signal });
        if (!r.ok) throw new Error("Falha ao buscar");
        const data: unknown = await r.json();
        if (!Array.isArray(data) || !data.every(eResultadoBusca)) throw new Error("Resposta inválida da busca");
        if (vivo) setResposta({ q: termo, itens: data });
      } catch {
        if (vivo) { setResposta(null); setErro(true); }
      } finally { if (vivo) setBuscando(false); }
    }, 200);
    return () => { vivo = false; controller.abort(); window.clearTimeout(timer); };
  }, [aberto, termo, tentativa]);

  const mostrarRegistros = filtro === "Tudo" || filtro === "Registros";
  const semResultados = !paginas.length && !acoes.length && !registros.length && !(mostrarRegistros && (buscando || erro));
  const escolher = (tab: Tab, id: string | undefined, caminho: string) => { onNav(tab, id, caminho); onFechar(); };
  return <Dialog open={aberto} onOpenChange={open => { if (!open) onFechar(); }}>
    <DialogContent showCloseButton={false} aria-describedby={undefined} className="busca-global" onOpenAutoFocus={e => { e.preventDefault(); inputRef.current?.focus(); }}>
      <DialogTitle className="sr-only">Busca global</DialogTitle>
      <Command value={valorSelecionado} onValueChange={setValorSelecionado} shouldFilter={false} vimBindings={false} label="Busca global" className="busca-global-comando">
        <div className="busca-global-entrada">
          <CommandInput ref={inputRef} value={query} onValueChange={setQuery} placeholder="Buscar em tudo…" maxLength={60} aria-label="Buscar em tudo" />
          <button type="button" onClick={onFechar} aria-label="Fechar busca" className="busca-global-fechar"><X size={18} aria-hidden /></button>
        </div>
        <div className="busca-global-escopo"><MapPin size={14} aria-hidden /><span>{escopo}</span></div>
        <nav className="busca-global-filtros" aria-label="Tipos de resultado">{filtros.map(f => <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{f}</button>)}</nav>
        <CommandList ref={listaRef} className="busca-global-lista" aria-label="Resultados da busca" aria-busy={mostrarRegistros && buscando}>
          {!termo && <p className="busca-global-dica">Busque por nome, brinco, número ou referência.</p>}
          {mostrarRegistros && registros.length > 0 && <CommandGroup heading="Registros">{registros.map(e => <CommandItem key={`${e.tipo}:${e.entidadeId}`} value={`${e.tipo}:${e.entidadeId}`} onSelect={() => escolher(e.tab as Tab, e.entidadeId, e.caminho)} className="busca-global-linha">
            <FileText size={19} aria-hidden /><span className="busca-global-texto"><span>{e.label}</span><small>{e.sublabel}</small></span><span className="busca-global-tipo">{e.grupo}</span>
          </CommandItem>)}</CommandGroup>}
          {mostrarRegistros && buscando && <p role="status" className="busca-global-estado">Buscando registros…</p>}
          {mostrarRegistros && erro && <div role="alert" className="busca-global-falha"><strong>Não foi possível buscar os registros</strong><p>Confira sua conexão e tente novamente.</p><button type="button" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</button></div>}
          {paginas.length > 0 && <CommandGroup heading={termo ? "Páginas" : "Ir para"}>{paginas.map(c => <CommandItem key={c.id} value={c.id} onSelect={() => escolher(c.tab, undefined, c.caminho)} className="busca-global-linha"><FileText size={19} aria-hidden /><span className="busca-global-texto"><span>{c.label}</span><small>{c.descricao ?? c.grupo}</small></span><span className="busca-global-tipo">Página</span></CommandItem>)}</CommandGroup>}
          {acoes.length > 0 && <CommandGroup heading="Ações">{acoes.map(c => <CommandItem key={c.id} value={c.id} onSelect={() => escolher(c.tab, undefined, c.caminho)} className="busca-global-linha"><CornerDownLeft size={19} aria-hidden /><span className="busca-global-texto"><span>{c.label}</span><small>{c.descricao ?? c.grupo}</small></span><span className="busca-global-tipo">Ação</span></CommandItem>)}</CommandGroup>}
          {semResultados && <div className="busca-global-vazio"><strong>{termo ? `Nenhum resultado para «${termo}»` : "Digite para buscar"}</strong><p>{!consultaValida(termo) && termo ? "Digite pelo menos duas letras ou um número." : "Tente parte do nome, brinco ou referência do registro."}</p></div>}
          {registros.length >= 6 && <p className="busca-global-dica">Resultados limitados por tipo. Refine o termo para localizar outros registros.</p>}
        </CommandList>
        <div className="busca-global-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span><span><kbd>Ctrl/⌘ K</kbd> buscar</span></div>
      </Command>
    </DialogContent>
  </Dialog>;
}
