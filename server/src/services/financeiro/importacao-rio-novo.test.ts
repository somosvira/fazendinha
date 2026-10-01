import { describe, expect, it } from "vitest";
import {
  planejarImportacaoRioNovo,
  type ArtefatoRioNovo,
  type EventoOperacao,
  type LinhaRioNovo,
} from "./importacao-rio-novo.js";

function linha(indiceCache: number, parcial: Partial<LinhaRioNovo> = {}): LinhaRioNovo {
  return {
    indiceCache,
    hashLinha: indiceCache.toString(16).padStart(64, "0"),
    competencia: "2025-01-02",
    vencimento: "2025-01-10",
    liquidacao: "2025-01-11",
    tipoLancamento: "FaturaPagar",
    natureza: "DEBITO",
    situacao: "LIQUIDADO",
    valorOriginal: "100.00",
    valorRealizado: "100.00",
    valorRelatorio: "100.00",
    estorno: false,
    fonte: "RIO NOVO",
    fonteLinha: "RIO NOVO",
    descricao: "Pagto. Doc-Parcela: 123-01/1 para Fornecedor",
    detalhes: null,
    parceiro: "Fornecedor",
    conta: "BB MAGC",
    numeroDocumento: "123",
    numeroParcela: 1,
    meioPagamento: "Boleto",
    grupoCategoriaBruto: "Criação Animal",
    categoriaBruta: "Ração",
    centroCusto: "Atividade Leiteira",
    grupoCategoria: "Criação Animal",
    categoria: "Ração",
    origem: { "*Fonte": "RIO NOVO" },
    ...parcial,
  };
}

function artefato(linhas: LinhaRioNovo[]): ArtefatoRioNovo {
  return {
    versaoFormato: 1,
    arquivo: "fonte.xlsx",
    sha256: "a".repeat(64),
    fonte: "RIO NOVO",
    extraidoEm: "2026-10-01T00:00:00.000Z",
    cache: {
      definicao: "definition3.xml",
      registros: "records3.xml",
      quantidadeTotal: linhas.length,
      quantidadeFonte: linhas.length,
      quantidadeCampos: 32,
      campos: ["*Fonte"],
      atualizadoPor: null,
      atualizadoEm: null,
      dataMinima: "2025-01-02",
      dataMaxima: "2025-01-11",
    },
    linhas,
  };
}

describe("planejarImportacaoRioNovo", () => {
  it("usa o valor efetivamente pago e preserva o valor original da fonte", () => {
    const plano = planejarImportacaoRioNovo(artefato([linha(1, { valorOriginal: "120.00", valorRealizado: "100.00" })]));
    const evento = plano.eventos[0] as EventoOperacao;
    expect(evento).toMatchObject({ rota: "OPERACAO", tipo: "COMPRA_CONSUMO_DIRETO", valor: "100.00", valorOriginalFonte: "120.00" });
    expect(plano.resumo.porStatus.REJEITADA).toBe(0);
  });

  it("exclui PROJ e exige confirmação da fonte mais recente para títulos abertos", () => {
    const proj = linha(1, { situacao: "ABERTO", liquidacao: null, valorRealizado: null, numeroDocumento: "PROJ" });
    const aberto = linha(2, { situacao: "ABERTO", liquidacao: null, valorRealizado: null });
    const plano = planejarImportacaoRioNovo(artefato([proj, aberto]));
    expect(plano.decisoes).toEqual([
      expect.objectContaining({ indiceCache: 1, status: "IGNORADA", rota: "PROJECAO" }),
      expect.objectContaining({ indiceCache: 2, status: "IGNORADA" }),
    ]);
    expect(() => planejarImportacaoRioNovo(artefato([aberto]), { incluirAbertos: true })).toThrow(/fonte mais recente/);
    expect(planejarImportacaoRioNovo(artefato([aberto]), { incluirAbertos: true, fonteMaisRecenteConfirmada: true }).eventos).toHaveLength(1);
  });

  it("agrupa as duas pontas de uma transferência sem gerar receita ou despesa", () => {
    const descricao = 'Transferência: De "BB MAGC" - Para "BB MAGC CDB"';
    const credito = linha(1, { tipoLancamento: "Transferencia", natureza: "CREDITO", conta: "BB MAGC CDB", categoriaBruta: "Transferência", categoria: null, descricao });
    const debito = linha(2, { tipoLancamento: "Transferencia", natureza: "DEBITO", conta: "BB MAGC", categoriaBruta: "Transferência", categoria: null, descricao });
    const plano = planejarImportacaoRioNovo(artefato([credito, debito]));
    expect(plano.eventos).toEqual([expect.objectContaining({ rota: "TRANSFERENCIA", contaOrigem: "BB MAGC", contaDestino: "BB MAGC CDB", linhas: [2, 1] })]);
    expect(plano.resumo.valorEntradas).toBe("0.00");
    expect(plano.resumo.valorSaidas).toBe("0.00");
  });

  it("pareia estorno por campos estruturados mesmo quando a descrição foi truncada", () => {
    const original = linha(1, { estorno: true, natureza: "DEBITO", descricao: "Pagto. Doc-Parcela: 123 para Fornecedor Ltda" });
    const reversao = linha(2, { estorno: true, natureza: "CREDITO", descricao: "Estorno: Pagto. Doc-Parcela: 123 para Fornecedor L" });
    const plano = planejarImportacaoRioNovo(artefato([original, reversao]));
    expect(plano.eventos).toEqual([expect.objectContaining({ rota: "OPERACAO", estornado: true, linhas: [1, 2] })]);
    expect(plano.decisoes.map((decisao) => decisao.status)).toEqual(["PRONTA", "AGRUPADA"]);
  });

  it("mantém categoria desconhecida em revisão sem descartar a linha", () => {
    const plano = planejarImportacaoRioNovo(artefato([linha(1, { categoriaBruta: "Categoria futura", categoria: "Categoria futura" })]));
    expect(plano.eventos).toHaveLength(0);
    expect(plano.decisoes[0]).toMatchObject({ status: "REVISAO", motivo: "Categoria sem roteamento seguro: Categoria futura" });
  });
});
