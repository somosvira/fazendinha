import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodificarDump, corrigirMojibake, parseSetor, papelReprodutivoDe, origemDe,
  composicaoEm64, aptidaoDe, fracaoNeloreTexto, periodoAbertoDe, construir,
} from "./build-pecuaria-json.mjs";

test("parseSetor separa sítio da função pelo primeiro hífen", () => {
  assert.deepEqual(parseSetor("Mexicana - Receptoras"), { propriedadeNome: "Mexicana", funcao: "Receptoras" });
  assert.equal(parseSetor("Principal - Leite").propriedadeNome, "Principal");
  assert.equal(parseSetor("SÃ£o Francisco- Receptoras").propriedadeNome, "São Francisco");
  assert.equal(parseSetor("Carlos Alves - Receptoras").propriedadeNome, "Carlos Alves");
  assert.equal(parseSetor("").propriedadeNome, "Principal");
  assert.equal(parseSetor(null).propriedadeNome, "Principal");
});

test("encoding: UTF-8 válido, CP1252 e mojibake", () => {
  assert.equal(decodificarDump(Buffer.from("Holandês", "utf8")), "Holandês");
  assert.equal(decodificarDump(Buffer.from("Holandês", "latin1")), "Holandês");
  assert.equal(corrigirMojibake("HolandÃªs"), "Holandês");
  assert.equal(corrigirMojibake("IntoxicaÃ§Ã£o com urÃ©ia"), "Intoxicação com uréia");
  assert.equal(corrigirMojibake("CANDELÃ\u0081RIA"), "CANDELÁRIA");
  assert.equal(corrigirMojibake("São Francisco"), "São Francisco");
  assert.equal(corrigirMojibake("Ãgua"), "Ãgua"); // "Ã" legítimo seguido de letra comum fica
});

test("composição em 64 avos com soma ≤ 64", () => {
  assert.deepEqual(composicaoEm64([{ sigla: "HO", percentual: 75 }, { sigla: "GL", percentual: 25 }]), [
    { sigla: "HO", fracao64: 48 }, { sigla: "GL", fracao64: 16 },
  ]);
  // 3 × 33.4% → 21+21+21 = 63 (≤ 64)
  const tres = composicaoEm64([{ sigla: "A", percentual: 33.4 }, { sigla: "B", percentual: 33.3 }, { sigla: "C", percentual: 33.3 }]);
  assert.ok(tres.reduce((t, c) => t + c.fracao64, 0) <= 64);
  // arredondamento que estoura: 50.8 + 49.6 → 33 + 32 = 65 → maior ajustado
  const estouro = composicaoEm64([{ sigla: "HO", percentual: 50.8 }, { sigla: "GO", percentual: 49.6 }]);
  assert.deepEqual(estouro, [{ sigla: "GO", fracao64: 32 }, { sigla: "HO", fracao64: 32 }]);
  assert.deepEqual(composicaoEm64([]), []);
});

test("origem NASCIDO quando nascimento = entrada", () => {
  assert.equal(origemDe("2022-01-01", "2022-01-01"), "NASCIDO");
  assert.equal(origemDe("2022-01-01", "2023-05-10"), "COMPRADO");
});

test("papel receptora pelo setor", () => {
  assert.equal(papelReprodutivoDe("Mexicana - Receptoras"), "RECEPTORA");
  assert.equal(papelReprodutivoDe("Principal - RECEPTORAS"), "RECEPTORA");
  assert.equal(papelReprodutivoDe("Principal - Leite"), "NENHUM");
  assert.equal(papelReprodutivoDe(null), "NENHUM");
});

test("aptidão CORTE só com Nelore majoritário", () => {
  assert.equal(aptidaoDe([{ sigla: "NE", fracao64: 64 }]), "CORTE");
  assert.equal(aptidaoDe([{ sigla: "NE", fracao64: 32 }, { sigla: "GO", fracao64: 32 }]), "LEITE");
  assert.equal(aptidaoDe([], "Nelore"), "CORTE");
  assert.equal(aptidaoDe([], "1/2 NE, 1/4 HO, GO"), "LEITE");
  assert.equal(aptidaoDe([], "1/4 GO, NE"), "CORTE");
  assert.equal(aptidaoDe([], "Girolando"), "LEITE");
  assert.equal(fracaoNeloreTexto("1/2 GO, NE"), 0.5);
});

test("construir: ponta a ponta, determinístico", () => {
  const dump = [
    "@MB@3~|~DoaÃ§Ã£o",
    "@TB@1~|~VoluntÃ¡ria",
    "@RC@1~|~HO~|~HolandÃªs",
    "@A@20~|~1044~|~BOA FÃ\u0089~|~F~|~2020-01-01~|~2021-03-01~|~~|~~|~1~|~2024-02-02~|~3~|~DoaÃ§Ã£o~|~SÃ£o Francisco- Receptoras~|~Lote 1~|~Nelore~|~~|~1",
    "@A@10~|~030~|~~|~M~|~~|~2024-01-01~|~~|~~|~0~|~~|~~|~~|~Principal - Leite~|~~|~3/4 HO, GL",
    "@RACA@10~|~1~|~HO~|~Holandês~|~75",
    "@RACA@10~|~2~|~GL~|~Gir Leiteiro~|~25",
    "@P@7~|~10~|~2024-05-01~|~300.5~|~Pesagem",
  ].join("\n");
  const j = construir(dump, "2026-09-22");
  assert.deepEqual(j.animais.map((a) => a.ideagriId), [10, 20]);
  const [a, b] = j.animais;
  assert.equal(a.nascimentoEstimado, true);
  assert.equal(a.dataNascimento, "2024-01-01");
  assert.equal(a.propriedadeNome, "Principal");
  assert.deepEqual(a.composicao, [{ sigla: "HO", fracao64: 48 }, { sigla: "GL", fracao64: 16 }]);
  assert.equal(a.racaTexto, undefined);
  assert.deepEqual(a.pesagens, [{ ideagriId: 7, data: "2024-05-01", pesoKg: 300.5, tipoIdeagri: "Pesagem" }]);
  assert.equal(b.nome, "BOA FÉ");
  assert.equal(b.origem, "COMPRADO");
  assert.equal(b.papelReprodutivo, "RECEPTORA");
  assert.equal(b.aptidao, "CORTE");
  assert.equal(b.racaTexto, "Nelore");
  assert.deepEqual(b.baixa, { data: "2024-02-02", tipoIdeagri: 1, motivoIdeagriId: 3, motivoNome: "Doação" });
  assert.deepEqual(j.propriedades, [{ nome: "Principal" }, { nome: "São Francisco" }]);
  assert.deepEqual(j.lotes, [{ nome: "Lote 1", propriedadeNome: "São Francisco", ideagriGrupo: "Lote 1" }]);
  assert.deepEqual(j.racas, [{ ideagriId: 1, sigla: "HO", nome: "Holandês" }]);
  assert.deepEqual(j.motivosBaixa, [{ ideagriId: 3, nome: "Doação" }]);
  assert.deepEqual(j.tiposBaixa, [{ ideagriId: 1, nome: "Voluntária" }]);
  assert.deepEqual(construir(dump, "2026-09-22"), j);
  assert.ok(!JSON.stringify(j).includes("Ã"));
});

test("baixa fica nula sem cdTipoBaixa e null explícito quando dataBaixa presente sem tipo", () => {
  const dump = [
    "@A@30~|~040~|~~|~F~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~2024-03-01~|~~|~~|~Principal~|~~|~Nelore~|~~|~",
  ].join("\n");
  const j = construir(dump, "2026-09-22");
  assert.deepEqual(j.animais[0].baixa, { data: "2024-03-01", tipoIdeagri: null, motivoIdeagriId: null, motivoNome: null });
});

test("brinco eletrônico e SISBOV chegam no animal", () => {
  const dump = [
    "@A@50~|~500~|~~|~F~|~2020-01-01~|~2020-01-01~|~982000100000500~|~BR105000000500~|~0~|~~|~~|~~|~Principal~|~~|~Nelore~|~~|~",
  ].join("\n");
  const j = construir(dump, "2026-09-22");
  assert.equal(j.animais[0].brincoEletronico, "982000100000500");
  assert.equal(j.animais[0].sisbov, "BR105000000500");
});

test("brinco eletrônico e SISBOV vazios viram null", () => {
  const dump = "@A@60~|~600~|~~|~M~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~~|~~|~~|~Principal~|~~|~Nelore~|~~|~";
  const j = construir(dump, "2026-09-22");
  assert.equal(j.animais[0].brincoEletronico, null);
  assert.equal(j.animais[0].sisbov, null);
});

test("periodoAbertoDe: só o mais recente entre os abertos (dataFim vazio); sem período aberto vira null", () => {
  assert.equal(periodoAbertoDe([]), null);
  assert.equal(periodoAbertoDe(undefined), null);
  assert.equal(
    periodoAbertoDe([{ ideagriId: 1, tipo: 1, dataInicio: "2020-01-01", dataFim: "2021-01-01" }]),
    null,
  ); // só tem período fechado
  assert.deepEqual(
    periodoAbertoDe([
      { ideagriId: 1, tipo: 2, dataInicio: "2020-01-01", dataFim: null },
      { ideagriId: 2, tipo: 1, dataInicio: "2023-05-01", dataFim: null },
    ]),
    { tipo: 1, dataInicio: "2023-05-01" },
  );
});

test("construir: período reprodutivo aberto (@AP@) vira periodoAberto no animal", () => {
  const dump = [
    "@A@70~|~700~|~~|~F~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~~|~~|~~|~Principal~|~~|~Nelore~|~~|~",
    "@AP@1~|~70~|~2~|~2024-01-10~|~",
  ].join("\n");
  const j = construir(dump, "2026-09-22");
  assert.deepEqual(j.animais[0].periodoAberto, { tipo: 2, dataInicio: "2024-01-10" });
});

test("construir: período com dataFim (fechado) não vira periodoAberto; animal sem período fica null", () => {
  const dump = [
    "@A@71~|~701~|~~|~F~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~~|~~|~~|~Principal~|~~|~Nelore~|~~|~",
    "@AP@2~|~71~|~1~|~2022-01-01~|~2022-06-01",
    "@A@72~|~702~|~~|~F~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~~|~~|~~|~Principal~|~~|~Nelore~|~~|~",
  ].join("\n");
  const j = construir(dump, "2026-09-22");
  assert.equal(j.animais[0].periodoAberto, null); // 71
  assert.equal(j.animais[1].periodoAberto, null); // 72, sem nenhuma linha @AP@
});

test("filiação: mãe do rebanho, pai externo com composição, referências inválidas descartadas", () => {
  const A = (id, numero, sexo) => `@A@${id}~|~${numero}~|~~|~${sexo}~|~2020-01-01~|~2020-01-01~|~~|~~|~0~|~~|~~|~~|~Principal - Leite~|~Lote 1~|~~|~~|~`;
  const dump = [
    A(1, "V1", "F"),
    A(2, "V2", "F"),
    A(3, "T3", "M"),
    "@FIL@2~|~1~|~900",   // mãe do rebanho, pai externo
    "@FIL@3~|~901~|~2",   // mãe externa, "pai" fêmea do rebanho → descartado
    "@FIL@1~|~999~|~",    // mãe que não veio no dump → descartada
    "@GE@900~|~ZEUS123~|~Zeus~|~M~|~S~|~ABS Pecplan",
    "@GE@901~|~DB01~|~~|~F~|~E~|~",
    "@GERACA@900~|~1~|~HO~|~Holandês~|~100",
  ].join("\n");
  const json = construir(dump, "2026-09-26");
  const porId = new Map(json.animais.map((a) => [a.ideagriId, a]));
  assert.equal(porId.get(2).maeIdeagriId, 1);
  assert.equal(porId.get(2).paiIdeagriId, 900);
  assert.equal(porId.get(3).maeIdeagriId, 901);
  assert.equal(porId.get(3).paiIdeagriId, undefined);
  assert.equal(porId.get(1).maeIdeagriId, undefined);
  assert.deepEqual(json.genitoresExternos, [
    { ideagriId: 900, sexo: "M", nome: "Zeus", codigo: "ZEUS123", fornecedor: "ABS Pecplan", tipoIdeagri: "S", composicao: [{ sigla: "HO", fracao64: 64 }] },
    { ideagriId: 901, sexo: "F", nome: "DB01", codigo: null, fornecedor: null, tipoIdeagri: "E", composicao: [] },
  ]);
});
