import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { conferirAptidaoParaAcaoTx } from "./elegibilidade.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
function fonte() {
  const grupo = { idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ["MEDIDO"], escalaEcc: null, validadeEccDias: null };
  const politica = { id: "politica", propriedadeId: 1, versao: 1, vigenteDesde: dia("2026-01-01"), parametros: { versao: 2, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 45, pevMultiparasDias: 60, aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "EXCLUIR", perdaGestacional: "EXIGE_LIBERACAO", papeisIncluidos: ["NENHUM"], criteriosAptidao: { vacas: grupo, novilhas: grupo, diasAvaliacaoPosParto: null } } };
  const vinculo = { id: "v", animalId: "a", inicioCiclo: dia("2026-01-01"), politicaId: "politica", chaveCiclo: "INICIAL", situacaoInicialId: "inicial", situacaoInicial: { id: "inicial", status: "VALIDO", data: dia("2026-01-01") }, politica };
  const exame = { id: "e", animalId: "a", propriedadeId: 1, data: dia("2026-10-10"), atualizadoEm: dia("2026-10-10"), status: "VALIDO", resultadoOpcao: "APTO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", interpretacao: null, resultados: [], anotacaoOriginal: null };
  const decisao = { id: "d", vinculoCicloId: "v", data: dia("2026-10-11"), criadoEm: dia("2026-10-11"), tipo: "LIBERAR", status: "VALIDO", aptaDesde: dia("2026-10-11"), exameAptidaoId: "e", exameAptidaoSnapshot: { id: "e", data: "2026-10-10", atualizadoEm: exame.atualizadoEm.toISOString(), resultado: "APTO", acaoLiberada: "PROTOCOLO" } };
  const listas: Record<string, unknown[]> = {
    animal: [{ id: "a", sexo: "F", dataEntrada: dia("2025-01-01"), partosAntesDaEntrada: 0, dataNascimento: dia("2024-01-01") }],
    situacaoInicialReprodutiva: [{ id: "inicial", animalId: "a", data: dia("2026-01-01"), criadoEm: dia("2026-01-01"), situacao: "APTA", status: "VALIDO", aptaDesde: null }],
    localizacaoAnimal: [{ id: "l", animalId: "a", propriedadeId: 1, loteId: null, desde: dia("2025-01-01"), ate: null }],
    periodoReprodutivoAnimal: [{ id: "p", animalId: "a", tipo: "NENHUM", inicio: dia("2025-01-01"), fim: null }],
    vinculoPoliticaCiclo: [vinculo], politicaElegibilidadeReprodutiva: [politica], decisaoElegibilidadeCiclo: [decisao], exameAnimal: [exame],
  };
  const nomes = ["animal", "partoAnimal", "tentativaReprodutiva", "lactacaoAnimal", "gestacaoAnimal", "localizacaoAnimal", "avaliacaoReprodutiva", "situacaoInicialReprodutiva", "vinculoPoliticaCiclo", "restricaoReprodutiva", "periodoReprodutivoAnimal", "baixaAnimal", "politicaElegibilidadeReprodutiva", "decisaoElegibilidadeCiclo", "exameAnimal", "pesagem", "criaParto"];
  const mock = Object.fromEntries(nomes.map(n => [n, { findMany: vi.fn(async () => listas[n] ?? []), findFirst: vi.fn(async () => listas[n]?.[0] ?? null), findUnique: vi.fn(async () => listas[n]?.[0] ?? null) }]));
  mock.vinculoPoliticaCiclo.findUnique.mockImplementation(async (args?: unknown) => {
    const consulta = args as { where?: { animalId_chaveCiclo?: { animalId: string; chaveCiclo: string } } };
    const chave = consulta?.where?.animalId_chaveCiclo;
    return listas.vinculoPoliticaCiclo.find(v => {
      const vinculo = v as { animalId: string; chaveCiclo: string };
      return !chave || vinculo.animalId === chave.animalId && vinculo.chaveCiclo === chave.chaveCiclo;
    }) ?? null;
  });
  return { tx: mock as unknown as Prisma.TransactionClient, listas, exame, decisao, mock };
}
describe("revalidação de ação no servidor com política v2", () => {
  it("não libera sem decisão comprovada mesmo com situação inicial apta", async () => {
    const { tx, listas } = fonte(); listas.decisaoElegibilidadeCiclo = [];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("Decisão de aptidão");
  });
  it("permite ação expressamente avaliada e exige outra decisão para IA", async () => {
    const { tx } = fonte();
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).resolves.toBeUndefined();
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).rejects.toThrow("não autoriza esta ação");
  });
  it("correção do exame suspende efeito sem apagar a decisão", async () => {
    const { tx, exame, listas } = fonte(); exame.atualizadoEm = dia("2026-10-12");
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("Decisão de aptidão");
    expect(listas.decisaoElegibilidadeCiclo).toHaveLength(1);
  });
  it("gestação e descarte continuam impedimentos depois do exame apto", async () => {
    const { tx, listas } = fonte();
    listas.restricaoReprodutiva = [{ id: "r", animalId: "a", tipo: "DESCARTE", data: dia("2026-10-20"), ate: null, status: "VALIDO" }];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("Decisão de aptidão");
  });
});

describe("o gate usa a política comprovada do ciclo factual atual", () => {
  it.each(["NORMAL", "ABORTO", "NATIMORTO"])("não herda V1 anterior depois de %s sem vínculo do ciclo novo, inclusive no reenvio", async tipo => {
    const { tx, listas, mock } = fonte();
    const vinculo = listas.vinculoPoliticaCiclo[0] as { politica: { parametros: Record<string, unknown> }; chaveCiclo: string };
    const { criteriosAptidao: _criterios, ...legado } = vinculo.politica.parametros;
    listas.vinculoPoliticaCiclo = [{ ...vinculo, chaveCiclo: "PARTO:anterior", politica: { ...vinculo.politica, parametros: { ...legado, versao: 1 } } }];
    listas.partoAnimal = [{ id: "novo", animalId: "a", propriedadeId: 1, data: dia("2026-10-20"), status: "VALIDO", tipo: tipo === "NATIMORTO" ? "NORMAL" : tipo, desfecho: tipo === "ABORTO" ? "ABORTO" : "NASCIMENTO", incluidoSaldoAnterior: false, gestacaoId: null }];
    listas.criaParto = tipo === "NATIMORTO" ? [{ partoId: "novo", viva: false }] : [];
    for (const _reenvio of [1, 2]) await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("Decisão de aptidão");
    expect(mock.vinculoPoliticaCiclo.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId_chaveCiclo: { animalId: "a", chaveCiclo: "PARTO:novo" } } }));
    expect(mock.vinculoPoliticaCiclo.findFirst).not.toHaveBeenCalled();
  });
  it("conserva V1 quando ela está comprovadamente vinculada ao ciclo atual", async () => {
    const { tx, listas } = fonte();
    const vinculo = listas.vinculoPoliticaCiclo[0] as { politica: { parametros: Record<string, unknown> } };
    const { criteriosAptidao: _criterios, ...legado } = vinculo.politica.parametros;
    listas.vinculoPoliticaCiclo = [{ ...vinculo, politica: { ...vinculo.politica, parametros: { ...legado, versao: 1 } } }];
    listas.decisaoElegibilidadeCiclo = []; listas.exameAnimal = [];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).resolves.toBeUndefined();
  });
});
it("origem inicial anulada não comprova a exceção histórica V1", async () => {
  const { tx, listas } = fonte();
  const vinculo = listas.vinculoPoliticaCiclo[0] as { politica: { parametros: Record<string, unknown> }; situacaoInicial: { status: string } };
  const { criteriosAptidao: _criterios, ...legado } = vinculo.politica.parametros;
  listas.vinculoPoliticaCiclo = [{ ...vinculo, situacaoInicial: { ...vinculo.situacaoInicial, status: "ANULADO" }, politica: { ...vinculo.politica, parametros: { ...legado, versao: 1 } } }];
  await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("ciclo atual");
});
