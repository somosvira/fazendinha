import { describe, expect, it } from "vitest";
import {
  calcularContextoAnimalNaData, dataCalendarioContexto, diasCalendarioContexto,
  type HistoricoContextoAnimal, type LactacaoContexto, type PartoContexto,
  type TentativaContexto, type GestacaoContexto,
} from "./contexto-animal.calc.js";

const dia = (data: string) => new Date(`${data}T00:00:00Z`);
const animalId = "matriz";
const historico = (dados: Partial<HistoricoContextoAnimal> = {}): HistoricoContextoAnimal => ({
  animal: { id: animalId, dataEntrada: dia("2023-01-01"), partosAntesDaEntrada: 0 },
  partos: [], tentativas: [], lactacoes: [], gestacoes: [], localizacoes: [], avaliacoes: [], iniciais: [], ...dados,
});
const lactacao = (dados: Partial<LactacaoContexto> = {}): LactacaoContexto => ({
  id: "lactacao", animalId, propriedadeId: 1, partoId: null,
  inicio: dia("2026-01-01"), encerradaEm: null, origem: "HISTORICO_IMPORTADO", ...dados,
});
const parto = (dados: Partial<PartoContexto> = {}): PartoContexto => ({
  id: "parto", animalId, propriedadeId: 1, data: dia("2026-01-01"), tipo: "NORMAL",
  status: "VALIDO", incluidoSaldoAnterior: false, ...dados,
});
const tentativa = (dados: Partial<TentativaContexto> = {}): TentativaContexto => ({
  id: "tentativa", animalId, propriedadeId: 1, data: dia("2026-02-01"), tipo: "IA",
  status: "VALIDO", ciclo: 1, ordem: 1, criadoEm: dia("2026-02-01"), ...dados,
});
const gestacao = (dados: Partial<GestacaoContexto> = {}): GestacaoContexto => ({
  id: "gestacao", animalId, propriedadeId: 1, tentativaId: "tentativa", confirmadaEm: dia("2026-03-01"),
  encerradaEm: null, status: "VALIDO", ...dados,
});

describe("contexto produtivo por dias de calendário", () => {
  it("usa D0, atravessa mês/ano e ano bissexto sem depender do fuso do processo", () => {
    const anterior = process.env.TZ;
    try {
      for (const fuso of ["America/Sao_Paulo", "Pacific/Auckland", "UTC"]) {
        process.env.TZ = fuso;
        expect(diasCalendarioContexto(dia("2024-02-28"), dia("2024-03-01"))).toBe(2);
        expect(diasCalendarioContexto(dia("2025-12-31"), dia("2026-01-01"))).toBe(1);
        expect(diasCalendarioContexto(dia("2018-11-03"), dia("2018-11-05"))).toBe(2);
        expect(calcularContextoAnimalNaData(historico({ lactacoes: [lactacao()] }), dia("2026-01-01")).del).toBe(0);
      }
    } finally {
      if (anterior === undefined) delete process.env.TZ;
      else process.env.TZ = anterior;
    }
  });

  it("não transforma histórico ausente, paridade zero ou situação clínica apta em seca/DEL zero", () => {
    const contexto = calcularContextoAnimalNaData(historico({
      iniciais: [{ animalId, data: dia("2026-01-01"), status: "VALIDO", situacao: "APTA" }],
    }), dia("2026-01-10"));
    expect(contexto).toMatchObject({ situacaoProdutiva: "NAO_INFORMADA", del: null, lactacaoVigente: null, evidenciaSituacaoProdutiva: null, partosRealizados: 0 });
  });

  it("aceita lactação histórica sem fabricar parto e não antecipa encerramento futuro", () => {
    const dados = historico({ lactacoes: [lactacao({ encerradaEm: dia("2026-01-11") })] });
    expect(calcularContextoAnimalNaData(dados, dia("2025-12-31"))).toMatchObject({ situacaoProdutiva: "NAO_INFORMADA", del: null });
    expect(calcularContextoAnimalNaData(dados, dia("2026-01-10"))).toMatchObject({ situacaoProdutiva: "LACTANTE", del: 9, diasPosParto: null, ultimoParto: null, ultimaLactacaoEncerrada: null });
    expect(calcularContextoAnimalNaData(dados, dia("2026-01-11"))).toMatchObject({
      situacaoProdutiva: "SECA", del: null, lactacaoVigente: null,
      evidenciaSituacaoProdutiva: { tipo: "ENCERRAMENTO_LACTACAO", lactacaoId: "lactacao", data: "2026-01-11" },
      ultimaLactacaoEncerrada: { duracaoDias: 10 },
    });
  });

  it("lactação iniciada e encerrada no mesmo dia tem duração zero e dia final seco", () => {
    expect(calcularContextoAnimalNaData(historico({ lactacoes: [lactacao({ encerradaEm: dia("2026-01-01") })] }), dia("2026-01-01")))
      .toMatchObject({ situacaoProdutiva: "SECA", del: null, ultimaLactacaoEncerrada: { duracaoDias: 0 } });
  });

  it("não carrega secagem antiga através de parto posterior com lactação desconhecida", () => {
    const dados = historico({ lactacoes: [lactacao({ encerradaEm: dia("2026-01-10") })], partos: [parto({ data: dia("2026-02-01") })] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-02-02"))).toMatchObject({
      situacaoProdutiva: "NAO_INFORMADA", del: null, diasPosParto: 1, ultimaLactacaoEncerrada: { duracaoDias: 9 },
    });
  });

  it("a nova lactação vence a secagem antiga e DEL difere dos dias pós-parto", () => {
    const dados = historico({
      lactacoes: [lactacao({ id: "anterior", encerradaEm: dia("2026-01-10") }), lactacao({ inicio: dia("2026-02-03"), partoId: "parto" })],
      partos: [parto({ data: dia("2026-02-01") })],
    });
    expect(calcularContextoAnimalNaData(dados, dia("2026-02-10"))).toMatchObject({ situacaoProdutiva: "LACTANTE", del: 7, diasPosParto: 9 });
  });

  it("expõe sobreposição e vínculo inválido sem escolher DEL arbitrário", () => {
    const dados = historico({ lactacoes: [lactacao(), lactacao({ id: "duplicada" })] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-01-10"))).toMatchObject({
      situacaoProdutiva: "NAO_INFORMADA", del: null, lactacaoVigente: null, pendencias: ["LACTACOES_SOBREPOSTAS"],
    });
    const invalido = calcularContextoAnimalNaData(historico({ lactacoes: [lactacao({ partoId: "parto" })], partos: [parto({ status: "ANULADO" })] }), dia("2026-01-10"));
    expect(invalido.situacaoProdutiva).toBe("NAO_INFORMADA");
    expect(invalido.del).toBeNull();
    expect(invalido.pendencias).toContain("LACTACAO_COM_PARTO_INVALIDO");
  });

  it("seleciona a lactação histórica vigente em vez da lactação mais nova", () => {
    const dados = historico({ lactacoes: [lactacao({ id: "futura", inicio: dia("2026-05-01") }), lactacao({ id: "historica", encerradaEm: dia("2026-02-01") })] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-01-10"))).toMatchObject({ lactacaoVigente: { id: "historica" }, del: 9 });
  });
});

describe("fatos reprodutivos, paridade e evidência", () => {
  it("separa confirmação da idade pela tentativa comprovada sem selecionar a tentativa mais recente", () => {
    const dados = historico({
      tentativas: [tentativa(), tentativa({ id: "mais-recente", data: dia("2026-02-20"), ordem: 2 })], gestacoes: [gestacao()],
    });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-10"))).toMatchObject({
      diasDesdeConfirmacao: 9, idadeGestacionalDias: 37, diasDesdeTentativa: 18, diasDesdeTentativaGestacao: 37,
      baseIdadeGestacional: { tentativaId: "tentativa", data: "2026-02-01" }, situacaoReprodutiva: "GESTANTE",
    });
  });

  it("origem desconhecida não usa outra tentativa, nem a data da confirmação para idade gestacional", () => {
    expect(calcularContextoAnimalNaData(historico({ tentativas: [tentativa()], gestacoes: [gestacao({ tentativaId: null })] }), dia("2026-03-10")))
      .toMatchObject({ diasDesdeConfirmacao: 9, idadeGestacionalDias: null, baseIdadeGestacional: null, diasDesdeTentativaGestacao: null });
  });

  it("TE preserva dias desde transferência e não presume idade embrionária", () => {
    expect(calcularContextoAnimalNaData(historico({ tentativas: [tentativa({ tipo: "TE" })], gestacoes: [gestacao()] }), dia("2026-03-10")))
      .toMatchObject({ idadeGestacionalDias: null, diasDesdeTentativaGestacao: 37, baseIdadeGestacional: { tipoTentativa: "TE" }, pendencias: ["IDADE_EMBRIONARIA_TE_NAO_INFORMADA"] });
  });

  it("tentativa anulada/regularização não comprova idade da gestação", () => {
    expect(calcularContextoAnimalNaData(historico({ tentativas: [tentativa({ status: "ANULADO" })], gestacoes: [gestacao()] }), dia("2026-03-10")))
      .toMatchObject({ ultimaTentativa: null, tentativasCiclo: 0, idadeGestacionalDias: null, pendencias: ["VINCULO_GESTACAO_SEM_TENTATIVA_VALIDA"] });
  });

  it("não consulta o futuro e encerra a gestação na data factual sem antecipar o encerramento", () => {
    const dados = historico({ tentativas: [tentativa()], gestacoes: [gestacao({ encerradaEm: dia("2026-03-15") })] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-02-28"))).toMatchObject({ gestacaoVigente: null, diasDesdeConfirmacao: null, idadeGestacionalDias: null });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-14"))).toMatchObject({ gestacaoVigente: { id: "gestacao" }, diasDesdeConfirmacao: 13 });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-15"))).toMatchObject({ gestacaoVigente: null, idadeGestacionalDias: null, situacaoReprodutiva: "VAZIA" });
  });

  it("mantém paridade real durante gestação e inclui aborto/natimorto sem dobrar o saldo de entrada", () => {
    const dados = historico({
      animal: { id: animalId, dataEntrada: dia("2025-01-01"), partosAntesDaEntrada: 2 },
      partos: [parto({ id: "saldo", incluidoSaldoAnterior: true, data: dia("2024-01-01") }), parto({ id: "aborto", tipo: "ABORTO" }), parto({ id: "natimorto", tipo: "NATIMORTO", data: dia("2026-01-10") }), parto({ id: "anulado", status: "ANULADO" }), parto({ id: "futuro", data: dia("2026-06-01") })],
      tentativas: [tentativa()], gestacoes: [gestacao()],
    });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-10"))).toMatchObject({ partosRealizados: 4, partosRegistrados: 3, ultimoParto: { id: "natimorto" } });
    expect(calcularContextoAnimalNaData(dados, dia("2024-06-01"))).toMatchObject({ partosRealizados: null, partosRegistrados: 1, pendencias: ["SALDO_PARTOS_SEM_DISTRIBUICAO_TEMPORAL"] });
  });

  it("parto retroativo reinicia ciclo; conserva ordem registrada e calcula a ordem corrente dos fatos", () => {
    const dados = historico({ partos: [parto({ tipo: "ABORTO", data: dia("2026-02-10") })], tentativas: [tentativa({ ordem: 1 }), tentativa({ id: "posterior", data: dia("2026-02-20"), ordem: 8 })] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-02-15"))).toMatchObject({ ultimaTentativa: { id: "tentativa" }, ultimaTentativaCiclo: null, diasDesdeTentativa: null, tentativasCiclo: 0, ordemNoCiclo: null });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-01"))).toMatchObject({ ultimaTentativaCiclo: { id: "posterior", ordem: 8 }, diasDesdeTentativa: 9, tentativasCiclo: 1, ordemNoCiclo: 1 });
  });

  it("localização por data conserva fatos clínicos do sítio anterior e detecta conflito", () => {
    const origem = { id: "origem", animalId, propriedadeId: 1, loteId: "lote-1", desde: dia("2023-01-01"), ate: dia("2026-03-05") };
    const destino = { id: "destino", animalId, propriedadeId: 2, loteId: "lote-2", desde: dia("2026-03-05"), ate: null };
    const dados = historico({ localizacoes: [origem, destino], tentativas: [tentativa()], gestacoes: [gestacao()], lactacoes: [lactacao()] });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-04"))).toMatchObject({ localizacaoNaData: { propriedadeId: 1 } });
    expect(calcularContextoAnimalNaData(dados, dia("2026-03-05"))).toMatchObject({ localizacaoNaData: { propriedadeId: 2 }, lactacaoVigente: { propriedadeId: 1 }, gestacaoVigente: { propriedadeId: 1 } });
    expect(calcularContextoAnimalNaData({ ...dados, localizacoes: [{ ...origem, ate: null }, destino] }, dia("2026-03-05")))
      .toMatchObject({ localizacaoNaData: null, pendencias: ["LOCALIZACOES_SOBREPOSTAS"] });
  });

  it("não mistura fatos de outro animal, nem avaliações anuladas e situações iniciais futuras", () => {
    expect(calcularContextoAnimalNaData(historico({
      lactacoes: [lactacao({ animalId: "outra" })], partos: [parto({ animalId: "outra" })],
      avaliacoes: [{ animalId, data: dia("2026-01-01"), resultado: "POSITIVO", status: "ANULADO" }],
      iniciais: [{ animalId, data: dia("2026-05-01"), situacao: "APTA", status: "VALIDO" }],
    }), dia("2026-03-01"))).toMatchObject({ situacaoProdutiva: "NAO_INFORMADA", situacaoReprodutiva: "DESCONHECIDA", ultimoParto: null });
  });

  it("rejeita data inválida antes de produzir contagens", () => {
    expect(() => dataCalendarioContexto(new Date("inválida"))).toThrow("Data de contexto inválida");
  });
});
