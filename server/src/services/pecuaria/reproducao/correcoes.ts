import { anularEvidenciaAvaliacaoTx } from "../exames/evidencia-reprodutiva.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { estornarMovimentoTx } from "../../estoque/estoque.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { erro } from "./registros.js";
import { marcarRegularizacaoFatoTx } from "./marcacao-regularizacao.js";
import { intervalosSobrepostos } from "./regras.calc.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
export type TipoAnulacao =
  | "tentativas"
  | "avaliacoes"
  | "partos"
  | "situacoes-iniciais"
  | "restricoes";
async function fatoTx(
  tx: Prisma.TransactionClient,
  tipo: TipoAnulacao,
  id: string,
  propriedadeId: number,
) {
  const where = { id, propriedadeId };
  const fato =
    tipo === "tentativas"
      ? await tx.tentativaReprodutiva.findFirst({ where })
      : tipo === "avaliacoes"
        ? await tx.avaliacaoReprodutiva.findFirst({ where })
        : tipo === "partos"
          ? await tx.partoAnimal.findFirst({ where })
          : tipo === "situacoes-iniciais"
            ? await tx.situacaoInicialReprodutiva.findFirst({ where })
            : await tx.restricaoReprodutiva.findFirst({ where });
  if (!fato)
    throw new RebanhoError("NAO_ENCONTRADO", "Fato não encontrado neste sítio");
  return fato;
}
async function previaTx(
  tx: Prisma.TransactionClient,
  tipo: TipoAnulacao,
  id: string,
  propriedadeId: number,
) {
  const fato = await fatoTx(tx, tipo, id, propriedadeId),
    impedimentos: string[] = [],
    efeitos: string[] = [],
    criasIds: string[] = [];
  let exigeDestinoConsumo = false;
  if (fato.status !== "VALIDO") impedimentos.push("Fato já anulado");
  if (tipo === "tentativas") {
    if (
      (await tx.avaliacaoReprodutiva.count({
        where: { tentativaId: id, status: "VALIDO" },
      })) ||
      (await tx.gestacaoAnimal.count({
        where: { tentativaId: id, status: "VALIDO" },
      }))
    )
      impedimentos.push(
        "Há avaliações/gestação válidas vinculadas: revise antes",
      );
    const tentativa = await tx.tentativaReprodutiva.findUniqueOrThrow({
      where: { id },
    });
    if (tentativa.movimentoEstoqueId || tentativa.operacaoServicoId) {
      exigeDestinoConsumo = true;
      efeitos.push(
        "Escolha obrigatória: devolver ao estoque somente se não houve uso/perda física; manter consumo se o material foi usado/descartado, sem recompor saldo",
      );
    }
    efeitos.push("Histórico e número da tentativa permanecem preservados");
  }
  if (tipo === "avaliacoes") {
    const avaliacao = await tx.avaliacaoReprodutiva.findUniqueOrThrow({
      where: { id },
    });
    if (avaliacao.conduta === "DESCARTE") {
      const restricao = avaliacao.restricaoId
        ? await tx.restricaoReprodutiva.findUnique({
            where: { id: avaliacao.restricaoId },
          })
        : null;
      if (!restricao || (restricao.status === "VALIDO" && !restricao.ate))
        impedimentos.push(
          "Encerre/revise a restrição de descarte vinculada antes de anular esta decisão",
        );
    }
    if (avaliacao.gestacaoId && avaliacao.gestacaoCriada) {
      if (
        (await tx.partoAnimal.count({
          where: { gestacaoId: avaliacao.gestacaoId, status: "VALIDO" },
        })) ||
        (await tx.avaliacaoReprodutiva.count({
          where: {
            gestacaoId: avaliacao.gestacaoId,
            id: { not: id },
            status: "VALIDO",
          },
        }))
      )
        impedimentos.push("Gestação possui parto ou outras avaliações válidas");
      else
        efeitos.push(
          "Anulação da gestação criada pela avaliação, sem perda física presumida",
        );
    }
  }
  if (tipo === "partos") {
    const posteriores = await tx.tentativaReprodutiva.count({
      where: {
        animalId: fato.animalId,
        status: "VALIDO",
        data: { gt: fato.data },
      },
    });
    if (posteriores)
      impedimentos.push(
        "Existem tentativas no ciclo posterior; revise os ciclos antes",
      );
    const parto = await tx.partoAnimal.findUniqueOrThrow({ where: { id } });
    const [ocorrenciasRetencao, pesagensVinculadas, colostroValido, escoresVigentes] = await Promise.all([
      tx.ocorrenciaSanitaria.count({ where: { partoRetencaoPlacentaId: id, status: "VALIDO" } }),
      tx.vinculoPesagemParto.count({ where: { partoId: id, revogadoEm: null } }),
      tx.fornecimentoColostro.count({ where: { cria: { partoId: id }, status: "VALIDO" } }),
      tx.exameAnimal.count({ where: { partoPosPartoId: id, status: "VALIDO" } }),
    ]);
    if (ocorrenciasRetencao) impedimentos.push("Desvincule as ocorrências de retenção de placenta antes de anular o parto");
    if (escoresVigentes) impedimentos.push("Revise os escores pós-parto vinculados antes de anular o parto");
    if (colostroValido) impedimentos.push("Revise os fornecimentos de colostro das crias antes de anular o parto");
    if (pesagensVinculadas) impedimentos.push("Revogue os vínculos de pesagem antes de anular o parto; as pesagens serão preservadas");
    if (parto.gestacaoId) {
      const gestacao = await tx.gestacaoAnimal.findUniqueOrThrow({ where: { id: parto.gestacaoId } });
      const [outrasGestacoes, outrosPartos] = await Promise.all([
        tx.gestacaoAnimal.findMany({ where: { animalId: fato.animalId, status: "VALIDO", id: { not: gestacao.id } } }),
        tx.partoAnimal.count({ where: { animalId: fato.animalId, status: "VALIDO", id: { not: id }, data: { gte: gestacao.inicio ?? gestacao.confirmadaEm } } }),
      ]);
      if (gestacao.status !== "VALIDO" || !gestacao.motivoEncerramento?.startsWith("PARTO_") || gestacao.encerradaEm?.getTime() !== parto.data.getTime())
        impedimentos.push("O encerramento da gestação vinculada já foi revisto; regularize antes de anular o parto");
      if (outrasGestacoes.some((g) => intervalosSobrepostos({ inicio: gestacao.inicio ?? gestacao.confirmadaEm, fim: null }, { inicio: g.inicio ?? g.confirmadaEm, fim: g.encerradaEm })) || outrosPartos)
        impedimentos.push("Reabrir a gestação conflita com outra gestação ou parto; revise a cronologia antes");
    }
    const lactacao = await tx.lactacaoAnimal.findFirst({
      where: { partoId: id },
    });
    if (lactacao)
      impedimentos.push(
        "Lactação vinculada deve ser corrigida antes de anular o parto",
      );
    const crias = await tx.criaParto.findMany({
      where: { partoId: id, animalId: { not: null } },
    });
    criasIds.push(...crias.flatMap((c) => (c.animalId ? [c.animalId] : [])));
    if (crias.length)
      efeitos.push(
        "As crias existentes e sua filiação permanecem; anulação não apaga animais",
      );
    efeitos.push(
      "Parto deixa de contar na paridade; a gestação vinculada volta a aberta quando compatível",
    );
  }
  const vinculo = tipo === "tentativas" ? { tentativaId: id } : tipo === "avaliacoes" ? { avaliacaoId: id } : null;
  const tarefasIatf = vinculo ? await tx.tarefaIatf.findMany({ where: vinculo }) : [];
  const atendimentosVisita = vinculo ? await tx.participanteVisita.findMany({ where: { OR: [
    { fatoTipo: tipo === "tentativas" ? "TentativaReprodutiva" : "AvaliacaoReprodutiva", fatoId: id },
    { tarefaId: { in: tarefasIatf.map((t) => t.id) } },
    { fatoTipo: "TarefaIatf", fatoId: { in: tarefasIatf.map((t) => t.id) } },
  ] } }) : [];
  if (tarefasIatf.length || atendimentosVisita.length)
    efeitos.push("A execução original permanece; tarefas IATF e atendimentos da visita exigirão regularização explícita");
  return {
    tipo,
    id,
    propriedadeId,
    animalId: fato.animalId,
    impedimentos,
    efeitos,
    criasIds,
    exigeDestinoConsumo,
    fingerprint: hashDados({
      fato,
      impedimentos,
      efeitos,
      criasIds,
      exigeDestinoConsumo,
      tarefasIatf,
      atendimentosVisita,
    }),
  };
}
export const previaAnulacao = (
  tipo: TipoAnulacao,
  id: string,
  propriedadeId: number,
) => previaTx(prisma, tipo, id, propriedadeId);
export async function anularFato(
  tipo: TipoAnulacao,
  id: string,
  input: {
    propriedadeId: number;
    chave: string;
    motivo: string;
    fingerprint: string;
    cienciaPreservacaoCrias?: boolean;
    destinoConsumo?: "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO";
  },
  usuarioId: number | null,
) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await fatoTx(tx, tipo, id, input.propriedadeId);
    const crias =
      tipo === "partos"
        ? await tx.criaParto.findMany({
            where: { partoId: id, animalId: { not: null } },
          })
        : [];
    await travarAnimais(tx, [
      referencia.animalId,
      ...crias.flatMap((c) => (c.animalId ? [c.animalId] : [])),
    ]);
    return operacaoIdempotenteTx(
      tx,
      { ...input, tipo, id },
      usuarioId,
      "ANULACAO_REPRODUTIVA",
      async () => {
        const previa = await previaTx(tx, tipo, id, input.propriedadeId);
        if (previa.fingerprint !== input.fingerprint)
          throw new RebanhoError(
            "CONFLITO",
            "Os impactos mudaram; gere uma nova prévia",
          );
        if (previa.impedimentos.length) erro(previa.impedimentos.join("; "));
        if (previa.criasIds.length && !input.cienciaPreservacaoCrias)
          erro(
            "Confirme que a anulação preservará as crias reais",
            "cienciaPreservacaoCrias",
          );
        if (previa.exigeDestinoConsumo && !input.destinoConsumo)
          erro(
            "Escolha o destino do material efetivamente consumido",
            "destinoConsumo",
          );
        const data = {
          status: "ANULADO" as const,
          motivoAnulacao: input.motivo,
          anuladoEm: new Date(),
        };
        if (tipo === "tentativas") {
          const tentativa = await tx.tentativaReprodutiva.findUniqueOrThrow({ where: { id } });
          if (tentativa.operacaoServicoId) {
            await tx.$queryRaw`SELECT id FROM "public"."Operacao" WHERE id = ${tentativa.operacaoServicoId} FOR UPDATE`;
            const servico = await tx.operacao.findFirst({ where: { id: tentativa.operacaoServicoId, propriedadeId: input.propriedadeId, tipo: "SERVICO" } });
            if (!servico) erro("Serviço vinculado não encontrado neste sítio", "operacaoServicoId");
            await exigirPeriodoAberto(tx, input.propriedadeId, tentativa.data);
            await exigirPeriodoAberto(tx, input.propriedadeId, servico.data);
          }
          const t = await tx.tentativaReprodutiva.update({
            where: { id },
            data: {
              ...data,
              consumoMantido:
                previa.exigeDestinoConsumo &&
                input.destinoConsumo === "MANTER_CONSUMO",
            },
          });
          if (
            t.movimentoEstoqueId &&
            input.destinoConsumo === "DEVOLVER_ESTOQUE"
          )
            await estornarMovimentoTx(tx, t.movimentoEstoqueId, {
              usuarioId,
              propriedadeId: input.propriedadeId,
              data: t.data,
              observacao: input.motivo,
            });
        } else if (tipo === "avaliacoes") {
          const a = await anularEvidenciaAvaliacaoTx(tx, id, data);
          if (a.gestacaoId && a.gestacaoCriada)
            await tx.gestacaoAnimal.update({
              where: { id: a.gestacaoId },
              data: { status: "ANULADO" },
            });
          if (a.gestacaoId && a.sexoFetal) {
            const ultima = await tx.avaliacaoReprodutiva.findFirst({
              where: {
                gestacaoId: a.gestacaoId,
                status: "VALIDO",
                sexoFetal: { not: null },
              },
              orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
            });
            await tx.gestacaoAnimal.update({
              where: { id: a.gestacaoId },
              data: { sexoFetal: ultima?.sexoFetal ?? null },
            });
          }
        } else if (tipo === "partos") {
          const p = await tx.partoAnimal.update({ where: { id }, data });
          if (p.gestacaoId)
            await tx.gestacaoAnimal.update({
              where: { id: p.gestacaoId },
              data: { encerradaEm: null, motivoEncerramento: null },
            });
        } else if (tipo === "situacoes-iniciais")
          await tx.situacaoInicialReprodutiva.update({ where: { id }, data });
        else await tx.restricaoReprodutiva.update({ where: { id }, data });
        if (tipo === "tentativas" || tipo === "avaliacoes")
          await marcarRegularizacaoFatoTx(tx, { fatoTipo: tipo === "tentativas" ? "TENTATIVA" : "AVALIACAO", fatoId: id, destinoConsumo: input.destinoConsumo ?? null, motivo: input.motivo, usuarioId });
        await auditar(tx, {
          entidade: tipo,
          entidadeId: id,
          animalId: referencia.animalId,
          propriedadeId: input.propriedadeId,
          acao: "ANULACAO",
          usuarioId,
          antes: referencia,
          depois: {
            ...data,
            previa,
            destinoConsumo: input.destinoConsumo ?? null,
          },
        });
        return { id, status: "ANULADO", efeitos: previa.efeitos };
      },
    );
  });
}
