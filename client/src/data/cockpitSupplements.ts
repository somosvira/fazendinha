/* Rio Novo — dados estáticos que complementam o payload do /api/dashboard.
 *
 * O backend agrega os números reais (categorias, totais, DRE, timeline) mas não
 * modela três coisas que o cockpit do Dashboard usa:
 *   - subcategorias  ("Ração" abre em ração de gado, de bezerro, sal mineral…)
 *   - fornecedores   (top fornecedores por categoria, com CNPJ)
 *   - volumeLeite    (litros estimados + custo/litro, derivado do preço CEPEA)
 *
 * Subcategorias e fornecedores são sintetizados (mesma estratégia do protótipo
 * de design): o backend não tem o conceito de subcategoria, então até existir
 * essa modelagem real, o drill mostra a composição estimada. As chaves são por
 * NOME de categoria (normalizado), porque o /api/dashboard devolve o id numérico
 * do Prisma — diferente dos slugs do mock de design.
 */

export type Subcategoria = {
  nome: string;
  share: number; // fração do total da categoria-pai (somam ~1)
  lanc: number;
  fornecedor: string;
};

export type Fornecedor = {
  nome: string;
  cnpj: string;
  categoriaUsual: string;
  lancamentos: number;
};

/** Normaliza nome de categoria: minúsculas, sem acento, hífens/traços unificados. */
function normCat(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[‐-―]/g, "-") // travessões → hífen
    .replace(/\s+/g, " ")
    .trim();
}

/* subcategorias por NOME de categoria (normalizado) */
const SUBCATS: Record<string, Subcategoria[]> = {
  "racao": [
    { nome: "Ração concentrada — gado leiteiro", share: 0.52, lanc: 142, fornecedor: "Cargil Agrícola" },
    { nome: "Silagem / volumoso", share: 0.18, lanc: 38, fornecedor: "produção própria + Lafeni" },
    { nome: "Sal mineral", share: 0.11, lanc: 56, fornecedor: "Rações Varoto" },
    { nome: "Ração de bezerro", share: 0.09, lanc: 44, fornecedor: "Cargil Agrícola" },
    { nome: "Núcleo proteico (suplemento)", share: 0.05, lanc: 22, fornecedor: "Nutrivet" },
    { nome: "Ração de cavalo", share: 0.03, lanc: 28, fornecedor: "Agropecuária Lafeni" },
    { nome: "Ração de cachorro", share: 0.02, lanc: 31, fornecedor: "Mercado / diversos" },
  ],
  "curral": [
    { nome: "Equipamento de ordenha (Siloking/DeLaval)", share: 0.30, lanc: 18, fornecedor: "Siloking do Brasil" },
    { nome: "Energia do curral", share: 0.22, lanc: 46, fornecedor: "Energisa Minas Rio" },
    { nome: "Madeira e cerca", share: 0.18, lanc: 24, fornecedor: "Liptolandia Madeiras" },
    { nome: "Higiene de ordenha (detergente, iodo)", share: 0.12, lanc: 38, fornecedor: "Agropecuária Lafeni" },
    { nome: "Insumos de manejo (luva, soga, arame)", share: 0.10, lanc: 52, fornecedor: "Dianagro" },
    { nome: "Imunógenos / sanidade", share: 0.08, lanc: 14, fornecedor: "Imunodot" },
  ],
  "pessoal - salario": [
    { nome: "Ordenhadores (4 colaboradores)", share: 0.42, lanc: 96, fornecedor: "Folha de pagamento" },
    { nome: "Tratadores de campo (5)", share: 0.28, lanc: 120, fornecedor: "Folha de pagamento" },
    { nome: "Capataz / encarregado", share: 0.14, lanc: 24, fornecedor: "Folha de pagamento" },
    { nome: "13º e férias (rateados)", share: 0.10, lanc: 48, fornecedor: "Folha de pagamento" },
    { nome: "Diaristas / safristas", share: 0.06, lanc: 60, fornecedor: "Folha de pagamento" },
  ],
  "animal aquisicao": [
    { nome: "Matrizes Girolando", share: 0.74, lanc: 4, fornecedor: "Marcondes Pecuária" },
    { nome: "Bezerras de reposição", share: 0.16, lanc: 2, fornecedor: "Marcondes Pecuária" },
    { nome: "Touro reprodutor", share: 0.10, lanc: 1, fornecedor: "Leilão regional" },
  ],
  "medicamento animal": [
    { nome: "Antibiótico (Florfenicol, Oxitetraciclina)", share: 0.38, lanc: 42, fornecedor: "Nutrivet" },
    { nome: "Vermífugo / antiparasitário", share: 0.24, lanc: 36, fornecedor: "Nutrivet" },
    { nome: "Vacina (brucelose, raiva, IBR)", share: 0.16, lanc: 18, fornecedor: "MSD Saúde Animal" },
    { nome: "Soro / hidratação", share: 0.13, lanc: 24, fornecedor: "Nutrivet" },
    { nome: "Vitamínico injetável", share: 0.09, lanc: 16, fornecedor: "Nutrivet" },
  ],
  "combustivel": [
    { nome: "Diesel S-10 (trator + caminhão)", share: 0.70, lanc: 62, fornecedor: "Posto Avenida" },
    { nome: "Gasolina (picape, carros)", share: 0.22, lanc: 18, fornecedor: "Posto Avenida" },
    { nome: "Lubrificantes / graxa", share: 0.08, lanc: 14, fornecedor: "Posto Avenida" },
  ],
  "manutencao": [
    { nome: "Máquinas (trator, colheitadeira)", share: 0.55, lanc: 18, fornecedor: "Tratores Sul" },
    { nome: "Benfeitorias (cerca, telhado)", share: 0.29, lanc: 12, fornecedor: "João Mecânico" },
    { nome: "Veículos leves", share: 0.16, lanc: 22, fornecedor: "Auto Center Vale" },
  ],
  "pessoal - fgts": [
    { nome: "FGTS produção rural", share: 0.78, lanc: 96, fornecedor: "Guia recolhimento" },
    { nome: "FGTS administrativo", share: 0.22, lanc: 24, fornecedor: "Guia recolhimento" },
  ],
  "pessoal - rescisao": [
    { nome: "Rescisões 2024", share: 0.45, lanc: 6, fornecedor: "Folha de pagamento" },
    { nome: "Rescisões 2025", share: 0.55, lanc: 8, fornecedor: "Folha de pagamento" },
  ],
  "pessoal - ferias": [
    { nome: "Férias produção rural", share: 0.82, lanc: 18, fornecedor: "Folha de pagamento" },
    { nome: "Férias administrativo", share: 0.18, lanc: 6, fornecedor: "Folha de pagamento" },
  ],
  "contabilidade": [
    { nome: "Honorário contábil mensal", share: 0.70, lanc: 23, fornecedor: "Contadora Aline Souza" },
    { nome: "Obrigações acessórias / SPED", share: 0.30, lanc: 12, fornecedor: "Contadora Aline Souza" },
  ],
  "darf": [
    { nome: "DARF Funrural", share: 0.62, lanc: 18, fornecedor: "Guia recolhimento" },
    { nome: "DARF IRRF", share: 0.28, lanc: 12, fornecedor: "Guia recolhimento" },
    { nome: "DARF diversos", share: 0.10, lanc: 8, fornecedor: "Guia recolhimento" },
  ],
};

export const fornecedores: Fornecedor[] = [
  { nome: "Cargil Agrícola S.A.", cnpj: "60.498.706/0001-57", categoriaUsual: "Ração", lancamentos: 18 },
  { nome: "Rações Varoto Ltda", cnpj: "67.847.432/0001-46", categoriaUsual: "Ração", lancamentos: 12 },
  { nome: "Nutrivet Comércio de Rações", cnpj: "08.456.123/0001-29", categoriaUsual: "Medicamento animal", lancamentos: 24 },
  { nome: "Siloking do Brasil Comércio", cnpj: "10.123.456/0001-89", categoriaUsual: "Curral (equipamento)", lancamentos: 6 },
  { nome: "Energisa Minas Rio", cnpj: "06.840.748/0001-89", categoriaUsual: "Energia / Curral", lancamentos: 46 },
  { nome: "Liptolandia Madeiras Ltda", cnpj: "11.222.333/0001-66", categoriaUsual: "Curral (madeira/cerca)", lancamentos: 14 },
  { nome: "NTG Data Serviços Administrativos", cnpj: "22.333.444/0001-55", categoriaUsual: "BPO Financeiro", lancamentos: 23 },
  { nome: "MAGC (arrendamento)", cnpj: "33.444.555/0001-44", categoriaUsual: "Arrendamento (invest.)", lancamentos: 23 },
  { nome: "Imunodot Indústria e Comércio", cnpj: "44.555.666/0001-33", categoriaUsual: "Curral (imunógenos)", lancamentos: 8 },
  { nome: "Agropecuária Lafeni Ltda", cnpj: "55.666.777/0001-22", categoriaUsual: "Curral (rações + insumos)", lancamentos: 36 },
  { nome: "Dianagro Comércio e Representações", cnpj: "66.777.888/0001-11", categoriaUsual: "Curral (insumos)", lancamentos: 18 },
  { nome: "Cooperativa Boa Vista", cnpj: "77.888.999/0001-90", categoriaUsual: "Ração", lancamentos: 22 },
  { nome: "Folha de Pagamento (16 colab.)", cnpj: "—", categoriaUsual: "Pessoal — Salário", lancamentos: 348 },
  { nome: "Contadora Aline Souza", cnpj: "88.999.000/0001-77", categoriaUsual: "Contabilidade", lancamentos: 23 },
  { nome: "Posto Avenida", cnpj: "99.000.111/0001-66", categoriaUsual: "Combustível", lancamentos: 84 },
  { nome: "Tratores Sul (peças)", cnpj: "12.345.678/0001-90", categoriaUsual: "Manutenção máquinas", lancamentos: 18 },
];

/**
 * Constrói o mapa de subcategorias keyed pelo id NUMÉRICO de cada categoria
 * devolvida pelo backend, casando por nome normalizado. Categorias sem
 * subcategoria conhecida (ex.: linhas de investimento) simplesmente não entram.
 */
export function buildSubcategorias(
  categorias: Array<{ id: number | string; nome: string }>,
): Record<string | number, Subcategoria[]> {
  const out: Record<string | number, Subcategoria[]> = {};
  for (const c of categorias) {
    const subs = SUBCATS[normCat(c.nome)];
    if (subs) out[c.id] = subs;
  }
  return out;
}

/** Volume/custo do leite, estimado do preço médio CEPEA (R$ 3,20/L em 2025). */
export function buildVolumeLeite(k2025: { receitaLeite: number; custeioLeitePuro: number }, k2026YTD: { receitaLeite: number }) {
  return {
    litros2025: Math.round(k2025.receitaLeite / 3.2),
    litros2026YTD: Math.round(k2026YTD.receitaLeite / 3.5),
    precoMedio2025: 3.2,
    precoMedio2026: 3.5,
    custoPorLitro2025: k2025.custeioLeitePuro / (k2025.receitaLeite / 3.2),
  };
}
