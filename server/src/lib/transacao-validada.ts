import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

function registro(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null ? valor as Record<string, unknown> : null;
}
const sqlEstadoTransitorio = (codigo: unknown) => codigo === "40001" || codigo === "40P01";
/** Somente serialização/deadlock: nunca repete erro de constraint, conexão ou SQL genérico. */
export function conflitoTransacaoValidada(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2034") return true;
    if (erro.code !== "P2010") return false;
    const meta = registro(erro.meta);
    // executeRaw pode encapsular o SQLSTATE em meta.code ou no erro do adapter pg.
    const causa = registro(registro(meta?.driverAdapterError)?.cause);
    return sqlEstadoTransitorio(meta?.code) || sqlEstadoTransitorio(causa?.originalCode);
  }
  if (!(erro instanceof Error) || erro.name !== "DriverAdapterError") return false;
  const causa = registro(erro.cause);
  return causa?.kind === "TransactionWriteConflict" || sqlEstadoTransitorio(causa?.originalCode);
}

type OpcoesTransacao = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };
/** Valida somente depois de concluir todos os fatos, inversos, parcelas e auditorias.
 * Uma violação diferida falha ainda no callback, permitindo ROLLBACK/release pelo
 * adapter. Não evita outras causas de falha de COMMIT nem relaxa constraints. */
export async function concluirTransacaoValidadaTx<T>(tx: Prisma.TransactionClient, executar: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const resultado = await executar(tx);
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  return resultado;
}
export async function transacaoValidada<T>(executar: (tx: Prisma.TransactionClient) => Promise<T>, opcoes?: OpcoesTransacao): Promise<T> {
  return prisma.$transaction(tx => concluirTransacaoValidadaTx(tx, executar), opcoes);
}
