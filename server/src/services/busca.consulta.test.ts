import { describe, expect, it } from "vitest";
import { montarConsultaBusca, fontesAutorizadas, escaparTermoBusca, compactarTermoBusca, numeroDoTermo } from "./busca.consulta.js";
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
  it("compacta identificadores e normaliza números para casar brincos com hífen e zeros à esquerda", () => {
    expect(compactarTermoBusca("DEV-001")).toBe("dev001");
    expect(compactarTermoBusca("Dev 035")).toBe("dev035");
    expect(numeroDoTermo("035")).toBe("35");
    expect(numeroDoTermo("000")).toBe("0");
    expect(numeroDoTermo("dev35")).toBeNull();
  });
  it("busca sem separadores e prioriza o animal entre correspondências iguais", () => {
    const fontes = fontesAutorizadas(usuario({ dono: true }));
    const alfanumerica = montarConsultaBusca("dev001", fontes, null);
    expect(alfanumerica.values).toContain("%dev001%");
    expect(alfanumerica.sql).toContain("[^a-z0-9]");
    expect(alfanumerica.sql).toContain("ORDER BY ordem, prioridade, label");
    const numerica = montarConsultaBusca("035", fontes, null);
    expect(numerica.values).toContain("35");
  });
  it("não aplica a comparação compacta a termos só de letras", () => {
    const consulta = montarConsultaBusca("estrela", fontesAutorizadas(usuario({ dono: true })), null);
    expect(consulta.values.filter(v => v === "%estrela%").length).toBe(fontesAutorizadas(usuario({ dono: true })).length);
  });
});

it("referências conferidas abrem o item exato e herdam o acesso ao estoque", () => {
  const fontes = fontesAutorizadas(usuario({ areas: ["pecuaria"] }));
  const fonte = fontes.find(f => f.tipo === "referencia-medicamento")!;
  expect(fonte.global).toBe(true);
  expect(fonte.consulta.sql).toContain("Referência oficial parcial");
  expect(fonte.consulta.sql).toContain('"orientacaoBula" IS NOT NULL');
  expect(fonte.caminho({ tipo: "referencia-medicamento", id: "id-referencia", label: "Pirosan — Frasco 30 ml", contexto: "", alvoId: "", propriedadeId: null }))
    .toBe("/estoque?aba=catalogo&referenciaCatalogo=id-referencia&buscaCatalogo=Pirosan");
  expect(fontesAutorizadas(usuario()).some(f => f.tipo === fonte.tipo)).toBe(false);
});

it("busca o exame ECC pelos nomes antigo e atual e abre o registro exato", () => {
  const fonte = fontesAutorizadas(usuario({ areas: ["pecuaria"] })).find(f => f.tipo === "exame")!;
  expect(fonte.consulta.sql).toContain("e.nome");
  expect(fonte.consulta.sql).toContain("Escore de condição corporal (ECC)");
  expect(fonte.consulta.sql).toContain("b0841f3c-3f88-4c2d-9d0d-3ef33d49b841");
  expect(fonte.caminho({ tipo: "exame", id: "exame-1", label: "ECC", contexto: "", alvoId: "animal-1", propriedadeId: 1 })).toBe("/pecuaria/sanidade?aba=exames&detalheTipo=exame&detalheId=exame-1");
});

it("abre o tipo de exame de sistema com filtro exato e aceita os dois nomes", () => {
  const fonte = fontesAutorizadas(usuario({ areas: ["pecuaria"] })).find(f => f.tipo === "tipo-exame")!;
  expect(fonte.consulta.sql).toContain("t.nome");
  expect(fonte.consulta.sql).toContain("Escore de condição corporal (ECC)");
  expect(fonte.caminho({ tipo: "tipo-exame", id: "tipo-1", label: "Escore de condição corporal (ECC)", contexto: "", alvoId: "tipo-1", propriedadeId: null })).toContain("cadastroId=tipo-1");
});
