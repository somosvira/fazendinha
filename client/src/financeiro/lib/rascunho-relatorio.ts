import type { RascunhoRelatorioFinanceiro } from "../novo-api";
import { dataCurta, REGIMES_RELATORIO } from "./relatorios";

export type ResumoRascunhoRelatorio = {
  titulo: string;
  tipo: string;
  detalhe: string;
  atualizadoEm: string;
};

export function resumoRascunhoRelatorio(rascunho: RascunhoRelatorioFinanceiro): ResumoRascunhoRelatorio {
  const config = rascunho.configuracao;
  const periodo = config.dataInicio && config.dataFim ? `${dataCurta(config.dataInicio)} a ${dataCurta(config.dataFim)}` : "Período a definir";
  const regime = REGIMES_RELATORIO.find((item) => item.id === config.regime)?.rotulo ?? "Relatório financeiro";
  return {
    titulo: config.nome?.trim() || "Novo relatório",
    tipo: "Relatório financeiro",
    detalhe: `${periodo} · ${regime}`,
    atualizadoEm: rascunho.updatedAt,
  };
}
