/* Rio Novo — orçado × realizado + produtividade do rebanho.
 * Port de src/dataGestao.js. Tetos e métricas de rebanho são definidos pelo
 * Marco / capataz — não derivam da planilha do BPO, então são estáticos.
 */

export type OrcItem = { catId: string; nome: string; orcado: number; realizado: number };
export type Orcamento = { periodo: string; itens: OrcItem[] };

export const orcamento: Orcamento = {
  periodo: "Maio 2026",
  itens: [
    { catId: "racao", nome: "Ração", orcado: 120000, realizado: 142000 },
    { catId: "curral", nome: "Curral", orcado: 90000, realizado: 196000 },
    { catId: "pessoalSal", nome: "Pessoal — Salário", orcado: 88000, realizado: 84000 },
    { catId: "medic", nome: "Medicamento Animal", orcado: 30000, realizado: 38000 },
    { catId: "combust", nome: "Combustível", orcado: 18000, realizado: 16500 },
    { catId: "insumosCafe", nome: "Insumos café", orcado: 22000, realizado: 9000 },
    { catId: "manutencao", nome: "Manutenção", orcado: 20000, realizado: 16000 },
    { catId: "energia", nome: "Energia elétrica", orcado: 14000, realizado: 13500 },
  ],
};

export type Produtividade = {
  meses: string[];
  litrosDia: number[];
  vacasLactacao: number[];
  metaLitrosVaca: number;
  custoLitroMeta: number;
  litrosVaca: number[];
  litrosVacaAtual: number;
  litrosVacaMedia: number;
  totalRebanho: number;
  vacasSecas: number;
  novilhas: number;
  bezerros: number;
};

export function buildProdutividade(): Produtividade {
  const meses = ["Jun/25", "Jul/25", "Ago/25", "Set/25", "Out/25", "Nov/25", "Dez/25", "Jan/26", "Fev/26", "Mar/26", "Abr/26", "Mai/26"];
  const litrosDia = [1820, 1760, 1680, 1610, 1540, 1660, 1720, 1700, 1640, 1720, 1780, 1620];
  const vacasLactacao = [62, 61, 60, 58, 55, 58, 60, 61, 60, 62, 63, 60];
  const litrosVaca = litrosDia.map((l, i) => +(l / vacasLactacao[i]).toFixed(1));
  return {
    meses,
    litrosDia,
    vacasLactacao,
    metaLitrosVaca: 32,
    custoLitroMeta: 3.0,
    litrosVaca,
    litrosVacaAtual: litrosVaca[litrosVaca.length - 1],
    litrosVacaMedia: +(litrosVaca.reduce((s, x) => s + x, 0) / litrosVaca.length).toFixed(1),
    totalRebanho: 148,
    vacasSecas: 18,
    novilhas: 42,
    bezerros: 28,
  };
}
