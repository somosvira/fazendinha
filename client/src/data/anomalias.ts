/* Rio Novo — anomalias de gasto e histórico de preço (vigilância da IA).
 * Port de src/dataAnomalias.js. Estático: a "detecção" é mockada com os desvios
 * reais já identificados na análise da planilha.
 */

export type Anomalia = {
  id: string;
  severidade: "alta" | "media" | "baixa";
  categoria: string;
  catId: string;
  titulo: string;
  resumo: string;
  detalhe: string;
  pergunta: string;
  delta: number;
  valor: number;
};

export const anomalias: Anomalia[] = [
  {
    id: "curral-salto",
    severidade: "alta",
    categoria: "Curral",
    catId: "curral",
    titulo: "Curral +142% em 2026",
    resumo: "R$ 786 mil em 4 meses contra R$ 325 mil no mesmo período de 2025.",
    detalhe:
      "3 fornecedores novos apareceram em 2026 — Siloking (equipamento de ordenha), Liptolandia (madeira) e Imunodot. O padrão (madeira + equipamento + energia) sugere reforma estrutural do curral, não custeio recorrente.",
    pergunta: "Isso é obra de reforma? Se sim, parte vira investimento.",
    delta: 142,
    valor: 786468,
  },
  {
    id: "medic-alta",
    severidade: "media",
    categoria: "Medicamento Animal",
    catId: "medic",
    titulo: "Medicamento animal +58% no ano",
    resumo: "Concentrado em abril e maio, com peso de antibiótico.",
    detalhe:
      "A alta coincide com um pico de mastite no rebanho. Antibiótico (Florfenicol) responde por 38% da categoria. Vale revisar o protocolo de pré-dipping com a Veterinária do Vale.",
    pergunta: "Pico de mastite? Revisar manejo de ordenha.",
    delta: 58,
    valor: 149425,
  },
  {
    id: "racao-queda",
    severidade: "media",
    categoria: "Ração",
    catId: "racao",
    titulo: "Compra de ração caiu 22% em maio",
    resumo: "Possível ruptura de estoque — ou erro de lançamento.",
    detalhe:
      "Maio registrou R$ 89 mil contra média de R$ 114 mil/mês. Com o rebanho em crescimento, queda na ração é incomum. Pode ser estoque acumulado, atraso de nota, ou ruptura real.",
    pergunta: "Estoque baixo de ração? Conferir com a Sandra.",
    delta: -22,
    valor: 89000,
  },
  {
    id: "pessoal-cresc",
    severidade: "baixa",
    categoria: "Pessoal — Salário",
    catId: "pessoalSal",
    titulo: "Folha cresceu 80% desde jul/24",
    resumo: "De ~R$ 41 mil/mês para ~R$ 84 mil/mês.",
    detalhe:
      "Dobrou a folha em 22 meses — acompanha a expansão do rebanho e da roça. Vale confirmar se o ganho de produção justifica o ritmo de contratação.",
    pergunta: "Produção acompanhou a folha?",
    delta: 80,
    valor: 84000,
  },
];

export type Compra = { data: string; preco: number; fornecedor: string };
export type HistoricoMarca = { unidade: string; compras: Compra[]; mediaMercado: number };

// histórico de preço por unidade (alerta de preço pago)
export const historicoPreco: Record<string, HistoricoMarca> = {
  "Cargill Nutron Leite 21%": {
    unidade: "ton",
    compras: [
      { data: "12/jan/26", preco: 2180, fornecedor: "Cargil Agrícola" },
      { data: "08/fev/26", preco: 2210, fornecedor: "Cargil Agrícola" },
      { data: "15/mar/26", preco: 2240, fornecedor: "Cargil Agrícola" },
      { data: "10/abr/26", preco: 2260, fornecedor: "Cargil Agrícola" },
      { data: "04/mai/26", preco: 2380, fornecedor: "Cargil Agrícola" },
    ],
    mediaMercado: 2250,
  },
  "Florfenicol 250 ml": {
    unidade: "frasco",
    compras: [
      { data: "20/jan/26", preco: 168, fornecedor: "Nutrivet" },
      { data: "18/fev/26", preco: 172, fornecedor: "Nutrivet" },
      { data: "22/mar/26", preco: 175, fornecedor: "Nutrivet" },
      { data: "04/mai/26", preco: 195, fornecedor: "Nutrivet" },
    ],
    mediaMercado: 178,
  },
  "Diesel S-10 (1.000 L)": {
    unidade: "L",
    compras: [
      { data: "10/jan/26", preco: 5.92, fornecedor: "Posto Avenida" },
      { data: "10/fev/26", preco: 5.98, fornecedor: "Posto Avenida" },
      { data: "12/mar/26", preco: 6.05, fornecedor: "Posto Avenida" },
      { data: "11/abr/26", preco: 6.12, fornecedor: "Posto Avenida" },
      { data: "05/mai/26", preco: 6.18, fornecedor: "Posto Avenida" },
    ],
    mediaMercado: 6.05,
  },
};

export type AnalisePreco = {
  unidade: string;
  atual: number;
  anterior: number;
  deltaUlt: number;
  mediaMercado: number;
  deltaMercado: number;
  compras: Compra[];
  alerta: boolean;
};

// dado um nome de marca, devolve análise de preço (último vs penúltimo vs mercado)
export function analisePreco(marca: string): AnalisePreco | null {
  const h = historicoPreco[marca];
  if (!h || h.compras.length < 2) return null;
  const ult = h.compras[h.compras.length - 1];
  const pen = h.compras[h.compras.length - 2];
  const deltaUlt = ((ult.preco - pen.preco) / pen.preco) * 100;
  const deltaMercado = ((ult.preco - h.mediaMercado) / h.mediaMercado) * 100;
  return {
    unidade: h.unidade,
    atual: ult.preco,
    anterior: pen.preco,
    deltaUlt,
    mediaMercado: h.mediaMercado,
    deltaMercado,
    compras: h.compras,
    alerta: deltaUlt >= 5 || deltaMercado >= 5,
  };
}
