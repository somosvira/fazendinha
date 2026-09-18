import { Prisma } from "@prisma/client";
import { dinheiro } from "./regras.js";

/** O estorno abate a natureza original, na data do evento inverso. */
export function movimentoRealizado(movimento: { direcao: string; valor: Prisma.Decimal; transacao: { tipo: string; status: string; reversaoDe?: { tipo: string } | null } }) {
  const { transacao } = movimento;
  if (!["CONFIRMADA", "REVERTIDA"].includes(transacao.status)) return null;
  const tipo = transacao.reversaoDe?.tipo ?? transacao.tipo;
  if (tipo === "TRANSFERENCIA") return null;
  const estorno = transacao.tipo === "REVERSAO";
  const campo = (estorno ? movimento.direcao === "SAIDA" : movimento.direcao === "ENTRADA") ? "entradas" : "saidas";
  return { campo, valor: dinheiro(estorno ? movimento.valor.negated() : movimento.valor) } as const;
}
