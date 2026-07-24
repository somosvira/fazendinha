import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoriaDe, parseAnimal, derivarStatusRepro, delEStatusLactacao, diasEntre, parseEvento,
  parseDoenca, parseAplicacao, parseAnalise, parseMamite, parsePesagem, parseLactacao,
} from "./build-rebanho-json.mjs";

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

test("parseEvento: parto (tipo 7) → PARTO com cria", () => {
  const e = parseEvento("1027~|~1006~|~7~|~2023-09-12~|~~|~~|~~|~~|~~|~~|~1~|~1~|~M");
  assert.equal(e.tipo, "PARTO");
  assert.equal(e.ideagriId, 1006);
  assert.equal(e.tipoParto, "1");
  assert.equal(e.numCrias, 1);
  assert.equal(e.sexoCria, "M");
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
