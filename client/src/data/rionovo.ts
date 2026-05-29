/* Rio Novo — dados mock consolidados.
 * Origem: planilha BPO 04/05/2026 (~6.700 lançamentos reais).
 * Equivalente aos arquivos data.js + dataCategorias.js + dataPlano.js do design.
 * Tipado como `any` para não brigar com o uso dinâmico nos componentes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R: any = {};

R.UPDATED_AT = "04/mai/2026, recebido do BPO";
R.OWNER = "Marco Antônio";
R.REPORT_DATE_LABEL = "Relatório 04/05/2026";

R.MESES_23M = [
  "Jul/24","Ago/24","Set/24","Out/24","Nov/24","Dez/24",
  "Jan/25","Fev/25","Mar/25","Abr/25","Mai/25","Jun/25","Jul/25","Ago/25","Set/25","Out/25","Nov/25","Dez/25",
  "Jan/26","Fev/26","Mar/26","Abr/26","Mai/26*",
];

R.receitaLeite = [
  148042, 159772, 196528, 210241, 220101, 200138,
  199832, 192458, 181638, 188582, 179173, 177437, 161951, 153502, 144715, 152454, 180057, 146897,
  123199, 140103, 128570, 158403, 0,
];
R.receitaCafe = [
  0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,304138,0,0,
];

R.custeioLeiteBPO = [
  185373, 198010, 149918, 191884, 209215, 429390,
  139508, 342050, 179476, 180803, 280482, 174926, 199671, 331590, 375868, 386617, 562401, 867592,
  912269, 607129, 811631, 469351, 101778,
];

R.animalAquisicao = [
  0,0,0,8000,8000,38808,
  0,0,128000,299042,523580,169560,139120,0,0,0,0,0,
  0,0,0,0,0,
];

R.rnCaminhao = [
  10000,10000,10000,10000,10000,1245,
  0,0,0,0,0,0,0,1100,0,0,380,0,
  1480,1000,9810,9810,0,
];

R.investLeite = [
  85353,5353,4236,49950,50797,45482,
  19528,12716,12506,4554,4554,5510,35807,16377,96455,183798,85888,592197,
  282751,456411,379330,579106,0,
];

R.custeioCafe = [
  425,103,19181,99,103,108,
  103,1406,7550,11451,9152,4570,4266,104,109,223,10800,10113,
  37165,16728,6820,1503,107,
];

R.investCafe = [
  0,0,0,0,0,37920,
  20143,6393,1293,6793,5265,24628,21730,14284,16894,1190,43516,55126,
  58780,31761,50882,35254,63146,
];

R.sedeOutros = [
  3449,101,219,1638,2050,2058,
  117,205,865,2025,1501,1916,1985,235,207,329,466,5461,
  2460,2520,11640,4586,0,
];

R.totalGeral = [
  -126557, -43794, -14946, -53474, -48458, -278194,
  33783, -169184, -43387, -31982, -130800, -26380, -80967, -238320, -383051, -477293, -511259, -1379349,
  -842562, -1005833, -1128502, -974277, -101885,
];

const sumArr = (a: number[]) => a.reduce((s, x) => s + x, 0);

R.totals23m = {
  receitaLeite: sumArr(R.receitaLeite),
  receitaCafe: sumArr(R.receitaCafe),
  custeioLeiteBPO: sumArr(R.custeioLeiteBPO),
  animalAquisicao: sumArr(R.animalAquisicao),
  rnCaminhao: sumArr(R.rnCaminhao),
  investLeite: sumArr(R.investLeite),
  custeioCafe: sumArr(R.custeioCafe),
  investCafe: sumArr(R.investCafe),
  sedeOutros: sumArr(R.sedeOutros),
  totalGeral: sumArr(R.totalGeral),
};

R.custeioLeitePuro = R.custeioLeiteBPO.map(
  (v: number, i: number) => v - R.animalAquisicao[i] - R.rnCaminhao[i],
);
R.totals23m.custeioLeitePuro = sumArr(R.custeioLeitePuro);

R.saldoOpLeite = R.receitaLeite.map(
  (r: number, i: number) => r - R.custeioLeitePuro[i],
);

R.idx2024H2 = [0,1,2,3,4,5];
R.idx2025 = [6,7,8,9,10,11,12,13,14,15,16,17];
R.idx2026YTD = [18,19,20,21,22];

const sumAt = (a: number[], idxs: number[]) => idxs.reduce((s, i) => s + a[i], 0);

R.k2025 = {
  receitaLeite: sumAt(R.receitaLeite, R.idx2025),
  receitaCafe: 0,
  custeioLeiteBPO: sumAt(R.custeioLeiteBPO, R.idx2025),
  custeioLeitePuro: sumAt(R.custeioLeitePuro, R.idx2025),
  animalAquisicao: sumAt(R.animalAquisicao, R.idx2025),
  investLeite: sumAt(R.investLeite, R.idx2025),
  custeioCafe: sumAt(R.custeioCafe, R.idx2025),
  investCafe: sumAt(R.investCafe, R.idx2025),
  totalGeral: sumAt(R.totalGeral, R.idx2025),
  saldoOpLeite: sumAt(R.saldoOpLeite, R.idx2025),
};

R.k2026YTD = {
  receitaLeite: sumAt(R.receitaLeite, R.idx2026YTD),
  receitaCafe: sumAt(R.receitaCafe, R.idx2026YTD),
  custeioLeiteBPO: sumAt(R.custeioLeiteBPO, R.idx2026YTD),
  custeioLeitePuro: sumAt(R.custeioLeitePuro, R.idx2026YTD),
  animalAquisicao: sumAt(R.animalAquisicao, R.idx2026YTD),
  investLeite: sumAt(R.investLeite, R.idx2026YTD),
  custeioCafe: sumAt(R.custeioCafe, R.idx2026YTD),
  investCafe: sumAt(R.investCafe, R.idx2026YTD),
  totalGeral: sumAt(R.totalGeral, R.idx2026YTD),
  saldoOpLeite: sumAt(R.saldoOpLeite, R.idx2026YTD),
};

R.categoriasReais = [
  { id: "racao",        nome: "Ração",                      grupo: "Atv. Leiteira", subgrupo: "Criação Animal",  total23m: 2869271, ytd2026: 506478, delta: 26,   atividade: "leite" },
  { id: "curral",       nome: "Curral",                     grupo: "Atv. Leiteira", subgrupo: "Criação Animal",  total23m: 1368092, ytd2026: 786468, delta: 142,  atividade: "leite" },
  { id: "pessoalSal",   nome: "Pessoal — Salário",          grupo: "Atv. Leiteira", subgrupo: "Produção Rural",  total23m: 1351447, ytd2026: 352339, delta: 88,   atividade: "leite" },
  { id: "animalAq",     nome: "Animal Aquisição",           grupo: "Atv. Leiteira", subgrupo: "Criação Animal",  total23m: 1314110, ytd2026: 0,      delta: -100, atividade: "leite", flag: "investimento-misclassificado" },
  { id: "medic",        nome: "Medicamento Animal",         grupo: "Atv. Leiteira", subgrupo: "Criação Animal",  total23m: 321168,  ytd2026: 149425, delta: 58,   atividade: "leite" },
  { id: "rnCurral",     nome: "RN — Curral (estrutural)",   grupo: "Atv. Leiteira", subgrupo: "Imóveis",         total23m: 290097,  ytd2026: 73395,  delta: 64,   atividade: "leite" },
  { id: "combust",      nome: "Combustível",                grupo: "Atv. Leiteira", subgrupo: "Máq. e Equip.",   total23m: 134381,  ytd2026: 65030,  delta: 28,   atividade: "outros" },
  { id: "rnPessoal",    nome: "RN — Pessoal (estrutural)",  grupo: "Atv. Leiteira", subgrupo: "Imóveis",         total23m: 117605,  ytd2026: 30187,  delta: 4,    atividade: "outros" },
  { id: "fgts",         nome: "Pessoal — FGTS",             grupo: "Atv. Leiteira", subgrupo: "Produção Rural",  total23m: 104072,  ytd2026: 26016,  delta: 12,   atividade: "leite" },
  { id: "darf",         nome: "DARF",                       grupo: "Atv. Leiteira", subgrupo: "Impostos",        total23m: 104542,  ytd2026: 24117,  delta: 8,    atividade: "leite" },
  { id: "rescisao",     nome: "Pessoal — Rescisão",         grupo: "Atv. Leiteira", subgrupo: "Produção Rural",  total23m: 84435,   ytd2026: 10996,  delta: -38,  atividade: "leite" },
  { id: "contabil",     nome: "Contabilidade",              grupo: "Atv. Leiteira", subgrupo: "Despesas Admin.", total23m: 77634,   ytd2026: 14430,  delta: 18,   atividade: "outros" },
  { id: "rnCaminhao",   nome: "RN — Caminhão e Trator",     grupo: "Atv. Leiteira", subgrupo: "Imóveis",         total23m: 74825,   ytd2026: 22100,  delta: 90,   atividade: "outros", flag: "investimento-misclassificado" },
  { id: "bpoAdmin",     nome: "Admin — BPO Financeiro",     grupo: "Atv. Leiteira", subgrupo: "Despesas Admin.", total23m: 66122,   ytd2026: 11520,  delta: 0,    atividade: "outros" },
  { id: "ferias",       nome: "Pessoal — Férias",           grupo: "Atv. Leiteira", subgrupo: "Produção Rural",  total23m: 52937,   ytd2026: 3827,   delta: -64,  atividade: "leite" },
  { id: "manutencao",   nome: "Manutenção",                 grupo: "Atv. Leiteira", subgrupo: "Máq. e Equip.",   total23m: 48475,   ytd2026: 16281,  delta: -22,  atividade: "outros" },
  { id: "sedeOut",      nome: "Sede / não alocado",         grupo: "(sem CCusto)",  subgrupo: "Criação Animal",  total23m: 46036,   ytd2026: 21205,  delta: 84,   atividade: "outros" },
  { id: "energia",      nome: "Energia Elétrica",           grupo: "Atv. Leiteira", subgrupo: "Criação Animal",  total23m: 3056,    ytd2026: 472,    delta: -8,   atividade: "leite" },
  { id: "internet",     nome: "Internet",                   grupo: "Atv. Leiteira", subgrupo: "Despesas Admin.", total23m: 3080,    ytd2026: 700,    delta: 0,    atividade: "outros" },
  { id: "tarifas",      nome: "Tarifas bancárias",          grupo: "Atv. Leiteira", subgrupo: "Despesas Admin.", total23m: 3715,    ytd2026: 568,    delta: -22,  atividade: "outros" },
];

R.investimentoReais = [
  { nome: "Investimento Criação Animal (matrizes)", grupo: "Atv. Leiteira - Investimento", total23m: 2204454, ytd2026: 1750398, atividade: "leite" },
  { nome: "Máquinas e Equipamentos",                grupo: "Atv. Leiteira - Investimento", total23m: 680793,  ytd2026: 218612,  atividade: "outros" },
  { nome: "Investimento Plantio Café",              grupo: "Plantio Café - investimento",  total23m: 620783,  ytd2026: 239823,  atividade: "cafe" },
  { nome: "Obra Civil — Empreitada",                grupo: "Atv. Leiteira - Investimento", total23m: 116399,  ytd2026: 1584,    atividade: "outros" },
  { nome: "Obra Civil — Material",                  grupo: "Atv. Leiteira - Investimento", total23m: 7013,    ytd2026: 0,       atividade: "outros" },
];

R.caixaHoje = {
  total: 184_420,
  contas: [
    { nome: "Sicoob PJ — ag. 9012", saldo: 142_380 },
    { nome: "Banco do Brasil — ag. 1234-5", saldo: 38_420 },
    { nome: "Caixa da fazenda", saldo: 3_620 },
  ],
};

R.volumeLeite = {
  litros2025: Math.round(R.k2025.receitaLeite / 3.20),
  litros2026YTD: Math.round(R.k2026YTD.receitaLeite / 3.50),
  precoMedio2025: 3.20,
  precoMedio2026: 3.50,
  custoPorLitro2025: R.k2025.custeioLeitePuro / (R.k2025.receitaLeite / 3.20),
};

R.inconsistencias = [
  {
    id: "animal-aq", severidade: "alta",
    titulo: "“Animal Aquisição” marcado como custeio",
    valor: 1314110,
    detalhe: "R$ 1,31 mi em compras de matrizes Girolando entre Out/24 e Jul/25 estão classificadas em Atividade Leiteira → Criação Animal → Custeio. Isso é compra de gado — é investimento. Quando reclassificado, o operacional do leite em 2025 passa de aparente +R$ 102k para o real −R$ 703k.",
    acao: "Reclassificar como Investimento",
    impacto: "Operacional do leite 2025: +R$ 1,26 mi para −R$ 703k",
  },
  {
    id: "rn-caminhao", severidade: "media",
    titulo: "“RN — Caminhão e Trator” em Curral",
    valor: 74825,
    detalhe: "R$ 74,8 mil distribuídos em 23 meses como “Curral” mas, pela natureza (caminhão, trator), parece ser custeio estrutural ou financiamento. Há lançamentos repetidos de R$ 10.000/mês até Dez/24.",
    acao: "Mover para Estrutural — Financiamentos",
    impacto: "Curral cai de R$ 1,73 mi para R$ 1,66 mi",
  },
  {
    id: "atv-plantio", severidade: "media",
    titulo: "“Atividade Plantio” × “Plantio Café”",
    valor: 304138,
    detalhe: "Receita de café (R$ 304k) lançada em CCusto “Atividade Plantio”. Custeio e investimento de café em CCusto “Plantio Café”. São o mesmo negócio — unificar dá leitura limpa por safra.",
    acao: "Unificar CCustos",
    impacto: "Margem café 2026 fica visível direta: R$ 304k − R$ 78k custeio = R$ 226k",
  },
  {
    id: "vazio-sede", severidade: "baixa",
    titulo: "Lançamentos sem CCusto",
    valor: 46036,
    detalhe: "R$ 46k em “(vazio)” → Sede — pequenos itens (luz, água, manutenção da casa-grande). Atribuir a “Outros / Estrutural” para sair da leitura de Criação Animal.",
    acao: "Alocar em Estrutural",
    impacto: "Limpa o operacional do leite em R$ 46k",
  },
];

R.promptsSugeridos = [
  "Por que o leite não está pagando o leite?",
  "Quanto subiu o gasto com curral em 2026?",
  "Qual o real custo por litro de leite produzido?",
  "Compare custeio operacional 2025 vs 2026 YTD.",
  "Onde está cada real do investimento de R$ 4,9 mi?",
  "Bezerro passou mal — o que dou pra ele?",
];

R.iaScope = {
  periodo: "Jul/2024 — 04/Mai/2026",
  lancamentos: "8.412 lançamentos",
  notas: "5.380 notas fiscais",
  categorias: "27 categorias / 6 CCustos",
  conexao: "Importado da planilha BPO 04/05/2026",
};

R.kpisYTD = {
  receita: {
    value: Math.round((R.k2026YTD.receitaLeite + R.k2026YTD.receitaCafe) / 1000),
    prev: 762,
    label: "Receita total",
  },
  custeio: {
    value: Math.round((R.k2026YTD.custeioLeitePuro + R.k2026YTD.custeioCafe + sumArr(R.sedeOutros.slice(18))) / 1000),
    prev: 415,
    label: "Custeio operacional",
  },
  investimento: {
    value: Math.round((R.k2026YTD.investLeite + R.k2026YTD.investCafe + R.k2026YTD.animalAquisicao) / 1000),
    prev: 49,
    label: "Investimento",
  },
  fluxo: {
    value: Math.round(R.k2026YTD.totalGeral / 1000),
    prev: -211,
    label: "Fluxo líquido",
  },
};

R.atividades = [
  {
    key: "leite", nome: "Leite", cor: "var(--leite)", corSoft: "var(--leite-soft)",
    receita: Math.round(R.k2026YTD.receitaLeite / 1000),
    custeio: Math.round(R.k2026YTD.custeioLeitePuro / 1000),
    investimento: Math.round(R.k2026YTD.investLeite / 1000),
    margemOp: Math.round((R.k2026YTD.receitaLeite - R.k2026YTD.custeioLeitePuro) / 1000),
    custoUnit: { label: "R$ por litro", custo: 16.32, receita: 3.50, margem: -12.82 },
    volume: {
      label: "Litros entregues YTD",
      value: R.volumeLeite.litros2026YTD.toLocaleString("pt-BR") + " L",
      subtitle: "Mai/26 ainda não fechado",
    },
    pctReceita: 64,
  },
  {
    key: "cafe", nome: "Café", cor: "var(--cafe)", corSoft: "var(--cafe-soft)",
    receita: Math.round(R.k2026YTD.receitaCafe / 1000),
    custeio: Math.round(R.k2026YTD.custeioCafe / 1000),
    investimento: Math.round(R.k2026YTD.investCafe / 1000),
    margemOp: Math.round((R.k2026YTD.receitaCafe - R.k2026YTD.custeioCafe) / 1000),
    custoUnit: { label: "R$ por saca", custo: 180, receita: 707, margem: 527 },
    volume: { label: "Sacas safra 2026", value: "430 sc", subtitle: "tipo 6/7, bebida dura" },
    pctReceita: 36,
  },
  {
    key: "outros", nome: "Outros / Sede", cor: "var(--outros)", corSoft: "var(--outros-soft)",
    receita: 0,
    custeio: Math.round(sumArr(R.sedeOutros.slice(18)) / 1000),
    investimento: 0,
    margemOp: -Math.round(sumArr(R.sedeOutros.slice(18)) / 1000),
    custoUnit: null,
    volume: { label: "Inclui", value: "Sede, manutenção geral", subtitle: "sem CCusto definido" },
    pctReceita: 0,
  },
];

R.fluxoMensal = R.idx2026YTD.map((idx: number, i: number) => ({
  mes: ["Jan", "Fev", "Mar", "Abr", "Mai*"][i],
  receitaLeite: Math.round(R.receitaLeite[idx] / 1000),
  receitaCafe: Math.round(R.receitaCafe[idx] / 1000),
  receitaOutros: 0,
  custeio: Math.round((R.custeioLeitePuro[idx] + R.custeioCafe[idx] + R.sedeOutros[idx]) / 1000),
  investimento: Math.round((R.investLeite[idx] + R.investCafe[idx] + R.animalAquisicao[idx]) / 1000),
}));

R.topCategorias = R.categoriasReais
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .filter((c: any) => c.ytd2026 > 5000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .sort((a: any, b: any) => b.ytd2026 - a.ytd2026)
  .slice(0, 8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .map((c: any, i: number) => ({
    rank: i + 1,
    nome: c.nome,
    sub: c.subgrupo,
    total: Math.round(c.ytd2026 / 1000),
    leite: c.atividade === "leite" ? Math.round(c.ytd2026 / 1000) : 0,
    cafe: c.atividade === "cafe" ? Math.round(c.ytd2026 / 1000) : 0,
    outros: c.atividade === "outros" ? Math.round(c.ytd2026 / 1000) : 0,
    delta: c.delta,
  }));

const _rec26 = Math.round((R.k2026YTD.receitaLeite + R.k2026YTD.receitaCafe) / 1000);
const _cus26 = Math.round((R.k2026YTD.custeioLeitePuro + R.k2026YTD.custeioCafe + sumArr(R.sedeOutros.slice(18))) / 1000);
const _inv26 = Math.round((R.k2026YTD.investLeite + R.k2026YTD.investCafe + R.k2026YTD.animalAquisicao) / 1000);
R.waterfall = [
  { key: "receita",     label: "Receita",       value: _rec26,                       type: "receita" },
  { key: "custeio",     label: "Custeio",       value: -_cus26,                      type: "custeio" },
  { key: "operacional", label: "Operacional",   value: _rec26 - _cus26,              type: "saldo" },
  { key: "investimento",label: "Investimento",  value: -_inv26,                      type: "investimento" },
  { key: "fluxo",       label: "Fluxo líquido", value: _rec26 - _cus26 - _inv26,     type: "fluxo" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
R.investimentoBreakdown = R.investimentoReais.map((inv: any) => ({
  nome: inv.nome,
  value: Math.round(inv.ytd2026 / 1000),
  atividade: inv.atividade,
}));

R.gastos = [
  { id: 1,  data: "05/mai", fornecedor: "NTG Data Serviços Administrativos", subtitle: "BPO Financeiro abril",  categoria: "Despesas Administrativas / Admin BPO", valor: 2880.00,  atividade: "outros", investimento: false },
  { id: 2,  data: "05/mai", fornecedor: "Folha — 16 colaboradores",          subtitle: "salários referente 04/2026", categoria: "Produção Rural / Pessoal — Salário", valor: 20797.68, atividade: "leite", investimento: false },
  { id: 3,  data: "04/mai", fornecedor: "Siloking do Brasil Comércio",       subtitle: "equipamento de ordenha", categoria: "Criação Animal / Curral", valor: 18481.00, atividade: "leite", investimento: false },
  { id: 4,  data: "04/mai", fornecedor: "Energisa Minas Rio (949423)",       subtitle: "energia março/26",      categoria: "Criação Animal / Curral", valor: 13584.18, atividade: "leite", investimento: false },
  { id: 5,  data: "04/mai", fornecedor: "Liptolandia Madeiras",              subtitle: "madeira p/ cerca",       categoria: "Criação Animal / Curral", valor: 4830.01, atividade: "leite", investimento: false },
  { id: 6,  data: "04/mai", fornecedor: "Dianagro Comércio",                 subtitle: "insumos manejo",         categoria: "Criação Animal / Curral", valor: 833.33, atividade: "leite", investimento: false },
  { id: 7,  data: "04/mai", fornecedor: "Imunodot Indústria",                subtitle: "imunógenos x2",          categoria: "Criação Animal / Curral", valor: 310.00, atividade: "leite", investimento: false },
  { id: 8,  data: "04/mai", fornecedor: "Agropecuária Lafeni",               subtitle: "insumos diversos",       categoria: "Criação Animal / Curral", valor: 282.16, atividade: "leite", investimento: false },
  { id: 9,  data: "04/mai", fornecedor: "Mercado Pago",                      subtitle: "compra diversa",         categoria: "Criação Animal / Curral", valor: 108.73, atividade: "leite", investimento: false },
  { id: 10, data: "04/mai", fornecedor: "Nutrivet Comércio (678916)",        subtitle: "antibiótico",            categoria: "Criação Animal / Medicamento Animal", valor: 780.29, atividade: "leite", investimento: false },
  { id: 11, data: "04/mai", fornecedor: "Nutrivet Comércio (683492)",        subtitle: "vermífugo",              categoria: "Criação Animal / Medicamento Animal", valor: 431.10, atividade: "leite", investimento: false },
  { id: 12, data: "04/mai", fornecedor: "Cargil Agrícola S.A.",              subtitle: "ração concentrada",      categoria: "Criação Animal / Ração", valor: 33840.00, atividade: "leite", investimento: false },
  { id: 13, data: "04/mai", fornecedor: "Rações Varoto",                     subtitle: "ração suplementar",      categoria: "Criação Animal / Ração", valor: 4620.00, atividade: "leite", investimento: false },
  { id: 14, data: "04/mai", fornecedor: "Energisa Minas Rio (7746257)",      subtitle: "energia galpão café",    categoria: "Plantio / Galpão", valor: 106.93, atividade: "cafe", investimento: false },
];

R.iaRespostas = {
  "Por que o leite não está pagando o leite?": {
    kind: "split",
    narrative: "Em 2025, a receita do leite foi R$ 2,06 mi e o custeio bruto R$ 4,02 mi — o que parece um buraco de R$ 1,96 mi. Mas R$ 1,26 mi disso é compra de matrizes Girolando lançada como Custeio (categoria “Animal Aquisição”). Reclassificada como Investimento, o custeio puro do leite fica R$ 2,76 mi — ainda 34% acima da receita. O problema operacional é real: o rebanho está consumindo mais do que entrega.",
    split: [
      { label: "Receita leite 2025", value: 2059, share: 43 },
      { label: "Custeio puro leite 2025", value: -2760, share: 57 },
    ],
  },
  "Qual o real custo por litro de leite produzido?": {
    kind: "kpi",
    narrative: "Considerando 643 mil litros entregues em 2025 e custeio puro de R$ 2,76 mi, o custo por litro está em R$ 4,29. Com preço médio de venda em R$ 3,20, a margem por litro é negativa em R$ 1,09. Em 2026 YTD o cenário piorou — custo subiu para R$ 18,30/L pelo volume reduzido com o rebanho em fase de transição.",
    kpi: { value: "R$ 4,29 / L", caption: "Custo puro 2025", delta: "−R$ 1,09 por litro vs preço de venda" },
    chartKind: "mini-bar",
    chartData: [
      { x: "Jan", y: 4.10 }, { x: "Fev", y: 4.32 }, { x: "Mar", y: 4.18 }, { x: "Abr", y: 4.36 }, { x: "Mai", y: 4.51 },
    ],
    foot: "Cálculo: custeio puro / volume estimado. Não inclui investimento em matrizes.",
  },
  "Quanto subiu o gasto com curral em 2026?": {
    kind: "compare",
    narrative: "Curral em 2026 YTD (4 meses) já consumiu R$ 786k — 142% acima dos R$ 325k do mesmo período em 2025. Energisa, Siloking e Liptolandia (madeira) puxam a alta — parece reforma estrutural em curso.",
    compare: [
      { label: "Curral Jan-Abr 2025", value: "R$ 325k", sub: "4 fornecedores principais" },
      { label: "Curral Jan-Abr 2026", value: "R$ 786k", sub: "9 fornecedores ativos" },
    ],
    delta: "+ R$ 461 mil (+142%)",
  },
  "Compare custeio operacional 2025 vs 2026 YTD.": {
    kind: "compare",
    narrative: "Mesmo separando investimento, o custeio puro leite cresceu 28% em base mensal: R$ 230k/mês em 2025 vs R$ 574k/mês em 2026. A 4 meses, 2026 já gastou mais que o ano inteiro de 2025 em custeio operacional do leite.",
    compare: [
      { label: "Custeio puro 2025 (12m)", value: "R$ 2,76 mi", sub: "R$ 230k/mês média" },
      { label: "Custeio puro 2026 YTD (5m)", value: "R$ 2,88 mi", sub: "R$ 574k/mês média" },
    ],
    delta: "+150% por mês",
  },
  "Onde está cada real do investimento de R$ 4,9 mi?": {
    kind: "topGasto",
    narrative: "Em 23 meses, R$ 4,93 mi foram investidos. Compra de gado (matrizes + arrendamento) lidera com 71% do investimento — e R$ 1,3 mi disso ainda está marcado como custeio na planilha do BPO.",
    table: {
      title: "Investimento 23 meses (jul/24–mai/26)",
      cols: ["Categoria", "CCusto", "Atividade", "Valor"],
      rows: [
        ["Compra de matrizes (Investimento Criação Animal)", "Atv. Leiteira-Invest", "Leite", "R$ 2.204k"],
        ["Animal Aquisição *invest.*", "Atv. Leiteira", "Leite", "R$ 1.314k"],
        ["Máquinas e Equipamentos", "Atv. Leiteira-Invest", "Outros", "R$ 681k"],
        ["Plantio Café (expansão talhão)", "Plantio Café-Invest", "Café", "R$ 621k"],
        ["Obra Civil (empreitada + material)", "Atv. Leiteira-Invest", "Outros", "R$ 123k"],
      ],
    },
    foot: "* Item marcado como custeio operacional mas que pela natureza (compra de animal vivo) é investimento.",
  },
  "Bezerro passou mal — o que dou pra ele?": {
    kind: "vet",
    narrative: "Sem ver o animal não dá pra diagnosticar. Abaixo, protocolo de triagem rápido e os medicamentos que vocês têm em estoque (consultados via Nutrivet, fornecedor regular).",
    triagem: [
      "Mede temperatura retal (referência: 38,5–39,5 °C).",
      "Observa as fezes — diarreia aquosa, com sangue ou normal?",
      "Verifica se está bebendo água/leite e a postura.",
      "Cheira a boca — odor azedo indica acidose.",
    ],
    cenarios: [
      { quando: "Diarreia + apatia", protocolo: "Hidratação oral (eletrólito), bloqueio com sulfa via oral. Não medicar com antibiótico injetável de largada." },
      { quando: "Febre + tosse / corrimento", protocolo: "Possível pneumonia. Florfenicol 30 mg/kg, dose única IM. Isolar do lote." },
      { quando: "Inchaço abdominal", protocolo: "Suspeita de timpanismo. Mover o animal, avaliar troacarter se grave." },
    ],
    estoque: "Estoque atual estimado: Florfenicol Nutrivet 250 ml (2 frascos), Antiparasitário Nutrivet (1 caixa), Sulfa pó (~800g).",
  },
};

// ===== Categorias detalhe (drill) =====
R.MESES_12M = ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai"];

R.categoriasDetalhe = {
  racao: {
    id: "racao", nome: "Ração", grupo: "Insumos animais",
    total: 625, delta: 18, pctTotal: 38.6,
    monthly12m: [105, 112, 108, 118, 124, 132, 138, 128, 121, 132, 128, 116],
    monthlyPriorYear: [88, 92, 95, 102, 108, 112, 115, 109, 102, 108, 110, 98],
    subcategorias: [
      { nome: "Ração concentrada gado leiteiro", total: 412, share: 65.9, monthly: [70, 76, 73, 80, 84, 90, 94, 88, 84, 92, 88, 80], cor: "var(--leite)" },
      { nome: "Sal mineral", total: 78, share: 12.5, monthly: [13, 14, 13, 15, 16, 17, 18, 16, 15, 16, 16, 14], cor: "var(--leite-2)" },
      { nome: "Ração bezerro", total: 62, share: 9.9, monthly: [10, 11, 11, 12, 12, 13, 14, 12, 11, 12, 12, 10], cor: "var(--cafe-2)" },
      { nome: "Ração de cavalo", total: 38, share: 6.1, monthly: [6, 7, 6, 7, 7, 7, 7, 6, 6, 7, 6, 6], cor: "var(--outros)" },
      { nome: "Ração de gato", total: 22, share: 3.5, monthly: [3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4], cor: "var(--outros-2)" },
      { nome: "Concentrado proteico (suplemento)", total: 13, share: 2.1, monthly: [3, 0, 1, 0, 1, 1, 1, 2, 2, 2, 2, 2], cor: "var(--ink-3)" },
    ],
    insight: "A ração concentrada para gado leiteiro respondeu por 66% do gasto da categoria. O preço por tonelada subiu 8% no ano, mas o volume aumentou — efeito do crescimento do rebanho leiteiro.",
  },
  pessoal: {
    id: "pessoal", nome: "Pessoal", grupo: "Operacional",
    total: 290, delta: 6, pctTotal: 17.9,
    monthly12m: [56, 58, 56, 58, 58, 58, 92, 58, 58, 58, 58, 58],
    monthlyPriorYear: [52, 54, 52, 54, 54, 54, 87, 54, 54, 54, 54, 54],
    subcategorias: [
      { nome: "Salários (líquido)", total: 196, share: 67.6, monthly: [38, 38, 38, 38, 38, 38, 64, 38, 38, 38, 38, 38], cor: "var(--leite)" },
      { nome: "Encargos (INSS/FGTS)", total: 58, share: 20.0, monthly: [12, 12, 12, 12, 12, 12, 16, 12, 12, 12, 12, 12], cor: "var(--cafe)" },
      { nome: "Vale alimentação", total: 18, share: 6.2, monthly: [3, 3, 3, 3, 3, 3, 6, 3, 3, 3, 3, 3], cor: "var(--outros)" },
      { nome: "EPI / uniforme", total: 10, share: 3.4, monthly: [1, 2, 1, 2, 2, 2, 4, 2, 2, 2, 2, 2], cor: "var(--leite-2)" },
      { nome: "Hora extra", total: 8, share: 2.8, monthly: [2, 3, 2, 3, 3, 3, 2, 3, 3, 3, 3, 3], cor: "var(--cafe-2)" },
    ],
    insight: "13 colaboradores fixos. 11 no leite, 1 no café (capataz da roça), 1 na sede. Pico em dezembro corresponde ao 13º salário.",
  },
  curral: {
    id: "curral", nome: "Curral", grupo: "Operacional",
    total: 168, delta: 12, pctTotal: 10.4,
    monthly12m: [32, 30, 34, 33, 35, 38, 36, 34, 32, 35, 34, 31],
    monthlyPriorYear: [28, 28, 30, 30, 30, 32, 32, 30, 28, 31, 30, 28],
    subcategorias: [
      { nome: "Higiene de ordenha (detergente, iodo)", total: 68, share: 40.5, monthly: [13, 12, 14, 14, 14, 15, 14, 14, 13, 14, 14, 13], cor: "var(--leite)" },
      { nome: "Manutenção de equipamento de ordenha", total: 42, share: 25.0, monthly: [8, 8, 9, 8, 9, 10, 9, 9, 8, 9, 9, 8], cor: "var(--cafe)" },
      { nome: "Insumos para manejo (luva, soga, arame)", total: 32, share: 19.0, monthly: [6, 6, 6, 6, 7, 7, 7, 6, 6, 7, 6, 6], cor: "var(--outros)" },
      { nome: "Cama de areia / forrageamento", total: 26, share: 15.5, monthly: [5, 4, 5, 5, 5, 6, 6, 5, 5, 5, 5, 4], cor: "var(--leite-2)" },
    ],
    insight: "Manutenção do equipamento de ordenha está em ritmo crescente — última troca de teteira foi em fevereiro/26. Próxima janela: agosto/26.",
  },
  medicamento: {
    id: "medicamento", nome: "Medicamento animal", grupo: "Insumos animais",
    total: 142, delta: 40, pctTotal: 8.8,
    monthly12m: [16, 14, 18, 17, 19, 22, 18, 18, 22, 26, 38, 38],
    monthlyPriorYear: [12, 12, 13, 13, 14, 14, 13, 14, 13, 14, 15, 16],
    subcategorias: [
      { nome: "Antibiótico (Florfenicol, Oxitetraciclina)", total: 58, share: 40.8, monthly: [6, 5, 7, 7, 8, 9, 7, 7, 9, 10, 16, 16], cor: "var(--neg)" },
      { nome: "Vermífugo / antiparasitário", total: 32, share: 22.5, monthly: [4, 3, 4, 4, 4, 5, 4, 4, 5, 6, 9, 9], cor: "var(--cafe)" },
      { nome: "Vacina (brucelose, raiva, IBR)", total: 22, share: 15.5, monthly: [3, 2, 3, 3, 3, 4, 3, 3, 3, 4, 6, 6], cor: "var(--leite)" },
      { nome: "Soro / hidratação", total: 18, share: 12.7, monthly: [2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 5, 5], cor: "var(--outros)" },
      { nome: "Vitamínico e mineral injetável", total: 12, share: 8.5, monthly: [1, 2, 2, 1, 2, 2, 2, 2, 2, 3, 2, 2], cor: "var(--leite-2)" },
    ],
    insight: "Alta de 40% concentrada em abril e maio. Coincide com pico de mastite no rebanho — vale revisar protocolo de pré-dipping com a veterinária.",
  },
  insumosCafe: {
    id: "insumosCafe", nome: "Insumos café", grupo: "Insumos vegetais",
    total: 108, delta: -8, pctTotal: 6.7,
    monthly12m: [4, 6, 8, 22, 18, 12, 8, 28, 10, 8, 6, 14],
    monthlyPriorYear: [5, 7, 9, 24, 20, 14, 9, 30, 11, 9, 7, 15],
    subcategorias: [
      { nome: "Fertilizante NPK", total: 52, share: 48.1, monthly: [2, 3, 4, 11, 9, 6, 4, 14, 5, 4, 3, 7], cor: "var(--cafe)" },
      { nome: "Defensivo (cupinicida, fungicida)", total: 28, share: 25.9, monthly: [1, 1, 2, 5, 4, 3, 2, 7, 2, 2, 1, 4], cor: "var(--cafe-2)" },
      { nome: "Calcário", total: 16, share: 14.8, monthly: [0, 1, 1, 4, 3, 2, 1, 4, 1, 1, 1, 1], cor: "var(--outros)" },
      { nome: "Adubo verde / cobertura", total: 8, share: 7.4, monthly: [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1], cor: "var(--outros-2)" },
      { nome: "Mudas (reposição talhão)", total: 4, share: 3.7, monthly: [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], cor: "var(--leite)" },
    ],
    insight: "Pico em set/25 e jan/26 corresponde aos ciclos de adubação. Próxima janela: ago–set/26 (cobertura de colheita).",
  },
  combustivel: {
    id: "combustivel", nome: "Combustível", grupo: "Operacional",
    total: 88, delta: 4, pctTotal: 5.4,
    monthly12m: [16, 15, 17, 18, 16, 17, 18, 17, 16, 18, 18, 17],
    monthlyPriorYear: [14, 14, 15, 16, 15, 16, 17, 16, 15, 17, 17, 16],
    subcategorias: [
      { nome: "Diesel S-10 (trator + caminhão)", total: 64, share: 72.7, monthly: [12, 11, 13, 13, 12, 13, 14, 13, 12, 14, 14, 13], cor: "var(--ink)" },
      { nome: "Gasolina (picape, carros)", total: 18, share: 20.5, monthly: [3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3], cor: "var(--cafe)" },
      { nome: "Lubrificantes", total: 6, share: 6.8, monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], cor: "var(--outros)" },
    ],
    insight: "Consumo estável ao longo do ano. Variação atual segue o preço do diesel — volume não mudou.",
  },
  manutencao: {
    id: "manutencao", nome: "Manutenção", grupo: "Operacional",
    total: 76, delta: -22, pctTotal: 4.7,
    monthly12m: [14, 16, 12, 10, 14, 12, 8, 10, 12, 14, 18, 14],
    monthlyPriorYear: [18, 20, 17, 14, 18, 16, 12, 14, 16, 18, 22, 18],
    subcategorias: [
      { nome: "Manutenção de máquinas (trator + colheitadeira)", total: 42, share: 55.3, monthly: [8, 9, 7, 6, 8, 7, 4, 6, 7, 8, 10, 8], cor: "var(--cafe)" },
      { nome: "Manutenção de benfeitorias (cerca, telhado)", total: 22, share: 28.9, monthly: [4, 5, 3, 3, 4, 3, 2, 3, 3, 4, 5, 4], cor: "var(--outros)" },
      { nome: "Manutenção de veículos leves", total: 12, share: 15.8, monthly: [2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 3, 2], cor: "var(--leite)" },
    ],
    insight: "Em queda — trator novo (comprado em mar/26) reduziu intervenções corretivas.",
  },
  energia: {
    id: "energia", nome: "Energia elétrica", grupo: "Estrutural",
    total: 64, delta: 8, pctTotal: 4.0,
    monthly12m: [11, 12, 12, 13, 13, 14, 12, 12, 12, 13, 13, 14],
    monthlyPriorYear: [10, 11, 11, 12, 12, 13, 11, 11, 11, 12, 12, 13],
    subcategorias: [
      { nome: "Energia rede (Energisa) — galpão e sede", total: 52, share: 81.3, monthly: [9, 10, 10, 11, 11, 12, 10, 10, 10, 11, 11, 12], cor: "var(--ink)" },
      { nome: "Diesel gerador (backup)", total: 8, share: 12.5, monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], cor: "var(--cafe)" },
      { nome: "Bomba solar (manutenção)", total: 4, share: 6.3, monthly: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0], cor: "var(--outros)" },
    ],
    insight: "Sala de ordenha + casa-grande respondem por 70% do consumo de rede.",
  },
};

// ===== Plano de contas =====
R.fornecedores = [
  { nome: "Cooperativa Boa Vista", cnpj: "12.345.678/0001-90", categoriaUsual: "Ração", lancamentos: 38 },
  { nome: "Agropecuária Silva", cnpj: "98.765.432/0001-11", categoriaUsual: "Ração / Curral / Medicamento", lancamentos: 142 },
  { nome: "Veterinária do Vale", cnpj: "44.555.666/0001-22", categoriaUsual: "Medicamento animal", lancamentos: 39 },
  { nome: "Casa do Lavrador", cnpj: "33.444.555/0001-44", categoriaUsual: "Insumos café / Sementes", lancamentos: 48 },
  { nome: "Posto Avenida", cnpj: "22.111.222/0001-33", categoriaUsual: "Combustível", lancamentos: 84 },
  { nome: "Tratores Sul", cnpj: "77.888.999/0001-55", categoriaUsual: "Manutenção máquinas", lancamentos: 14 },
  { nome: "João Mecânico (autônomo)", cnpj: "CPF 123.456.789-00", categoriaUsual: "Manutenção máquinas", lancamentos: 32 },
  { nome: "Energisa", cnpj: "06.840.748/0001-89", categoriaUsual: "Energia elétrica", lancamentos: 24 },
  { nome: "Sementes Brasil", cnpj: "11.222.333/0001-66", categoriaUsual: "Plantio café", lancamentos: 12 },
  { nome: "DeLaval do Brasil", cnpj: "55.666.777/0001-88", categoriaUsual: "Curral / Equipamento ordenha", lancamentos: 16 },
  { nome: "MSD Saúde Animal", cnpj: "60.123.456/0001-22", categoriaUsual: "Medicamento animal", lancamentos: 9 },
  { nome: "Marcondes Pecuária", cnpj: "13.579.246/0001-77", categoriaUsual: "Compra de gado (invest.)", lancamentos: 4 },
  { nome: "Auto Center Vale", cnpj: "44.222.333/0001-66", categoriaUsual: "Manutenção veículos", lancamentos: 22 },
  { nome: "Solartec Engenharia", cnpj: "55.333.111/0001-44", categoriaUsual: "Energia / Bomba solar", lancamentos: 3 },
];

R.contasBancarias = [
  { id: "bb-1234-5", nome: "Banco do Brasil ag. 1234-5", saldo: 142_380.40 },
  { id: "sicred-9012", nome: "Sicredi ag. 9012", saldo: 38_420.10 },
  { id: "caixa-fazenda", nome: "Caixa da fazenda (dinheiro)", saldo: 4_200.00 },
];

R.gruposPlano = [
  {
    id: "insumos-animais", nome: "Insumos animais", pilha: "Custeio",
    categorias: [
      { id: "racao",       nome: "Ração",              ref: "racao" },
      { id: "medicamento", nome: "Medicamento animal", ref: "medicamento" },
      { id: "suplementacao", nome: "Suplementação mineral",
        subcategorias: [
          { nome: "Mineral proteinado", total: 18, lancamentos: 12 },
          { nome: "Tamponante de rúmen", total: 8, lancamentos: 6 },
        ],
        total: 26, lancamentos: 18 },
    ],
  },
  {
    id: "operacional", nome: "Operacional", pilha: "Custeio",
    categorias: [
      { id: "pessoal",     nome: "Pessoal",     ref: "pessoal" },
      { id: "curral",      nome: "Curral",      ref: "curral" },
      { id: "combustivel", nome: "Combustível", ref: "combustivel" },
      { id: "manutencao",  nome: "Manutenção",  ref: "manutencao" },
    ],
  },
  {
    id: "insumos-vegetais", nome: "Insumos vegetais", pilha: "Custeio",
    categorias: [
      { id: "insumosCafe", nome: "Insumos café", ref: "insumosCafe" },
      { id: "insumos-pasto", nome: "Insumos pasto",
        subcategorias: [
          { nome: "Calcário", total: 8, lancamentos: 4 },
          { nome: "Semente forrageira", total: 6, lancamentos: 3 },
        ],
        total: 14, lancamentos: 7 },
    ],
  },
  {
    id: "estrutural", nome: "Estrutural", pilha: "Custeio",
    categorias: [
      { id: "energia", nome: "Energia elétrica", ref: "energia" },
      { id: "agua", nome: "Água e saneamento",
        subcategorias: [
          { nome: "Outorga ANA", total: 2, lancamentos: 1 },
          { nome: "Manutenção poço", total: 4, lancamentos: 2 },
        ],
        total: 6, lancamentos: 3 },
      { id: "tributos", nome: "Tributos rurais",
        subcategorias: [
          { nome: "ITR", total: 28, lancamentos: 1 },
          { nome: "FUNRURAL", total: 14, lancamentos: 12 },
          { nome: "Taxa municipal", total: 3, lancamentos: 4 },
        ],
        total: 45, lancamentos: 17 },
    ],
  },
  {
    id: "investimento", nome: "Investimento", pilha: "Investimento",
    categorias: [
      { id: "compra-gado", nome: "Compra de gado",
        subcategorias: [
          { nome: "Matrizes Girolando", total: 1680, lancamentos: 4 },
          { nome: "Touro reprodutor", total: 142, lancamentos: 1 },
          { nome: "Bezerras", total: 68, lancamentos: 2 },
        ],
        total: 1890, lancamentos: 7 },
      { id: "maquinario", nome: "Maquinário",
        subcategorias: [
          { nome: "Trator (CASE Farmall 90)", total: 420, lancamentos: 1 },
          { nome: "Colheitadeira café", total: 180, lancamentos: 1 },
          { nome: "Implementos (grade, ensilagem)", total: 120, lancamentos: 3 },
        ],
        total: 720, lancamentos: 5 },
      { id: "plantio-cafe", nome: "Plantio café",
        subcategorias: [
          { nome: "Mudas (expansão talhão 4)", total: 284, lancamentos: 2 },
          { nome: "Preparo de solo", total: 132, lancamentos: 4 },
          { nome: "Mão de obra plantio", total: 71, lancamentos: 8 },
        ],
        total: 487, lancamentos: 14 },
      { id: "benfeitorias", nome: "Benfeitorias",
        subcategorias: [
          { nome: "Cerca elétrica", total: 88, lancamentos: 3 },
          { nome: "Reforma do galpão", total: 248, lancamentos: 6 },
          { nome: "Sede (anexo)", total: 96, lancamentos: 4 },
          { nome: "Irrigação", total: 35, lancamentos: 2 },
        ],
        total: 467, lancamentos: 15 },
    ],
  },
];

R.sugestoesPlano = [
  {
    titulo: "Separar “Ração concentrada gado leiteiro” em ração de novilha × ração de vaca",
    detalhe: "Detectei 38 lançamentos em ração concentrada que parecem ser de dois tipos distintos pela composição da nota.",
    acao: "Separar agora",
  },
  {
    titulo: "Mover “Manutenção da bomba solar” para Estrutural · Energia",
    detalhe: "3 lançamentos em Manutenção que pelo padrão pertencem ao grupo de energia.",
    acao: "Mover",
  },
  {
    titulo: "Criar grupo “Veterinário externo” dentro de Insumos animais",
    detalhe: "Você lançou 14 consultas avulsas misturadas com medicamentos.",
    acao: "Criar grupo",
  },
];

export const RioNovo = R;
export default R;
