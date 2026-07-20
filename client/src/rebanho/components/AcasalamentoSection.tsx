import { useAcasalamento } from "../api";

// Recomendação de acasalamento: ranking de touros do catálogo para esta vaca, por mérito
// genético, com consanguíneos (o pai da vaca) sinalizados. Só aparece se há reprodutores.
export function AcasalamentoSection({ animalId }: { animalId: string }) {
  const { data, loading } = useAcasalamento(animalId);
  if (loading) return null;
  const recs = data?.recomendacoes ?? [];
  if (recs.length === 0) return null;

  const top = recs.filter((r) => !r.consanguineo).slice(0, 5);
  const consanguineos = recs.filter((r) => r.consanguineo);

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Recomendação de acasalamento</h4>

      {top.length === 0 ? (
        <p className="text-sm text-ink-3">Sem touros recomendados (todos consanguíneos ou sem índices).</p>
      ) : (
        <ol className="flex flex-col">
          {top.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-dashed border-[color:var(--rule-soft)] py-[6px] text-sm last:border-0">
              <span className="w-6 shrink-0 text-ink-3">{i + 1}º</span>
              <span className="flex-1 font-semibold text-[color:var(--ink)]">{r.nome}</span>
              <span className="shrink-0 text-ink-3">{r.motivo}</span>
              <span className="w-16 shrink-0 text-right tabular-nums text-[color:var(--cafe)]">{Math.round(r.score * 100)}</span>
            </li>
          ))}
        </ol>
      )}

      {consanguineos.length > 0 && (
        <p className="mt-2 text-xs text-prejuizo">
          ⚠ evitar (consanguíneo): {consanguineos.map((r) => r.nome).join(", ")}
        </p>
      )}
      <p className="mt-1 text-xs text-ink-3">Mérito genético normalizado (PTA leite + TPI); {data?.paiNome ? `pai da vaca: ${data.paiNome}` : "pai da vaca não informado"}.</p>
    </div>
  );
}
