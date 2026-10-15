import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { criteriosFolha, LEGENDA_FOLHA, rpFolha } from "./folha-regras";
import { FolhaVisita } from "./FolhaVisita";
import { csvRelatorioPartos, FolhaRelatorioPartos, linhasCriasPartos, type SnapshotRelatorioPartos } from "./RelatorioPartos";

describe("folha de campo congelada", () => {
  it("preserva a escolha de incluir ou excluir descarte nos critérios", () => {
    for (const [valor, rotulo] of [["SIM", "Sim"], ["NAO", "Não"]]) {
      const linhas = criteriosFolha({ selecaoCriterios: { todas: [{ tipo: "VALORES", campo: "DESCARTE", valores: [valor] }] } }).join(" ");
      expect(linhas).toContain(`Descarte: ${rotulo}`);
      expect(linhas).not.toContain("nomes não preservados");
    }
  });
  it("descreve E/OU, limites abertos, política desconhecidos, exclusões e ordem", () => {
    const texto = criteriosFolha({ selecaoCriterios: { versao: 1,
      todas: [{ tipo: "FAIXA", campo: "DEL", min: 30, max: 90, incluirMin: false, incluirMax: true }],
      qualquer: [{ id: "a", todas: [{ tipo: "DESCONHECIDO", campo: "RP" }] }, { id: "b", todas: [{ tipo: "VALORES", campo: "LOTE", valores: ["lote-1"] }] }],
      ordenacao: [{ campo: "DEL", direcao: "DESC" }], politicaDesconhecidos: "INCLUIR" },
      excluidos: [{ animalId: "a1", motivo: "Separada para manejo" }], grupoPlanner: { selecaoVersaoId: "550e8400-e29b-41d4-a716-446655440000" }, fingerprint: "550e8400-e29b-41d4-a716-446655440001" }).join(" ");
    expect(texto).toContain("> 30 e ≤ 90");
    for (const esperado of ["(E)", "OU", "desconhecidos: incluir", "Separada para manejo", "DEL decrescente"]) expect(texto).toContain(esperado);
    expect(texto).not.toContain("550e8400");
    expect(texto).not.toContain("fingerprint");
  });
  it("mantém filtros legados legíveis sem imprimir IDs de lote ou categoria", () => {
    const categoriaId = "category-reference-6789";
    const loteId = "lot-reference-1234";
    const linhas = criteriosFolha({ criterios: {
      categoriaId, loteId, situacao: "AGUARDANDO_DIAGNOSTICO", diasTentativaMin: 28, diasTentativaMax: 35,
      diasPartoMin: 0, diasGestacaoMax: 240,
    } });
    const texto = linhas.join(" ");
    expect(texto).toContain("Categoria: nome não preservado");
    expect(texto).toContain("Lote: nome não preservado");
    expect(texto).toContain("Situação reprodutiva: Aguardando diagnóstico");
    expect(texto).toContain("Dias desde tentativa: ≥ 28 e ≤ 35");
    expect(texto).toContain("Dias pós-parto: ≥ 0 e sem máximo");
    expect(texto).toContain("Dias de gestação: sem mínimo e ≤ 240");
    expect(texto).not.toContain(categoriaId);
    expect(texto).not.toContain(loteId);
  });
  it("diferencia RP não informada e ausência comprovada de parto", () => {
    expect(rpFolha({})).toBe("Não informado");
    expect(rpFolha({ partos: 0, ultimoParto: null })).toBe("Sem parto registrado");
    expect(rpFolha({ partos: 2, ultimoParto: null })).toBe("Não informado");
    expect(rpFolha({ ultimoParto: null })).toBe("Não informado");
    expect(rpFolha({ retencaoPlacenta: false })).toBe("Não");
    expect(rpFolha({ retencaoPlacenta: true })).toBe("Sim");
  });
  it("reimprime snapshot antigo sem inventar dados ou motivos do estado atual", () => {
    const snapshot = { atividades: [{ id: "a", nome: "Avaliação", tipo: "AVALIACAO_REPRODUTIVA" as const, extra: true, participantes: [{ id: "p", animalId: "animal", ordem: 1, status: "PENDENTE", rascunho: null, snapshot: { brinco: "001", partos: 0, tentativa: null } }] }] };
    const antes = JSON.stringify(snapshot);
    const html = renderToStaticMarkup(createElement(FolhaVisita, { snapshot }));
    expect(html).toContain("Critérios de inclusão não preservados");
    expect(html).toContain("Versão da emissão: não preservada");
    expect(html).toContain(">0</td>");
    expect(html).toContain("Partos</th>");
    expect(html).toContain("Atividade extra");
    expect(html).toContain("Não informado");
    expect(JSON.stringify(snapshot)).toBe(antes);
    expect(LEGENDA_FOLHA).toContain("D0");
    expect(LEGENDA_FOLHA).toContain("aborto e natimorto");
  });

  it("não imprime IDs técnicos, concentra motivos comuns e conserva ordem e contexto clínico", () => {
    const idTecnico = "550e8400-e29b-41d4-a716-446655440000";
    const snapshot = { atividades: [{ id: "atividade", nome: "Diagnóstico · Protocolo nomeado", tipo: "TAREFA_IATF" as const, extra: false,
      contexto: { grupoPlanner: { origem: "PROTOCOLO", identidade: idTecnico }, fingerprint: idTecnico, excluidos: [idTecnico], selecaoCriterios: {
        versao: 1, todas: [{ tipo: "FAIXA", campo: "DIAS_TENTATIVA", min: 28, max: 35, incluirMin: true, incluirMax: true }], qualquer: [], ordenacao: [], politicaDesconhecidos: "EXCLUIR",
      } },
      participantes: [
        { id: "p2", animalId: "a2", ordem: 2, status: "PENDENTE", rascunho: null, snapshot: { brinco: "002", motivos: ["Etapa IATF pendente", "Gestação conhecida"], del: 0, partos: 2, situacao: "GESTANTE" } },
        { id: "p1", animalId: "a1", ordem: 1, status: "PENDENTE", rascunho: null, snapshot: { brinco: "001", motivos: ["Etapa IATF pendente", "Restrição reprodutiva"], del: 45, partos: 1, situacao: "VAZIA" } },
      ],
    }] };
    const html = renderToStaticMarkup(createElement(FolhaVisita, { snapshot }));
    expect(html).not.toContain(idTecnico);
    expect(html).not.toContain("fingerprint");
    expect(html).toContain("Dias desde tentativa: ≥ 28 e ≤ 35");
    expect(html).toContain("Motivos comuns:</strong> Etapa IATF pendente");
    expect(html.indexOf("001")).toBeLessThan(html.indexOf("002"));
    expect(html).toContain("Gestante");
    expect(html).toContain("Observação individual");
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
