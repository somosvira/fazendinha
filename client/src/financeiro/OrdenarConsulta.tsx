import { useEffect, useId, useState } from "react";
import { ArrowDownUp, Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "./ordenar-consulta.css";

export type DirecaoOrdenacao = "asc" | "desc";
export type CampoOrdenacao = { chave: string; rotulo: string; tipo: "numero" | "texto" | "data" };
export type EstadoOrdenacao = { campo: string; direcao: DirecaoOrdenacao };
export type ControleOrdenacao = EstadoOrdenacao & { campos: CampoOrdenacao[]; mudar: (v: EstadoOrdenacao) => void; restaurar: () => void };
export type DefinicaoOrdenacao<T> = CampoOrdenacao & { obter: (item: T) => string | number | null | undefined };
export function rotuloDirecao(tipo: CampoOrdenacao["tipo"], direcao: DirecaoOrdenacao) {
  return tipo === "texto" ? direcao === "asc" ? "A–Z" : "Z–A" : tipo === "data" ? direcao === "asc" ? "Mais antiga" : "Mais recente" : direcao === "asc" ? "Menor primeiro" : "Maior primeiro";
}
export function OrdenarConsulta({ controle }: { controle: ControleOrdenacao }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  if (!controle.campos.length) return null;
  const atual = controle.campos.find(c => c.chave === controle.campo);
  const texto = atual ? `${atual.rotulo} · ${rotuloDirecao(atual.tipo, controle.direcao).toLocaleLowerCase("pt-BR")}` : "Ordenar";
  return <Popover open={aberto} onOpenChange={setAberto}><PopoverTrigger asChild><Button type="button" variant="outline" className="consulta-ordenar" aria-label={`Ordenar: ${texto}`}><ArrowDownUp size={16} aria-hidden />{texto}<ChevronDown size={14} aria-hidden /></Button></PopoverTrigger>
    <PopoverContent align="end" className="financeiro-colorido ordenar-popover" aria-label="Ordenação da tabela"><div className="ordenar-cabecalho"><h2>Ordenar por</h2><Button variant="ghost" size="icon" aria-label="Fechar ordenação" onClick={() => setAberto(false)}><X size={16} /></Button></div>
      <fieldset className="ordenar-opcoes"><legend className="sr-only">Campo da ordenação</legend>{controle.campos.map(c => <label key={c.chave} data-selecionado={c.chave === controle.campo || undefined}><input type="radio" name={`ordenar-${id}`} value={c.chave} checked={c.chave === controle.campo} onChange={() => controle.mudar({ campo: c.chave, direcao: controle.direcao })} /><span>{c.rotulo}</span>{c.chave === controle.campo && <Check size={16} aria-hidden />}</label>)}</fieldset>
      <fieldset className="ordenar-direcao"><legend>Direção</legend><div>{(["asc", "desc"] as const).map(d => <Button type="button" variant={controle.direcao === d ? "default" : "outline"} aria-pressed={controle.direcao === d} key={d} onClick={() => controle.mudar({ campo: atual?.chave ?? controle.campos[0].chave, direcao: d })}>{rotuloDirecao(atual?.tipo ?? "numero", d)}</Button>)}</div></fieldset>
      <div className="ordenar-rodape"><Button type="button" variant="ghost" onClick={controle.restaurar}><RotateCcw size={15} aria-hidden />Restaurar padrão</Button><p>Sem informação ficam no final.</p></div>
    </PopoverContent><span className="sr-only" aria-live="polite">{atual ? `Ordenação: ${texto}` : "Ordenação padrão"}</span></Popover>;
}

function decimal(valor: string | number) {
  const texto = String(valor);
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const [inteira, fracao = ""] = texto.replace(/^-/, "").split(".");
  const i = inteira.replace(/^0+(?=\d)/, "");
  const f = fracao.replace(/0+$/, "");
  return { negativo: negativo && (i !== "0" || !!f), i, f };
}
function compararNumero(a: string | number, b: string | number) {
  const x = decimal(a), y = decimal(b);
  if (!x || !y) return Number(a) - Number(b);
  if (x.negativo !== y.negativo) return x.negativo ? -1 : 1;
  const sentido = x.negativo ? -1 : 1;
  const tamanho = Math.max(x.f.length, y.f.length);
  return sentido * (Math.sign(x.i.length - y.i.length) || x.i.localeCompare(y.i) || x.f.padEnd(tamanho, "0").localeCompare(y.f.padEnd(tamanho, "0")));
}
export function ordenarColecao<T>(itens: readonly T[], campos: DefinicaoOrdenacao<T>[], estado: EstadoOrdenacao): T[] {
  const campo = campos.find(c => c.chave === estado.campo);
  if (!campo) return [...itens];
  const ausente = (v: unknown) => v == null || v === "" || typeof v === "number" && !Number.isFinite(v);
  return itens.map((item, indice) => ({ item, indice, valor: campo.obter(item) })).sort((a, b) => {
    if (ausente(a.valor) || ausente(b.valor)) return ausente(a.valor) === ausente(b.valor) ? a.indice - b.indice : ausente(a.valor) ? 1 : -1;
    const comp = campo.tipo === "numero" ? compararNumero(a.valor!, b.valor!) : String(a.valor).localeCompare(String(b.valor), "pt-BR", { numeric: campo.tipo === "texto" });
    return (estado.direcao === "asc" ? comp : -comp) || a.indice - b.indice;
  }).map(v => v.item);
}
export function useOrdenacaoTabela<T>(campos: DefinicaoOrdenacao<T>[], chave: string, aoMudar?: () => void) {
  const ler = (): EstadoOrdenacao => { const p = new URLSearchParams(window.location.search); return { campo: p.get(`${chave}Campo`) ?? "", direcao: p.get(`${chave}Direcao`) === "desc" ? "desc" : "asc" }; };
  const [estado, setEstado] = useState(ler);
  useEffect(() => { const atualizar = () => setEstado(ler()); window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, [chave]);
  const mudar = (valor: EstadoOrdenacao) => { const campo = campos.some(c => c.chave === valor.campo) ? valor.campo : ""; const novo = { ...valor, campo }; setEstado(novo); const url = new URL(window.location.href); if (campo) { url.searchParams.set(`${chave}Campo`, campo); url.searchParams.set(`${chave}Direcao`, valor.direcao); } else { url.searchParams.delete(`${chave}Campo`); url.searchParams.delete(`${chave}Direcao`); } window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); aoMudar?.(); };
  const controle: ControleOrdenacao = { ...estado, campos, mudar, restaurar: () => mudar({ campo: "", direcao: "asc" }) };
  return { controle, ordenar: (itens: readonly T[]) => ordenarColecao(itens, campos, estado) };
}
