import { PrismaClient, SexoAnimal, CategoriaAnimal, StatusReprodutivo } from "@prisma/client";

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

  // ResumoAnimal (mesmos números dos mocks atuais)
  const resumos: { numero: string; r: any }[] = [
    { numero: "1234", r: { statusReprodutivo: "PRENHE", del: 145, ordemLactacao: 3, producaoMediaDia: 28, producao305: 8900, ccs: 512, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-28"), ultimoDgResultado: "positivo", iepProjetado: 395, diasGestacao: 30, previsaoSecagem: new Date("2026-12-12") } },
    { numero: "1188", r: { statusReprodutivo: "PEV", del: 72, ordemLactacao: 2, producaoMediaDia: 31, ccs: 180, ccsTendencia: "estavel" } },
    { numero: "0942", r: { statusReprodutivo: "VAZIA", del: 96, ordemLactacao: 3, producaoMediaDia: 24, ccs: 240, ccsTendencia: "estavel", ultimoDgData: new Date("2026-05-14"), ultimoDgResultado: "negativo" } },
    { numero: "1305", r: { statusReprodutivo: "VAZIA", del: 110, ordemLactacao: 2, producaoMediaDia: 22, ccs: 300, ccsTendencia: "subindo", ultimoDgData: new Date("2026-05-02"), ultimoDgResultado: "negativo" } },
    { numero: "0877", r: { statusReprodutivo: "PEV", del: 68, ordemLactacao: 4, producaoMediaDia: 33, ccs: 150, ccsTendencia: "estavel" } },
    { numero: "1421", r: { statusReprodutivo: "VAZIA", del: 83, ordemLactacao: 1, producaoMediaDia: 26, ccs: 210, ccsTendencia: "estavel", ultimoDgData: new Date("2026-05-20"), ultimoDgResultado: "negativo" } },
    { numero: "0871", r: { statusReprodutivo: "PRENHE", del: 210, ordemLactacao: 4, producaoMediaDia: 21, ccs: 130, ccsTendencia: "estavel", iepProjetado: 402, diasGestacao: 95, previsaoSecagem: new Date("2026-09-30") } },
  ];
  for (const { numero, r } of resumos) {
    const animalId = idByNumero[numero];
    await prisma.resumoAnimal.upsert({ where: { animalId }, update: r, create: { animalId, ...r } });
  }
  console.log(`Seed rebanho ok: ${animais.length} animais.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
