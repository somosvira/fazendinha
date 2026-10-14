import { Prisma, type TipoProtocolo } from "@prisma/client";
import { auditar, RebanhoError } from "../rebanho/regras.js";
type Tx = Prisma.TransactionClient;
const entidade = (tipo: TipoProtocolo) => tipo === "SANITARIO" ? "ProtocoloSanitario" : "ProtocoloIatf";
export async function carregarVersaoTx(tx: Tx, id: string, tipo: TipoProtocolo, editavel = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-protocolo:${id}`}))`;
  const p = await tx.protocolo.findFirst({ where: { id, tipo }, include: { etapas: { orderBy: { ordem: "asc" } }, _count: { select: { execucoes: true, rodadas: true } } } });
  if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Versão de protocolo não encontrada neste cadastro");
  if (editavel && (p.publicado || p.publicadoEm || p._count.execucoes || p._count.rodadas)) throw new RebanhoError("CONFLITO", "Versão publicada ou utilizada é imutável; crie nova versão");
  return p;
}
export async function reservarVersaoTx(tx: Tx, tipo: TipoProtocolo, nome: string, solicitada?: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-protocolo-versao:${tipo}:${nome}`}))`;
  const ultima = await tx.protocolo.findFirst({ where: { tipo, nome }, orderBy: { versao: "desc" } });
  const versao = solicitada ?? (ultima?.versao ?? 0) + 1;
  if (await tx.protocolo.findUnique({ where: { tipo_nome_versao: { tipo, nome, versao } }, select: { id: true } })) throw new RebanhoError("CONFLITO", "Já existe uma versão deste protocolo com esse número", "versao");
  return versao;
}
export async function publicarVersaoTx(tx: Tx, id: string, tipo: TipoProtocolo, usuarioId: number | null, validar: (p: Awaited<ReturnType<typeof carregarVersaoTx>>) => Promise<void>) {
  const antes = await carregarVersaoTx(tx, id, tipo, true);
  if (!antes.ativo) throw new RebanhoError("CONFLITO", "Uma versão inativa não pode ser publicada");
  await validar(antes);
  const depois = await tx.protocolo.update({ where: { id, tipo }, data: { publicado: true, publicadoEm: new Date() } });
  await auditar(tx, { entidade: entidade(tipo), entidadeId: id, acao: "PUBLICACAO", usuarioId, antes, depois });
  return depois;
}
export async function inativarVersaoTx(tx: Tx, id: string, tipo: TipoProtocolo, usuarioId: number | null) {
  const antes = await carregarVersaoTx(tx, id, tipo);
  const depois = await tx.protocolo.update({ where: { id, tipo }, data: { ativo: false } });
  await auditar(tx, { entidade: entidade(tipo), entidadeId: id, acao: "INATIVACAO", usuarioId, antes, depois });
  return depois;
}
