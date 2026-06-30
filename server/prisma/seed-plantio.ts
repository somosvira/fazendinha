// Seed de DEMONSTRAÇÃO do Plantio (café arábica): 15 talhões + 6 lavouras +
// 5 planos de adubação + variedades distintas. Idempotente (upsert por chave
// natural — pode rodar N vezes sem crashar em unique-constraint).
//
// A fonte dos dados é o próprio mock do módulo (server/src/services/plantio/mock.ts),
// que segue sendo o dataset de demonstração — importado aqui para não duplicar.
//
//   pnpm --filter rionovo-server run seed:plantio

import { PrismaClient } from "@prisma/client";
import { talhoes, resumos, lavouras, planosAdubacao, eventos } from "../src/services/plantio/mock.js";

const prisma = new PrismaClient();

// Cultivares resistentes à ferrugem (Hemileia vastatrix) — Embrapa/Procafé.
const RESISTENTE = /Acauã|Arara|Icatu|Catucaí|Paraíso|Asa Branca/i;

async function main() {
  // 1) Planos de adubação — upsert por nome.
  for (const p of planosAdubacao) {
    const data = { descricao: p.descricao, nKgHa: p.nKgHa, p2o5KgHa: p.p2o5KgHa, k2oKgHa: p.k2oKgHa, parcelas: p.parcelas, ativo: true };
    await prisma.planoAdubacao.upsert({ where: { nome: p.nome }, update: data, create: { nome: p.nome, ...data } });
  }

  // 2) Variedades — uma por nome distinto de talhao.variedade.
  const variedadeNomes = [...new Set(talhoes.map((t) => t.variedade))];
  const variedadeIdByNome: Record<string, number> = {};
  for (const nome of variedadeNomes) {
    const resistenteFerrugem = RESISTENTE.test(nome);
    const row = await prisma.variedadeCafe.upsert({ where: { nome }, update: { resistenteFerrugem }, create: { nome, resistenteFerrugem } });
    variedadeIdByNome[nome] = row.id;
  }

  // 3) Lavouras — upsert por nome, ligando ao plano de adubação por nome.
  for (const l of lavouras) {
    const planoAdubacaoId = l.planoAdubacaoNome
      ? (await prisma.planoAdubacao.findUnique({ where: { nome: l.planoAdubacaoNome } }))?.id ?? null
      : null;
    await prisma.lavoura.upsert({ where: { nome: l.nome }, update: { planoAdubacaoId }, create: { nome: l.nome, planoAdubacaoId } });
  }

  // 4) Talhões — upsert por codigo. Resolve variedadeId e lavouraId por nome.
  const lavouraIdByNome: Record<string, number> = {};
  for (const l of await prisma.lavoura.findMany({ select: { id: true, nome: true } })) lavouraIdByNome[l.nome] = l.id;

  const talhaoIdByMockId: Record<string, number> = {};
  for (const t of talhoes) {
    const data = {
      nome: t.nome,
      variedadeId: variedadeIdByNome[t.variedade],
      lavouraId: lavouraIdByNome[t.lavoura] ?? null,
      espacamento: t.espacamento,
      plantasHa: t.plantasHa,
      areaHa: t.areaHa,
      anoPlantio: t.anoPlantio,
      altitude: t.altitude,
      exposicao: t.exposicao ?? null,
      declive: t.declive ?? null,
      irrigado: t.irrigado,
      estado: t.estado,
      dataPlantio: new Date(t.dataPlantio),
      ultimaRecepa: t.ultimaRecepa ? new Date(t.ultimaRecepa) : null,
      observacao: t.observacao ?? null,
    };
    const row = await prisma.talhao.upsert({ where: { codigo: t.codigo }, update: data, create: { codigo: t.codigo, ...data } });
    talhaoIdByMockId[t.id] = row.id;
  }

  // 5) Resumos — upsert por talhaoId (Int real). O resumo do mock referencia o
  // id string ("T-001"); mapeamos via talhaoIdByMockId. Campo enchimentoFruto
  // do mock NÃO existe no schema — ignorado.
  for (const r of resumos) {
    const talhaoId = talhaoIdByMockId[r.talhaoId];
    if (talhaoId == null) continue;
    const data = {
      fase: r.fase,
      diasNaFase: r.diasNaFase ?? null,
      proximaOperacao: r.proximaOperacao ?? null,
      proximaOperacaoEm: r.proximaOperacaoEm ? new Date(r.proximaOperacaoEm) : null,
      produtividadeEsperada: r.produtividadeEsperada ?? null,
      produtividadeUltima: r.produtividadeUltima ?? null,
      bienalidade: r.bienalidade ?? null,
      maturacaoCereja: r.maturacaoCereja ?? null,
      maturacaoVerde: r.maturacaoVerde ?? null,
      maturacaoBoia: r.maturacaoBoia ?? null,
      ferrugem: r.ferrugem ?? null,
      bichoMineiro: r.bichoMineiro ?? null,
      broca: r.broca ?? null,
      cercosporiose: r.cercosporiose ?? null,
      tendFerrugem: r.tendFerrugem ?? null,
      ultimaInspecaoData: r.ultimaInspecaoData ? new Date(r.ultimaInspecaoData) : null,
      ultimaAnaliseSolo: r.ultimaAnaliseSolo ? new Date(r.ultimaAnaliseSolo) : null,
      pH: r.pH ?? null,
      v: r.v ?? null,
      mo: r.mo ?? null,
      fosforo: r.fosforo ?? null,
      potassio: r.potassio ?? null,
      ultimaAnaliseFoliar: r.ultimaAnaliseFoliar ? new Date(r.ultimaAnaliseFoliar) : null,
      nFoliar: r.nFoliar ?? null,
      kFoliar: r.kFoliar ?? null,
    };
    await prisma.resumoTalhao.upsert({ where: { talhaoId }, update: data, create: { talhaoId, ...data } });
  }

  // 6) Eventos estruturados (Fatia P2) — converte o mock editorial `eventos` nas
  //    5 tabelas de fato. Idempotente: limpa os fatos dos talhões semeados antes
  //    de recriar. Mapeamento por melhor-encaixe (ver regras P2).
  const talhaoIds = Object.values(talhaoIdByMockId);
  await prisma.passadaColheita.deleteMany({ where: { talhaoId: { in: talhaoIds } } });
  await prisma.operacaoAgricola.deleteMany({ where: { talhaoId: { in: talhaoIds } } });
  await prisma.inspecaoMIP.deleteMany({ where: { talhaoId: { in: talhaoIds } } });
  await prisma.amostraSolo.deleteMany({ where: { talhaoId: { in: talhaoIds } } });
  await prisma.amostraFoliar.deleteMany({ where: { talhaoId: { in: talhaoIds } } });

  const contagem = { operacoes: 0, inspecoes: 0, solo: 0, foliar: 0, passadas: 0 };

  // Extrai "≈ 38 sc" do impacto, "18.420 L" / "14.200 L" do detalhe e
  // "480 L/sc" do detalhe. Defaults sensatos quando ausente (litros é NOT NULL).
  const parseSacas = (s?: string) => {
    const m = s?.match(/≈?\s*(\d+(?:[.,]\d+)?)\s*sc/i);
    return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
  };
  const parseLitros = (s?: string) => {
    const m = s?.match(/([\d.]+)\s*L\b(?!\/)/i);
    return m ? Number(m[1].replace(/\./g, "")) : 0;
  };
  const parseRendimento = (s?: string) => {
    const m = s?.match(/(\d+(?:[.,]\d+)?)\s*L\/sc/i);
    return m ? Number(m[1].replace(",", ".")) : 480;
  };
  const parseNumeroPassada = (titulo: string) => {
    const m = titulo.match(/(\d+)ª\s*passada/i);
    return m ? Number(m[1]) : 1;
  };

  for (const ev of eventos) {
    const talhaoId = talhaoIdByMockId[ev.talhaoId];
    if (talhaoId == null) continue;
    const data = new Date(ev.data);
    const responsavel = ev.responsavel ?? null;
    const observacao = ev.detalhe ?? null;
    const t = ev.titulo;

    if (ev.dominio === "nutricao") {
      if (/análise foliar|foliar/i.test(t)) {
        await prisma.amostraFoliar.create({ data: { talhaoId, data, observacao } });
        contagem.foliar++;
      } else if (/análise solo|solo/i.test(t)) {
        await prisma.amostraSolo.create({ data: { talhaoId, data, observacao } });
        contagem.solo++;
      } else if (/aduba/i.test(t)) {
        const tipo = /foliar/i.test(t) ? "ADUBACAO_FOLIAR" : "ADUBACAO_SOLO";
        await prisma.operacaoAgricola.create({
          data: { talhaoId, dominio: "NUTRICAO", tipo, data, responsavel, produto: ev.detalhe ?? null, observacao },
        });
        contagem.operacoes++;
      }
    } else if (ev.dominio === "fitossanidade") {
      if (/monitora|inspe|mip/i.test(t)) {
        await prisma.inspecaoMIP.create({ data: { talhaoId, data, responsavel, observacao } });
        contagem.inspecoes++;
      } else if (/aplica|fungicida|inseticida|herbicida/i.test(t)) {
        const tipo = /herbicida/i.test(t)
          ? "APLICACAO_HERBICIDA"
          : /inseticida/i.test(t)
            ? "APLICACAO_INSETICIDA"
            : "APLICACAO_FUNGICIDA";
        await prisma.operacaoAgricola.create({
          data: { talhaoId, dominio: "FITOSSANIDADE", tipo, data, responsavel, produto: ev.detalhe ?? null, observacao },
        });
        contagem.operacoes++;
      }
    } else if (ev.dominio === "colheita") {
      if (/passada|derriça|derrica|colheita/i.test(t)) {
        const numero = parseNumeroPassada(t);
        const metodo = /mecaniz/i.test(t)
          ? "DERRICA_MECANIZADA"
          : /seletiv/i.test(t)
            ? "SELETIVA"
            : "DERRICA_PANO";
        const litrosCereja = parseLitros(ev.detalhe);
        const rendimentoLPorSc = parseRendimento(ev.detalhe);
        const sacasBeneficiadas = parseSacas(ev.impacto);
        await prisma.passadaColheita.create({
          data: { talhaoId, numero, data, metodo, litrosCereja, rendimentoLPorSc, sacasBeneficiadas, responsavel, observacao },
        });
        contagem.passadas++;
      }
    } else if (ev.dominio === "fenologia") {
      if (/recepa|desbrota|poda/i.test(t)) {
        const tipo = /recepa/i.test(t) ? "PODA_RECEPA" : /desbrota/i.test(t) ? "DESBROTA" : "PODA_DESPONTE";
        await prisma.operacaoAgricola.create({
          data: { talhaoId, dominio: "FENOLOGIA", tipo, data, responsavel, observacao },
        });
        contagem.operacoes++;
      }
      // florada/maturação sem poda/recepa/desbrota → fase fenológica, sem fato estruturado (skip).
    }
  }

  console.log(`Seed plantio ok: ${planosAdubacao.length} planos, ${variedadeNomes.length} variedades, ${lavouras.length} lavouras, ${talhoes.length} talhões, ${resumos.length} resumos.`);
  console.log(`Eventos estruturados: ${contagem.operacoes} operações, ${contagem.inspecoes} inspeções MIP, ${contagem.solo} análises solo, ${contagem.foliar} análises foliar, ${contagem.passadas} passadas colheita.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
