import { beforeEach, expect, it, vi } from "vitest";
import { criarProgramacao } from "./iatf.js";

const fx = vi.hoisted(() => ({ recibo: null as unknown, criarGrupo: vi.fn(), criarParticipacao: vi.fn(), criarTarefas: vi.fn(), disponibilidade: vi.fn(), auditar: vi.fn(), gravar: vi.fn(), tx: { protocolo: { findFirst: vi.fn() }, protocoloIatf: { findFirst: vi.fn() } } }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (fn: (tx: unknown) => unknown) => fn(fx.tx), timeoutTransacaoAnimais: () => 120000 }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: vi.fn(), auditar: fx.auditar }));
vi.mock("./registros.js", async original => ({ ...await original<typeof import("./registros.js")>(), conferirDisponibilidadeTx: fx.disponibilidade }));
vi.mock("../protocolos/reproducao.js", async original => ({ ...await original<typeof import("../protocolos/reproducao.js")>(), resolverIdReprodutivoTx: async (_tx: unknown, _tipo: unknown, id: string) => id, criarProgramacaoReprodutivaTx: fx.criarGrupo, criarParticipacaoReprodutivaTx: fx.criarParticipacao, criarTarefasReprodutivasTx: fx.criarTarefas }));
vi.mock("../protocolos/automacao.js", async original => ({ ...await original<typeof import("../protocolos/automacao.js")>(), ativarAutomacoesAdesaoTx: vi.fn() }));
vi.mock("../requisicoes.js", () => ({ recuperarRequisicaoTx: async () => fx.recibo ? { resultadoIds: fx.recibo } : null, guardarRequisicaoTx: async (_tx: unknown, _identidade: unknown, resultado: unknown) => { fx.recibo = resultado; fx.gravar(); } }));

beforeEach(() => { vi.clearAllMocks(); fx.recibo = null; fx.tx.protocolo.findFirst.mockResolvedValue({ id: "protocolo" }); fx.tx.protocoloIatf.findFirst.mockResolvedValue({ id: "protocolo", etapas: [] }); fx.criarGrupo.mockResolvedValue({ id: "grupo" }); fx.criarParticipacao.mockImplementation(async (_tx, input) => ({ id: input.data.animalId })); fx.criarTarefas.mockResolvedValue({ count: 0 }); fx.disponibilidade.mockResolvedValue(undefined); });

it("confirma 101 participantes uma vez e devolve o mesmo recibo no reenvio", async () => {
  const animais = Array.from({ length: 101 }, (_, i) => ({ animalId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
  const entrada = { chave: "00000000-0000-4000-8000-000000000998", propriedadeId: 1, protocoloId: "00000000-0000-4000-8000-000000000999", nome: "IATF", inicioPrevisto: "2026-01-10", animais };
  const primeira = await criarProgramacao(entrada, null);
  const segunda = await criarProgramacao(entrada, null);
  expect(segunda).toEqual(primeira);
  expect(fx.criarGrupo).toHaveBeenCalledTimes(1);
  expect(fx.criarParticipacao.mock.calls.map(([, dados]) => dados.data.animalId)).toEqual(animais.map(a => a.animalId));
  expect(fx.criarTarefas).toHaveBeenCalledTimes(101);
  expect(fx.gravar).toHaveBeenCalledTimes(1);
});

it("não aceita ciência quando a descrição ou o conjunto de motivos mudou", async () => {
  const { AvisoAptidaoProgramacao } = await import("./elegibilidade.js");
  const animalId = "00000000-0000-4000-8000-000000000001";
  fx.disponibilidade.mockRejectedValue(new AvisoAptidaoProgramacao("Novo motivo", ["NOVO_EXAME_APOS_TRATAMENTO"]));
  const entrada = { chave: "00000000-0000-4000-8000-000000000998", propriedadeId: 1, protocoloId: "00000000-0000-4000-8000-000000000999", nome: "IATF", inicioPrevisto: "2026-01-10", animais: [{ animalId }], cienciaMotivosAptidao: [{ animalId, descricao: "Motivo anterior", motivos: ["EXAME_APTIDAO_NECESSARIO"] }] };
  await expect(criarProgramacao(entrada, null)).rejects.toMatchObject({ code: "CONFLITO", campo: "cienciaMotivosAptidao" });
  expect(fx.criarParticipacao).not.toHaveBeenCalled();
  expect(fx.gravar).not.toHaveBeenCalled();
});
