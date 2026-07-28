// Reconciliação da reprodução importada contra o baseline do IDEAGRI
// (DADOS777.FDB, backup 2026-07-28 12:48). Baseline colado da fonte — não embutido
// em código de produção. Roda: node --env-file=.env scripts/reconciliar-ideagri.mts
import { readFileSync } from "node:fs";
import { prisma } from "../src/db.js";
import { reconciliarContagens, haDivergencia } from "../src/services/rebanho/reconciliacao-reproducao.calc.js";

// Baseline por tipo de evento, levantado no IDEAGRI (backup 2026-07-28).
const BASELINE_EVENTOS: Record<string, number> = {
  INSEMINACAO: 837,
  COBERTURA: 61,
  TRANSFERENCIA_EMBRIAO: 146,
  DIAGNOSTICO: 1843,
  PARTO: 353,
};

// Baseline por bloco (contagens de catálogo/estrutura confirmadas na fonte).
const BASELINE_BLOCOS: Record<string, number> = {
  ProtocoloIATF: 5,
  PrincipioProtocoloIATF: 31,
  ProgramacaoIATFLote: 75,
  AplicacaoProtocoloIATF: 469,
  ResultadoGinecologico: 44,
  Reprodutor: 67,
  IndicadorGenetico: 271,
  Marcador: 20,
  Caseina: 15,
  TipoSemen: 3,
  EmbriaoClassificacao: 6,
  Coleta: 7,
};

const dadosFonte = JSON.parse(
  readFileSync(new URL("../prisma/rebanho_real.json", import.meta.url), "utf8"),
) as { resultadosGinecologicos?: Array<{ codigo: number }> };
const codigosGinecologicosFonte =
  dadosFonte.resultadosGinecologicos?.map((resultado) => resultado.codigo) ?? [];

async function main() {
  // O baseline é da fonte IDEAGRI; restringir o observado à mesma população.
  // contarEventosPorTipo(null) incluiria lançamentos manuais sem ideagriId.
  const eventosAgrupados = await prisma.eventoReprodutivo.groupBy({
    by: ["tipo"],
    where: { ideagriId: { not: null } },
    _count: { _all: true },
  });
  const eventos = Object.fromEntries(
    eventosAgrupados.map((linha) => [linha.tipo, linha._count._all]),
  );
  const linhasEventos = reconciliarContagens(eventos, BASELINE_EVENTOS);

  console.log("=== Reconciliação de EVENTOS por tipo ===");
  for (const l of linhasEventos) {
    const flag = l.divergencia === 0 ? "OK " : "!! ";
    console.log(`${flag}${l.chave.padEnd(24)} obs=${String(l.observado).padStart(5)} base=${String(l.baseline).padStart(5)} div=${l.divergencia}`);
  }

  const observadoBlocos: Record<string, number> = {
    ProtocoloIATF: await prisma.protocoloIATF.count({ where: { ideagriId: { not: null } } }),
    PrincipioProtocoloIATF: await prisma.principioProtocoloIATF.count({
      where: { protocolo: { ideagriId: { not: null } } },
    }),
    ProgramacaoIATFLote: await prisma.programacaoIATFLote.count({ where: { ideagriId: { not: null } } }),
    AplicacaoProtocoloIATF: await prisma.aplicacaoProtocoloIATF.count({ where: { ideagriId: { not: null } } }),
    // O dicionário usa o próprio código oficial como identidade; limitar aos códigos do dump.
    ResultadoGinecologico: await prisma.resultadoExameGinecologico.count({
      where: { codigo: { in: codigosGinecologicosFonte } },
    }),
    Reprodutor: await prisma.reprodutor.count({ where: { ideagriId: { not: null } } }),
    IndicadorGenetico: await prisma.indicadorGenetico.count({ where: { ideagriId: { not: null } } }),
    Marcador: await prisma.marcadorGenetico.count({ where: { ideagriId: { not: null } } }),
    Caseina: await prisma.caseina.count({ where: { ideagriId: { not: null } } }),
    TipoSemen: await prisma.tipoSemen.count({ where: { ideagriId: { not: null } } }),
    EmbriaoClassificacao: await prisma.embriaoClassificacao.count({ where: { ideagriId: { not: null } } }),
    Coleta: await prisma.coleta.count({ where: { ideagriId: { not: null } } }),
  };
  const linhasBlocos = reconciliarContagens(observadoBlocos, BASELINE_BLOCOS);

  console.log("\n=== Reconciliação de BLOCOS (catálogos/estrutura) ===");
  for (const l of linhasBlocos) {
    const flag = l.divergencia === 0 ? "OK " : "!! ";
    console.log(`${flag}${l.chave.padEnd(24)} obs=${String(l.observado).padStart(5)} base=${String(l.baseline).padStart(5)} div=${l.divergencia}`);
  }

  const falhou = haDivergencia(linhasEventos) || haDivergencia(linhasBlocos);
  console.log(`\nRESULTADO: ${falhou ? "DIVERGÊNCIA — reprova" : "SEM DIVERGÊNCIA — aprovado"}`);
  await prisma.$disconnect();
  process.exit(falhou ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(2); });
