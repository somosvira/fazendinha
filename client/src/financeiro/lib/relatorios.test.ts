import { describe, expect, it } from "vitest";
import { alternar, normalizarSnapshot, configuracaoPadrao, erroPeriodo, mesclarRascunho, periodoMes, podeGerar, resumoConfiguracao, secoesDoRelatorio } from "./relatorios";
import { SEM_VINCULO } from "../../lib/ids";
import { uid } from "../../lib/uid.fixture";

const hoje = new Date(2026, 8, 14);

describe("configuração do relatório financeiro", () => {
  it("parte do mês fechado anterior, só com operações confirmadas", () => {
    expect(configuracaoPadrao(hoje)).toMatchObject({ nome: "Relatório financeiro — agosto/2026", dataInicio: "2026-08-01", dataFim: "2026-08-31", regime: "ambos", status: ["CONFIRMADA"], categoriaIds: [] });
    expect(periodoMes(new Date(2026, 0, 10), -1)).toEqual({ dataInicio: "2025-12-01", dataFim: "2025-12-31", nome: "dezembro/2025" });
  });

  it("mescla rascunho parcial e descarta valores fora do domínio", () => {
    const base = configuracaoPadrao(hoje);
    expect(mesclarRascunho({ nome: "Pecuária", status: ["RASCUNHO", "CANCELADA"] as string[], categoriaIds: [uid(3), SEM_VINCULO], regime: "outro" as never }, base))
      .toMatchObject({ nome: "Pecuária", status: ["CANCELADA"], categoriaIds: [uid(3), SEM_VINCULO], regime: "ambos", dataInicio: base.dataInicio });
    expect(mesclarRascunho(null, base)).toBe(base);
  });

  it("valida o período em conjunto", () => {
    expect(erroPeriodo({ dataInicio: "2026-09-10", dataFim: "2026-09-01" })).toMatch("anterior");
    expect(erroPeriodo({ dataInicio: "2026-09-01", dataFim: "" })).toMatch("Informe");
    expect(erroPeriodo({ dataInicio: "2024-01-01", dataFim: "2026-01-01" })).toMatch("24 meses");
    expect(erroPeriodo({ dataInicio: "2024-02-01", dataFim: "2026-01-31" })).toBeNull();
  });

  it("só permite gerar com nome e período válido", () => {
    const base = configuracaoPadrao(hoje);
    expect(podeGerar(base)).toBe(true);
    expect(podeGerar({ ...base, nome: " " })).toBe(false);
    expect(podeGerar({ ...base, dataFim: "2026-07-01" })).toBe(false);
  });

  it("alterna itens da multisseleção", () => {
    expect(alternar([1, 2], 2)).toEqual([1]);
    expect(alternar([1], 0)).toEqual([1, 0]);
  });

  it("resume o que entra no documento com os nomes dos cadastros", () => {
    const config = { ...configuracaoPadrao(hoje), tipos: ["SERVICO"], centroCustoIds: [SEM_VINCULO, uid(2)], categoriaIds: [uid(3)], grupoIds: [uid(5), SEM_VINCULO] };
    const resumo = Object.fromEntries(resumoConfiguracao(config, { grupos: [{ id: uid(5), nome: "Investimentos" }], categorias: [{ id: uid(3), nome: "Nutrição" }], centrosCusto: [{ id: uid(2), nome: "Agronomia" }], parceiros: [], tipos: { SERVICO: "Serviço" } }));
    expect(resumo).toMatchObject({ Período: "01/08/2026 a 31/08/2026", Tipos: "Serviço", "Centros de custo": "Sem centro de custo, Agronomia", Categorias: "Nutrição", "Grupos de categorias": "Investimentos, Sem grupo", Situação: "Confirmada" });
  });

  it("lista as seções conforme a leitura e avisa que o saldo não é filtrado", () => {
    const base = configuracaoPadrao(hoje);
    expect(secoesDoRelatorio({ ...base, regime: "previsto" })).not.toContain("Saldo das contas");
    expect(secoesDoRelatorio({ ...base, regime: "previsto" })).toContain("Compromissos a pagar e a receber em aberto");
    expect(secoesDoRelatorio({ ...base, regime: "realizado", status: [] })).toContain("Saldo das contas");
    expect(secoesDoRelatorio({ ...base, regime: "realizado", categoriaIds: [uid(3)] })).toContain("Saldo das contas (sempre sem filtros)");
  });
});

describe("leitura de relatórios emitidos antes dos grupos", () => {
  const snapshotV1 = {
    versao: 1,
    configuracao: { nome: "Antigo", classificacoes: ["CUSTEIO"] },
    filtros: { tipos: [], classificacoes: ["Custeio"] },
    gerencial: {
      resumo: { entradas: 2000, saidas: 1300 },
      resultado: { receita: 2000, custeio: 800, investimento: 500, resultado: 700, porAtividade: [{ atividade: "leite", receita: 2000, custeio: 800, investimento: 500, resultado: 700 }] },
      operacoes: [
        { tipo: "receita", quantidade: 1, valor: 2000, entraNoTotal: true },
        { tipo: "custeio", quantidade: 2, valor: 800, entraNoTotal: true },
        { tipo: "investimento", quantidade: 1, valor: 500, entraNoTotal: true },
        { tipo: "estorno", quantidade: 0, valor: 0, entraNoTotal: false },
      ],
    },
    composicao: {
      linhas: [
        { operacaoId: uid(7), categoria: "Ração", classificacao: "CUSTEIO", valor: "800.00" },
        { operacaoId: uid(8), categoria: "Cerca", classificacao: "INVESTIMENTO", valor: "500.00" },
      ],
      despesas: {
        total: "1300.00", custeio: "800.00", investimento: "500.00", semClassificacao: "0.00",
        porCategoria: [
          { nome: "Ração", total: "800.00", pct: 61.54, custeio: "800.00", investimento: "0.00", semClassificacao: "0.00" },
          { nome: "Cerca", total: "500.00", pct: 38.46, custeio: "0.00", investimento: "500.00", semClassificacao: "0.00" },
        ],
        porCentro: [{ nome: "Atv. Leiteira", total: "1300.00", pct: 100 }],
      },
    },
  };

  it("converte a separação custeio × investimento em grupos, sem recalcular os totais", () => {
    const snapshot = normalizarSnapshot(structuredClone(snapshotV1) as never);
    expect(snapshot.versao).toBe(2);
    expect(snapshot.composicao.despesas.porGrupo).toEqual([
      { nome: "Custeio", total: "800.00", pct: 61.54 },
      { nome: "Investimento", total: "500.00", pct: 38.46 },
    ]);
    expect(snapshot.composicao.despesas.porCategoria).toEqual([
      { nome: "Ração", total: "800.00", pct: 61.54 },
      { nome: "Cerca", total: "500.00", pct: 38.46 },
    ]);
    expect(snapshot.composicao.despesas.total).toBe("1300.00");
    expect(snapshot.composicao.linhas.map((linha) => linha.grupo)).toEqual(["Custeio", "Investimento"]);
    expect(snapshot.filtros.grupos).toEqual(["Custeio"]);
    expect(snapshot.configuracao.grupoIds).toEqual([]);
  });

  it("soma custeio e investimento em despesa no resultado e nas operações", () => {
    const { gerencial } = normalizarSnapshot(structuredClone(snapshotV1) as never);
    expect(gerencial.resultado).toEqual({ receita: 2000, despesa: 1300, resultado: 700, porAtividade: [{ atividade: "leite", receita: 2000, despesa: 1300, resultado: 700 }] });
    expect(gerencial.operacoes).toEqual([
      { tipo: "receita", quantidade: 1, valor: 2000, entraNoTotal: true },
      { tipo: "despesa", quantidade: 3, valor: 1300, entraNoTotal: true },
      { tipo: "estorno", quantidade: 0, valor: 0, entraNoTotal: false },
    ]);
  });

  it("não altera relatórios já no formato novo", () => {
    const atual = { versao: 2 } as never;
    expect(normalizarSnapshot(atual)).toBe(atual);
  });
});
