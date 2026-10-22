import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { componentesDaFonte, type ComponenteCusto, type FonteCusto } from "../custos/custos.calc.js";
import { resumirProducao } from "./producao.calc.js";
import { calcularCustosLeite, type EntradaCustosLeite } from "./custos.calc.js";

const periodo = { inicio: "2026-10-01", fim: "2026-10-31" };
const material = (valor: string | null, alteracoes: Partial<FonteCusto> = {}) => componentesDaFonte({
  id: "fato", tipo: "APLICACAO", animalId: "vaca-a", propriedadeId: 1, data: "2026-10-15",
  descricao: "Custo registrado", estadoFato: "VALIDO", participacaoId: null,
  origemMaterial: "ESTOQUE", movimentoEstoqueId: "movimento-a", operacaoServicoId: null,
  valorMaterial: valor, valorServico: null,
  classificacao: { finalidade: "SANIDADE", materialNaoAplicavel: false, servicoNaoAplicavel: true, coberturaServico: "PROCEDIMENTO", valorMaterialDocumentado: null },
  ...alteracoes,
});
function entrada(componentes = material("900.00"), litros: number | null = 600): EntradaCustosLeite {
  return { finalidades: ["vaca-a", "vaca-b"].map(animalId => ({ id: animalId, animalId, aptidao: "LEITE", desde: new Date("2020-01-01"), ate: null })), periodo, animalIds: ["vaca-a"], custos: { periodo, animalIds: ["vaca-a"], componentes },
    producao: { periodo, animalIds: ["vaca-a"], animais: [{ animalId: "vaca-a", producao: resumirProducao([{ estado: litros === null ? "PENDENTE" : "MEDIDO", litros }]) }] }, verValores: true };
}

describe("custo direto registrado por vaca e litro no mesmo recorte", () => {
  it("900 reais por 600 litros resulta em 1,50 sem multiplicar pelo tempo", () => {
    const resultado = calcularCustosLeite(entrada());
    expect(resultado.animais[0]).toMatchObject({ animalId: "vaca-a", custos: { totalConhecido: "900.00" }, custoPorLitro: "1.50", situacao: "APURADO" });
    expect(resultado.consolidado).toMatchObject({ custos: { totalConhecido: "900.00" }, producao: { litros: 600 }, custoPorLitro: "1.50", motivos: [] });
  });
  it("soma componentes únicos das três fontes, inclusive espelhos, sem somar resumos", () => {
    const nutricao = material("400.00", { id: "nutricao", tipo: "NUTRICAO", componenteId: "item", periodoConsumo: periodo });
    const sanidade = material("200.00");
    const reproducao = material("300.00", { id: "tentativa", tipo: "TENTATIVA", movimentoEstoqueId: "movimento-b" });
    expect(calcularCustosLeite(entrada([...nutricao, ...sanidade, ...reproducao, ...sanidade])).consolidado.custoPorLitro).toBe("1.50");
  });
  it("consolidado é razão das somas (900/600), diferente da média de 1 e 3", () => {
    const dados = entrada([...material("450.00"), ...material("450.00", { id: "outro", animalId: "vaca-b", movimentoEstoqueId: "movimento-b" })], 450);
    dados.animalIds.push("vaca-b"); dados.custos.animalIds.push("vaca-b"); dados.producao.animalIds.push("vaca-b");
    dados.producao.animais.push({ animalId: "vaca-b", producao: resumirProducao([{ estado: "MEDIDO", litros: 150 }]) });
    const resultado = calcularCustosLeite(dados);
    expect(resultado.animais.map(a => a.custoPorLitro)).toEqual(["1.00", "3.00"]);
    expect(resultado.consolidado.custoPorLitro).toBe("1.50");
  });
  it.each([null, 0])("custo sem volume positivo (%s) permanece visível sem divisão", litros => {
    expect(calcularCustosLeite(entrada(material("900.00"), litros)).consolidado).toMatchObject({ custos: { totalConhecido: "900.00" }, custoPorLitro: null, situacao: "NAO_APURADO" });
  });
  it("produção parcial mantém litros conhecidos e explicita pendência do denominador", () => {
    const dados = entrada();
    dados.producao.animais[0].producao = resumirProducao([{ estado: "MEDIDO", litros: 39 }], 6);
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ producao: { litros: 39, completa: false }, custoPorLitro: null, motivos: ["PRODUCAO_PARCIAL"] });
  });
  it("distingue ausência de componentes, custo desconhecido e zero comprovado", () => {
    expect(calcularCustosLeite(entrada([])).consolidado).toMatchObject({ custos: { totalConhecido: null, cobertura: "DESCONHECIDO" }, custoPorLitro: null });
    expect(calcularCustosLeite(entrada(material(null))).consolidado).toMatchObject({ custos: { totalConhecido: null, cobertura: "DESCONHECIDO" }, custoPorLitro: null });
    expect(calcularCustosLeite(entrada(material("0.00"))).consolidado).toMatchObject({ custos: { totalConhecido: "0.00", cobertura: "COMPLETO" }, custoPorLitro: "0.00" });
  });
  it("custo parcial não oferece subtotal como custo completo por litro", () => {
    const dados = entrada([...material("20.00"), ...material(null, { id: "pendente", movimentoEstoqueId: null })]);
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { cobertura: "PARCIAL", totalConhecido: "20.00" }, custoPorLitro: null, motivos: ["CUSTO_PENDENTE"] });
  });
  it("vaca sem componentes torna o custo consolidado parcial, mesmo com custo conhecido da outra", () => {
    const dados = entrada();
    dados.animalIds.push("vaca-b"); dados.custos.animalIds.push("vaca-b"); dados.producao.animalIds.push("vaca-b");
    dados.producao.animais.push({ animalId: "vaca-b", producao: resumirProducao([{ estado: "MEDIDO", litros: 100 }]) });
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { cobertura: "PARCIAL", totalConhecido: "900.00" }, animaisSemComponentes: ["vaca-b"], custoPorLitro: null });
  });
  it("filtrar só manhã conserva custo diário e impede atribuir todo custo à ordenha", () => {
    const dados = entrada(); dados.producao.posicaoId = "manha";
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { totalConhecido: "900.00" }, producao: { litros: 600 }, custoPorLitro: null, motivos: ["ORDENHA_SEM_RATEIO"] });
  });
  it("mascara todos os valores monetários e origens, inclusive por vaca", () => {
    const dados = entrada(); dados.verValores = false;
    const resultado = calcularCustosLeite(dados);
    for (const resumo of [resultado.consolidado, ...resultado.animais]) {
      expect(resumo).toMatchObject({ situacao: "OCULTO", custoPorLitro: null, custos: { situacao: "OCULTO", totalConhecido: null } });
      expect(resumo.custos.componentes.every(c => c.valor === null && c.origemId === null)).toBe(true);
    }
    expect(JSON.stringify(resultado)).not.toContain("900.00");
    expect(JSON.stringify(resultado)).not.toContain('"origemId":"movimento-a"');
  });
});

describe("compatibilidade e periodização dos componentes", () => {
  it("não usa custo vitalício: exclui fatos fora do período inclusivo", () => {
    const dados = entrada([...material("900.00"), ...material("999.00", { id: "antigo", data: "2026-09-30", movimentoEstoqueId: "antigo" }), ...material("999.00", { id: "futuro", data: "2026-11-01", movimentoEstoqueId: "futuro" })]);
    expect(calcularCustosLeite(dados).consolidado.custos.totalConhecido).toBe("900.00");
  });
  it("nutrição inteiramente contida soma o valor atribuído uma vez", () => {
    const dados = entrada(material("900.00", { tipo: "NUTRICAO", componenteId: "item", periodoConsumo: periodo }));
    expect(calcularCustosLeite(dados).consolidado.custoPorLitro).toBe("1.50");
  });
  it("nutrição que cruza o início não rateia nem desaparece por sua data de fechamento", () => {
    const dados = entrada(material("900.00", { tipo: "NUTRICAO", componenteId: "item", data: "2026-11-03", periodoConsumo: { inicio: "2026-09-25", fim: "2026-11-03" } }));
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { totalConhecido: null, cobertura: "DESCONHECIDO" }, custoPorLitro: null, motivos: ["CUSTO_PENDENTE", "PERIODO_CUSTO_PENDENTE"] });
    expect(dados.custos.componentes[0].valor?.toString()).toBe("900");
  });
  it("nutrição sem intervalo fica pendente; intervalo totalmente externo é excluído", () => {
    expect(calcularCustosLeite(entrada(material("900.00", { tipo: "NUTRICAO" }))).consolidado.motivos).toContain("PERIODO_CUSTO_PENDENTE");
    const fora = material("900.00", { tipo: "NUTRICAO", periodoConsumo: { inicio: "2026-09-01", fim: "2026-09-30" } });
    expect(calcularCustosLeite(entrada(fora)).consolidado.custos.componentes).toHaveLength(0);
  });
  it("recusa períodos e populações divergentes, repetidos ou incompletos", () => {
    const diferente = entrada(); diferente.custos.periodo = { ...periodo, inicio: "2026-09-01" };
    expect(() => calcularCustosLeite(diferente)).toThrow(/período/i);
    const populacao = entrada(); populacao.custos.animalIds = ["vaca-b"];
    expect(() => calcularCustosLeite(populacao)).toThrow(/população/i);
    const duplicada = entrada(); duplicada.producao.animais.push(duplicada.producao.animais[0]);
    expect(() => calcularCustosLeite(duplicada)).toThrow(/população/i);
    const ausente = entrada(); ausente.producao.animais = [];
    expect(() => calcularCustosLeite(ausente)).toThrow(/população/i);
    expect(() => calcularCustosLeite(entrada(material("1.00", { animalId: "vaca-b" })))).toThrow(/população/i);
  });
  it.each([
    { inicio: "2026-2-01", fim: "2026-10-31" }, { inicio: "2026-02-30", fim: "2026-10-31" },
    { inicio: "2026-11-01", fim: "2026-10-31" },
  ])("recusa período inválido %j", invalido => {
    const dados = entrada(); dados.periodo = invalido;
    expect(() => calcularCustosLeite(dados)).toThrow(/período/i);
  });
  it("preserva o conflito por origem do motor atual e recusa origem atribuída a animais distintos", () => {
    const dados = entrada([...material("900.00"), ...material("901.00")]);
    expect(() => calcularCustosLeite(dados)).toThrow(/divergentes/);
    const cruzado = entrada([...material("900.00"), ...material("900.00", { animalId: "vaca-b" })]);
    cruzado.animalIds.push("vaca-b"); cruzado.custos.animalIds.push("vaca-b"); cruzado.producao.animalIds.push("vaca-b");
    cruzado.producao.animais.push({ animalId: "vaca-b", producao: resumirProducao([{ estado: "MEDIDO", litros: 10 }]) });
    expect(() => calcularCustosLeite(cruzado)).toThrow(/animais distintos/);
  });
  it("periodização pendente não esconde valores divergentes da mesma origem", () => {
    const incompleto = { tipo: "NUTRICAO" as const, componenteId: "item", periodoConsumo: { inicio: "2026-09-01", fim: "2026-10-31" } };
    expect(() => calcularCustosLeite(entrada([...material("900.00", incompleto), ...material("901.00", incompleto)]))).toThrow(/divergentes/);
  });
  it("não aceita volume negativo/não finito nem custo conhecido inconsistente", () => {
    for (const litros of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const dados = entrada(); dados.producao.animais[0].producao.litros = litros;
      expect(() => calcularCustosLeite(dados)).toThrow(/volume/i);
    }
    const componentes: ComponenteCusto[] = material("1.00"); componentes[0].valor = new Prisma.Decimal(-1);
    expect(() => calcularCustosLeite(entrada(componentes))).toThrow(/monetário/i);
  });
});

describe("custos apenas nos períodos de finalidade Leite", () => {
  function alternado() { return [
    { id: "l1", animalId: "vaca-a", aptidao: "LEITE", desde: new Date("2026-10-01"), ate: new Date("2026-10-15") },
    { id: "r", animalId: "vaca-a", aptidao: "REPRODUCAO", desde: new Date("2026-10-15"), ate: new Date("2026-10-20") },
    { id: "l2", animalId: "vaca-a", aptidao: "LEITE", desde: new Date("2026-10-20"), ate: null },
  ]; }
  it("inclui custos pontuais anteriores e do retorno, excluindo a fronteira Reprodução", () => {
    const dados = entrada([...material("100.00", { data: "2026-10-14" }), ...material("900.00", { id: "r", movimentoEstoqueId: "r", data: "2026-10-15" }), ...material("50.00", { id: "l2", movimentoEstoqueId: "l2", data: "2026-10-20" })], 100);
    dados.finalidades = alternado();
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { totalConhecido: "150.00" }, custoPorLitro: "1.50" });
  });
  it("não inventa rateio para consumo agregado que atravessa a mudança", () => {
    const dados = entrada(material("900.00", { tipo: "NUTRICAO", periodoConsumo: periodo })); dados.finalidades = alternado();
    expect(calcularCustosLeite(dados).consolidado).toMatchObject({ custos: { totalConhecido: null }, custoPorLitro: null, motivos: expect.arrayContaining(["PERIODO_FINALIDADE_SEM_RATEIO"]) });
  });
  it("reaproveita parcelas temporais separadas e mantém pendência em lacunas", () => {
    const dados = entrada([...material("100.00", { tipo: "NUTRICAO", data: "2026-10-14", periodoConsumo: { inicio: "2026-10-01", fim: "2026-10-14" } }), ...material("900.00", { id: "r", tipo: "NUTRICAO", movimentoEstoqueId: "r", periodoConsumo: { inicio: "2026-10-15", fim: "2026-10-19" } })], 100);
    dados.finalidades = alternado();
    expect(calcularCustosLeite(dados).consolidado.custoPorLitro).toBe("1.00");
    dados.finalidades = [];
    expect(calcularCustosLeite(dados).consolidado.motivos).toContain("FINALIDADE_CUSTO_PENDENTE");
    expect(calcularCustosLeite(dados).consolidado.custoPorLitro).toBeNull();
  });
});

it("custo no próprio dia da baixa continua no período Leite comprovado", () => {
  const dados = entrada(material("20.00", { data: "2026-10-15" }), 10);
  dados.finalidades = [{ id: "leite", animalId: "vaca-a", aptidao: "LEITE", desde: new Date("2020-01-01"), ate: new Date("2026-10-15") }];
  dados.baixas = [{ id: "baixa", animalId: "vaca-a", destinoFechadoId: "leite", data: new Date("2026-10-15") }];
  expect(calcularCustosLeite(dados).consolidado.custoPorLitro).toBe("2.00");
});
