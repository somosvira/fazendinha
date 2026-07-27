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

// Composição racial real do animal (ANIMALINFO_CADASTRO.RACA: "1/2 GL, GO",
// "3/4 HO, GL", "Nelore", "Girolando"…). Default "Girolando" quando vazia.
export function racaDe(raca) {
  return s(raca) ?? "Girolando";
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
    maeNumero: s(f[15]), // número da mãe (linkada no import se estiver no rebanho)
    paiNome: s(f[16]), // nome do pai/touro (string — pode ser sêmen, não animal)
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

// CDTIPOREPRODUCAO → TipoEventoReprodutivo (1 IA, 2 cobrição, 3 TE, 4 DG, 7 parto).
// Não há CIO nem SECAGEM em REPRODUCAO (deferidos). Código desconhecido → tipo null
// (main() aborta) — nunca colapsar TE/cobrição em INSEMINACAO.
const TIPO_EV = {
  "1": "INSEMINACAO",
  "2": "COBERTURA",
  "3": "TRANSFERENCIA_EMBRIAO",
  "4": "DIAGNOSTICO",
  "7": "PARTO",
};
const FINALIDADES_IATF = new Set(["IATF", "TETF"]);
const DIRECOES_INDICADOR = new Set(["maior_melhor", "menor_melhor"]);
const COLUNAS_LEGADAS_INDICADOR = new Set(["ptaLeite", "ptaGordura", "ptaProteina", "tpi"]);

function inteiroPositivo(valor) {
  const numero = n(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function textoObrigatorio(valor) {
  const texto = s(valor);
  return texto && texto.trim() ? texto : null;
}

export function parseReprodutorGenetico(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const nome = textoObrigatorio(f[1]);
  if (ideagriId == null || !nome) return null;
  return {
    ideagriId,
    nome,
    codigo: s(f[2]),
    racaSigla: s(f[3]),
    centralSigla: s(f[4]),
  };
}

export function parseIndicadorGenetico(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const sigla = textoObrigatorio(f[1]);
  const nome = textoObrigatorio(f[2]);
  const direcao = s(f[4]);
  const colunaLegada = s(f[5]);
  if (
    ideagriId == null
    || !sigla
    || !nome
    || !DIRECOES_INDICADOR.has(direcao)
    || (colunaLegada != null && !COLUNAS_LEGADAS_INDICADOR.has(colunaLegada))
  ) return null;
  return {
    ideagriId,
    sigla,
    nome,
    unidade: s(f[3]),
    direcao,
    colunaLegada,
    ranking: f[6] === "1",
  };
}

export function parseValorIndicador(linha) {
  const f = linha.split(SEP);
  const reprodutorIdeagriId = inteiroPositivo(f[0]);
  const indicadorSigla = textoObrigatorio(f[1]);
  const valor = n(f[2]);
  if (reprodutorIdeagriId == null || !indicadorSigla || !Number.isFinite(valor)) return null;
  return { reprodutorIdeagriId, indicadorSigla, valor };
}

export function parseMarcador(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const sigla = textoObrigatorio(f[1]);
  const nome = textoObrigatorio(f[2]);
  if (ideagriId == null || !sigla || !nome) return null;
  return { ideagriId, sigla, nome };
}

export function parseValorMarcador(linha) {
  const f = linha.split(SEP);
  const reprodutorIdeagriId = inteiroPositivo(f[0]);
  const marcadorSigla = textoObrigatorio(f[1]);
  const resultado = textoObrigatorio(f[2]);
  if (reprodutorIdeagriId == null || !marcadorSigla || !resultado) return null;
  return { reprodutorIdeagriId, marcadorSigla, resultado };
}

export function parseCaseina(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const sigla = textoObrigatorio(f[1]);
  const nome = textoObrigatorio(f[2]);
  if (ideagriId == null || !sigla || !nome) return null;
  return { ideagriId, sigla, nome };
}

export function parseValorCaseina(linha) {
  const f = linha.split(SEP);
  const reprodutorIdeagriId = inteiroPositivo(f[0]);
  const caseinaSigla = textoObrigatorio(f[1]);
  const genotipo = textoObrigatorio(f[2]);
  if (reprodutorIdeagriId == null || !caseinaSigla || !genotipo) return null;
  return { reprodutorIdeagriId, caseinaSigla, genotipo };
}

export function parseTipoSemen(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const sigla = textoObrigatorio(f[1]);
  const nome = textoObrigatorio(f[2]);
  if (ideagriId == null || !sigla || !nome) return null;
  return { ideagriId, sigla, nome };
}

export function parseEstoqueSemen(linha) {
  const f = linha.split(SEP);
  const ideagriId = inteiroPositivo(f[0]);
  const reprodutorIdeagriId = inteiroPositivo(f[1]);
  const doses = n(f[5]);
  if (ideagriId == null || reprodutorIdeagriId == null || !Number.isInteger(doses) || doses < 0) return null;
  return {
    ideagriId,
    reprodutorIdeagriId,
    tipoSemenSigla: s(f[2]),
    lote: s(f[3]),
    localizacao: s(f[4]),
    doses,
  };
}

export function parsePedigree(linha) {
  const f = linha.split(SEP);
  const reprodutorIdeagriId = inteiroPositivo(f[0]);
  if (reprodutorIdeagriId == null) return null;
  return {
    reprodutorIdeagriId,
    paiNome: s(f[1]),
    paiCodigo: s(f[2]),
    maeNome: s(f[3]),
    maeCodigo: s(f[4]),
    avoMaternoNome: s(f[5]),
    avoMaternoCodigo: s(f[6]),
    avoPaternoNome: s(f[7]),
    avoPaternoCodigo: s(f[8]),
  };
}

// Contratos intermediários da extração IATF. O SQL da máquina-fonte deve emitir
// exatamente estes campos após consultar o inventário real de colunas do Firebird.
export function parseProtocoloIatf(linha) {
  const f = linha.split(SEP);
  const ideagriId = n(f[0]);
  const nome = s(f[1]);
  const finalidade = (s(f[2]) ?? "IATF").toUpperCase();
  if (ideagriId == null || !nome || !FINALIDADES_IATF.has(finalidade)) return null;
  return { ideagriId, nome, finalidade };
}

export function parseProtocoloPrincipio(linha) {
  const f = linha.split(SEP);
  const protocoloIdeagriId = n(f[0]);
  if (protocoloIdeagriId == null) return null;
  return {
    protocoloIdeagriId,
    dia: n(f[1]) ?? 0,
    principio: s(f[2]),
    produto: s(f[3]),
    dose: s(f[4]),
    uso: s(f[5]),
  };
}

export function parseProgramacaoIatf(linha) {
  const f = linha.split(SEP);
  const ideagriId = n(f[0]);
  const dataInicio = s(f[2]);
  const protocoloIdeagriId = n(f[3]);
  if (ideagriId == null || !dataInicio || protocoloIdeagriId == null) return null;
  return { ideagriId, nome: s(f[1]), dataInicio, protocoloIdeagriId };
}

export function parseProgramacaoAssociacao(linha) {
  const f = linha.split(SEP);
  const numero = s(f[0]);
  const ideagriId = n(f[1]);
  const programacaoIdeagriId = n(f[2]);
  if (!numero || ideagriId == null || programacaoIdeagriId == null) return null;
  return {
    numero,
    ideagriId,
    programacaoIdeagriId,
    usoCidr: f[3] === "1",
    estimulo: s(f[4]),
    perdaImplante: f[5] === "1",
  };
}

// RESULTADOEXAMEGINECOLOGICO → dicionário oficial compartilhado.
// Código precisa ser inteiro positivo; inválidos fazem main() abortar (fail-closed).
export function parseResultadoGinecologico(linha) {
  const f = linha.split(SEP);
  const codigo = n(f[0]);
  const nomeResumido = s(f[1]);
  if (!Number.isInteger(codigo) || codigo <= 0 || !nomeResumido) return null;
  return {
    codigo,
    nomeResumido,
    nomeCompleto: s(f[2]),
    tipo: s(f[3]),
    padrao: f[4] === "1",
  };
}

export function parseEvento(linha) {
  const f = linha.split(SEP);
  const ideagriId = n(f[1]);
  const cdtipo = f[2];
  const tipo = TIPO_EV[cdtipo] ?? null;
  return {
    numero: f[0],
    ideagriId,
    cdtipo,
    tipo,
    data: s(f[3]),
    reprodutor: s(f[4]),
    doadoraNumero: s(f[5]),
    doadoraNome: s(f[6]),
    ideagriEmbriaoId: n(f[7]),
    resultado: cdtipo === "4" ? (f[8] === "P" ? "positivo" : f[8] === "N" ? "negativo" : null) : null,
    dtPartoPrevista: s(f[9]),
    tipoParto: cdtipo === "7" ? s(f[10]) : null,
    auxilioParto: cdtipo === "7" ? s(f[11]) : null,
    numCrias: cdtipo === "7" ? n(f[12]) : null,
    sexoCria: cdtipo === "7" ? s(f[13]) : null,
    observacao: null,
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

// APLICACAOPRODUTO → EventoSanitario. Vacinas (nome "Vacina…") viram tipo VACINA;
// o resto, APLICACAO. Campos: numero, produto, data, dose, carencia, obs.
export function parseAplicacao(linha) {
  const f = linha.split(SEP);
  const produto = s(f[1]);
  return {
    numero: f[0],
    tipo: produto && /vacina/i.test(produto) ? "VACINA" : "APLICACAO",
    data: s(f[2]),
    produto,
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

// PESO → Pesagem. Campos: numero, data, peso (kg), gmd (ganho médio diário, do Ideagri).
export function parsePesagem(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    data: s(f[1]),
    peso: n(f[2]),
    gmd: n(f[3]),
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

// @Y@ LACTACAO → histórico de lactação. Produção só na corrente (via ANIMALINFO_PRODUCAO).
export function parseLactacao(linha) {
  const f = linha.split(SEP);
  return {
    numero: f[0],
    ordem: n(f[1]),
    dtInicio: s(f[2]),
    dtFim: s(f[3]),
    motivoSecagem: s(f[4]),
    tipoAleitamento: s(f[5]),
    induzida: f[6] === "1",
    producaoTotal: n(f[7]),
    producao305: n(f[8]),
    duracaoDias: n(f[9]),
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
  const pesagens = [];
  const lactacoes = [];
  const protocolosIatf = [];
  const principiosProtocolo = [];
  const programacoesIatf = [];
  const associacoesProgramacao = [];
  const resultadosGinecologicos = [];
  const reprodutoresGeneticos = [];
  const indicadores = [];
  const valoresIndicador = [];
  const marcadores = [];
  const valoresMarcador = [];
  const caseinas = [];
  const valoresCaseina = [];
  const tiposSemen = [];
  const estoquesSemen = [];
  const pedigrees = [];
  const eventosInvalidos = [];
  const iatfInvalidos = [];
  const resultadosGinecologicosInvalidos = [];
  const geneticaInvalidos = [];

  for (const l of linhas) {
    if (l.startsWith("@A@")) animais.push(parseAnimal(l.slice(3)));
    else if (l.startsWith("@P@")) { const p = parseProducao(l.slice(3)); prodPorNum.set(p.numero, p); }
    else if (l.startsWith("@R@")) { const r = parseReproducao(l.slice(3)); reproPorNum.set(r.numero, r); }
    else if (l.startsWith("@L@")) controles.push(parseControle(l.slice(3)));
    else if (l.startsWith("@E@")) {
      const e = parseEvento(l.slice(3));
      if (e.tipo == null || e.ideagriId == null) eventosInvalidos.push(e);
      else eventos.push(e);
    }
    else if (l.startsWith("@D@")) eventosSanitarios.push(parseDoenca(l.slice(3)));
    else if (l.startsWith("@V@")) eventosSanitarios.push(parseAplicacao(l.slice(3)));
    else if (l.startsWith("@Q@")) eventosSanitarios.push(parseAnalise(l.slice(3)));
    else if (l.startsWith("@M@")) eventosSanitarios.push(parseMamite(l.slice(3)));
    else if (l.startsWith("@W@")) pesagens.push(parsePesagem(l.slice(3)));
    else if (l.startsWith("@Y@")) lactacoes.push(parseLactacao(l.slice(3)));
    else if (l.startsWith("@PROTOIATF@")) {
      const row = parseProtocoloIatf(l.slice(11));
      if (row) protocolosIatf.push(row); else iatfInvalidos.push(l);
    }
    else if (l.startsWith("@PROTOPRIN@")) {
      const row = parseProtocoloPrincipio(l.slice(11));
      if (row) principiosProtocolo.push(row); else iatfInvalidos.push(l);
    }
    else if (l.startsWith("@PROGIATF@")) {
      const row = parseProgramacaoIatf(l.slice(10));
      if (row) programacoesIatf.push(row); else iatfInvalidos.push(l);
    }
    else if (l.startsWith("@PROGASSOC@")) {
      const row = parseProgramacaoAssociacao(l.slice(11));
      if (row) associacoesProgramacao.push(row); else iatfInvalidos.push(l);
    }
    else if (l.startsWith("@RESULTGINE@")) {
      const row = parseResultadoGinecologico(l.slice(12));
      if (row) resultadosGinecologicos.push(row); else resultadosGinecologicosInvalidos.push(l);
    }
    else if (l.startsWith("@REPRODUTOR@")) {
      const row = parseReprodutorGenetico(l.slice("@REPRODUTOR@".length));
      if (row) reprodutoresGeneticos.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@INDICADOR@")) {
      const row = parseIndicadorGenetico(l.slice("@INDICADOR@".length));
      if (row) indicadores.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@VALORIND@")) {
      const row = parseValorIndicador(l.slice("@VALORIND@".length));
      if (row) valoresIndicador.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@MARCADOR@")) {
      const row = parseMarcador(l.slice("@MARCADOR@".length));
      if (row) marcadores.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@VALORMARC@")) {
      const row = parseValorMarcador(l.slice("@VALORMARC@".length));
      if (row) valoresMarcador.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@CASEINA@")) {
      const row = parseCaseina(l.slice("@CASEINA@".length));
      if (row) caseinas.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@VALORCAS@")) {
      const row = parseValorCaseina(l.slice("@VALORCAS@".length));
      if (row) valoresCaseina.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@TIPOSEMEN@")) {
      const row = parseTipoSemen(l.slice("@TIPOSEMEN@".length));
      if (row) tiposSemen.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@ESTSEMEN@")) {
      const row = parseEstoqueSemen(l.slice("@ESTSEMEN@".length));
      if (row) estoquesSemen.push(row); else geneticaInvalidos.push(l);
    }
    else if (l.startsWith("@PEDIGREE@")) {
      const row = parsePedigree(l.slice("@PEDIGREE@".length));
      if (row) pedigrees.push(row); else geneticaInvalidos.push(l);
    }
  }

  if (eventosInvalidos.length) {
    const amostra = eventosInvalidos.slice(0, 5).map((e) => ({
      numero: e.numero, cdtipo: e.cdtipo, ideagriId: e.ideagriId,
    }));
    console.error(`ERRO: ${eventosInvalidos.length} eventos reprodutivos inválidos (tipo desconhecido ou sem CDREPRODUCAO).`);
    console.error(JSON.stringify(amostra));
    process.exit(1);
  }

  if (iatfInvalidos.length) {
    console.error(`ERRO: ${iatfInvalidos.length} registros IATF inválidos.`);
    console.error(JSON.stringify(iatfInvalidos.slice(0, 5)));
    process.exit(1);
  }

  if (resultadosGinecologicosInvalidos.length) {
    console.error(`ERRO: ${resultadosGinecologicosInvalidos.length} resultados ginecológicos inválidos.`);
    console.error(JSON.stringify(resultadosGinecologicosInvalidos.slice(0, 5)));
    process.exit(1);
  }

  if (geneticaInvalidos.length) {
    console.error(`ERRO: ${geneticaInvalidos.length} registros de genética/sêmen inválidos.`);
    console.error(JSON.stringify(geneticaInvalidos.slice(0, 5)));
    process.exit(1);
  }

  const grupos = new Set(); // grupo = lote de manejo real (ANIMALINFO_CADASTRO.GRUPO)
  for (const a of animais) {
    if (a.grupo) grupos.add(a.grupo);
    a.resumo = montarResumo(prodPorNum.get(a.numero), reproPorNum.get(a.numero), geradoEm);
  }

  // ideagriId não entra no JSON consumido pelo import — fica nos campos do evento.
  const eventosOut = eventos.map(({ cdtipo: _c, ...e }) => e);
  const out = {
    geradoEm,
    animais,
    controles,
    eventos: eventosOut,
    eventosSanitarios,
    pesagens,
    lactacoes,
    protocolosIatf,
    principiosProtocolo,
    programacoesIatf,
    associacoesProgramacao,
    resultadosGinecologicos,
    reprodutoresGeneticos,
    indicadores,
    valoresIndicador,
    marcadores,
    valoresMarcador,
    caseinas,
    valoresCaseina,
    tiposSemen,
    estoquesSemen,
    pedigrees,
  };
  const dest = fileURLToPath(new URL("../server/prisma/rebanho_real.json", import.meta.url));
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

  const ativos = animais.filter((a) => a.status === "ATIVO");
  const cnt = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
  console.error(`Gerado ${dest}`);
  console.error(`  animais=${animais.length} (ATIVO=${ativos.length} BAIXADO=${animais.length - ativos.length})`);
  console.error(`  ativos por categoria: ${JSON.stringify(cnt(ativos, "categoria"))}`);
  console.error(`  em lactação=${animais.filter((a) => a.resumo.del != null).length} · controles=${controles.length}`);
  console.error(`  eventos reprodutivos=${eventosOut.length} ${JSON.stringify(cnt(eventosOut, "tipo"))}`);
  console.error(`  eventos sanitários=${eventosSanitarios.length} ${JSON.stringify(cnt(eventosSanitarios, "tipo"))}`);
  console.error(`  pesagens=${pesagens.length}`);
  console.error(`  lactações=${lactacoes.length}`);
  console.error(`  IATF: protocolos=${protocolosIatf.length} princípios=${principiosProtocolo.length} programações=${programacoesIatf.length} associações=${associacoesProgramacao.length}`);
  console.error(`  resultados ginecológicos=${resultadosGinecologicos.length}`);
  console.error(`  genética/sêmen: reprodutores=${reprodutoresGeneticos.length} indicadores=${indicadores.length} valoresIndicador=${valoresIndicador.length} marcadores=${marcadores.length} valoresMarcador=${valoresMarcador.length} caseínas=${caseinas.length} valoresCaseina=${valoresCaseina.length} tiposSemen=${tiposSemen.length} estoques=${estoquesSemen.length} pedigrees=${pedigrees.length}`);
}

// roda main() só quando executado direto (não nos testes)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
