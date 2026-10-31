import { reavaliarContinuidadeProgramaAnimalTx } from "../programacoes/continuidade.js";
import type { Prisma } from "@prisma/client";
import { auditar, hojeFazendaDate } from "../../rebanho/regras.js";
import { avaliarRegraAnimalTx, publicarNecessidadeTx, configuracaoNecessidadeTx } from "./produtor.js";
export type MudancaAnimalAlerta = "CADASTRO" | "CORRECAO" | "LOCALIZACAO" | "BAIXA" | "ESTORNO_BAIXA";
/** Executada depois da escrita original, sob a trava do animal, na mesma transação. */
export async function reavaliarContinuidadeAnimalTx(tx: Prisma.TransactionClient, animalId: string, usuarioId: number | null, mudanca: MudancaAnimalAlerta) {
  const necessidades = await tx.necessidadeSanitaria.findMany({ where: { animalId }, include: { regra: true, alerta: { select: { ciclo: true } } } });
  const animal = await tx.animal.findUniqueOrThrow({ where: { id: animalId }, include: { localizacoes: { where: { ate: null } }, baixas: { where: { estornadaEm: null } } } });
  const local = animal.localizacoes[0];
  const hoje = hojeFazendaDate();
  const autor = usuarioId && usuarioId > 0 ? { usuarioId } : { tecnico: "sanidade:continuidade-animal" };
  for (const original of necessidades) {
    const n = { ...original, regra: await configuracaoNecessidadeTx(tx, original) };
    const encerradaPelaBaixa = n.situacao === "ENCERRADO" && n.motivo?.startsWith("Baixa do animal:");
    const reabrirBaixa = mudanca === "ESTORNO_BAIXA" && encerradaPelaBaixa;
    const transferido = !!local && local.propriedadeId !== n.propriedadeId;
    if ((["REALIZADO", "DISPENSADO", "ENCERRADO", "INVALIDADO"].includes(n.situacao) || n.alerta && n.alerta.ciclo !== "ABERTO") && !reabrirBaixa) {
      // O sítio da consulta acompanha o animal; estado, fatos e snapshot continuam históricos.
      if (transferido) {
        await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { propriedadeId: local.propriedadeId, revisao: { increment: 1 } } });
        await publicarNecessidadeTx(tx, n.id, autor, n.alerta?.ciclo === "INVALIDADO" ? "INVALIDAR" : "ENCERRAR");
        await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId, propriedadeId: local.propriedadeId, acao: "CONTINUIDADE_ANIMAL", usuarioId, antes: n, depois: { mudanca, situacao: n.situacao, propriedadeId: local.propriedadeId } });
      }
      continue;
    }
    const fora = !local || !n.regra.propriedadeIds.includes(local.propriedadeId) || !!n.regra.sexo && n.regra.sexo !== animal.sexo;
    const produto = n.regra.produtoId ? await tx.produto.findUnique({ where: { id: n.regra.produtoId }, select: { ativo: true } }) : null;
    const protocolo = n.regra.protocoloId ? await tx.protocolo.findUnique({ where: { id: n.regra.protocoloId }, select: { ativo: true } }) : null;
    const destinoInativo = !!n.regra.produtoId && (!produto || !produto.ativo) || !!n.regra.protocoloId && (!protocolo || !protocolo.ativo);
    const temDecisao = !!n.aplicacaoId || !!n.participacaoId || ["ADIADO", "NECESSITA_REVISAO"].includes(n.situacao);
    let situacao = n.situacao, motivo = n.motivo;
    if (animal.baixas.length) { situacao = "ENCERRADO"; motivo = `Baixa do animal: ${animal.baixas[0].id}`; }
    else if (fora || destinoInativo || encerradaPelaBaixa || transferido || mudanca === "CORRECAO" && temDecisao) {
      situacao = "NECESSITA_REVISAO";
      motivo = fora ? "Animal fora do público ou dos sítios da regra; conferir destino da necessidade" : destinoInativo ? "Regra, produto ou protocolo inativo; conferir pendência" : encerradaPelaBaixa ? "Baixa estornada; conferir continuidade sem reiniciar atendimento" : transferido ? "Animal transferido; conferir o contexto do cuidado no sítio atual" : "Cadastro corrigido após decisão ou programação; conferir evidência";
    }
    const propriedadeId = local?.propriedadeId ?? n.propriedadeId;
    if (situacao !== n.situacao || motivo !== n.motivo || propriedadeId !== n.propriedadeId) {
      await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { situacao, motivo, propriedadeId, revisao: { increment: 1 } } });
      await publicarNecessidadeTx(tx, n.id, autor, situacao === "ENCERRADO" ? "ENCERRAR" : n.alerta?.ciclo && n.alerta.ciclo !== "ABERTO" ? "REABRIR" : "PUBLICAR");
      await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId, propriedadeId, acao: "CONTINUIDADE_ANIMAL", usuarioId, antes: n, depois: { mudanca, situacao, motivo, propriedadeId } });
    }
    if (!fora && !destinoInativo && !animal.baixas.length && !temDecisao && !["ENCERRADO", "NECESSITA_REVISAO"].includes(situacao)) await avaliarRegraAnimalTx(tx, n.regraId, animalId, hoje, autor);
  }
  await reavaliarContinuidadeProgramaAnimalTx(tx, animalId, usuarioId, mudanca);
  if (!local || animal.baixas.length) return;
  const regras = await tx.regraAlertaSanitario.findMany({ where: { ativo: true, propriedadeIds: { has: local.propriedadeId }, ...(necessidades.length ? { id: { notIn: necessidades.map(n => n.regraId) } } : {}) }, select: { id: true } });
  for (const regra of regras) await avaliarRegraAnimalTx(tx, regra.id, animalId, hoje, autor);
}
