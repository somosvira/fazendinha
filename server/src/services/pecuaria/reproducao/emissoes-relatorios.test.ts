import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
vi.mock("../../../db.js", () => ({ prisma: { snapshotRelatorioReprodutivo: { findFirst: vi.fn(), findMany: vi.fn() } } }));
vi.mock("./relatorio-partos.js", async importOriginal => {
  const original = await importOriginal<typeof import("./relatorio-partos.js")>();
  return { ...original, emitirRelatorioPartosTx: vi.fn() };
});
vi.mock("./indicadores.js", () => ({ consultarIndicadoresReprodutivosTx: vi.fn() }));
import { prisma } from "../../../db.js";
import { emitirRelatorioPartosTx } from "./relatorio-partos.js";
import { consultarIndicadoresReprodutivosTx } from "./indicadores.js";
import { criarEmissaoReprodutivaSchema, criarEmissaoReprodutivaTx, listarEmissoesReprodutivas, obterEmissaoReprodutiva } from "./emissoes-relatorios.js";

const id = "11111111-1111-4111-8111-111111111111";
const entrada = () => criarEmissaoReprodutivaSchema.parse({ chave: id, propriedadeId: 1, tipo: "PARTOS", filtros: { inicio: "2026-01-01", fim: "2026-01-21" } });
function fixture() {
  const requisicoes = new Map<string, object>();
  const mock = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    requisicaoPecuaria: { findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => requisicoes.get(where.chave) ?? null),
      create: vi.fn(async ({ data }: { data: { chave: string } }) => { requisicoes.set(data.chave, data); return data; }) },
    snapshotRelatorioReprodutivo: { create: vi.fn(async ({ data }: { data: object }) => ({ id, ...data, criadoEm: new Date("2026-03-01T12:00:00Z") })) },
    auditoriaPecuaria: { create: vi.fn().mockResolvedValue({}) },
  };
  return { mock, tx: mock as unknown as Prisma.TransactionClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(emitirRelatorioPartosTx).mockResolvedValue({ versao: 1, emitidoEm: "2026-03-01T00:00:00Z", propriedadeId: 1, periodo: { inicio: "2026-01-01", fim: "2026-01-21" }, totalPartos: 0, partos: [] });
});
describe("emissão imutável de relatórios reprodutivos", () => {
  it("grava snapshot, autoria e reenvio na mesma transação", async () => {
    const { tx, mock } = fixture(); const r = await criarEmissaoReprodutivaTx(tx, entrada(), 7);
    expect(r).toMatchObject({ id, tipo: "PARTOS", propriedadeId: 1, criadoPorId: 7, criadoEm: "2026-03-01T12:00:00.000Z", snapshot: { versao: 1, partos: [] } });
    expect(emitirRelatorioPartosTx).toHaveBeenCalledWith(tx, { propriedadeId: 1, inicio: "2026-01-01", fim: "2026-01-21" });
    expect(mock.requisicaoPecuaria.create).toHaveBeenCalledOnce(); expect(mock.auditoriaPecuaria.create).toHaveBeenCalledOnce();
  });
  it("reenvio conserva a primeira emissão mesmo que os fatos atuais mudem", async () => {
    const { tx, mock } = fixture(); const antes = await criarEmissaoReprodutivaTx(tx, entrada(), 7);
    vi.mocked(emitirRelatorioPartosTx).mockRejectedValue(new Error("não deveria reler fatos"));
    expect(await criarEmissaoReprodutivaTx(tx, entrada(), 7)).toEqual(antes);
    expect(emitirRelatorioPartosTx).toHaveBeenCalledOnce(); expect(mock.snapshotRelatorioReprodutivo.create).toHaveBeenCalledOnce();
  });
  it("a chave não pode mudar período, sítio, autor ou tipo", async () => {
    const { tx, mock } = fixture(); await criarEmissaoReprodutivaTx(tx, entrada(), 7);
    for (const alteracao of [{ propriedadeId: 2 }, { filtros: { inicio: "2026-01-02", fim: "2026-01-21" } }]) {
      await expect(criarEmissaoReprodutivaTx(tx, criarEmissaoReprodutivaSchema.parse({ ...entrada(), ...alteracao }), 7)).rejects.toThrow("Chave de reenvio usada com outros dados");
    }
    await expect(criarEmissaoReprodutivaTx(tx, entrada(), 8)).rejects.toThrow("Chave de reenvio usada com outros dados");
    await expect(criarEmissaoReprodutivaTx(tx, criarEmissaoReprodutivaSchema.parse({ ...entrada(), tipo: "INDICADORES", filtros: { ...entrada().filtros, corte: "2026-03-01" } }), 7)).rejects.toThrow("Chave de reenvio usada com outros dados");
    expect(mock.snapshotRelatorioReprodutivo.create).toHaveBeenCalledOnce();
  });
  it("congela indicadores e parâmetros explícitos usando o mesmo escopo da emissão", async () => {
    const { tx, mock } = fixture();
    vi.mocked(consultarIndicadoresReprodutivosTx).mockResolvedValue({ versao: 1, versaoMetodologia: "FAZENDINHA_IDEAGRI_IILB_V1" } as Awaited<ReturnType<typeof consultarIndicadoresReprodutivosTx>>);
    const input = criarEmissaoReprodutivaSchema.parse({ chave: id, propriedadeId: 1, tipo: "INDICADORES", filtros: { inicio: "2026-01-01", fim: "2026-01-21", corte: "2026-03-01", concepcaoEstimada: 35 } });
    await criarEmissaoReprodutivaTx(tx, input, 7);
    expect(consultarIndicadoresReprodutivosTx).toHaveBeenCalledWith(tx, { ...input.filtros, propriedadeId: 1 });
    expect(mock.snapshotRelatorioReprodutivo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ filtros: { ...input.filtros, concepcaoEstimada: 35, deslocamentoTeDias: 7 }, tipo: "INDICADORES" }) });
  });
  it("reimpressão consulta somente a emissão armazenada no sítio autorizado", async () => {
    vi.mocked(prisma.snapshotRelatorioReprodutivo.findFirst).mockResolvedValue(null);
    await expect(obterEmissaoReprodutiva(id, 2)).rejects.toThrow("neste sítio");
    expect(prisma.snapshotRelatorioReprodutivo.findFirst).toHaveBeenCalledWith({ where: { id, propriedadeId: 2 } });
    expect(emitirRelatorioPartosTx).not.toHaveBeenCalled(); expect(consultarIndicadoresReprodutivosTx).not.toHaveBeenCalled();
  });
  it("lista somente metadados do tipo e sítio, sem recalcular ou truncar emissões", async () => {
    vi.mocked(prisma.snapshotRelatorioReprodutivo.findMany).mockResolvedValue([]);
    expect(await listarEmissoesReprodutivas("PARTOS", 1)).toEqual([]);
    expect(prisma.snapshotRelatorioReprodutivo.findMany).toHaveBeenCalledWith({ where: { tipo: "PARTOS", propriedadeId: 1 }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      select: { id: true, tipo: true, versao: true, filtros: true, criadoEm: true, criadoPorId: true } });
  });
});
