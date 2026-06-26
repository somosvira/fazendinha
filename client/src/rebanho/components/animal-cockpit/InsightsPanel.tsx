// Painel executivo do animal — 10 componentes minimalistas que consomem AnimalInsightsDTO.
// Filosofia: maioria transparente com border-left de cor (estilo .rb-ia-band); .rb-box reservado
// para dados estruturados. Sempre indicar "estimativa" quando o dado vier de fallback ou inferência.

import type {
  ScoreDTO, FinanceiroDTO, TendenciaDTO, InsightDTO, PercentisDTO,
  ProducaoFinanceiraDTO, EficienciaDTO, ProjecoesDTO, GenealogiaDTO,
} from "../../api";

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRLExato = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;

const LABEL_CLAS: Record<ScoreDTO["classificacao"], string> = {
  ELITE: "Elite", MUITO_BOA: "Muito boa", BOA: "Boa", ATENCAO: "Atenção", DESCARTE: "Descarte recomendado",
};

// ── 1. Score (selo discreto ao lado do nome) ───────────────────────────────
export function ScoreBadge({ score }: { score: ScoreDTO }) {
  const cheias = score.estrelas;
  const tomCls = score.classificacao === "ELITE" || score.classificacao === "MUITO_BOA"
    ? "ok" : score.classificacao === "DESCARTE" || score.classificacao === "ATENCAO" ? "warn" : "";
  return (
    <span className={`rb-score ${tomCls}`} title={`Score ${score.valor}/100 — ${LABEL_CLAS[score.classificacao]}`}>
      <span className="rb-score-stars" aria-label={`${cheias} de 5 estrelas`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < cheias ? "on" : "off"}>★</span>
        ))}
      </span>
      <span className="rb-score-lab">{LABEL_CLAS[score.classificacao]}</span>
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
    <div className="rb-k rb-rentab" style={{ borderLeft: `3px solid ${cor}` }}>
      <div className="lab">Rentabilidade {f.fontePreco === "fallback" && <small>(estimativa)</small>}</div>
      <div className="rb-rentab-grid">
        <div>
          <div className="rb-rentab-num" style={{ color: cor }}>{fmtBRL(f.lucro)}</div>
          <div className="rb-rentab-sub">{interpretacao}</div>
        </div>
        <div className="rb-rentab-side">
          <div className="rb-rentab-row"><span>Receita</span><b>{fmtBRL(f.receitaLactacao)}</b></div>
          <div className="rb-rentab-row"><span>Custos</span><b>{fmtBRL(f.custosTotal)}</b></div>
          <div className="rb-rentab-row"><span>Margem</span><b style={{ color: cor }}>{fmtPct(f.margem)}</b></div>
        </div>
      </div>
    </div>
  );
}

// ── 3. Tendências (lista compacta) ─────────────────────────────────────────
export function Tendencias({ tendencias }: { tendencias: TendenciaDTO[] }) {
  if (tendencias.length === 0) return null;
  const seta = (d: TendenciaDTO["direcao"]) => d === "up" ? "⬈" : d === "down" ? "⬊" : "→";
  const corClass = (s: TendenciaDTO["sentido"]) => s === "pos" ? "rb-ok" : s === "neg" ? "rb-up" : "";
  return (
    <div className="rb-card-mini">
      <h4>Tendências</h4>
      <ul className="rb-trend-list">
        {tendencias.map((t) => (
          <li key={t.chave} className="rb-trend-li">
            <span className={`rb-trend-arrow ${corClass(t.sentido)}`}>{seta(t.direcao)}</span>
            <span className="rb-trend-lab">{t.label}</span>
            {t.delta && <span className="rb-trend-delta">{t.delta}</span>}
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
    <div className="rb-card-mini">
      <h4>Insights</h4>
      <ul className="rb-insights-list">
        {insights.map((i, idx) => (
          <li key={idx} className={`rb-pull ${i.tipo}`}>
            <span className="rb-pull-mark">{i.tipo === "warn" ? "⚠" : "✓"}</span>
            <div>
              <div className="rb-pull-tit">{i.titulo}</div>
              {i.detalhe && <div className="rb-pull-det">{i.detalhe}</div>}
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
    <div className="rb-card-mini">
      <h4>Comparação com o lote</h4>
      <div className="rb-perc-grid">
        {linhas.map((l) => (
          <div key={l.lab} className="rb-perc-row">
            <div className="rb-perc-lab">{l.lab}</div>
            <div className="rb-bar"><div className="rb-bar-fill" style={{ width: `${l.val ?? 0}%` }} /></div>
            <div className="rb-perc-val">{l.val != null ? `${l.val}º percentil` : "—"}</div>
          </div>
        ))}
      </div>
      {p.ranking && <p className="rb-perc-rank">{p.ranking.posicao}ª de {p.ranking.total} em produção</p>}
    </div>
  );
}

// ── 6. Produção financeira (expansão) ──────────────────────────────────────
export function ProducaoFinanceira({ pf }: { pf: ProducaoFinanceiraDTO }) {
  return (
    <div className="rb-box">
      <h4>Produção financeira</h4>
      <div className="rb-kv"><span>Acumulado</span><b>{fmtNum(pf.acumuladoLitros)} L</b></div>
      <div className="rb-kv"><span>Valor recebido</span><b>{fmtBRL(pf.valorRecebido)}</b></div>
      <div className="rb-kv"><span>Preço médio</span><b>{fmtBRLExato(pf.precoMedio)}/L</b></div>
      {pf.lucroPorLitro != null && (
        <div className="rb-kv"><span>Lucro por litro</span><b>{fmtBRLExato(pf.lucroPorLitro)}</b></div>
      )}
      <div className="rb-kv"><span>Receita diária</span><b>{fmtBRLExato(pf.receitaDiaria)}</b></div>
      <div className="rb-kv"><span>Receita mensal estimada</span><b>{fmtBRL(pf.receitaMensal)}</b></div>
    </div>
  );
}

// ── 7. Eficiência (arc minimalista) ────────────────────────────────────────
export function EficienciaGauge({ e }: { e: EficienciaDTO }) {
  if (e.meta == null || e.atual == null || e.percentual == null) return null;
  const pct = Math.min(100, e.percentual);
  // arc semicircle de 180°
  const r = 52; const cx = 60; const cy = 60;
  const angDeg = (pct / 100) * 180 - 180; // -180 → 0
  const angRad = (angDeg * Math.PI) / 180;
  const x = cx + r * Math.cos(angRad);
  const y = cy + r * Math.sin(angRad);
  const largeArc = pct > 50 ? 1 : 0;
  const tom = pct >= 90 ? "var(--lucro)" : pct >= 60 ? "var(--atencao)" : "var(--prejuizo)";
  return (
    <div className="rb-card-mini">
      <h4>Eficiência</h4>
      <div className="rb-gauge">
        <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden>
          <path d={`M 8 60 A ${r} ${r} 0 0 1 112 60`} fill="none" stroke="var(--rule-soft)" strokeWidth="6" />
          <path d={`M 8 60 A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={tom} strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="rb-gauge-num" style={{ color: tom }}>{e.percentual}%</div>
      </div>
      <div className="rb-kv"><span>Atual</span><b>{e.atual} L/dia</b></div>
      <div className="rb-kv"><span>Meta</span><b>{e.meta} L/dia</b></div>
    </div>
  );
}

// ── 8. Projeções ───────────────────────────────────────────────────────────
export function Projecoes({ p, fontePreco }: { p: ProjecoesDTO; fontePreco: FinanceiroDTO["fontePreco"] }) {
  const data = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
  return (
    <div className="rb-box">
      <h4>Projeções <small style={{ fontWeight: 500, color: "var(--ink-2)" }}>(estimativa{fontePreco === "fallback" ? " · preço de fallback" : ""})</small></h4>
      <div className="rb-kv"><span>Produção da lactação</span><b>{p.producaoLactacao != null ? `${fmtNum(p.producaoLactacao)} L` : "—"}</b></div>
      <div className="rb-kv"><span>Receita esperada</span><b>{p.receitaLactacao != null ? fmtBRL(p.receitaLactacao) : "—"}</b></div>
      <div className="rb-kv"><span>Lucro esperado</span><b>{p.lucroLactacao != null ? fmtBRL(p.lucroLactacao) : "—"}</b></div>
      <div className="rb-kv"><span>Data prevista de secagem</span><b>{data(p.dataSecagem)}</b></div>
      <div className="rb-kv"><span>Parto previsto</span><b>{data(p.dataParto)}</b></div>
    </div>
  );
}

// ── 9. Genealogia ──────────────────────────────────────────────────────────
export function Genealogia({ g, onAbrirAnimal }: { g: GenealogiaDTO; onAbrirAnimal: (id: string) => void }) {
  return (
    <div className="rb-box">
      <h4>Genealogia</h4>
      <div className="rb-ped-tree">
        <div className="rb-ped-col">
          <div className="rb-ped-line">
            <span>Mãe</span>
            {g.mae ? (
              <button onClick={() => onAbrirAnimal(g.mae!.id)}>{g.mae.nome ?? "—"} #{g.mae.numero}</button>
            ) : <span className="rb-ped-empty">—</span>}
          </div>
          {g.mae?.producaoMediaDia != null && <div className="rb-ped-mini">produção {g.mae.producaoMediaDia} L/dia</div>}
          <div className="rb-ped-line">
            <span>Avó materna</span>
            {g.avoMaterna ? (
              <button onClick={() => onAbrirAnimal(g.avoMaterna!.id)}>{g.avoMaterna.nome ?? "—"} #{g.avoMaterna.numero}</button>
            ) : <span className="rb-ped-empty">sem registro</span>}
          </div>
          <div className="rb-ped-line">
            <span>Avô materno</span>
            <span className="rb-ped-text">{g.avoMaterno ?? "sem registro"}</span>
          </div>
        </div>
        <div className="rb-ped-col">
          <div className="rb-ped-line">
            <span>Pai</span>
            <span className="rb-ped-text">{g.pai ?? "—"}</span>
          </div>
          <div className="rb-ped-line">
            <span>Avó paterna</span>
            <span className="rb-ped-empty">sem registro</span>
          </div>
          <div className="rb-ped-line">
            <span>Avô paterno</span>
            <span className="rb-ped-empty">sem registro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
