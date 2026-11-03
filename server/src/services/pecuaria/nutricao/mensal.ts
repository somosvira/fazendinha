import { createHash } from "node:crypto";
import { Prisma, type ConfiguracaoNutricao } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { ingredienteLeiteProducaoTx } from "../leite/nutricao.js";
import { calcularAnimalDias } from "./animalDias.calc.js";
import {
  comoData,
  textoData,
  proximoMes,
  somarDias,
  prazoMes,
  repartirQuantidade,
  distribuirPartidas,
  type ConfiguracaoInput,
} from "./mensal.calc.js";
import { ajustarItemTx } from "./mensal.estoque.js";
import type { SelecaoPartida } from "../../estoque/partidas.js";

type Tx = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const hoje = () => textoData(hojeFazendaDate());
const erro = (m: string): never => {
  throw new RebanhoError("CONFLITO", m);
};
export const incluirMes = {
  configuracao: true,
  lote: { select: { nome: true } },
  dias: {
    orderBy: { data: "asc" as const },
    include: {
      participantes: {
        include: {
          animal: { select: { brinco: true } },
          classificacaoCusto: true,
        },
        orderBy: { animalId: "asc" as const },
      },
      itens: {
        include: {
          movimentos: true,
          produto: { select: { rastrearPartidas: true } },
        },
        orderBy: { produtoId: "asc" as const },
      },
    },
  },
} satisfies Prisma.MesNutricaoInclude;
export type MesCompleto = Prisma.MesNutricaoGetPayload<{
  include: typeof incluirMes;
}>;
async function trava(tx: Tx, loteId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${loteId}`}))`;
}
async function loteTx(tx: Tx, loteId: string, propriedadeId: number) {
  const lote = await tx.lote.findFirst({
    where: { id: loteId, propriedadeId },
  });
  if (!lote)
    throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado neste sítio");
  return lote;
}
export function configuracaoEfetiva(
  configs: ConfiguracaoNutricao[],
  loteId: string,
  data: Date,
) {
  const vigentes = configs
    .filter((c) => c.desde <= data)
    .sort((a, b) => +b.desde - +a.desde);
  return (
    vigentes.find((c) => c.loteId === loteId) ??
    vigentes.find((c) => c.loteId === null) ??
    null
  );
}
async function configsTx(tx: Tx, propriedadeId: number) {
  return tx.configuracaoNutricao.findMany({
    where: { propriedadeId },
    orderBy: { desde: "asc" },
  });
}
export async function listarConfiguracoes(propriedadeId: number | null) {
  return prisma.configuracaoNutricao.findMany({
    where: propriedadeId === null ? {} : { propriedadeId },
    orderBy: [{ desde: "desc" }, { escopo: "asc" }],
  });
}
export async function salvarConfiguracao(
  input: ConfiguracaoInput,
  usuarioId: number,
) {
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`nutricao-config:${input.propriedadeId}`}))`;
    if (input.loteId) await loteTx(tx, input.loteId, input.propriedadeId);
    const configs = await configsTx(tx, input.propriedadeId);
    const anteriores = input.loteId
      ? configs.filter((c) => c.loteId === null || c.loteId === input.loteId)
      : configs.filter((c) => c.loteId === null);
    const minimo = anteriores.length
      ? proximoMes(hoje())
      : somarDias(hoje(), 1);
    if (
      input.desde < minimo ||
      (anteriores.length && input.desde.slice(8) !== "01")
    )
      erro(
        "A primeira ativação começa amanhã ou depois; alterações começam no primeiro dia de um próximo mês",
      );
    const escopo = input.loteId
      ? `lote:${input.loteId}`
      : `sitio:${input.propriedadeId}`;
    if (
      configs.some(
        (c) => c.escopo === escopo && textoData(c.desde) >= input.desde,
      )
    )
      erro("Já existe uma configuração para esta data ou uma data posterior");
    const conflito = await tx.fechamentoConsumo.findFirst({
      where: {
        propriedadeId: input.propriedadeId,
        ...(input.loteId ? { loteId: input.loteId } : {}),
        status: "CONFIRMADO",
        fim: { gte: comoData(input.desde) },
      },
    });
    if (conflito)
      erro(
        "A ativação sobrepõe um fechamento existente; escolha uma data posterior",
      );
    const salvo = await tx.configuracaoNutricao.create({
      data: { ...input, escopo, desde: comoData(input.desde), usuarioId },
    });
    await auditar(tx, {
      entidade: "ConfiguracaoNutricao",
      entidadeId: salvo.id,
      propriedadeId: input.propriedadeId,
      usuarioId,
      acao: "CONFIGURACAO",
      depois: salvo,
    });
    return salvo;
  });
}
async function baseDiaTx(
  tx: Tx,
  loteId: string,
  propriedadeId: number,
  data: Date,
) {
  const lote = await loteTx(tx, loteId, propriedadeId);
  const locais = await tx.localizacaoAnimal.findMany({
    where: {
      loteId,
      desde: { lte: data },
      OR: [{ ate: null }, { ate: { gt: data } }],
    },
    select: { animalId: true, desde: true, ate: true },
  });
  const { participacoes, animalDias } = calcularAnimalDias(locais, data, data);
  const vigencia = await tx.vigenciaDietaLote.findFirst({
    where: {
      loteId,
      desde: { lte: data },
      OR: [{ ate: null }, { ate: { gt: data } }],
    },
    include: { dieta: { include: { itens: { include: { produto: true } } } } },
  });
  const itens =
    vigencia?.dieta.itens
      .map((i) => ({
        produtoId: i.produtoId,
        nome: i.produto.nome,
        unidade: i.unidade,
        prevista: i.quantidadeCabecaDia.mul(animalDias).toFixed(3),
      }))
      .sort((a, b) => a.produtoId.localeCompare(b.produtoId)) ?? [];
  const leiteProprio = (await Promise.all((vigencia?.dieta.itens ?? [])
    .filter(i => i.unidade === "L")
    .map(i => ingredienteLeiteProducaoTx(tx, i.produtoId, propriedadeId)))).some(Boolean);
  const pendencia = leiteProprio
    ? "Dieta com leite de produção própria exige o fluxo de fornecimento de leite; não há baixa mensal automática deste ingrediente"
    : vigencia?.dieta.itens.some(
    (i) => i.unidade !== i.produto.unidade,
  )
    ? "A unidade do ingrediente mudou; publique uma receita compatível"
    : animalDias && !vigencia?.dieta.publicadaEm
      ? "Há animais no lote sem dieta publicada nesta data"
      : animalDias && !lote.centroCustoId
        ? "Informe o centro de custo do lote"
        : null;
  const base = {
    dietaId: vigencia?.dietaId ?? null,
    dietaNome: vigencia
      ? `${vigencia.dieta.nome} v${vigencia.dieta.versao}`
      : null,
    centroCustoId: lote.centroCustoId,
    participacoes,
    itens,
    pendencia,
  };
  return { ...base, baseHash: hash(base) };
}
async function sincronizarDiaTx(
  tx: Tx,
  loteId: string,
  propriedadeId: number,
  data: Date,
  aceitarHistorico = false,
) {
  await trava(tx, loteId);
  const configs = await configsTx(tx, propriedadeId),
    config = configuracaoEfetiva(configs, loteId, data);
  if (!config) return null;
  const competencia = comoData(textoData(data).slice(0, 7) + "-01");
  const configInicial =
    configuracaoEfetiva(configs, loteId, competencia) ?? config;
  const inicio =
    configInicial.desde > competencia ? configInicial.desde : competencia;
  const mes = await tx.mesNutricao.upsert({
    where: { loteId_competencia: { loteId, competencia } },
    create: {
      loteId,
      propriedadeId,
      competencia,
      inicio,
      configuracaoId: configInicial.id,
    },
    update: {},
  });
  if (mes.revisadoEm) return null;
  const base = await baseDiaTx(tx, loteId, propriedadeId, data);
  const atual = await tx.consumoDiario.findUnique({
    where: { mesId_data: { mesId: mes.id, data } },
    include: { itens: { include: { movimentos: true } }, participantes: true },
  });
  if (atual?.baseHash === base.baseHash) {
    await tx.consumoDiario.update({
      where: { id: atual.id },
      data: { pendencia: base.pendencia, atualizadoEm: new Date() },
    });
    if (atual.pendencia !== base.pendencia)
      await tx.mesNutricao.update({
        where: { id: mes.id },
        data: { revisao: { increment: 1 } },
      });
    return atual.id;
  }
  if (atual?.itens.some((i) => i.movimentos.length) && !aceitarHistorico) {
    await tx.consumoDiario.update({
      where: { id: atual.id },
      data: {
        pendencia:
          "Histórico de dieta ou ocupação mudou; revise o mês para reconciliar a atribuição",
      },
    });
    return atual.id;
  }
  if (atual)
    await auditar(tx, {
      entidade: "ConsumoDiario",
      entidadeId: atual.id,
      propriedadeId,
      acao: "BASE_ATUALIZADA",
      antes: atual,
      depois: base,
    });
  const registro = {
    dietaId: base.dietaId,
    dietaNome: base.dietaNome,
    centroCustoId: base.centroCustoId,
    baseHash: base.baseHash,
    pendencia: base.pendencia,
  };
  const dia = atual
    ? await tx.consumoDiario.update({ where: { id: atual.id }, data: registro })
    : await tx.consumoDiario.create({
        data: { mesId: mes.id, data, ...registro },
      });
  const removidas =
    atual?.participantes
      .filter((p) => !base.participacoes.some((b) => b.animalId === p.animalId))
      .map((p) => p.id) ?? [];
  if (removidas.length) {
    const classes = await tx.classificacaoCustoPecuaria.findMany({
      where: { participacaoDiariaId: { in: removidas } },
    });
    if (classes.length) {
      if (!aceitarHistorico)
        erro(
          "Atualize a base histórica com justificativa para reconciliar as atribuições classificadas",
        );
      await auditar(tx, {
        entidade: "ConsumoDiario",
        entidadeId: dia.id,
        propriedadeId,
        acao: "CLASSIFICACOES_RECONCILIADAS",
        antes: classes,
        depois: { participacoesRemovidas: removidas },
      });
      await tx.classificacaoCustoPecuaria.deleteMany({
        where: { id: { in: classes.map((c) => c.id) } },
      });
    }
  }
  await tx.participacaoConsumoDiario.deleteMany({
    where: { id: { in: removidas } },
  });
  await tx.participacaoConsumoDiario.createMany({
    data: base.participacoes.map((p) => ({
      diaId: dia.id,
      animalId: p.animalId,
    })),
    skipDuplicates: true,
  });
  for (const item of base.itens)
    await tx.itemConsumoDiario.upsert({
      where: { diaId_produtoId: { diaId: dia.id, produtoId: item.produtoId } },
      create: { diaId: dia.id, ...item },
      update: { prevista: item.prevista },
    });
  // Ingredientes antigos com efeitos físicos são mantidos para correção, nunca apagados.
  await tx.itemConsumoDiario.updateMany({
    where: {
      diaId: dia.id,
      produtoId: { notIn: base.itens.map((i) => i.produtoId) },
    },
    data: { prevista: 0 },
  });
  await tx.mesNutricao.update({
    where: { id: mes.id },
    data: { revisao: { increment: 1 } },
  });
  return dia.id;
}
export async function processarDia(
  loteId: string,
  propriedadeId: number,
  data: string,
  automatico = true,
) {
  if (data >= hoje()) erro("Só é possível processar dias encerrados");
  const id = await transacaoPecuaria((tx) =>
    sincronizarDiaTx(tx, loteId, propriedadeId, comoData(data)),
  );
  if (!id) return;
  if (automatico)
    try {
      await transacaoPecuaria(async (tx) => {
        await trava(tx, loteId);
        const dia = await tx.consumoDiario.findUniqueOrThrow({
          where: { id },
          include: {
            mes: { include: { configuracao: true } },
            itens: true,
            participantes: true,
          },
        });
        if (
          dia.mes.revisadoEm ||
          dia.situacao === "EFETIVADO" ||
          dia.pendencia ||
          dia.mes.configuracao.modelo !== "AUTOMATICO"
        )
          return;
        const baseAtual = await baseDiaTx(tx, loteId, propriedadeId, dia.data);
        if (baseAtual.baseHash !== dia.baseHash)
          erro(
            "A dieta ou ocupação mudou durante o processamento; reprocesse o dia",
          );
        for (const item of dia.itens)
          await ajustarItemTx(
            tx,
            item.id,
            item.prevista,
            null,
            `Baixa automática do consumo de ${data}`,
          );
        await tx.consumoDiario.update({
          where: { id },
          data: { situacao: "EFETIVADO", pendencia: null },
        });
        await tx.mesNutricao.update({
          where: { id: dia.mesId },
          data: { revisao: { increment: 1 } },
        });
        await auditar(tx, {
          entidade: "ConsumoDiario",
          entidadeId: id,
          propriedadeId,
          acao: "BAIXA_AUTOMATICA",
          depois: { data, configuracaoId: dia.mes.configuracaoId },
        });
      });
    } catch (e) {
      const dominio =
        e instanceof Error &&
        [
          "RebanhoError",
          "EstoqueError",
          "ValorizacaoError",
          "FinanceiroError",
        ].includes(e.constructor.name);
      const mensagem = dominio
        ? (e as Error).message
        : "Falha técnica no processamento; tente novamente";
      if (!dominio) console.error("[nutricao/processamento]", e);
      await transacaoPecuaria(async (tx) => {
        await trava(tx, loteId);
        const atual = await tx.consumoDiario.findUnique({
          where: { id },
          include: { mes: true },
        });
        if (!atual || atual.mes.revisadoEm || atual.situacao === "EFETIVADO")
          return;
        await tx.consumoDiario.update({
          where: { id },
          data: { situacao: "PENDENTE", pendencia: mensagem.slice(0, 500) },
        });
        await tx.mesNutricao.update({
          where: { id: atual.mesId },
          data: { revisao: { increment: 1 } },
        });
      });
    }
}
export async function processarPendentes(
  loteId?: string,
  propriedadeId?: number,
) {
  const configs = await prisma.configuracaoNutricao.findMany({
    where: {
      desde: { lt: hojeFazendaDate() },
      ...(propriedadeId ? { propriedadeId } : {}),
    },
    orderBy: { desde: "asc" },
  });
  const lotes = await prisma.lote.findMany({
    where: {
      ...(loteId ? { id: loteId } : {}),
      propriedadeId: { in: [...new Set(configs.map((c) => c.propriedadeId))] },
    },
    orderBy: { id: "asc" },
  });
  const trabalhos: Array<{
    loteId: string;
    propriedadeId: number;
    data: string;
    prioridade: string;
  }> = [];
  for (const lote of lotes) {
    const cs = configs.filter(
      (c) =>
        c.propriedadeId === lote.propriedadeId &&
        (c.loteId === null || c.loteId === lote.id),
    );
    if (!cs.length) continue;
    const ultimo = await prisma.consumoDiario.findFirst({
      where: { mes: { loteId: lote.id } },
      orderBy: { data: "desc" },
    });
    const desde = ultimo
      ? somarDias(textoData(ultimo.data), 1)
      : textoData(cs[0].desde);
    for (let d = desde, n = 0; d < hoje() && n < 31; d = somarDias(d, 1), n++)
      trabalhos.push({
        loteId: lote.id,
        propriedadeId: lote.propriedadeId,
        data: d,
        prioridade: d,
      });
    const falhas = await prisma.consumoDiario.findMany({
      where: {
        mes: { loteId: lote.id, revisadoEm: null },
        OR: [{ situacao: { not: "EFETIVADO" } }, { pendencia: { not: null } }],
      },
      orderBy: { atualizadoEm: "asc" },
      take: 3,
    });
    for (const f of falhas)
      trabalhos.push({
        loteId: lote.id,
        propriedadeId: lote.propriedadeId,
        data: textoData(f.data),
        prioridade: f.atualizadoEm.toISOString(),
      });
  }
  // Intercala lotes para um lote com falhas antigas não impedir os demais.
  trabalhos.sort(
    (a, b) =>
      a.prioridade.localeCompare(b.prioridade) ||
      a.loteId.localeCompare(b.loteId),
  );
  let executados = 0;
  for (const t of trabalhos.slice(0, 50)) {
    await processarDia(t.loteId, t.propriedadeId, t.data);
    executados++;
  }
  return { executados, restantes: Math.max(0, trabalhos.length - executados) };
}
export async function carregarMesTx(
  tx: Tx,
  id: string,
  propriedadeId: number | null,
) {
  const mes = await tx.mesNutricao.findFirst({
    where: { id, ...(propriedadeId === null ? {} : { propriedadeId }) },
    include: incluirMes,
  });
  if (!mes)
    throw new RebanhoError("NAO_ENCONTRADO", "Mês não encontrado neste sítio");
  return mes;
}
export function resumoMes(mes: MesCompleto, verValores: boolean) {
  const totais = new Map<
    string,
    {
      produtoId: string;
      nome: string;
      unidade: string;
      rastrearPartidas: boolean;
      prevista: Prisma.Decimal;
      confirmada: Prisma.Decimal;
      custo: Prisma.Decimal;
      provisoria: Prisma.Decimal;
    }
  >();
  for (const d of mes.dias)
    for (const i of d.itens) {
      const t = totais.get(i.produtoId) ?? {
        produtoId: i.produtoId,
        nome: i.nome,
        unidade: i.unidade,
        rastrearPartidas: i.produto.rastrearPartidas,
        prevista: D(0),
        confirmada: D(0),
        custo: D(0),
        provisoria: D(0),
      };
      t.prevista = t.prevista.plus(i.prevista);
      t.confirmada = t.confirmada.plus(i.confirmada);
      t.custo = t.custo.plus(i.custoLiquido);
      if (d.situacao !== "EFETIVADO")
        t.provisoria = t.provisoria.plus(i.prevista);
      totais.set(i.produtoId, t);
    }
  const prazo = prazoMes(
    textoData(mes.competencia).slice(0, 7),
    mes.configuracao.diaConferencia,
  );
  return {
    id: mes.id,
    loteId: mes.loteId,
    loteNome: mes.lote.nome,
    propriedadeId: mes.propriedadeId,
    competencia: textoData(mes.competencia).slice(0, 7),
    inicio: textoData(mes.inicio),
    modelo: mes.configuracao.modelo,
    revisao: mes.revisao,
    revisadoEm: mes.revisadoEm,
    prazo,
    verValores,
    situacao: mes.revisadoEm
      ? "REVISADO"
      : hoje() > prazo
        ? "ATRASADO"
        : hoje().slice(0, 7) > textoData(mes.competencia).slice(0, 7)
          ? "A_CONFERIR"
          : "EM_ANDAMENTO",
    itens: [...totais.values()].map((t) => ({
      ...t,
      prevista: t.prevista.toFixed(3),
      confirmada: t.confirmada.toFixed(3),
      provisoria: t.provisoria.toFixed(3),
      custo: verValores ? t.custo.toFixed(2) : null,
    })),
    dias: mes.dias.map((d) => ({
      id: d.id,
      data: textoData(d.data),
      situacao: d.situacao,
      pendencia: d.pendencia,
      dieta: d.dietaNome,
      animais: d.participantes.length,
      itens: d.itens.map((i) => ({
        id: i.id,
        produtoId: i.produtoId,
        nome: i.nome,
        unidade: i.unidade,
        rastrearPartidas: i.produto.rastrearPartidas,
        prevista: i.prevista.toFixed(3),
        confirmada: i.confirmada.toFixed(3),
        origemQuantidade: i.origemQuantidade,
      })),
    })),
  };
}
export async function consultarMeses(
  propriedadeId: number | null,
  loteId?: string,
  competencia?: string,
  pagina = 1,
  alertas = false,
) {
  const dataAtual = hoje(),
    inicioAtual = dataAtual.slice(0, 7) + "-01";
  const competenciaAnterior = comoData(
    somarDias(inicioAtual, -1).slice(0, 7) + "-01",
  );
  const ultimoDia = somarDias(dataAtual, 1).slice(8) === "01";
  const where: Prisma.MesNutricaoWhereInput = {
    ...(alertas
      ? {
          revisadoEm: null,
          OR: [
            { competencia: { lt: competenciaAnterior } },
            {
              competencia: competenciaAnterior,
              ...(ultimoDia
                ? {}
                : {
                    configuracao: {
                      diaConferencia: { lte: Number(dataAtual.slice(8)) },
                    },
                  }),
            },
            { dias: { some: { pendencia: { not: null } } } },
          ],
        }
      : {}),
    ...(propriedadeId === null ? {} : { propriedadeId }),
    ...(loteId ? { loteId } : {}),
    ...(competencia ? { competencia: comoData(competencia + "-01") } : {}),
  };
  return prisma.$transaction(async (tx) => ({
    itens: await tx.mesNutricao.findMany({
      where,
      include: incluirMes,
      orderBy: [{ competencia: "desc" }, { id: "asc" }],
      take: 10,
      skip: (pagina - 1) * 10,
    }),
    total: await tx.mesNutricao.count({ where }),
  }));
}
async function idempotente<T>(
  tx: Tx,
  chave: string,
  op: string,
  body: unknown,
  usuarioId: number,
  propriedadeId: number,
  acao: () => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${chave}`}))`;
  const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave } }),
    hashPayload = hash(body);
  if (anterior) {
    if (
      anterior.hashPayload !== hashPayload ||
      anterior.usuarioId !== usuarioId ||
      anterior.propriedadeId !== propriedadeId ||
      anterior.operacao !== op
    )
      erro("Chave já utilizada com outros dados");
    return anterior.resultadoIds as T;
  }
  const resultado = await acao();
  await tx.requisicaoPecuaria.create({
    data: {
      chave,
      propriedadeId,
      usuarioId,
      operacao: op,
      hashPayload,
      resultadoIds: JSON.parse(
        JSON.stringify(resultado),
      ) as Prisma.InputJsonValue,
    },
  });
  return resultado;
}
export type ConfirmacaoMensal = {
  chave: string;
  revisao: number;
  motivo: string;
  itens: Array<{
    produtoId: string;
    quantidade: string;
    partidas?: SelecaoPartida[];
  }>;
};
export async function confirmarMes(
  id: string,
  propriedadeId: number,
  usuarioId: number,
  input: ConfirmacaoMensal,
) {
  return transacaoPecuaria((tx) =>
    idempotente(
      tx,
      input.chave,
      "NUTRICAO_MENSAL",
      { id, ...input },
      usuarioId,
      propriedadeId,
      async () => {
        let mes = await carregarMesTx(tx, id, propriedadeId);
        await trava(tx, mes.loteId);
        if (mes.revisadoEm || mes.revisao !== input.revisao)
          erro("O mês mudou; recarregue a conferência");
        const fim = somarDias(proximoMes(textoData(mes.competencia)), -1);
        if (hoje() <= fim) erro("O mês ainda não terminou");
        const diasEsperados = (+comoData(fim) - +mes.inicio) / 86400000 + 1;
        if (mes.dias.length !== diasEsperados)
          erro("Existem dias não processados; reprocesse antes de revisar");
        await exigirPeriodoAberto(tx, propriedadeId, mes.competencia);
        // A reconciliação é uma ação separada, para o usuário revisar a nova base antes da baixa.
        for (const d of mes.dias) {
          const base = await baseDiaTx(tx, mes.loteId, propriedadeId, d.data);
          if (base.baseHash !== d.baseHash)
            erro(
              "A base histórica mudou; atualize a base com justificativa e confira os novos totais",
            );
        }
        if (mes.dias.some((d) => d.pendencia))
          erro("Resolva as pendências antes de fechar o mês");
        if (
          mes.configuracao.modelo !== "PROVISORIO" &&
          mes.dias.some((d) => d.situacao !== "EFETIVADO")
        )
          erro("Confirme ou reprocesse os consumos diários pendentes");
        const produtos = [
          ...new Set(mes.dias.flatMap((d) => d.itens.map((i) => i.produtoId))),
        ].sort();
        if (
          input.itens.length !== produtos.length ||
          new Set(input.itens.map((i) => i.produtoId)).size !==
            produtos.length ||
          produtos.some((p) => !input.itens.some((i) => i.produtoId === p))
        )
          erro("Confira todos os ingredientes uma única vez");
        for (const produtoId of produtos) {
          const pedido = input.itens.find((i) => i.produtoId === produtoId)!;
          const itens = mes.dias.flatMap((d) =>
            d.itens
              .filter((i) => i.produtoId === produtoId)
              .map((i) => ({ i, d })),
          );
          const pesos = itens.map(({ i, d }) =>
            mes.configuracao.modelo === "PROVISORIO" &&
            d.situacao !== "EFETIVADO"
              ? i.prevista
              : i.confirmada,
          );
          const base = pesos.reduce((a, b) => a.plus(b), D(0));
          if (!D(pedido.quantidade).eq(base) && input.motivo.trim().length < 5)
            erro("Justifique as diferenças em relação ao total do mês");
          if (
            D(pedido.quantidade).gt(0) &&
            base.isZero() &&
            !itens.some(({ d }) => d.participantes.length)
          )
            erro("Não há animais elegíveis para atribuir este consumo");
          const alvos = repartirQuantidade(
            pedido.quantidade,
            base.isZero()
              ? itens.map(({ d }) => d.participantes.length)
              : pesos,
          );
          let selecoes: SelecaoPartida[][] | undefined;
          if (pedido.partidas?.length) {
            try {
              selecoes = distribuirPartidas(
                pedido.partidas,
                itens.map((x, i) =>
                  Prisma.Decimal.max(0, alvos[i].minus(x.i.confirmada)),
                ),
              );
            } catch (e) {
              erro((e as Error).message);
            }
          }
          for (let n = 0; n < itens.length; n++) {
            if (alvos[n].gt(0) && !itens[n].d.participantes.length)
              erro(
                "Consumo positivo sem animais na data; reconcilie o histórico",
              );
            await ajustarItemTx(
              tx,
              itens[n].i.id,
              alvos[n],
              usuarioId,
              input.motivo.trim() || "Revisão mensal sem alteração",
              selecoes?.[n],
            );
            await tx.itemConsumoDiario.update({
              where: { id: itens[n].i.id },
              data: {
                origemQuantidade: D(pedido.quantidade).eq(base)
                  ? itens[n].i.origemQuantidade === "CALCULADA"
                    ? "ESTIMATIVA_ACEITA"
                    : itens[n].i.origemQuantidade
                  : "TOTAL_MENSAL_INFORMADO",
              },
            });
          }
        }
        await tx.consumoDiario.updateMany({
          where: { mesId: id },
          data: { situacao: "EFETIVADO", pendencia: null },
        });
        await tx.mesNutricao.update({
          where: { id },
          data: {
            revisadoEm: new Date(),
            revisadoPorId: usuarioId,
            revisao: { increment: 1 },
          },
        });
        await auditar(tx, {
          entidade: "MesNutricao",
          entidadeId: id,
          propriedadeId,
          usuarioId,
          acao: "REVISAO_MENSAL",
          antes: mes,
          depois: input,
        });
        return { id };
      },
    ),
  );
}
export async function confirmarDias(
  id: string,
  propriedadeId: number,
  usuarioId: number,
  input: {
    chave: string;
    revisao: number;
    motivo: string;
    dias: Array<{
      id: string;
      itens: Array<{
        produtoId: string;
        quantidade: string;
        partidas?: SelecaoPartida[];
      }>;
    }>;
  },
) {
  return transacaoPecuaria((tx) =>
    idempotente(
      tx,
      input.chave,
      "NUTRICAO_DIAS",
      { id, ...input },
      usuarioId,
      propriedadeId,
      async () => {
        const mes = await carregarMesTx(tx, id, propriedadeId);
        await trava(tx, mes.loteId);
        if (
          mes.configuracao.modelo === "PROVISORIO" ||
          mes.revisadoEm ||
          mes.revisao !== input.revisao
        )
          erro("Este mês não está disponível para confirmação diária");
        if (new Set(input.dias.map((d) => d.id)).size !== input.dias.length)
          erro("Dia repetido");
        for (const pedido of input.dias) {
          const dia = mes.dias.find((d) => d.id === pedido.id);
          if (!dia) erro("Dia inexistente");
          const d = dia!;
          const baseAtual = await baseDiaTx(
            tx,
            mes.loteId,
            propriedadeId,
            d.data,
          );
          if (baseAtual.pendencia) erro(baseAtual.pendencia);
          if (baseAtual.baseHash !== d.baseHash)
            erro(
              "A dieta ou ocupação mudou; reprocesse o dia antes de confirmar",
            );
          if (
            pedido.itens.length !== d.itens.length ||
            new Set(pedido.itens.map((i) => i.produtoId)).size !==
              d.itens.length
          )
            erro("Confira todos os ingredientes do dia");
          for (const item of d.itens) {
            const p = pedido.itens.find((i) => i.produtoId === item.produtoId);
            if (!p) erro("Ingrediente ausente");
            if (D(p!.quantidade).gt(0) && !d.participantes.length)
              erro("Consumo positivo sem animais na data");
            if (
              !D(p!.quantidade).eq(
                d.situacao === "EFETIVADO" ? item.confirmada : item.prevista,
              ) &&
              input.motivo.trim().length < 5
            )
              erro("Justifique a diferença");
            await ajustarItemTx(
              tx,
              item.id,
              D(p!.quantidade),
              usuarioId,
              input.motivo || "Confirmação manual",
              p!.partidas,
            );
            await tx.itemConsumoDiario.update({
              where: { id: item.id },
              data: {
                origemQuantidade: D(p!.quantidade).eq(item.prevista)
                  ? "ESTIMATIVA_ACEITA"
                  : "TOTAL_DIARIO_INFORMADO",
              },
            });
          }
          await tx.consumoDiario.update({
            where: { id: d.id },
            data: { situacao: "EFETIVADO", pendencia: null },
          });
        }
        await tx.mesNutricao.update({
          where: { id },
          data: { revisao: { increment: 1 } },
        });
        await auditar(tx, {
          entidade: "MesNutricao",
          entidadeId: id,
          propriedadeId,
          usuarioId,
          acao: "CONFIRMACAO_DIARIA",
          depois: input,
        });
        return { id };
      },
    ),
  );
}
export async function reabrirMes(
  id: string,
  propriedadeId: number,
  usuarioId: number,
  motivo: string,
) {
  return transacaoPecuaria(async (tx) => {
    const mes = await carregarMesTx(tx, id, propriedadeId);
    await trava(tx, mes.loteId);
    await exigirPeriodoAberto(tx, propriedadeId, mes.competencia);
    if (!mes.revisadoEm) erro("O mês já está aberto");
    await tx.mesNutricao.update({
      where: { id },
      data: {
        revisadoEm: null,
        revisadoPorId: null,
        revisao: { increment: 1 },
      },
    });
    await auditar(tx, {
      entidade: "MesNutricao",
      entidadeId: id,
      propriedadeId,
      usuarioId,
      acao: "REABERTURA",
      antes: mes,
      depois: { motivo },
    });
    return { id };
  });
}

export async function reconciliarMes(
  id: string,
  propriedadeId: number,
  usuarioId: number,
  input: { chave: string; revisao: number; motivo: string },
) {
  return transacaoPecuaria((tx) =>
    idempotente(
      tx,
      input.chave,
      "NUTRICAO_RECONCILIACAO",
      { id, ...input },
      usuarioId,
      propriedadeId,
      async () => {
        const mes = await carregarMesTx(tx, id, propriedadeId);
        await trava(tx, mes.loteId);
        if (mes.revisadoEm || mes.revisao !== input.revisao)
          erro("O mês mudou ou já está revisado; recarregue");
        if (input.motivo.trim().length < 5)
          erro("Justifique a atualização da base histórica");
        await exigirPeriodoAberto(tx, propriedadeId, mes.competencia);
        for (const d of mes.dias)
          await sincronizarDiaTx(tx, mes.loteId, propriedadeId, d.data, true);
        await tx.mesNutricao.update({
          where: { id },
          data: { revisao: { increment: 1 } },
        });
        await auditar(tx, {
          entidade: "MesNutricao",
          entidadeId: id,
          propriedadeId,
          usuarioId,
          acao: "RECONCILIACAO_HISTORICA",
          antes: mes,
          depois: { motivo: input.motivo },
        });
        return { id };
      },
    ),
  );
}
