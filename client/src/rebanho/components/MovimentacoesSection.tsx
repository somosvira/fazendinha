import { useMovimentacoes, type MovimentacaoDTO } from "../api";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");
const rotuloTipo = (t: MovimentacaoDTO["tipo"]) => (t === "GRUPO" ? "Lote" : "Setor");

// Histórico de trocas de lote/setor do animal ("onde a vaca esteve"). Só leitura —
// as movimentações nascem automaticamente quando o cadastro do animal muda de grupo/setor.
export function MovimentacoesSection({ animalId }: { animalId: string }) {
  const { data, loading } = useMovimentacoes(animalId);
  if (loading) return null;
  const lista = data ?? [];

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Movimentações de lote/setor</h4>

      {lista.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhuma movimentação registrada. As trocas de lote/setor aparecem aqui quando o cadastro do animal muda.</p>
      ) : (
        <ol className="flex flex-col">
          {lista.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
              <span className="w-24 shrink-0 tabular-nums text-ink-2">{fmtData(m.data)}</span>
              <span className="shrink-0 rounded bg-[color:var(--rule-soft)] px-1.5 py-0.5 text-xs uppercase tracking-[.04em] text-ink-3">{rotuloTipo(m.tipo)}</span>
              <span className="flex-1 text-[color:var(--ink)]">
                {m.origem ? <><span className="text-ink-3">{m.origem}</span> → </> : <span className="text-ink-3">entrada → </span>}
                <b className="font-semibold">{m.destino}</b>
                {m.motivo ? <span className="text-ink-3"> · {m.motivo}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
