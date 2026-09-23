// Validação pós-carga da Pecuária v1 (domínio Rebanho) — checagens da seção
// "Carga inicial (IDEAGRI → v1)" do plano. Cada checagem imprime OK/FALHA;
// sai com código 1 se alguma checagem CRÍTICA falhar (checagens informativas
// nunca derrubam o processo, só reportam).
//
//   pnpm --filter rionovo-server run validar:pecuaria

import { prisma } from "../db.js";
import { calcularCategoria } from "../services/pecuaria/rebanho/categoria.calc.js";

let falhas = 0;

function ok(msg: string) {
  console.log(`  OK   ${msg}`);
}
function falha(msg: string, critica = true) {
  console.log(`  ${critica ? "FALHA" : "AVISO"} ${msg}`);
  if (critica) falhas++;
}
function info(msg: string) {
  console.log(`  INFO ${msg}`);
}

const TEM_A_COM_TIL = /Ã/;

async function main() {
  console.log("=== Validação da carga da Pecuária v1 ===\n");

  // ---- 1) total de animais e ativos ----------------------------------------
  const totalAnimais = await prisma.animal.count();
  const totalSaidasAbertas = await prisma.saidaAnimal.count({ where: { estornadaEm: null } });
  const ativos = totalAnimais - totalSaidasAbertas;
  console.log(`1) Contagem`);
  info(`total de animais: ${totalAnimais}`);
  info(`ativos: ${ativos} / inativos (saída não estornada): ${totalSaidasAbertas}`);

  // ---- 2) nenhum texto com "Ã" (encoding quebrado) ---------------------------
  console.log(`\n2) Encoding`);
  const animaisComMojibake = await prisma.animal.findMany({
    where: { OR: [{ nome: { contains: "Ã" } }, { brinco: { contains: "Ã" } }] },
    select: { id: true, brinco: true, nome: true },
  });
  const lotesComMojibake = await prisma.lote.findMany({ where: { nome: { contains: "Ã" } }, select: { id: true, nome: true } });
  const motivosComMojibake = await prisma.motivoSaida.findMany({ where: { nome: { contains: "Ã" } }, select: { id: true, nome: true } });
  const totalMojibake = animaisComMojibake.length + lotesComMojibake.length + motivosComMojibake.length;
  if (totalMojibake === 0) {
    ok(`nenhum "Ã" em nome/brinco de animal, lote ou motivo`);
  } else {
    falha(`${totalMojibake} registros com "Ã" (encoding quebrado): ${animaisComMojibake.length} animais, ${lotesComMojibake.length} lotes, ${motivosComMojibake.length} motivos`);
    for (const a of animaisComMojibake.slice(0, 10)) console.log(`       animal ${a.brinco}: "${a.nome}"`);
  }

  // ---- 3) todo animal ativo com exatamente 1 localização/destino aberto -----
  console.log(`\n3) Localização e destino abertos (animais ativos)`);
  const animaisAtivos = await prisma.animal.findMany({
    where: { saidas: { none: { estornadaEm: null } } },
    select: {
      id: true,
      brinco: true,
      _count: { select: { localizacoes: true } },
      localizacoes: { where: { ate: null }, select: { id: true } },
      destinos: { where: { ate: null }, select: { id: true } },
    },
  });
  const semLocalizacaoAberta = animaisAtivos.filter((a) => a.localizacoes.length !== 1);
  const semDestinoAberto = animaisAtivos.filter((a) => a.destinos.length !== 1);
  if (semLocalizacaoAberta.length === 0) {
    ok(`todos os ${animaisAtivos.length} animais ativos têm exatamente 1 localização aberta`);
  } else {
    falha(`${semLocalizacaoAberta.length} animais ativos sem localização aberta única (0 ou 2+)`);
    for (const a of semLocalizacaoAberta.slice(0, 10)) console.log(`       ${a.brinco}: ${a.localizacoes.length} localizações abertas`);
  }
  if (semDestinoAberto.length === 0) {
    ok(`todos os ${animaisAtivos.length} animais ativos têm exatamente 1 destino aberto`);
  } else {
    falha(`${semDestinoAberto.length} animais ativos sem destino aberto único (0 ou 2+)`);
    for (const a of semDestinoAberto.slice(0, 10)) console.log(`       ${a.brinco}: ${a.destinos.length} destinos abertos`);
  }

  // ---- 4) nenhum animal sem localização (nenhuma linha, nem histórico) ------
  console.log(`\n4) Animal sem localização (nenhuma linha, histórica ou aberta)`);
  const semLocalizacaoNenhuma = await prisma.animal.findMany({
    where: { localizacoes: { none: {} } },
    select: { id: true, brinco: true },
  });
  if (semLocalizacaoNenhuma.length === 0) {
    ok(`nenhum animal sem localização`);
  } else {
    falha(`${semLocalizacaoNenhuma.length} animais sem NENHUMA localização registrada`);
    for (const a of semLocalizacaoNenhuma.slice(0, 10)) console.log(`       ${a.brinco}`);
  }

  // ---- 5) 0 animais em "Fazenda Demonstração" --------------------------------
  console.log(`\n5) Propriedade "Fazenda Demonstração"`);
  const demo = await prisma.propriedade.findFirst({ where: { nome: "Fazenda Demonstração" } });
  if (!demo) {
    ok(`propriedade "Fazenda Demonstração" não existe`);
  } else {
    const naDemo = await prisma.localizacaoAnimal.count({ where: { propriedadeId: demo.id } });
    if (naDemo === 0) {
      ok(`0 animais em "Fazenda Demonstração"`);
    } else {
      falha(`${naDemo} localizações apontando para "Fazenda Demonstração"`);
    }
  }

  // ---- 6) brinco único por sítio entre ativos --------------------------------
  console.log(`\n6) Brinco único por sítio entre ativos`);
  const localizacoesAbertas = await prisma.localizacaoAnimal.findMany({
    where: { ate: null },
    select: { propriedadeId: true, propriedade: { select: { nome: true } }, animal: { select: { id: true, brinco: true } } },
  });
  const saidasAbertasIds = new Set(
    (await prisma.saidaAnimal.findMany({ where: { estornadaEm: null }, select: { animalId: true } })).map((s) => s.animalId),
  );
  const porChave = new Map<string, { propriedadeNome: string; brinco: string; count: number }>();
  for (const l of localizacoesAbertas) {
    if (saidasAbertasIds.has(l.animal.id)) continue;
    const chave = `${l.propriedadeId}\u0000${l.animal.brinco.trim().toUpperCase()}`;
    const atual = porChave.get(chave);
    if (atual) atual.count++;
    else porChave.set(chave, { propriedadeNome: l.propriedade.nome, brinco: l.animal.brinco, count: 1 });
  }
  const duplicados = [...porChave.values()].filter((v) => v.count > 1);
  if (duplicados.length === 0) {
    ok(`nenhum brinco duplicado entre ativos do mesmo sítio`);
  } else {
    // regra de unicidade é do app, não do banco (o IDEAGRI não a tinha) — informativo, não derruba a validação
    falha(`${duplicados.length} brincos duplicados entre ativos do mesmo sítio (esperado no dado do IDEAGRI)`, false);
    for (const dup of duplicados) console.log(`       ${dup.propriedadeNome}: brinco "${dup.brinco}" × ${dup.count}`);
  }

  // ---- 7) distribuição de categorias calculadas + novilhas sem partos -------
  console.log(`\n7) Categorias calculadas (informativo)`);
  const todosAtivosDetalhe = await prisma.animal.findMany({
    where: { saidas: { none: { estornadaEm: null } } },
    select: { sexo: true, dataNascimento: true, partosAntesDaEntrada: true },
  });
  const hoje = new Date();
  const distribuicao = new Map<string, number>();
  let novilhasSemParto = 0;
  for (const a of todosAtivosDetalhe) {
    const categoria = calcularCategoria({ sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada, hoje });
    distribuicao.set(categoria, (distribuicao.get(categoria) ?? 0) + 1);
    if (categoria === "NOVILHA" && a.partosAntesDaEntrada === 0) novilhasSemParto++;
  }
  for (const [categoria, count] of [...distribuicao.entries()].sort((x, y) => y[1] - x[1])) {
    info(`${categoria}: ${count}`);
  }
  info(`fêmeas ≥12 meses sem partos (novilhas): ${novilhasSemParto}`);

  // ---- 8) composição: soma ≤ 64 para todos -----------------------------------
  console.log(`\n8) Composição racial (soma ≤ 64)`);
  const somasPorAnimal = await prisma.composicaoRacial.groupBy({
    by: ["animalId"],
    _sum: { fracao64: true },
  });
  const acimaDe64 = somasPorAnimal.filter((s) => (s._sum.fracao64 ?? 0) > 64);
  if (acimaDe64.length === 0) {
    ok(`soma da composição ≤ 64 para todos os ${somasPorAnimal.length} animais com composição`);
  } else {
    falha(`${acimaDe64.length} animais com soma de composição > 64`);
    for (const s of acimaDe64.slice(0, 10)) console.log(`       animalId ${s.animalId}: soma ${s._sum.fracao64}`);
  }

  // ---- 9) saídas ativas apontam a linha que fecharam (base do estorno) ------
  console.log(`\n9) Saídas ativas com localização fechada registrada`);
  const saidasSemLinha = await prisma.saidaAnimal.count({
    where: { estornadaEm: null, localizacaoFechadaId: null, animal: { localizacoes: { some: {} } } },
  });
  if (saidasSemLinha === 0) ok(`toda saída ativa registra a localização que fechou`);
  else falha(`${saidasSemLinha} saídas ativas sem localizacaoFechadaId (o estorno não saberia o que reabrir)`);

  console.log(`\n=== ${falhas === 0 ? "Validação OK" : `${falhas} checagem(ns) crítica(s) com FALHA`} ===`);
  await prisma.$disconnect();
  if (falhas > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
