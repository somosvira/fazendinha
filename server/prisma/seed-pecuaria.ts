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

  // Motivos de baixa
  // Classificação por tipo de saída: DESCARTE_VOLUNTARIO, DESCARTE_INVOLUNTARIO, MORTE
  const motivos = [
    // DESCARTE_VOLUNTARIO
    { nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO" },
    { nome: "Idade avançada", classe: "DESCARTE_VOLUNTARIO" },
    { nome: "Excedente de animais", classe: "DESCARTE_VOLUNTARIO" },
    { nome: "Bezerro macho", classe: "DESCARTE_VOLUNTARIO" },
    { nome: "Temperamento / ordenha difícil", classe: "DESCARTE_VOLUNTARIO" },
    // DESCARTE_INVOLUNTARIO
    { nome: "Infertilidade / repetição de cio", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Aborto", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Mastite crônica", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Casco / locomoção", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Úbere / tetos", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Doença crônica", classe: "DESCARTE_INVOLUNTARIO" },
    { nome: "Lesão / acidente", classe: "DESCARTE_INVOLUNTARIO" },
    // MORTE
    { nome: "Acidente", classe: "MORTE" },
    { nome: "Anaplasmose", classe: "MORTE" },
    { nome: "Babesia bovis", classe: "MORTE" },
    { nome: "Clostridioses", classe: "MORTE" },
    { nome: "Doenças bacterianas", classe: "MORTE" },
    { nome: "Pneumonia", classe: "MORTE" },
    { nome: "Mastite ambiental", classe: "MORTE" },
    { nome: "Prolapso uterino", classe: "MORTE" },
    { nome: "Complicações pós-parto", classe: "MORTE" },
    { nome: "Intoxicação com ureia", classe: "MORTE" },
    { nome: "Desconhecida/Indefinida", classe: "MORTE" },
    { nome: "Outras", classe: "MORTE" },
    { nome: "Tripanossoma", classe: "MORTE" },
    { nome: "Peritonite", classe: "MORTE" },
    { nome: "Septicemia", classe: "MORTE" },
    { nome: "Intoxicação por plantas tóxicas", classe: "MORTE" },
    { nome: "Botulismo", classe: "MORTE" },
  ];

  let motivosCount = 0;
  for (const motivo of motivos) {
    const existente = await prisma.motivoBaixa.findFirst({ where: { nome: motivo.nome } });
    if (existente) {
      await prisma.motivoBaixa.update({
        where: { id: existente.id },
        data: { classe: motivo.classe as any, ativo: true },
      });
    } else {
      await prisma.motivoBaixa.create({
        data: { nome: motivo.nome, classe: motivo.classe as any, ativo: true },
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

  console.log(`Seed pecuaria ok: ${racasCount} raças, ${motivosCount} motivos de baixa, ${propriedadesCount} propriedades criadas.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
