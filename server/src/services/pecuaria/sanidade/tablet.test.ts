import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => {
  const criar = vi.fn();
  const atualizar = vi.fn();
  const aplicacao = vi.fn();
  const tx = {
    $executeRaw: vi.fn(),
    envioAplicacoesTablet: { findUnique: vi.fn(), findFirst: vi.fn(), create: criar, update: atualizar },
    produto: { findMany: vi.fn() },
    produtoCatalogo: { findMany: vi.fn() },
    doenca: { findFirst: vi.fn() },
    templateAplicacoesTablet: { findUnique: vi.fn(), upsert: vi.fn() },
    auditoriaPecuaria: { create: vi.fn() },
  };
  return { tx, criar, atualizar, aplicacao };
});
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (run: (tx: typeof fx.tx) => unknown) => run(fx.tx), timeoutTransacaoAnimais: () => 30_000 }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
vi.mock("../rebanho/regras.js", async importar => ({ ...(await importar<typeof import("../rebanho/regras.js")>()), travarAnimais: vi.fn() }));
vi.mock("./aplicacoes.js", () => ({ criarAplicacaoTx: fx.aplicacao, travarOrigensAplicacoesTx: vi.fn() }));
vi.mock("../reproducao/impactos.js", () => ({
  conferirImpactosTx: vi.fn(async () => ({ itens: [] })), aplicarImpactosTx: vi.fn(), previaImpactosTx: vi.fn(),
}));

import { decisaoSchema, enviarAplicacoes, envioSchema, revisarEnvio, salvarTemplate, templateSchema } from "./tablet.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const autor = { id: 1, nome: "Operadora" };
const revisor = { id: 2, nome: "Revisor" };
const input = {
  id: uuid(1), propriedadeId: 31, aplicadaEm: "2026-01-02T10:30:00-03:00",
  animalIds: [uuid(2), uuid(3)], itens: [{ produtoId: uuid(4), quantidade: 2 }, { produtoId: uuid(5), quantidade: 1 }],
};
const guardado = { ...input, autorId: autor.id, autorNome: autor.nome, revisadoEm: null, data: new Date("2026-01-02"),
  aplicadaEm: new Date(input.aplicadaEm), itens: input.itens.map(i => ({ ...i, nome: i.produtoId, unidade: "UN" })) };
const aprovacao = decisaoSchema.parse({ propriedadeId: input.propriedadeId, conferencia: input.itens.map(i => ({
  produtoId: i.produtoId, partidaId: null, cienciaValidadeDesconhecida: false, carenciaLeiteHoras: 12, carenciaCarneHoras: null,
})) });

beforeEach(() => {
  vi.clearAllMocks();
  fx.tx.envioAplicacoesTablet.findUnique.mockResolvedValue(null);
  fx.tx.envioAplicacoesTablet.findFirst.mockResolvedValue(guardado);
  fx.tx.produto.findMany.mockResolvedValue(input.itens.map(i => ({ id: i.produtoId, nome: i.produtoId, unidade: "UN" })));
  fx.tx.produtoCatalogo.findMany.mockResolvedValue([]);
  fx.aplicacao.mockImplementation(async (_tx, i) => ({ id: i.animalId + i.produtoId }));
});

describe("aplicações no tablet", () => {
  it("aceita frações de até três casas e rejeita animais ou produtos repetidos", () => {
    expect(envioSchema.safeParse({ ...input, itens: [{ produtoId: uuid(4), quantidade: 1.5 }] }).success).toBe(true);
    expect(envioSchema.safeParse({ ...input, animalIds: [uuid(2), uuid(2)] }).success).toBe(false);
    expect(envioSchema.safeParse({ ...input, itens: [input.itens[0], input.itens[0]] }).success).toBe(false);
  });

  it("guarda o envio e autoria sem chamar a criação sanitária ou consumo", async () => {
    await enviarAplicacoes(envioSchema.parse(input), autor);
    expect(fx.criar).toHaveBeenCalledWith({ data: expect.objectContaining({ autorId: autor.id, autorNome: autor.nome, animalIds: input.animalIds, itens: guardado.itens }), select: { id: true } });
    expect(fx.aplicacao).not.toHaveBeenCalled();
  });

  it("só na aprovação aplica a quantidade informada a cada combinação de vaca e produto", async () => {
    await revisarEnvio(input.id, aprovacao, revisor);
    expect(fx.aplicacao).toHaveBeenCalledTimes(4);
    expect(fx.aplicacao).toHaveBeenCalledWith(fx.tx, expect.objectContaining({
      animalId: uuid(2), produtoId: uuid(4), origemInsumo: "BAIXA_ESTOQUE", dose: "2", unidadeDose: "UN",
      carenciaLeiteHoras: 12, responsavel: autor.nome,
    }), revisor.id, expect.objectContaining({ adiarEfeitos: true }));
    expect(fx.atualizar).toHaveBeenCalledWith({ where: { id: input.id }, data: expect.objectContaining({ revisorId: revisor.id, aplicacaoIds: expect.arrayContaining([uuid(2) + uuid(4), uuid(3) + uuid(5)]) }) });
  });

  it("não registra aprovação quando um item falha", async () => {
    fx.aplicacao.mockRejectedValueOnce(new Error("Saldo insuficiente"));
    await expect(revisarEnvio(input.id, aprovacao, revisor)).rejects.toThrow("Saldo insuficiente");
    expect(fx.atualizar).not.toHaveBeenCalled();
  });

  it("devolve com motivo sem criar aplicações", async () => {
    await revisarEnvio(input.id, { propriedadeId: input.propriedadeId, motivo: "Confira as quantidades" }, revisor);
    expect(fx.atualizar).toHaveBeenCalledWith({ where: { id: input.id }, data: expect.objectContaining({ devolucao: "Confira as quantidades", aplicacaoIds: [] }) });
    expect(fx.aplicacao).not.toHaveBeenCalled();
  });
});


describe("medicamentos do catálogo completo", () => {
  const referencia = uuid(90);
  const envioCatalogo = { ...input, itens: [{ produtoId: referencia, quantidade: 10 }] };
  it("envia referência não adotada com unidade e apresentação, sem criar consumo", async () => {
    fx.tx.produto.findMany.mockResolvedValue([]);
    fx.tx.produtoCatalogo.findMany.mockResolvedValue([{ id: referencia, nome: "Medicamento", apresentacao: "Frasco 100 mL", unidadeSugerida: "ML" }]);
    await enviarAplicacoes(envioSchema.parse(envioCatalogo), autor);
    expect(fx.criar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ itens: [{ produtoId: referencia, produtoCatalogoId: referencia, quantidade: 10, nome: "Medicamento (Frasco 100 mL)", unidade: "ML" }] }) }));
    expect(fx.aplicacao).not.toHaveBeenCalled();
  });
  it("impede aprovação sem produto adotado e mantém envio pendente", async () => {
    fx.tx.envioAplicacoesTablet.findFirst.mockResolvedValue({ ...guardado, itens: [{ produtoId: referencia, produtoCatalogoId: referencia, quantidade: 10, nome: "Medicamento", unidade: "ML" }] });
    fx.tx.produto.findMany.mockResolvedValue([]);
    await expect(revisarEnvio(input.id, aprovacao, revisor)).rejects.toThrow("Registre uma entrada de estoque");
    expect(fx.aplicacao).not.toHaveBeenCalled();
    expect(fx.atualizar).not.toHaveBeenCalled();
  });
  it("resolve a referência ao produto adotado apenas na aprovação", async () => {
    fx.tx.envioAplicacoesTablet.findFirst.mockResolvedValue({ ...guardado, animalIds: [uuid(2)], itens: [{ produtoId: referencia, produtoCatalogoId: referencia, quantidade: 10, nome: "Medicamento", unidade: "ML" }] });
    fx.tx.produto.findMany.mockResolvedValue([{ id: uuid(91), produtoCatalogoId: referencia, unidade: "ML" }]);
    await revisarEnvio(input.id, { ...aprovacao, conferencia: [{ ...aprovacao.conferencia![0], produtoId: referencia }] }, revisor);
    expect(fx.aplicacao).toHaveBeenCalledWith(fx.tx, expect.objectContaining({ produtoId: uuid(91), dose: "10", unidadeDose: "ML" }), revisor.id, expect.anything());
  });
  it("rejeita a mesma referência selecionada também pelo produto local", async () => {
    fx.tx.produto.findMany.mockResolvedValue([{ id: uuid(91), produtoCatalogoId: referencia, nome: "Medicamento", unidade: "ML" }]);
    fx.tx.produtoCatalogo.findMany.mockResolvedValue([{ id: referencia, nome: "Medicamento", unidadeSugerida: "ML" }]);
    await expect(enviarAplicacoes(envioSchema.parse({ ...input, itens: [{ produtoId: referencia, quantidade: 10 }, { produtoId: uuid(91), quantidade: 10 }] }), autor)).rejects.toThrow("produtos distintos");
  });
});


describe("quantidades configuradas nos templates", () => {
  it("rejeita quantidade inválida ou de medicamento fora da seleção", () => {
    const base = { propriedadeId: 31, doencaId: uuid(30), produtoIds: [uuid(4)] };
    expect(templateSchema.safeParse({ ...base, quantidades: { [uuid(5)]: { quantidade: 2, unidade: "UN" } } }).success).toBe(false);
    for (const quantidade of [0, -1, 1.0001]) expect(templateSchema.safeParse({ ...base, quantidades: { [uuid(4)]: { quantidade, unidade: "ML" } } }).success).toBe(false);
  });
  it("salva unidade e quantidade com autoria e auditoria, sem criar aplicação", async () => {
    fx.tx.doenca.findFirst.mockResolvedValue({ id: uuid(30) });
    fx.tx.templateAplicacoesTablet.findUnique.mockResolvedValue(null);
    fx.tx.templateAplicacoesTablet.upsert.mockImplementation(async ({ create }) => create);
    const quantidades = { [uuid(4)]: { quantidade: 2, unidade: "UN" as const } };
    await salvarTemplate({ propriedadeId: 31, doencaId: uuid(30), produtoIds: [uuid(4), uuid(5)], quantidades }, autor.id);
    expect(fx.tx.templateAplicacoesTablet.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ quantidades, autorId: autor.id }) }));
    expect(fx.tx.auditoriaPecuaria.create).toHaveBeenCalled();
    expect(fx.aplicacao).not.toHaveBeenCalled();
  });
  it("recusa unidade divergente e fração de unidade indivisível", async () => {
    fx.tx.doenca.findFirst.mockResolvedValue({ id: uuid(30) });
    fx.tx.templateAplicacoesTablet.findUnique.mockResolvedValue(null);
    const base = { propriedadeId: 31, doencaId: uuid(30), produtoIds: [uuid(4), uuid(5)] };
    await expect(salvarTemplate({ ...base, quantidades: { [uuid(4)]: { quantidade: 2, unidade: "ML" } } }, autor.id)).rejects.toThrow("unidade");
    await expect(salvarTemplate({ ...base, quantidades: { [uuid(4)]: { quantidade: 1.5, unidade: "UN" } } }, autor.id)).rejects.toThrow("inteira");
  });
});
