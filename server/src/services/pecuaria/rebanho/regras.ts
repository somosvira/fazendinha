import { Prisma, type PrismaClient } from "@prisma/client";

export type DbPecuaria = Prisma.TransactionClient | PrismaClient;

export class RebanhoError extends Error {
  constructor(
    public code: "NAO_ENCONTRADO" | "VALIDACAO" | "BRINCO_DUPLICADO" | "ANIMAL_INATIVO" | "JA_ESTORNADA" | "CONFLITO",
    message: string,
    /** campo do formulário ao qual a mensagem se refere (para a UI exibir junto ao input) */
    public campo?: string,
  ) {
    super(message);
  }
}

/** Traduz violação de unicidade do Prisma (P2002) em RebanhoError apontando o campo. Relança o resto. */
// Campos (ou nome do índice) violados num P2002. O formato varia: `meta.target` vem como
// lista de campos no engine clássico e como nome do índice (string) ou dentro de
// `meta.driverAdapterError` quando o Prisma roda com driver adapter (pg/neon).
export function alvosConflitoUnico(meta: Record<string, unknown> | undefined): string[] {
  const alvos: string[] = [];
  const adicionar = (v: unknown) => {
    if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && alvos.push(x));
    else if (typeof v === "string") alvos.push(v);
  };
  adicionar(meta?.target);
  const causa = (meta?.driverAdapterError as { cause?: { constraint?: { fields?: unknown; index?: unknown } } } | undefined)?.cause;
  adicionar(causa?.constraint?.fields);
  adicionar(causa?.constraint?.index);
  return alvos;
}

export function traduzirConflitoUnico(erro: unknown, mensagens: Record<string, string>): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    const alvos = alvosConflitoUnico(erro.meta);
    for (const [campo, mensagem] of Object.entries(mensagens)) {
      // Campo listado diretamente, ou citado no nome do índice (`Lote_propriedadeId_nome_key`).
      if (alvos.some((a) => a === campo || a.split(/[_,\s"]+/).includes(campo))) {
        throw new RebanhoError("CONFLITO", mensagem, campo);
      }
    }
    // P2002 sem campo mapeado ainda é conflito de unicidade, não erro interno.
    throw new RebanhoError("CONFLITO", "Já existe um registro com esses dados");
  }
  throw erro;
}

export interface EntradaAuditoria {
  entidade: string;
  entidadeId: string | number;
  acao: string;
  /** Animal ao qual o registro pertence; obrigatório para tudo que é do animal (ver buscarAuditoriaAnimal). */
  animalId?: string | null;
  usuarioId?: number | null;
  antes?: unknown;
  depois?: unknown;
}

export function dadosAuditoria(input: EntradaAuditoria) {
  return {
    entidade: input.entidade,
    entidadeId: String(input.entidadeId),
    animalId: input.animalId ?? null,
    acao: input.acao,
    usuarioId: input.usuarioId && input.usuarioId > 0 ? input.usuarioId : null,
    antes: input.antes == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.antes)),
    depois: input.depois == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.depois)),
  };
}

export async function auditar(db: DbPecuaria, input: EntradaAuditoria) {
  await db.auditoriaPecuaria.create({ data: dadosAuditoria(input) });
}

/**
 * Serializa a checagem-então-escrita do brinco por (sítio, brinco) até o fim da transação.
 * Sem constraint no banco (a unicidade depende da localização aberta), duas escritas
 * concorrentes passariam pela checagem ao mesmo tempo.
 */
export async function travarBrinco(db: DbPecuaria, propriedadeId: number, brincoNormalizado: string) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-brinco:${propriedadeId}:${brincoNormalizado}`}))`;
}
