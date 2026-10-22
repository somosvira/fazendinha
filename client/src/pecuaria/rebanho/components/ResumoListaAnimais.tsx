import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartNoAxesCombined, Heart, Layers, Venus } from "lucide-react";
import { ChartContainer, ChartTooltip } from "../../../components/ui/chart";
import { VacaIcon } from "../../../components/icons/VacaIcon";
import type { CategoriaDTO, PainelServidor } from "../types";
import { CORES_REBANHO, percentualRebanho } from "./GraficosRebanho";

type FatiaCategoria = { id: string | null; nome: string; total: number; outras?: boolean; detalhe?: string };
export type IndicadorListaAnimais = "ativos" | "femeas" | "receptoras" | "lotes";

export function TooltipComposicaoLista({ active, payload, fatias, total }: {
  active?: boolean; payload?: readonly { dataKey?: unknown }[]; fatias: FatiaCategoria[]; total: number;
}) {
  const indice = fatias.findIndex((_, i) => payload?.[0]?.dataKey === `categoria${i}`);
  const fatia = fatias[indice];
  if (!active || !fatia) return null;
  return <div className="animais-tooltip-composicao" role="tooltip">
    <header><i aria-hidden="true" style={{ background: CORES_REBANHO[indice] }} /><strong>{fatia.nome}</strong></header>
    <p>{fatia.total.toLocaleString("pt-BR")} {fatia.total === 1 ? "animal ativo" : "animais ativos"} <span>· {percentualRebanho(fatia.total, total)} do efetivo</span></p>
    {fatia.detalhe && <small>{fatia.detalhe}</small>}
  </div>;
}

/** Agregado de ativos fornecido pelo servidor: nunca usa apenas a página da tabela. */
export function distribuirCategoriasLista(painel: PainelServidor, categorias: CategoriaDTO[]): FatiaCategoria[] {
  const dados = painel.porCategoria.filter(c => c.total > 0).map(c => {
    const cadastro = categorias.find(cat => cat.id === c.categoria?.id);
    const nome = c.categoria?.nome ?? "Sem categoria";
    const homonimas = painel.porCategoria.filter(cat => cat.categoria?.nome === nome).length > 1;
    return {
      id: c.categoria?.id ?? null,
      nome: homonimas ? cadastro ? `${nome} · ${cadastro.sexo === "F" ? "fêmeas" : "machos"}` : `${nome} · ${c.categoria?.id.slice(0, 8)}` : nome,
      total: c.total,
    };
  }).sort((a, b) => b.total - a.total);
  return dados.length <= 6 ? dados : [...dados.slice(0, 5), {
    id: null, nome: "Outras categorias", total: dados.slice(5).reduce((s, c) => s + c.total, 0), outras: true,
    detalhe: dados.slice(5).map(c => `${c.nome}: ${c.total}`).join(" · "),
  }];
}

export function ResumoListaAnimais({ painel, categorias, lotesDisponiveis, onCategoria, onIndicador, onOutras, atualizando = false }: {
  painel: PainelServidor; categorias: CategoriaDTO[]; lotesDisponiveis: number; onCategoria: (id: string | null) => void;
  onIndicador: (indicador: IndicadorListaAnimais) => void; onOutras: () => void; atualizando?: boolean;
}) {
  const fatias = distribuirCategoriasLista(painel, categorias);
  const dados = [Object.fromEntries(fatias.map((f, i) => [`categoria${i}`, f.total]))];
  const config = Object.fromEntries(fatias.map((f, i) => [`categoria${i}`, { label: f.nome, color: CORES_REBANHO[i] }]));
  const indicadores = [
    { id: "ativos" as const, acao: "Filtrar animais ativos", valor: painel.totalAtivos, nome: painel.totalAtivos === 1 ? "animal ativo" : "animais ativos", icone: <VacaIcon width={19} height={19} strokeWidth={1.8} aria-hidden="true" /> },
    { id: "femeas" as const, acao: "Filtrar fêmeas ativas", valor: painel.femeasAtivas, nome: painel.femeasAtivas === 1 ? "fêmea ativa" : "fêmeas ativas", icone: <Venus size={19} aria-hidden="true" /> },
    { id: "receptoras" as const, acao: "Filtrar receptoras", valor: painel.receptorasAtivas, nome: painel.receptorasAtivas === 1 ? "receptora" : "receptoras", icone: <Heart size={19} aria-hidden="true" /> },
    { id: "lotes" as const, acao: "Filtrar por lote", valor: lotesDisponiveis, nome: lotesDisponiveis === 1 ? "lote disponível" : "lotes disponíveis", icone: <Layers size={19} aria-hidden="true" /> },
  ];
  return <section className="animais-resumo-visual" aria-label="Resumo da consulta de animais" aria-busy={atualizando}>
    <div className="animais-indicadores">{indicadores.map(({ id, acao, valor, nome, icone }, i) =>
      <button type="button" disabled={atualizando} onClick={() => onIndicador(id)} aria-label={acao} title={acao} className={`h-auto animais-indicador ${i === 0 ? "animais-indicador-principal" : ""}`} key={id}>
        <span className="animais-indicador-icone">{icone}</span>
        <div><strong>{valor.toLocaleString("pt-BR")}</strong>{" "}<span>{nome}</span></div>
      </button>)}</div>
    <div className="animais-composicao">
      <header><h2><ChartNoAxesCombined size={17} aria-hidden="true" /> Composição do efetivo</h2><small>{atualizando ? "Atualizando recorte…" : fatias.some(f => f.outras) ? "5 maiores + outras · ativos nos filtros" : "Ativos nos filtros · antes da paginação"}</small></header>
      {!fatias.length || painel.totalAtivos <= 0 ? <p className="animais-composicao-vazia">Não há animais ativos neste recorte.</p> : <>
        <ChartContainer config={config} className="animais-composicao-chart" role="img" aria-label="Distribuição dos animais ativos por categoria. Valores na legenda.">
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" hide domain={[0, painel.totalAtivos]} /><YAxis type="category" hide />
            <ChartTooltip shared={false} cursor={false} allowEscapeViewBox={{ x: false, y: true }} wrapperStyle={{ zIndex: 30, pointerEvents: "none" }} content={props => <TooltipComposicaoLista active={props.active} payload={props.payload} fatias={fatias} total={painel.totalAtivos} />} />
            {fatias.map((f, i) => <Bar key={`categoria${i}`} dataKey={`categoria${i}`} stackId="efetivo" fill={CORES_REBANHO[i]} radius={fatias.length === 1 ? 5 : i === 0 ? [5, 0, 0, 5] : i === fatias.length - 1 ? [0, 5, 5, 0] : 0} maxBarSize={16} isAnimationActive={false} style={{ cursor: atualizando ? "wait" : "pointer" }} onClick={() => { if (!atualizando) f.outras ? onOutras() : onCategoria(f.id); }} />)}
          </BarChart>
        </ChartContainer>
        <ul className="animais-composicao-legenda">{fatias.map((f, i) => {
          const conteudo = <><i aria-hidden="true" style={{ background: CORES_REBANHO[i] }} /><span>{f.nome}</span><strong>{f.total.toLocaleString("pt-BR")}</strong><small>{percentualRebanho(f.total, painel.totalAtivos)}</small></>;
          return <li key={`categoria${i}`}><button className="h-auto" type="button" title={f.detalhe ?? f.nome} disabled={atualizando} onClick={() => f.outras ? onOutras() : onCategoria(f.id)} aria-label={f.outras ? "Escolher uma das outras categorias" : `Filtrar categoria: ${f.nome} — ${f.total} ${f.total === 1 ? "animal ativo" : "animais ativos"}`}>{conteudo}</button></li>;
        })}</ul>
      </>}
    </div>
  </section>;
}
