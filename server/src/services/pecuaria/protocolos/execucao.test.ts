import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tarefas: vi.fn(), preparar: vi.fn(), criar: vi.fn(), origens: vi.fn(), animais: vi.fn(), consumos: vi.fn(), recuperar: vi.fn(), guardar: vi.fn(), reprodutiva: vi.fn() }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (fn: (tx: object) => Promise<unknown>) => fn({ tarefaProtocolo: { findMany: m.tarefas } }) }));
vi.mock("../sanidade/aplicacoes.js", () => ({ prepararAplicacaoTx: m.preparar, criarAplicacaoTx: m.criar, travarOrigensAplicacoesTx: m.origens }));
vi.mock("../sanidade/execucao-etapas.js", () => ({ conferirConsumosExecucaoTx: m.consumos }));
vi.mock("../reproducao/iatf.js", () => ({ prepararExecucaoTarefaTx: m.reprodutiva, executarTarefaTx: vi.fn() }));
vi.mock("../requisicoes.js", () => ({ recuperarRequisicaoTx: m.recuperar, guardarRequisicaoTx: m.guardar }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), travarAnimais: m.animais }));
import { preverExecucaoProtocolo, confirmarExecucaoProtocolo } from "./execucao.js";
const uid = (n: number) => `e1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = { tipo: "APLICACAO" as const, tarefaId: uid(1), animalId: uid(2), propriedadeId: 1, data: "2026-10-01", nomeProdutoAplicado: "Produto", dose: "2", unidadeDose: "ML" as const, origemInsumo: "BAIXA_ESTOQUE" as const };
const input = { versao: 1 as const, propriedadeId: 1, itens: [item] };
const tarefa = { id: item.tarefaId, etapaId: uid(3), execucaoId: uid(4), parametros: { tipo: "APLICACAO", dose: "2" }, momentoSnapshot: null, previstaPara: new Date("2026-10-01"), precisaoTemporal: "DIA", etapa: { tipo: "APLICACAO" }, execucao: { animalId: item.animalId, propriedadeId: 1, protocolo: { tipo: "SANITARIO", versao: 1 }, rodadaId: null, rodada: null, canceladaEm: null, inicioEfetivo: null } };
beforeEach(() => {
  vi.clearAllMocks();
  m.tarefas.mockResolvedValue([tarefa]);m.origens.mockResolvedValue(undefined);m.animais.mockResolvedValue(undefined);
  m.preparar.mockResolvedValue({ dadosCriacao: { dose: "2", estadoCarenciaLeite: "NAO_INFORMADO", estadoCarenciaCarne: "NAO_INFORMADO" }, desvioProtocoloSnapshot: { motivoObrigatorio: false, motivo: null, aferido: true, diferencas: [] } });
  m.consumos.mockResolvedValue([]);m.recuperar.mockResolvedValue(null);m.criar.mockResolvedValue({id:uid(5)});m.guardar.mockResolvedValue(undefined);
});
describe("limite transacional comum", () => {
  it("prévia usa preparação e nunca cria fatos ou requisição", async () => {
    const previa=await preverExecucaoProtocolo(input);
    expect(previa.tarefas.total).toBe(1);expect(previa.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(m.criar).not.toHaveBeenCalled();expect(m.guardar).not.toHaveBeenCalled();expect(m.recuperar).not.toHaveBeenCalled();
  });
  it("fingerprint cobre payload completo e snapshot da tarefa", async () => {
    const previa=await preverExecucaoProtocolo(input);
    expect((await preverExecucaoProtocolo({...input,itens:[{...item,responsavel:"Responsável alterado"}]})).fingerprint).not.toBe(previa.fingerprint);
    m.tarefas.mockResolvedValue([{...tarefa,parametros:{tipo:"APLICACAO",dose:"3"}}]);
    expect((await preverExecucaoProtocolo(input)).fingerprint).not.toBe(previa.fingerprint);
  });
  it("revalida fingerprint antes da primeira escrita", async () => {
    await expect(confirmarExecucaoProtocolo({execucao:input,chave:uid(6),fingerprint:"0".repeat(64)},7)).rejects.toMatchObject({code:"CONFLITO"});
    expect(m.criar).not.toHaveBeenCalled();expect(m.guardar).not.toHaveBeenCalled();
  });
  it("retry recupera somente recibo versionado sem preparar ou realizar novamente", async () => {
    m.recuperar.mockResolvedValue({resultadoIds:{versao:1,fatos:[{tarefaId:item.tarefaId,animalId:item.animalId,tipo:item.tipo,id:uid(5)}]}});
    const resultado=await confirmarExecucaoProtocolo({execucao:input,chave:uid(6),fingerprint:"0".repeat(64)},7);
    expect(resultado).toMatchObject({total:1,pagina:1,porPagina:10,itens:[{id:uid(5)}]});
    expect(m.preparar).not.toHaveBeenCalled();expect(m.criar).not.toHaveBeenCalled();expect(m.guardar).not.toHaveBeenCalled();
  });
  it("mesma data não permite misturar inscrições individuais", async () => {
    const outro={...item,tarefaId:uid(7),animalId:uid(8)};
    m.tarefas.mockResolvedValue([tarefa,{...tarefa,id:outro.tarefaId,execucaoId:uid(9),execucao:{...tarefa.execucao,animalId:outro.animalId}}]);
    await expect(preverExecucaoProtocolo({...input,itens:[item,outro]})).rejects.toMatchObject({code:"VALIDACAO"});
    expect(m.preparar).not.toHaveBeenCalled();
  });
  it("animal ou sítio forjados são recusados antes de preparar origem", async () => {
    await expect(preverExecucaoProtocolo({...input,itens:[{...item,animalId:uid(8)}]})).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
    expect(m.origens).not.toHaveBeenCalled();expect(m.preparar).not.toHaveBeenCalled();
  });
});
