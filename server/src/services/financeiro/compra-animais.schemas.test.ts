import { describe, expect, it } from "vitest";
import { operacaoSchema } from "./schemas.js";

const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const animal = (brinco: string) => ({ brinco, sexo: "F", dataNascimento: "2024-03-01", aptidao: "CORTE" });
const base = (itens: unknown[], extra: Record<string, unknown> = {}) => ({
  tipo: "COMPRA_ANIMAIS", data: "2026-11-01", descricao: "Compra de novilhas", parceiroId: UUID(1),
  itens, financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" }, ...extra,
});
const mensagens = (dados: unknown) => {
  const r = operacaoSchema.safeParse(dados);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("operação de compra de animais — forma dos itens", () => {
  it("aceita animais por kg com frete separado", () => {
    expect(mensagens(base([
      { descricao: "Novilha", quantidade: 312.5, unidade: "kg", valorTotal: 3750, animal: animal("A1") },
      { descricao: "Novilha", quantidade: 298, unidade: "kg", valorTotal: 3576, animal: animal("A2") },
      { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 300 },
    ]))).toEqual([]);
  });

  it("exige ao menos um animal e o fornecedor", () => {
    expect(mensagens(base([{ descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 300 }]))).toContain("Informe ao menos um animal na compra");
    expect(mensagens(base([{ descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animal: animal("A1") }], { parceiroId: undefined }))).toContain("Informe o parceiro desta operação");
  });

  it("recusa brinco repetido, unidades misturadas e cabeça com quantidade diferente de 1", () => {
    const erros = mensagens(base([
      { descricao: "N", quantidade: 2, unidade: "cab", valorTotal: 1, animal: animal("a1") },
      { descricao: "N", quantidade: 300, unidade: "kg", valorTotal: 1, animal: animal(" A1 ") },
    ]));
    expect(erros).toEqual(expect.arrayContaining([
      "Preço por cabeça usa quantidade 1", "Use a mesma unidade de preço para todos os animais", "Brinco  A1  repetido nesta compra",
    ].map((m) => m.replace("  A1  ", " A1 "))));
  });

  it("recusa produto ou estoque no item de animal e unidade fora de cab/kg/@", () => {
    const erros = mensagens(base([{ descricao: "N", quantidade: 1, unidade: "un", valorTotal: 1, estocavel: true, produtoId: UUID(2), animal: animal("A1") }]));
    expect(erros).toEqual(expect.arrayContaining(["Item de animal não movimenta estoque", "Use preço por cabeça (cab), kg ou arroba (@)"]));
  });

  it("animal existente só entra na correção da compra ou na devolução", () => {
    const existente = [{ descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animalId: UUID(3) }];
    expect(mensagens(base(existente))).toContain("Animal existente só entra na devolução ou na correção da compra");
    expect(mensagens(base(existente, { corrigeOperacaoId: UUID(4) }))).toEqual([]);
    expect(mensagens(base(existente, { tipo: "DEVOLUCAO" }))).toEqual([]);
    expect(mensagens(base([{ descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animal: animal("A1") }], { corrigeOperacaoId: UUID(4) })))
      .toContain("A correção mantém os animais da compra original");
  });

  it("devolução de animais não mistura outros itens nem repete o animal", () => {
    const erros = mensagens(base([
      { descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animalId: UUID(3) },
      { descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animalId: UUID(3) },
      { descricao: "Frete", quantidade: 1, unidade: "un", valorTotal: 1 },
    ], { tipo: "DEVOLUCAO" }));
    expect(erros).toEqual(expect.arrayContaining(["Devolva animais em uma operação própria, sem outros itens", "Animal repetido nesta operação"]));
  });

  it("limita a operação a 200 animais", () => {
    const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ descricao: "N", quantidade: 1, unidade: "cab", valorTotal: 1, animal: animal(`B${i}`) }));
    expect(mensagens(base(itens(200)))).toEqual([]);
    expect(mensagens(base(itens(201)))).toContain("Uma operação aceita até 200 animais; divida a compra");
  });
});
