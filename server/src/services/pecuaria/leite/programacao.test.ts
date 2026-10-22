import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
const mock = vi.hoisted(() => ({
  ultimo: vi.fn(),
  historico: vi.fn(),
  criar: vi.fn(),
  produto: vi.fn(),
  auditar: vi.fn(),
  estoque: vi.fn(),
  sitio: vi.fn(),
  travar: vi.fn(),
  idempotente: vi.fn(),
  transacao: vi.fn(),
}));
vi.mock("../../../db.js", () => ({
  prisma: { programacaoRetiradaLeite: { findMany: mock.historico } },
}));
vi.mock("./configuracoes.js", () => ({
  conferirSitioLeiteTx: mock.sitio,
  travarRotinaLeiteTx: mock.travar,
}));
vi.mock("./estoque.js", () => ({ consultarEstoqueLeite: mock.estoque }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: mock.transacao }));
vi.mock("../reproducao/operacoes.js", () => ({
  operacaoIdempotenteTx: mock.idempotente,
}));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<typeof import("../rebanho/regras.js")>()),
  auditar: mock.auditar,
  hojeFazendaDate: () => new Date("2026-10-19T00:00:00Z"),
}));
import {
  consultarProgramacaoRetirada,
  criarProgramacaoRetirada,
} from "./programacao.js";
const registro = {
  id: "p",
  propriedadeId: 1,
  vigenteDesde: new Date("2026-10-19T00:00:00Z"),
  tipo: "META_LITROS",
  diaSemana: null,
  diasSemana: [],
  produtoId: "10000000-0000-4000-8000-000000000001",
  metaLitros: new Prisma.Decimal(100),
  versao: 1,
  criadoEm: new Date("2026-10-19T10:00:00Z"),
  criadoPorId: 7,
};
const input = {
  chave: "20000000-0000-4000-8000-000000000001",
  propriedadeId: 1,
  vigenteDesde: "2026-10-20",
  versaoEsperada: 1,
  tipo: "DIARIA" as const,
};
const tx = {
  programacaoRetiradaLeite: { findFirst: mock.ultimo, create: mock.criar },
  produto: { findFirst: mock.produto },
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.ultimo.mockResolvedValue(registro);
  mock.historico.mockResolvedValue([registro]);
  mock.produto.mockResolvedValue({ id: registro.produtoId });
  mock.criar.mockResolvedValue({
    ...registro,
    tipo: "DIARIA",
    metaLitros: null,
    produtoId: null,
    versao: 2,
  });
  mock.transacao.mockImplementation((executar) => executar(tx));
  mock.idempotente.mockImplementation(
    (_tx, _dados, _usuario, _operacao, executar) => executar(),
  );
  mock.estoque.mockResolvedValue({
    confiavel: true,
    quantidadeLitros: "140",
    motivoNaoAferivel: null,
    comercial: { confiavel: true, quantidadeLitros: "40", motivoNaoAferivel: null },
  });
});
describe("programação versionada", () => {
  it("meta não usa 140 litros físicos quando parte ainda não tem declaração comercial", async () => {
    mock.estoque.mockResolvedValue({ confiavel: true, quantidadeLitros: "140", motivoNaoAferivel: null,
      comercial: { confiavel: false, quantidadeLitros: null, motivoNaoAferivel: "Há origem sem declaração" } });
    expect((await consultarProgramacaoRetirada(1, "2026-10-19", 7)).meta).toMatchObject({ estado: "NAO_AFERIVEL", saldoLitros: null });
  });
  it("produto posteriormente incompatível deixa meta não aferível e falha técnica continua erro", async () => {
    mock.estoque.mockRejectedValue(
      new RebanhoError("VALIDACAO", "Produto precisa de conciliação"),
    );
    expect(
      (await consultarProgramacaoRetirada(1, "2026-10-19", 7)).meta,
    ).toMatchObject({
      estado: "NAO_AFERIVEL",
      saldoLitros: null,
      motivo: "Produto precisa de conciliação",
    });
    mock.estoque.mockRejectedValue(new Error("Banco indisponível"));
    await expect(
      consultarProgramacaoRetirada(1, "2026-10-19", 7),
    ).rejects.toThrow("Banco indisponível");
  });

  it("lê somente o saldo comercial atual sem valores e não o consulta para histórico", async () => {
    const r = await consultarProgramacaoRetirada(1, "2026-10-19", 7);
    expect(mock.estoque).toHaveBeenCalledWith(
      registro.produtoId,
      { propriedadeId: 1, usuarioId: 7 },
      false,
    );
    expect(r.meta?.estado).toBe("ABAIXO_DA_META");
    mock.estoque.mockClear();
    const passado = await consultarProgramacaoRetirada(1, "2026-10-20", 7);
    expect(mock.estoque).not.toHaveBeenCalled();
    expect(passado.meta?.estado).toBe("NAO_AFERIVEL");
    expect(mock.criar).not.toHaveBeenCalled();
  });
  it("conserva autoria, versão e identidade do reenvio", async () => {
    await criarProgramacaoRetirada(input, 7);
    expect(mock.idempotente).toHaveBeenCalledWith(
      tx,
      input,
      7,
      "PROGRAMACAO_RETIRADA_LEITE",
      expect.any(Function),
    );
    expect(mock.criar).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propriedadeId: 1,
        tipo: "DIARIA",
        versao: 2,
        criadoPorId: 7,
        diaSemana: null,
        diasSemana: [],
        produtoId: null,
        metaLitros: null,
      }),
    });
    expect(mock.auditar).toHaveBeenCalled();
    expect(mock.estoque).not.toHaveBeenCalled();
  });
  it("recusa versão concorrente e vigência retroativa antes da escrita", async () => {
    await expect(
      criarProgramacaoRetirada({ ...input, versaoEsperada: 0 }, 7),
    ).rejects.toThrow("programação mudou");
    await expect(
      criarProgramacaoRetirada({ ...input, vigenteDesde: "2026-10-18" }, 7),
    ).rejects.toThrow("vigência");
    expect(mock.criar).not.toHaveBeenCalled();
  });
  it("recusa produto incompatível para meta", async () => {
    mock.produto.mockResolvedValue(null);
    await expect(
      criarProgramacaoRetirada(
        {
          ...input,
          tipo: "META_LITROS",
          produtoId: registro.produtoId,
          metaLitros: 100,
        },
        7,
      ),
    ).rejects.toThrow("produto ativo em litros");
    expect(mock.criar).not.toHaveBeenCalled();
  });
});
