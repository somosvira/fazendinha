import { PrismaClient, SexoAnimal, CategoriaAnimal } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const grupos = ["Alta Produção", "Média Produção", "Bezerreiro"];
  const racas = ["Girolando 5/8", "Girolando 1/2", "Girolando 3/4", "Girolando 9/16", "Holandês"];
  const grupoId: Record<string, number> = {};
  const racaId: Record<string, number> = {};
  for (const nome of grupos) grupoId[nome] = (await prisma.grupo.upsert({ where: { nome }, update: {}, create: { nome } })).id;
  for (const nome of racas) racaId[nome] = (await prisma.raca.upsert({ where: { nome }, update: {}, create: { nome } })).id;

  // (numero, nome, sexo, categoria, raca, grauSangue, nasc, entrada, brinco, grupo, setor, paiNome)
  const animais = [
    { numero: "1234", nome: "Jurema", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2020-03-12", grupo: "Alta Produção", setor: "Galpão 2", brinco: "982000123456789", paiNome: "Lance 612" },
    { numero: "1188", nome: "Aurora", sexo: "F", categoria: "VACA", raca: "Girolando 1/2", grauSangue: "Girolando 1/2", nasc: "2021-06-02", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0942", nome: "Bonita", sexo: "F", categoria: "VACA", raca: "Holandês", grauSangue: "Holandês", nasc: "2020-09-18", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1305", nome: "Cravina", sexo: "F", categoria: "VACA", raca: "Girolando 3/4", grauSangue: "Girolando 3/4", nasc: "2021-01-05", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0877", nome: "Dália", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2020-04-22", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1421", nome: "Estrela", sexo: "F", categoria: "VACA", raca: "Holandês", grauSangue: "Holandês", nasc: "2021-08-30", grupo: "Média Produção", setor: null, brinco: null, paiNome: null },
    { numero: "0871", nome: "Jandira", sexo: "F", categoria: "VACA", raca: "Girolando 5/8", grauSangue: "Girolando 5/8", nasc: "2018-02-10", grupo: "Alta Produção", setor: null, brinco: null, paiNome: null },
    { numero: "1442", nome: "Bezerra 1442", sexo: "F", categoria: "BEZERRA", raca: "Girolando 9/16", grauSangue: "Girolando 9/16", nasc: "2026-01-22", grupo: "Bezerreiro", setor: null, brinco: null, paiNome: "Lance 884" },
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
  function stripNull(r: any) {
    return { statusReprodutivo: r.statusReprodutivo, del: r.del, ordemLactacao: r.ordemLactacao, ultimoDgData: r.ultimoDgData ? new Date(r.ultimoDgData) : null, ultimoDgResultado: r.ultimoDgResultado, diasGestacao: r.diasGestacao, iepProjetado: r.iepProjetado, previsaoSecagem: r.previsaoSecagem ? new Date(r.previsaoSecagem) : null };
  }
  console.log(`Seed rebanho ok: ${animais.length} animais.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
