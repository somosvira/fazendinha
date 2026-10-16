import { describe, expect, it } from "vitest";
import { parametrosSanitariosVisita } from "./parametros-sanitarios-visita.calc.js";

describe("parâmetros sanitários congelados para preparação na visita", () => {
  it("expõe aplicação e exame do JSON flat da tarefa comum sem consultar a etapa atual", () => {
    const tarefa = { parametros: { produtoId: "produto-planejado", dose: "2.500", unidade: "ML", via: "SC",
      tipoAplicacaoId: "tipo-planejado", tipoExameId: "exame-planejado" },
    etapa: { produtoId: "produto-atual", dose: "9", unidade: "L", via: "IM", tipoExameId: "exame-atual" } };
    expect(parametrosSanitariosVisita(tarefa.parametros)).toEqual(tarefa.parametros);
    expect(tarefa.etapa.dose).toBe("9");
  });
  it("não promove identidade, custos, objetos ou chaves arbitrárias do snapshot", () => {
    expect(parametrosSanitariosVisita({ id: "outro", animalId: "outro", propriedadeId: 9, tipo: "OUTRO",
      valorServicoAtribuido: "100", valor: "100", custoTotal: 100, produtoId: { id: "produto" },
      unidade: ["ML"], via: false, dose: 0, tipoAplicacaoId: null, tipoExameId: "exame" })).toEqual({
      produtoId: null, dose: "0", unidade: null, via: null, tipoAplicacaoId: null, tipoExameId: "exame",
    });
  });
  it.each([null, [], "legado", { dose: Infinity }, { etapa: { produtoId: "não-usar", dose: "10" } }])(
    "mantém parâmetros ausentes desconhecidos em %j", parametros => {
      expect(parametrosSanitariosVisita(parametros)).toEqual({ produtoId: null, dose: null, unidade: null, via: null,
        tipoAplicacaoId: null, tipoExameId: null });
    });
});
