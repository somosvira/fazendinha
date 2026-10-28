import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock("../../../../db.js", () => ({ prisma: { $queryRaw: mock.query, $transaction: mock.transaction } }));
import { consultarAgendaUnificada, consultaAgendaUnificadaSchema } from "./agenda.js";
describe("contexto da agenda unificada", () => {
  it("projeta datas nulas para conferência, revisão e dados insuficientes sem mudar o fato", async () => {
    mock.query.mockClear();mock.transaction.mockResolvedValue([[],[{total:0n}]]);
    await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({de:"2030-02-01",ate:"2030-02-28"}),7);
    const sql=mock.query.mock.calls[0][0].text as string;
    const condicao="a.situacao IN ('CONFERENCIA_INICIAL','NECESSITA_REVISAO','DADOS_INSUFICIENTES') THEN NULL";
    expect(sql.split(condicao)).toHaveLength(4);
    expect(sql).toContain('OR "fimJanela" IS NULL');expect(sql).toContain('OR "inicioJanela" IS NULL');
    expect(sql).not.toMatch(/UPDATE|INSERT|DELETE/);
  });
  it("conserva sítio factual e participação da tarefa no consolidado", async () => {
    const item = { id:"tarefa:t", origem:"TAREFA", origemId:"t", alertaId:"a", propriedadeId:7, participacaoId:"p", animalId:"animal", brinco:"Fictício", nome:null, titulo:"Conferir", situacao:"SEM_REGISTRO", dataReferencia:null, precisao:"DIA", inicioJanela:null, fimJanela:null };
    mock.transaction.mockResolvedValue([[item],[{total:1n}]]);
    const r=await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({}),null);
    expect(r.itens[0]).toMatchObject({propriedadeId:7,participacaoId:"p",alertaId:"a"});
    const sql=mock.query.mock.calls[0][0].text as string;
    expect(sql).toContain('p."propriedadeId", p.id AS "participacaoId"');
    expect(sql).toContain('a."propriedadeId", NULL::text AS "participacaoId"');
    expect(sql).toContain('"propriedadeId","participacaoId"');
  });
  it("filtra sítio corrente sem substituí-lo pelo sítio factual retornado", async () => {
    mock.query.mockClear();mock.transaction.mockResolvedValue([[],[{total:0n}]]);
    await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({}),9);
    const sql=mock.query.mock.calls[0][0];
    expect(sql.text).toMatch(/"propriedadeAtualId"=\$\d+/);
    expect(sql.values).toContain(9);
  });
});
