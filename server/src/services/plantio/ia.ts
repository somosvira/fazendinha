// Orquestrador da IA da lavoura: busca dados reais → monta contexto → responde.
// Espelha rebanho/ia.ts. Com ANTHROPIC_API_KEY chama Claude (modo IA); sem ela
// (ou em falha) responde por regras (modo demonstração). Nunca lança por rede.

import { prisma } from "../../db.js";
import { env } from "../../env.js";
import { agregarCustoPlantio } from "./custo.js";
import {
  montarContextoPlantio,
  contextoPlantioParaTexto,
  type TalhaoCtx,
  type CustoCtx,
  type ColheitaCtx,
  type EstoqueBaixoCtx,
} from "./ia.context.js";
import { responderDemo, type RespostaIA } from "./ia.responder.js";
import { responderComLLM } from "./ia.llm.js";
import { listarEstoquePlantio } from "./estoque.js";

// "Hoje" da lavoura — ancorado no mock (28/05/2026), igual ao dashboard real.
const HOJE = "2026-05-28";

const isoOrNull = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const numOrNull = (v: any) => (v == null ? null : Number(v));

async function carregarTalhoes(): Promise<TalhaoCtx[]> {
  const rows = await prisma.talhao.findMany({
    where: { estado: "ATIVO" },
    include: { variedade: true, resumo: true },
    orderBy: { codigo: "asc" },
  });
  return rows.map((t) => ({
    codigo: t.codigo,
    nome: t.nome ?? null,
    variedade: t.variedade?.nome ?? null,
    areaHa: Number(t.areaHa),
    fase: t.resumo?.fase ?? "REPOUSO",
    maturacaoCereja: numOrNull(t.resumo?.maturacaoCereja),
    produtividadeEsperada: numOrNull(t.resumo?.produtividadeEsperada),
    ferrugem: numOrNull(t.resumo?.ferrugem),
    broca: numOrNull(t.resumo?.broca),
    tendFerrugem: t.resumo?.tendFerrugem ?? null,
    pH: numOrNull(t.resumo?.pH),
    v: numOrNull(t.resumo?.v),
    potassio: numOrNull(t.resumo?.potassio),
    ultimaInspecao: isoOrNull(t.resumo?.ultimaInspecaoData),
    ultimaAnaliseFoliar: isoOrNull(t.resumo?.ultimaAnaliseFoliar),
    ultimaAnaliseSolo: isoOrNull(t.resumo?.ultimaAnaliseSolo),
  }));
}

async function carregarColheita(): Promise<ColheitaCtx> {
  const ano = Number(HOJE.slice(0, 4));
  const passadas = await prisma.passadaColheita.findMany({
    where: { data: { gte: new Date(Date.UTC(ano, 0, 1)), lt: new Date(Date.UTC(ano + 1, 0, 1)) } },
    select: { sacasBeneficiadas: true },
  });
  const sacas = passadas.reduce((s, p) => s + (p.sacasBeneficiadas != null ? Number(p.sacasBeneficiadas) : 0), 0);
  return { passadas: passadas.length, sacasBeneficiadas: Math.round(sacas * 100) / 100 };
}

async function carregarEstoqueBaixo(): Promise<EstoqueBaixoCtx[]> {
  const saldos = await listarEstoquePlantio();
  return saldos
    .filter((s) => s.abaixoMinimo)
    .map((s) => ({ nome: s.nome, saldo: s.saldo, unidade: s.unidade, minimoEstoque: s.minimoEstoque }));
}

export async function responderIA(pergunta: string): Promise<RespostaIA> {
  const [talhoes, custoRaw, colheita, estoqueBaixo] = await Promise.all([
    carregarTalhoes(),
    agregarCustoPlantio(12),
    carregarColheita(),
    carregarEstoqueBaixo(),
  ]);

  const custo: CustoCtx = {
    custoSaca: custoRaw.custoSaca,
    custoHa: custoRaw.custoHa,
    custeioTotal: custoRaw.custeioTotal,
    investimentoTotal: custoRaw.investimentoTotal,
    sacasPeriodo: custoRaw.sacasPeriodo,
    periodoMeses: custoRaw.periodoMeses,
    breakdown: custoRaw.breakdown,
  };

  const ctx = montarContextoPlantio(talhoes, custo, colheita, estoqueBaixo, HOJE);

  if (env.ANTHROPIC_API_KEY) {
    try {
      const resposta = await responderComLLM(pergunta, contextoPlantioParaTexto(ctx), env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
      return { resposta, modo: "ia" };
    } catch {
      // cai pro demo (nunca quebra por causa de rede/credencial)
    }
  }
  return responderDemo(pergunta, ctx);
}
