import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "../../components/Loading";
import { Donut, fmtMoney } from "../../components/charts";
import { useCarteira, simularDescarte, type ClassificacaoScore, type AnimalCarteiraDTO, type SimulacaoDescarteDTO } from "../api";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebBox, RebAnm, RebEmpty } from "@/components/rb/RebPrimitives";
import { ComposicaoRacialSection } from "./ComposicaoRacialSection";
import { QuantitativoSection } from "./QuantitativoSection";
import { ClimaChuvaSection } from "./ClimaChuvaSection";

// Rótulo + cor por faixa (melhor → pior). Cores das variáveis da paleta (base.css).
const FAIXAS: { chave: ClassificacaoScore; label: string; cor: string }[] = [
  { chave: "ELITE",     label: "Elite",     cor: "var(--lucro)" },
  { chave: "MUITO_BOA", label: "Muito boa", cor: "var(--outros-2)" },
  { chave: "BOA",       label: "Boa",       cor: "var(--leite)" },
  { chave: "ATENCAO",   label: "Atenção",   cor: "var(--cafe-2)" },
  { chave: "DESCARTE",  label: "Descarte",  cor: "var(--prejuizo)" },
];
const FAIXA = Object.fromEntries(FAIXAS.map((f) => [f.chave, f])) as Record<ClassificacaoScore, typeof FAIXAS[number]>;

const litros = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ccsTxt = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

function Estrelas({ classificacao }: { classificacao: ClassificacaoScore }) {
  const f = FAIXA[classificacao];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${f.cor} 14%, transparent)`, color: f.cor }}
    >
      {f.label}
    </span>
  );
}

function LinhaAnimal({ a, onAbrir }: { a: AnimalCarteiraDTO; onAbrir?: (id: number) => void }) {
  return (
    <tr className={onAbrir ? "cursor-pointer" : undefined} onClick={onAbrir ? () => onAbrir(a.animalId) : undefined}>
      <td>
        <RebAnm>
          {a.numero}
          {a.nome ? <small>{a.nome}</small> : null}
        </RebAnm>
      </td>
      <td><b>{a.score}</b></td>
      <td><Estrelas classificacao={a.classificacao} /></td>
      <td>{a.producaoDia == null ? "—" : `${litros(a.producaoDia)} L`}</td>
      <td style={{ color: a.margemDiaEstimada != null && a.margemDiaEstimada < 0 ? "var(--prejuizo)" : "var(--ink-2)" }}>
        {a.margemDiaEstimada == null ? "—" : `${fmtMoney(a.margemDiaEstimada)}/dia`}
      </td>
    </tr>
  );
}

export function CarteiraTab({ onAbrirFicha }: { onAbrirFicha?: (id: number) => void }) {
  const { data, loading, erro } = useCarteira();

  // Simulação de descarte: slider n → recomputa no backend (stateless), com debounce.
  const [n, setN] = useState(0);
  const [sim, setSim] = useState<SimulacaoDescarteDTO | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data || data.totalAnimais === 0 || n === 0) { setSim(null); return; }
    setSimLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      simularDescarte(n).then(setSim).catch(() => setSim(null)).finally(() => setSimLoading(false));
    }, 220);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [n, data]);

  const segments = useMemo(
    () => (data?.distribuicao ?? []).filter((d) => d.cabecas > 0).map((d) => ({ value: d.cabecas, color: FAIXA[d.classificacao].cor })),
    [data],
  );

  if (loading) return <RebMain><Loader /></RebMain>;
  if (erro || !data) return <RebMain><p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar: {erro ?? "sem dados"}</p></RebMain>;

  if (data.totalAnimais === 0) {
    return (
      <RebMain>
        <h2 className="font-serif text-xl font-medium mb-3">Carteira do rebanho</h2>
        <RebEmpty>Nenhuma vaca em lactação com dados de produção. Registre controles leiteiros para montar a carteira.</RebEmpty>
      </RebMain>
    );
  }

  const elite = data.distribuicao.find((d) => d.classificacao === "ELITE")?.cabecas ?? 0;
  const descarte = data.distribuicao.find((d) => d.classificacao === "DESCARTE")?.cabecas ?? 0;
  const precoTxt = `${fmtMoney(data.precoLeite)}/L${data.fontePreco === "fallback" ? " (estimado)" : ""}`;

  return (
    <RebMain>
      <h2 className="font-serif text-xl font-medium mb-3">Carteira do rebanho</h2>

      {/* KPIs de topo */}
      <RebKpiStrip cols={4}>
        <RebKpi lab="Score médio" val={data.scoreMedio} d="ponderado por produção" />
        <RebKpi lab="Elite" val={elite} d="score ≥ 85" />
        <RebKpi lab="Descarte" val={descarte} tom={descarte > 0 ? "up" : undefined} d="score < 40" />
        <RebKpi lab="Margem / dia (estimada)" val={fmtMoney(data.margemDiaTotal)} valClassName="text-[22px]" d={`leite a ${precoTxt}`} />
      </RebKpiStrip>

      {/* Distribuição por classificação */}
      <h2 className="font-serif text-xl font-medium mb-3">Distribuição por classificação</h2>
      <RebBox>
        <div className="flex flex-wrap items-center gap-8">
          <Donut segments={segments} size={150} label={`${data.totalAnimais}`} />
          <div className="min-w-[260px] flex-1">
            <RebTable>
              <thead><tr><th>Classificação</th><th>Cabeças</th><th>% rebanho</th></tr></thead>
              <tbody>
                {data.distribuicao.map((d) => (
                  <tr key={d.classificacao}>
                    <td><Estrelas classificacao={d.classificacao} /></td>
                    <td><b>{d.cabecas}</b></td>
                    <td>{d.pctRebanho}%</td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          </div>
        </div>
      </RebBox>

      {/* Simulação de descarte */}
      <h2 className="font-serif text-xl font-medium mb-3">Simular descarte das piores</h2>
      <RebBox>
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-ink-2 whitespace-nowrap">Descartar as {n} piores</label>
          <input
            type="range" min={0} max={data.totalAnimais} step={1} value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="flex-1 accent-[color:var(--cafe)]"
            aria-label="Número de vacas a descartar"
          />
          <span className="w-10 text-right font-serif text-lg">{n}</span>
        </div>

        <p className="mt-2 text-xs text-ink-3">
          Impacto no tanque e na margem/dia — aproximação (receita do leite − custo vaca/dia − sanidade/dia rateada).
          Não inclui payback de reposição.
        </p>

        {n === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Arraste o controle para simular o descarte das vacas de menor score.</p>
        ) : simLoading && !sim ? (
          <div className="mt-3"><Loader /></div>
        ) : sim ? (
          <RebKpiStrip cols={4}>
            <RebKpi lab="Cabeças que saem" val={sim.cabecas} d={`${litros(sim.litrosDiaSai)} L/dia a menos no tanque`} />
            <RebKpi
              lab="Δ Margem / dia"
              val={`${sim.margemDiaDelta >= 0 ? "+" : ""}${fmtMoney(sim.margemDiaDelta)}`}
              tom={sim.margemDiaDelta >= 0 ? "ok" : "up"}
              d={`${fmtMoney(sim.margemDiaAntes)} → ${fmtMoney(sim.margemDiaDepois)}`}
            />
            <RebKpi lab="CCS médio" val={ccsTxt(sim.ccsMedioDepois)} d={`de ${ccsTxt(sim.ccsMedioAntes)} mil cél/mL`} />
            <RebKpi lab="Score médio depois" val={sim.scoreMedioDepois} d={`de ${data.scoreMedio}`} />
          </RebKpiStrip>
        ) : null}
      </RebBox>

      {/* Ranking top/bottom */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-xl font-medium mb-3">Melhores</h2>
          {data.ranking.melhores.length === 0 ? <RebEmpty>Sem dados.</RebEmpty> : (
            <RebTable>
              <thead><tr><th>Animal</th><th>Score</th><th>Faixa</th><th>Prod.</th><th>Margem/dia</th></tr></thead>
              <tbody>{data.ranking.melhores.map((a) => <LinhaAnimal key={a.animalId} a={a} onAbrir={onAbrirFicha} />)}</tbody>
            </RebTable>
          )}
        </div>
        <div>
          <h2 className="font-serif text-xl font-medium mb-3">Piores</h2>
          {data.ranking.piores.length === 0 ? <RebEmpty>Sem dados.</RebEmpty> : (
            <RebTable>
              <thead><tr><th>Animal</th><th>Score</th><th>Faixa</th><th>Prod.</th><th>Margem/dia</th></tr></thead>
              <tbody>{data.ranking.piores.map((a) => <LinhaAnimal key={a.animalId} a={a} onAbrir={onAbrirFicha} />)}</tbody>
            </RebTable>
          )}
        </div>
      </div>

      <ComposicaoRacialSection />
      <QuantitativoSection />
      <ClimaChuvaSection />
    </RebMain>
  );
}
