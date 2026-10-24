import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, type DbPecuaria } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { ORDENHAS_INICIAIS } from "./producao.calc.js";
import { configuracaoOrdenhaSchema, type ConfiguracaoOrdenhaInput } from "./schemas.js";
import type { ConfiguracaoOrdenhaDTO } from "./contratos.js";

const incluirOrdenhas = { ordenhas: { orderBy: { ordem: "asc" as const } } };
type Configuracao = Prisma.ConfiguracaoOrdenhaGetPayload<{ include: typeof incluirOrdenhas }>;
export function configuracaoDTO(configuracao: Configuracao | null, propriedadeId: number): ConfiguracaoOrdenhaDTO {
  return configuracao ? { id: configuracao.id, propriedadeId, vigenteDesde: configuracao.vigenteDesde.toISOString().slice(0, 10),
    fonteProducao: configuracao.fonteProducao === "GERAL" ? "GERAL" : "INDIVIDUAL",
    intervaloIndividualQuantidade: configuracao.intervaloIndividualQuantidade ?? 1,
    intervaloIndividualUnidade: configuracao.intervaloIndividualUnidade === "DIAS" ? "DIAS" : "MESES",
    inicial: configuracao.inicial, ordenhas: configuracao.ordenhas.map(({ posicaoId, nome, ordem, horario }) => ({ posicaoId, nome, ordem, horario })) }
    : { id: null, propriedadeId, vigenteDesde: "1900-01-01", inicial: true, fonteProducao: "GERAL", intervaloIndividualQuantidade: 1, intervaloIndividualUnidade: "MESES", ordenhas: ORDENHAS_INICIAIS.map(o => ({ ...o })) };
}
export async function travarRotinaLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-leite-sitio:${propriedadeId}`}))`;
}
export async function conferirSitioLeiteTx(tx: DbPecuaria, propriedadeId: number, escrita = false) {
  const sitio = await tx.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true, ativo: true } });
  if (!sitio || (escrita && !sitio.ativo)) throw new RebanhoError("NAO_ENCONTRADO", "Sítio não encontrado ou indisponível");
}
export function buscarConfiguracaoLeiteTx(tx: DbPecuaria, propriedadeId: number, data: Date) {
  return tx.configuracaoOrdenha.findFirst({ where: { propriedadeId, vigenteDesde: { lte: data } }, orderBy: { vigenteDesde: "desc" }, include: incluirOrdenhas });
}
/** Chamador segura a trava do sítio; só a primeira folha materializa o padrão virtual. */
export async function garantirConfiguracaoLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, data: Date, usuarioId: number | null) {
  const vigente = await buscarConfiguracaoLeiteTx(tx, propriedadeId, data);
  if (vigente) {
    // As posições podem ter sido editadas enquanto a configuração ainda não
    // tinha folhas. Trava o mesmo pai dos guards SQL e relê o snapshot depois.
    await tx.$queryRaw`SELECT id FROM pecuaria."ConfiguracaoOrdenha" WHERE id=${vigente.id} FOR UPDATE`;
    return tx.configuracaoOrdenha.findUniqueOrThrow({ where: { id: vigente.id }, include: incluirOrdenhas });
  }
  return tx.configuracaoOrdenha.create({ data: { propriedadeId, vigenteDesde: new Date("1900-01-01T00:00:00Z"), inicial: true,
    criadoPorId: usuarioId, fonteProducao: "GERAL", ordenhas: { create: ORDENHAS_INICIAIS.map(o => ({ ...o, horario: o.horario ?? null })) } }, include: incluirOrdenhas });
}
export async function listarConfiguracoes(propriedadeId: number, data: string) {
  await conferirSitioLeiteTx(prisma, propriedadeId);
  const historico = await prisma.configuracaoOrdenha.findMany({ where: { propriedadeId }, orderBy: { vigenteDesde: "desc" }, include: incluirOrdenhas });
  const vigente = historico.find(c => c.vigenteDesde <= new Date(`${data}T00:00:00Z`)) ?? null;
  return { vigente: configuracaoDTO(vigente, propriedadeId), historico: historico.map(c => configuracaoDTO(c, propriedadeId)) };
}
export async function criarConfiguracao(input: ConfiguracaoOrdenhaInput, usuarioId: number | null) {
  input = configuracaoOrdenhaSchema.parse(input);
  return transacaoPecuaria(async tx => {
    await travarRotinaLeiteTx(tx, input.propriedadeId);
    await conferirSitioLeiteTx(tx, input.propriedadeId, true);
    return operacaoIdempotenteTx(tx, input, usuarioId, "CONFIGURACAO_ORDENHA", async () => {
      const vigenteDesde = new Date(`${input.vigenteDesde}T00:00:00Z`);
      const ultima = await tx.configuracaoOrdenha.findFirst({ where: { propriedadeId: input.propriedadeId }, orderBy: { vigenteDesde: "desc" } });
      if (ultima && vigenteDesde <= ultima.vigenteDesde)
        throw new RebanhoError("CONFLITO", "A nova vigência deve ser posterior à última configuração; versões anteriores são preservadas");
      if (await tx.diaProducaoLeite.count({ where: { propriedadeId: input.propriedadeId, dataOperacional: { gte: vigenteDesde } } }))
        throw new RebanhoError("CONFLITO", "A vigência alcança folhas já guardadas; escolha uma data posterior");
      const configuracao = await tx.configuracaoOrdenha.create({ data: { propriedadeId: input.propriedadeId, vigenteDesde, criadoPorId: usuarioId,
        fonteProducao: input.fonteProducao, intervaloIndividualQuantidade: input.intervaloIndividualQuantidade, intervaloIndividualUnidade: input.intervaloIndividualUnidade,
        ordenhas: { create: input.ordenhas.map(o => ({ ...o, horario: o.horario ?? null })) } }, include: incluirOrdenhas });
      const dto = configuracaoDTO(configuracao, input.propriedadeId);
      await auditar(tx, { entidade: "ConfiguracaoOrdenha", entidadeId: configuracao.id, propriedadeId: input.propriedadeId,
        acao: "NOVA_VIGENCIA", usuarioId, depois: dto });
      return dto;
    });
  });
}
