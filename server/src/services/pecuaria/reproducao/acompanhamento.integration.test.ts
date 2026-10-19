import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { transacaoValidada } from "../../../lib/transacao-validada.js";
import { adotarAcompanhamento, criarDemandasDoFatoTx, listarAcompanhamentos, previaAdocaoAcompanhamento, reconciliarDemandasAnimalTx } from "./acompanhamento.js";

// Constraints e transações reais: execução exclusivamente no CI externo com opt-in explícito.
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" && process.env.CI === "true" && process.env.GITHUB_ACTIONS === "true" ? describe : describe.skip;
const sitios: number[] = [], animais: string[] = [], tipos: string[] = [];
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const parametros = { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 10 }, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 7 }, { ocorrencia: 2, diasAposPrimeiroPositivo: 17 }] };
async function fixture() {
  exigirBancoIntegracaoPecuaria();
  const sitio = await prisma.propriedade.create({ data: { nome: `Acompanhamento independente ${randomUUID()}` } }); sitios.push(sitio.id);
  const novos = [];
  for (let n = 0; n < 2; n++) {
    const a = await prisma.animal.create({ data: { brinco: `AC${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: d("2024-01-01"), dataEntrada: d("2025-01-01") } });
    animais.push(a.id); novos.push(a);
    await prisma.localizacaoAnimal.create({ data: { animalId: a.id, propriedadeId: sitio.id, desde: d("2025-01-01") } });
  }
  const tipo = await prisma.tipoExame.create({ data: { nome: `Conclusão independente ${randomUUID()}`, tipoResultado: "MULTIPLO", contexto: "REPRODUTIVO", campos: [{ codigo: "CONCLUSAO_GESTACIONAL", tipo: "OPCAO", opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] }] } }); tipos.push(tipo.id);
  const politica = await prisma.politicaAcompanhamentoReprodutivo.create({ data: { propriedadeId: sitio.id, versao: 1, vigenteDesde: d("2026-01-01"), parametros } });
  const tentativa = await prisma.tentativaReprodutiva.create({ data: { animalId: novos[0].id, propriedadeId: sitio.id, data: d("2026-01-01"), tipo: "IA", ciclo: 1, ordem: 1, origemMaterial: "DOCUMENTADA", geneticaSnapshot: { origem: "FIXTURE" } } });
  const gestacao = await prisma.gestacaoAnimal.create({ data: { animalId: novos[0].id, propriedadeId: sitio.id, tentativaId: tentativa.id, confirmadaEm: d("2026-01-03") } });
  return { sitioId: sitio.id, animalId: novos[0].id, outroId: novos[1].id, tipoId: tipo.id, politica, tentativa, gestacao };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function dadosDemanda(f: Fixture, gestacional = false, ocorrencia = 1): Prisma.DemandaAcompanhamentoReprodutivoUncheckedCreateInput {
  return { animalId: f.animalId, propriedadeOrigemId: f.sitioId, politicaId: f.politica.id, finalidade: gestacional ? "RECONFIRMACAO" : "DIAGNOSTICO",
    tentativaId: gestacional ? null : f.tentativa.id, gestacaoId: gestacional ? f.gestacao.id : null, ocorrencia,
    dataReferencia: d(gestacional ? "2026-01-03" : "2026-01-01"), previstaPara: d(ocorrencia === 2 ? "2026-01-20" : "2026-01-10"),
    regraSnapshot: { versao: 1, efeito: "ALERTA", politicaId: f.politica.id, politicaVersao: f.politica.versao } };
}
async function exame(f: Fixture, p: { demandaId?: string; animalId?: string; gestacional?: boolean; conclusao?: "POSITIVO" | "NEGATIVO" | "INCONCLUSIVO"; data?: string } = {}) {
  return transacaoValidada(tx => tx.exameAnimal.create({ data: { animalId: p.animalId ?? f.animalId, propriedadeId: f.sitioId, tipoExameId: f.tipoId,
    data: d(p.data ?? "2026-01-25"), finalidades: [p.gestacional ? "RECONFIRMACAO" : "DIAGNOSTICO"], finalidadePrincipal: p.gestacional ? "RECONFIRMACAO" : "DIAGNOSTICO",
    demandaAcompanhamentoId: p.demandaId, formatoSnapshot: { nome: "Conclusão independente", tipoResultado: "MULTIPLO", versao: 1 },
    interpretacao: { create: { tentativaId: p.gestacional ? null : f.tentativa.id, gestacaoId: p.gestacional ? f.gestacao.id : null } },
    resultados: { create: { campo: "CONCLUSAO_GESTACIONAL", valor: p.conclusao ?? "POSITIVO" } } }, include: { resultados: true } }));
}
async function resolvida(f: Fixture) {
  const demanda = await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f) });
  const e = await exame(f, { demandaId: demanda.id });
  await transacaoValidada(tx => reconciliarDemandasAnimalTx(tx, f.animalId, null));
  expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: demanda.id } })).estado).toBe("RESOLVIDA");
  return { demanda, e };
}
suite("acompanhamento — garantias SQL independentes no CI externo", () => {
  beforeAll(() => { exigirBancoIntegracaoPecuaria(); });
  afterEach(async () => {
    if (!sitios.length) return;
    // Somente os IDs desta suíte; estado final vazio conferido pelas mesmas constraints de produção.
    await transacaoValidada(async tx => {
      const ids = { in: animais };
      await tx.exameAnimal.updateMany({ where: { animalId: ids }, data: { demandaAcompanhamentoId: null } });
      await tx.demandaAcompanhamentoReprodutivo.deleteMany({ where: { animalId: ids } });
      await tx.interpretacaoReprodutiva.deleteMany({ where: { exame: { animalId: ids } } });
      await tx.resultadoExame.deleteMany({ where: { exame: { animalId: ids } } });
      await tx.exameAnimal.deleteMany({ where: { animalId: ids } });
      await tx.gestacaoAnimal.deleteMany({ where: { animalId: ids } });
      await tx.tentativaReprodutiva.deleteMany({ where: { animalId: ids } });
      await tx.politicaAcompanhamentoReprodutivo.deleteMany({ where: { propriedadeId: { in: sitios } } });
      await tx.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId: ids }, { propriedadeId: { in: sitios } }] } });
      await tx.requisicaoPecuaria.deleteMany({ where: { propriedadeId: { in: sitios } } });
      await tx.localizacaoAnimal.deleteMany({ where: { animalId: ids } });
      await tx.animal.deleteMany({ where: { id: ids } });
      await tx.tipoExame.deleteMany({ where: { id: { in: tipos } } });
      await tx.propriedade.deleteMany({ where: { id: { in: sitios } } });
    });
    sitios.length = 0; animais.length = 0; tipos.length = 0;
  });

  it("política e demanda válidas persistem e repetição do fato conserva identidade única", async () => {
    const f = await fixture();
    const origem = { tentativaId: f.tentativa.id, animalId: f.animalId, propriedadeId: f.sitioId, data: f.tentativa.data };
    await transacaoValidada(async tx => { await criarDemandasDoFatoTx(tx, origem, null); await criarDemandasDoFatoTx(tx, origem, null); });
    const demandas = await prisma.demandaAcompanhamentoReprodutivo.findMany({ where: { animalId: f.animalId } });
    expect(demandas).toHaveLength(1); expect(demandas[0].previstaPara).toEqual(d("2026-01-11"));
    expect(demandas[0].regraSnapshot).toMatchObject({ politicaId: f.politica.id, politicaVersao: 1 });
  });
  it("SQL rejeita política vazia, não instala defaults clínicos e não deixa registro inválido", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => tx.politicaAcompanhamentoReprodutivo.create({ data: { propriedadeId: f.sitioId, versao: 2, vigenteDesde: d("2026-02-01"), parametros: {} } }))).rejects.toThrow();
    expect(await prisma.politicaAcompanhamentoReprodutivo.count({ where: { propriedadeId: f.sitioId } })).toBe(1);
  });
  it("política publicada é imutável e snapshot inválido da demanda é recusado", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => tx.politicaAcompanhamentoReprodutivo.update({ where: { id: f.politica.id }, data: { parametros: { ...parametros, diagnostico: { diasAposTentativa: 30 } } } }))).rejects.toThrow();
    await expect(transacaoValidada(tx => tx.demandaAcompanhamentoReprodutivo.create({ data: { ...dadosDemanda(f), regraSnapshot: {} } }))).rejects.toThrow();
  });
  it("mudar versão da política não permite repetir mesma âncora/finalidade/ocorrência", async () => {
    const f = await fixture(); await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f, true) });
    const p2 = await prisma.politicaAcompanhamentoReprodutivo.create({ data: { propriedadeId: f.sitioId, versao: 2, vigenteDesde: d("2026-02-01"), parametros } });
    await expect(transacaoValidada(tx => tx.demandaAcompanhamentoReprodutivo.create({ data: { ...dadosDemanda(f, true), politicaId: p2.id, regraSnapshot: { efeito: "ALERTA", politicaId: p2.id, politicaVersao: 2 } } }))).rejects.toThrow();
  });
  it("âncora de outro animal não pode ser disfarçada como demanda do animal atual", async () => {
    const f = await fixture();
    await expect(transacaoValidada(tx => tx.demandaAcompanhamentoReprodutivo.create({ data: { ...dadosDemanda(f), animalId: f.outroId } }))).rejects.toThrow();
  });
  it.each([null, "", "   "])("perda tipada rejeita explicação vazia %#", async motivoEncerramento => {
    const f = await fixture();
    await expect(transacaoValidada(tx => tx.gestacaoAnimal.update({ where: { id: f.gestacao.id }, data: { encerradaEm: d("2026-01-20"), tipoEncerramento: "PERDA", motivoEncerramento, causaClinica: { estado: "DESCONHECIDA" } } }))).rejects.toThrow();
    expect((await prisma.gestacaoAnimal.findUniqueOrThrow({ where: { id: f.gestacao.id } })).encerradaEm).toBeNull();
  });
  it("causa clínica desconhecida aceita perda com explicação do contexto preservada", async () => {
    const f = await fixture();
    const g = await transacaoValidada(tx => tx.gestacaoAnimal.update({ where: { id: f.gestacao.id }, data: { encerradaEm: d("2026-01-20"), tipoEncerramento: "PERDA", motivoEncerramento: "Observado retorno ao cio; causa não identificada", causaClinica: { estado: "DESCONHECIDA" } } }));
    expect(g.tipoEncerramento).toBe("PERDA"); expect(g.causaClinica).toEqual({ estado: "DESCONHECIDA" });
  });
  it("exame explicitamente ligado à demanda não pode pertencer a outro animal", async () => {
    const f = await fixture(); const demanda = await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f) });
    await expect(exame(f, { demandaId: demanda.id, animalId: f.outroId })).rejects.toThrow();
  });
  it("inconclusivo após o prazo preserva necessidade e não satisfaz resolução por UPDATE direto", async () => {
    const f = await fixture(); const demanda = await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f) });
    const e = await exame(f, { demandaId: demanda.id, conclusao: "INCONCLUSIVO" });
    await transacaoValidada(tx => reconciliarDemandasAnimalTx(tx, f.animalId, null));
    expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: demanda.id } })).estado).toBe("PENDENTE");
    await expect(transacaoValidada(tx => tx.demandaAcompanhamentoReprodutivo.update({ where: { id: demanda.id }, data: { estado: "RESOLVIDA", exameResolucaoId: e.id, resolvidaEm: e.data, resolucaoSnapshot: { exameId: e.id } } }))).rejects.toThrow();
  });
  it("prova ancorada na ocorrência2 não resolve ocorrência1 nem é usada duas vezes", async () => {
    const f = await fixture(); const primeira = await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f, true, 1) });
    const segunda = await prisma.demandaAcompanhamentoReprodutivo.create({ data: dadosDemanda(f, true, 2) });
    const e = await exame(f, { demandaId: segunda.id, gestacional: true });
    await transacaoValidada(tx => reconciliarDemandasAnimalTx(tx, f.animalId, null));
    expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: primeira.id } })).estado).toBe("PENDENTE");
    expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: segunda.id } })).exameResolucaoId).toBe(e.id);
  });
  it("anular exame resolvedor exige reconciliação atômica e mantém a demanda após o rollback", async () => {
    const f = await fixture(); const { demanda, e } = await resolvida(f);
    await expect(transacaoValidada(tx => tx.exameAnimal.update({ where: { id: e.id }, data: { status: "ANULADO", motivoAnulacao: "Evidência invalidada nesta fixture" } }))).rejects.toThrow();
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("VALIDO");
    await transacaoValidada(async tx => { await tx.exameAnimal.update({ where: { id: e.id }, data: { status: "ANULADO", motivoAnulacao: "Evidência invalidada nesta fixture" } }); await reconciliarDemandasAnimalTx(tx, f.animalId, null); });
    expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: demanda.id } })).estado).toBe("PENDENTE");
  });
  it("retirar conclusão vigente resolvedora exige reconciliação na mesma transação", async () => {
    const f = await fixture(); const { demanda, e } = await resolvida(f);
    await expect(transacaoValidada(tx => tx.resultadoExame.update({ where: { id: e.resultados[0].id }, data: { vigente: false, substituidoEm: new Date() } }))).rejects.toThrow();
    await transacaoValidada(async tx => { await tx.resultadoExame.update({ where: { id: e.resultados[0].id }, data: { vigente: false, substituidoEm: new Date() } }); await reconciliarDemandasAnimalTx(tx, f.animalId, null); });
    expect((await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: demanda.id } })).estado).toBe("PENDENTE");
  });
  it("anular origem encerra demanda mesmo com prova anteriormente conclusiva preservada", async () => {
    const f = await fixture(); const { demanda, e } = await resolvida(f);
    await transacaoValidada(async tx => { await tx.tentativaReprodutiva.update({ where: { id: f.tentativa.id }, data: { status: "ANULADO", motivoAnulacao: "Tentativa invalidada pela revisão factual" } }); await reconciliarDemandasAnimalTx(tx, f.animalId, null); });
    expect(await prisma.demandaAcompanhamentoReprodutivo.findUniqueOrThrow({ where: { id: demanda.id } })).toMatchObject({ estado: "ENCERRADA", exameResolucaoId: null, motivoEncerramento: "ORIGEM_ANULADA" });
    expect((await prisma.exameAnimal.findUniqueOrThrow({ where: { id: e.id } })).status).toBe("VALIDO");
  });
  it("finalidade posterior incompatível não pode deixar resolução antiga pendurada", async () => {
    const f = await fixture(); const { e } = await resolvida(f);
    await expect(transacaoValidada(tx => tx.exameAnimal.update({ where: { id: e.id }, data: { finalidades: ["SEXAGEM"], finalidadePrincipal: "SEXAGEM", demandaAcompanhamentoId: null } }))).rejects.toThrow();
  });
  it("mudar interpretação de exame resolvedor exige compatibilidade ou reconciliação", async () => {
    const f = await fixture(); const { e } = await resolvida(f);
    await expect(transacaoValidada(tx => tx.interpretacaoReprodutiva.update({ where: { exameId: e.id }, data: { tentativaId: null } }))).rejects.toThrow();
  });
  it("adoção de gestação legada sem positivo comprovado não transforma confirmadaEm em primeiro DG", async () => {
    const f = await fixture();
    await expect(previaAdocaoAcompanhamento({ propriedadeId: f.sitioId, politicaId: f.politica.id, tentativaIds: [], gestacaoIds: [f.gestacao.id] })).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(await prisma.demandaAcompanhamentoReprodutivo.count({ where: { animalId: f.animalId } })).toBe(0);
  });
  it("adoção explícita ancora reconfirmações no positivo real, preserva prova e não reescreve confirmação legada", async () => {
    const f = await fixture(); const e = await exame(f, { gestacional: true, data: "2026-01-05" });
    const entrada = { propriedadeId: f.sitioId, politicaId: f.politica.id, tentativaIds: [], gestacaoIds: [f.gestacao.id] };
    const previa = await previaAdocaoAcompanhamento(entrada);
    expect(previa.propostas.map(p => p.dataReferencia)).toEqual(["2026-01-05", "2026-01-05"]);
    await adotarAcompanhamento({ ...entrada, chave: randomUUID(), motivo: "Adoção conferida com positivo canônico", revisao: previa.revisao }, null);
    const demandas = await prisma.demandaAcompanhamentoReprodutivo.findMany({ where: { gestacaoId: f.gestacao.id }, orderBy: { ocorrencia: "asc" } });
    expect(demandas).toHaveLength(2); expect(demandas[0]).toMatchObject({ exameOrigemId: e.id, origemAdocao: "ADOCAO_EXPLICITA", dataReferencia: d("2026-01-05"), previstaPara: d("2026-01-12") });
    expect((await prisma.gestacaoAnimal.findUniqueOrThrow({ where: { id: f.gestacao.id } })).confirmadaEm).toEqual(d("2026-01-03"));
  });
  it("política nova não se aplica a fato anterior e GET não cria nem reconcilia demanda", async () => {
    const f = await fixture();
    const antiga = await prisma.tentativaReprodutiva.create({ data: { animalId: f.animalId, propriedadeId: f.sitioId, data: d("2025-12-01"), tipo: "IA", ciclo: 1, ordem: 2, origemMaterial: "DOCUMENTADA", geneticaSnapshot: {} } });
    await transacaoValidada(tx => criarDemandasDoFatoTx(tx, { tentativaId: antiga.id, animalId: f.animalId, propriedadeId: f.sitioId, data: antiga.data }, null));
    expect(await listarAcompanhamentos(f.sitioId, f.animalId, "2026-02-01")).toEqual([]);
    expect(await prisma.demandaAcompanhamentoReprodutivo.count({ where: { animalId: f.animalId } })).toBe(0);
    expect(await prisma.politicaAcompanhamentoReprodutivo.count({ where: { propriedadeId: f.sitioId } })).toBe(1);
  });
});
