import { describe, expect, it } from "vitest";
import { montarConsultaBusca, fontesAutorizadas, escaparTermoBusca } from "./busca.consulta.js";
import type { UsuarioContexto } from "./auth/sessao.js";
const usuario = (extra: Partial<UsuarioContexto> = {}): UsuarioContexto => ({ id: 1, nome: "Consulta", email: "", papel: "consulta", areas: [], abas: [], flags: [], dono: false, status: "ATIVO", ...extra });
describe("fontes da busca global", () => {
  it("não consulta nenhuma fonte sem área/aba autorizada", () => {
    expect(fontesAutorizadas(usuario())).toEqual([]);
  });
  it("estoque atende pecuária, mas financeiro e gestão não vazam", () => {
    const tipos = fontesAutorizadas(usuario({ areas: ["pecuaria"] })).map(f => f.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["animal", "lote", "produto", "visita", "dieta", "exame"]));
    expect(tipos).not.toContain("operacao"); expect(tipos).not.toContain("usuario"); expect(tipos).not.toContain("relatorio-financeiro");
  });
  it("respeita aba e verValores antes de consultar contas, compromissos e relatórios", () => {
    const tipos = fontesAutorizadas(usuario({ areas: ["financeiro"], abas: ["lancar", "cadastros", "relatorio", "caixinha", "gastos"] })).map(f => f.tipo);
    expect(tipos).toContain("operacao"); expect(tipos).toContain("parceiro");
    expect(tipos).not.toContain("conta"); expect(tipos).not.toContain("compromisso"); expect(tipos).not.toContain("relatorio-financeiro");
  });
  it("gera SQL parametrizado com escopo, acentos e limites por fonte", () => {
    const fontes = fontesAutorizadas(usuario({ dono: true }));
    const consulta = montarConsultaBusca("Ração 184%_", fontes, 7);
    expect(consulta.sql).toContain('translate(lower(');
    expect(consulta.sql).toContain('LIMIT');
    expect(consulta.values).toContain(7);
    expect(consulta.values).toContain('%racao%');
    expect(consulta.values).toContain('%184!%!_%');
    expect(consulta.sql).not.toContain('184%_');
    expect(consulta.sql).toContain('"LocalizacaoAnimal"');
    expect(consulta.sql).toContain('"propriedadeId"');
  });
  it("trata curingas SQL como texto e não como expansão da busca", () => {
    expect(escaparTermoBusca("50%_!" )).toBe("50!%!_!!");
  });
});
