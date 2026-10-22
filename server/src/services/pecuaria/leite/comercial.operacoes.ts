import { prepararVinculosQualidadeFechamentoTx } from "./qualidade.fechamentos.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { transacaoEstoque } from "../../estoque/transacao.js";
import {
  travarValorizacaoTx,
  previaRetroatividadeTx,
} from "../../estoque/valorizacao.js";
import {
  METODO_LEITE,
  planejarBaixaLeiteTx,
  registrarBaixaLeiteTx,
} from "../../estoque/leite.js";
import {
  exigirParceiroAtivo,
  exigirPeriodoAberto,
} from "../../financeiro/regras.js";
import { criarFechamentoPeriodoLeiteTx } from "../../financeiro/operacoes.js";
import { operacaoSchema } from "../../financeiro/schemas.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { calcularFechamentoLeite } from "./comercial.operacoes.calc.js";
import {
  previaFechamentoOperacaoLeiteSchema,
  abrirOperacaoLeiteSchema,
  retirarOperacaoLeiteSchema,
  fecharOperacaoLeiteSchema,
  type AbrirOperacaoLeite,
  type RetirarOperacaoLeite,
  type FecharOperacaoLeite,
} from "./comercial.operacoes.schemas.js";
import { consultaComercialLeiteSchema } from "./comercial.schemas.js";
import type { z } from "zod";
export type ContextoOperacaoLeite = {
  propriedadeId: number;
  usuarioId: number | null;
};
type Db = Prisma.TransactionClient;
const dia = (v: string) => new Date(`${v}T00:00:00Z`);
const dataDTO = (v: Date) => v.toISOString().slice(0, 10);
const autor = (v: number | null) => (v && v > 0 ? v : null);
const conflito = (m: string): never => {
  throw new RebanhoError("CONFLITO", m);
};
const incluir = {
  parceiro: { select: { nome: true } },
  retiradas: {
    include: { movimento: true, comprovantes: true },
    orderBy: [{ movimento: { data: "asc" } }, { id: "asc" }],
  },
  fechamentos: {
    orderBy: { versao: "desc" },
    include: {
      detalhes: true,
      amostras: true,
      operacao: {
        include: {
          transacoes: true,
          compromissos: {
            include: { liquidacoes: { include: { transacao: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.OperacaoComercialLeiteInclude;
export async function obterOperacaoLeiteTx(
  tx: Db,
  id: string,
  ctx: ContextoOperacaoLeite,
) {
  const o = await tx.operacaoComercialLeite.findFirst({
    where: { id, propriedadeId: ctx.propriedadeId },
    include: incluir,
  });
  if (!o)
    throw new RebanhoError(
      "NAO_ENCONTRADO",
      "Operação de leite não encontrada neste sítio",
    );
  return o;
}
/** A trava do agregado serializa retirada/fechamento; produtos sempre antecedem a trava financeira. */
async function travarOperacaoTx(
  tx: Db,
  id: string,
  ctx: ContextoOperacaoLeite,
  produtos: string[] = [],
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leite-comercial:${id}`}))`;
  const antes = await obterOperacaoLeiteTx(tx, id, ctx);
  await travarValorizacaoTx(tx, [
    ...produtos,
    ...antes.retiradas.map((r) => r.movimento.produtoId),
  ]);
  await tx.$queryRaw`SELECT id FROM pecuaria."OperacaoComercialLeite" WHERE id=${id} AND "propriedadeId"=${ctx.propriedadeId} FOR NO KEY UPDATE`;
  return obterOperacaoLeiteTx(tx, id, ctx);
}
export async function abrirOperacaoLeiteTx(
  tx: Db,
  raw: AbrirOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) {
  const input = abrirOperacaoLeiteSchema.parse(raw);
  return operacaoIdempotenteTx(
    tx,
    { ...input, propriedadeId: ctx.propriedadeId },
    ctx.usuarioId,
    "LEITE_COMERCIAL_ABRIR",
    async () => {
      await exigirParceiroAtivo(tx, input.parceiroId, "VENDA");
      await exigirPeriodoAberto(tx, ctx.propriedadeId, dia(input.inicio));
      await exigirPeriodoAberto(tx, ctx.propriedadeId, dia(input.fim));
      const identidade = `${ctx.propriedadeId}:${input.parceiroId}:${input.inicio}:${input.fim}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leite-comercial-periodo:${identidade}`}))`;
      if (
        await tx.operacaoComercialLeite.findUnique({
          where: {
            propriedadeId_parceiroId_inicio_fim: {
              propriedadeId: ctx.propriedadeId,
              parceiroId: input.parceiroId,
              inicio: dia(input.inicio),
              fim: dia(input.fim),
            },
          },
        })
      )
        conflito(
          "Já existe operação de leite para este sítio, comprador e período; use a identidade existente",
        );
      const o = await tx.operacaoComercialLeite.create({
        data: {
          propriedadeId: ctx.propriedadeId,
          parceiroId: input.parceiroId,
          inicio: dia(input.inicio),
          fim: dia(input.fim),
          referencia: input.referencia,
          criadoPorId: autor(ctx.usuarioId),
        },
      });
      await auditar(tx, {
        entidade: "OperacaoComercialLeite",
        entidadeId: o.id,
        propriedadeId: ctx.propriedadeId,
        usuarioId: ctx.usuarioId,
        acao: "ABERTA",
        depois: o,
      });
      return { id: o.id, versao: o.versao };
    },
  );
}
export const abrirOperacaoLeite = (
  input: AbrirOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) => transacaoEstoque((tx) => abrirOperacaoLeiteTx(tx, input, ctx));
export async function retirarOperacaoLeiteTx(
  tx: Db,
  id: string,
  raw: RetirarOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) {
  const input = retirarOperacaoLeiteSchema.parse(raw);
  return operacaoIdempotenteTx(
    tx,
    { ...input, comercialId: id, propriedadeId: ctx.propriedadeId },
    ctx.usuarioId,
    "LEITE_COMERCIAL_RETIRAR",
    async () => {
      const o = await travarOperacaoTx(tx, id, ctx, [input.produtoId]);
      if (o.status !== "ABERTA" || o.versao !== input.versaoEsperada)
        conflito(
          "A operação mudou ou já foi fechada; atualize antes de registrar a retirada",
        );
      const data = dia(input.data);
      if (data < o.inicio || data > o.fim || data > hojeFazendaDate())
        conflito(
          "Retirada deve ter data real dentro do período, sem data futura",
        );
      const produto = await tx.produto.findFirst({
        where: { id: input.produtoId, ativo: true },
      });
      if (!produto || produto.unidade !== "L" || produto.rastrearPartidas)
        conflito("Selecione um produto de leite ativo em litros sem partida");
      await exigirPeriodoAberto(tx, ctx.propriedadeId, data);
      const previa = await previaRetroatividadeTx(
        tx,
        input.produtoId,
        ctx.propriedadeId,
        data,
      );
      if (!previa.permitido) conflito(previa.motivo!);
      const plano = await planejarBaixaLeiteTx(tx, {
        produtoId: input.produtoId,
        propriedadeId: ctx.propriedadeId,
        data,
        quantidade: input.quantidadeLitros,
        finalidade: "VENDA",
      });
      const movimento = await tx.movimentoEstoque.create({
        data: {
          produtoId: input.produtoId,
          propriedadeId: ctx.propriedadeId,
          data,
          tipo: "SAIDA",
          origem: "RETIRADA_LEITE",
          quantidade: plano.quantidade,
          metodoValorizacao: METODO_LEITE,
          valorTotal: plano.valorTotal,
          custoUnitario:
            plano.valorTotal?.div(plano.quantidade).toDecimalPlaces(4) ?? null,
          observacao: input.referencia,
          criadoPorId: autor(ctx.usuarioId),
        },
      });
      await registrarBaixaLeiteTx(tx, movimento.id, plano);
      const retirada = await tx.retiradaOperacaoLeite.create({
        data: {
          comercialId: id,
          movimentoId: movimento.id,
          referencia: input.referencia,
          pontoColeta: input.pontoColeta,
          horarioColeta: input.horarioColeta,
          criadoPorId: autor(ctx.usuarioId),
        },
      });
      const atual = await tx.operacaoComercialLeite.update({
        where: { id },
        data: { versao: { increment: 1 } },
      });
      await auditar(tx, {
        entidade: "OperacaoComercialLeite",
        entidadeId: id,
        propriedadeId: ctx.propriedadeId,
        usuarioId: ctx.usuarioId,
        acao: "RETIRADA",
        depois: {
          retiradaId: retirada.id,
          movimentoId: movimento.id,
          quantidade: plano.quantidade.toString(),
        },
      });
      return {
        id,
        retiradaId: retirada.id,
        movimentoId: movimento.id,
        versao: atual.versao,
      };
    },
  );
}
export const retirarOperacaoLeite = (
  id: string,
  input: RetirarOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) => transacaoEstoque((tx) => retirarOperacaoLeiteTx(tx, id, input, ctx));
export async function fecharOperacaoLeiteTx(
  tx: Db,
  id: string,
  raw: FecharOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) {
  const input = fecharOperacaoLeiteSchema.parse(raw);
  return operacaoIdempotenteTx(
    tx,
    { ...input, comercialId: id, propriedadeId: ctx.propriedadeId },
    ctx.usuarioId,
    "LEITE_COMERCIAL_FECHAR",
    async () => {
      const o = await travarOperacaoTx(tx, id, ctx);
      if (o.versao !== input.versaoEsperada)
        conflito(
          "A operação mudou; confira todas as retiradas antes de fechar",
        );
      const data = dia(input.data);
      if (data > hojeFazendaDate() || data < o.fim)
        conflito(
          "Fechamento exige data real após o término do período, sem data futura",
        );
      await exigirPeriodoAberto(tx, ctx.propriedadeId, o.inicio);
      await exigirPeriodoAberto(tx, ctx.propriedadeId, o.fim);
      await exigirPeriodoAberto(tx, ctx.propriedadeId, data);
      await exigirPeriodoAberto(tx, ctx.propriedadeId, new Date());
      for (const r of o.retiradas) {
        if (r.movimento.status !== "CONFIRMADO" || r.movimento.reversaoDeId)
          conflito("Há retirada sem lastro físico ativo");
        await exigirPeriodoAberto(tx, ctx.propriedadeId, r.movimento.data);
      }
      let calculo: ReturnType<typeof calcularFechamentoLeite>;
      try {
        calculo = calcularFechamentoLeite(
          o.retiradas.map((r) => ({
            id: r.id,
            quantidade: r.movimento.quantidade,
          })),
          input.retiradas,
          input.precoUnitario,
          input.ajuste,
        );
      } catch (e) {
        return conflito((e as Error).message);
      }
      if (!input.centroCustoId)
        conflito("Selecione o centro de custo para a receita do leite");
      const anterior = o.fechamentos[0];
      if (anterior) {
        await tx.$queryRaw`SELECT id FROM public."Operacao" WHERE id=${anterior.operacaoId} AND "propriedadeId"=${ctx.propriedadeId} FOR NO KEY UPDATE`;
        const original = await tx.operacao.findUniqueOrThrow({
          where: { id: anterior.operacaoId },
          include: {
            transacoes: true,
            compromissos: {
              include: { liquidacoes: { include: { transacao: true } } },
            },
          },
        });
        if (original.status !== "CONFIRMADA")
          conflito(
            "O fechamento financeiro vigente mudou; regularize antes de corrigir",
          );
        if (
          original.transacoes.some(
            (t) => t.status === "CONFIRMADA" && t.tipo !== "REVERSAO",
          ) ||
          original.compromissos.some((c) =>
            c.liquidacoes.some((l) => l.transacao.status === "CONFIRMADA"),
          )
        )
          conflito(
            "Há recebimento ativo. Estorne o recebimento no Financeiro antes de corrigir o fechamento",
          );
        if (data.getTime() !== original.data.getTime())
          conflito(
            "Correção deve preservar a data financeira do fechamento original",
          );
        await exigirPeriodoAberto(tx, ctx.propriedadeId, original.data);
        await tx.compromissoFinanceiro.updateMany({
          where: { operacaoId: original.id, status: { not: "CANCELADO" } },
          data: { status: "CANCELADO" },
        });
        await tx.operacao.update({
          where: { id: original.id },
          data: { status: "CANCELADA" },
        });
      } else if (o.status !== "ABERTA")
        conflito("Operação já fechada sem versão financeira comprovada");
      const dados = {
        ...operacaoSchema.parse({
          chave: input.chave,
          tipo: "VENDA",
          data: input.data,
          descricao: `Leite · ${o.referencia}`,
          parceiroId: o.parceiroId,
          centroCustoId: input.centroCustoId,
          ...(anterior ? { corrigeOperacaoId: anterior.operacaoId } : {}),
          financeiro: input.financeiro,
          itens: [
            {
              descricao: `Leite de ${dataDTO(o.inicio)} a ${dataDTO(o.fim)}`,
              quantidade: Number(calculo.volume),
              unidade: "L",
              valorTotal: Number(calculo.total),
              categoriaId: input.categoriaId,
              estocavel: false,
            },
          ],
        }),
        propriedadeId: ctx.propriedadeId,
        usuarioId: ctx.usuarioId,
      };
      const amostras = await prepararVinculosQualidadeFechamentoTx(tx, input.amostras, { propriedadeId: ctx.propriedadeId, inicio: o.inicio, fim: o.fim }, ctx.usuarioId);
      const financeira = await criarFechamentoPeriodoLeiteTx(tx, dados, id);
      const fechamento = await tx.fechamentoOperacaoLeite.create({
        data: {
          comercialId: id,
          operacaoId: financeira.id,
          versao: (anterior?.versao ?? 0) + 1,
          precoUnitario: input.precoUnitario,
          volumeReconhecido: calculo.volume,
          ajuste: input.ajuste,
          motivoAjuste: input.motivoAjuste,
          motivo: input.motivo,
          criadoPorId: autor(ctx.usuarioId),
          detalhes: { create: input.retiradas.map((r) => ({ ...r })) },
          ...(amostras.length ? { amostras: { create: amostras } } : {}),
        },
      });
      const atual = await tx.operacaoComercialLeite.update({
        where: { id },
        data: { status: "FECHADA", versao: { increment: 1 } },
      });
      await auditar(tx, {
        entidade: "OperacaoComercialLeite",
        entidadeId: id,
        propriedadeId: ctx.propriedadeId,
        usuarioId: ctx.usuarioId,
        acao: anterior ? "FECHAMENTO_CORRIGIDO" : "FECHADA",
        antes: anterior,
        depois: {
          fechamentoId: fechamento.id,
          operacaoId: financeira.id,
          volumeReconhecido: calculo.volume.toString(),
          valorTotal: calculo.total.toFixed(2),
        },
      });
      return {
        id,
        fechamentoId: fechamento.id,
        operacaoId: financeira.id,
        versao: atual.versao,
      };
    },
  );
}
export const fecharOperacaoLeite = (
  id: string,
  input: FecharOperacaoLeite,
  ctx: ContextoOperacaoLeite,
) => transacaoEstoque((tx) => fecharOperacaoLeiteTx(tx, id, input, ctx));
export function operacaoLeiteDTO(
  o: Prisma.OperacaoComercialLeiteGetPayload<{ include: typeof incluir }>,
  verValores: boolean,
) {
  const fechamentoDTO = (f: (typeof o.fechamentos)[number]) => ({
    id: f.id,
    versao: f.versao,
    operacaoId: f.operacaoId,
    numeroOperacao: f.operacao.numero,
    data: dataDTO(f.operacao.data),
    status: f.operacao.status,
    volumeReconhecido: f.volumeReconhecido.toString(),
    precoUnitario: verValores ? f.precoUnitario.toFixed(4) : null,
    ajuste: verValores ? f.ajuste.toFixed(2) : null,
    motivoAjuste: verValores ? f.motivoAjuste : null,
    valorTotal: verValores ? f.operacao.valorTotal.toFixed(2) : null,
    motivo: verValores ? f.motivo : null,
    amostras: (f.amostras ?? []).map(a => ({ amostraId: a.amostraId, versaoAmostra: a.versaoAmostra, snapshot: a.snapshot })),
    detalhes: f.detalhes.map((d) => ({
      retiradaId: d.retiradaId,
      quantidadeReconhecida: d.quantidadeReconhecida.toString(),
      motivoDiferenca: verValores ? d.motivoDiferenca : null,
    })),
  });
  return {
    id: o.id,
    propriedadeId: o.propriedadeId,
    parceiroId: o.parceiroId,
    parceiroNome: o.parceiro.nome,
    inicio: dataDTO(o.inicio),
    fim: dataDTO(o.fim),
    referencia: o.referencia,
    versao: o.versao,
    status: o.status,
    retiradoLitros: o.retiradas
      .reduce((s, r) => s.plus(r.movimento.quantidade), new Prisma.Decimal(0))
      .toString(),
    fechamento: o.fechamentos[0] ? fechamentoDTO(o.fechamentos[0]) : null,
    historicoFechamentos: o.fechamentos.map(fechamentoDTO),
    retiradas: o.retiradas.map((r) => ({
      id: r.id,
      movimentoId: r.movimentoId,
      produtoId: r.movimento.produtoId,
      data: dataDTO(r.movimento.data),
      quantidadeLitros: r.movimento.quantidade.toString(),
      referencia: r.referencia,
      pontoColeta: r.pontoColeta,
      horarioColeta: r.horarioColeta,
      comprovantes: r.comprovantes.map((c) => ({
        id: c.id,
        nome: c.nome,
        mimeType: c.mimeType,
        tamanhoBytes: c.tamanhoBytes,
        criadoEm: c.criadoEm.toISOString(),
      })),
    })),
  };
}
export async function consultarOperacoesLeite(
  raw: z.infer<typeof consultaComercialLeiteSchema>,
  ctx: ContextoOperacaoLeite,
  verValores: boolean,
) {
  const f = consultaComercialLeiteSchema.parse(raw),
    where: Prisma.OperacaoComercialLeiteWhereInput = {
      propriedadeId: ctx.propriedadeId,
      ...(f.parceiroId ? { parceiroId: f.parceiroId } : {}),
      ...(f.de ? { fim: { gte: dia(f.de) } } : {}),
      ...(f.ate ? { inicio: { lte: dia(f.ate) } } : {}),
    };
  return prisma.$transaction(
    async (tx) => {
      const [total, linhas] = await Promise.all([
        tx.operacaoComercialLeite.count({ where }),
        tx.operacaoComercialLeite.findMany({
          where,
          include: incluir,
          orderBy: [{ inicio: "desc" }, { id: "desc" }],
          skip: (f.pagina - 1) * f.porPagina,
          take: f.porPagina,
        }),
      ]);
      return {
        propriedadeId: ctx.propriedadeId,
        total,
        pagina: f.pagina,
        porPagina: f.porPagina,
        itens: linhas.map((o) => operacaoLeiteDTO(o, verValores)),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export const consultarOperacaoLeite = (
  id: string,
  ctx: ContextoOperacaoLeite,
  verValores: boolean,
) =>
  prisma.$transaction(
    async (tx) =>
      operacaoLeiteDTO(await obterOperacaoLeiteTx(tx, id, ctx), verValores),
    { isolationLevel: "RepeatableRead" },
  );
/** Catálogo operacional mínimo: não expõe custos, contas ou condições financeiras. */
export async function consultarCadastrosOperacaoLeite() {
  const [parceiros, produtos] = await Promise.all([
    prisma.parceiro.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.produto.findMany({
      where: { ativo: true, unidade: "L", rastrearPartidas: false },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  return { parceiros, produtos };
}

/** Prévia usa o mesmo cálculo Decimal do fechamento; não cria financeiro ou estoque. */
export async function previaFechamentoOperacaoLeite(
  id: string,
  raw: z.infer<typeof previaFechamentoOperacaoLeiteSchema>,
  ctx: ContextoOperacaoLeite,
) {
  const input = previaFechamentoOperacaoLeiteSchema.parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const o = await obterOperacaoLeiteTx(tx, id, ctx);
      if (o.versao !== input.versaoEsperada)
        conflito("A operação mudou; atualize antes de conferir o preço");
      try {
        const r = calcularFechamentoLeite(
          o.retiradas.map((x) => ({
            id: x.id,
            quantidade: x.movimento.quantidade,
          })),
          input.retiradas,
          input.precoUnitario,
          input.ajuste,
        );
        return {
          volumeReconhecido: r.volume.toString(),
          valorTotal: r.total.toFixed(2),
        };
      } catch (e) {
        return conflito((e as Error).message);
      }
    },
    { isolationLevel: "RepeatableRead" },
  );
}
