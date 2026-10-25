import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  consultar: vi.fn(),
  criar: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
}));
vi.mock("../../services/propriedade.js", async (original) => ({
  ...(await original<typeof import("../../services/propriedade.js")>()),
  resolverEscopoLeitura: mock.leitura,
  resolverEscopoEscrita: mock.escrita,
}));
vi.mock("../../services/pecuaria/leite/programacao.js", () => ({
  consultarProgramacaoRetirada: mock.consultar,
  criarProgramacaoRetirada: mock.criar,
}));
import { leiteProgramacaoRouter } from "./leite-programacao.js";
const app = (
  opcoes: { autenticado?: boolean; lancar?: boolean; pecuaria?: boolean } = {},
) =>
  new Hono()
    .use("*", async (c, next) => {
      if (opcoes.autenticado !== false)
        c.set(
          "usuario" as never,
          {
            id: 7,
            dono: false,
            areas: opcoes.pecuaria === false ? ["financeiro"] : ["pecuaria"],
            flags: opcoes.lancar ? ["lancar"] : [],
            abas: [],
          } as never,
        );
      await next();
    })
    .route("/programacao", leiteProgramacaoRouter);
const payload = {
  chave: "10000000-0000-4000-8000-000000000001",
  propriedadeId: 2,
  vigenteDesde: "2026-10-20",
  versaoEsperada: 1,
  tipo: "DIARIA",
};
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mock.leitura.mockResolvedValue(2);
  mock.escrita.mockResolvedValue(2);
  mock.consultar.mockResolvedValue({ vigente: null });
  mock.criar.mockResolvedValue({ versao: 2 });
});
describe("rota de programação", () => {
  it("exige sessão, área e lançamento no servidor", async () => {
    expect(
      (
        await app({ autenticado: false }).request(
          "/programacao?data=2026-10-19",
        )
      ).status,
    ).toBe(401);
    expect(
      (await app({ pecuaria: false }).request("/programacao?data=2026-10-19"))
        .status,
    ).toBe(403);
    expect((await app().request("/programacao", post(payload))).status).toBe(
      403,
    );
    expect(mock.criar).not.toHaveBeenCalled();
  });
  it("resolve escopo e valida calendário/data sem escrita implícita", async () => {
    expect((await app().request("/programacao?data=2026-10-19")).status).toBe(
      200,
    );
    expect(mock.consultar).toHaveBeenCalledWith(2, "2026-10-19", 7);
    mock.leitura.mockResolvedValue(null);
    expect((await app().request("/programacao?data=2026-10-19")).status).toBe(
      422,
    );
    expect((await app().request("/programacao?data=2026-02-30")).status).toBe(
      422,
    );
    expect(mock.criar).not.toHaveBeenCalled();
  });
  it("encaminha autoria, versão, chave e sítio resolvido e recusa combinação", async () => {
    expect(
      (await app({ lancar: true }).request("/programacao", post(payload)))
        .status,
    ).toBe(201);
    expect(mock.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mock.criar).toHaveBeenCalledWith(payload, 7);
    expect(
      (
        await app({ lancar: true }).request(
          "/programacao",
          post({ ...payload, metaLitros: 20 }),
        )
      ).status,
    ).toBe(422);
  });
});
