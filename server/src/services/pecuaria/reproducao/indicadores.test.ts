import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import type { DadosElegibilidade } from "./elegibilidade.calc.js";

vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("./elegibilidade.js", () => ({ carregarDadosElegibilidadeTx: vi.fn() }));
import { carregarDadosElegibilidadeTx } from "./elegibilidade.js";
import { carregarDadosIndicadoresTx, consultarIndicadoresReprodutivosTx } from "./indicadores.js";
import { consultaIndicadoresSchema } from "./indicadores.schemas.js";

const data = (s: string) => new Date(`${s}T00:00:00Z`);
const filtros = consultaIndicadoresSchema.parse({ propriedadeId: 1, inicio: "2026-01-01", fim: "2026-02-11", corte: "2026-03-01" });
const base: DadosElegibilidade = { animais: [], partos: [], tentativas: [], lactacoes: [], gestacoes: [], localizacoes: [], avaliacoes: [], iniciais: [], vinculos: [], politicas: [], decisoes: [], restricoes: [], papeis: [], baixas: [] };
function fixture() {
  const a = { id: "a", brinco: "001", nome: null };
  const mock = {
    localizacaoAnimal: { findMany: vi.fn().mockResolvedValue([{ animal: a }, { animal: a }, { animal: { id: "b", brinco: null, nome: "B" } }]) },
    exameAnimal: { findMany: vi.fn().mockResolvedValue([
      { id: "negativo", animalId: "a", data: data("2026-02-15"), status: "VALIDO", realizacao: "REALIZADO", interpretacao: { tentativaId: "t1", gestacaoId: null }, resultados: [{ valor: "NEGATIVO" }] },
      { id: "semResultado", animalId: "b", data: data("2026-02-15"), status: "VALIDO", realizacao: "REALIZADO", interpretacao: { tentativaId: null, gestacaoId: null }, resultados: [] },
      { id: "naoRealizado", animalId: "a", data: data("2026-02-15"), status: "VALIDO", realizacao: "NAO_REALIZADO", interpretacao: { tentativaId: "t1", gestacaoId: null }, resultados: [{ valor: "NEGATIVO" }] },
    ]) },
  };
  return { mock, tx: mock as unknown as Prisma.TransactionClient };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(carregarDadosElegibilidadeTx).mockResolvedValue(base); });
describe("fontes em lote dos indicadores", () => {
  it("deduplica animais e carrega elegibilidade uma vez para toda a janela e corte", async () => {
    const { tx, mock } = fixture();
    const resultado = await carregarDadosIndicadoresTx(tx, filtros);
    expect(carregarDadosElegibilidadeTx).toHaveBeenCalledWith(tx, ["a", "b"], data("2026-03-01"));
    expect(mock.localizacaoAnimal.findMany).toHaveBeenCalledOnce(); expect(mock.exameAnimal.findMany).toHaveBeenCalledOnce();
    expect(mock.localizacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      propriedadeId: 1, desde: { lte: data("2026-03-01") }, OR: [{ ate: null }, { ate: { gt: data("2026-01-01") } }],
    } }));
    expect(resultado.identificacoes).toHaveLength(2);
    expect(resultado.evidencias).toEqual([
      expect.objectContaining({ id: "negativo", tentativaId: "t1", resultado: "NEGATIVO", fonte: "EXAME_INTERPRETADO" }),
      expect.objectContaining({ id: "semResultado", tentativaId: null, resultado: "INCONCLUSIVO" }),
    ]);
  });
  it("confere interpretação e resultado vigente no exame canônico sem presumir zero/negativo", async () => {
    const { tx, mock } = fixture(); await carregarDadosIndicadoresTx(tx, filtros);
    expect(mock.exameAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { animalId: { in: ["a", "b"] }, status: "VALIDO", data: { lte: data("2026-03-01") }, interpretacao: { isNot: null } },
      select: expect.objectContaining({ resultados: { where: { vigente: true, campo: "CONCLUSAO_GESTACIONAL" }, select: { valor: true } } }),
    }));
  });
  it("consulta múltiplos períodos sem voltar ao banco por animal ou dia", async () => {
    const { tx, mock } = fixture(); const r = await consultarIndicadoresReprodutivosTx(tx, filtros);
    expect(r.periodos).toHaveLength(2); expect(carregarDadosElegibilidadeTx).toHaveBeenCalledOnce();
    expect(mock.localizacaoAnimal.findMany).toHaveBeenCalledOnce(); expect(mock.exameAnimal.findMany).toHaveBeenCalledOnce();
  });
  it("recusa filtros inválidos antes de qualquer leitura", async () => {
    const { tx, mock } = fixture();
    await expect(consultarIndicadoresReprodutivosTx(tx, { ...filtros, corte: "2025-01-01" })).rejects.toThrow();
    expect(mock.localizacaoAnimal.findMany).not.toHaveBeenCalled();
  });
});
