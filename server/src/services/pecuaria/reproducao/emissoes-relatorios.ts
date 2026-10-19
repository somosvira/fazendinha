import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import { consultarIndicadoresReprodutivosTx } from "./indicadores.js";
import { filtrosIndicadoresSchema } from "./indicadores.schemas.js";
import { emitirRelatorioPartosTx, periodoRelatorioPartosSchema } from "./relatorio-partos.js";

const identidade = { chave: z.string().uuid(), propriedadeId: z.number().int().positive() };
export const tipoRelatorioReprodutivoSchema = z.enum(["PARTOS", "INDICADORES"]);
export const criarEmissaoReprodutivaSchema = z.discriminatedUnion("tipo", [
  z.object({ ...identidade, tipo: z.literal("PARTOS"), filtros: periodoRelatorioPartosSchema }).strict(),
  z.object({ ...identidade, tipo: z.literal("INDICADORES"), filtros: filtrosIndicadoresSchema }).strict(),
]);
export const listarEmissoesReprodutivasSchema = z.object({
  propriedadeId: z.coerce.number().int().positive(), tipo: tipoRelatorioReprodutivoSchema,
}).strict();
export type CriarEmissaoReprodutivaInput = z.infer<typeof criarEmissaoReprodutivaSchema>;
export type TipoRelatorioReprodutivo = z.infer<typeof tipoRelatorioReprodutivoSchema>;
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));

/** Emissão e envelope de reenvio são atômicos; nenhuma leitura é refeita na reimpressão. */
export async function criarEmissaoReprodutivaTx(tx: Prisma.TransactionClient, input: CriarEmissaoReprodutivaInput, usuarioId: number | null) {
  const dados = criarEmissaoReprodutivaSchema.parse(input);
  return operacaoIdempotenteTx(tx, dados, usuarioId, `EMISSAO_RELATORIO:${dados.tipo}`, async () => {
    const snapshot = dados.tipo === "PARTOS"
      ? await emitirRelatorioPartosTx(tx, { ...dados.filtros, propriedadeId: dados.propriedadeId })
      : await consultarIndicadoresReprodutivosTx(tx, { ...dados.filtros, propriedadeId: dados.propriedadeId });
    const criada = await tx.snapshotRelatorioReprodutivo.create({ data: {
      propriedadeId: dados.propriedadeId, tipo: dados.tipo, filtros: json(dados.filtros), snapshot: json(snapshot), versao: snapshot.versao, criadoPorId: usuarioId,
    } });
    await auditar(tx, { entidade: "SnapshotRelatorioReprodutivo", entidadeId: criada.id, propriedadeId: dados.propriedadeId,
      acao: "EMISSAO", usuarioId, depois: { tipo: criada.tipo, versao: criada.versao, filtros: criada.filtros } });
    // A serialização padroniza a primeira resposta com os reenvios armazenados em JSON.
    return { ...criada, criadoEm: criada.criadoEm.toISOString() };
  });
}
export async function criarEmissaoReprodutiva(input: CriarEmissaoReprodutivaInput, usuarioId: number | null) {
  return transacaoPecuaria(tx => criarEmissaoReprodutivaTx(tx, input, usuarioId));
}
export async function listarEmissoesReprodutivas(tipo: TipoRelatorioReprodutivo, propriedadeId: number) {
  const filtros = listarEmissoesReprodutivasSchema.parse({ tipo, propriedadeId });
  return prisma.snapshotRelatorioReprodutivo.findMany({ where: filtros, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { id: true, tipo: true, versao: true, filtros: true, criadoEm: true, criadoPorId: true } });
}
export async function obterEmissaoReprodutiva(id: string, propriedadeId: number) {
  z.string().uuid().parse(id); z.number().int().positive().parse(propriedadeId);
  const emissao = await prisma.snapshotRelatorioReprodutivo.findFirst({ where: { id, propriedadeId } });
  if (!emissao) throw new RebanhoError("NAO_ENCONTRADO", "Emissão não encontrada neste sítio");
  return emissao;
}
