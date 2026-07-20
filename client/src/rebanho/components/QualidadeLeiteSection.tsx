import { useAnaliseLeite, type FaixaCCS } from "../api";
import { MiniBarChart } from "../../components/charts";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";

const fmtMes = (m: string) => {
  const [ano, mes] = m.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(mes) - 1]}/${ano.slice(2)}`;
};
const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");

const FAIXA_ROTULO: Record<FaixaCCS, string> = { EXCELENTE: "Excelente (< 200)", ATENCAO: "Atenção (200–399)", ALARME: "Alarme (≥ 400)" };
const FAIXA_COR: Record<FaixaCCS, string> = { EXCELENTE: "var(--lucro)", ATENCAO: "var(--atencao)", ALARME: "var(--prejuizo)" };

// Análise de leite (qualidade): tendência de CCS ao longo dos meses, distribuição por faixa,
// médias de gordura/proteína e os animais com pior CCS. Fonte = exames de leite (CCS/gordura/proteína).
export function QualidadeLeiteSection() {
  const { data, loading } = useAnaliseLeite();
  if (loading) return null;
  if (!data || data.totalLeituras === 0) {
    return (
      <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
        <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Análise de leite — qualidade</h4>
        <p className="text-sm text-ink-3">Nenhuma leitura de CCS/gordura/proteína registrada. Registre exames de leite para acompanhar a qualidade e a tendência de CCS.</p>
      </div>
    );
  }

  const trend = data.tendenciaCCS.map((p) => ({ x: fmtMes(p.mes), y: p.ccsMedio }));
  const totalFaixas = data.distribuicao.EXCELENTE + data.distribuicao.ATENCAO + data.distribuicao.ALARME;
  const faixas: FaixaCCS[] = ["EXCELENTE", "ATENCAO", "ALARME"];

  return (
    <div className="mt-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Análise de leite — qualidade</h4>

      <RebKpiStrip cols={3} className="mb-4">
        <RebKpi lab="CCS médio atual" val={data.ccsMedioAtual ?? "—"} sufixo={data.ccsMedioAtual != null ? "mil/mL" : undefined} d={`${data.animaisComLeitura} vacas com leitura`} tom={data.ccsMedioAtual != null && data.ccsMedioAtual >= 400 ? "up" : data.ccsMedioAtual != null && data.ccsMedioAtual < 200 ? "ok" : undefined} />
        <RebKpi lab="Gordura média" val={data.gorduraMedia ?? "—"} sufixo={data.gorduraMedia != null ? "%" : undefined} d="do leite analisado" />
        <RebKpi lab="Proteína média" val={data.proteinaMedia ?? "—"} sufixo={data.proteinaMedia != null ? "%" : undefined} d="do leite analisado" />
      </RebKpiStrip>

      {trend.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-xs uppercase tracking-[.06em] text-ink-3">Tendência de CCS (média mensal do rebanho, mil/mL)</p>
          <MiniBarChart data={trend} color="var(--cafe)" />
        </div>
      )}

      {totalFaixas > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs uppercase tracking-[.06em] text-ink-3">Distribuição por faixa (leitura mais recente de cada vaca)</p>
          <div className="flex h-3 w-full overflow-hidden rounded">
            {faixas.map((f) => data.distribuicao[f] > 0 && (
              <div key={f} style={{ width: `${(data.distribuicao[f] / totalFaixas) * 100}%`, background: FAIXA_COR[f] }} title={`${FAIXA_ROTULO[f]}: ${data.distribuicao[f]}`} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {faixas.map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-ink-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FAIXA_COR[f] }} />
                {FAIXA_ROTULO[f]}: <b className="tabular-nums text-[color:var(--ink)]">{data.distribuicao[f]}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {data.pioresAnimais.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-[.06em] text-ink-3">Piores CCS (leitura mais recente)</p>
          <ol className="flex flex-col">
            {data.pioresAnimais.map((a) => (
              <li key={a.animalId} className="flex flex-wrap items-baseline gap-x-2 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
                <span className="w-28 shrink-0 font-semibold text-[color:var(--ink)]">#{a.numero}{a.nome ? ` · ${a.nome}` : ""}</span>
                <span className="w-24 shrink-0 tabular-nums" style={{ color: FAIXA_COR[a.faixa] }}>{a.ccs} mil/mL</span>
                <span className="text-ink-3">{fmtData(a.data)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
