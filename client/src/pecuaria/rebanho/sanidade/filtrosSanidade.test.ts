import { describe, expect, it } from "vitest";
import { consultaFiltrosSanidade, gravarFiltrosSanidade, lerFiltrosSanidade } from "./filtrosSanidade";

describe("filtros independentes das consultas sanitárias", () => {
  it("restaura links antigos e preserva filtros de outra tabela ao alternar e recarregar", () => {
    const filtros = lerFiltrosSanidade(new URLSearchParams("animalId=a&loteId=l&situacao=ABERTA&buscaAnimal=GV3&pagina=3"), "ocorrencias");
    expect(filtros.ocorrencias).toMatchObject({ animalIds: ["a"], loteIds: ["l"], situacoes: ["ABERTA"], buscaAnimal: "GV3", pagina: 3 });
    expect(filtros.exames).toMatchObject({ animalIds: [], buscaAnimal: "", pagina: 1 });
    filtros.exames = { ...filtros.exames, animalIds: ["b", "c"], situacoes: ["ANULADO", "AGUARDANDO_RESULTADO"], de: "2026-09-01" };
    const url = new URLSearchParams();
    gravarFiltrosSanidade(url, filtros, "exames");
    expect(lerFiltrosSanidade(url, "exames")).toEqual(filtros);
    expect(url.get("animalId")).toBeNull();
    expect(url.get("animalIds")).toBe("b,c");
  });

  it("envia todas as escolhas ao servidor antes da paginação e elimina duplicatas da URL", () => {
    const filtros = lerFiltrosSanidade(new URLSearchParams("animalIds=a,b,a&loteIds=x,y&situacoes=VALIDO,ANULADO&de=2026-09-01&ate=2026-09-30&pagina=2"), "aplicacoes").aplicacoes;
    expect(Object.fromEntries(consultaFiltrosSanidade(filtros))).toEqual({ animalIds: "a,b", loteIds: "x,y", situacoes: "VALIDO,ANULADO", de: "2026-09-01", ate: "2026-09-30", pagina: "2", porPagina: "50" });
  });
});
