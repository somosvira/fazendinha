/* Transformador: dump delimitado do Ideagri (scripts/rebanho-dump.sql) →
 * server/prisma/rebanho_real.json (consumido por import-rebanho.ts).
 *
 * Uso: node scripts/build-rebanho-json.mjs <dump.txt> [geradoEm-YYYY-MM-DD]
 * O dump é lido como latin1 (acentos do Firebird) e o JSON sai em UTF-8.
 * Funções puras exportadas para teste (node --test).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEP = "~|~";

// vazio → null
const s = (x) => (x == null || x === "" ? null : x);
// vazio → null, senão Number
const n = (x) => (x == null || x === "" ? null : Number(x));

export function categoriaDe(cd, sexo) {
  const m = { "7": "VACA", "6": "NOVILHA", "2": "TOURO", "3": "TOURO", "4": "TOURO" };
  if (m[cd]) return m[cd];
  // CD 1/5 = "em crescimento" → bezerra/bezerro por sexo. Qualquer outro CD cai
  // aqui também; avisa para que surpresas numa re-extração futura não passem caladas.
  if (cd !== "1" && cd !== "5") console.warn(`categoriaDe: CDCATEGORIA não mapeado: ${cd} (sexo=${sexo}) — usando fallback`);
  return sexo === "F" ? "BEZERRA" : "BEZERRO";
}

// Pelagem é cor; refino de composição racial fica deferido. Default Girolando
// (raça dominante do rebanho), usado quando a pelagem está vazia.
export function racaDe(pelagem) {
  return s(pelagem) ?? "Girolando";
}

export function diasEntre(de, ate) {
  const a = new Date(de + "T00:00:00Z").getTime();
  const b = new Date(ate + "T00:00:00Z").getTime();
  return Math.floor((b - a) / 86_400_000);
}

// Linha @A@ (sem o prefixo) → objeto animal. 15 campos.
// Setor (localização física, f12) e grupo (lote de manejo atual, f14) são
// dimensões DISTINTAS no Ideagri (ANIMALINFO_CADASTRO.SETOR vs .GRUPO).
export function parseAnimal(linha) {
  const f = linha.split(SEP);
  const sexo = f[2];
  return {
    numero: f[0],
    nome: s(f[1]),
    sexo,
    categoria: categoriaDe(f[3], sexo),
    dataNascimento: s(f[4]),
    dataEntrada: s(f[5]),
    brincoEletronico: s(f[6]),
    sisbov: s(f[7]),
    numPartosEntrada: n(f[8]) ?? 0,
    status: f[9] === "BAIXADO" ? "BAIXADO" : "ATIVO",
    dataBaixa: s(f[10]),
    motivoBaixa: s(f[11]),
    setor: s(f[12]),
    raca: racaDe(f[13]),
    grupo: s(f[14]), // lote de manejo (null = "sem grupo")
  };
}

export function derivarStatusRepro(repro, del) {
  if (repro && repro.ultimoDgResultado === "positivo") return "PRENHE";
  if (del != null && del < 60) return "PEV";
  return "VAZIA";
}

// Lactação aberta sse há início e não houve secagem posterior a ele.
export function delEStatusLactacao(prod, hoje) {
  const ini = s(prod?.dtInicioUltLac);
  if (!ini) return { del: null, lactacaoAberta: null };
  const sec = s(prod?.dtUltSecagem);
  const aberta = !sec || sec < ini;
  if (!aberta) return { del: null, lactacaoAberta: null };
  return { del: diasEntre(ini, hoje), lactacaoAberta: { dtInicio: ini } };
}

function parseProducao(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    ordemLactacao: n(f[1]),
    mediaProdLacAtual: n(f[2]),
    producao305: n(f[3]),
    ccs: n(f[4]),
    previsaoSecagem: s(f[5]),
    dtInicioUltLac: s(f[6]),
    dtUltSecagem: s(f[7]),
  };
}

function parseReproducao(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    ultimoDgData: s(f[1]),
    ultimoDgResultado: f[2] === "P" ? "positivo" : f[2] === "N" ? "negativo" : null,
    iepProjetado: n(f[3]),
    dtPrevParto: s(f[4]),
  };
}

function parseControle(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    data: s(f[1]),
    peso1: n(f[2]),
    peso2: n(f[3]),
    peso3: n(f[4]),
    pesoTotal: n(f[5]),
  };
}

// CDTIPOREPRODUCAO → TipoEventoReprodutivo (1/2/3 IA-cobertura-TE, 4 diagnóstico, 7 parto).
// Não há CIO nem SECAGEM em REPRODUCAO (deferidos).
const TIPO_EV = { "1": "INSEMINACAO", "2": "INSEMINACAO", "3": "INSEMINACAO", "4": "DIAGNOSTICO", "7": "PARTO" };
export function parseEvento(linha) {
  const f = linha.split(SEP);
  const cdtipo = f[1];
  const tipo = TIPO_EV[cdtipo] ?? "INSEMINACAO";
  const observacao = cdtipo === "2" ? "Cobertura (monta natural)" : cdtipo === "3" ? "Transferência de embrião" : null;
  return {
    numero: f[0],
    tipo,
    data: s(f[2]),
    reprodutor: s(f[3]),
    resultado: cdtipo === "4" ? (f[4] === "P" ? "positivo" : f[4] === "N" ? "negativo" : null) : null,
    dtPartoPrevista: s(f[5]),
    tipoParto: cdtipo === "7" ? s(f[6]) : null,
    numCrias: cdtipo === "7" ? n(f[7]) : null,
    sexoCria: cdtipo === "7" ? s(f[8]) : null,
    observacao,
  };
}

// DOENCAANIMAL → EventoSanitario OCORRENCIA. Campos: numero, doenca, dtInicio, dtFim, diasTrat, obs.
export function parseDoenca(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    tipo: "OCORRENCIA",
    data: s(f[2]),
    doenca: s(f[1]),
    dtFim: s(f[3]),
    diasTratamento: n(f[4]),
    observacao: s(f[5]),
  };
}

// APLICACAOPRODUTO → EventoSanitario APLICACAO. Campos: numero, produto, data, dose, carencia, obs.
export function parseAplicacao(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    tipo: "APLICACAO",
    data: s(f[2]),
    produto: s(f[1]),
    dose: s(f[3]),
    carencia: n(f[4]),
    observacao: s(f[5]),
  };
}

// ANALISELEITE → EventoSanitario EXAME. Campos: numero, data, ccs, gordura, proteina, obs.
export function parseAnalise(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    tipo: "EXAME",
    data: s(f[1]),
    ccs: n(f[2]),
    gordura: n(f[3]),
    proteina: n(f[4]),
    observacao: s(f[5]),
  };
}

// MAMITE → EventoSanitario MASTITE. Quartos AD/AE/PD/PE (não-vazios) → "AD, PE"; micro → cultivo.
const QUARTOS = ["AD", "AE", "PD", "PE"];
export function parseMamite(linha) {
  const f = linha.split(SEP);
  const quartos = QUARTOS.filter((_, i) => s(f[2 + i]) != null);
  return {
    numero: f[0],
    tipo: "MASTITE",
    data: s(f[1]),
    quarto: quartos.length ? quartos.join(", ") : null,
    resultadoCultivo: s(f[6]),
    observacao: s(f[7]),
  };
}

function diasGestacao(repro, hoje) {
  if (!repro || repro.ultimoDgResultado !== "positivo" || !repro.dtPrevParto) return null;
  const faltam = diasEntre(hoje, repro.dtPrevParto); // pode ser negativo
  const g = 283 - faltam; // gestação ~283d
  if (g < 0 || g > 300) return null;
  return g;
}

function montarResumo(prod, repro, hoje) {
  const { del, lactacaoAberta } = delEStatusLactacao(prod, hoje);
  const statusReprodutivo = derivarStatusRepro(repro, del);
  return {
    statusReprodutivo,
    del,
    ordemLactacao: prod?.ordemLactacao ?? null,
    // produção média só faz sentido para vaca em lactação
    producaoMediaDia: del != null ? (prod?.mediaProdLacAtual ?? null) : null,
    producao305: prod?.producao305 ?? null,
    ccs: prod?.ccs ?? null,
    ccsTendencia: null,
    producaoTendencia: null,
    ultimoDgData: repro?.ultimoDgData ?? null,
    ultimoDgResultado: repro?.ultimoDgResultado ?? null,
    iepProjetado: repro?.iepProjetado ?? null,
    diasGestacao: diasGestacao(repro, hoje),
    previsaoSecagem: prod?.previsaoSecagem ?? null,
    ...(lactacaoAberta ? { lactacaoAberta } : {}),
  };
}

function main() {
  const dumpPath = process.argv[2];
  const geradoEm = process.argv[3] ?? "2026-06-17";
  if (!dumpPath) { console.error("uso: build-rebanho-json.mjs <dump.txt> [geradoEm]"); process.exit(1); }

  const linhas = readFileSync(dumpPath, "latin1").split("\n").map((l) => l.replace(/\r$/, "").replace(/\s+$/, ""));
  const animais = [];
  const prodPorNum = new Map();
  const reproPorNum = new Map();
  const controles = [];
  const eventos = [];
  const eventosSanitarios = [];

  for (const l of linhas) {
    if (l.startsWith("@A@")) animais.push(parseAnimal(l.slice(3)));
    else if (l.startsWith("@P@")) { const p = parseProducao(l.slice(3)); prodPorNum.set(p.numero, p); }
    else if (l.startsWith("@R@")) { const r = parseReproducao(l.slice(3)); reproPorNum.set(r.numero, r); }
    else if (l.startsWith("@L@")) controles.push(parseControle(l.slice(3)));
    else if (l.startsWith("@E@")) eventos.push(parseEvento(l.slice(3)));
    else if (l.startsWith("@D@")) eventosSanitarios.push(parseDoenca(l.slice(3)));
    else if (l.startsWith("@V@")) eventosSanitarios.push(parseAplicacao(l.slice(3)));
    else if (l.startsWith("@Q@")) eventosSanitarios.push(parseAnalise(l.slice(3)));
    else if (l.startsWith("@M@")) eventosSanitarios.push(parseMamite(l.slice(3)));
  }

  const grupos = new Set(); // grupo = lote de manejo real (ANIMALINFO_CADASTRO.GRUPO)
  for (const a of animais) {
    if (a.grupo) grupos.add(a.grupo);
    a.resumo = montarResumo(prodPorNum.get(a.numero), reproPorNum.get(a.numero), geradoEm);
  }

  const out = { geradoEm, animais, controles, eventos, eventosSanitarios };
  const dest = fileURLToPath(new URL("../server/prisma/rebanho_real.json", import.meta.url));
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

  const ativos = animais.filter((a) => a.status === "ATIVO");
  const cnt = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
  console.error(`Gerado ${dest}`);
  console.error(`  animais=${animais.length} (ATIVO=${ativos.length} BAIXADO=${animais.length - ativos.length})`);
  console.error(`  ativos por categoria: ${JSON.stringify(cnt(ativos, "categoria"))}`);
  console.error(`  em lactação=${animais.filter((a) => a.resumo.del != null).length} · controles=${controles.length}`);
  console.error(`  eventos reprodutivos=${eventos.length} ${JSON.stringify(cnt(eventos, "tipo"))}`);
  console.error(`  eventos sanitários=${eventosSanitarios.length} ${JSON.stringify(cnt(eventosSanitarios, "tipo"))}`);
}

// roda main() só quando executado direto (não nos testes)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
