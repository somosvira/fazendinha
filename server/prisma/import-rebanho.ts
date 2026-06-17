// Importador do rebanho REAL do Ideagri.
//
// Consome `server/prisma/rebanho_real.json` (gerado por `scripts/extract-rebanho.sh`
// a partir do Firebird do Ideagri: 631 animais — 522 ativos + 109 baixados —, 103 em
// lactação, 1.621 controles) e substitui o rebanho de demonstração pelo real da fazenda.
//
// Espelha o pipeline do financeiro (extração → JSON → importador): aqui só lemos o JSON
// commitado e populamos Animal + ResumoAnimal + Lactacao (aberta) + ControleLeiteiro,
// com upsert de Raca/Grupo por nome.
//
// Ordem recomendada de execução (worktree/dev):
//   1) `pnpm --filter rionovo-server run seed:rebanho`  → cria Produtos/Dietas/Grupos/Estoque (demo)
//   2) `pnpm --filter rionovo-server run import:rebanho` → SUBSTITUI os animais pelo rebanho real,
//      preservando Produtos/MovimentoEstoque/Lancamento/Dieta. Os Grupos são reaproveitados por
//      nome (ids mantidos → FKs do Estoque continuam válidas) e os novos grupos são criados.
//
// Idempotente: rodar 2× resulta no mesmo estado (824 animais / ~103 em lactação / 1621 controles),
// não duplica.

import { readFileSync } from "node:fs";
import { PrismaClient, SexoAnimal, CategoriaAnimal, StatusAnimal, StatusReprodutivo } from "@prisma/client";

const prisma = new PrismaClient();

// ---- Contrato do JSON ------------------------------------------------------
interface ResumoJson {
  statusReprodutivo: StatusReprodutivo;
  del: number | null;
  ordemLactacao: number | null;
  producaoMediaDia: number | null;
  producao305: number | null;
  ccs: number | null;
  ultimoDgData: string | null;
  ultimoDgResultado: string | null;
  iepProjetado: number | null;
  diasGestacao: number | null;
  previsaoSecagem: string | null;
  lactacaoAberta?: { dtInicio: string } | null;
}
interface AnimalJson {
  numero: string;
  nome: string | null;
  sexo: SexoAnimal;
  categoria: CategoriaAnimal;
  dataNascimento: string | null;
  dataEntrada: string | null;
  brincoEletronico: string | null;
  sisbov: string | null;
  numPartosEntrada: number | null;
  status: StatusAnimal;
  dataBaixa: string | null;
  motivoBaixa: string | null;
  setor: string | null;
  raca: string | null;
  grupo: string | null;
  resumo: ResumoJson;
}
interface ControleJson {
  numero: string;
  data: string;
  peso1: number | null;
  peso2: number | null;
  peso3: number | null;
  pesoTotal: number;
}
interface EventoJson {
  numero: string;
  tipo: "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM";
  data: string;
  reprodutor: string | null;
  resultado: string | null;
  dtPartoPrevista: string | null;
  tipoParto: string | null;
  numCrias: number | null;
  sexoCria: string | null;
  observacao: string | null;
}
interface EventoSanitarioJson {
  numero: string;
  tipo: "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA";
  data: string;
  doenca?: string | null;
  dtFim?: string | null;
  diasTratamento?: number | null;
  produto?: string | null;
  dose?: string | null;
  carencia?: number | null;
  ccs?: number | null;
  gordura?: number | null;
  proteina?: number | null;
  quarto?: string | null;
  resultadoCultivo?: string | null;
  observacao?: string | null;
}
interface RebanhoJson {
  geradoEm: string;
  animais: AnimalJson[];
  controles: ControleJson[];
  eventos: EventoJson[];
  eventosSanitarios: EventoSanitarioJson[];
}

// datas vêm como "YYYY-MM-DD" (campos @db.Date) — fixar em UTC para não escorregar de dia
const d = (s: string | null | undefined): Date | null => (s ? new Date(`${s}T00:00:00Z`) : null);

async function main() {
  const dados: RebanhoJson = JSON.parse(readFileSync(new URL("./rebanho_real.json", import.meta.url), "utf-8"));
  console.log(`Lendo rebanho real (geradoEm ${dados.geradoEm}): ${dados.animais.length} animais, ${dados.controles.length} controles.`);

  // --- Limpa o rebanho atual (cascatas cuidam dos filhos de Animal) ---------
  // ProducaoLote é dado de tanque (não ligado a Animal) → limpar à parte.
  // NÃO tocamos em Produto / MovimentoEstoque / Lancamento / Dieta.
  // NÃO deletamos Grupo (referenciado por MovimentoEstoque.grupoId) — só upsert por nome.
  console.log("Limpando rebanho de demonstração...");
  await prisma.producaoLote.deleteMany({});
  await prisma.animal.deleteMany({}); // cascade → controleLeiteiro/eventos/lactacao/resumo

  // --- Raça / Grupo (upsert por nome; mantém ids existentes → FKs do Estoque) ---
  const racaNomes = new Set<string>();
  const grupoNomes = new Set<string>();
  for (const a of dados.animais) {
    if (a.raca) racaNomes.add(a.raca);
    if (a.grupo) grupoNomes.add(a.grupo);
  }
  const racaId = new Map<string, number>();
  for (const nome of racaNomes) racaId.set(nome, (await prisma.raca.upsert({ where: { nome }, update: {}, create: { nome } })).id);
  const grupoId = new Map<string, number>();
  for (const nome of grupoNomes) grupoId.set(nome, (await prisma.grupo.upsert({ where: { nome }, update: {}, create: { nome } })).id);
  console.log(`Cadastros: ${racaId.size} raças, ${grupoId.size} grupos (upsert por nome).`);

  // --- Animais (createMany) -------------------------------------------------
  const animaisRows = dados.animais.map((a) => ({
    numero: a.numero,
    nome: a.nome ?? null,
    sexo: a.sexo,
    categoria: a.categoria,
    racaId: a.raca ? racaId.get(a.raca)! : null,
    grupoId: a.grupo ? grupoId.get(a.grupo)! : null,
    setor: a.setor ?? null,
    dataNascimento: d(a.dataNascimento),
    // dataEntrada é obrigatória: fallback nascimento → geradoEm
    dataEntrada: d(a.dataEntrada) ?? d(a.dataNascimento) ?? d(dados.geradoEm)!,
    brincoEletronico: a.brincoEletronico ?? null,
    sisbov: a.sisbov ?? null,
    numPartosEntrada: a.numPartosEntrada ?? 0,
    status: a.status,
    dataBaixa: d(a.dataBaixa),
    motivoBaixa: a.motivoBaixa ?? null,
  }));
  await prisma.animal.createMany({ data: animaisRows });
  console.log(`Animais inseridos: ${animaisRows.length}.`);

  // numero → id (para resumos/lactações/controles)
  const idByNumero = new Map<string, number>();
  for (const a of await prisma.animal.findMany({ select: { id: true, numero: true } })) idByNumero.set(a.numero, a.id);

  // --- ResumoAnimal (createMany) -------------------------------------------
  const resumoRows = dados.animais.map((a) => {
    const r = a.resumo;
    return {
      animalId: idByNumero.get(a.numero)!,
      statusReprodutivo: r.statusReprodutivo,
      del: r.del,
      ordemLactacao: r.ordemLactacao,
      producaoMediaDia: r.producaoMediaDia,
      producao305: r.producao305,
      producaoTendencia: null,
      ccs: r.ccs,
      ccsTendencia: null,
      ultimoDgData: d(r.ultimoDgData),
      ultimoDgResultado: r.ultimoDgResultado,
      iepProjetado: r.iepProjetado,
      diasGestacao: r.diasGestacao,
      previsaoSecagem: d(r.previsaoSecagem),
    };
  });
  await prisma.resumoAnimal.createMany({ data: resumoRows });
  console.log(`Resumos inseridos: ${resumoRows.length}.`);

  // --- Lactação aberta (createMany) — só para quem está em lactação ---------
  const lactacaoRows = dados.animais
    .filter((a) => a.resumo.lactacaoAberta)
    .map((a) => ({
      animalId: idByNumero.get(a.numero)!,
      numero: a.resumo.ordemLactacao ?? 1,
      dtInicio: d(a.resumo.lactacaoAberta!.dtInicio)!,
      dtFim: null,
    }));
  await prisma.lactacao.createMany({ data: lactacaoRows });

  // --- Controles leiteiros (createMany em lotes) ----------------------------
  const controleRows = dados.controles
    .filter((c) => idByNumero.has(c.numero))
    .map((c) => ({
      animalId: idByNumero.get(c.numero)!,
      data: d(c.data)!,
      peso1: c.peso1,
      peso2: c.peso2,
      peso3: c.peso3,
      pesoTotal: c.pesoTotal,
      origem: "ideagri",
    }));
  const CHUNK = 500;
  let controlesInseridos = 0;
  for (let i = 0; i < controleRows.length; i += CHUNK) {
    const r = await prisma.controleLeiteiro.createMany({ data: controleRows.slice(i, i + CHUNK) });
    controlesInseridos += r.count;
  }

  // --- Eventos reprodutivos (createMany em lotes) — REPRODUCAO do Ideagri -----
  const eventoRows = (dados.eventos ?? [])
    .filter((e) => idByNumero.has(e.numero) && e.data)
    .map((e) => ({
      animalId: idByNumero.get(e.numero)!,
      tipo: e.tipo,
      data: d(e.data)!,
      reprodutor: e.reprodutor ?? null,
      resultado: e.resultado ?? null,
      dtPartoPrevista: d(e.dtPartoPrevista),
      tipoParto: e.tipoParto ?? null,
      numCrias: e.numCrias ?? null,
      sexoCria: e.sexoCria ?? null,
      observacao: e.observacao ?? null,
    }));
  let eventosInseridos = 0;
  for (let i = 0; i < eventoRows.length; i += CHUNK) {
    const r = await prisma.eventoReprodutivo.createMany({ data: eventoRows.slice(i, i + CHUNK) });
    eventosInseridos += r.count;
  }

  // --- Eventos sanitários (createMany em lotes) — DOENCAANIMAL + APLICACAOPRODUTO ---
  const sanitarioRows = (dados.eventosSanitarios ?? [])
    .filter((e) => idByNumero.has(e.numero) && e.data)
    .map((e) => ({
      animalId: idByNumero.get(e.numero)!,
      tipo: e.tipo,
      data: d(e.data)!,
      doenca: e.doenca ?? null,
      dtFim: d(e.dtFim),
      diasTratamento: e.diasTratamento ?? null,
      produto: e.produto ?? null,
      dose: e.dose ?? null,
      carencia: e.carencia ?? null,
      ccs: e.ccs ?? null,
      gordura: e.gordura ?? null,
      proteina: e.proteina ?? null,
      quarto: e.quarto ?? null,
      resultadoCultivo: e.resultadoCultivo ?? null,
      observacao: e.observacao ?? null,
    }));
  let sanitariosInseridos = 0;
  for (let i = 0; i < sanitarioRows.length; i += CHUNK) {
    const r = await prisma.eventoSanitario.createMany({ data: sanitarioRows.slice(i, i + CHUNK) });
    sanitariosInseridos += r.count;
  }

  const emLactacao = resumoRows.filter((r) => r.del != null).length;
  console.log(`Import rebanho real: ${animaisRows.length} animais, ${emLactacao} em lactação, ${controlesInseridos} controles (${lactacaoRows.length} lactações abertas), ${eventosInseridos} eventos reprodutivos, ${sanitariosInseridos} sanitários.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
