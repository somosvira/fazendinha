import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { conferirSitioLeiteTx, travarRotinaLeiteTx } from "./configuracoes.js";
import { consultarEstoqueLeite } from "./estoque.js";
import { avaliarMetaRetirada, preverRetiradas } from "./programacao.calc.js";
import {
  programacaoRetiradaSchema,
  type ProgramacaoRetiradaInput,
} from "./programacao.schemas.js";
type Programacao = Prisma.ProgramacaoRetiradaLeiteGetPayload<
  Record<string, never>
>;
function dto(p: Programacao) {
  return {
    ...p,
    vigenteDesde: p.vigenteDesde.toISOString().slice(0, 10),
    criadoEm: p.criadoEm.toISOString(),
    metaLitros: p.metaLitros?.toString() ?? null,
  };
}
export async function consultarProgramacaoRetirada(
  propriedadeId: number,
  data: string,
  usuarioId: number | null,
) {
  await conferirSitioLeiteTx(prisma, propriedadeId);
  const historico = (
    await prisma.programacaoRetiradaLeite.findMany({
      where: { propriedadeId },
      orderBy: { versao: "desc" },
    })
  ).map(dto);
  const vigente = historico.find((p) => p.vigenteDesde <= data) ?? null;
  let meta: ReturnType<typeof avaliarMetaRetirada> | null = null;
  if (vigente?.tipo === "META_LITROS" && vigente.metaLitros) {
    const atual = data === hojeFazendaDate().toISOString().slice(0, 10);
    let saldo: Parameters<typeof avaliarMetaRetirada>[1] = null;
    if (atual && vigente.produtoId) {
      try {
        saldo = (await consultarEstoqueLeite(
          vigente.produtoId,
          { propriedadeId, usuarioId },
          false,
        )).comercial;
      } catch (erro) {
        if (
          !(erro instanceof RebanhoError) ||
          !["VALIDACAO", "NAO_ENCONTRADO"].includes(erro.code)
        )
          throw erro;
        saldo = {
          confiavel: false,
          quantidadeLitros: null,
          motivoNaoAferivel: erro.message,
        };
      }
    }
    meta = avaliarMetaRetirada(vigente.metaLitros, saldo, atual);
  }
  return {
    propriedadeId,
    dataReferencia: data,
    versaoAtual: historico[0]?.versao ?? 0,
    vigente,
    historico,
    previsoes: preverRetiradas(historico, data),
    meta,
  };
}
export async function criarProgramacaoRetirada(
  dados: ProgramacaoRetiradaInput,
  usuarioId: number | null,
) {
  const input = programacaoRetiradaSchema.parse(dados);
  return transacaoPecuaria(async (tx) => {
    await travarRotinaLeiteTx(tx, input.propriedadeId);
    await conferirSitioLeiteTx(tx, input.propriedadeId, true);
    return operacaoIdempotenteTx(
      tx,
      input,
      usuarioId,
      "PROGRAMACAO_RETIRADA_LEITE",
      async () => {
        const ultima = await tx.programacaoRetiradaLeite.findFirst({
          where: { propriedadeId: input.propriedadeId },
          orderBy: { versao: "desc" },
        });
        if ((ultima?.versao ?? 0) !== input.versaoEsperada)
          throw new RebanhoError(
            "CONFLITO",
            "A programação mudou; atualize antes de salvar",
            "versaoEsperada",
          );
        const vigenteDesde = new Date(`${input.vigenteDesde}T00:00:00Z`);
        if (
          vigenteDesde < hojeFazendaDate() ||
          (ultima && vigenteDesde <= ultima.vigenteDesde)
        )
          throw new RebanhoError(
            "VALIDACAO",
            "Escolha uma vigência a partir de hoje e posterior à última programação",
            "vigenteDesde",
          );
        if (input.tipo === "META_LITROS") {
          const produto = await tx.produto.findFirst({
            where: {
              id: input.produtoId,
              ativo: true,
              unidade: "L",
              rastrearPartidas: false,
            },
            select: { id: true },
          });
          if (!produto)
            throw new RebanhoError(
              "VALIDACAO",
              "Selecione um produto ativo em litros, sem rastreio por partida",
              "produtoId",
            );
        }
        const p = await tx.programacaoRetiradaLeite.create({
          data: {
            propriedadeId: input.propriedadeId,
            vigenteDesde,
            tipo: input.tipo,
            versao: input.versaoEsperada + 1,
            criadoPorId: usuarioId,
            diaSemana: input.tipo === "SEMANAL" ? input.diaSemana : null,
            diasSemana:
              input.tipo === "DIAS_ESCOLHIDOS"
                ? [...input.diasSemana].sort()
                : [],
            produtoId: input.tipo === "META_LITROS" ? input.produtoId : null,
            metaLitros:
              input.tipo === "META_LITROS"
                ? new Prisma.Decimal(input.metaLitros)
                : null,
          },
        });
        const resultado = dto(p);
        await auditar(tx, {
          entidade: "ProgramacaoRetiradaLeite",
          entidadeId: p.id,
          propriedadeId: input.propriedadeId,
          acao: "NOVA_VIGENCIA",
          usuarioId,
          depois: resultado,
        });
        return resultado;
      },
    );
  });
}
