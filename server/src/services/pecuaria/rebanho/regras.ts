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
  propriedadeId?: number | null;
  requisicaoId?: string | null;
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
    ...(input.propriedadeId != null ? { propriedadeId: input.propriedadeId } : {}),
    ...(input.requisicaoId != null ? { requisicaoId: input.requisicaoId } : {}),
    antes: input.antes == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.antes)),
    depois: input.depois == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(input.depois)),
  };
}

export async function auditar(db: DbPecuaria, input: EntradaAuditoria) {
  await db.auditoriaPecuaria.create({ data: dadosAuditoria(input) });
}

// ---------- travas (concorrência) ----------
//
// ORDEM GLOBAL DAS TRAVAS — toda transação da pecuária pega, nesta ordem e nunca ao contrário:
//   1. animais  (`travarAnimais`: advisory lock `pec-animal:<id>`), todos numa chamada só;
//   2. lote     (`travarLoteAtivo`: FOR SHARE na linha do lote; `editarLote` pega FOR UPDATE);
//   3. brincos  (`travarBrincos`: advisory lock `pec-brinco:<sítio>:<brinco>`), todos numa chamada só.
// Dentro de cada chamada as chaves são travadas em ordem fixa (pelo hash, que é a trava de fato).
// Com a mesma ordem em todo lugar, duas transações nunca esperam uma pela outra em círculo.
// Advisory locks `_xact_` valem até o fim da transação: não há o que liberar.

/** Trava um conjunto de chaves de advisory lock numa query só, em ordem fixa (evita deadlock). */
async function travarChaves(db: DbPecuaria, chaves: string[]) {
  const unicas = [...new Set(chaves)];
  if (!unicas.length) return;
  await db.$executeRaw`
    SELECT pg_advisory_xact_lock(h)
    FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${unicas}::text[]) AS k) AS chaves
    ORDER BY h`;
}

/**
 * Serializa as escritas no histórico de cada animal (localização, destino, baixa, categoria
 * manual, pesagem, datas) até o fim da transação. Pegar ANTES de ler o estado aberto: quem lê
 * depois da trava vê o que a transação anterior gravou.
 */
export async function travarAnimais(db: DbPecuaria, animalIds: string[]) {
  await travarChaves(db, animalIds.map((id) => `pec-animal:${id}`));
}

/**
 * Serializa a checagem-então-escrita do brinco por (sítio, brinco) até o fim da transação.
 * Sem constraint no banco (a unicidade depende da localização aberta), duas escritas
 * concorrentes passariam pela checagem ao mesmo tempo.
 */
export async function travarBrincos(db: DbPecuaria, chaves: Array<{ propriedadeId: number; brincoNormalizado: string }>) {
  await travarChaves(db, chaves.map((c) => `pec-brinco:${c.propriedadeId}:${c.brincoNormalizado}`));
}

export async function travarBrinco(db: DbPecuaria, propriedadeId: number, brincoNormalizado: string) {
  await travarBrincos(db, [{ propriedadeId, brincoNormalizado }]);
}

/**
 * Confere, dentro da transação, que o lote existe, é do sítio e está ativo, e trava a linha
 * (FOR SHARE) até o fim: `editarLote` precisa de FOR UPDATE para desativá-lo, então espera
 * esta transação terminar — e passa a enxergar o animal que acabou de entrar.
 */
export async function travarLoteAtivo(db: DbPecuaria, loteId: string, propriedadeId: number) {
  const linhas = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "pecuaria"."Lote"
    WHERE "id" = ${loteId} AND "propriedadeId" = ${propriedadeId} AND "ativo"
    FOR SHARE`;
  if (!linhas.length) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado nesse sítio ou inativo", "loteId");
}

// ---------- "hoje" no fuso da fazenda (R3/R6) ----------
//
// `new Date()` sozinho conta em UTC: entre 21h e meia-noite (horário de Brasília, UTC-3) já é o
// dia seguinte em UTC, então idade/categoria mudariam 3h cedo demais e `removerCategoriaManual`
// gravaria o fim no dia errado. `hojeFazenda()` lê o relógio no fuso America/Sao_Paulo — único
// fuso da fazenda hoje, sem depender de nenhuma lib nova.

/** "Hoje" da fazenda (America/Sao_Paulo) como 'YYYY-MM-DD'. */
export function hojeFazenda(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** `hojeFazenda()` como Date (meia-noite UTC) — pronta para comparar com colunas `@db.Date`. */
export function hojeFazendaDate(): Date {
  return new Date(hojeFazenda());
}

export const MENSAGEM_ALTERADO_AO_SALVAR = "O animal foi alterado enquanto você salvava. Recarregue e tente de novo.";

/**
 * Confere quantas linhas um updateMany/deleteMany condicional (ex.: `ate: null`) afetou.
 * Menos que o esperado = outra transação mexeu no registro entre a leitura e a escrita.
 */
export function exigirAfetadas(resultado: { count: number }, esperado: number, mensagem = MENSAGEM_ALTERADO_AO_SALVAR) {
  if (resultado.count !== esperado) throw new RebanhoError("CONFLITO", mensagem);
}
