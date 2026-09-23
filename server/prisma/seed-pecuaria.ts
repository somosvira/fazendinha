// Seed de catálogos do novo schema `pecuaria`:
// - Raças (base + composta)
// - Motivos de saída
// - Propriedades
//
// Idempotente por chave natural (upsert).

import { prisma } from "../src/db.js";

async function main() {
  // Raças base (7) + composta (1)
  const racas = [
    { nome: "Holandês", sigla: "HO", base: true },
    { nome: "Gir Leiteiro", sigla: "GO", base: true },
    { nome: "Nelore", sigla: "NE", base: true },
    { nome: "Jersey", sigla: "JE", base: true },
    { nome: "Angus", sigla: "AN", base: true },
    { nome: "Guzerá", sigla: "GU", base: true },
    { nome: "Pardo Suíço", sigla: "PS", base: true },
    { nome: "Girolando", sigla: "GL", base: false }, // composta
  ];

  let racasCount = 0;
  for (const raca of racas) {
    const existente = await prisma.raca.findFirst({ where: { nome: raca.nome } });
    if (existente) {
      await prisma.raca.update({
        where: { id: existente.id },
        data: { sigla: raca.sigla, base: raca.base, ativo: true },
      });
    } else {
      await prisma.raca.create({
        data: { nome: raca.nome, sigla: raca.sigla, base: raca.base, ativo: true },
      });
      racasCount++;
    }
  }

  // Motivos de saída
  // VENDA, ABATE, MORTE (com subtypes), DOACAO, CADASTRO_INDEVIDO
  const motivos = [
    // VENDA
    { nome: "Venda", tipo: "VENDA" },
    // ABATE
    { nome: "Abate", tipo: "ABATE" },
    // DOACAO
    { nome: "Doação", tipo: "DOACAO" },
    // CADASTRO_INDEVIDO
    { nome: "Cadastro indevido", tipo: "CADASTRO_INDEVIDO" },
    // MORTE
    { nome: "Acidente", tipo: "MORTE" },
    { nome: "Anaplasmose", tipo: "MORTE" },
    { nome: "Babesia bovis", tipo: "MORTE" },
    { nome: "Clostridioses", tipo: "MORTE" },
    { nome: "Doenças bacterianas", tipo: "MORTE" },
    { nome: "Pneumonia", tipo: "MORTE" },
    { nome: "Mastite ambiental", tipo: "MORTE" },
    { nome: "Prolapso uterino", tipo: "MORTE" },
    { nome: "Complicações pós-parto", tipo: "MORTE" },
    { nome: "Intoxicação com ureia", tipo: "MORTE" },
    { nome: "Desconhecida/Indefinida", tipo: "MORTE" },
    { nome: "Outras", tipo: "MORTE" },
  ];

  let motivosCount = 0;
  for (const motivo of motivos) {
    const existente = await prisma.motivoSaida.findFirst({ where: { nome: motivo.nome } });
    if (existente) {
      await prisma.motivoSaida.update({
        where: { id: existente.id },
        data: { tipo: motivo.tipo as any, ativo: true },
      });
    } else {
      await prisma.motivoSaida.create({
        data: { nome: motivo.nome, tipo: motivo.tipo as any, ativo: true },
      });
      motivosCount++;
    }
  }

  // Propriedades
  const propriedades = [
    { nome: "Principal", apelido: "Principal", principal: true },
    { nome: "Mexicana", apelido: "Mexicana", principal: false },
    { nome: "Carlos Alves", apelido: "Carlos Alves", principal: false },
    { nome: "São Francisco", apelido: "São Francisco", principal: false },
  ];

  let propriedadesCount = 0;
  for (const prop of propriedades) {
    const existe = await prisma.propriedade.findUnique({ where: { nome: prop.nome } });
    if (!existe) {
      await prisma.propriedade.create({
        data: { nome: prop.nome, apelido: prop.apelido, principal: prop.principal, ativo: true },
      });
      propriedadesCount++;
    }
  }

  console.log(`Seed pecuaria ok: ${racasCount} raças, ${motivosCount} motivos de saída, ${propriedadesCount} propriedades criadas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
