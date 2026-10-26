import { describe, expect, it } from "vitest";
import { conferirMudancaNaturezaLeite, planejarBaixaLeite, selecionarOrigensLeite } from "./leite.calc.js";
import { Prisma } from "@prisma/client";
import { classificarEntradaLeiteTx, planejarBaixaLeiteTx } from "./leite.js";
import { vi } from "vitest";

vi.mock("../../db.js", () => ({ prisma: {} }));

const bases = [
  { entradaId: "comercial", natureza: "COMERCIAL", data: "2026-10-19", ordem: 1, quantidade: "50", valor: null },
  { entradaId: "colostro", natureza: "COLOSTRO", data: "2026-10-19", ordem: 2, quantidade: "10", valor: null },
];
describe("classificação conservadora da entrada inteira", () => {
  it("50 L comerciais e 10 L de colostro não autorizam vender 55 L", () => {
    const elegiveis = selecionarOrigensLeite(bases, "VENDA");
    expect(elegiveis.map(b => b.entradaId)).toEqual(["comercial"]);
    expect(() => planejarBaixaLeite({ quantidade: "55", bases: elegiveis })).toThrow(/insuficiente/);
    expect(bases[1].quantidade).toBe("10");
  });

  it("declaração ausente não autoriza venda, mas consumo mantém as origens", () => {
    const desconhecida = [{ ...bases[0], natureza: "NAO_INFORMADA" }];
    expect(selecionarOrigensLeite(desconhecida, "VENDA")).toEqual([]);
    expect(selecionarOrigensLeite(desconhecida, "CONSUMO")).toEqual(desconhecida);
  });

  it("classificação restrita não pode ser desbloqueada nem rebatizada", () => {
    expect(() => conferirMudancaNaturezaLeite("COLOSTRO", "COMERCIAL")).toThrow(/restrita/);
    expect(() => conferirMudancaNaturezaLeite("NAO_COMERCIAL", "COLOSTRO")).toThrow(/restrita/);
    expect(conferirMudancaNaturezaLeite("COLOSTRO", "COLOSTRO")).toBe(false);
    expect(conferirMudancaNaturezaLeite("NAO_INFORMADA", "COMERCIAL")).toBe(true);
    expect(conferirMudancaNaturezaLeite("COMERCIAL", "NAO_COMERCIAL")).toBe(true);
  });

  it("planejamento real recusa 55 L antes de gravar saída, preservando os 10 L restritos", async () => {
    const fontes = bases.map((b, i) => ({ id: b.entradaId, sessao: { ordem: i + 1, nome: i ? "Tarde" : "Manhã", horario: null },
      vinculosMedicoes: [{ medicao: { participante: { animalId: `animal-${i}` } } }],
      movimento: { quantidade: new Prisma.Decimal(b.quantidade), data: new Date(b.data), seq: i + 1 }, apuracoes: [], alocacoes: [],
      classificacoes: [{ id: `classe-${i}`, natureza: b.natureza, versao: 2 }] }));
    const tx = { aplicacaoProduto: { findMany: vi.fn(async () => []) }, entradaProducaoLeite: { findMany: vi.fn(async () => fontes) }, movimentoEstoque: {
      findMany: vi.fn(async () => fontes.map(f => ({ tipo: "ENTRADA", quantidade: f.movimento.quantidade }))), create: vi.fn(),
    }, alocacaoLeiteEstoque: { createMany: vi.fn() } };
    const banco = tx as unknown as Prisma.TransactionClient;
    await expect(planejarBaixaLeiteTx(banco, { produtoId: "leite", propriedadeId: 7, data: new Date("2026-10-19"), quantidade: 55, finalidade: "VENDA" }))
      .rejects.toMatchObject({ code: "SALDO_INSUFICIENTE" });
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.alocacaoLeiteEstoque.createMany).not.toHaveBeenCalled();
    const permitido = await planejarBaixaLeiteTx(banco, { produtoId: "leite", propriedadeId: 7, data: new Date("2026-10-19"), quantidade: 50, finalidade: "VENDA" });
    expect(permitido.parcelas.map(p => [p.entradaId, p.classificacaoId, p.quantidade.toString()])).toEqual([["comercial", "classe-0", "50"]]);
    expect(fontes[1].movimento.quantidade.toString()).toBe("10");
  });

  it("declaração restritiva já vigente não duplica e nunca permite desbloqueio", async () => {
    const tx = { $executeRaw: vi.fn(), entradaProducaoLeite: { findFirst: vi.fn(async () => ({ movimento: { produtoId: "leite" } })) },
      classificacaoEntradaLeite: { findFirst: vi.fn(async () => ({ id: "restrita", natureza: "COLOSTRO", versao: 2 })), create: vi.fn() } };
    const banco = tx as unknown as Prisma.TransactionClient;
    const ctx = { propriedadeId: 7, usuarioId: 9 };
    expect(await classificarEntradaLeiteTx(banco, { entradaId: "origem", natureza: "COLOSTRO", motivo: "Declaração conservada" }, ctx)).toMatchObject({ id: "restrita" });
    await expect(classificarEntradaLeiteTx(banco, { entradaId: "origem", natureza: "COMERCIAL", motivo: "Tentar liberar sobra" }, ctx)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(tx.classificacaoEntradaLeite.create).not.toHaveBeenCalled();
  });

  it("declarar colostro cria outra versão da origem inteira sem alterar litros nem a declaração anterior", async () => {
    const anterior = { id: "declarada", natureza: "COMERCIAL", versao: 2 };
    const tx = { $executeRaw: vi.fn(), entradaProducaoLeite: { findFirst: vi.fn(async () => ({ movimento: { produtoId: "leite" } })) },
      classificacaoEntradaLeite: { findFirst: vi.fn(async () => anterior), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "restrita", ...data })) },
      periodoFinanceiro: { findUnique: vi.fn(async () => null) }, auditoriaFinanceira: { create: vi.fn() }, movimentoEstoque: { create: vi.fn(), update: vi.fn() } };
    await classificarEntradaLeiteTx(tx as unknown as Prisma.TransactionClient, { entradaId: "origem", natureza: "COLOSTRO", motivo: "Entrada inteira contém colostro", versaoEsperada: 2 }, { propriedadeId: 7, usuarioId: 9 });
    expect(tx.classificacaoEntradaLeite.create).toHaveBeenCalledWith({ data: { entradaId: "origem", versao: 3, natureza: "COLOSTRO", motivo: "Entrada inteira contém colostro", criadoPorId: 9 } });
    expect(anterior.natureza).toBe("COMERCIAL");
    expect(tx.movimentoEstoque.create).not.toHaveBeenCalled();
    expect(tx.movimentoEstoque.update).not.toHaveBeenCalled();
  });
});
