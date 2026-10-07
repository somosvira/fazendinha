// Visão geral do Rebanho — GET /pecuaria/rebanho/painel. Métricas, "Por
// categoria"/"Por sítio" (listas divide-y com barra proporcional), "Baixas no
// período" (30 dias/12 meses) e "Últimos cadastros e baixas", no padrão de
// VisaoGeralFinanceira.tsx. Os cartões e as barras que têm um recorte claro em
// Animais (categoria, sítio, baixas) são links — leia `filtrosAnimais` abaixo.

import { useEffect, useState } from "react";
import { ChevronRight, MapPin, Plus, TrendingDown, Users } from "lucide-react";
import { obterPainelRebanho } from "../api";
import type { PainelGeral, TipoBaixa } from "../types";
import { formatarDataBR, rotuloClasseMotivo, rotuloTipoBaixa } from "../lib/rotulos";
import { navegarPara } from "../../../router";
import { Button, Empty, emDias, ErrorBox, Metric, PageHeader, PaginaCarregando, PaginaFinanceira, Panel } from "../../../financeiro/financeiro-ui";
import { NavRebanho } from "./NavRebanho";

const URL_ANIMAIS = "/pecuaria/rebanho/animais";
const URL_NOVO_ANIMAL = "/pecuaria/rebanho/animais/novo";

const ROTULO_EVENTO: Record<string, string> = { CADASTRO: "Cadastro", BAIXA: "Baixa", ESTORNO: "Estorno de baixa" };

const PERIODOS_BAIXAS = [
  { valor: 30, rotulo: "30 dias" },
  { valor: 365, rotulo: "12 meses" },
] as const;

/** Monta a URL de Animais com os filtros equivalentes — usado pelos cartões e
 *  pelas barras clicáveis. Valores `undefined`/vazios não entram na query. */
function filtrosAnimais(params: Record<string, string | number | boolean | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== "") usp.set(chave, String(valor));
  }
  const query = usp.toString();
  return `${URL_ANIMAIS}${query ? `?${query}` : ""}`;
}

function BarraProporcional({ valor, maximo }: { valor: number; maximo: number }) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-mast" style={{ width: `${pct}%` }} /></div>;
}

/** Cartão/barra inteiros clicáveis — mesmo tratamento visual dos itens de "Últimos
 *  cadastros e baixas" (botão de largura total, sem sublinhado). */
function LinhaClicavel({ href, className = "", children }: { href: string; className?: string; children: React.ReactNode }) {
  return <button type="button" onClick={() => navegarPara(href)} className={`block w-full text-left hover:bg-surface-2 ${className}`}>{children}</button>;
}

export function VisaoGeral({ podeLancar = true }: { podeLancar?: boolean }) {
  const [painel, setPainel] = useState<PainelGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [periodoBaixas, setPeriodoBaixas] = useState<30 | 365>(30);
  const [carregandoBaixas, setCarregandoBaixas] = useState(false);

  useEffect(() => {
    let vigente = true;
    const primeiraCarga = painel === null;
    if (primeiraCarga) setCarregando(true); else setCarregandoBaixas(true);
    obterPainelRebanho({ periodoDias: periodoBaixas })
      .then((dados) => { if (vigente) setPainel(dados); })
      .catch((e) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (vigente) { setCarregando(false); setCarregandoBaixas(false); } });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoBaixas]);

  if (carregando) return <PaginaCarregando label="Carregando painel do rebanho" />;

  const maxCategoria = painel ? Math.max(1, ...painel.porCategoria.map((c) => c.qtd)) : 1;
  const maxSitio = painel ? Math.max(1, ...painel.porSitio.map((s) => s.qtd)) : 1;

  const voluntario = painel?.baixasPorClasse.find((c) => c.classe === "DESCARTE_VOLUNTARIO")?.qtd ?? 0;
  const involuntario = painel?.baixasPorClasse.find((c) => c.classe === "DESCARTE_INVOLUNTARIO")?.qtd ?? 0;
  const totalDescarteClassificado = voluntario + involuntario;
  const pctVoluntario = totalDescarteClassificado > 0 ? Math.round((voluntario / totalDescarteClassificado) * 100) : null;

  const hrefTipoBaixa = (tipo: TipoBaixa) => filtrosAnimais({ situacao: "BAIXADO", tipoBaixa: tipo, baixaDe: emDias(-periodoBaixas) });

  return <PaginaFinanceira>
    <PageHeader eyebrow="Pecuária" titulo="Visão geral" descricao="Acesse as rotinas do campo e acompanhe o rebanho." acao={podeLancar ? <Button onClick={() => navegarPara(URL_NOVO_ANIMAL)}><Plus size={16} /> Novo animal</Button> : undefined} />
    <NavRebanho ativa="visao-geral" />
    <ErrorBox erro={erro} />
    <Panel className="mt-6 p-5"><h2 className="h2">Por onde começar?</h2><p className="mt-2 text-sm text-ink-3">Escolha a rotina. Os indicadores do rebanho continuam abaixo.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      { titulo: "Fichas de campo", descricao: "Prepare a impressão ou retome uma ficha para preencher.", href: "/pecuaria/rebanho/coletas" },
      { titulo: "Tarefas sanitárias", descricao: "Consulte a agenda e registre o que foi realizado.", href: "/pecuaria/rebanho/sanidade?aba=agenda&visaoAgenda=tarefas" },
      { titulo: "Resultados de exames", descricao: "Consulte as coletas e complete os resultados pendentes.", href: "/pecuaria/rebanho/sanidade?aba=exames" },
      { titulo: "Consumo dos lotes", descricao: "Confira o consumo diário e consulte o histórico global.", href: "/pecuaria/rebanho/nutricao?aba=consumos" },
    ].map((item) => <LinhaClicavel key={item.href} href={item.href} className="rounded-lg border border-border p-4"><strong className="block text-sm">{item.titulo} →</strong><span className="mt-2 block text-sm text-ink-3">{item.descricao}</span></LinhaClicavel>)}</div></Panel>
    {painel && <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Animais ativos" valor={painel.ativos.toLocaleString("pt-BR")} detalhe="Efetivo atual do rebanho" icon={Users} />
        <Metric label="Receptoras" valor={`${painel.receptorasPct.toLocaleString("pt-BR")}%`} detalhe="Das fêmeas ativas" icon={Users} />
        <Metric label="Sítios com animais" valor={String(painel.porSitio.length)} detalhe="Sítios com pelo menos um animal ativo" icon={MapPin} />
        <LinhaClicavel href={filtrosAnimais({ situacao: "BAIXADO", baixaDe: emDias(-30) })} className="rounded-xl">
          <Metric label="Baixas em 30 dias" valor={String(painel.baixas30d)} detalhe="Vendas, abates, mortes e demais baixas" icon={TrendingDown} />
        </LinhaClicavel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Por categoria</h2></div>
          {painel.porCategoria.length ? <div className="divide-y divide-border">{painel.porCategoria.map((c) => <LinhaClicavel key={c.categoriaId ?? "sem-categoria"} href={filtrosAnimais(c.categoriaId ? { categoriaId: c.categoriaId } : { semCategoria: true })} className="px-5 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span>{c.categoria}</span><strong>{c.qtd}</strong></div><BarraProporcional valor={c.qtd} maximo={maxCategoria} /></LinhaClicavel>)}</div> : <Empty>Nenhum animal ativo.</Empty>}
        </Panel>
        <Panel className="overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Por sítio</h2></div>
          {painel.porSitio.length ? <div className="divide-y divide-border">{painel.porSitio.map((s) => <LinhaClicavel key={s.propriedadeId ?? "sem-sitio"} href={filtrosAnimais({ propriedadeId: s.propriedadeId ?? undefined })} className="px-5 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{s.nome}</span><strong>{s.qtd}</strong></div><BarraProporcional valor={s.qtd} maximo={maxSitio} /></LinhaClicavel>)}</div> : <Empty>Nenhum animal ativo.</Empty>}
        </Panel>
      </div>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-serif text-xl">Baixas no período</h2>
          <div role="group" aria-label="Período das baixas" className="inline-flex overflow-hidden rounded-lg border border-border bg-white p-0.5">
            {PERIODOS_BAIXAS.map(({ valor, rotulo }) => <button
              key={valor}
              type="button"
              aria-pressed={periodoBaixas === valor}
              disabled={carregandoBaixas}
              onClick={() => setPeriodoBaixas(valor)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${periodoBaixas === valor ? "bg-mast text-white" : "text-ink-2 hover:bg-surface-2"}`}
            >{rotulo}</button>)}
          </div>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Por tipo</h3>
            {painel.baixasPorTipo.length ? <ul className="mt-3 space-y-1">{painel.baixasPorTipo.map((item) => <li key={item.tipo}><LinhaClicavel href={hrefTipoBaixa(item.tipo)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm"><span>{rotuloTipoBaixa(item.tipo)}</span><strong>{item.qtd}</strong></LinhaClicavel></li>)}</ul> : <Empty>Nenhuma baixa no período.</Empty>}
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Por classe</h3>
            {painel.baixasPorClasse.length ? <ul className="mt-3 space-y-1">{painel.baixasPorClasse.map((item) => <li key={item.classe} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm"><span>{item.classe === "SEM_MOTIVO" ? "Sem motivo" : rotuloClasseMotivo(item.classe)}</span><strong>{item.qtd}</strong></li>)}</ul> : <Empty>Nenhuma baixa classificada no período.</Empty>}
            {pctVoluntario !== null && <p className="mt-3 px-2 text-xs text-ink-3">{pctVoluntario}% das baixas por descarte classificado foram voluntárias ({voluntario} de {totalDescarteClassificado}).</p>}
          </div>
        </div>
      </Panel>

      <Panel className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border p-5"><h2 className="font-serif text-xl">Últimos cadastros e baixas</h2><button onClick={() => navegarPara(URL_ANIMAIS)} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-green-800">Ver todos <ChevronRight size={15} /></button></div>
        {painel.ultimosEventos.length ? <div className="divide-y divide-border">{painel.ultimosEventos.map((evento, indice) => <button key={`${evento.animalId}-${indice}`} onClick={() => navegarPara(`${URL_ANIMAIS}/${evento.animalId}`)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-2"><div className="min-w-0"><strong className="break-words">{evento.brinco}</strong><div className="mt-1 text-xs text-ink-3">{ROTULO_EVENTO[evento.tipo] ?? evento.tipo}</div></div><span className="shrink-0 text-xs text-ink-3">{formatarDataBR(evento.data)}</span></button>)}</div> : <Empty>Nenhum evento recente.</Empty>}
      </Panel>
    </>}
  </PaginaFinanceira>;
}
