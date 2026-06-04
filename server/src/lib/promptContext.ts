// Contexto do plano de contas/centros/fornecedores que vai dentro do system prompt
// da Claude Vision. Carrega do banco e mantém em memória por 5 minutos — assim
// chamadas Vision consecutivas pegam cache HIT no prompt caching da Anthropic
// (cache_control: ephemeral, TTL ~5min).
//
// Os blocos são strings prontas pra entrar em system: [{ type: "text", text, cache_control }].

import { prisma } from "../db.js";

const TTL_MS = 5 * 60 * 1000;

type Snapshot = {
  planoContas: string;
  centrosCusto: string;
  fornecedoresRecentes: string;
  expiraEm: number;
};

let cache: Snapshot | null = null;

async function snapshot(): Promise<Snapshot> {
  const [grupos, centros, fornecedores] = await Promise.all([
    prisma.grupoCategoria.findMany({
      orderBy: { ordem: "asc" },
      include: { categorias: { orderBy: { nome: "asc" } } },
    }),
    prisma.centroCusto.findMany({ orderBy: { ordem: "asc" } }),
    // Fornecedores ordenados por nº de lançamentos (proxy de uso) — top 50.
    prisma.clienteFornecedor.findMany({
      take: 50,
      orderBy: { lancamentos: { _count: "desc" } },
    }),
  ]);

  const planoLinhas: string[] = [];
  for (const g of grupos) {
    for (const c of g.categorias) {
      planoLinhas.push(`- ${g.nome} > ${c.nome}`);
    }
  }
  const planoContas = planoLinhas.length
    ? `Plano de contas gerencial em uso (cada linha é "Grupo > Categoria"):\n${planoLinhas.join("\n")}`
    : "Plano de contas ainda não cadastrado.";

  const centrosCusto = centros.length
    ? `Centros de custo disponíveis (escolha exatamente um nome desta lista):\n${centros
        .map((c) => `- ${c.nome}${c.ehInvestimento ? " (investimento)" : ""}`)
        .join("\n")}`
    : "Centros de custo ainda não cadastrados.";

  const fornecedoresRecentes = fornecedores.length
    ? `Fornecedores já cadastrados (use ortografia idêntica se reconhecer):\n${fornecedores
        .map((f) => `- ${f.nome}${f.documento ? ` (${f.documento})` : ""}`)
        .join("\n")}`
    : "Nenhum fornecedor cadastrado ainda.";

  return {
    planoContas,
    centrosCusto,
    fornecedoresRecentes,
    expiraEm: Date.now() + TTL_MS,
  };
}

export async function getPromptContext(): Promise<Snapshot> {
  if (cache && cache.expiraEm > Date.now()) return cache;
  cache = await snapshot();
  return cache;
}

// Para uso em testes ou invalidação manual após cadastrar nova categoria.
export function invalidarPromptContext(): void {
  cache = null;
}
