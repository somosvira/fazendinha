import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ programas: vi.fn(), produtos: vi.fn(), necessidades: vi.fn(), necessidadesRegra: vi.fn() }));
vi.mock("../../../../db.js", () => ({ prisma: { programacaoSanitaria: { findMany: mocks.programas }, produto: { findMany: mocks.produtos }, necessidadeProgramacaoSanitaria: { findMany: mocks.necessidades }, necessidadeSanitaria: { findMany: mocks.necessidadesRegra } } }));
import { consultarProgramacoes, pendenciasAtivacao } from "./consulta.js";
import { consultaProgramacoesSchema } from "./schemas.js";
const p = { id: "p", propriedadeId: 7, nome: "Fictícia", tipo: "VACINACAO", meses: [1,2], ano: null, vigenciaInicio: null, vigenciaFim: null, precisao: "MES", dia: null, recorrencia: "JANELA_ELEGIBILIDADE", produtoId: null, procedimento: "Conferir atividade", publico: {}, publicoConferido: false, fonte: null, observacao: null, executor: null, tipoExameId: null, sujeitoTipo: "ANIMAL", antecedenciaDias: 0, ativo: false, revisao: 1, ativadoEm: null, criadoPorId: 1, regraEquivalenteId: null, criadoEm: new Date(), atualizadoEm: new Date() };
beforeEach(() => { vi.clearAllMocks(); mocks.programas.mockResolvedValue([p]); mocks.produtos.mockResolvedValue([]); mocks.necessidades.mockResolvedValue([]); mocks.necessidadesRegra.mockResolvedValue([]); });
describe("consulta planejamento mensal/anual", () => {
  it("mês e anual conservam evento e não preenchem atendimentos ausentes", async () => {
    const anual = await consultarProgramacoes(consultaProgramacoesSchema.parse({ ano: 2031 }), 7);
    const mensal = await consultarProgramacoes(consultaProgramacoesSchema.parse({ ano: 2031, mes: 2 }), 7);
    expect(anual.meses).toHaveLength(12); expect(mensal.itens[0]).toEqual(anual.meses[1].eventos[0]);
    expect(mensal.itens[0]).toMatchObject({ dia: null, ativo: false, previstos: 0, atendidos: 0, pendentes: 0 });
    expect(mocks.programas).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7 } }));
  });
  it("conta participantes antes da paginação e realização parcial conserva pendência", async () => {
    mocks.necessidades.mockResolvedValue(Array.from({ length: 561 }, (_, i) => ({ programacaoId: "p", periodo: "ELEGIBILIDADE", situacao: i === 0 ? "REALIZADO" : "PENDENTE" })));
    const r = await consultarProgramacoes(consultaProgramacoesSchema.parse({ ano: 2031, tamanho: 1 }), 7);
    expect(r.total).toBe(2); expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({ previstos: 561, atendidos: 1, pendentes: 560 });
    expect(r.meses[1].eventos[0]).toMatchObject({ previstos: 561, atendidos: 1, pendentes: 560 });
  });
  it("não declara executor inexistente ou conferência pendente habilitados", () => {
    expect(pendenciasAtivacao({ ...p, sujeitoTipo: "SITIO" })).toContain("Executor de verificação por lote/sítio ainda indisponível");
    expect(pendenciasAtivacao(p)).toContain("Conferir critérios factuais do público");
  });
  it("mantém encerrados no total previsto e histórico sem contar como atendimento ou pendência", async () => {
    mocks.necessidades.mockResolvedValue(["REALIZADO", "DISPENSADO", "ENCERRADO", "INVALIDADO", "NECESSITA_REVISAO", "PENDENTE"].map(situacao => ({ programacaoId: "p", periodo: "ELEGIBILIDADE", situacao })));
    const r = await consultarProgramacoes(consultaProgramacoesSchema.parse({ ano: 2031 }), 7);
    expect(r.itens[0]).toMatchObject({ previstos: 6, atendidos: 1, pendentes: 2 });
  });
  it("usa encerramento da regra equivalente sem perpetuar a pendência copiada na programação", async () => {
    mocks.necessidades.mockResolvedValue([{ programacaoId: "p", periodo: "ELEGIBILIDADE", situacao: "PENDENTE", regraNecessidadeId: "necessidade-regra" }]);
    mocks.necessidadesRegra.mockResolvedValue([{ id: "necessidade-regra", situacao: "ENCERRADO" }]);
    const r = await consultarProgramacoes(consultaProgramacoesSchema.parse({ ano: 2031 }), 7);
    expect(r.itens[0]).toMatchObject({ previstos: 1, atendidos: 0, pendentes: 0 });
  });
});
