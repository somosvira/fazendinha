import { useEffect, useMemo, useState } from "react";
import type { Tab } from "./Shell";
import { FechamentoMensalRelatorio } from "./Relatorio";
import { RelatorioGerencial } from "./relatorio-gerencial/RelatorioGerencial";
import { cn } from "@/lib/utils";

type Area = "Todos" | "Rebanho" | "Reprodução" | "Sanidade" | "Produção" | "Financeiro" | "Estoque";
type RelatorioCatalogo = {
  id: string;
  titulo: string;
  descricao: string;
  area: Exclude<Area, "Todos">;
  palavras: string[];
  destino?: Tab;
  interno?: "fechamento" | "gerencial";
  formato: "Lista operacional" | "Análise" | "Documento";
  disponivel?: boolean;
};

const FAVORITOS_KEY = "terrano:relatorios:favoritos";
const RECENTES_KEY = "terrano:relatorios:recentes";

export const CATALOGO_RELATORIOS: RelatorioCatalogo[] = [
  { id: "situacao-reprodutiva", titulo: "Avaliação da situação reprodutiva", descricao: "Monte a lista de matrizes com situação, dias, ordem de serviço e dados reprodutivos.", area: "Reprodução", palavras: ["matriz", "cio", "inseminação", "prenhez", "ideagri"], destino: "reb-relatorios", formato: "Lista operacional", disponivel: true },
  { id: "inseminacoes", titulo: "Inseminações no período", descricao: "Uma linha por tentativa, com touro, sêmen, protocolo e acesso à ficha.", area: "Reprodução", palavras: ["ia", "serviço", "touro", "sêmen"], destino: "reb-relatorios", formato: "Lista operacional", disponivel: true },
  { id: "diagnosticos", titulo: "Diagnósticos de gestação", descricao: "Diagnósticos positivos, negativos e matrizes aguardando avaliação.", area: "Reprodução", palavras: ["dg", "prenhe", "vazia"], destino: "reb-relatorios", formato: "Lista operacional", disponivel: true },
  { id: "partos", titulo: "Partos previstos e realizados", descricao: "Agenda de partos, histórico, crias e ocorrências do período.", area: "Reprodução", palavras: ["parto", "cria", "gestação"], destino: "reb-relatorios", formato: "Lista operacional", disponivel: true },
  { id: "ficha-animal", titulo: "Ficha completa do animal", descricao: "Prontuário cronológico produtivo, reprodutivo e sanitário.", area: "Rebanho", palavras: ["histórico", "prontuário", "resumo", "animal"], destino: "reb-animal", formato: "Documento" },
  { id: "rebanho-quantitativo", titulo: "Rebanho quantitativo", descricao: "Efetivo atual por categoria, grupo e faixa etária.", area: "Rebanho", palavras: ["estoque", "cabeças", "categoria", "lote"], destino: "reb-dashboard", formato: "Análise" },
  { id: "medicamentos", titulo: "Medicamentos aplicados", descricao: "Aplicações, produtos, doses, responsáveis e custos por animal.", area: "Sanidade", palavras: ["tratamento", "aplicação", "vacina", "doença"], destino: "reb-sanidade", formato: "Lista operacional" },
  { id: "carencias", titulo: "Animais em carência", descricao: "Animais com leite ou carne bloqueados e respectivas datas de liberação.", area: "Sanidade", palavras: ["leite", "medicamento", "descarte"], destino: "reb-sanidade", formato: "Lista operacional" },
  { id: "mastite", titulo: "Mastite e CMT por quarto", descricao: "Casos clínicos, recorrência, tratamentos e evolução por quarto mamário.", area: "Sanidade", palavras: ["ccs", "cmt", "úbere", "teta"], destino: "reb-sanidade", formato: "Análise" },
  { id: "lactacoes", titulo: "Histórico de lactações", descricao: "Produção, duração, pico, persistência e motivo de secagem por ciclo.", area: "Produção", palavras: ["leite", "305", "del", "secagem"], destino: "reb-producao", formato: "Análise" },
  { id: "qualidade-leite", titulo: "Qualidade do leite", descricao: "CCS individual, faixas de atenção e resultados do tanque.", area: "Produção", palavras: ["ccs", "cbt", "gordura", "proteína", "tanque"], destino: "reb-producao", formato: "Análise" },
  { id: "fechamento", titulo: "Fechamento financeiro mensal", descricao: "Documento executivo do mês, com fluxo, leite, café e investimentos.", area: "Financeiro", palavras: ["caixa", "dre", "saldo", "pdf", "mensal"], interno: "fechamento", formato: "Documento", disponivel: true },
  { id: "financeiro-gerencial", titulo: "Relatório financeiro gerencial", descricao: "Documento configurável por período e propriedade: saldo por conta, entradas e saídas, resultado, compromissos e categorias.", area: "Financeiro", palavras: ["gerencial", "pdf", "csv", "saldo", "conta", "compromissos", "a pagar", "a receber", "categoria", "centro de custo", "período"], interno: "gerencial", formato: "Documento", disponivel: true },
  { id: "custos-rebanho", titulo: "Custos do rebanho", descricao: "Custos produtivos e sanitários por animal, grupo e período.", area: "Financeiro", palavras: ["custo", "animal", "grupo", "sanidade"], destino: "reb-custo", formato: "Análise" },
  { id: "posicao-estoque", titulo: "Posição de estoque", descricao: "Saldos, lotes, locais de armazenamento e produtos a vencer.", area: "Estoque", palavras: ["validade", "lote", "produto", "saldo"], destino: "reb-estoque", formato: "Lista operacional" },
];

const AREAS: Area[] = ["Todos", "Rebanho", "Reprodução", "Sanidade", "Produção", "Financeiro", "Estoque"];

function lerLista(chave: string): string[] {
  try { const valor = JSON.parse(localStorage.getItem(chave) ?? "[]"); return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : []; }
  catch { return []; }
}

function IconeRelatorio({ area }: { area: RelatorioCatalogo["area"] }) {
  const simbolo: Record<RelatorioCatalogo["area"], string> = { Rebanho: "A", Reprodução: "R", Sanidade: "+", Produção: "L", Financeiro: "$", Estoque: "E" };
  return <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color:var(--bg)] font-serif text-sm font-semibold text-leite">{simbolo[area]}</span>;
}

export function Relatorios({ onNav }: { onNav: (tab: Tab) => void }) {
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState<Area>("Todos");
  const [aba, setAba] = useState<"modelos" | "favoritos" | "recentes">("modelos");
  const [favoritos, setFavoritos] = useState<string[]>(() => lerLista(FAVORITOS_KEY));
  const [recentes, setRecentes] = useState<string[]>(() => lerLista(RECENTES_KEY));
  const [interno, setInterno] = useState<RelatorioCatalogo["interno"] | null>(null);

  useEffect(() => { try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(favoritos)); } catch { /* storage indisponível */ } }, [favoritos]);
  useEffect(() => { try { localStorage.setItem(RECENTES_KEY, JSON.stringify(recentes)); } catch { /* storage indisponível */ } }, [recentes]);

  const resultados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return CATALOGO_RELATORIOS.filter((relatorio) => {
      if (area !== "Todos" && relatorio.area !== area) return false;
      if (aba === "favoritos" && !favoritos.includes(relatorio.id)) return false;
      if (aba === "recentes" && !recentes.includes(relatorio.id)) return false;
      return !termo || [relatorio.titulo, relatorio.descricao, relatorio.area, ...relatorio.palavras].join(" ").toLocaleLowerCase("pt-BR").includes(termo);
    }).sort((a, b) => aba === "recentes" ? recentes.indexOf(a.id) - recentes.indexOf(b.id) : a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [aba, area, busca, favoritos, recentes]);

  function abrir(relatorio: RelatorioCatalogo) {
    if (!relatorio.disponivel) return;
    setRecentes((atuais) => [relatorio.id, ...atuais.filter((id) => id !== relatorio.id)].slice(0, 8));
    if (relatorio.interno) setInterno(relatorio.interno);
    else if (relatorio.destino) onNav(relatorio.destino);
  }

  if (interno === "fechamento") return <FechamentoMensalRelatorio onNav={onNav} onVoltar={() => setInterno(null)} />;
  if (interno === "gerencial") return <RelatorioGerencial onVoltar={() => setInterno(null)} />;

  return <main className="shell-wide pb-24">
    <header className="border-b border-border pb-6 pt-8">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-leite">Toda a fazenda</p>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="m-0 font-serif text-[42px] font-normal leading-tight">Relatórios</h1><p className="mb-0 mt-2 max-w-2xl text-sm text-ink-3">Consulte, monte e exporte informações financeiras, produtivas e zootécnicas sem duplicar os painéis operacionais.</p></div><button type="button" className="btn-primary" onClick={() => onNav("reb-relatorios")}>+ Criar relatório</button></div>
    </header>

    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <label className="relative block"><span className="sr-only">Buscar relatório</span><input className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-leite" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por relatório, dado ou finalidade…" /></label>
      <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card" aria-label="Visualização dos relatórios">{(["modelos", "favoritos", "recentes"] as const).map((id) => <button key={id} type="button" className={cn("border-0 bg-transparent px-4 py-3 text-sm capitalize text-ink-3", aba === id && "bg-mast text-mast-ink")} onClick={() => setAba(id)}>{id}</button>)}</div>
    </div>

    <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar por categoria">{AREAS.map((item) => <button key={item} type="button" className={cn("rounded-full border border-border bg-transparent px-3.5 py-2 text-xs text-ink-3", area === item && "border-mast bg-mast text-mast-ink")} onClick={() => setArea(item)}>{item}</button>)}</nav>

    <section className="mt-7" aria-live="polite">
      <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="m-0 font-serif text-2xl font-medium">{aba === "modelos" ? area === "Todos" ? "Todos os modelos" : area : aba === "favoritos" ? "Favoritos" : "Acessados recentemente"}</h2><span className="text-xs text-ink-3">{resultados.length} {resultados.length === 1 ? "relatório" : "relatórios"}</span></div>
      {resultados.length === 0 ? <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center text-sm text-ink-3">{aba === "favoritos" ? "Favorite os relatórios mais usados para encontrá-los aqui." : aba === "recentes" ? "Os relatórios abertos aparecerão aqui." : "Nenhum relatório corresponde a essa busca."}</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{resultados.map((relatorio) => {
        const favorito = favoritos.includes(relatorio.id);
        return <article key={relatorio.id} className="group flex min-h-[190px] flex-col rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-[color:var(--cafe)]">
          <div className="flex items-start justify-between gap-3"><IconeRelatorio area={relatorio.area} /><button type="button" aria-label={`${favorito ? "Remover" : "Adicionar"} ${relatorio.titulo} ${favorito ? "dos" : "aos"} favoritos`} className={cn("border-0 bg-transparent p-1 text-xl text-ink-3", favorito && "text-[color:var(--cafe)]")} onClick={() => setFavoritos((atuais) => favorito ? atuais.filter((id) => id !== relatorio.id) : [...atuais, relatorio.id])}>{favorito ? "★" : "☆"}</button></div>
          <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-[.12em] text-leite">{relatorio.area} · {relatorio.formato}</p><h3 className="m-0 font-serif text-xl font-medium leading-tight">{relatorio.titulo}</h3><p className="mb-4 mt-2 flex-1 text-sm leading-relaxed text-ink-3">{relatorio.descricao}</p>
          {relatorio.disponivel ? <button type="button" aria-label={`Abrir ${relatorio.titulo}`} className="self-start border-0 bg-transparent p-0 text-sm font-semibold text-foreground group-hover:text-[color:var(--cafe)]" onClick={() => abrir(relatorio)}>Abrir relatório →</button> : <span className="self-start rounded-full bg-[color:var(--bg)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Em preparação</span>}
        </article>;
      })}</div>}
    </section>
  </main>;
}
