import { z } from "zod";
import { conferirAnimaisOrigemGeralTx } from "./producao.js";
import type { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

/** Classificação para venda. Não representa elegibilidade sanitária para alimentação. */
export type AplicacaoCarenciaProducao = {
  id: string; animalId: string; data: Date; aplicadaEm: Date | null; precisaoTemporal: string;
  estadoCarenciaLeite: string; carenciaLeiteHoras: number | null; aptidaoCarenciaSnapshot: string | null;
  consumoMantido: boolean; administracaoMantida: boolean | null;
};
export function classificarCarenciaProducao(input: { data: Date; horario?: string | null; animalIds: string[] }, aplicacoes: AplicacaoCarenciaProducao[]) {
  const data = input.data.toISOString().slice(0, 10);
  const inicio = new Date(`${data}T${input.horario ? `${input.horario}:00` : "00:00:00"}-03:00`);
  const fim = input.horario ? inicio : new Date(`${data}T23:59:59.999-03:00`);
  return { versao: 1, finalidade: "VENDA", dataOperacional: data, horarioOrdenha: input.horario ?? null,
    animais: [...new Set(input.animalIds)].sort().map(animalId => {
      let estado: "SEM_RESTRICAO_REGISTRADA" | "EM_CARENCIA" | "NAO_AFERIVEL" = "SEM_RESTRICAO_REGISTRADA";
      const evidencias = aplicacoes.filter(a => a.animalId === animalId && a.data <= input.data).flatMap(a => {
        const exata = a.precisaoTemporal === "HORA" && a.aplicadaEm != null;
        if (exata && a.aplicadaEm! > fim) return [];
        const revisao = a.consumoMantido && a.administracaoMantida == null;
        const naoAplicavel = a.estadoCarenciaLeite === "NAO_APLICAVEL" && a.aptidaoCarenciaSnapshot === "LEITE";
        const desconhecida = revisao || (!naoAplicavel && (a.estadoCarenciaLeite !== "INFORMADO" || a.carenciaLeiteHoras == null));
        const baseLimite = exata ? a.aplicadaEm! : new Date(`${a.data.toISOString().slice(0, 10)}T23:59:59.999-03:00`);
        const terminoLimite = !desconhecida && !naoAplicavel && a.carenciaLeiteHoras != null ? new Date(baseLimite.getTime() + a.carenciaLeiteHoras * 3_600_000) : null;
        if (desconhecida) estado = "NAO_AFERIVEL";
        else if (!naoAplicavel && a.carenciaLeiteHoras !== 0 && terminoLimite! > inicio && estado !== "NAO_AFERIVEL")
          estado = exata && input.horario ? "EM_CARENCIA" : "NAO_AFERIVEL";
        return [{ aplicacaoId: a.id, data: a.data.toISOString().slice(0, 10), aplicadaEm: a.aplicadaEm?.toISOString() ?? null,
          precisaoTemporal: a.precisaoTemporal, estadoCarenciaLeite: a.estadoCarenciaLeite, carenciaLeiteHoras: a.carenciaLeiteHoras,
          aptidaoCarenciaSnapshot: a.aptidaoCarenciaSnapshot, revisaoAdministracaoPendente: revisao,
          terminoLimiteConservador: terminoLimite?.toISOString() ?? null }];
      });
      return { animalId, estado, evidencias };
    }) };
}
export async function conferirCarenciaProducaoTx(tx: Prisma.TransactionClient, input: { data: Date; horario?: string | null; animalIds: string[] }) {
  const aplicacoes = await tx.aplicacaoProduto.findMany({ where: { animalId: { in: input.animalIds }, data: { lte: input.data },
    OR: [{ status: "VALIDO" }, { consumoMantido: true, OR: [{ administracaoMantida: true }, { administracaoMantida: null }] }] },
    select: { id: true, animalId: true, data: true, aplicadaEm: true, precisaoTemporal: true, estadoCarenciaLeite: true, carenciaLeiteHoras: true,
      aptidaoCarenciaSnapshot: true, consumoMantido: true, administracaoMantida: true }, orderBy: [{ animalId: "asc" }, { data: "asc" }, { id: "asc" }] });
  return classificarCarenciaProducao(input, aplicacoes);
}

/** Uma aplicação retroativa exige regularização; nunca reclassifica/reescreve consumos existentes. */
export async function conferirCarenciaOrigensVendaTx(tx: Prisma.TransactionClient, entradaIds: string[]) {
  if (!entradaIds.length) return;
  const origens = await tx.entradaProducaoLeite.findMany({ where: { id: { in: entradaIds }, status: "CONFIRMADA" },
    include: { movimento: { select: { data: true } }, sessao: { select: { horario: true } },
      vinculosMedicoes: { where: { ativo: true }, include: { medicao: { select: { participante: { select: { animalId: true } } } } } } } });
  for (const origem of origens) {
    const snapshot = z.object({ animaisOrigem: z.array(z.object({ animalId: z.string().uuid() })) }).safeParse(origem.snapshot);
    const animalIds = origem.medicaoGeralId && snapshot.success ? snapshot.data.animaisOrigem.map(a => a.animalId) : origem.vinculosMedicoes.map(v => v.medicao.participante.animalId);
    if (origem.medicaoGeralId) {
      const dados = await tx.movimentoEstoque.findUniqueOrThrow({ where: { id: origem.movimentoId }, select: { propriedadeId: true } });
      if (dados.propriedadeId == null) throw new RebanhoError("CONFLITO", "Origem sem sítio");
      await conferirAnimaisOrigemGeralTx(tx, dados.propriedadeId, origem.movimento.data, animalIds);
    }
    if (!animalIds.length) throw new RebanhoError("CONFLITO", "A origem não tem animais comprovados; regularize antes de vender");
    const carencia = await conferirCarenciaProducaoTx(tx, { data: origem.movimento.data, horario: origem.sessao.horario, animalIds });
    if (carencia.animais.some(a => a.estado !== "SEM_RESTRICAO_REGISTRADA"))
      throw new RebanhoError("CONFLITO", "Uma carência histórica alterou a disponibilidade desta origem. Regularize a classificação e os consumidores; o histórico foi preservado.");
  }
}
