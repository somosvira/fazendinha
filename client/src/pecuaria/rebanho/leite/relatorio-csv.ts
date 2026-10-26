import type { DiaRitmoLeite } from "./RitmoLeite";
interface ResumoExportavel {
  situacao: string;
  motivos?: string[];
  custoPorLitro: string | null;
  custos: { totalConhecido: string | null; cobertura: string };
  producao: { litros: number | null; completa: boolean };
}
export interface RelatorioExportavel {
  ritmo: DiaRitmoLeite[];
  coberturaPeriodo: {
    diasInformados: number;
    diasSemFolha: string[];
    diasParciais: string[];
    diasSemAnimaisElegiveis?: string[];
    diasFinalidadePendente?: string[];
    completa: boolean;
  };
  consolidado: ResumoExportavel;
  animais: (ResumoExportavel & {
    animalId: string;
    brinco: string | null;
    nome: string | null;
  })[];
}
/** Exporta exatamente o recorte consultado; ausente permanece vazio e valores ocultos não são inferidos. */
export function csvCustosLeite(
  dados: RelatorioExportavel,
  inicio: string,
  fim: string,
): string {
  const celula = (valor: unknown) => {
    let texto = valor == null ? "" : String(valor);
    if (typeof valor === "string" && /^[=+@\-\t\r]/.test(texto))
      texto = `'${texto}`;
    return `"${texto.replaceAll('"', '""')}"`;
  };
  const monetario = (r: ResumoExportavel, valor: string | null) =>
    r.situacao === "OCULTO" ? null : valor;
  const linhas: unknown[][] = [
    ["Período", inicio, fim],
    ["Cobertura completa", dados.coberturaPeriodo.completa ? "Sim" : "Não"],
    ["Dias sem folha", dados.coberturaPeriodo.diasSemFolha.join(", ")],
    ["Dias parciais", dados.coberturaPeriodo.diasParciais.join(", ")],
    ["Dias sem animais elegíveis", (dados.coberturaPeriodo.diasSemAnimaisElegiveis ?? []).join(", ")],
    ["Dias com finalidade pendente", (dados.coberturaPeriodo.diasFinalidadePendente ?? []).join(", ")],
    [
      "Animal",
      "Nome",
      "Litros medidos",
      "Custo registrado (R$)",
      "Custo por litro (R$)",
      "Situação",
      "Cobertura dos custos",
      "Motivos de custo não apurado",
    ],
    [
      "TOTAL",
      "",
      dados.consolidado.producao.litros,
      monetario(dados.consolidado, dados.consolidado.custos.totalConhecido),
      monetario(dados.consolidado, dados.consolidado.custoPorLitro),
      dados.consolidado.situacao,
      dados.consolidado.custos.cobertura,
      dados.consolidado.situacao === "OCULTO" ? null : dados.consolidado.motivos?.join(", "),
    ],
    ...dados.animais.map((a) => [
      a.brinco ?? a.animalId,
      a.nome,
      a.producao.litros,
      monetario(a, a.custos.totalConhecido),
      monetario(a, a.custoPorLitro),
      a.situacao,
      a.custos.cobertura,
      a.situacao === "OCULTO" ? null : a.motivos?.join(", "),
    ]),
    [],
    [
      "Data",
      "Litros medidos",
      "Estado",
      "Esperadas",
      "Resolvidas",
      "Pendentes",
    ],
    ...dados.ritmo.map((d) => [
      d.data,
      d.litros,
      d.estado,
      d.esperadas,
      d.resolvidas,
      d.pendentes,
    ]),
  ];
  return `\uFEFF${linhas.map((l) => l.map(celula).join(";")).join("\r\n")}`;
}
export function baixarRelatorioLeite(
  dados: RelatorioExportavel,
  inicio: string,
  fim: string,
) {
  const url = URL.createObjectURL(
    new Blob([csvCustosLeite(dados, inicio, fim)], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `leite-${inicio}-${fim}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
