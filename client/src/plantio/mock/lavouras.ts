import type { Lavoura, PlanoAdubacao } from "../types";

/* Lavouras = agrupadores de talhões (espelho de "lote" no rebanho). */
export const lavouras: Lavoura[] = [
  { id: 1, nome: "Cafundó",       variedade: "Catuaí Vermelho IAC 144", numTalhoes: 4, areaHa: 16.2, produtividadeMedia: 31, planoAdubacaoNome: "Padrão Catuaí 35 sc/ha" },
  { id: 2, nome: "Tijuco",         variedade: "Topázio MG-1190",         numTalhoes: 3, areaHa: 16.2, produtividadeMedia: 48, planoAdubacaoNome: "Adensado alta produção" },
  { id: 3, nome: "Mata da Capela", variedade: "Bourbon Amarelo",         numTalhoes: 2, areaHa: 6.3,  produtividadeMedia: 27, planoAdubacaoNome: "Bourbon micro-lote" },
  { id: 4, nome: "Pasto Velho",    variedade: "Arara",                   numTalhoes: 2, areaHa: 7.8,  produtividadeMedia: 41, planoAdubacaoNome: "Arara resistente" },
  { id: 5, nome: "Novo Sul",       variedade: "Catuaí Amarelo IAC 144",  numTalhoes: 1, areaHa: 4.5,  produtividadeMedia: undefined, planoAdubacaoNome: "Formação 1º ano" },
  { id: 6, nome: "Mata Seca",      variedade: "Acauã Novo",              numTalhoes: 2, areaHa: 11.5, produtividadeMedia: 33, planoAdubacaoNome: "Padrão Catuaí 35 sc/ha" },
];

/* Planos de adubação — receitas espelhando "Dieta" do rebanho. NPK em kg/ha
 * por safra. Valores típicos de recomendação Embrapa/Procafé para café arábica
 * em produção (cobertura, dividido em 3-4 parcelas). */
export const planosAdubacao: PlanoAdubacao[] = [
  {
    id: 1, nome: "Padrão Catuaí 35 sc/ha", ativo: true,
    descricao: "Plano de cobertura para talhões com expectativa 30-40 sc/ha. 4 parcelas (out/nov/jan/mar).",
    nKgHa: 320, p2o5KgHa: 60, k2oKgHa: 240, parcelas: 4,
  },
  {
    id: 2, nome: "Adensado alta produção", ativo: true,
    descricao: "Plano agressivo para Topázio adensado 5.700+ pl/ha. Inclui adubação foliar com Zn e B no pegamento e granação.",
    nKgHa: 420, p2o5KgHa: 80, k2oKgHa: 300, parcelas: 5,
  },
  {
    id: 3, nome: "Bourbon micro-lote", ativo: true,
    descricao: "Plano moderado focado em qualidade. Menos N para evitar crescimento vegetativo excessivo. Foliar de Ca/Mg na granação.",
    nKgHa: 240, p2o5KgHa: 60, k2oKgHa: 220, parcelas: 4,
  },
  {
    id: 4, nome: "Arara resistente", ativo: true,
    descricao: "Variedade resistente a ferrugem — sem necessidade de fungicida sistêmico. Plano de NPK padrão.",
    nKgHa: 340, p2o5KgHa: 60, k2oKgHa: 250, parcelas: 4,
  },
  {
    id: 5, nome: "Formação 1º ano", ativo: true,
    descricao: "Adubação de formação para talhão recém-plantado. Foco em P (sistema radicular) e micronutrientes.",
    nKgHa: 120, p2o5KgHa: 140, k2oKgHa: 100, parcelas: 6,
  },
];
