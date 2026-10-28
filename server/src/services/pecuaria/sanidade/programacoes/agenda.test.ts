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
  it("usa a data adiada da regra ou programação como dia operacional em todos os filtros", async () => {
    mock.query.mockClear();mock.transaction.mockResolvedValue([[],[{total:0n}]]);
    await consultarAgendaUnificada(consultaAgendaUnificadaSchema.parse({de:"2030-11-01",ate:"2030-11-30"}),9,new Date("2030-11-10T12:00:00Z"));
    const sql=mock.query.mock.calls[0][0];
    expect(sql.text).toContain('LEFT JOIN pecuaria."NecessidadeSanitaria" ns ON ns."alertaId"=a.id');
    expect(sql.text).toContain(`CASE WHEN a.situacao='ADIADO' THEN 'DIA' ELSE COALESCE(a.resumo->>'precisao','DIA') END AS precisao`);
    const dataAdiada='COALESCE(ns."dataAtencao",a."prazo")';
    // Referência, início e fim da janela devem acompanhar o mesmo dia operacional.
    expect(sql.text).toContain(`THEN ${dataAdiada} ELSE a."dataReferencia" END AS "dataReferencia"`);
    expect(sql.text).toContain(`WHEN a.situacao='ADIADO' THEN ${dataAdiada} ELSE COALESCE(a."dataReferencia", NULLIF(a.resumo->>'inicioJanela','')::date) END AS "inicioJanela"`);
    expect(sql.text).toContain(`WHEN a.situacao='ADIADO' THEN ${dataAdiada} ELSE COALESCE(a."dataReferencia", NULLIF(a.resumo->>'fimJanela','')::date) END AS "fimJanela"`);
    expect(sql.text).toContain("THEN 'ATRASADO' ELSE 'PENDENTE' END ELSE a.situacao END AS situacao");
    expect(sql.values).toContainEqual(new Date("2030-11-10T00:00:00Z"));
  });
});
