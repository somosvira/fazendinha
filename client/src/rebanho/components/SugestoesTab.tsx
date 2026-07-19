import { Loader } from "../../components/Loading";
import { fmtMoney } from "../../components/charts";
import { useSugestoes, type SugestaoDTO, type TipoSugestao } from "../api";
import { RebMain, RebEmpty } from "@/components/rb/RebPrimitives";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";

// Rótulo + cor por tipo (base.css). Cada tipo puxa a atividade/estado correspondente.
const TIPO: Record<TipoSugestao, { label: string; cor: string }> = {
  DESCARTE:       { label: "Descarte",  cor: "var(--prejuizo)" },
  REPRODUCAO:     { label: "Reprodução", cor: "var(--outros-2)" },
  MASTITE:        { label: "Mastite",   cor: "var(--cafe-2)" },
  QUEDA_PRODUCAO: { label: "Queda",     cor: "var(--leite)" },
};

function Card({ s, onNav, onAbrirFicha }: { s: SugestaoDTO; onNav?: (t: string) => void; onAbrirFicha?: (id: number) => void }) {
  const t = TIPO[s.tipo];
  return (
    <div className="mb-3 rounded-[10px] border border-[color:var(--rule-soft)] bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, ${t.cor} 14%, transparent)`, color: t.cor }}>{t.label}</span>
            <button className="truncate text-left font-serif text-lg hover:underline" onClick={() => onAbrirFicha?.(s.animalId)}>{s.titulo}</button>
          </div>
          <p className="mt-1 text-sm text-ink-2">{s.motivo}</p>
          {s.prazoDias != null && (
            <p className="mt-0.5 text-xs text-ink-3">Janela: {s.prazoDias <= 0 ? "vencida" : `${s.prazoDias} dia(s)`}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-serif text-[22px] leading-none" style={{ color: "var(--cafe)" }}>{fmtMoney(s.impactoDiaEstimado)}</div>
          <div className="mt-0.5 text-xs text-ink-3">/dia em jogo</div>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          className="rounded-md border border-[color:var(--rule-soft)] px-3 py-1 text-sm font-semibold text-ink-2 hover:bg-[color:var(--rule-soft)]"
          onClick={() => onNav?.(s.acao.tab)}
        >
          {s.acao.label} →
        </button>
      </div>
    </div>
  );
}

export function SugestoesTab({ onNav, onAbrirFicha }: { onNav?: (t: string) => void; onAbrirFicha?: (id: number) => void }) {
  const { data, loading, erro } = useSugestoes();

  if (loading) return <RebMain><Loader /></RebMain>;
  if (erro || !data) return <RebMain><p className="mt-[7px] text-sm text-prejuizo">Erro ao carregar: {erro ?? "sem dados"}</p></RebMain>;

  return (
    <RebMain>
      <h2 className="font-serif text-xl font-medium mb-3">Sugestões do dia</h2>
      <p className="mb-4 text-sm text-ink-3">Decisões priorizadas pelo impacto em R$/dia — estimado (receita do leite − custos). Agir faz o alerta sumir na próxima carga.</p>

      <RebKpiStrip cols={4}>
        <RebKpi lab="Impacto em aberto" val={fmtMoney(data.impactoDiaTotal)} valClassName="text-[22px]" d="R$/dia em decisões" />
        <RebKpi lab="Descarte" val={data.totalPorTipo.DESCARTE} d="cogite descarte" />
        <RebKpi lab="Reprodução" val={data.totalPorTipo.REPRODUCAO} d="vazias pós-PEV" />
        <RebKpi lab="Sanidade / queda" val={data.totalPorTipo.MASTITE + data.totalPorTipo.QUEDA_PRODUCAO} d="mastite + queda" />
      </RebKpiStrip>

      {data.sugestoes.length === 0 ? (
        <RebEmpty>Nenhuma decisão pendente hoje — rebanho no azul.</RebEmpty>
      ) : (
        <div>{data.sugestoes.map((s) => <Card key={`${s.tipo}-${s.animalId}`} s={s} onNav={onNav} onAbrirFicha={onAbrirFicha} />)}</div>
      )}
    </RebMain>
  );
}
