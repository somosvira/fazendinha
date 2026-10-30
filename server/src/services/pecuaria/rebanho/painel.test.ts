import { beforeEach, describe, expect, it, vi } from "vitest";
import { buscarPainelGeral } from "./painel.js";
import { listar, whereSituacao } from "./animais.js";
import { prisma } from "../../../db.js";

vi.mock("../../../db.js", () => ({ prisma: {
  baixaAnimal: { findMany: vi.fn() }, animal: { findMany: vi.fn() }, categoriaAnimal: { findMany: vi.fn() },
} }));
vi.mock("./animais.js", () => ({ listar: vi.fn(), whereSituacao: vi.fn() }));
vi.mock("./regras.js", () => ({ hojeFazendaDate: () => new Date("2026-10-14T12:00:00Z") }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listar).mockResolvedValue({ itens: [], total: 16, painel: {
    totalAtivos: 16, femeasAtivas: 13, receptorasAtivas: 1,
    porCategoria: [{ categoria: { id: "f", nome: "Em crescimento" }, total: 4 }, { categoria: { id: "m", nome: "Em crescimento" }, total: 2 }, { categoria: null, total: 10 }],
    porSitio: [{ propriedadeId: 7, nome: "Sede", total: 16 }],
  } });
  vi.mocked(whereSituacao).mockReturnValue({});
  vi.mocked(prisma.animal.findMany).mockResolvedValue([]);
  vi.mocked(prisma.categoriaAnimal.findMany).mockResolvedValue([{ id: "f", sexo: "F" }, { id: "m", sexo: "M" }] as never);
  vi.mocked(prisma.baixaAnimal.findMany).mockResolvedValue([]);
});

describe("painel geral do rebanho", () => {
  it("expõe contagens reais de receptoras e sexo das categorias sem fundir nomes iguais", async () => {
    const painel = await buscarPainelGeral(7);
    expect(listar).toHaveBeenCalledWith({ situacao: "ATIVO", page: 1, pageSize: 1 }, 7);
    expect(painel).toMatchObject({ receptorasPct: 7.7, receptorasAtivas: 1, femeasAtivas: 13 });
    expect(painel.porCategoria).toEqual([
      { categoriaId: "f", categoria: "Em crescimento", sexo: "F", qtd: 4 },
      { categoriaId: "m", categoria: "Em crescimento", sexo: "M", qtd: 2 },
      { categoriaId: null, categoria: "Sem categoria", sexo: null, qtd: 10 },
    ]);
  });

  it("mantém o indicador de 30 dias independente da janela anual e preserva escopo/exclusões", async () => {
    vi.mocked(prisma.baixaAnimal.findMany).mockResolvedValueOnce([
      { tipo: "VENDA", data: new Date("2026-10-01T12:00:00Z"), motivo: { classe: "DESCARTE_VOLUNTARIO" } },
      { tipo: "MORTE", data: new Date("2026-01-01T12:00:00Z"), motivo: { classe: "MORTE" } },
    ] as never);
    const painel = await buscarPainelGeral(7, 365);
    expect(painel.baixas30d).toBe(1);
    expect(painel.baixasPorTipo).toEqual([{ tipo: "VENDA", qtd: 1 }, { tipo: "MORTE", qtd: 1 }]);
    expect(painel.periodoDias).toBe(365);
    expect(prisma.baixaAnimal.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({
      estornadaEm: null, tipo: { not: "CADASTRO_INDEVIDO" }, localizacaoFechada: { propriedadeId: 7 },
    }) }));
  });

  it("sem efetivo não consulta categorias e conserva zero, sem inventar denominador", async () => {
    vi.mocked(listar).mockResolvedValue({ itens: [], total: 0, painel: { totalAtivos: 0, femeasAtivas: 0, receptorasAtivas: 0, porCategoria: [], porSitio: [] } });
    expect(await buscarPainelGeral(null)).toMatchObject({ ativos: 0, receptorasPct: 0, receptorasAtivas: 0, femeasAtivas: 0, porCategoria: [] });
    expect(prisma.categoriaAnimal.findMany).not.toHaveBeenCalled();
  });
  it("conta a baixa não determinada sem somar à morte ou excluí-la do total", async () => {
    vi.mocked(prisma.baixaAnimal.findMany).mockResolvedValueOnce([
      { tipo: "NAO_DETERMINADO", data: new Date("2026-10-01T12:00:00Z"), motivo: null },
      { tipo: "MORTE", data: new Date("2026-10-01T12:00:00Z"), motivo: { classe: "MORTE" } },
    ] as never);
    const painel = await buscarPainelGeral(7, 365);
    expect(painel.baixas30d).toBe(2);
    expect(painel.baixasPorTipo).toEqual([{ tipo: "MORTE", qtd: 1 }, { tipo: "NAO_DETERMINADO", qtd: 1 }]);
    expect(painel.baixasPorClasse).toEqual([{ classe: "MORTE", qtd: 1 }, { classe: "SEM_MOTIVO", qtd: 1 }]);
  });

});
