import { describe, expect, it } from "vitest";
import { aplicarParcelaPreparo, componentesDaFonte, conferirParcelasPreparo, consolidarCustos, type ClassificacaoCusto, type FonteCusto } from "./custos.calc.js";

const classificacao = (alteracoes: Partial<ClassificacaoCusto> = {}): ClassificacaoCusto => ({ finalidade: "REPRODUCAO", materialNaoAplicavel: false,
  servicoNaoAplicavel: false, coberturaServico: "PROCEDIMENTO", valorMaterialDocumentado: null, ...alteracoes });
const fonte = (alteracoes: Partial<FonteCusto> = {}): FonteCusto => ({ id: "fato", tipo: "TENTATIVA", animalId: "animal", propriedadeId: 1,
  data: "2026-10-01", descricao: "Fato comprovado", estadoFato: "VALIDO", participacaoId: null, origemMaterial: "ESTOQUE",
  movimentoEstoqueId: "consumo-material", operacaoServicoId: "servico", valorMaterial: "50.00", valorServico: "20.00", classificacao: classificacao(), ...alteracoes });
const preparo = () => componentesDaFonte(fonte({ id: "preparo", tipo: "APLICACAO", participacaoId: "protocolo", movimentoEstoqueId: "consumo-preparo",
  valorMaterial: "30.00", operacaoServicoId: null, valorServico: null, classificacao: classificacao({ servicoNaoAplicavel: true }) }));

describe("oráculos independentes de custo direto e atribuições", () => {
  it("30 de preparatórios + 50 de material + 20 de Serviço totalizam 100 em cada visão", () => {
    const componentes = [...preparo(), ...componentesDaFonte(fonte())];
    const tentativa = consolidarCustos(componentes);
    const protocolo = consolidarCustos([...componentes, ...preparo()]);
    const animal = consolidarCustos([...componentes, ...componentes]);
    for (const visao of [tentativa, protocolo, animal]) expect(visao).toMatchObject({ totalConhecido: "100.00", cobertura: "COMPLETO", situacao: "COMPLETO" });
    // As visões representam os mesmos fatos; seus totais não são parcelas somáveis.
    expect(new Set(animal.componentes.filter(c => c.estado === "CONHECIDO").map(c => c.chave)).size).toBe(3);
  });

  it("espelho do mesmo movimento material entra uma única vez", () => {
    const a = componentesDaFonte(fonte({ valorServico: null, operacaoServicoId: null, classificacao: classificacao({ servicoNaoAplicavel: true }) }));
    const b = componentesDaFonte(fonte({ id: "espelho", tipo: "APLICACAO", valorServico: null, operacaoServicoId: null, classificacao: classificacao({ servicoNaoAplicavel: true }) }));
    expect(consolidarCustos([...a, ...b]).totalConhecido).toBe("50.00");
  });

  it("atribuições distintas ao mesmo Serviço conservam suas parcelas, sem deduplicar a operação inteira", () => {
    const a = componentesDaFonte(fonte({ tipo: "EXAME", id: "exame", valorMaterial: null, movimentoEstoqueId: null, valorServico: "20.00" }));
    const b = componentesDaFonte(fonte({ tipo: "PARTICIPACAO", id: "participacao", valorMaterial: null, movimentoEstoqueId: null, valorServico: "30.00" }));
    expect(consolidarCustos([...a, ...b])).toMatchObject({ totalConhecido: "50.00", cobertura: "COMPLETO" });
  });

  it("mesma origem com valores divergentes falha, em vez de escolher silenciosamente um preço", () => {
    const primeiro = componentesDaFonte(fonte());
    const divergente = componentesDaFonte(fonte({ id: "outro-fato", valorMaterial: "51.00" }));
    expect(() => consolidarCustos([...primeiro, ...divergente])).toThrow(/divergentes/);
  });

  it("todo valor desconhecido continua desconhecido e não vira R$0,00", () => {
    const resultado = consolidarCustos(componentesDaFonte(fonte({ movimentoEstoqueId: null, operacaoServicoId: null, valorMaterial: null, valorServico: null, classificacao: null })));
    expect(resultado).toMatchObject({ cobertura: "DESCONHECIDO", situacao: "DESCONHECIDO", totalConhecido: null, componentesPendentes: 2 });
  });

  it("zero comprovado é completo e permanece distinto de ausência", () => {
    const resultado = consolidarCustos(componentesDaFonte(fonte({ valorMaterial: "0.00", valorServico: "0.00" })));
    expect(resultado).toMatchObject({ cobertura: "COMPLETO", totalConhecido: "0.00", componentesPendentes: 0 });
  });

  it("material conhecido e procedimento desconhecido geram subtotal parcial sem completar o que falta", () => {
    const resultado = consolidarCustos(componentesDaFonte(fonte({ valorServico: null })));
    expect(resultado).toMatchObject({ cobertura: "PARCIAL", totalConhecido: "50.00", componentesPendentes: 1 });
    expect(resultado.componentes.find(c => c.natureza === "SERVICO")).toMatchObject({ estado: "DESCONHECIDO", valor: null });
  });

  it("oculto conserva a cobertura e elimina valores e vínculos monetários", () => {
    const resultado = consolidarCustos([...preparo(), ...componentesDaFonte(fonte())], false);
    expect(resultado).toMatchObject({ cobertura: "COMPLETO", situacao: "OCULTO", totalConhecido: null });
    expect(resultado.componentes.every(c => c.valor === null && c.origemId === null)).toBe(true);
  });

  it("finalidade reprodutiva independe de participar de protocolo", () => {
    const linhas = componentesDaFonte(fonte({ participacaoId: null, classificacao: classificacao({ finalidade: "REPRODUCAO" }) }));
    expect(linhas.every(c => c.participacaoId === null && c.finalidade === "REPRODUCAO")).toBe(true);
  });

  it("finalidade não informada continua explícita, mesmo quando a fonte está em protocolo", () => {
    const linhas = componentesDaFonte(fonte({ participacaoId: "protocolo", classificacao: null }));
    expect(linhas.every(c => c.finalidade === null && c.participacaoId === "protocolo")).toBe(true);
  });

  it("material e procedimento incluídos no pacote de70 entram por uma única origem monetária", () => {
    const linhas = componentesDaFonte(fonte({ origemMaterial: "SERVICO", movimentoEstoqueId: null, valorMaterial: null, valorServico: "70.00", classificacao: classificacao({ coberturaServico: "AMBOS" }) }));
    expect(consolidarCustos(linhas)).toMatchObject({ totalConhecido: "70.00", cobertura: "COMPLETO" });
    expect(linhas.find(c => c.natureza === "MATERIAL")).toMatchObject({ estado: "INCLUIDO_PACOTE", valor: null });
  });

  it("pacote apenas de material não inventa que o procedimento foi coberto", () => {
    const linhas = componentesDaFonte(fonte({ origemMaterial: "SERVICO", movimentoEstoqueId: null, valorMaterial: null, valorServico: "20.00", classificacao: classificacao({ coberturaServico: "MATERIAL" }) }));
    expect(consolidarCustos(linhas)).toMatchObject({ totalConhecido: "20.00", cobertura: "PARCIAL", componentesPendentes: 1 });
  });

  it("parcela de10 de um pacote material de20 mantém procedimento desconhecido sem duplicar10", () => {
    const linhas = componentesDaFonte(fonte({ origemMaterial: "SERVICO", movimentoEstoqueId: null, valorMaterial: null, valorServico: "20.00", classificacao: classificacao({ coberturaServico: "MATERIAL" }) }));
    const atribuicao = aplicarParcelaPreparo(linhas, { modo: "PARCELA", valorMaterial: null, valorServico: "10.00" });
    expect(consolidarCustos(atribuicao)).toMatchObject({ totalConhecido: "10.00", cobertura: "PARCIAL", componentesPendentes: 1 });
    expect(atribuicao.filter(c => c.valor !== null)).toHaveLength(1);
    expect(consolidarCustos(linhas).totalConhecido).toBe("20.00");
  });

  it.each(["MATERIAL", "AMBOS"] as const)("pacote %s não pode somar novamente material próprio de50", coberturaServico => {
    expect(() => componentesDaFonte(fonte({ classificacao: classificacao({ coberturaServico }) }))).toThrow();
  });

  it("não aplicável explícito resolve cobertura sem inventar componente monetário", () => {
    const linhas = componentesDaFonte(fonte({ origemMaterial: "SEM_CONSUMO", movimentoEstoqueId: null, operacaoServicoId: null,
      valorMaterial: null, valorServico: null, classificacao: classificacao({ materialNaoAplicavel: true, servicoNaoAplicavel: true }) }));
    expect(linhas.every(c => c.estado === "NAO_APLICAVEL" && c.valor === null)).toBe(true);
    expect(consolidarCustos(linhas)).toMatchObject({ totalConhecido: "0.00", cobertura: "COMPLETO" });
  });

  it("valor externo documentado não é aplicado a uma origem sem declaração de valor externo", () => {
    const c = classificacao({ valorMaterialDocumentado: "12.34", servicoNaoAplicavel: true });
    const desconhecido = componentesDaFonte(fonte({ origemMaterial: "FORA_ESTOQUE", valorMaterial: null, operacaoServicoId: null, valorServico: null, classificacao: c }));
    const documentado = componentesDaFonte(fonte({ origemMaterial: "DOCUMENTADA", valorMaterial: null, operacaoServicoId: null, valorServico: null, classificacao: c }));
    expect(consolidarCustos(desconhecido).totalConhecido).toBeNull();
    expect(consolidarCustos(documentado).totalConhecido).toBe("12.34");
  });

  it("parcelas explícitas de preparo conservam os limites de material30 e Serviço20 separadamente", () => {
    const linhas = componentesDaFonte(fonte({ valorMaterial: "30.00", valorServico: "20.00" }));
    const parcelas = [{ modo: "PARCELA" as const, valorMaterial: "10.00", valorServico: "5.00" }, { modo: "PARCELA" as const, valorMaterial: "20.00", valorServico: "15.00" }];
    expect(() => conferirParcelasPreparo(linhas, parcelas)).not.toThrow();
    expect(parcelas.map(p => consolidarCustos(aplicarParcelaPreparo(linhas, p)).totalConhecido)).toEqual(["15.00", "35.00"]);
    expect(consolidarCustos(linhas).totalConhecido).toBe("50.00");
    expect(() => conferirParcelasPreparo(linhas, [...parcelas, { modo: "PARCELA", valorMaterial: "0.01", valorServico: null }])).toThrow();
    expect(() => conferirParcelasPreparo(linhas, [{ modo: "PARCELA", valorMaterial: null, valorServico: "20.01" }])).toThrow();
  });

  it("integral é exclusivo, e desconhecido não pode suportar parcela inventada", () => {
    const linhas = componentesDaFonte(fonte());
    const integral = { modo: "INTEGRAL" as const, valorMaterial: null, valorServico: null };
    expect(() => conferirParcelasPreparo(linhas, [integral])).not.toThrow();
    expect(() => conferirParcelasPreparo(linhas, [integral, { modo: "PARCELA", valorMaterial: "1.00", valorServico: null }])).toThrow();
    const semValor = componentesDaFonte(fonte({ valorMaterial: null, valorServico: null }));
    expect(() => conferirParcelasPreparo(semValor, [{ modo: "PARCELA", valorMaterial: "1.00", valorServico: null }])).toThrow();
  });

  it.each(["-0.01", "0.001", "NaN", "Infinity"])("não aceita parcela monetária inválida %s", valorMaterial => {
    expect(() => aplicarParcelaPreparo(componentesDaFonte(fonte()), { modo: "PARCELA", valorMaterial, valorServico: null })).toThrow();
  });
});
