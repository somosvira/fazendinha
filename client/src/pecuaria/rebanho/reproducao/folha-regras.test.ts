import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { criteriosFolha, LEGENDA_FOLHA, rpFolha } from "./folha-regras";
import { FolhaVisita } from "./FolhaVisita";
import { csvRelatorioPartos, FolhaRelatorioPartos, linhasCriasPartos, type SnapshotRelatorioPartos } from "./RelatorioPartos";

describe("folha de campo congelada", () => {
  it("descreve E/OU, limites abertos, política desconhecidos, exclusões e ordem", () => {
    const texto = criteriosFolha({ selecaoCriterios: { versao: 1,
      todas: [{ tipo: "FAIXA", campo: "DEL", min: 30, max: 90, incluirMin: false, incluirMax: true }],
      qualquer: [{ id: "a", todas: [{ tipo: "DESCONHECIDO", campo: "RP" }] }, { id: "b", todas: [{ tipo: "VALORES", campo: "LOTE", valores: ["lote-1"] }] }],
      ordenacao: [{ campo: "DEL", direcao: "DESC" }], politicaDesconhecidos: "INCLUIR" },
      excluidos: [{ animalId: "a1", motivo: "Separada para manejo" }], grupoPlanner: { selecaoVersaoId: "v2" } }).join(" ");
    expect(texto).toContain("> 30 e ≤ 90");
    for (const esperado of ["(E)", "OU", "desconhecidos: incluir", "Separada para manejo", "DEL decrescente", "v2"]) expect(texto).toContain(esperado);
  });
  it("diferencia RP não informada e ausência comprovada de parto", () => {
    expect(rpFolha({})).toBe("Não informado");
    expect(rpFolha({ ultimoParto: null })).toBe("Sem parto registrado");
    expect(rpFolha({ retencaoPlacenta: false })).toBe("Não");
    expect(rpFolha({ retencaoPlacenta: true })).toBe("Sim");
  });
  it("reimprime snapshot antigo sem inventar dados ou motivos do estado atual", () => {
    const snapshot = { atividades: [{ id: "a", nome: "Avaliação", tipo: "AVALIACAO_REPRODUTIVA" as const, extra: true, participantes: [{ id: "p", animalId: "animal", ordem: 1, status: "PENDENTE", rascunho: null, snapshot: { brinco: "001", partos: 0, tentativa: null } }] }] };
    const antes = JSON.stringify(snapshot);
    const html = renderToStaticMarkup(createElement(FolhaVisita, { snapshot }));
    expect(html).toContain("Motivo não preservado");
    expect(html).toContain("Versão da emissão: não preservada");
    expect(html).toContain("Partos realizados: 0");
    expect(html).toContain("Atividade extra");
    expect(html).toContain("Não informado");
    expect(JSON.stringify(snapshot)).toBe(antes);
    expect(LEGENDA_FOLHA).toContain("D0");
    expect(LEGENDA_FOLHA).toContain("aborto e natimorto");
  });
});

const snapshot: SnapshotRelatorioPartos = { versao: 1, emitidoEm: "2026-10-01T12:00:00Z", propriedadeId: 2, periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, totalPartos: 1, partos: [{
  id: "p", versao: 3, matriz: { id: "m", brinco: "001", nome: "Matriz" }, data: "2026-09-30", ocorridoEm: null, horarioEstimado: false,
  desfecho: "NASCIMENTO", tipo: "NORMAL", induzido: null, dificuldade: false, assistenciaDescricao: null, retencaoPlacenta: null,
  responsavel: "Veterinário", lancador: { id: 1, nome: "Operador" }, observacao: null, criadoEm: "2026-10-01", ocorrenciasRetencaoPlacenta: [], pesosMatriz: [], escoresMatriz: [],
  crias: [1, 2].map(i => ({ id: `c${i}`, animalId: null, ordem: i, sexo: "F", viva: true, filiacaoSnapshot: {}, pesos: [], colostro: [{ id: `f${i}`, data: "2026-10-01", ocorridoEm: null, horarioEstimado: false, quantidadeLitros: i === 1 ? null : "0", unidadeInformada: null, metodoQualidade: null, qualidadeBrix: null, qualidadeClassificacao: null, tipo: null, forma: null, responsavel: null, observacao: null }] }))
}] };
describe("ficha própria de partos", () => {
  it("subdivide gêmeos sem duplicar a contagem e mantém parto sem cria", () => {
    expect(linhasCriasPartos(snapshot)).toHaveLength(2);
    expect(linhasCriasPartos(snapshot).reduce((n, l) => n + l.contarParto, 0)).toBe(1);
    expect(linhasCriasPartos({ ...snapshot, partos: [{ ...snapshot.partos[0], crias: [] }] })).toEqual([{ parto: { ...snapshot.partos[0], crias: [] }, cria: null, contarParto: 1 }]);
  });
  it("imprime e exporta o mesmo corte, responsável separado e quantidade desconhecida distinta de zero", () => {
    const html = renderToStaticMarkup(createElement(FolhaRelatorioPartos, { snapshot }));
    expect(html).toContain("1 partos");
    expect(html).toContain("Quantidade: Não informada");
    expect(html).toContain("Quantidade: 0 L");
    expect(html).toContain("Veterinário");
    expect(html).toContain("Operador");
    expect(html).toContain("horário não informado");
    const csv = csvRelatorioPartos(snapshot);
    expect(csv).toContain('"Contagem parto"');
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain('"2026-09-30"');
  });
});
