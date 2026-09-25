import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  criarOperacao: vi.fn(), liquidarCompromisso: vi.fn(), transferir: vi.fn(), criarTransacaoAvulsa: vi.fn(),
  confirmarRascunho: vi.fn(), salvarRascunho: vi.fn(),
}));
vi.mock("../services/financeiro/operacoes.js", () => ({
  criarOperacao: mocks.criarOperacao, liquidarCompromisso: mocks.liquidarCompromisso,
  criarTransferencia: mocks.transferir, criarTransacaoAvulsa: mocks.criarTransacaoAvulsa,
}));
vi.mock("../services/financeiro/rascunhos.js", () => ({ confirmarRascunho: mocks.confirmarRascunho, salvarRascunho: mocks.salvarRascunho }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: vi.fn().mockResolvedValue(1), resolverEscopoEscrita: vi.fn().mockResolvedValue(1) }));

import { financeiroRouter } from "./financeiro.js";
import { uid } from "../lib/uid.fixture.js";

const base = { id: 7, nome: "Contador", email: "c@x", papel: "contador", abas: [], areas: ["financeiro"], status: "ATIVO", dono: false };
const appCom = (usuario: unknown) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, usuario as never); await next(); }).route("/", financeiroRouter);
const json = { "content-type": "application/json" };

// Toda escrita com efeito financeiro/físico exige a flag `lancar` (o gate de
// área financeiro não basta). O rascunho continua livre: não tem efeito.
const escritas: [string, string, unknown][] = [
  ["criar operação", "/financeiro/operacoes", { tipo: "SERVICO", data: "2026-09-10", descricao: "Serviço", valorTotal: 10, parceiroId: uid(1), financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } }],
  ["confirmar rascunho", "/financeiro/operacoes/rascunho/confirmacao", {}],
  ["anexar documento em operação", `/financeiro/operacoes/${uid(5)}/documentos/intencao`, { nome: "nota.pdf", mimeType: "application/pdf", tamanhoBytes: 10, tipo: "NOTA_FISCAL" }],
  ["liquidar compromisso", `/financeiro/compromissos/${uid(3)}/liquidacoes`, { contaId: uid(1), valor: 10, data: "2026-09-10" }],
  ["transferir", "/financeiro/transferencias", { contaOrigemId: uid(1), contaDestinoId: uid(2), valor: 10, data: "2026-09-10" }],
  ["transação avulsa", "/financeiro/transacoes", { tipo: "APORTE", contaId: uid(1), valor: 10, data: "2026-09-10" }],
];

describe("escritas financeiras sem a flag lancar", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(escritas)("%s → 403, sem chamar o serviço", async (_nome, rota, corpo) => {
    const r = await appCom({ ...base, flags: ["verValores"] }).request(rota, { method: "POST", headers: json, body: JSON.stringify(corpo) });
    expect(r.status).toBe(403);
    for (const svc of Object.values(mocks)) expect(svc).not.toHaveBeenCalled();
  });

  it("criar operação com a flag passa do gate", async () => {
    mocks.criarOperacao.mockResolvedValue({ id: 1 });
    const r = await appCom({ ...base, flags: ["lancar"] }).request("/financeiro/operacoes", { method: "POST", headers: json, body: JSON.stringify(escritas[0][2]) });
    expect(r.status).toBe(201);
    expect(mocks.criarOperacao).toHaveBeenCalled();
  });
});
