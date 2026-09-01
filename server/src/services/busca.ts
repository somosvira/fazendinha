import { prisma } from "../db.js";
import { rotuloAnimal } from "./rebanho/identificacao.js";

/**
 * Busca global de entidades reais para a paleta de comandos (⌘K).
 * Um único resultado normalizado que o cliente sabe navegar (tab + entidadeId).
 * Evoluindo o ⌘K para entidades — "pode ser".
 */
export type ResultadoBusca = {
  tipo: "talhao" | "animal" | "lote" | "categoria" | "fornecedor";
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

export function mapearAnimal(row: {
  id: number;
  numero: string;
  nome: string | null;
  categoria: string;
  raca?: { nome: string } | null;
  brincoEletronico?: string | null;
}): ResultadoBusca {
  return {
    tipo: "animal",
    entidadeId: String(row.id),
    label: rotuloAnimal(row.numero, row.nome),
    // Mostra o brinco eletrônico no sublabel quando houver — confirma pro
    // usuário que o número lido pelo bastão casou com este animal.
    sublabel:
      row.categoria +
      (row.raca?.nome ? " · " + row.raca.nome : "") +
      (row.brincoEletronico ? " · brinco " + row.brincoEletronico : ""),
    tab: "reb-animal",
    grupo: "Animais",
  };
}

export function mapearLote(row: {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  numCabecas: number;
}): ResultadoBusca {
  return {
    tipo: "lote",
    entidadeId: String(row.id),
    label: row.codigo + " · " + row.nome,
    sublabel: row.categoria + " · " + row.numCabecas + " cab",
    tab: "cor-lote",
    grupo: "Lotes coletivos",
  };
}

export function mapearCategoria(row: {
  id: number;
  nome: string;
  grupoCategoria: { nome: string };
}): ResultadoBusca {
  return {
    tipo: "categoria",
    entidadeId: String(row.id),
    label: row.nome,
    sublabel: row.grupoCategoria.nome,
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
 * Consulta os 5 modelos em paralelo, cada um com `contains` case-insensitive,
 * concatenando na ordem: talhões, animais, lotes, categorias, fornecedores.
 */
export async function buscarEntidades(q: string): Promise<ResultadoBusca[]> {
  if (!qValido(q)) return [];
  const termo = q.trim();

  const [talhoes, animais, lotes, categorias, fornecedores] = await Promise.all([
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
    prisma.animal.findMany({
      where: {
        OR: [
          { numero: { contains: termo, mode: "insensitive" } },
          { nome: { contains: termo, mode: "insensitive" } },
          // Brinco eletrônico (RFID): o bastão de leitura atua como teclado e
          // digita o número da etiqueta no campo de busca — casar aqui é a
          // Fase 1 do A6 (sem hardware dedicado).
          { brincoEletronico: { contains: termo, mode: "insensitive" } },
        ],
      },
      include: { raca: { select: { nome: true } } },
      // ATIVO antes de BAIXADO
      orderBy: [{ status: "asc" }, { numero: "asc" }],
      take: TAKE,
    }),
    prisma.loteCorte.findMany({
      where: {
        OR: [
          { codigo: { contains: termo, mode: "insensitive" } },
          { nome: { contains: termo, mode: "insensitive" } },
        ],
      },
      orderBy: { codigo: "asc" },
      take: TAKE,
    }),
    prisma.categoria.findMany({
      where: { nome: { contains: termo, mode: "insensitive" } },
      include: { grupoCategoria: { select: { nome: true } } },
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
    ...animais.map(mapearAnimal),
    ...lotes.map(mapearLote),
    ...categorias.map(mapearCategoria),
    ...fornecedores.map(mapearFornecedor),
  ];
}
