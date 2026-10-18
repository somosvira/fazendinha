import { Prisma } from "@prisma/client";
import { dinheiro } from "../financeiro/regras.js";
import { textoDia } from "./presenca.calc.js";

export type CompromissoGerencial = {
  tipo: string;
  status: string;
  dataVencimento: Date;
  valorOriginal: Prisma.Decimal;
  liquidacoes: { valor: Prisma.Decimal; transacao: { status: string } }[];
};

type ChaveFaixa = "VENCIDO" | "ATE_7_DIAS" | "DE_8_A_30_DIAS" | "APOS_30_DIAS";

/** Hoje é a data de calendário da fazenda, representada em UTC como as colunas @db.Date. */
export function calcularCompromissos(compromissos: CompromissoGerencial[], hoje: Date) {
  const faixas: { chave: ChaveFaixa; rotulo: string; valor: Prisma.Decimal }[] = [
    { chave: "VENCIDO", rotulo: "Vencido", valor: dinheiro(0) },
    { chave: "ATE_7_DIAS", rotulo: "Até 7 dias", valor: dinheiro(0) },
    { chave: "DE_8_A_30_DIAS", rotulo: "De 8 a 30 dias", valor: dinheiro(0) },
    { chave: "APOS_30_DIAS", rotulo: "Após 30 dias", valor: dinheiro(0) },
  ];
  for (const compromisso of compromissos) {
    if (compromisso.tipo !== "PAGAR" || !["PENDENTE", "PARCIAL"].includes(compromisso.status)) continue;
    // A liquidação revertida conserva seu vínculo histórico, mas deixa de abater a obrigação.
    const liquidado = compromisso.liquidacoes.filter(l => l.transacao.status === "CONFIRMADA")
      .reduce((total, l) => total.plus(l.valor), dinheiro(0));
    const pendente = dinheiro(compromisso.valorOriginal.minus(liquidado));
    const dias = (+compromisso.dataVencimento - +hoje) / 86400000;
    const faixa = faixas[dias < 0 ? 0 : dias <= 7 ? 1 : dias <= 30 ? 2 : 3];
    faixa.valor = faixa.valor.plus(pendente);
  }
  const vencido = faixas[0].valor;
  const aVencer = faixas.slice(1).reduce((total, faixa) => total.plus(faixa.valor), dinheiro(0));
  return {
    data: textoDia(hoje), totalPendente: vencido.plus(aVencer).toFixed(2),
    vencido: vencido.toFixed(2), aVencer: aVencer.toFixed(2),
    faixas: faixas.map(faixa => ({ ...faixa, valor: faixa.valor.toFixed(2) })),
  };
}
