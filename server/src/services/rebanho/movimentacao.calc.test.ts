import { describe, expect, it } from "vitest";
import { diffMovimentacoes, type EstadoAlocacao, type EdicaoAlocacao } from "./movimentacao.calc.js";

const atual: EstadoAlocacao = { grupoId: 1, grupoNome: "Alta", setor: "Curral A" };

describe("diffMovimentacoes", () => {
  it("sem mudança de grupo nem setor → nenhuma movimentação", () => {
    const edicao: EdicaoAlocacao = { grupoId: 1, setor: "Curral A", grupoNome: "Alta" };
    expect(diffMovimentacoes(atual, edicao)).toEqual([]);
  });

  it("troca de grupo → uma movimentação GRUPO com origem/destino corretos", () => {
    const edicao: EdicaoAlocacao = { grupoId: 2, setor: "Curral A", grupoNome: "Baixa" };
    const movs = diffMovimentacoes(atual, edicao);
    expect(movs).toEqual([
      { tipo: "GRUPO", origem: "Alta", destino: "Baixa", grupoOrigemId: 1, grupoDestinoId: 2 },
    ]);
  });

  it("troca de setor → uma movimentação SETOR com origem/destino", () => {
    const edicao: EdicaoAlocacao = { grupoId: 1, setor: "Curral B", grupoNome: "Alta" };
    expect(diffMovimentacoes(atual, edicao)).toEqual([
      { tipo: "SETOR", origem: "Curral A", destino: "Curral B" },
    ]);
  });

  it("troca de grupo E setor → duas movimentações (grupo primeiro)", () => {
    const edicao: EdicaoAlocacao = { grupoId: 2, setor: "Curral B", grupoNome: "Baixa" };
    const movs = diffMovimentacoes(atual, edicao);
    expect(movs.map((m) => m.tipo)).toEqual(["GRUPO", "SETOR"]);
  });

  it("primeira alocação (atual sem grupo/setor) → origem null", () => {
    const semAlocacao: EstadoAlocacao = { grupoId: null, grupoNome: null, setor: null };
    const edicao: EdicaoAlocacao = { grupoId: 3, setor: "Curral C", grupoNome: "Novilhas" };
    expect(diffMovimentacoes(semAlocacao, edicao)).toEqual([
      { tipo: "GRUPO", origem: null, destino: "Novilhas", grupoOrigemId: null, grupoDestinoId: 3 },
      { tipo: "SETOR", origem: null, destino: "Curral C" },
    ]);
  });

  it("campo ausente na edição (undefined) → não conta como mudança", () => {
    // grupoId undefined = 'não mexe no grupo'; só o setor muda.
    const edicao: EdicaoAlocacao = { setor: "Curral B" };
    expect(diffMovimentacoes(atual, edicao)).toEqual([
      { tipo: "SETOR", origem: "Curral A", destino: "Curral B" },
    ]);
  });

  it("sair de um grupo para nenhum (grupoId null explícito) → movimentação GRUPO destino vazio", () => {
    const edicao: EdicaoAlocacao = { grupoId: null, grupoNome: null };
    expect(diffMovimentacoes(atual, edicao)).toEqual([
      { tipo: "GRUPO", origem: "Alta", destino: "—", grupoOrigemId: 1, grupoDestinoId: null },
    ]);
  });

  it("setor esvaziado (null explícito) → movimentação SETOR destino vazio", () => {
    const edicao: EdicaoAlocacao = { setor: null };
    expect(diffMovimentacoes(atual, edicao)).toEqual([
      { tipo: "SETOR", origem: "Curral A", destino: "—" },
    ]);
  });
});
