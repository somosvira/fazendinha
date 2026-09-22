// Seed de DEMONSTRAÇÃO do rebanho (8 vacas) + cadastros que o módulo precisa:
// Produtos / Dietas / Grupos (Alta/Média Produção, Bezerreiro) / Estoque / Fornecedores.
//
// Ordem recomendada (dev/worktree) para chegar ao rebanho REAL da fazenda:
//   1) `pnpm --filter rionovo-server run seed:rebanho`   → este seed (produtos/dietas/grupos/estoque)
//   2) `pnpm --filter rionovo-server run import:rebanho`  → SUBSTITUI os 8 animais demo pelo rebanho
//      real do Ideagri (824 animais, 1.621 controles), preservando produtos/estoque/lançamentos/dietas.
//      Os Grupos criados aqui são reaproveitados por nome (upsert) — as FKs do Estoque seguem válidas.
// Os animais demo deste seed NÃO precisam ser removidos: o import:rebanho os substitui.

import { SexoAnimal, CategoriaAnimal } from "@prisma/client";
import { prisma } from "../src/db.js";
import { CENTROS_ATIVIDADE } from "../src/services/estoque/centros-atividade.js";

async function main() {
  const grupos = ["Alta Produção", "Média Produção", "Bezerreiro"];
  const grupoId: Record<string, number> = {};
  for (const nome of grupos) grupoId[nome] = (await prisma.grupo.upsert({ where: { nome }, update: {}, create: { nome } })).id;

  // A baseline contém somente estrutura. O seed é responsável pelos catálogos
  // mínimos que o cenário de demonstração utiliza.
  const racasUsadas = [
    { nome: "Girolando", codigo: "GL" },
    { nome: "Holandês", codigo: "HO" },
  ] as const;
  const racaId: Record<string, number> = {};
  for (const raca of racasUsadas) {
    const row = await prisma.raca.upsert({
      where: { nome: raca.nome },
      update: { codigo: raca.codigo, especie: "BOVINO" },
      create: { nome: raca.nome, codigo: raca.codigo, especie: "BOVINO" },
    });
    racaId[raca.nome] = row.id;
  }

  // grauSangue agora segue o padrão composto "fração1 SIGLA1, SIGLA2" (ex.: "5/8 GL, HO").
  const animais = [
    { numero: "1234", nome: "Jurema",       sexo: "F", categoria: "VACA",    raca: "Girolando", grauSangue: "5/8 GL, HO", nasc: "2020-03-12", grupo: "Alta Produção",  setor: "Galpão 2", brinco: "982000123456789", paiNome: "Lance 612" },
    { numero: "1188", nome: "Aurora",       sexo: "F", categoria: "VACA",    raca: "Girolando", grauSangue: "1/2 GL, HO", nasc: "2021-06-02", grupo: "Alta Produção",  setor: null,       brinco: null,                paiNome: null },
    { numero: "0942", nome: "Bonita",       sexo: "F", categoria: "VACA",    raca: "Holandês",  grauSangue: null,         nasc: "2020-09-18", grupo: "Média Produção", setor: null,       brinco: null,                paiNome: null },
    { numero: "1305", nome: "Cravina",      sexo: "F", categoria: "VACA",    raca: "Girolando", grauSangue: "3/4 GL, HO", nasc: "2021-01-05", grupo: "Média Produção", setor: null,       brinco: null,                paiNome: null },
    { numero: "0877", nome: "Dália",        sexo: "F", categoria: "VACA",    raca: "Girolando", grauSangue: "5/8 GL, HO", nasc: "2020-04-22", grupo: "Alta Produção",  setor: null,       brinco: null,                paiNome: null },
    { numero: "1421", nome: "Estrela",      sexo: "F", categoria: "VACA",    raca: "Holandês",  grauSangue: null,         nasc: "2021-08-30", grupo: "Média Produção", setor: null,       brinco: null,                paiNome: null },
    { numero: "0871", nome: "Jandira",      sexo: "F", categoria: "VACA",    raca: "Girolando", grauSangue: "5/8 GL, HO", nasc: "2018-02-10", grupo: "Alta Produção",  setor: null,       brinco: null,                paiNome: null },
    { numero: "1442", nome: "Bezerra 1442", sexo: "F", categoria: "BEZERRA", raca: "Girolando", grauSangue: "9/16 GL, HO", nasc: "2026-01-22", grupo: "Bezerreiro",     setor: null,       brinco: null,                paiNome: "Lance 884" },
  ] as const;

  const idByNumero: Record<string, number> = {};
  for (const a of animais) {
    const row = await prisma.animal.upsert({
      where: { numero: a.numero },
      update: {},
      create: {
        numero: a.numero, nome: a.nome, sexo: a.sexo as SexoAnimal, categoria: a.categoria as CategoriaAnimal,
        racaId: racaId[a.raca], grauSangue: a.grauSangue, dataNascimento: new Date(a.nasc), dataEntrada: new Date(a.nasc),
        brincoEletronico: a.brinco, grupoId: grupoId[a.grupo], setor: a.setor, paiNome: a.paiNome,
      },
    });
    idByNumero[a.numero] = row.id;
  }
  // Jurema é mãe da Bezerra 1442
  await prisma.animal.update({ where: { numero: "1442" }, data: { maeId: idByNumero["1234"] } });

  // numPartosEntrada (partos antes do registro) — define a ordem de lactação
  const partosEntrada: Record<string, number> = { "1234": 2, "0871": 3, "0942": 2, "1305": 1, "1188": 1, "0877": 3, "1421": 0 };
  for (const [numero, n] of Object.entries(partosEntrada)) await prisma.animal.update({ where: { numero }, data: { numPartosEntrada: n } });

  // Eventos por animal (idempotente: limpa e recria) — hoje ~ 2026-06-16
  const hoje = new Date("2026-06-16");
  const ddmm = (offsetDias: number) => new Date(hoje.getTime() - offsetDias * 86_400_000);
  const eventosPorAnimal: Record<string, any[]> = {
    "1234": [ // Jurema — prenhe, 3ª lactação
      { tipo: "SECAGEM", data: new Date("2025-12-18"), motivoSecagem: "fim de ciclo" },
      { tipo: "PARTO", data: new Date("2026-01-22"), numCrias: 1, sexoCria: "F", tipoParto: "normal" },
      { tipo: "INSEMINACAO", data: new Date("2026-04-28"), reprodutor: "Lance 884", protocolo: "IATF 11d" },
      { tipo: "DIAGNOSTICO", data: new Date("2026-05-28"), resultado: "positivo", dtPartoPrevista: new Date("2027-02-22") },
    ],
    "0871": [ { tipo: "PARTO", data: ddmm(210), numCrias: 1, sexoCria: "M" }, { tipo: "INSEMINACAO", data: ddmm(115), reprodutor: "Lance 612" }, { tipo: "DIAGNOSTICO", data: ddmm(85), resultado: "positivo" } ],
    "0942": [ { tipo: "PARTO", data: ddmm(96), numCrias: 1, sexoCria: "F" }, { tipo: "INSEMINACAO", data: ddmm(45), reprodutor: "Lance 884" }, { tipo: "DIAGNOSTICO", data: ddmm(33), resultado: "negativo" } ],
    "1305": [ { tipo: "PARTO", data: ddmm(110), numCrias: 1, sexoCria: "F" }, { tipo: "DIAGNOSTICO", data: ddmm(45), resultado: "negativo" } ],
    "1188": [ { tipo: "PARTO", data: ddmm(72), numCrias: 1, sexoCria: "M" } ],
    "0877": [ { tipo: "PARTO", data: ddmm(68), numCrias: 1, sexoCria: "F" } ],
    "1421": [ { tipo: "PARTO", data: ddmm(83), numCrias: 1, sexoCria: "F" }, { tipo: "DIAGNOSTICO", data: ddmm(27), resultado: "negativo" } ],
  };

  // Produção/CCS (valores de demonstração) — NÃO computados pelo motor; reaplicados após o recompute.
  const producaoCcs: Record<string, any> = {
    "1234": { producaoMediaDia: 28, producao305: 8900, ccs: 512, ccsTendencia: "subindo" },
    "1188": { producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel" },
    "0942": { producaoMediaDia: 24, ccs: 240, ccsTendencia: "estavel" },
    "1305": { producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo" },
    "0877": { producaoMediaDia: 33, ccs: 150, ccsTendencia: "estavel" },
    "1421": { producaoMediaDia: 26, ccs: 210, ccsTendencia: "estavel" },
    "0871": { producaoMediaDia: 21, ccs: 130, ccsTendencia: "estavel" },
  };

  const { reconstruirLactacoes, recomputarResumoReproducao } = await import("../src/services/rebanho/reproducao.recompute.js");
  const isoStr = (d: Date) => d.toISOString().slice(0, 10);
  // limpeza global: remove eventos/lactações órfãos (ex.: deixados por smoke tests)
  // e resumos de bezerras (não têm estado reprodutivo) — deixa o estado pristino.
  await prisma.eventoReprodutivo.deleteMany({});
  await prisma.lactacao.deleteMany({});
  await prisma.resumoAnimal.deleteMany({ where: { animal: { categoria: { in: ["BEZERRA", "BEZERRO"] } } } });
  for (const [numero, evs] of Object.entries(eventosPorAnimal)) {
    const a = await prisma.animal.findUnique({ where: { numero } });
    if (!a) continue;
    await prisma.eventoReprodutivo.deleteMany({ where: { animalId: a.id } });
    for (const e of evs) await prisma.eventoReprodutivo.create({ data: { animalId: a.id, ...e } });
    const evRepro = evs.map((e) => ({ tipo: e.tipo, data: isoStr(e.data), resultado: e.resultado ?? null, dtPartoPrevista: e.dtPartoPrevista ? isoStr(e.dtPartoPrevista) : null, reprodutor: e.reprodutor ?? null }));
    const lacts = reconstruirLactacoes(evRepro as any, a.numPartosEntrada);
    await prisma.lactacao.deleteMany({ where: { animalId: a.id } });
    if (lacts.length) await prisma.lactacao.createMany({ data: lacts.map((l) => ({ animalId: a.id, numero: l.numero, dtInicio: new Date(l.dtInicio), dtFim: l.dtFim ? new Date(l.dtFim) : null })) });
    const r = recomputarResumoReproducao(evRepro as any, lacts, a.numPartosEntrada, "2026-06-16");
    await prisma.resumoAnimal.upsert({ where: { animalId: a.id }, create: { animalId: a.id, ...stripNull(r) }, update: stripNull(r) });
    // reaplica produção/CCS (não tocados pelo motor)
    const pc = producaoCcs[numero];
    if (pc) await prisma.resumoAnimal.update({ where: { animalId: a.id }, data: pc });
  }

  // Eventos sanitários (CCS/mastite/aplicação) — idempotente via deleteMany global.
  // O CCS do resumo passa a ser COMPUTADO dos exames (substitui os valores hardcoded
  // do bloco de produção acima); produção/estado reprodutivo NÃO são tocados.
  await prisma.eventoSanitario.deleteMany({});
  const { recomputarResumoSanidade } = await import("../src/services/rebanho/sanidade.recompute.js");
  const sanPorAnimal: Record<string, any[]> = {
    "1234": [ { tipo: "EXAME", data: new Date("2026-03-12"), ccs: 245 }, { tipo: "EXAME", data: new Date("2026-04-12"), ccs: 389 }, { tipo: "EXAME", data: new Date("2026-05-12"), ccs: 512 }, { tipo: "MASTITE", data: new Date("2026-04-14"), quarto: "PD", severidade: "clínica" }, { tipo: "APLICACAO", data: new Date("2026-04-14"), produto: "Mastijet", dose: "1 bisnaga", carencia: 96, loteProduto: "MAST-2231" } ],
    "1305": [ { tipo: "EXAME", data: new Date("2026-04-01"), ccs: 280 }, { tipo: "EXAME", data: new Date("2026-05-01"), ccs: 300 } ],
    "1188": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 180 } ],
    "0942": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 240 } ],
    "0877": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 150 } ],
    "0871": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 130 } ],
    "1421": [ { tipo: "EXAME", data: new Date("2026-05-10"), ccs: 210 } ],
  };
  const isoS = (d: Date) => d.toISOString().slice(0, 10);
  for (const [numero, evs] of Object.entries(sanPorAnimal)) {
    const a = await prisma.animal.findUnique({ where: { numero } });
    if (!a) continue;
    for (const e of evs) await prisma.eventoSanitario.create({ data: { animalId: a.id, ...e } });
    const r = recomputarResumoSanidade(evs.map((e: any) => ({ tipo: e.tipo, data: isoS(e.data), ccs: e.ccs ?? null })));
    await prisma.resumoAnimal.update({ where: { animalId: a.id }, data: { ccs: r.ccs, ccsTendencia: r.ccsTendencia } });
  }

  function stripNull(r: any) {
    return { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: r.ultimoDgData ? new Date(r.ultimoDgData) : null, ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: r.previsaoSecagem ? new Date(r.previsaoSecagem) : null };
  }

  // Dietas (nutrição lot-level) — upsert idempotente por nome + atribuição aos lotes.
  const dietas = [
    { nome: "Lactação Alta", descricao: "vacas de alta produção", pb: 18, edMcal: 1.68 },
    { nome: "Lactação Média", descricao: "vacas de média produção", pb: 16, edMcal: 1.55 },
    { nome: "Pré-parto", descricao: "transição", pb: 14, edMcal: 1.45 },
    { nome: "Bezerreiro", descricao: "aleitamento/recria", pb: 20, edMcal: 1.80 },
  ];
  const dietaIdByNome: Record<string, number> = {};
  for (const d of dietas) dietaIdByNome[d.nome] = (await prisma.dieta.upsert({ where: { nome: d.nome }, update: { descricao: d.descricao, pb: d.pb, edMcal: d.edMcal }, create: d })).id;
  const lotesDieta: Record<string, string> = { "Alta Produção": "Lactação Alta", "Média Produção": "Lactação Média", "Bezerreiro": "Bezerreiro" };
  for (const [grupoNome, dietaNome] of Object.entries(lotesDieta)) {
    const g = await prisma.grupo.findUnique({ where: { nome: grupoNome } });
    if (g) await prisma.grupo.update({ where: { id: g.id }, data: { dietaId: dietaIdByNome[dietaNome] } });
  }

  // Produção — controles leiteiros (modo ORDENHA padrão). Idempotente: limpa e recria.
  // Computado pelo motor de produção (sobrescreve os producaoMediaDia hardcoded acima).
  await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1, producaoModo: "ORDENHA" }, update: { producaoModo: "ORDENHA" } });
  await prisma.controleLeiteiro.deleteMany({});
  await prisma.producaoLote.deleteMany({});
  // por animal: 3 controles semanais (mais antigo → mais recente). Jurema sobe 26→28→30 (~28, subindo).
  const controlesPorAnimal: Record<string, number[]> = {
    "1234": [26, 28, 30], // Jurema ~28 subindo
    "1188": [31, 31, 31], // Aurora ~31
    "0942": [24, 24, 24], // Bonita ~24
    "1305": [21, 22, 23], // Cravina ~22 subindo
    "0877": [33, 33, 33], // Dália ~33
    "1421": [26, 26, 26], // Estrela ~26
    "0871": [21, 21, 21], // Jandira ~21
  };
  const { recomputarProducaoDoAnimal } = await import("../src/services/rebanho/producao.js");
  for (const [numero, pesos] of Object.entries(controlesPorAnimal)) {
    const a = await prisma.animal.findUnique({ where: { numero } });
    if (!a) continue;
    // datas: 14, 7 e 0 dias atrás (o último é o mais recente)
    for (let i = 0; i < pesos.length; i++) {
      const data = ddmm((pesos.length - 1 - i) * 7);
      await prisma.controleLeiteiro.create({ data: { animalId: a.id, data, pesoTotal: pesos[i] } });
    }
    await recomputarProducaoDoAnimal(a.id);
  }

  // Cadastros: Produtos (catálogo remédio/ração/insumo). Idempotente: limpa e recria.
  // Movimentos de estoque referenciam Produto (FK) — limpar antes de apagar os produtos.
  // O estoque demonstrativo é recriado de forma isolada. Compras financeiras reais
  // devem nascer pelo fluxo de Operacao; este seed usa INVENTARIO_INICIAL.
  await prisma.movimentoEstoque.deleteMany({});
  await prisma.produto.deleteMany({});
  const produtos = [
    { nome: "Mastijet", tipo: "MEDICAMENTO", unidade: "un", custoUnitario: 28.5, carencia: 96, estocavel: true, minimoEstoque: 4 },
    { nome: "Ração Lactação Alta", tipo: "RACAO", unidade: "kg", custoUnitario: 2.1, percentualMS: 88, estocavel: true, minimoEstoque: 500 },
    { nome: "Núcleo Mineral", tipo: "MINERAL", unidade: "kg", custoUnitario: 5.4, percentualMS: 96, estocavel: true, minimoEstoque: 100 },
    { nome: "Sêmen Lance 884", tipo: "INSUMO", unidade: "dose", custoUnitario: 45, estocavel: true, minimoEstoque: 10 },
    { nome: "Antibiótico X", tipo: "MEDICAMENTO", unidade: "mL", custoUnitario: 62, carencia: 120, estocavel: true, minimoEstoque: 2 },
  ] as const;
  for (const p of produtos) await prisma.produto.create({ data: p as any });

  // Mapeamento contábil dos produtos (ponte com o financeiro). Por nome → Categoria real;
  // todos no centro de custo "Atividade Leiteira". O Sêmen fica sem categoria de propósito.
  const catId = async (nome: string) => (await prisma.categoria.findFirst({ where: { nome } }))?.id ?? null;
  const racaoCatId = await catId("Ração");
  const medCatId = await catId("Medicamento Animal");
  const leiteiraId = (await prisma.centroCusto.findFirst({ where: { nome: CENTROS_ATIVIDADE.LEITE } }))?.id ?? null;
  const mapaContabil: Record<string, number | null> = {
    "Ração Lactação Alta": racaoCatId,
    "Núcleo Mineral": racaoCatId,
    "Mastijet": medCatId,
    "Antibiótico X": medCatId,
    // "Sêmen Lance 884": sem categoria (demonstra compra que não gera lançamento)
  };
  for (const [nome, categoriaId] of Object.entries(mapaContabil)) {
    if (categoriaId == null) continue;
    await prisma.produto.update({
      where: { nome },
      data: {
        categoriaId,
        ...(leiteiraId != null ? { centrosCusto: { deleteMany: {}, create: [{ centroCustoId: leiteiraId }] } } : {}),
      },
    });
  }

  // Cadastros: parceiros fornecedores. Documento é a chave estável do seed.
  const fornecedores = [
    { nome: "Cargill", tipo: "FORNECEDOR", documento: "60.498.706/0001-57", telefone: "1130991000", email: "atendimento@cargill.com" },
    { nome: "Coop. Boa Vista", tipo: "FORNECEDOR", documento: "12.345.678/0001-99", telefone: "3432221100", email: "contato@coopboavista.com.br" },
    { nome: "Agropecuária Rio Novo", tipo: "AMBOS", telefone: "3499887766" },
  ] as const;
  for (const f of fornecedores) {
    const documento = "documento" in f ? f.documento : undefined;
    const existente = documento
      ? await prisma.parceiro.findUnique({ where: { documento } })
      : await prisma.parceiro.findFirst({ where: { nome: f.nome } });
    if (existente) await prisma.parceiro.update({ where: { id: existente.id }, data: f });
    else await prisma.parceiro.create({ data: f });
  }

  // Estoque: movimentos (entradas de compra + saídas de consumo recente). Idempotente
  // (a tabela já foi limpa acima, antes do produto.deleteMany, por causa da FK).
  // Saldo é computado (entradas − saídas); custo vaca/dia = Σ saídas valorizadas ÷ (vacas×dias).
  const prodByName: Record<string, { id: number; custo: number }> = {};
  for (const p of await prisma.produto.findMany({ where: { nome: { in: ["Ração Lactação Alta", "Núcleo Mineral"] } } })) {
    prodByName[p.nome] = { id: p.id, custo: p.custoUnitario != null ? Number(p.custoUnitario) : 0 };
  }
  const racao = prodByName["Ração Lactação Alta"];
  const nucleo = prodByName["Núcleo Mineral"];
  const movimento = (produto: { id: number; custo: number } | undefined, tipo: "ENTRADA" | "SAIDA", quantidade: number, offsetDias: number, observacao?: string) => {
    if (!produto) return null;
    const valorTotal = Math.round(quantidade * produto.custo * 100) / 100;
    return prisma.movimentoEstoque.create({
      data: { produtoId: produto.id, tipo, origem: tipo === "ENTRADA" ? "INVENTARIO_INICIAL" : "CONSUMO_DIRETO", data: ddmm(offsetDias), quantidade, custoUnitario: produto.custo, valorTotal, observacao: observacao ?? null },
    });
  };

  await movimento(racao, "ENTRADA", 1500, 20, "Saldo inicial de ração");
  await movimento(nucleo, "ENTRADA", 200, 20, "Saldo inicial de núcleo mineral");

  // Saídas de consumo recente (~900 kg de ração nos últimos dias) — não geram lançamento.
  const saidas = [
    movimento(racao, "SAIDA", 300, 6, "Consumo lote Alta Produção"),
    movimento(racao, "SAIDA", 300, 4, "Consumo lote Alta Produção"),
    movimento(racao, "SAIDA", 300, 2, "Consumo lote Alta Produção"),
    movimento(nucleo, "SAIDA", 40, 3, "Consumo núcleo mineral"),
  ].filter(Boolean);
  await Promise.all(saidas as Promise<unknown>[]);
  const totalMovimentos = 2 + saidas.length;

  console.log(`Seed rebanho ok: ${animais.length} animais, ${produtos.length} produtos, ${fornecedores.length} fornecedores, ${totalMovimentos} movimentos de estoque.`);
  console.log("Para o rebanho REAL, rode em seguida: pnpm --filter rionovo-server run import:rebanho");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
