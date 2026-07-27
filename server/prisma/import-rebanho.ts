// Importador do rebanho REAL do Ideagri.
//
// Consome `server/prisma/rebanho_real.json` (gerado por `scripts/extract-rebanho.sh`
// a partir do Firebird do Ideagri: 631 animais — 522 ativos + 109 baixados —, 103 em
// lactação, 1.621 controles) e substitui o rebanho de demonstração pelo real da fazenda.
//
// Espelha o pipeline do financeiro (extração → JSON → importador): aqui só lemos o JSON
// commitado e populamos Animal + ResumoAnimal + Lactacao (histórico completo) + ControleLeiteiro,
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
import { importarIatfLegado, type DadosIatfLegado } from "../src/services/rebanho/import-iatf.js";
import { importarGeneticaLegado, type DadosGeneticaLegado } from "../src/services/rebanho/import-genetica.js";
import { semearResultadosGinecologicos, type ResultadoGinecologicoSeed } from "../src/services/rebanho/exame-ginecologico.js";

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
  maeNumero: string | null;
  paiNome: string | null;
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
  ideagriId: number;
  ideagriEmbriaoId: number | null;
  doadoraNumero: string | null;
  doadoraNome: string | null;
  tipo: "CIO" | "INSEMINACAO" | "COBERTURA" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO";
  data: string;
  reprodutor: string | null;
  resultado: string | null;
  dtPartoPrevista: string | null;
  tipoParto: string | null;
  auxilioParto: string | null;
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
interface PesagemJson {
  numero: string;
  data: string;
  peso: number;
  gmd: number | null;
}
interface LactacaoJson {
  numero: string;
  ordem: number | null;
  dtInicio: string;
  dtFim: string | null;
  motivoSecagem: string | null;
  tipoAleitamento: string | null;
  induzida: boolean;
  producaoTotal: number | null;
  producao305: number | null;
  duracaoDias: number | null;
}
interface RebanhoJson extends DadosIatfLegado, DadosGeneticaLegado {
  geradoEm: string;
  animais: AnimalJson[];
  controles: ControleJson[];
  eventos: EventoJson[];
  eventosSanitarios: EventoSanitarioJson[];
  pesagens: PesagemJson[];
  lactacoes?: LactacaoJson[];
  resultadosGinecologicos?: ResultadoGinecologicoSeed[];
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

  // --- Raça / Grupo (Grupo upsert; Raça mapeia a string crua pra raça pura existente) ---
  // A string crua do rebanho_real.json mistura raça + grau de sangue ("5/8 GL, HO").
  // Aqui resolvemos isso: cada string aponta pra raça pura primária via codigo + entra no grauSangue do animal.
  const racasPuras = await prisma.raca.findMany({ select: { id: true, nome: true, codigo: true } });
  const idPorCodigo = new Map(racasPuras.filter((r) => r.codigo).map((r) => [r.codigo!, r.id]));
  const idPorNome = new Map(racasPuras.map((r) => [r.nome, r.id]));

  function resolverRacaCrua(raw: string): number | null {
    if (idPorNome.has(raw)) return idPorNome.get(raw)!;
    const m = raw.match(/^\d+\/\d+\s+([A-Z]{2})/);
    if (m && idPorCodigo.has(m[1])) return idPorCodigo.get(m[1])!;
    // Fallback por prefixo de nome (ex.: "Girolando 5/8", "Holandês")
    const baixo = raw.toLowerCase();
    if (baixo.startsWith("girolando")) return idPorCodigo.get("GL") ?? null;
    if (baixo.startsWith("holandês") || baixo.startsWith("holandes")) return idPorCodigo.get("HO") ?? null;
    if (baixo.startsWith("gir leiteiro") || baixo.startsWith("gir ")) return idPorCodigo.get("GO") ?? null;
    if (baixo.startsWith("nelore")) return idPorCodigo.get("NE") ?? null;
    if (baixo.startsWith("jersey")) return idPorCodigo.get("JE") ?? null;
    return null;
  }

  const racaId = new Map<string, number>();
  for (const a of dados.animais) {
    if (a.raca && !racaId.has(a.raca)) {
      const id = resolverRacaCrua(a.raca);
      if (id != null) racaId.set(a.raca, id);
    }
  }
  const grupoNomes = new Set<string>();
  for (const a of dados.animais) if (a.grupo) grupoNomes.add(a.grupo);
  const grupoId = new Map<string, number>();
  for (const nome of grupoNomes) grupoId.set(nome, (await prisma.grupo.upsert({ where: { nome }, update: {}, create: { nome } })).id);
  console.log(`Cadastros: ${racaId.size} raças resolvidas, ${grupoId.size} grupos (upsert por nome).`);

  // --- Animais (createMany) -------------------------------------------------
  // Se a string crua não bate exato com o nome de uma raça pura, ela é um grau de sangue ("5/8 GL, HO")
  // e vai pro campo grauSangue. Caso contrário (ex.: "Holandês"), grauSangue fica null.
  const animaisRows = dados.animais.map((a) => ({
    numero: a.numero,
    nome: a.nome ?? null,
    sexo: a.sexo,
    categoria: a.categoria,
    racaId: a.raca ? racaId.get(a.raca) ?? null : null,
    grauSangue: a.raca && !idPorNome.has(a.raca) ? a.raca : null,
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
    paiNome: a.paiNome ?? null,
  }));
  await prisma.animal.createMany({ data: animaisRows });
  console.log(`Animais inseridos: ${animaisRows.length}.`);

  // numero → id (para resumos/lactações/controles)
  const idByNumero = new Map<string, number>();
  for (const a of await prisma.animal.findMany({ select: { id: true, numero: true } })) idByNumero.set(a.numero, a.id);

  // --- Genealogia: 2ª passada — linka maeId (mãe precisa já existir) -----------
  let maesLinkadas = 0;
  for (const a of dados.animais) {
    if (!a.maeNumero) continue;
    const filhoId = idByNumero.get(a.numero);
    const maeId = idByNumero.get(a.maeNumero);
    if (filhoId != null && maeId != null && filhoId !== maeId) {
      await prisma.animal.update({ where: { id: filhoId }, data: { maeId } });
      maesLinkadas++;
    }
  }
  console.log(`Genealogia: ${maesLinkadas} mães linkadas.`);

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

  // --- Lactações (createMany) — histórico completo do Ideagri (LACTACAO) -----
  // Substitui a antiga "lactação aberta" derivada do resumo: agora vem o histórico
  // inteiro. Número = ORDEMLACTACAO quando presente; senão, ordem cronológica por
  // animal (1ª, 2ª…). Produção só existe na lactação corrente.
  const lactPorAnimal = new Map<string, LactacaoJson[]>();
  for (const l of dados.lactacoes ?? []) {
    if (!idByNumero.has(l.numero)) continue;
    const arr = lactPorAnimal.get(l.numero);
    if (arr) arr.push(l);
    else lactPorAnimal.set(l.numero, [l]);
  }
  const lactacaoRows: {
    animalId: number; numero: number; dtInicio: Date; dtFim: Date | null;
    motivoSecagem: string | null; tipoAleitamento: string | null; induzida: boolean;
    producaoTotal: number | null; producao305: number | null; duracaoDias: number | null;
  }[] = [];
  for (const [numero, lacts] of lactPorAnimal) {
    const animalId = idByNumero.get(numero)!;
    const ordenadas = [...lacts].sort((x, y) => x.dtInicio.localeCompare(y.dtInicio));
    ordenadas.forEach((l, i) => {
      lactacaoRows.push({
        animalId,
        numero: l.ordem ?? i + 1,
        dtInicio: d(l.dtInicio)!,
        dtFim: d(l.dtFim),
        motivoSecagem: l.motivoSecagem ?? null,
        tipoAleitamento: l.tipoAleitamento ?? null,
        induzida: l.induzida ?? false,
        producaoTotal: l.producaoTotal ?? null,
        producao305: l.producao305 ?? null,
        duracaoDias: l.duracaoDias ?? null,
      });
    });
  }
  await prisma.lactacao.createMany({ data: lactacaoRows });
  console.log(`Lactações inseridas: ${lactacaoRows.length}.`);

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
  // ideagriId = CDREPRODUCAO (unique). TE resolve doadora por número se estiver no rebanho.
  const eventoRows = (dados.eventos ?? [])
    .filter((e) => idByNumero.has(e.numero) && e.data && e.ideagriId != null)
    .map((e) => ({
      animalId: idByNumero.get(e.numero)!,
      ideagriId: e.ideagriId,
      ideagriEmbriaoId: e.ideagriEmbriaoId ?? null,
      doadoraNumero: e.doadoraNumero ?? null,
      doadoraNome: e.doadoraNome ?? null,
      doadoraId: e.doadoraNumero ? idByNumero.get(e.doadoraNumero) ?? null : null,
      tipo: e.tipo,
      data: d(e.data)!,
      reprodutor: e.reprodutor ?? null,
      resultado: e.resultado ?? null,
      dtPartoPrevista: d(e.dtPartoPrevista),
      tipoParto: e.tipoParto ?? null,
      auxilioParto: e.auxilioParto ?? null,
      numCrias: e.numCrias ?? null,
      // Split vivos/natimortos derivado do dicionário quando o fato não traz colunas próprias.
      criasVivas: e.tipo === "PARTO"
        ? (e.tipoParto === "4" ? 0 : e.tipoParto === "3" ? 0 : e.numCrias ?? null)
        : null,
      criasNatimortas: e.tipo === "PARTO"
        ? (e.tipoParto === "4" ? (e.numCrias ?? 0) : 0)
        : null,
      sexoCria: e.sexoCria ?? null,
      observacao: e.observacao ?? null,
    }));
  let eventosInseridos = 0;
  for (let i = 0; i < eventoRows.length; i += CHUNK) {
    const r = await prisma.eventoReprodutivo.createMany({ data: eventoRows.slice(i, i + CHUNK) });
    eventosInseridos += r.count;
  }

  // Receptoras: sticky a partir de qualquer TE importada.
  const receptoras = [...new Set(
    (dados.eventos ?? [])
      .filter((e) => e.tipo === "TRANSFERENCIA_EMBRIAO" && idByNumero.has(e.numero))
      .map((e) => idByNumero.get(e.numero)!),
  )];
  if (receptoras.length) {
    await prisma.animal.updateMany({ where: { id: { in: receptoras } }, data: { ehReceptora: true } });
  }
  console.log(`Receptoras marcadas: ${receptoras.length}.`);

  // --- Catálogo/programações/aplicações IATF (opcional, idempotente por id de origem) ---
  const iatf = await importarIatfLegado(prisma, dados, idByNumero);
  console.log(`IATF importado: ${iatf.protocolos} protocolos, ${iatf.principios} princípios, ${iatf.programacoes} programações, ${iatf.associacoes} associações.`);

  await semearResultadosGinecologicos(prisma, dados.resultadosGinecologicos ?? []);
  console.log(`Resultados ginecológicos importados: ${dados.resultadosGinecologicos?.length ?? 0}.`);

  // --- Genética estruturada/sêmen (opcional, idempotente por origem e transacional) ---
  const temBlocoGenetico = [
    dados.reprodutoresGeneticos, dados.indicadores, dados.valoresIndicador,
    dados.marcadores, dados.valoresMarcador, dados.caseinas, dados.valoresCaseina,
    dados.tiposSemen, dados.estoquesSemen, dados.pedigrees,
  ].some((bloco) => bloco != null);
  if (temBlocoGenetico) {
    const genetica = await importarGeneticaLegado(prisma, dados);
    console.log(
      `Genética/sêmen importados: ${genetica.reprodutores} reprodutores, ${genetica.indicadores} indicadores, `
      + `${genetica.valores} valores, ${genetica.marcadores} marcadores, ${genetica.caseinas} caseínas, `
      + `${genetica.tiposSemen} tipos de sêmen, ${genetica.estoques} estoques, ${genetica.pedigrees} pedigrees.`,
    );
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

  // --- Pesagens (createMany em lotes) — PESO do Ideagri --------------------------
  const pesagemRows = (dados.pesagens ?? [])
    .filter((p) => idByNumero.has(p.numero) && p.data && p.peso != null)
    .map((p) => ({ animalId: idByNumero.get(p.numero)!, data: d(p.data)!, peso: p.peso, gmd: p.gmd ?? null }));
  let pesagensInseridas = 0;
  for (let i = 0; i < pesagemRows.length; i += CHUNK) {
    const r = await prisma.pesagem.createMany({ data: pesagemRows.slice(i, i + CHUNK) });
    pesagensInseridas += r.count;
  }

  // --- Produtos aplicados → Cadastros (upsert por nome, p/ o usuário precificar) ---
  // Coleta os produtos distintos das aplicações e cria em Produto (tipo MEDICAMENTO)
  // SEM tocar no custoUnitario (preserva o que o usuário preencher). Idempotente.
  const produtosAplicados = new Set<string>();
  for (const e of dados.eventosSanitarios ?? [])
    if ((e.tipo === "APLICACAO" || e.tipo === "VACINA") && e.produto) produtosAplicados.add(e.produto);
  for (const nome of produtosAplicados) {
    await prisma.produto.upsert({ where: { nome }, update: {}, create: { nome, tipo: "MEDICAMENTO" } });
  }

  const emLactacao = resumoRows.filter((r) => r.del != null).length;
  console.log(`Import rebanho real: ${animaisRows.length} animais, ${emLactacao} em lactação, ${controlesInseridos} controles, ${lactacaoRows.length} lactações (histórico), ${eventosInseridos} eventos reprodutivos, ${sanitariosInseridos} sanitários, ${pesagensInseridas} pesagens, ${produtosAplicados.size} produtos aplicados (Cadastros).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
