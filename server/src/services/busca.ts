import { prisma } from "../db.js";

/**
 * Busca global de entidades reais para a paleta de comandos (⌘K).
 * Um único resultado normalizado que o cliente sabe navegar (tab + entidadeId).
 * Evoluindo o ⌘K para entidades — "pode ser".
 */
export type ResultadoBusca = {
  tipo: "talhao" | "categoria" | "fornecedor";
  entidadeId: string;
  label: string;
  sublabel: string;
  tab: string;
  grupo: string;
};

/** q válido = pelo menos 2 caracteres (após trim). Curto-circuita a busca. */
export const qValido = (q: string): boolean => q.trim().length >= 2;

// ── Mappers puros (linha do Prisma → ResultadoBusca) — unit-testáveis ──

export function mapearTalhao(row: {
  id: number;
  codigo: string;
  nome: string | null;
  variedade?: { nome: string } | null;
  lavoura?: { nome: string } | null;
}): ResultadoBusca {
  return {
    tipo: "talhao",
    entidadeId: String(row.id),
    label: row.codigo + (row.nome ? " · " + row.nome : ""),
    sublabel: row.variedade?.nome ?? row.lavoura?.nome ?? "Talhão",
    tab: "pla-talhao",
    grupo: "Talhões",
  };
}

export function mapearCategoria(row: {
  id: number;
  nome: string;
}): ResultadoBusca {
  return {
    tipo: "categoria",
    entidadeId: String(row.id),
    label: row.nome,
    sublabel: "Categoria financeira",
    tab: "plano",
    grupo: "Categorias",
  };
}

export function mapearFornecedor(row: {
  id: number;
  nome: string;
  tipo: string;
}): ResultadoBusca {
  return {
    tipo: "fornecedor",
    entidadeId: String(row.id),
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

  const [talhoes, categorias, fornecedores] = await Promise.all([
    prisma.talhao.findMany({
      where: {
        OR: [
          { codigo: { contains: termo, mode: "insensitive" } },
          { nome: { contains: termo, mode: "insensitive" } },
        ],
      },
      include: { variedade: { select: { nome: true } }, lavoura: { select: { nome: true } } },
      // ATIVO (não BAIXADO) primeiro, depois por código
      orderBy: [{ estado: "asc" }, { codigo: "asc" }],
      take: TAKE,
    }),
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
    ...talhoes.map(mapearTalhao),
    ...categorias.map(mapearCategoria),
    ...fornecedores.map(mapearFornecedor),
  ];
}
