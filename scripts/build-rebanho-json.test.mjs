import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  categoriaDe, parseAnimal, derivarStatusRepro, delEStatusLactacao, diasEntre, parseEvento,
  parseDoenca, parseAplicacao, parseAnalise, parseMamite, parsePesagem, parseLactacao,
  parseProtocoloIatf, parseProtocoloPrincipio, parseProgramacaoIatf, parseProgramacaoAssociacao,
  parseResultadoGinecologico, parseReprodutorGenetico, parseIndicadorGenetico,
  parseValorIndicador, parseMarcador, parseValorMarcador, parseCaseina, parseValorCaseina,
  parseTipoSemen, parseEstoqueSemen, parsePedigree,
  parseMedidaAcasalamento, parseItemMedidaAcasalamento,
  parseCombinacaoAcasalamento, parseItemCombinacaoAcasalamento,
  parseCasoDouradoAcasalamento,
  parseEmbriaoClassificacao, parseColeta, parseOocitoColeta, parseFertilizacao,
  parseEmbriaoColeta, parseGrupoPool, parseItemGrupoPool,
} from "./build-rebanho-json.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./build-rebanho-json.mjs", import.meta.url));

function executarMainIsolado(t, linhas) {
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), "build-rebanho-json-")));
  const scriptsDir = join(raiz, "scripts");
  const prismaDir = join(raiz, "server", "prisma");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(prismaDir, { recursive: true });
  const script = join(scriptsDir, "build-rebanho-json.mjs");
  const dump = join(raiz, "dump.txt");
  copyFileSync(SCRIPT_PATH, script);
  writeFileSync(dump, `${linhas.join("\n")}\n`, "latin1");
  t.after(() => rmSync(raiz, { recursive: true, force: true }));
  const execucao = spawnSync(process.execPath, [script, dump, "2026-07-27"], { encoding: "utf8" });
  return { execucao, destino: join(prismaDir, "rebanho_real.json") };
}

test("categoriaDe mapeia CDCATEGORIA por código e sexo", () => {
  assert.equal(categoriaDe("7", "F"), "VACA");
  assert.equal(categoriaDe("6", "F"), "NOVILHA");
  assert.equal(categoriaDe("5", "F"), "BEZERRA");
  assert.equal(categoriaDe("1", "M"), "BEZERRO");
  assert.equal(categoriaDe("2", "M"), "TOURO");
  assert.equal(categoriaDe("3", "M"), "TOURO");
  assert.equal(categoriaDe("4", "M"), "TOURO");
});

test("parseAnimal lê linha @A@ (15 campos: setor e grupo separados) — vazios viram null", () => {
  const linha = "1002~|~CATARINA~|~F~|~7~|~2019-06-01~|~2022-10-01~|~~|~~|~0~|~BAIXADO~|~2026-04-10~|~Venda~|~Principal - Leite~|~~|~Vacas secas";
  const a = parseAnimal(linha);
  assert.equal(a.numero, "1002");
  assert.equal(a.nome, "CATARINA");
  assert.equal(a.sexo, "F");
  assert.equal(a.categoria, "VACA");
  assert.equal(a.dataNascimento, "2019-06-01");
  assert.equal(a.dataEntrada, "2022-10-01");
  assert.equal(a.brincoEletronico, null);
  assert.equal(a.numPartosEntrada, 0);
  assert.equal(a.status, "BAIXADO");
  assert.equal(a.dataBaixa, "2026-04-10");
  assert.equal(a.motivoBaixa, "Venda");
  assert.equal(a.setor, "Principal - Leite");
  assert.equal(a.raca, "Girolando"); // pelagem vazia → default
  assert.equal(a.grupo, "Vacas secas"); // lote de manejo, separado do setor
});

test("parseAnimal: animal sem grupo → grupo null (setor preservado)", () => {
  const a = parseAnimal("10~|~~|~F~|~7~|~2023-05-13~|~2023-05-13~|~~|~~|~0~|~ATIVO~|~~|~~|~Principal - Leite~|~~|~");
  assert.equal(a.setor, "Principal - Leite");
  assert.equal(a.grupo, null);
  assert.equal(a.maeNumero, null);
  assert.equal(a.paiNome, null);
});

test("parseAnimal: genealogia (mãe nº + pai nome)", () => {
  const a = parseAnimal("66~|~~|~F~|~6~|~2023-01-01~|~2023-01-01~|~~|~~|~0~|~ATIVO~|~~|~~|~Mexicana~|~1/2 HO, GO~|~Recria 1~|~DB04~|~HALIFAX SXL");
  assert.equal(a.maeNumero, "DB04");
  assert.equal(a.paiNome, "HALIFAX SXL");
});

test("parseAnimal: ativo sem nome → nome null, dataBaixa/motivo null", () => {
  const a = parseAnimal("10~|~~|~F~|~7~|~2023-05-13~|~2023-05-13~|~~|~~|~0~|~ATIVO~|~~|~~|~Principal~|~Girolando~|~");
  assert.equal(a.nome, null);
  assert.equal(a.status, "ATIVO");
  assert.equal(a.dataBaixa, null);
  assert.equal(a.motivoBaixa, null);
  assert.equal(a.raca, "Girolando");
});

test("derivarStatusRepro: DG positivo => PRENHE; del<60 => PEV; senão VAZIA", () => {
  assert.equal(derivarStatusRepro({ ultimoDgResultado: "positivo" }, 100), "PRENHE");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: "negativo" }, 30), "PEV");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: null }, 200), "VAZIA");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: null }, null), "VAZIA");
});

test("diasEntre conta dias inteiros", () => {
  assert.equal(diasEntre("2026-01-01", "2026-01-31"), 30);
});

test("delEStatusLactacao: lactação aberta → del + lactacaoAberta; seca → del null", () => {
  const hoje = "2026-06-17";
  // aberta: início recente, sem secagem posterior
  const aberta = delEStatusLactacao({ dtInicioUltLac: "2026-05-04", dtUltSecagem: "2025-12-02" }, hoje);
  assert.equal(aberta.del, diasEntre("2026-05-04", hoje));
  assert.deepEqual(aberta.lactacaoAberta, { dtInicio: "2026-05-04" });
  // seca: secagem depois do início
  const seca = delEStatusLactacao({ dtInicioUltLac: "2025-07-12", dtUltSecagem: "2026-04-14" }, hoje);
  assert.equal(seca.del, null);
  assert.equal(seca.lactacaoAberta, null);
  // sem início → seca
  assert.equal(delEStatusLactacao({ dtInicioUltLac: null, dtUltSecagem: null }, hoje).del, null);
});

test("parseEvento: IA (tipo 1) → INSEMINACAO com reprodutor", () => {
  const e = parseEvento("1002~|~1000~|~1~|~2025-07-31~|~BRUISER~|~~|~~|~~|~~|~~|~~|~~|~");
  assert.equal(e.numero, "1002");
  assert.equal(e.ideagriId, 1000);
  assert.equal(e.tipo, "INSEMINACAO");
  assert.equal(e.data, "2025-07-31");
  assert.equal(e.reprodutor, "BRUISER");
  assert.equal(e.resultado, null);
});

test("parseEvento: diagnóstico (tipo 4) P → DIAGNOSTICO positivo + previsão de parto", () => {
  const e = parseEvento("1002~|~1001~|~4~|~2025-08-20~|~~|~~|~~|~~|~P~|~2026-05-01~|~~|~~|~");
  assert.equal(e.tipo, "DIAGNOSTICO");
  assert.equal(e.ideagriId, 1001);
  assert.equal(e.resultado, "positivo");
  assert.equal(e.dtPartoPrevista, "2026-05-01");
  // N → negativo
  assert.equal(parseEvento("1002~|~1002~|~4~|~2025-08-20~|~~|~~|~~|~~|~N~|~~|~~|~~|~").resultado, "negativo");
});

test("parseEvento: cobertura (2) → COBERTURA e TE (3) → TRANSFERENCIA_EMBRIAO com doadora/embrião", () => {
  const mn = parseEvento("1~|~1003~|~2~|~2025-01-01~|~Touro 1~|~~|~~|~~|~~|~~|~~|~~|~");
  assert.equal(mn.tipo, "COBERTURA");
  assert.equal(mn.reprodutor, "Touro 1");

  const te = parseEvento("1~|~1004~|~3~|~2025-01-01~|~Touro 2~|~200~|~Doadora A~|~500~|~~|~~|~~|~~|~");
  assert.equal(te.tipo, "TRANSFERENCIA_EMBRIAO");
  assert.equal(te.reprodutor, "Touro 2");
  assert.equal(te.doadoraNumero, "200");
  assert.equal(te.doadoraNome, "Doadora A");
  assert.equal(te.ideagriEmbriaoId, 500);
});

test("parseEvento: desconhecido (9) ou falta de ideagriId → null (faha em main)", () => {
  assert.equal(parseEvento("1~|~1005~|~9~|~2025-01-01~|~~|~~|~~|~~|~~|~~|~~|~~|~").tipo, null);
  assert.equal(parseEvento("1~|~~|~1~|~2025-01-01~|~~|~~|~~|~~|~~|~~|~~|~~|~").ideagriId, null);
});

test("parseEvento: parto (tipo 7) → PARTO com cria e auxílio", () => {
  const e = parseEvento("1027~|~1006~|~7~|~2023-09-12~|~~|~~|~~|~~|~~|~~|~2~|~1~|~1~|~M");
  assert.equal(e.tipo, "PARTO");
  assert.equal(e.ideagriId, 1006);
  assert.equal(e.tipoParto, "2"); // Auxiliado
  assert.equal(e.auxilioParto, "1"); // Bezerro puxado
  assert.equal(e.numCrias, 1);
  assert.equal(e.sexoCria, "M");
});

test("parseProtocoloIatf preserva identidade/nome/finalidade e rejeita finalidade desconhecida", () => {
  assert.deepEqual(parseProtocoloIatf("10~|~IATF 11 dias~|~IATF"), {
    ideagriId: 10,
    nome: "IATF 11 dias",
    finalidade: "IATF",
  });
  assert.equal(parseProtocoloIatf("11~|~X~|~FIV"), null);
  assert.equal(parseProtocoloIatf("~|~Sem id~|~IATF"), null);
});

test("parseProtocoloPrincipio preserva dia/princípio/produto/dose/uso", () => {
  assert.deepEqual(parseProtocoloPrincipio("10~|~7~|~PGF2a~|~Ciosin~|~2 ml~|~luteólise"), {
    protocoloIdeagriId: 10,
    dia: 7,
    principio: "PGF2a",
    produto: "Ciosin",
    dose: "2 ml",
    uso: "luteólise",
  });
});

test("parseProgramacaoIatf preserva identidade/protocolo/data", () => {
  assert.deepEqual(parseProgramacaoIatf("700~|~Novilhas julho~|~2026-07-06~|~10"), {
    ideagriId: 700,
    nome: "Novilhas julho",
    dataInicio: "2026-07-06",
    protocoloIdeagriId: 10,
  });
});

test("parseProgramacaoAssociacao preserva animal/programação/CIDR/estímulo/perda", () => {
  assert.deepEqual(parseProgramacaoAssociacao("1234~|~500~|~700~|~1~|~eCG~|~0"), {
    numero: "1234",
    ideagriId: 500,
    programacaoIdeagriId: 700,
    usoCidr: true,
    estimulo: "eCG",
    perdaImplante: false,
  });
});

test("parseResultadoGinecologico preserva o dicionário oficial", () => {
  assert.deepEqual(
    parseResultadoGinecologico("12~|~CL presente~|~Corpo lúteo presente no ovário direito~|~OVARIO~|~1"),
    {
      codigo: 12,
      nomeResumido: "CL presente",
      nomeCompleto: "Corpo lúteo presente no ovário direito",
      tipo: "OVARIO",
      padrao: true,
    },
  );
});

test("parseResultadoGinecologico rejeita código inválido", () => {
  assert.equal(parseResultadoGinecologico("abc~|~Inválido~|~~|~~|~0"), null);
  assert.equal(parseResultadoGinecologico("0~|~Inválido~|~~|~~|~0"), null);
  assert.equal(parseResultadoGinecologico("1.5~|~Inválido~|~~|~~|~0"), null);
});

test("parseReprodutorGenetico preserva identidade e campos opcionais", () => {
  assert.deepEqual(parseReprodutorGenetico("100~|~Touro Atlas~|~ATL-1~|~HO~|~ABS"), {
    ideagriId: 100,
    nome: "Touro Atlas",
    codigo: "ATL-1",
    racaSigla: "HO",
    centralSigla: "ABS",
  });
  assert.deepEqual(parseReprodutorGenetico("101~|~Touro sem códigos~|~~|~~|~"), {
    ideagriId: 101,
    nome: "Touro sem códigos",
    codigo: null,
    racaSigla: null,
    centralSigla: null,
  });
  assert.equal(parseReprodutorGenetico("1.5~|~Touro inválido~|~~|~~|~"), null);
  assert.equal(parseReprodutorGenetico("100~|~~|~ATL-1~|~HO~|~ABS"), null);
});

test("parseIndicadorGenetico preserva identidade/direção/colunaLegada e rejeita campos inválidos", () => {
  assert.deepEqual(parseIndicadorGenetico("42~|~PTAL~|~PTA Leite~|~kg~|~maior_melhor~|~ptaLeite~|~1"), {
    ideagriId: 42,
    sigla: "PTAL",
    nome: "PTA Leite",
    unidade: "kg",
    direcao: "maior_melhor",
    colunaLegada: "ptaLeite",
    ranking: true,
  });
  assert.deepEqual(parseIndicadorGenetico("43~|~CCS~|~CCS prevista~|~~|~menor_melhor~|~~|~0"), {
    ideagriId: 43,
    sigla: "CCS",
    nome: "CCS prevista",
    unidade: null,
    direcao: "menor_melhor",
    colunaLegada: null,
    ranking: false,
  });
  assert.equal(parseIndicadorGenetico("42~|~~|~Sem sigla~|~~|~maior_melhor~|~~|~0"), null);
  assert.equal(parseIndicadorGenetico("42~|~X~|~~|~~|~maior_melhor~|~~|~0"), null);
  assert.equal(parseIndicadorGenetico("42~|~X~|~Y~|~~|~torto~|~~|~0"), null);
  assert.equal(parseIndicadorGenetico("42~|~X~|~Y~|~~|~maior_melhor~|~naoExiste~|~0"), null);
  assert.equal(parseIndicadorGenetico("Infinity~|~X~|~Y~|~~|~maior_melhor~|~~|~0"), null);
});

test("parseValorIndicador exige reprodutor/sigla e número finito", () => {
  assert.deepEqual(parseValorIndicador("100~|~PTAL~|~900.5"), {
    reprodutorIdeagriId: 100,
    indicadorSigla: "PTAL",
    valor: 900.5,
  });
  assert.equal(parseValorIndicador("100~|~PTAL~|~abc"), null);
  assert.equal(parseValorIndicador("100~|~PTAL~|~Infinity"), null);
  assert.equal(parseValorIndicador("~|~PTAL~|~9"), null);
  assert.equal(parseValorIndicador("100~|~~|~9"), null);
});

test("parseMarcador e parseValorMarcador exigem identidade, sigla, nome e resultado", () => {
  assert.deepEqual(parseMarcador("8~|~BLAD~|~Deficiência de adesão leucocitária"), {
    ideagriId: 8,
    sigla: "BLAD",
    nome: "Deficiência de adesão leucocitária",
  });
  assert.equal(parseMarcador("8~|~BLAD~|~"), null);
  assert.equal(parseMarcador("0~|~BLAD~|~Nome"), null);
  assert.deepEqual(parseValorMarcador("100~|~BLAD~|~LIVRE"), {
    reprodutorIdeagriId: 100,
    marcadorSigla: "BLAD",
    resultado: "LIVRE",
  });
  assert.equal(parseValorMarcador("100~|~BLAD~|~"), null);
  assert.equal(parseValorMarcador("-1~|~BLAD~|~LIVRE"), null);
});

test("parseCaseina e parseValorCaseina exigem identidade, sigla, nome e genótipo", () => {
  assert.deepEqual(parseCaseina("9~|~K-CN~|~Kappa-caseína"), {
    ideagriId: 9,
    sigla: "K-CN",
    nome: "Kappa-caseína",
  });
  assert.equal(parseCaseina("9~|~~|~Kappa-caseína"), null);
  assert.deepEqual(parseValorCaseina("100~|~K-CN~|~A2A2"), {
    reprodutorIdeagriId: 100,
    caseinaSigla: "K-CN",
    genotipo: "A2A2",
  });
  assert.equal(parseValorCaseina("100~|~K-CN~|~"), null);
  assert.equal(parseValorCaseina("100.1~|~K-CN~|~A2A2"), null);
});

test("parseTipoSemen exige identidade, sigla e nome", () => {
  assert.deepEqual(parseTipoSemen("3~|~SEX~|~Sexado"), {
    ideagriId: 3,
    sigla: "SEX",
    nome: "Sexado",
  });
  assert.equal(parseTipoSemen("3~|~~|~Sexado"), null);
  assert.equal(parseTipoSemen("abc~|~SEX~|~Sexado"), null);
});

test("parseEstoqueSemen preserva tipo opcional e exige IDs/doses válidos", () => {
  assert.deepEqual(parseEstoqueSemen("7~|~100~|~SEX~|~L-22~|~Botijão 1~|~12"), {
    ideagriId: 7,
    reprodutorIdeagriId: 100,
    tipoSemenSigla: "SEX",
    lote: "L-22",
    localizacao: "Botijão 1",
    doses: 12,
  });
  assert.deepEqual(parseEstoqueSemen("8~|~100~|~~|~~|~~|~0"), {
    ideagriId: 8,
    reprodutorIdeagriId: 100,
    tipoSemenSigla: null,
    lote: null,
    localizacao: null,
    doses: 0,
  });
  assert.equal(parseEstoqueSemen("7~|~~|~SEX~|~L-22~|~~|~12"), null);
  assert.equal(parseEstoqueSemen("7~|~100~|~SEX~|~L-22~|~~|~-1"), null);
  assert.equal(parseEstoqueSemen("7~|~100~|~SEX~|~L-22~|~~|~1.5"), null);
  assert.equal(parseEstoqueSemen("7~|~100~|~SEX~|~L-22~|~~|~Infinity"), null);
});

test("parsePedigree exige reprodutor e preserva nomes/códigos opcionais", () => {
  assert.deepEqual(
    parsePedigree("100~|~Pai Atlas~|~P-1~|~Mãe Lua~|~M-1~|~Avô Materno~|~AM-1~|~Avô Paterno~|~AP-1"),
    {
      reprodutorIdeagriId: 100,
      paiNome: "Pai Atlas",
      paiCodigo: "P-1",
      maeNome: "Mãe Lua",
      maeCodigo: "M-1",
      avoMaternoNome: "Avô Materno",
      avoMaternoCodigo: "AM-1",
      avoPaternoNome: "Avô Paterno",
      avoPaternoCodigo: "AP-1",
    },
  );
  assert.deepEqual(parsePedigree("101~|~~|~~|~~|~~|~~|~~|~~|~"), {
    reprodutorIdeagriId: 101,
    paiNome: null,
    paiCodigo: null,
    maeNome: null,
    maeCodigo: null,
    avoMaternoNome: null,
    avoMaternoCodigo: null,
    avoPaternoNome: null,
    avoPaternoCodigo: null,
  });
  assert.equal(parsePedigree("~|~Pai~|~~|~~|~~|~~|~~|~~|~"), null);
});

test("parseMedidaAcasalamento valida tipo, limite e coerência", () => {
  assert.deepEqual(parseMedidaAcasalamento("10~|~Mérito leiteiro~|~MERITO~|~~|~0~|~1"), {
    ideagriId: 10,
    nome: "Mérito leiteiro",
    tipo: "MERITO",
    consanguinidadeMax: null,
    exigePedigree: false,
    ativo: true,
  });
  assert.deepEqual(parseMedidaAcasalamento("11~|~Limite de parentesco~|~CONSANGUINIDADE~|~0.125~|~0~|~1"), {
    ideagriId: 11,
    nome: "Limite de parentesco",
    tipo: "CONSANGUINIDADE",
    consanguinidadeMax: 0.125,
    exigePedigree: false,
    ativo: true,
  });
  assert.equal(parseMedidaAcasalamento("0~|~Sem id~|~MERITO~|~~|~0~|~1"), null);
  assert.equal(parseMedidaAcasalamento("10~|~Tipo aberto~|~OUTRO~|~~|~0~|~1"), null);
  assert.equal(parseMedidaAcasalamento("10~|~Mérito com limite~|~MERITO~|~0.1~|~0~|~1"), null);
  assert.equal(parseMedidaAcasalamento("10~|~Consanguinidade sem limite~|~CONSANGUINIDADE~|~~|~0~|~1"), null);
  assert.equal(parseMedidaAcasalamento("10~|~Pedigree frouxo~|~PEDIGREE~|~~|~0~|~1"), null);
  assert.equal(parseMedidaAcasalamento("10~|~Flag inválida~|~SEMEN~|~~|~2~|~1"), null);
});

test("parseItemMedidaAcasalamento valida peso, limites e indicador", () => {
  assert.deepEqual(parseItemMedidaAcasalamento("10~|~PTAL~|~2.5~|~100~|~900"), {
    medidaIdeagriId: 10,
    indicadorSigla: "PTAL",
    peso: 2.5,
    minimo: 100,
    maximo: 900,
  });
  assert.equal(parseItemMedidaAcasalamento("10~|~~|~1~|~~|~"), null);
  assert.equal(parseItemMedidaAcasalamento("10~|~PTAL~|~0~|~~|~"), null);
  assert.equal(parseItemMedidaAcasalamento("10~|~PTAL~|~1~|~2~|~1"), null);
  assert.equal(parseItemMedidaAcasalamento("10~|~PTAL~|~1~|~Infinity~|~"), null);
});

test("parseCombinacaoAcasalamento valida identidade, nome e flag", () => {
  assert.deepEqual(parseCombinacaoAcasalamento("20~|~Índice leite~|~1"), {
    ideagriId: 20,
    nome: "Índice leite",
    ativo: true,
  });
  assert.equal(parseCombinacaoAcasalamento("-1~|~Inválida~|~1"), null);
  assert.equal(parseCombinacaoAcasalamento("20~|~~|~1"), null);
  assert.equal(parseCombinacaoAcasalamento("20~|~Inválida~|~sim"), null);
});

test("parseItemCombinacaoAcasalamento valida referências, peso, flag e ordem", () => {
  assert.deepEqual(parseItemCombinacaoAcasalamento("20~|~10~|~1.5~|~1~|~0"), {
    combinacaoIdeagriId: 20,
    medidaIdeagriId: 10,
    peso: 1.5,
    obrigatoria: true,
    ordem: 0,
  });
  assert.equal(parseItemCombinacaoAcasalamento("20~|~0~|~1~|~1~|~0"), null);
  assert.equal(parseItemCombinacaoAcasalamento("20~|~10~|~0~|~1~|~0"), null);
  assert.equal(parseItemCombinacaoAcasalamento("20~|~10~|~1~|~2~|~0"), null);
  assert.equal(parseItemCombinacaoAcasalamento("20~|~10~|~1~|~1~|~-1"), null);
  assert.equal(parseItemCombinacaoAcasalamento("20~|~10~|~1~|~1~|~"), null);
});

test("parseCasoDouradoAcasalamento valida JSON e shapes do motor", () => {
  const entrada = {
    femea: { ancestrais: [{ chave: "pai-a", grau: 0.5 }], profundidade: 1, paiConhecido: true },
    candidatos: [{
      id: 7,
      nome: "Atlas",
      genealogia: { ancestrais: [{ chave: "pai-b", grau: 0.5 }], profundidade: 1, paiConhecido: true },
      valores: [{ indicadorId: 42, valor: 900.5 }],
    }],
    config: {
      termos: [{ indicadorId: 42, peso: 1, direcao: "maior_melhor", minimo: null, maximo: null, obrigatoria: false }],
      consanguinidadeMax: 0.125,
      exigePedigree: true,
    },
  };
  const esperado = { rankingEsperado: [7], statusEsperado: { "7": "ok" } };
  assert.deepEqual(
    parseCasoDouradoAcasalamento(`30~|~Caso Atlas~|~${JSON.stringify(entrada)}~|~${JSON.stringify(esperado)}`),
    { ideagriId: 30, nome: "Caso Atlas", ...entrada, ...esperado },
  );
  assert.equal(parseCasoDouradoAcasalamento("30~|~JSON inválido~|~{~|~{}"), null);
  assert.equal(parseCasoDouradoAcasalamento(`30~|~Limiar inválido~|~${JSON.stringify({ ...entrada, config: { ...entrada.config, consanguinidadeMax: 2 } })}~|~${JSON.stringify(esperado)}`), null);
  assert.equal(parseCasoDouradoAcasalamento(`30~|~Status aberto~|~${JSON.stringify(entrada)}~|~${JSON.stringify({ ...esperado, statusEsperado: { "7": "outro" } })}`), null);
  assert.equal(parseCasoDouradoAcasalamento(`30~|~Ranking inválido~|~${JSON.stringify(entrada)}~|~${JSON.stringify({ ...esperado, rankingEsperado: [0] })}`), null);
  assert.equal(parseCasoDouradoAcasalamento(`30~|~Shape textual inválido~|~${JSON.stringify({ ...entrada, femea: { ...entrada.femea, ancestrais: [{ chave: 7, grau: 0.5 }] } })}~|~${JSON.stringify(esperado)}`), null);
});

test("main coleta os cinco prefixos de acasalamento, emite arrays e contagens", (t) => {
  const entradaCaso = {
    femea: { ancestrais: [{ chave: "pai-a", grau: 0.5 }], profundidade: 1, paiConhecido: true },
    candidatos: [{
      id: 7,
      nome: "Atlas",
      genealogia: { ancestrais: [{ chave: "pai-b", grau: 0.5 }], profundidade: 1, paiConhecido: true },
      valores: [{ indicadorId: 42, valor: 900.5 }],
    }],
    config: {
      termos: [{ indicadorId: 42, peso: 1, direcao: "maior_melhor", minimo: null, maximo: null, obrigatoria: false }],
      consanguinidadeMax: 0.125,
      exigePedigree: false,
    },
  };
  const esperado = { rankingEsperado: [7], statusEsperado: { "7": "ok" } };
  const linhas = [
    "@MEDACAS@10~|~Mérito leiteiro~|~MERITO~|~~|~0~|~1",
    "@ITEMMEDACAS@10~|~PTAL~|~2~|~100~|~900",
    "@COMBACAS@20~|~Índice leite~|~1",
    "@ITEMCOMBACAS@20~|~10~|~1~|~1~|~0",
    `@CASOACAS@30~|~Caso Atlas~|~${JSON.stringify(entradaCaso)}~|~${JSON.stringify(esperado)}`,
  ];
  const { execucao, destino } = executarMainIsolado(t, linhas);
  assert.equal(execucao.status, 0, execucao.stderr);
  const out = JSON.parse(readFileSync(destino, "utf8"));
  assert.equal(out.medidasAcasalamento.length, 1);
  assert.equal(out.itensMedidaAcasalamento.length, 1);
  assert.equal(out.combinacoesAcasalamento.length, 1);
  assert.equal(out.itensCombinacaoAcasalamento.length, 1);
  assert.equal(out.casosDouradosAcasalamento.length, 1);
  assert.match(execucao.stderr, /acasalamento: medidas=1 itensMedida=1 combinações=1 itensCombinacao=1 casosDourados=1/);
});

test("main aborta antes de emitir JSON quando há acasalamento inválido e reporta amostra", (t) => {
  const linhaInvalida = "@ITEMCOMBACAS@20~|~10~|~0~|~1~|~0";
  const { execucao, destino } = executarMainIsolado(t, [linhaInvalida]);
  assert.equal(execucao.status, 1);
  assert.equal(existsSync(destino), false);
  assert.match(execucao.stderr, /ERRO: 1 registros de acasalamento inválidos\./);
  assert.match(execucao.stderr, new RegExp(linhaInvalida));
});

test("main coleta todos os prefixos genéticos, emite arrays e contagens", (t) => {
  const linhas = [
    "@REPRODUTOR@100~|~Touro Atlas~|~ATL-1~|~HO~|~ABS",
    "@INDICADOR@42~|~PTAL~|~PTA Leite~|~kg~|~maior_melhor~|~ptaLeite~|~1",
    "@VALORIND@100~|~PTAL~|~900.5",
    "@MARCADOR@8~|~BLAD~|~Deficiência de adesão leucocitária",
    "@VALORMARC@100~|~BLAD~|~LIVRE",
    "@CASEINA@9~|~K-CN~|~Kappa-caseína",
    "@VALORCAS@100~|~K-CN~|~A2A2",
    "@TIPOSEMEN@3~|~SEX~|~Sexado",
    "@ESTSEMEN@7~|~100~|~SEX~|~L-22~|~Botijão 1~|~12",
    "@PEDIGREE@100~|~Pai Atlas~|~P-1~|~Mãe Lua~|~M-1~|~~|~~|~~|~",
  ];
  const { execucao, destino } = executarMainIsolado(t, linhas);
  assert.equal(execucao.status, 0, execucao.stderr);
  const out = JSON.parse(readFileSync(destino, "utf8"));
  assert.equal(out.reprodutoresGeneticos.length, 1);
  assert.equal(out.indicadores.length, 1);
  assert.equal(out.valoresIndicador.length, 1);
  assert.equal(out.marcadores.length, 1);
  assert.equal(out.valoresMarcador.length, 1);
  assert.equal(out.caseinas.length, 1);
  assert.equal(out.valoresCaseina.length, 1);
  assert.equal(out.tiposSemen.length, 1);
  assert.equal(out.estoquesSemen.length, 1);
  assert.equal(out.pedigrees.length, 1);
  assert.match(execucao.stderr, /genética\/sêmen: reprodutores=1 indicadores=1 valoresIndicador=1 marcadores=1 valoresMarcador=1 caseínas=1 valoresCaseina=1 tiposSemen=1 estoques=1 pedigrees=1/);
});

test("main aborta sem emitir JSON quando encontra registro genético inválido e reporta amostra", (t) => {
  const linhaInvalida = "@VALORIND@100~|~PTAL~|~Infinity";
  const { execucao, destino } = executarMainIsolado(t, [linhaInvalida]);
  assert.equal(execucao.status, 1);
  assert.equal(existsSync(destino), false);
  assert.match(execucao.stderr, /ERRO: 1 registros de genética\/sêmen inválidos\./);
  assert.match(execucao.stderr, new RegExp(linhaInvalida));
});

test("parseDoenca → OCORRENCIA com doença/dtFim/dias", () => {
  const e = parseDoenca("1002~|~Mastite clínica~|~2025-03-01~|~2025-03-08~|~7~|~obs");
  assert.equal(e.numero, "1002");
  assert.equal(e.tipo, "OCORRENCIA");
  assert.equal(e.doenca, "Mastite clínica");
  assert.equal(e.data, "2025-03-01");
  assert.equal(e.dtFim, "2025-03-08");
  assert.equal(e.diasTratamento, 7);
  assert.equal(e.observacao, "obs");
});

test("parseAplicacao → APLICACAO com produto/dose/carência", () => {
  const e = parseAplicacao("1002~|~Dectomax~|~2025-04-10~|~10 ml~|~30~|~");
  assert.equal(e.tipo, "APLICACAO");
  assert.equal(e.produto, "Dectomax");
  assert.equal(e.data, "2025-04-10");
  assert.equal(e.dose, "10 ml");
  assert.equal(e.carencia, 30);
  assert.equal(e.observacao, null);
});

test("parseAplicacao → VACINA quando o produto é vacina", () => {
  assert.equal(parseAplicacao("1002~|~VACINA POLI-STAR~|~2025-03-16~|~~|~~|~").tipo, "VACINA");
  assert.equal(parseAplicacao("1002~|~Vacina Rotatec~|~2025-03-16~|~~|~~|~").tipo, "VACINA");
  assert.equal(parseAplicacao("1002~|~Lactotropin~|~2025-03-16~|~~|~~|~").tipo, "APLICACAO");
});

test("parseAnalise → EXAME com ccs/gordura/proteína", () => {
  const e = parseAnalise("1002~|~2025-05-10~|~512~|~3.80~|~3.20~|~");
  assert.equal(e.numero, "1002");
  assert.equal(e.tipo, "EXAME");
  assert.equal(e.data, "2025-05-10");
  assert.equal(e.ccs, 512);
  assert.equal(e.gordura, 3.8);
  assert.equal(e.proteina, 3.2);
});

test("parseMamite → MASTITE com quarto + cultivo", () => {
  const e = parseMamite("1002~|~2025-03-01~|~S~|~~|~~|~S~|~Staphylococcus aureus~|~obs");
  assert.equal(e.tipo, "MASTITE");
  assert.equal(e.data, "2025-03-01");
  assert.equal(e.quarto, "AD, PE");
  assert.equal(e.resultadoCultivo, "Staphylococcus aureus");
  assert.equal(e.observacao, "obs");
  // sem quartos marcados → quarto null
  assert.equal(parseMamite("1~|~2025-01-01~|~~|~~|~~|~~|~~|~").quarto, null);
});

test("parsePesagem → peso + gmd", () => {
  const p = parsePesagem("42~|~2025-11-20~|~382.5~|~0.85");
  assert.equal(p.numero, "42");
  assert.equal(p.data, "2025-11-20");
  assert.equal(p.peso, 382.5);
  assert.equal(p.gmd, 0.85);
  // gmd vazio → null
  assert.equal(parsePesagem("42~|~2025-01-01~|~300~|~").gmd, null);
});

test("parseLactacao — lactação encerrada com produção (corrente)", () => {
  const l = parseLactacao("1001~|~3~|~2023-08-29~|~2024-12-13~|~Rotina~|~A~|~0~|~9820.5~|~9105.0~|~471");
  assert.equal(l.numero, "1001");
  assert.equal(l.ordem, 3);
  assert.equal(l.dtInicio, "2023-08-29");
  assert.equal(l.dtFim, "2024-12-13");
  assert.equal(l.motivoSecagem, "Rotina");
  assert.equal(l.tipoAleitamento, "A");
  assert.equal(l.induzida, false);
  assert.equal(l.producaoTotal, 9820.5);
  assert.equal(l.producao305, 9105.0);
  assert.equal(l.duracaoDias, 471);
});

test("parseLactacao — lactação anterior sem produção, campos vazios → null", () => {
  const l = parseLactacao("1001~|~~|~2022-01-10~|~2022-11-01~|~Baixa produção~|~A~|~1~|~~|~~|~");
  assert.equal(l.ordem, null);
  assert.equal(l.dtFim, "2022-11-01");
  assert.equal(l.induzida, true);
  assert.equal(l.producaoTotal, null);
  assert.equal(l.producao305, null);
  assert.equal(l.duracaoDias, null);
});

test("parseEmbriaoClassificacao exige identidade/sigla/nome e preserva ordem", () => {
  assert.deepEqual(parseEmbriaoClassificacao("3~|~BX~|~Blastocisto~|~4"), { ideagriId: 3, sigla: "BX", nome: "Blastocisto", ordem: 4 });
  assert.equal(parseEmbriaoClassificacao("~|~BX~|~Blastocisto~|~4"), null);
  assert.equal(parseEmbriaoClassificacao("3~|~~|~Blastocisto~|~4"), null);
});

test("parseColeta exige doadora/data/metodo válidos", () => {
  assert.deepEqual(parseColeta("7~|~D-44~|~2026-07-27~|~Dra. Ana~|~FIV~|~Lab X~|~CONCLUIDA"), { ideagriId: 7, doadoraNumero: "D-44", data: "2026-07-27", tecnico: "Dra. Ana", metodo: "FIV", laboratorio: "Lab X", status: "CONCLUIDA" });
  assert.equal(parseColeta("7~|~~|~2026-07-27~|~~|~FIV~|~~|~"), null);
  assert.equal(parseColeta("7~|~D-44~|~2026-07-27~|~~|~QUALQUER~|~~|~"), null);
});

test("parseOocitoColeta exige coleta, qualidade e quantidade positiva", () => {
  assert.deepEqual(parseOocitoColeta("7~|~A~|~1~|~8"), { coletaIdeagriId: 7, qualidade: "A", viavel: true, quantidade: 8 });
  assert.equal(parseOocitoColeta("7~|~A~|~1~|~0"), null);
  assert.equal(parseOocitoColeta("7~|~~|~1~|~8"), null);
});

test("parseFertilizacao exige coleta e reprodutor, tipo de sêmen opcional", () => {
  assert.deepEqual(parseFertilizacao("20~|~7~|~44~|~SEX~|~2026-07-27~|~ICSI"), { ideagriId: 20, coletaIdeagriId: 7, reprodutorIdeagriId: 44, tipoSemenSigla: "SEX", data: "2026-07-27", tecnica: "ICSI" });
  assert.equal(parseFertilizacao("20~|~~|~44~|~SEX~|~2026-07-27~|~ICSI"), null);
  assert.equal(parseFertilizacao("20~|~7~|~~|~SEX~|~2026-07-27~|~ICSI"), null);
});

test("parseEmbriaoColeta exige fertilização e sigla de classificação", () => {
  assert.deepEqual(parseEmbriaoColeta("70~|~20~|~BX~|~E-70~|~BLASTOCISTO~|~1"), { ideagriId: 70, fertilizacaoIdeagriId: 20, classificacaoSigla: "BX", codigoInterno: "E-70", estagio: "BLASTOCISTO", viavel: true });
  assert.equal(parseEmbriaoColeta("70~|~~|~BX~|~E-70~|~BLASTOCISTO~|~1"), null);
  assert.equal(parseEmbriaoColeta("70~|~20~|~~|~E-70~|~BLASTOCISTO~|~1"), null);
});

test("parseGrupoPool e parseItemGrupoPool exigem identidade e doadora", () => {
  assert.deepEqual(parseGrupoPool("2~|~Elite"), { ideagriId: 2, nome: "Elite" });
  assert.equal(parseGrupoPool("2~|~"), null);
  assert.deepEqual(parseItemGrupoPool("2~|~D-44"), { grupoIdeagriId: 2, doadoraNumero: "D-44" });
  assert.equal(parseItemGrupoPool("~|~D-44"), null);
});

test("main coleta os prefixos de FIV/pool, emite arrays e contagens", (t) => {
  const linhas = [
    "@EMBCLASS@3~|~BX~|~Blastocisto~|~4",
    "@COLETA@7~|~D-44~|~2026-07-27~|~Dra. Ana~|~FIV~|~Lab X~|~CONCLUIDA",
    "@OOCITO@7~|~A~|~1~|~8",
    "@FERTCOL@20~|~7~|~44~|~SEX~|~2026-07-27~|~ICSI",
    "@EMBRIAO@70~|~20~|~BX~|~E-70~|~BLASTOCISTO~|~1",
    "@POOLGRP@2~|~Elite",
    "@POOLITEM@2~|~D-44",
  ];
  const { execucao, destino } = executarMainIsolado(t, linhas);
  assert.equal(execucao.status, 0, execucao.stderr);
  const out = JSON.parse(readFileSync(destino, "utf8"));
  assert.equal(out.embriaoClassificacoes.length, 1);
  assert.equal(out.coletas.length, 1);
  assert.equal(out.oocitosColeta.length, 1);
  assert.equal(out.fertilizacoes.length, 1);
  assert.equal(out.embrioesColeta.length, 1);
  assert.equal(out.gruposPool.length, 1);
  assert.equal(out.itensGrupoPool.length, 1);
});

test("main aborta sem emitir JSON quando encontra registro FIV inválido", (t) => {
  const { execucao, destino } = executarMainIsolado(t, ["@COLETA@7~|~~|~2026-07-27~|~~|~FIV~|~~|~"]);
  assert.equal(execucao.status, 1);
  assert.equal(existsSync(destino), false);
});
