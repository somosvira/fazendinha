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
  const nomes = ["animal", "partoAnimal", "tentativaReprodutiva", "lactacaoAnimal", "gestacaoAnimal", "localizacaoAnimal", "avaliacaoReprodutiva", "situacaoInicialReprodutiva", "vinculoPoliticaCiclo", "restricaoReprodutiva", "periodoReprodutivoAnimal", "baixaAnimal", "politicaElegibilidadeReprodutiva", "decisaoElegibilidadeCiclo", "ocorrenciaSanitaria", "regraSanitariaReprodutiva", "exameAnimal", "pesagem", "criaParto"];
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
describe("aptidão geral no comando operacional", () => {
  it("exige exame; APTA inicial e decisão histórica isoladas não comprovam aptidão", async () => {
    const { tx, listas } = fonte(); listas.exameAnimal = [];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("sem aptidão confirmada");
  });
  it("o mesmo exame atende protocolo, IA, TE e primeira cobertura sem outra decisão", async () => {
    const { tx, listas } = fonte(); listas.decisaoElegibilidadeCiclo = [];
    for (const acao of ["PROTOCOLO", "IA", "TE", "COBERTURA"] as const)
      await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), acao)).resolves.toBeUndefined();
  });
  it("a correção da conclusão passa a valer sem apagar a evidência anterior da auditoria", async () => {
    const { tx, exame, listas } = fonte(); exame.resultadoOpcao = "NAO_APTO";
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("EXAME_NAO_APTA");
    expect(listas.decisaoElegibilidadeCiclo).toHaveLength(1);
  });
  it("descarte continua impedimento depois do exame apto", async () => {
    const { tx, listas } = fonte(); listas.restricaoReprodutiva = [{ id: "r", animalId: "a", tipo: "DESCARTE", data: dia("2026-10-20"), ate: null, status: "VALIDO" }];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "PROTOCOLO")).rejects.toThrow("MATRIZ_DESCARTE");
  });
  it.each(["NORMAL", "ABORTO", "NATIMORTO"])("não reutiliza exame anterior depois de %s", async tipo => {
    const { tx, listas } = fonte();
    listas.partoAnimal = [{ id: "novo", animalId: "a", propriedadeId: 1, data: dia("2026-10-20"), status: "VALIDO", tipo, desfecho: tipo === "ABORTO" ? "ABORTO" : "NASCIMENTO", incluidoSaldoAnterior: false, gestacaoId: null }];
    for (const _reenvio of [1,2]) await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).rejects.toThrow("EXAME_APTIDAO_NECESSARIO");
  });
  it("RP em tratamento e encerramento exigem exame posterior, sem aptidão automática", async () => {
    const { tx, listas, exame } = fonte();
    const rp = { id: "rp", animalId: "a", propriedadeId: 1, status: "VALIDO", inicio: dia("2026-10-12"), fim: null as Date | null, partoRetencaoPlacentaId: "parto", doencaId: "rp" };
    listas.ocorrenciaSanitaria = [rp];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).rejects.toThrow("CONDICAO_IMPEDITIVA_VIGENTE");
    rp.fim = dia("2026-10-20");
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).rejects.toThrow("NOVO_EXAME_APOS_TRATAMENTO");
    exame.data = dia("2026-10-21");
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).resolves.toBeUndefined();
  });
  it("a ausência de política não permite tentativa sem exame", async () => {
    const { tx, listas } = fonte(); listas.politicaElegibilidadeReprodutiva = []; listas.exameAnimal = [];
    await expect(conferirAptidaoParaAcaoTx(tx, "a", 1, dia("2026-10-29"), "IA")).rejects.toThrow("sem aptidão confirmada");
  });
});
