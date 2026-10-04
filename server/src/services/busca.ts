import { prisma } from "../db.js";

/**
 * Busca global de entidades reais para a paleta de comandos (⌘K).
 * Um único resultado normalizado que o cliente sabe navegar (tab + entidadeId).
 * Evoluindo o ⌘K para entidades — "pode ser".
 */
export type ResultadoBusca = {
  tipo: "categoria" | "fornecedor";
  entidadeId: string;
  label: string;
  sublabel: string;
  tab: string;
  grupo: string;
};

/** q válido = pelo menos 2 caracteres (após trim). Curto-circuita a busca. */
export const qValido = (q: string): boolean => q.trim().length >= 2;

// ── Mappers puros (linha do Prisma → ResultadoBusca) — unit-testáveis ──

export function mapearCategoria(row: {
  id: string;
  nome: string;
}): ResultadoBusca {
  return {
    tipo: "categoria",
    entidadeId: row.id,
    label: row.nome,
    sublabel: "Categoria financeira",
    tab: "plano",
    grupo: "Categorias",
  };
}

export function mapearFornecedor(row: {
  id: string;
  nome: string;
  tipo: string;
}): ResultadoBusca {
  return {
    tipo: "fornecedor",
    entidadeId: row.id,
    label: row.nome,
    sublabel: row.tipo,
    tab: "cadastros",
    grupo: "Fornecedores",
  };
}

const TAKE = 6;

/**
 * Busca entidades reais no banco. Retorna [] se q tiver < 2 caracteres.
 * Consulta os 3 modelos em paralelo, cada um com `contains` case-insensitive,
 * concatenando na ordem: talhões, categorias, fornecedores.
 */
export async function buscarEntidades(q: string): Promise<ResultadoBusca[]> {
  if (!qValido(q)) return [];
  const termo = q.trim();

  const [categorias, fornecedores] = await Promise.all([
    prisma.categoria.findMany({
      where: { nome: { contains: termo, mode: "insensitive" } },
      orderBy: { nome: "asc" },
      take: TAKE,
    }),
    prisma.parceiro.findMany({
      where: { nome: { contains: termo, mode: "insensitive" }, ativo: true },
      orderBy: { nome: "asc" },
      take: TAKE,
    }),
  ]);

  return [
    ...categorias.map(mapearCategoria),
    ...fornecedores.map(mapearFornecedor),
  ];
}
