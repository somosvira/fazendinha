import { fmt } from "../../components/charts";
import { RebPill } from "@/components/rb/RebPrimitives";
import { useAcasalamento, type RecomendacaoDTO, type StatusRecomendacaoAcasalamento } from "../api";

const STATUS: Record<StatusRecomendacaoAcasalamento, { label: string; tone: "ok" | "warn" | "bad" }> = {
  ok: { label: "apto", tone: "ok" },
  nao_verificavel: { label: "pedigree não verificável", tone: "warn" },
  consanguineo: { label: "consanguíneo", tone: "bad" },
  restrito: { label: "restrito", tone: "bad" },
};

function statusDe(recomendacao: RecomendacaoDTO): StatusRecomendacaoAcasalamento {
  return recomendacao.status ?? (recomendacao.consanguineo ? "consanguineo" : "ok");
}

function percentual(valor: number) {
  const escala = valor * 100;
  return `${fmt(escala, { decimals: Number.isInteger(escala) ? 0 : 1 })}%`;
}

function primeiroMotivo(recomendacao: RecomendacaoDTO) {
  return recomendacao.motivos?.[0] ?? recomendacao.motivo;
}

export function AcasalamentoSection({ animalId }: { animalId: string }) {
  const { data, loading, erro } = useAcasalamento(animalId);
  if (loading) return null;
  if (erro) {
    return <p role="alert" className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3 text-sm text-prejuizo">Recomendação de acasalamento indisponível: {erro}</p>;
  }

  const recomendacoes = data?.recomendacoes ?? [];
  if (recomendacoes.length === 0) return null;

  const top = recomendacoes.filter((item) => {
    const status = statusDe(item);
    return status === "ok" || status === "nao_verificavel";
  }).slice(0, 5);
  const consanguineos = recomendacoes.filter((item) => statusDe(item) === "consanguineo");
  const restritos = recomendacoes.filter((item) => statusDe(item) === "restrito");
  const haNaoVerificavel = top.some((item) => statusDe(item) === "nao_verificavel");

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Recomendação de acasalamento</h4>

      {top.length === 0 ? (
        <p className="text-sm text-ink-3">Sem touros aptos ou com pedigree verificável.</p>
      ) : (
        <ol className="flex flex-col">
          {top.map((item, indice) => {
            const status = STATUS[statusDe(item)];
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-[color:var(--rule-soft)] py-2 text-sm last:border-0">
                <span className="w-6 shrink-0 text-ink-3">{indice + 1}º</span>
                <span className="min-w-[140px] flex-1 font-semibold text-foreground">{item.nome}</span>
                <RebPill tone={status.tone}>{status.label}</RebPill>
                <span className="shrink-0 tabular-nums font-semibold text-[color:var(--cafe)]">{percentual(item.score)}</span>
                {item.parentesco != null && <span className="shrink-0 tabular-nums text-xs text-ink-3">{percentual(item.parentesco)} parentesco</span>}
                <span className="basis-full pl-8 text-xs text-ink-3">{primeiroMotivo(item)}</span>
              </li>
            );
          })}
        </ol>
      )}

      {consanguineos.length > 0 && <p className="mb-0 mt-2 text-xs text-prejuizo">Consanguíneos ({consanguineos.length}): {consanguineos.map((item) => item.nome).join(", ")}.</p>}
      {restritos.length > 0 && <p className="mb-0 mt-1 text-xs text-prejuizo">Restritos ({restritos.length}): {restritos.map((item) => item.nome).join(", ")}.</p>}
      <p className="mb-0 mt-2 text-xs text-ink-3">Mérito configurável por indicadores; consanguinidade estimada por pedigree.</p>
      {haNaoVerificavel && <p role="alert" className="mb-0 mt-1 text-xs text-prejuizo">Atenção: há candidato com pedigree não verificável; confirme a escolha somente após avaliação técnica.</p>}
    </div>
  );
}
