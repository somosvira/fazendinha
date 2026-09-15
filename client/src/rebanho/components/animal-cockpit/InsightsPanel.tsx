// Painel executivo do animal — 10 componentes minimalistas que consomem AnimalInsightsDTO.
// Filosofia: maioria transparente com border-left de cor (estilo .rb-ia-band); .rb-box reservado
// para dados estruturados. Sempre indicar "estimativa" quando o dado vier de fallback ou inferência.

import { AnimalIdentity } from "../AnimalIdentity";
import type {
  ScoreDTO, FinanceiroDTO, TendenciaDTO, InsightDTO, PercentisDTO,
  ProducaoFinanceiraDTO, EficienciaDTO, ProjecoesDTO, GenealogiaDTO,
} from "../../api";
import { fmtBRL as fmtBRLCanon, fmtMoneyExact } from "@/components/charts";
import { RadialBar, RadialBarChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

// Reusa os formatadores canônicos de charts.tsx (negativos com − U+2212):
// fmtBRL sem centavos (não-compacto) e fmtMoneyExact para os valores com 2 casas.
const fmtBRL = (n: number) => fmtBRLCanon(n, { compact: false });
const fmtBRLExato = fmtMoneyExact;
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;

const LABEL_CLAS: Record<ScoreDTO["classificacao"], string> = {
  ELITE: "Elite", MUITO_BOA: "Muito boa", BOA: "Boa", ATENCAO: "Atenção", DESCARTE: "Descarte recomendado",
};

// ── 1. Score (selo discreto ao lado do nome) ───────────────────────────────
export function ScoreBadge({ score }: { score: ScoreDTO }) {
  const cheias = score.estrelas;
  const tom = score.classificacao === "ELITE" || score.classificacao === "MUITO_BOA"
    ? "ok" : score.classificacao === "DESCARTE" || score.classificacao === "ATENCAO" ? "warn" : "";
  const labTomCls = tom === "ok"
    ? "text-lucro border-[color:color-mix(in_srgb,var(--lucro)_30%,var(--rule))]"
    : tom === "warn"
    ? "text-prejuizo border-[color:color-mix(in_srgb,var(--prejuizo)_30%,var(--rule))]"
    : "text-ink-3 border-[color:var(--rule)]";
  return (
    <span className="inline-flex items-center gap-2 ml-3.5 align-[6px] font-sans" title={`Score ${score.valor}/100 — ${LABEL_CLAS[score.classificacao]}`}>
      <span className="text-sm tracking-[1px] leading-none text-ink-2" aria-label={`${cheias} de 5 estrelas`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < cheias ? "text-leite" : "text-[color:var(--rule)]"}>★</span>
        ))}
      </span>
      <span className={`text-sm tracking-[.06em] uppercase font-semibold px-[9px] py-[3px] border rounded-[11px] ${labTomCls}`}>{LABEL_CLAS[score.classificacao]}</span>
    </span>
  );
}

// ── 2. Rentabilidade (KPI grande no topo) ──────────────────────────────────
export function RentabilidadeKpi({ f }: { f: FinanceiroDTO }) {
  const cor = f.tom === "pos" ? "var(--lucro)" : f.tom === "neg" ? "var(--prejuizo)" : "var(--atencao)";
  const interpretacao = f.tom === "pos"
    ? "Esta vaca paga seus custos."
    : f.tom === "neg"
    ? "Esta vaca não paga seus custos."
    : "Margem apertada — atenção.";
  return (
    <div className="relative bg-transparent border-l border-[color:var(--rule-soft)] pl-[18px] pr-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5" style={{ borderLeft: `3px solid ${cor}` }}>
      <div className="text-sm tracking-[.06em] uppercase text-ink-2 font-semibold">Rentabilidade {f.fontePreco === "fallback" && <small>(estimativa)</small>}</div>
      <div className="grid grid-cols-2 gap-[18px] mt-1.5 items-end max-[1100px]:grid-cols-1 max-[1100px]:gap-2.5">
        <div>
          <div className="font-serif text-[30px] font-medium leading-none text-[color:var(--ink)]" style={{ color: cor }}>{fmtBRL(f.lucro)}</div>
          <div className="text-sm text-ink-2 mt-1.5 font-medium">{interpretacao}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-ink-2 font-medium"><span>Receita</span><b className="font-semibold text-[color:var(--ink)]">{fmtBRL(f.receitaLactacao)}</b></div>
          <div className="flex justify-between text-sm text-ink-2 font-medium"><span>Custos</span><b className="font-semibold text-[color:var(--ink)]">{fmtBRL(f.custosTotal)}</b></div>
          <div className="flex justify-between text-sm text-ink-2 font-medium"><span>Margem</span><b className="font-semibold" style={{ color: cor }}>{fmtPct(f.margem)}</b></div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Tendências (lista compacta) ─────────────────────────────────────────
export function Tendencias({ tendencias }: { tendencias: TendenciaDTO[] }) {
  if (tendencias.length === 0) return null;
  const seta = (d: TendenciaDTO["direcao"]) => d === "up" ? "⬈" : d === "down" ? "⬊" : "→";
  const corClass = (s: TendenciaDTO["sentido"]) => s === "pos" ? "text-lucro" : s === "neg" ? "text-prejuizo" : "text-ink-3";
  return (
    <div className="mt-[22px]">
      <h4 className="font-serif italic font-medium text-[15px] text-[color:var(--ink)] mb-2.5">Tendências</h4>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {tendencias.map((t) => (
          <li key={t.chave} className="grid grid-cols-[24px_1fr_auto] items-center gap-2.5 py-1.5 border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0 text-sm">
            <span className={`text-base leading-none text-center ${corClass(t.sentido)}`}>{seta(t.direcao)}</span>
            <span className="text-ink-2">{t.label}</span>
            {t.delta && <span className="text-ink-3 text-sm italic">{t.delta}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 4. Insights (alertas) ──────────────────────────────────────────────────
export function Insights({ insights }: { insights: InsightDTO[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="mt-[22px]">
      <h4 className="font-serif italic font-medium text-[15px] text-[color:var(--ink)] mb-2.5">Insights</h4>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {insights.map((i, idx) => (
          <li key={idx} className={`grid grid-cols-[22px_1fr] gap-3 items-start px-3.5 py-2.5 bg-transparent border-0 border-l-2 ${i.tipo === "warn" ? "border-l-[color:var(--prejuizo)]" : i.tipo === "ok" ? "border-l-[color:var(--lucro)]" : "border-l-[color:var(--rule)]"}`}>
            <span className={`text-sm leading-[1.6] ${i.tipo === "warn" ? "text-prejuizo" : i.tipo === "ok" ? "text-lucro" : "text-ink-3"}`}>{i.tipo === "warn" ? "⚠" : "✓"}</span>
            <div>
              <div className="text-sm text-ink-2 leading-[1.4]">{i.titulo}</div>
              {i.detalhe && <div className="text-sm text-ink-3 mt-1">{i.detalhe}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 5. Percentis (comparação com rebanho) ─────────────────────────────────
export function Percentis({ p }: { p: PercentisDTO }) {
  const linhas: { lab: string; val: number | null; baseHint?: string }[] = [
    { lab: "Produção", val: p.producao },
    { lab: "Rentabilidade", val: p.rentabilidade },
    { lab: "Fertilidade", val: p.fertilidade },
    { lab: "CCS", val: p.ccs, baseHint: "menor = melhor" },
  ];
  return (
    <div className="mt-[22px]">
      <h4 className="font-serif italic font-medium text-[15px] text-[color:var(--ink)] mb-2.5">Comparação com o lote</h4>
      <div className="flex flex-col gap-2.5">
        {linhas.map((l) => (
          <div key={l.lab} className="grid grid-cols-[110px_1fr_90px] gap-3 items-center text-sm max-[1100px]:[grid-template-columns:90px_1fr_80px]">
            <div className="text-ink-2">{l.lab}</div>
            <div className="h-1.5 bg-[color:var(--rule-soft)] rounded-[3px] overflow-hidden"><div className="h-full bg-leite rounded-[3px] transition-[width] duration-[250ms] ease-[ease]" style={{ width: `${l.val ?? 0}%` }} /></div>
            <div className="text-ink-3 text-sm text-right">{l.val != null ? `${l.val}º percentil` : "—"}</div>
          </div>
        ))}
      </div>
      {p.ranking && <p className="font-serif italic text-sm text-ink-2 mt-2.5">{p.ranking.posicao}ª de {p.ranking.total} em produção</p>}
    </div>
  );
}

// ── 6. Produção financeira (expansão) ──────────────────────────────────────
export function ProducaoFinanceira({ pf }: { pf: ProducaoFinanceiraDTO }) {
  return (
    <div className="bg-[color:var(--bg-card)] border border-[color:var(--rule-soft)] rounded-[10px] px-4 py-[15px] mb-4">
      <h4 className="mb-[11px] text-sm tracking-[.06em] uppercase text-ink-3">Produção financeira</h4>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Acumulado</span><b className="font-semibold">{fmtNum(pf.acumuladoLitros)} L</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Valor recebido</span><b className="font-semibold">{fmtBRL(pf.valorRecebido)}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Preço médio</span><b className="font-semibold">{fmtBRLExato(pf.precoMedio)}/L</b></div>
      {pf.lucroPorLitro != null && (
        <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Lucro por litro</span><b className="font-semibold">{fmtBRLExato(pf.lucroPorLitro)}</b></div>
      )}
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Receita diária</span><b className="font-semibold">{fmtBRLExato(pf.receitaDiaria)}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Receita mensal estimada</span><b className="font-semibold">{fmtBRL(pf.receitaMensal)}</b></div>
    </div>
  );
}

// ── 7. Eficiência (arc minimalista) ────────────────────────────────────────
export function EficienciaGauge({ e }: { e: EficienciaDTO }) {
  if (e.meta == null || e.atual == null || e.percentual == null) return null;
  const pct = Math.min(100, e.percentual);
  const tom = pct >= 90 ? "var(--lucro)" : pct >= 60 ? "var(--atencao)" : "var(--prejuizo)";
  return (
    <div className="mt-[22px]">
      <h4 className="font-serif italic font-medium text-[15px] text-[color:var(--ink)] mb-2.5">Eficiência</h4>
      <div className="flex flex-col items-center gap-0 mb-3">
        <ChartContainer config={{ value: { label: "Eficiência", color: tom } }} className="h-[70px] w-[120px] aspect-auto" aria-hidden>
          <RadialBarChart cx={60} cy={60} innerRadius={49} outerRadius={56} startAngle={180} endAngle={0} data={[{ value: pct }]}>
            <RadialBar dataKey="value" fill="var(--color-value)" background={{ fill: "var(--rule-soft)" }} cornerRadius={5} isAnimationActive={false} />
          </RadialBarChart>
        </ChartContainer>
        <div className="font-serif font-medium text-[22px] -mt-2.5" style={{ color: tom }}>{e.percentual}%</div>
      </div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Atual</span><b className="font-semibold">{e.atual} L/dia</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Meta</span><b className="font-semibold">{e.meta} L/dia</b></div>
    </div>
  );
}

// ── 8. Projeções ───────────────────────────────────────────────────────────
export function Projecoes({ p, fontePreco }: { p: ProjecoesDTO; fontePreco: FinanceiroDTO["fontePreco"] }) {
  const data = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  return (
    <div className="bg-[color:var(--bg-card)] border border-[color:var(--rule-soft)] rounded-[10px] px-4 py-[15px] mb-4">
      <h4 className="mb-[11px] text-sm tracking-[.06em] uppercase text-ink-3">Projeções <small style={{ fontWeight: 500, color: "var(--ink-2)" }}>(estimativa{fontePreco === "fallback" ? " · preço de fallback" : ""})</small></h4>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Produção da lactação</span><b className="font-semibold">{p.producaoLactacao != null ? `${fmtNum(p.producaoLactacao)} L` : "—"}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Receita esperada</span><b className="font-semibold">{p.receitaLactacao != null ? fmtBRL(p.receitaLactacao) : "—"}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Lucro esperado</span><b className="font-semibold">{p.lucroLactacao != null ? fmtBRL(p.lucroLactacao) : "—"}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Data prevista de secagem</span><b className="font-semibold">{data(p.dataSecagem)}</b></div>
      <div className="flex justify-between text-sm py-[5px] border-b border-dashed border-[color:var(--rule-soft)] last:border-b-0"><span>Parto previsto</span><b className="font-semibold">{data(p.dataParto)}</b></div>
    </div>
  );
}

// ── 9. Genealogia ──────────────────────────────────────────────────────────
export function Genealogia({ g, onAbrirAnimal }: { g: GenealogiaDTO; onAbrirAnimal: (id: string) => void }) {
  return (
    <div className="bg-[color:var(--bg-card)] border border-[color:var(--rule-soft)] rounded-[10px] px-4 py-[15px] mb-4">
      <h4 className="mb-[11px] text-sm tracking-[.06em] uppercase text-ink-3">Genealogia</h4>
      <div className="grid grid-cols-2 gap-[18px] mt-2 max-[600px]:grid-cols-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Mãe</span>
            {g.mae ? (
              <button className="cursor-pointer border-0 bg-transparent p-0 text-right text-cafe hover:underline" onClick={() => onAbrirAnimal(g.mae!.id)}><AnimalIdentity numero={g.mae.numero} nome={g.mae.nome} /></button>
            ) : <span className="text-ink-2 text-sm italic text-right">—</span>}
          </div>
          {g.mae?.producaoMediaDia != null && <div className="text-sm text-ink-3 italic text-right -mt-1 mb-0.5">produção {g.mae.producaoMediaDia} L/dia</div>}
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Avó materna</span>
            {g.avoMaterna ? (
              <button className="cursor-pointer border-0 bg-transparent p-0 text-right text-cafe hover:underline" onClick={() => onAbrirAnimal(g.avoMaterna!.id)}><AnimalIdentity numero={g.avoMaterna.numero} nome={g.avoMaterna.nome} /></button>
            ) : <span className="text-ink-2 text-sm italic text-right">sem registro</span>}
          </div>
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Avô materno</span>
            <span className="text-ink-2 text-sm text-right">{g.avoMaterno ?? "sem registro"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Pai</span>
            <span className="text-ink-2 text-sm text-right">{g.pai ?? "—"}</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Avó paterna</span>
            <span className="text-ink-2 text-sm italic text-right">sem registro</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 text-sm py-1 border-b border-dashed border-[color:var(--rule-soft)] [&>span:first-child]:text-ink-3 [&>span:first-child]:text-sm">
            <span>Avô paterno</span>
            <span className="text-ink-2 text-sm italic text-right">sem registro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
