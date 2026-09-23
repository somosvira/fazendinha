// Seed de DEMONSTRAÇÃO do Plantio (café arábica): 15 talhões + 6 lavouras +
// 5 planos de adubação + variedades distintas. Idempotente (upsert por chave
// natural — pode rodar N vezes sem crashar em unique-constraint).
//
// A fonte dos dados é o próprio mock do módulo (server/src/services/plantio/mock.ts),
// que segue sendo o dataset de demonstração — importado aqui para não duplicar.
//
//   pnpm --filter rionovo-server run seed:plantio

import { prisma } from "../src/db.js";
import { talhoes, resumos, lavouras, planosAdubacao, eventos } from "../src/services/plantio/mock.js";
import { CENTROS_ATIVIDADE } from "../src/services/estoque/centros-atividade.js";

// Cultivares resistentes à ferrugem (Hemileia vastatrix) — Embrapa/Procafé.
const RESISTENTE = /Acauã|Arara|Icatu|Catucaí|Paraíso|Asa Branca/i;

// Insumos da lavoura (café arábica, fazenda ~80 ha Sul de Minas) — viram Produto
// com `subtipoPlantio` preenchido (null no rebanho). Espelha o SALDOS estático da
// EstoqueTab: `saldoInicial` vira uma ENTRADA, e o valor exibido = saldo × custo.
// Custos atualizados Mar/2026. minimo=null → produto sem mínimo (ex.: mudas).
const INSUMOS_PLANTIO = [
  { nome: "Sulfato de amônio 21% N",        subtipo: "FERTILIZANTE", unidade: "kg", custo: 3.0,   minimo: 2_000, saldoInicial: 4_800 },
  { nome: "Cloreto de potássio 60% K₂O",    subtipo: "FERTILIZANTE", unidade: "kg", custo: 4.6,   minimo: 2_500, saldoInicial: 2_200 },
  { nome: "Ureia 46% N",                    subtipo: "FERTILIZANTE", unidade: "kg", custo: 4.5,   minimo: 1_500, saldoInicial: 1_900 },
  { nome: "Formulado 20-00-20",             subtipo: "FERTILIZANTE", unidade: "kg", custo: 4.0,   minimo: 2_000, saldoInicial: 3_400 },
  { nome: "MAP 11-52-00",                   subtipo: "FERTILIZANTE", unidade: "kg", custo: 5.5,   minimo: 1_000, saldoInicial: 900 },
  { nome: "Calcário dolomítico PRNT 85%",   subtipo: "CORRETIVO",    unidade: "kg", custo: 0.3,   minimo: 8_000, saldoInicial: 18_000 },
  { nome: "Gesso agrícola",                 subtipo: "CORRETIVO",    unidade: "kg", custo: 0.35,  minimo: 3_000, saldoInicial: 6_500 },
  { nome: "Oxicloreto de cobre (Recop)",    subtipo: "DEFENSIVO",    unidade: "kg", custo: 26.0,  minimo: 100,   saldoInicial: 140 },
  { nome: "Ciproconazol + Trifloxistrobina (Priori Xtra)", subtipo: "DEFENSIVO", unidade: "L", custo: 290.0, minimo: 20, saldoInicial: 28 },
  { nome: "Epoxiconazol + Piraclostrobina (Opera)",        subtipo: "DEFENSIVO", unidade: "L", custo: 290.0, minimo: 15, saldoInicial: 18 },
  { nome: "Tiametoxam (Actara)",            subtipo: "DEFENSIVO",    unidade: "kg", custo: 600.0, minimo: 8,     saldoInicial: 6.5 },
  { nome: "Endossulfan (broca)",            subtipo: "DEFENSIVO",    unidade: "L",  custo: 45.0,  minimo: null,  saldoInicial: 0 },
  { nome: "Glifosato 480 g/L",              subtipo: "HERBICIDA",    unidade: "L",  custo: 36.0,  minimo: 30,    saldoInicial: 52 },
  { nome: "Beauveria bassiana (biológico)", subtipo: "BIOLOGICO",    unidade: "kg", custo: 110.0, minimo: 10,    saldoInicial: 14 },
  { nome: "Foliar Zn + B (Stoller)",        subtipo: "FOLIAR",       unidade: "L",  custo: 70.0,  minimo: 25,    saldoInicial: 32 },
  { nome: "Mudas Catuaí Amarelo IAC 144",   subtipo: "MUDA",         unidade: "un", custo: 1.5,   minimo: null,  saldoInicial: 480 },
] as const;

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

  // 7) Camada operacional Ideagri (Fatia P3) — Safra + Tarefas (planejado×realizado)
  //    + Apontamentos hora-máquina/hora-homem. Idempotente: upsert da Safra por nome,
  //    e deleteMany das tarefas/apontamentos dessa safra antes de recriar.
  const centroCustoCafe = await prisma.centroCusto.findFirst({ where: { nome: CENTROS_ATIVIDADE.CAFE }, select: { id: true } });
  const safra = await prisma.safra.upsert({
    where: { nome: "Safra 2026" },
    update: { dataInicio: new Date("2025-07-01"), dataFim: new Date("2026-06-30"), centroCustoId: centroCustoCafe?.id ?? null },
    create: { nome: "Safra 2026", dataInicio: new Date("2025-07-01"), dataFim: new Date("2026-06-30"), centroCustoId: centroCustoCafe?.id ?? null },
  });

  // Limpa fatos da safra antes de recriar (idempotência).
  await prisma.tarefaAgricola.deleteMany({ where: { safraId: safra.id } });
  await prisma.apontamentoMaquina.deleteMany({ where: { safraId: safra.id } });

  // Resolve talhões reais por código (CAF-01 / TIJ-01) — algumas tarefas são por talhão.
  const idCAF01 = (await prisma.talhao.findUnique({ where: { codigo: "CAF-01" }, select: { id: true } }))?.id ?? null;
  const idTIJ01 = (await prisma.talhao.findUnique({ where: { codigo: "TIJ-01" }, select: { id: true } }))?.id ?? null;

  // Calendário cafeeiro realista: calagem → 3 parcelas de adubação de cobertura →
  // 2 aplicações de fungicida (ferrugem) → colheita. Algumas já realizadas (CONCLUIDA).
  const tarefasSeed = [
    { tipo: "CALAGEM" as const, descricao: "Calagem de correção (calcário dolomítico)", responsavel: "Equipe de campo", produto: "Calcário dolomítico", unidade: "t/ha",
      qtdHaPrev: 2.0, qtdTotalPrev: 30, dataPrevista: "2025-07-15", custoPrev: 4500,
      talhaoId: null, real: { qtdHaReal: 2.1, qtdTotalReal: 31.5, dataRealizada: "2025-07-18", custoReal: 4720, status: "CONCLUIDA" as const } },
    { tipo: "ADUBACAO_SOLO" as const, descricao: "Adubação de cobertura — 1ª parcela", responsavel: "Equipe de campo", produto: "20-00-20", unidade: "kg/ha",
      qtdHaPrev: 350, qtdTotalPrev: 5250, dataPrevista: "2025-09-20", custoPrev: 12600,
      talhaoId: null, real: { qtdHaReal: 350, qtdTotalReal: 5250, dataRealizada: "2025-09-22", custoReal: 12900, status: "CONCLUIDA" as const } },
    { tipo: "ADUBACAO_SOLO" as const, descricao: "Adubação de cobertura — 2ª parcela", responsavel: "Equipe de campo", produto: "20-00-20", unidade: "kg/ha",
      qtdHaPrev: 350, qtdTotalPrev: 5250, dataPrevista: "2025-12-10", custoPrev: 12600,
      talhaoId: null, real: { qtdHaReal: 340, qtdTotalReal: 5100, dataRealizada: "2025-12-14", custoReal: 12400, status: "CONCLUIDA" as const } },
    { tipo: "ADUBACAO_SOLO" as const, descricao: "Adubação de cobertura — 3ª parcela", responsavel: "Equipe de campo", produto: "20-05-20", unidade: "kg/ha",
      qtdHaPrev: 300, qtdTotalPrev: 4500, dataPrevista: "2026-02-15", custoPrev: 11200,
      talhaoId: null, real: null },
    { tipo: "APLICACAO_FUNGICIDA" as const, descricao: "Aplicação fungicida ferrugem — 1ª", responsavel: "Operador de pulverizador", produto: "Triazol + Estrobilurina", unidade: "L/ha",
      qtdHaPrev: 1.5, qtdTotalPrev: 6.3, dataPrevista: "2025-11-05", custoPrev: 3200,
      talhaoId: idCAF01, real: { qtdHaReal: 1.5, qtdTotalReal: 6.3, dataRealizada: "2025-11-06", custoReal: 3350, status: "CONCLUIDA" as const } },
    { tipo: "APLICACAO_FUNGICIDA" as const, descricao: "Aplicação fungicida ferrugem — 2ª", responsavel: "Operador de pulverizador", produto: "Triazol + Estrobilurina", unidade: "L/ha",
      qtdHaPrev: 1.5, qtdTotalPrev: 7.65, dataPrevista: "2026-01-20", custoPrev: 3900,
      talhaoId: idTIJ01, real: null },
    { tipo: "PODA_DESPONTE" as const, descricao: "Colheita Safra 2026 (derriça)", responsavel: "Equipe de colheita", produto: null, unidade: "sc",
      qtdHaPrev: 38, qtdTotalPrev: 1900, dataPrevista: "2026-06-01", custoPrev: 38000,
      talhaoId: null, real: null },
  ];

  for (const t of tarefasSeed) {
    await prisma.tarefaAgricola.create({
      data: {
        safraId: safra.id,
        talhaoId: t.talhaoId,
        tipo: t.tipo,
        descricao: t.descricao,
        responsavel: t.responsavel,
        produto: t.produto,
        unidade: t.unidade,
        qtdHaPrev: t.qtdHaPrev,
        qtdTotalPrev: t.qtdTotalPrev,
        dataPrevista: new Date(t.dataPrevista),
        custoPrev: t.custoPrev,
        qtdHaReal: t.real?.qtdHaReal ?? null,
        qtdTotalReal: t.real?.qtdTotalReal ?? null,
        dataRealizada: t.real?.dataRealizada ? new Date(t.real.dataRealizada) : null,
        custoReal: t.real?.custoReal ?? null,
        status: t.real?.status ?? "PLANEJADA",
      },
    });
  }

  // 4 apontamentos: 2 hora-máquina (trator + pulverizador) + 2 hora-homem (equipe).
  const apontamentosSeed = [
    { tipo: "MAQUINA" as const, recurso: "Trator Massey 275", operador: "José", implemento: "Distribuidor de calcário", data: "2025-07-18", horas: 12, valorHora: 95, talhaoId: null },
    { tipo: "MAQUINA" as const, recurso: "Pulverizador", operador: "Pedro", implemento: "Pulverizador tratorizado", data: "2025-11-06", horas: 5.5, valorHora: 110, talhaoId: idCAF01 },
    { tipo: "HOMEM" as const, recurso: "Equipe de campo", operador: null, implemento: null, data: "2025-09-22", horas: 48, valorHora: 18, talhaoId: null },
    { tipo: "HOMEM" as const, recurso: "Equipe de campo", operador: null, implemento: null, data: "2025-12-14", horas: 40, valorHora: 18, talhaoId: null },
  ];

  for (const a of apontamentosSeed) {
    await prisma.apontamentoMaquina.create({
      data: {
        safraId: safra.id,
        talhaoId: a.talhaoId,
        data: new Date(a.data),
        tipo: a.tipo,
        recurso: a.recurso,
        operador: a.operador,
        implemento: a.implemento,
        horas: a.horas,
        valorHora: a.valorHora,
        valorTotal: a.horas * a.valorHora,
      },
    });
  }

  console.log(`Camada operacional Ideagri: 1 safra ("${safra.nome}"), ${tarefasSeed.length} tarefas, ${apontamentosSeed.length} apontamentos.`);

  // 8) Estoque de insumos da lavoura — Produto (subtipoPlantio) + uma ENTRADA de
  //    saldo inicial por produto. Idempotente: upsert por nome; recria os
  //    movimentos só dos produtos do Plantio (não toca no estoque do rebanho).
  //    Liga ao CentroCusto "Plantio Café" quando existe (mesma ponte contábil
  //    usada pelo seed do rebanho).
  const ccCafeId = (await prisma.centroCusto.findFirst({ where: { nome: CENTROS_ATIVIDADE.CAFE }, select: { id: true } }))?.id ?? null;

  // Data recente fixa para a ENTRADA inicial (mês não fechado — fora do range de fechamentos).
  const dataEntradaInicial = new Date("2026-03-15");

  const insumoIds: number[] = [];
  for (const ins of INSUMOS_PLANTIO) {
    const data = {
      tipo: "INSUMO" as const,
      subtipoPlantio: ins.subtipo,
      unidade: ins.unidade,
      custoUnitario: ins.custo,
      minimoEstoque: ins.minimo,
      estocavel: true,
      ativo: true,
    };
    const row = await prisma.produto.upsert({
      where: { nome: ins.nome },
      update: { ...data, ...(ccCafeId != null ? { centrosCusto: { deleteMany: {}, create: [{ centroCustoId: ccCafeId }] } } : {}) },
      create: { nome: ins.nome, ...data, ...(ccCafeId != null ? { centrosCusto: { create: [{ centroCustoId: ccCafeId }] } } : {}) },
    });
    insumoIds.push(row.id);
  }

  // Recria APENAS os movimentos de seed (observacao = "Saldo inicial (seed Plantio)").
  // Preserva entradas/saídas/ajustes manuais registrados depois pela UI — re-rodar
  // a seed não deve destruir histórico operacional. Idempotente.
  const OBS_SEED = "Saldo inicial (seed Plantio)";
  await prisma.movimentoEstoque.deleteMany({
    where: { produtoId: { in: insumoIds }, observacao: OBS_SEED },
  });

  let entradasCriadas = 0;
  for (const ins of INSUMOS_PLANTIO) {
    if (ins.saldoInicial <= 0) continue; // sem saldo inicial (ex.: Endossulfan zerado) → sem ENTRADA
    const produto = await prisma.produto.findUnique({ where: { nome: ins.nome }, select: { id: true } });
    if (!produto) continue;
    const valorTotal = Math.round(ins.saldoInicial * ins.custo * 100) / 100;
    await prisma.movimentoEstoque.create({
      data: {
        produtoId: produto.id,
        tipo: "ENTRADA",
        origem: "INVENTARIO_INICIAL",
        data: dataEntradaInicial,
        quantidade: ins.saldoInicial,
        custoUnitario: ins.custo,
        valorTotal,
        observacao: OBS_SEED,
      },
    });
    entradasCriadas++;
  }

  console.log(`Estoque Plantio: ${INSUMOS_PLANTIO.length} insumos (subtipoPlantio), ${entradasCriadas} entradas de saldo inicial.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
