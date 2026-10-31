import { fmtMoneyExact } from "../../../components/charts";
import type { ResumoCustos } from "../custos/api";

const estados: Record<string, string> = { NAO_APLICAVEL: "Não se aplica", INCLUIDO_PACOTE: "Incluído no serviço", DESCONHECIDO: "Não apurado", OCULTO: "Valores ocultos" };
export function ResumoCustoAplicacao({ resumo, compacto = false, anulado = false }: { resumo?: ResumoCustos | null; compacto?: boolean; anulado?: boolean }) {
  if (anulado) return <p className="text-sm text-ink-3">Anulada · fora do custo atual</p>;
  if (!resumo) return <p className="text-sm text-ink-3">Custo indisponível</p>;
  if (resumo.situacao === "OCULTO") return <p>Valores ocultos</p>;
  const total = resumo.totalConhecido == null ? "Não apurado" : fmtMoneyExact(Number(resumo.totalConhecido));
  return <div className="sanitario-custo-resumo">
    <p className={compacto ? "" : "sanitario-custo-total"}>{!compacto && <span>Custo direto registrado</span>}<strong>{total}</strong>{resumo.cobertura !== "COMPLETO" && <span className="text-sm text-ink-3">{resumo.totalConhecido != null ? "Parcelas conhecidas · parcial" : "Cobertura desconhecida"}</span>}</p>
    {!compacto && <><dl className="sanitario-custo-parcelas">{resumo.componentes.map(c => <div key={c.chave}><dt>{c.natureza === "MATERIAL" ? "Produto consumido" : "Serviço / procedimento atribuído"}</dt><dd>{c.valor != null ? fmtMoneyExact(Number(c.valor)) : estados[c.estado] ?? c.estado}</dd></div>)}</dl>{resumo.limitacoes.map(l => <p className="text-sm text-ink-3" key={l}>{l}</p>)}</>}
  </div>;
}
