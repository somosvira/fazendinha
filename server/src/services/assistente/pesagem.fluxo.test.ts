import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  animais: vi.fn(),
  conferir: vi.fn(),
  confirmar: vi.fn(),
  registrar: vi.fn(),
  tx: vi.fn(),
  anterior: vi.fn(),
}));
vi.mock("../../env.js", () => ({ env: { JWT_SECRET: "segredo-de-teste" } }));
vi.mock("../../db.js", () => ({
  prisma: { animal: { findMany: m.animais }, pesagem: { findFirst: m.anterior }, $transaction: m.tx },
}));
vi.mock("../pecuaria/fatos.js", () => ({ conferirAnimalNoFato: m.conferir }));
vi.mock("../pecuaria/idempotencia.js", () => ({ confirmarFato: m.confirmar }));
vi.mock("../pecuaria/rebanho/animais.js", () => ({
  registrarPesagemTx: m.registrar,
}));
import {
  ferramentaPesagem,
  confirmarPesagem,
  assinarProposta,
} from "./pesagem.js";
import type { ContextoAssistente } from "./tipos.js";
const ctx: ContextoAssistente = {
  modo: "editar",
  usuario: {
    id: 4,
    dono: false,
    areas: ["pecuaria"],
    flags: ["lancar"],
    abas: [],
    nome: "Teste",
    email: "teste@local.test",
    papel: "gerente",
    status: "ATIVO",
  },
  propriedadeId: 7,
  nomeEscopo: "Sítio",
  agora: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.tx.mockImplementation((f: (t: object) => unknown) => f({}));
  m.animais.mockResolvedValue([
    { id: "animal", brinco: "1058", nome: "Estrela" },
  ]);
  m.anterior.mockResolvedValue({ data: new Date("2026-09-01T00:00:00Z"), pesoKg: 468 });
});
it("não publica ferramenta no modo consultar nem a quem não pode lançar", () => {
  expect(ferramentaPesagem.permitida({ ...ctx, modo: "consultar" })).toBe(
    false,
  );
  expect(
    ferramentaPesagem.permitida({
      ...ctx,
      usuario: { ...ctx.usuario, flags: [] },
    }),
  ).toBe(false);
  expect(ferramentaPesagem.permitida(ctx)).toBe(true);
});
it("exige sítio e todos os campos, sem gravar ou consultar dados antes disso", async () => {
  expect(
    (
      await ferramentaPesagem.executar(
        { brinco: "1058", data: null, pesoKg: 450 },
        ctx,
      )
    ).modo,
  ).toBe("esclarecimento");
  expect(
    (
      await ferramentaPesagem.executar(
        { brinco: "1058", data: "2026-01-01", pesoKg: 450 },
        { ...ctx, propriedadeId: null },
      )
    ).modo,
  ).toBe("esclarecimento");
  expect(m.animais).not.toHaveBeenCalled();
  expect(m.confirmar).not.toHaveBeenCalled();
});
it("identifica no sítio e data, valida o fato e apenas propõe; não grava", async () => {
  const r = await ferramentaPesagem.executar(
    { brinco: "1058", data: "2026-01-01", pesoKg: 450 },
    ctx,
  );
  expect(r.modo).toBe("proposta");
  expect(r.proposta?.animal).toBe("1058 · Estrela");
  expect(r.proposta?.anterior).toEqual({ data: "2026-09-01", pesoKg: 468 });
  expect(m.animais.mock.calls[0][0].where.localizacoes.some.propriedadeId).toBe(
    7,
  );
  expect(m.conferir).toHaveBeenCalledWith(
    {},
    "animal",
    7,
    new Date("2026-01-01T00:00:00Z"),
  );
  expect(m.registrar).not.toHaveBeenCalled();
  expect(m.confirmar).not.toHaveBeenCalled();
});
it("ambiguidade ou ausência não seleciona um animal arbitrário", async () => {
  m.animais
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
  for (let i = 0; i < 2; i++)
    expect(
      (
        await ferramentaPesagem.executar(
          { brinco: "1058", data: "2026-01-01", pesoKg: 450 },
          ctx,
        )
      ).modo,
    ).toBe("esclarecimento");
  expect(m.conferir).not.toHaveBeenCalled();
});
it("revalida o gate antes de confirmar e preserva chave para reenvio idempotente", async () => {
  const token = assinarProposta({
    chave: "chave-estavel",
    usuarioId: 4,
    propriedadeId: 7,
    animalId: "animal",
    data: "2026-01-01",
    pesoKg: 450,
    expiraEm: Date.now() + 60000,
  });
  await expect(
    confirmarPesagem(token, { ...ctx, modo: "consultar" }),
  ).rejects.toThrow();
  await expect(
    confirmarPesagem(token, { ...ctx, usuario: { ...ctx.usuario, flags: [] } }),
  ).rejects.toThrow();
  expect(m.confirmar).not.toHaveBeenCalled();
  m.confirmar.mockResolvedValue({ id: "peso", pesoKg: 450 });
  await confirmarPesagem(token, ctx);
  await confirmarPesagem(token, ctx);
  expect(m.confirmar.mock.calls.map((c) => c[0].chave)).toEqual([
    "chave-estavel",
    "chave-estavel",
  ]);
  const criar = m.confirmar.mock.calls[0][3];
  m.registrar.mockResolvedValue({ id: "peso" });
  await criar({}, m.confirmar.mock.calls[0][0], 4);
  expect(m.conferir).toHaveBeenCalled();
  expect(m.registrar).toHaveBeenCalled();
});
