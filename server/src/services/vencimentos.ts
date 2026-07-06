// Contas a vencer (item 6 do backlog): avisar quando uma nota/conta está
// vencendo ou já vencida. Regime de caixa: Lancamentos ABERTO/DEBITO são as
// contas a PAGAR (a Projeção). Este service classifica o vencimento em buckets
// e monta o DTO agrupado que o card do frontend consome.
//
// Núcleo PURO (classificarVencimento/diffDias) sem DB, testável; wrapper
// (listarContasAVencer) carrega do Prisma. Decimal→number só na borda do DTO.

import { prisma } from "../db.js";
import { assertMesAberto, FechamentoMensalError } from "./fechamento.js";

const MS_DIA = 86_400_000;

/** Dias inteiros entre duas datas ISO (YYYY-MM-DD), em UTC. Espelha o
 *  diffDias do client (rebanho/lib/derive.ts): (ate - de) em dias. */
export function diffDias(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / MS_DIA);
}

export type BucketVencimento = "VENCIDA" | "HOJE" | "D3" | "D7" | "FUTURO";

/** Classifica um vencimento relativo a "hoje":
 *  VENCIDA (< hoje) · HOJE (== hoje) · D3 (1..3 dias) · D7 (4..7 dias) · FUTURO (>7). */
export function classificarVencimento(dataVencimento: string, hoje: string): BucketVencimento {
  const dias = diffDias(hoje, dataVencimento); // >0 no futuro, <0 vencida
  if (dias < 0) return "VENCIDA";
  if (dias === 0) return "HOJE";
  if (dias <= 3) return "D3";
  if (dias <= 7) return "D7";
  return "FUTURO";
}

export interface ContaAVencerItem {
  id: number;
  descricao: string | null;
  fornecedorNome: string | null;
  categoriaNome: string;
  valor: number; // sempre positivo (sinal vem da natureza)
  dataVencimento: string; // YYYY-MM-DD
  diasAtraso: number; // >0 vencida, <=0 a vencer (0 = vence hoje)
}

export interface ContasAVencerDTO {
  hoje: string; // YYYY-MM-DD
  vencidas: ContaAVencerItem[];
  venceHoje: ContaAVencerItem[];
  proximos3: ContaAVencerItem[];
  proximos7: ContaAVencerItem[];
  totais: {
    vencidasValor: number;
    vencidasQtd: number;
    aVencer7Valor: number;
    aVencer7Qtd: number;
  };
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Lista as contas a PAGAR (Lancamento ABERTO/DEBITO, não estornado) com
 * vencimento até hoje + 7 dias (sem limite inferior → inclui as vencidas),
 * agrupadas por bucket. Ordena vencidas por mais atrasada primeiro; a vencer
 * por mais próxima. Decimal→number só aqui, na borda do DTO.
 */
export async function listarContasAVencer(hoje: Date): Promise<ContasAVencerDTO> {
  const hojeISO = iso(hoje);
  const inicioHoje = new Date(Date.parse(hojeISO)); // UTC meia-noite de hoje
  const limite = new Date(inicioHoje.getTime() + 7 * MS_DIA); // hoje + 7 dias (D7 inclusive)

  const rows = await prisma.lancamento.findMany({
    where: {
      situacao: "ABERTO",
      estornado: false,
      natureza: "DEBITO",
      dataVencimento: { lte: limite },
    },
    include: {
      categoria: { select: { nome: true } },
      clienteFornecedor: { select: { nome: true } },
    },
    // asc por vencimento: vencidas mais antigas (mais atrasadas) primeiro; a
    // vencer, as mais próximas primeiro. Serve os dois grupos de uma vez.
    orderBy: [{ dataVencimento: "asc" }, { id: "asc" }],
  });

  const dto: ContasAVencerDTO = {
    hoje: hojeISO,
    vencidas: [],
    venceHoje: [],
    proximos3: [],
    proximos7: [],
    totais: { vencidasValor: 0, vencidasQtd: 0, aVencer7Valor: 0, aVencer7Qtd: 0 },
  };

  for (const r of rows) {
    const dataVenc = iso(r.dataVencimento);
    const item: ContaAVencerItem = {
      id: r.id,
      descricao: r.descricao ?? null,
      fornecedorNome: r.clienteFornecedor?.nome ?? null,
      categoriaNome: r.categoria.nome,
      valor: Number(r.valor),
      dataVencimento: dataVenc,
      diasAtraso: -diffDias(hojeISO, dataVenc), // >0 vencida, <=0 a vencer
    };
    switch (classificarVencimento(dataVenc, hojeISO)) {
      case "VENCIDA":
        dto.vencidas.push(item);
        break;
      case "HOJE":
        dto.venceHoje.push(item);
        break;
      case "D3":
        dto.proximos3.push(item);
        break;
      case "D7":
        dto.proximos7.push(item);
        break;
      // FUTURO não ocorre — filtrado por dataVencimento <= hoje+7.
    }
  }

  dto.totais.vencidasQtd = dto.vencidas.length;
  dto.totais.vencidasValor = round2(dto.vencidas.reduce((s, i) => s + i.valor, 0));
  const aVencer = [...dto.venceHoje, ...dto.proximos3, ...dto.proximos7];
  dto.totais.aVencer7Qtd = aVencer.length;
  dto.totais.aVencer7Valor = round2(aVencer.reduce((s, i) => s + i.valor, 0));

  return dto;
}

// Marcar uma conta a vencer como PAGA direto do card — vira LIQUIDADO com
// dataLiquidacao. Respeita FechamentoMensal sobre a data de liquidação (mesma
// regra da criação em confirmarPendente). Não mexe em lançamento estornado nem
// re-liquida o que já está pago.
export type ResultadoLiquidacao =
  | { ok: true; id: number; dataLiquidacao: string }
  | { ok: false; codigo: "NAO_ENCONTRADA" }
  | { ok: false; codigo: "JA_LIQUIDADA" }
  | { ok: false; codigo: "MES_FECHADO"; ano: number; mes: number };

export async function liquidarConta(id: number, dataLiq: Date): Promise<ResultadoLiquidacao> {
  const lanc = await prisma.lancamento.findUnique({ where: { id } });
  if (!lanc || lanc.estornado) return { ok: false, codigo: "NAO_ENCONTRADA" };
  if (lanc.situacao === "LIQUIDADO") return { ok: false, codigo: "JA_LIQUIDADA" };
  try {
    await assertMesAberto(dataLiq);
  } catch (e) {
    if (e instanceof FechamentoMensalError) return { ok: false, codigo: "MES_FECHADO", ano: e.ano, mes: e.mes };
    throw e;
  }
  await prisma.lancamento.update({
    where: { id },
    data: { situacao: "LIQUIDADO", dataLiquidacao: dataLiq },
  });
  return { ok: true, id, dataLiquidacao: dataLiq.toISOString().slice(0, 10) };
}
