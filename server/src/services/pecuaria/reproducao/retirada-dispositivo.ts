import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { filtroInsercoesRetirada } from "../protocolos/insercoes-retirada.js";
import { dataOuHorario } from "./schemas.js";
import { anteriorIatf, lerDataIatf } from "./horarios.calc.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import { reconciliarAlertasReprodutivosAnimalTx } from "./alertas/produtor.js";
export const retiradaDispositivoAvulsaSchema = z
  .object({
    chave: z.string().uuid(),
    propriedadeId: z.number().int().positive(),
    realizadaEm: dataOuHorario,
    confirmarRetiradaFisica: z.literal(true),
    responsavel: z.string().trim().max(160).optional(),
    observacao: z.string().trim().min(5).max(1000),
  })
  .strict();
export async function registrarRetiradaDispositivoTx(
  tx: Prisma.TransactionClient,
  insercaoId: string,
  entrada: unknown,
  usuarioId: number,
  opcoes: { reciboCompartilhado?: true } = {},
) {
  const input = retiradaDispositivoAvulsaSchema.parse(entrada);
  const ref = await tx.aplicacaoProduto.findUnique({
    where: { id: insercaoId },
    select: { animalId: true },
  });
  if (!ref) throw new RebanhoError("NAO_ENCONTRADO", "Inserção não encontrada");
  await travarAnimais(tx, [ref.animalId]);
  const executar = async () => {
    const temporal = lerDataIatf(input.realizadaEm);
    if (anteriorIatf(new Date(), "HORA", temporal.instante, temporal.precisao))
      throw new RebanhoError(
        "VALIDACAO",
        "A retirada deve ter ocorrido até agora",
        "realizadaEm",
      );
    await conferirAnimalNoFato(
      tx,
      ref.animalId,
      input.propriedadeId,
      new Date(temporal.data),
    );
    const insercao = await tx.aplicacaoProduto.findFirst({
      where: { id: insercaoId, ...filtroInsercoesRetirada(ref.animalId) },
      select: {
        id: true,
        data: true,
        aplicadaEm: true,
        precisaoTemporal: true,
      },
    });
    if (!insercao)
      throw new RebanhoError(
        "CONFLITO",
        "O dispositivo já tem retirada ou sua inserção exige revisão",
      );
    if (
      anteriorIatf(
        temporal.instante,
        temporal.precisao,
        insercao.aplicadaEm ?? insercao.data,
        insercao.precisaoTemporal === "HORA" ? "HORA" : "DIA",
      )
    )
      throw new RebanhoError(
        "VALIDACAO",
        "A retirada não pode anteceder a inserção",
        "realizadaEm",
      );
    const fato = await tx.manejoAnimal.create({
      data: {
        animalId: ref.animalId,
        propriedadeId: input.propriedadeId,
        tipo: "RETIRADA_DISPOSITIVO",
        data: new Date(temporal.data),
        realizadaEm: temporal.precisao === "HORA" ? temporal.instante : null,
        precisaoTemporal: temporal.precisao,
        insercaoAplicacaoId: insercaoId,
        criadoPorId: usuarioId,
        responsavel: input.responsavel,
        observacao: input.observacao,
      },
    });
    await auditar(tx, {
      entidade: "ManejoAnimal",
      entidadeId: fato.id,
      animalId: ref.animalId,
      propriedadeId: input.propriedadeId,
      usuarioId,
      acao: "RETIRADA_FISICA_DISPOSITIVO",
      depois: fato,
    });
    await reconciliarAlertasReprodutivosAnimalTx(tx, ref.animalId, usuarioId);
    return {
      id: fato.id,
      insercaoAplicacaoId: insercaoId,
      animalId: ref.animalId,
      data: temporal.data,
      realizadaEm: input.realizadaEm,
    };
  };
  return opcoes.reciboCompartilhado
    ? executar()
    : operacaoIdempotenteTx(
        tx,
        { ...input, insercaoId },
        usuarioId,
        "RETIRADA_FISICA_DISPOSITIVO",
        executar,
      );
}
export const registrarRetiradaDispositivo = (
  id: string,
  entrada: unknown,
  usuarioId: number,
) =>
  transacaoPecuaria((tx) =>
    registrarRetiradaDispositivoTx(tx, id, entrada, usuarioId),
  );

export const corrigirRetiradaDispositivoSchema = retiradaDispositivoAvulsaSchema
  .extend({ motivo: z.string().trim().min(5).max(1000) })
  .strict();
export function corrigirRetiradaDispositivo(
  id: string,
  entrada: unknown,
  usuarioId: number,
) {
  const input = corrigirRetiradaDispositivoSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    const ref = await tx.manejoAnimal.findFirst({
      where: {
        id,
        propriedadeId: input.propriedadeId,
        tipo: "RETIRADA_DISPOSITIVO",
        tarefaId: null,
      },
    });
    if (!ref || !ref.insercaoAplicacaoId)
      throw new RebanhoError(
        "NAO_ENCONTRADO",
        "Retirada física avulsa não encontrada",
      );
    await travarAnimais(tx, [ref.animalId]);
    return operacaoIdempotenteTx(
      tx,
      { ...input, manejoId: id },
      usuarioId,
      "CORRECAO_RETIRADA_FISICA",
      async () => {
        const antes = await tx.manejoAnimal.findUniqueOrThrow({
          where: { id },
        });
        if (antes.status !== "VALIDO")
          throw new RebanhoError(
            "CONFLITO",
            "A retirada já foi anulada ou substituída",
          );
        await tx.manejoAnimal.update({
          where: { id },
          data: {
            status: "ANULADO",
            anuladoEm: new Date(),
            motivoAnulacao: input.motivo,
            realizacaoMantida: false,
          },
        });
        const { motivo, ...dados } = input;
        const substituta = await registrarRetiradaDispositivoTx(
          tx,
          ref.insercaoAplicacaoId!,
          dados,
          usuarioId,
          { reciboCompartilhado: true },
        );
        await auditar(tx, {
          entidade: "ManejoAnimal",
          entidadeId: id,
          animalId: ref.animalId,
          propriedadeId: input.propriedadeId,
          usuarioId,
          acao: "CORRECAO_RETIRADA_FISICA",
          antes,
          depois: { substitutoId: substituta.id, motivo },
        });
        return substituta;
      },
    );
  });
}
