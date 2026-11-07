import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ transacao: vi.fn(), preparar: vi.fn(), auditar: vi.fn() }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("./execucao.js", () => ({ prepararExecucaoProtocoloTx: m.preparar, executarItensPreparadosProtocoloTx: vi.fn() }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: vi.fn(), auditar: m.auditar }));
import { revisarAutomacao } from "./automacao.js";
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
it("segundo editor não restaura dose anterior após revisão de outro usuário", async () => {
  const data = new Date("2026-11-05T11:00:00Z");
  let job = { id: id(9), revisao: 1, estado: "AGENDADA", programadaPara: data, configuracao: {} as unknown };
  const update = vi.fn(async ({ data: d }) => (job = { ...job, configuracao: d.configuracao, revisao: job.revisao + 1 }));
  const tx = { usuario: { findUnique: vi.fn(async () => ({ id: 1, dono: true, papel: "proprietario", status: "ATIVO", abas: [], flags: [] })) },
    participacaoProtocolo: { findFirst: vi.fn(async () => ({ id: id(1), animalId: id(3), propriedadeId: 1, protocolo: { tipo: "REPRODUTIVO" }, rodada: { status: "ABERTA" } })) },
    tarefaProtocolo: { findMany: vi.fn(async () => [{ id: id(4), previstaPara: data, precisaoTemporal: "HORA", etapa: { tipo: "APLICACAO" }, momentoSnapshot: { id: id(2), politicaExecucao: "AUTOMATICA_EXCECAO", horarioPadrao: "08:00", fusoHorario: "America/Sao_Paulo" } }]) },
    $queryRaw: vi.fn(), automacaoProtocolo: { findFirst: vi.fn(async () => job), update } };
  m.transacao.mockImplementation(fn => fn(tx));
  const input = { propriedadeId: 1, participacaoId: id(1), momentoId: id(2), revisaoEsperada: 1, motivo: "Corrigir dose conferida", itens: [{ tipo: "APLICACAO", tarefaId: id(4), animalId: id(3), propriedadeId: 1, data: "2026-11-05", nomeProdutoAplicado: "Produto", dose: "2", unidadeDose: "ML", origemInsumo: "SEM_ORIGEM_JUSTIFICADA" }] };
  await revisarAutomacao(id(9), input, 1);
  await expect(revisarAutomacao(id(9), { ...input, itens: [{ ...input.itens[0], dose: "1" }] }, 1)).rejects.toThrow("outra pessoa");
  expect(update).toHaveBeenCalledTimes(1);
  expect(job.configuracao).toMatchObject({ itens: [{ dose: "2" }] });
  expect(job.revisao).toBe(2);
});
