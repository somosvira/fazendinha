// Seed dos DOIS PLANTIOS REAIS da Fazenda Rio Novo (colhidos na visita técnica).
// Diferente de seed-plantio.ts (demonstração, 15 talhões fictícios ~80 ha), este
// popula a REALIDADE da fazenda:
//
//   • CAFÉ  — ~28.000 pés, café adensado, colhido 1×/ano à mão (~2 meses).
//   • MILHO — ~100 ha em arrendamento/terceiro, ~100 sc/ha, vira grão + silagem.
//
// Idempotente: upsert por chave natural (código do talhão, [talhão,ano] da safra,
// [safra,código] da área) e limpeza-antes-de-recriar dos filhos da safra de milho
// (que não tem unique natural). Rodar N vezes NÃO duplica.
//
//   pnpm --filter rionovo-server run seed:plantios
//
// -----------------------------------------------------------------------------
// PREMISSAS NUMÉRICAS (documentadas — a visita deu ordens de grandeza, não CSV):
//
// CAFÉ
//   ~28.000 pés, café adensado no Sul de Minas. Espaçamento típico adensado
//   3,80 × 0,70 m  ⇒  10.000 / (3,80 × 0,70) ≈ 3.759 pés/ha.
//   28.000 pés / 3.759 ≈ 7,45 ha. Modelado em 2 talhões reais (Sede + Baixão)
//   somando 7,45 ha e 28.000 pés. Ano de plantio ~2014 (lavoura formada).
//   Safra corrente = "Safra 2026" (Jul/2025→Jun/2026), casando com o HOJE do
//   módulo (2026-05-28, ver services/plantio/dashboard.ts). Colheita à mão,
//   derriça no pano, ~jun-ago/2026. Produtividade café adensado em safra
//   positiva ≈ 30 sc/ha ⇒ ~224 sc no total (registrado em SafraTalhao). Uma
//   "maquininha" (colhedora de arrasto/derriçadeira) fica na observação.
//
// MILHO
//   100 ha em arrendamento (terceiro planta na área). ~100 sc/ha de grão como
//   base ⇒ 10.000 sc potenciais. Saída real mista: ~70 ha viram GRÃO (7.000 sc
//   vendidos) e ~30 ha viram SILAGEM (comida de vaca) — 30 ha × ~40 t/ha ≈
//   1.200 t de silagem ensilada no silo. Custos de safra (adubo, preparo, horas
//   de trator, colheita/transporte) somam o custeio — números plausíveis Conab
//   p/ milho verão. Áreas separadas (grão × silagem) para o custo por unidade
//   sair sem a nota de "saída mista" (ver resumo.recompute.ts).
// -----------------------------------------------------------------------------

import { Prisma } from "@prisma/client";
import { prisma } from "../src/db.js";
import { recomputarResumoSafra } from "../src/services/cultivo/resumo.recompute.js";

const D = (x: number) => new Prisma.Decimal(x.toFixed(2));
const D3 = (x: number) => new Prisma.Decimal(x.toFixed(3));

async function seedCafe() {
  // Centro de custo do café (já existe pela seed do rebanho/plantio; se não, cria).
  const ccCafe = await prisma.centroCusto.upsert({
    where: { nome: "Plantio Café" },
    update: {},
    create: { nome: "Plantio Café", ordem: 2 },
  });

  // Variedade — café adensado Rio Novo é Catuaí Vermelho (clássico Sul de Minas,
  // não resistente à ferrugem → entra nas worklists de fungicida).
  const variedade = await prisma.variedadeCafe.upsert({
    where: { nome: "Catuaí Vermelho IAC 144" },
    update: { resistenteFerrugem: false, porte: "baixo", cicloDias: 240 },
    create: { nome: "Catuaí Vermelho IAC 144", resistenteFerrugem: false, porte: "baixo", cicloDias: 240 },
  });

  // Lavoura real "Café Rio Novo" agrupando os talhões reais.
  const lavoura = await prisma.lavoura.upsert({
    where: { nome: "Café Rio Novo" },
    update: { observacao: "Lavoura de café adensado da sede — ~28.000 pés, colheita manual 1×/ano." },
    create: { nome: "Café Rio Novo", observacao: "Lavoura de café adensado da sede — ~28.000 pés, colheita manual 1×/ano." },
  });

  // 2 talhões reais somando 7,45 ha / 28.000 pés a 3.759 pés/ha (3,80 × 0,70 m).
  const talhoesReais = [
    {
      codigo: "RN-SEDE",
      nome: "Talhão Sede",
      areaHa: 4.5,
      plantasHa: 3_759, // ~16.916 pés
      anoPlantio: 2014,
      dataPlantio: "2014-11-15",
      observacao:
        "Café adensado da sede (3,80 × 0,70 m). Colheita manual (derriça no pano) 1×/ano. Uma derriçadeira/maquininha auxilia a colheita.",
    },
    {
      codigo: "RN-BAIXAO",
      nome: "Talhão Baixão",
      areaHa: 2.95,
      plantasHa: 3_759, // ~11.089 pés  →  total ~28.005 pés
      anoPlantio: 2015,
      dataPlantio: "2015-11-20",
      observacao: "Café adensado do baixão (3,80 × 0,70 m). Colheita manual 1×/ano.",
    },
  ] as const;

  const talhaoIds: number[] = [];
  for (const t of talhoesReais) {
    const data = {
      nome: t.nome,
      variedadeId: variedade.id,
      lavouraId: lavoura.id,
      espacamento: "3,80 × 0,70 m",
      plantasHa: t.plantasHa,
      areaHa: D(t.areaHa),
      anoPlantio: t.anoPlantio,
      altitude: 950,
      exposicao: null,
      irrigado: false,
      estado: "ATIVO" as const,
      dataPlantio: new Date(t.dataPlantio),
      observacao: t.observacao,
    };
    const row = await prisma.talhao.upsert({ where: { codigo: t.codigo }, update: data, create: { codigo: t.codigo, ...data } });
    talhaoIds.push(row.id);
  }

  const totalPes = talhoesReais.reduce((s, t) => s + Math.round(t.plantasHa * t.areaHa), 0);
  const areaTotal = talhoesReais.reduce((s, t) => s + t.areaHa, 0);

  // SafraTalhao 2026 (ciclo produtivo corrente) — produção real da safra.
  // Café adensado safra positiva ≈ 30 sc/ha. Idempotente por [talhaoId, ano].
  const ano = 2026;
  let sacasTotalGeral = 0;
  for (let i = 0; i < talhaoIds.length; i++) {
    const t = talhoesReais[i];
    const sacasPorHa = 30; // safra positiva, café adensado
    const sacasTotal = Math.round(sacasPorHa * t.areaHa);
    sacasTotalGeral += sacasTotal;
    const data = {
      sacasTotal: D(sacasTotal),
      sacasPorHa: D(sacasPorHa),
      pctCereja: D(70),
      pctBoia: D(10),
      bienalidade: "POSITIVA" as const,
      fechada: false,
      observacao: "Colheita manual (derriça no pano), jun-ago/2026.",
    };
    await prisma.safraTalhao.upsert({
      where: { talhaoId_ano: { talhaoId: talhaoIds[i], ano } },
      update: data,
      create: { talhaoId: talhaoIds[i], ano, ...data },
    });
  }

  // ResumoTalhao — para o cockpit do talhão mostrar fase/produtividade sem
  // depender de recompute externo. Upsert por talhaoId.
  for (let i = 0; i < talhaoIds.length; i++) {
    const data = {
      fase: "MATURACAO_CEREJA" as const,
      diasNaFase: 35,
      proximaOperacao: "Iniciar colheita manual",
      proximaOperacaoEm: new Date("2026-06-05"),
      produtividadeEsperada: D(30),
      produtividadeUltima: D(20),
      bienalidade: "POSITIVA" as const,
      maturacaoCereja: D(70),
      pH: D(5.4),
    };
    await prisma.resumoTalhao.upsert({ where: { talhaoId: talhaoIds[i] }, update: data, create: { talhaoId: talhaoIds[i], ...data } });
  }

  console.log(
    `[CAFÉ] ${talhoesReais.length} talhões reais (${areaTotal.toFixed(2)} ha, ~${totalPes.toLocaleString("pt-BR")} pés), ` +
      `SafraTalhao ${ano} com ${sacasTotalGeral} sc totais. Variedade "${variedade.nome}", lavoura "${lavoura.nome}".`,
  );
}

async function seedMilho() {
  // Safra de milho — sem unique natural no schema; localiza por (cultura, nome, ano)
  // e cria-ou-atualiza. Filhos (areas/custos/produções) são limpos-e-recriados p/
  // idempotência (áreas por upsert; custos/produções não têm chave natural).
  const nome = "Milho Safra 2025/26";
  const ano = 2026;
  let safra = await prisma.safraCultivo.findFirst({ where: { cultura: "MILHO", nome, ano } });
  const safraData = {
    cultura: "MILHO" as const,
    nome,
    ano,
    dataInicio: new Date("2025-10-15"),
    dataFim: new Date("2026-04-30"),
    areaHaTotal: D(100),
    fechada: false,
    observacao: "Arrendamento (terceiro planta a área). Grão vendido + silagem para o rebanho.",
  };
  if (safra) {
    safra = await prisma.safraCultivo.update({ where: { id: safra.id }, data: safraData });
  } else {
    safra = await prisma.safraCultivo.create({ data: safraData });
  }

  // Áreas — separa GRÃO (70 ha) e SILAGEM (30 ha) para o custo por unidade sair
  // sem a nota de "saída mista" (resumo.recompute.ts §alocação por área).
  const areaGrao = await prisma.areaCultivo.upsert({
    where: { safraCultivoId_codigo: { safraCultivoId: safra.id, codigo: "GRAO-A" } },
    update: { nome: "Chapada (grão)", areaHa: D(70) },
    create: { safraCultivoId: safra.id, codigo: "GRAO-A", nome: "Chapada (grão)", areaHa: D(70) },
  });
  const areaSilagem = await prisma.areaCultivo.upsert({
    where: { safraCultivoId_codigo: { safraCultivoId: safra.id, codigo: "SILAG-A" } },
    update: { nome: "Baixada (silagem)", areaHa: D(30) },
    create: { safraCultivoId: safra.id, codigo: "SILAG-A", nome: "Baixada (silagem)", areaHa: D(30) },
  });

  // Silo de silagem — sem unique natural; localiza por (nome, tipo).
  let silo = await prisma.silo.findFirst({ where: { nome: "Silo Trincheira Sede", tipo: "SILAGEM" } });
  const siloData = { nome: "Silo Trincheira Sede", tipo: "SILAGEM" as const, capacidade: D3(1500), unidade: "t", ativo: true };
  if (silo) {
    silo = await prisma.silo.update({ where: { id: silo.id }, data: { capacidade: siloData.capacidade, unidade: siloData.unidade, ativo: true } });
  } else {
    silo = await prisma.silo.create({ data: { ...siloData, saldoAtual: D3(0) } });
  }

  // --- Idempotência dos filhos sem chave natural: limpa os desta safra e recria.
  await prisma.movimentoSilo.deleteMany({ where: { producaoCultivo: { safraCultivoId: safra.id } } });
  await prisma.producaoCultivo.deleteMany({ where: { safraCultivoId: safra.id } });
  await prisma.lancamentoCusto.deleteMany({ where: { safraCultivoId: safra.id } });
  // Zera o saldo do silo antes de re-registrar a entrada da colheita (idempotência).
  await prisma.silo.update({ where: { id: silo.id }, data: { saldoAtual: D3(0) } });

  // Custos de safra — adubo, preparo, plantio, tratos, colheita/transporte,
  // horas de trator (com horasMaquina p/ o resumo somar). Números plausíveis
  // p/ milho verão (Conab), rateados por área de saída p/ custo por unidade.
  // Preços por hectare aplicados sobre a área de cada balde de saída.
  const custosGrao = [
    { tipo: "ADUBACAO" as const, descricao: "Adubação de base (formulado + cobertura ureia)", valorHa: 2_600, data: "2025-10-20" },
    { tipo: "PREPARO_SOLO" as const, descricao: "Preparo do solo (gradagem + sulcação)", valorHa: 450, data: "2025-10-16", horasHa: 1.1, maquinas: 2 },
    { tipo: "PLANTIO" as const, descricao: "Plantio mecanizado + sementes", valorHa: 1_150, data: "2025-10-22", horasHa: 0.8 },
    { tipo: "TRATOS" as const, descricao: "Herbicida + inseticida (tratos culturais)", valorHa: 520, data: "2025-12-05" },
    { tipo: "COLHEITA" as const, descricao: "Colheita mecanizada de grãos", valorHa: 480, data: "2026-04-10", horasHa: 0.9, maquinas: 1 },
    { tipo: "TRANSPORTE" as const, descricao: "Transporte do grão (caminhão)", valorHa: 260, data: "2026-04-12", caminhoes: 3 },
  ];
  const custosSilagem = [
    { tipo: "ADUBACAO" as const, descricao: "Adubação de base (formulado + cobertura ureia)", valorHa: 2_600, data: "2025-10-20" },
    { tipo: "PREPARO_SOLO" as const, descricao: "Preparo do solo (gradagem + sulcação)", valorHa: 450, data: "2025-10-16", horasHa: 1.1, maquinas: 2 },
    { tipo: "PLANTIO" as const, descricao: "Plantio mecanizado + sementes", valorHa: 1_150, data: "2025-10-22", horasHa: 0.8 },
    { tipo: "TRATOS" as const, descricao: "Herbicida + inseticida (tratos culturais)", valorHa: 520, data: "2025-12-05" },
    { tipo: "COLHEITA" as const, descricao: "Ensilagem (colheita + compactação)", valorHa: 900, data: "2026-03-01", horasHa: 1.6, maquinas: 2 },
    { tipo: "TRANSPORTE" as const, descricao: "Transporte da massa verde ao silo", valorHa: 320, data: "2026-03-02", caminhoes: 4 },
  ];

  let custoTotal = 0;
  let horasTotal = 0;
  const inserirCustos = async (area: { id: number; areaHa: Prisma.Decimal }, custos: typeof custosGrao) => {
    const ha = Number(area.areaHa);
    for (const c of custos) {
      const valor = c.valorHa * ha;
      const horasMaquina = "horasHa" in c && c.horasHa ? c.horasHa * ha : null;
      custoTotal += valor;
      horasTotal += horasMaquina ?? 0;
      await prisma.lancamentoCusto.create({
        data: {
          safraCultivoId: safra!.id,
          areaCultivoId: area.id,
          tipo: c.tipo,
          classe: "CUSTEIO",
          data: new Date(c.data),
          descricao: c.descricao,
          valor: D(valor),
          horasMaquina: horasMaquina != null ? D(horasMaquina) : null,
          numMaquinas: "maquinas" in c ? (c as any).maquinas ?? null : null,
          numCaminhoes: "caminhoes" in c ? (c as any).caminhoes ?? null : null,
        },
      });
    }
  };
  await inserirCustos(areaGrao, custosGrao);
  await inserirCustos(areaSilagem, custosSilagem);

  // Produção — GRÃO na área de grão (venda) e SILAGEM na área de silagem (silo).
  // 70 ha × 100 sc/ha = 7.000 sc de grão vendidos.
  // 30 ha × 40 t/ha  = 1.200 t de silagem ensiladas no silo.
  const graoSc = 70 * 100;
  const silagemTon = 30 * 40;

  await prisma.producaoCultivo.create({
    data: {
      safraCultivoId: safra.id,
      areaCultivoId: areaGrao.id,
      data: new Date("2026-04-11"),
      tipo: "GRAO",
      quantidade: D3(graoSc),
      unidade: "SC",
      destino: "VENDA",
      observacao: "Grão colhido e vendido (~100 sc/ha em 70 ha).",
    },
  });

  const prodSilagem = await prisma.producaoCultivo.create({
    data: {
      safraCultivoId: safra.id,
      areaCultivoId: areaSilagem.id,
      data: new Date("2026-03-01"),
      tipo: "SILAGEM",
      quantidade: D3(silagemTon),
      unidade: "TON",
      destino: "SILO",
      siloId: silo.id,
      observacao: "Silagem ensilada para comida de vaca (~40 t/ha em 30 ha).",
    },
  });

  // Movimento de entrada no silo + saldo (espelha o que a rota de produção faria).
  await prisma.movimentoSilo.create({
    data: {
      siloId: silo.id,
      data: new Date("2026-03-01"),
      tipo: "ENTRADA",
      quantidade: D3(silagemTon),
      origem: "COLHEITA",
      producaoCultivoId: prodSilagem.id,
      observacao: "Ensilagem da safra 2025/26.",
    },
  });
  await prisma.silo.update({ where: { id: silo.id }, data: { saldoAtual: D3(silagemTon) } });

  // Recompute do resumo — para o cockpit mostrar custo de safra != 0.
  await recomputarResumoSafra(safra.id);
  const resumo = await prisma.resumoSafraCultivo.findUnique({ where: { safraCultivoId: safra.id } });

  console.log(
    `[MILHO] Safra "${nome}" (${ano}): 100 ha (70 grão + 30 silagem), custeio total R$ ${custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, ` +
      `${horasTotal.toFixed(1)} h-máquina. Produção: ${graoSc} sc grão + ${silagemTon} t silagem. Silo saldo ${silagemTon} t.`,
  );
  if (resumo) {
    console.log(
      `[MILHO] Resumo: custeioTotal=${resumo.custeioTotal} custoHa=${resumo.custoHa} custoSaca=${resumo.custoSaca} custoTonelada=${resumo.custoTonelada} horasMaquina=${resumo.horasMaquinaTotal}`,
    );
  }
}

async function main() {
  console.log("Seed dos plantios reais da Fazenda Rio Novo — café + milho\n");
  await seedCafe();
  await seedMilho();
  console.log("\nSeed dos plantios reais concluída.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
