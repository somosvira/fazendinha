import type { ResumoGerencial } from "./api";

export const blocoRestrito = { estado: "RESTRITO" as const, motivo: "Sem permissão monetária" };

export function resumoGerencial(): ResumoGerencial {
  return {
    versao: "GERENCIAL_V1",
    corte: "2026-10-17T12:00:00Z",
    periodo: { inicio: "2026-10-01", fim: "2026-10-17" },
    escopo: { propriedadeId: 1, sitios: [{ id: 1, nome: "Sítio A" }, { id: 2, nome: "Sítio B" }] },
    avisos: [],
    caixa: { estado: "DISPONIVEL", dados: {
      entradas: "10.00", saidas: "10.00", resultado: "0.00", metodologia: "Movimentos confirmados.",
      mensal: [{ mes: "2026-10", entradas: "10.00", saidas: "10.00", resultado: "0.00", incompleto: false }],
      centros: [
        { id: "cc-1", nome: "Centro aberto A", entradas: "10.00", saidas: "4.00", resultado: "6.00" },
        { id: "cc-2", nome: "Centro aberto B", entradas: "0.00", saidas: "6.00", resultado: "-6.00" },
      ],
      fontes: [
        { contaId: "conta-1", movimentoId: "mov-1", propriedadeId: 1, transacaoId: "trans-1", operacaoId: null, data: "2026-10-03", campo: "entradas", valor: "5.00" },
        { contaId: "conta-1", movimentoId: "mov-2", propriedadeId: 1, transacaoId: "trans-1", operacaoId: null, data: "2026-10-03", campo: "entradas", valor: "5.00" },
        { contaId: "conta-1", movimentoId: "mov-3", propriedadeId: 1, transacaoId: "trans-2", operacaoId: null, data: "2026-10-04", campo: "saidas", valor: "10.00" },
      ],
    } },
    estoque: { estado: "DISPONIVEL", dados: {
      data: "2026-10-16", valorConhecido: "30.00", gruposPendentes: 0, metodologia: "Saldos conhecidos.",
      itens: [
        { produtoId: "produto-1", produto: "Sal mineral", unidade: "KG", propriedadeId: 1, partidaId: "lote-1", quantidade: "1.000", quantidadeValorizada: "1.000", valor: "10.00", bases: [] },
        { produtoId: "produto-1", produto: "Sal mineral", unidade: "KG", propriedadeId: 2, partidaId: "lote-2", quantidade: "1.000", quantidadeValorizada: "1.000", valor: "10.00", bases: [] },
        { produtoId: "produto-2", produto: "Ração", unidade: "KG", propriedadeId: 1, partidaId: null, quantidade: "1.000", quantidadeValorizada: "1.000", valor: "10.00", bases: [] },
      ],
    } },
    nutricao: { estado: "DISPONIVEL", dados: {
      rebanho: { animalDias: 3489, populacaoMedia: "112.5", custoConhecido: "5.00", porDia: "0.0014", porPeriodo: "0.0444", parcial: true },
      vacas: { animalDias: 0, populacaoMedia: "0", custoConhecido: null, porDia: null, porPeriodo: null, parcial: true },
      metodologia: "Rateio por presença comprovada.",
      cobertura: { animalDias: 3489, diasAlimentados: 166, diasClassificados: 3489, itensComCusto: 1, itensPendentes: 0, quantidades: [] },
      lacunas: [{ fechamentoId: "fech-1", motivo: "Lacuna histórica de classificação" }],
      fontes: [{ fechamentoId: "fech-1", participacaoId: "part-1", itemId: "item-1", animalId: "animal-1", propriedadeId: 1, centroCustoId: "cc-1", centroCustoNome: "Nutrição", finalidade: "SANIDADE", unidade: "KG", quantidade: "1", custoConhecido: "5.00", custoVacas: null, movimentoEstoqueId: null, prova: "CONCILIADO" }],
    } },
    custos: { estado: "DISPONIVEL", dados: {
      lacunasNutricao: 1, totalConhecido: "5.00", componentesPendentes: 0, cobertura: "PARCIAL", limitacoes: [],
      finalidades: [
        { finalidade: "REPRODUCAO", totalConhecido: "0.00", componentesPendentes: 0 },
        { finalidade: "SANIDADE", totalConhecido: null, componentesPendentes: 1 },
        { finalidade: "ROTINA", totalConhecido: "0.00", componentesPendentes: 0 },
        { finalidade: "SEM_CLASSIFICACAO", totalConhecido: "0.00", componentesPendentes: 0 },
      ],
      componentes: [{ propriedadeId: 1, chave: "EXAME:exame-1", fonteId: "exame-1", animalId: "animal-1", tipoFonte: "EXAME", data: "2026-10-06", descricao: "Exame reprodutivo", finalidade: "REPRODUCAO", natureza: "SERVICO", estado: "CONHECIDO", valor: "5.00", origemId: "origem-1" }],
    } },
    clinico: { estado: "DISPONIVEL", dados: { data: "2026-10-17", acompanhamentosPendentes: 2 } },
  };
}

export function resumoRestrito(): ResumoGerencial {
  const resumo = resumoGerencial();
  return {
    ...resumo,
    caixa: blocoRestrito,
    estoque: blocoRestrito,
    nutricao: blocoRestrito,
    custos: blocoRestrito,
  };
}
