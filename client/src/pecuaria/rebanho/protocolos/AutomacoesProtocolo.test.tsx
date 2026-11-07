// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AutomacoesProtocolo, type Automacao } from "./AutomacoesProtocolo";
import { reqProtocolo } from "./api";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("../../../financeiro/PainelCadastro", () => ({ classeInput: "input", PainelCadastro: ({ titulo, children, rodape }: { titulo: string; children: ReactNode; rodape: ReactNode }) => <section><h2>{titulo}</h2>{children}{rodape}</section> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const job: Automacao = { id: "job", participacaoId: "p", momentoId: "m", estado: "EXECUTADA", programadaPara: "2026-11-03T10:00:00Z", executadaEm: "2026-11-03T10:00:00Z", erro: null, animal: { id: "a", brinco: "101", nome: null }, momento: { id: "m", nome: "Aplicação" }, procedimentos: [{ tarefaId: "t", nome: "Produto previsto", tipo: "APLICACAO" }], resultado: [{ id: "fato", tarefaId: "t", animalId: "a", tipo: "APLICACAO" }] };
const previa = { fingerprint: "a".repeat(64), fatos: [{ id: "fato", nome: "Produto previsto", selecionado: true, efeitoMaterial: "Material devolvido ao estoque.", efeitoAdministracao: "Administração não mantida.", efeitoCarencia: "Outros registros continuam valendo.", efeitoCustos: "Histórico preservado." }], participacao: { efeito: "ENCERRAR", tarefasCanceladas: [{ id: "futura", nome: "Etapa seguinte", previstaPara: "2026-11-10" }] }, dispositivosPendentes: [], impedimentos: [] };
async function abrir() {
  vi.mocked(reqProtocolo).mockImplementation(async path => path.endsWith("/automacoes") ? [job] : path.endsWith("/previa-excecao") ? previa : {});
  render(<AutomacoesProtocolo contexto={{ participacaoId: "p" }} propriedadeId={1} revisao={0} podeLancar onSalvo={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Reverter ou retirar animal" }));
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Animal não compareceu à etapa" } });
}
it("devolve produto sem declarar administração mantida e retira na mesma requisição", async () => {
  await abrir();
  fireEvent.change(screen.getByLabelText("A ação ocorreu no animal?"), { target: { value: "false" } });
  fireEvent.click(screen.getByLabelText("Produto previsto"));
  fireEvent.change(screen.getByLabelText("Destino do produto"), { target: { value: "DEVOLVER_ESTOQUE" } });
  fireEvent.click(screen.getByLabelText("Retirar este animal deste protocolo"));
  fireEvent.click(screen.getByRole("button", { name: "Conferir efeitos" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar ajuste" }));
  await waitFor(() => expect(reqProtocolo).toHaveBeenLastCalledWith("/automacoes/job/excecao", 1, expect.objectContaining({ retirarDoProtocolo: true, reversoes: [{ tipo: "APLICACAO", id: "fato", destinoConsumo: "DEVOLVER_ESTOQUE" }] })));
});
it("preserva fato ocorrido ao retirar somente a participação futura", async () => {
  await abrir();
  fireEvent.change(screen.getByLabelText("A ação ocorreu no animal?"), { target: { value: "true" } });
  expect(screen.getByRole("button", { name: "Conferir efeitos" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByLabelText("Retirar este animal deste protocolo"));
  fireEvent.click(screen.getByRole("button", { name: "Conferir efeitos" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar ajuste" }));
  await waitFor(() => expect(reqProtocolo).toHaveBeenLastCalledWith("/automacoes/job/excecao", 1, expect.objectContaining({ retirarDoProtocolo: true, reversoes: [] })));
});

it("prévia exibe efeitos autorizados, não grava e é invalidada quando escolhas mudam", async()=>{
 await abrir();fireEvent.change(screen.getByLabelText("A ação ocorreu no animal?"),{target:{value:"true"}});fireEvent.click(screen.getByLabelText("Retirar este animal deste protocolo"));
 fireEvent.click(screen.getByRole("button",{name:"Conferir efeitos"}));
 expect(await screen.findByRole("region",{name:"Conferência dos efeitos"})).toBeTruthy();
 expect(screen.getByText("Etapa seguinte")).toBeTruthy();
 expect(vi.mocked(reqProtocolo).mock.calls.some(([path])=>path.endsWith("/excecao"))).toBe(false);
 fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Outro motivo após conferir"}});
 expect(screen.queryByRole("region",{name:"Conferência dos efeitos"})).toBeNull();
 expect(screen.getByRole("button",{name:"Conferir efeitos"})).toBeTruthy();
});

it("resposta perdida mantém a mesma confirmação idempotente, sem fazer outra prévia", async()=>{
 await abrir();fireEvent.change(screen.getByLabelText("A ação ocorreu no animal?"),{target:{value:"true"}});fireEvent.click(screen.getByLabelText("Retirar este animal deste protocolo"));
 fireEvent.click(screen.getByRole("button",{name:"Conferir efeitos"}));await screen.findByRole("button",{name:"Confirmar ajuste"});
 vi.mocked(reqProtocolo).mockRejectedValueOnce(new TypeError("Resposta da conexão perdida"));
 fireEvent.click(screen.getByRole("button",{name:"Confirmar ajuste"}));await screen.findByText("Resposta da conexão perdida");
 const primeira=vi.mocked(reqProtocolo).mock.calls.at(-1);
 expect(screen.getByLabelText("Motivo").closest("fieldset")).toHaveProperty("disabled", true);
 expect(screen.getByRole("button",{name:"Confirmar ajuste"})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Confirmar ajuste"}));
 await waitFor(()=>expect(vi.mocked(reqProtocolo).mock.calls.at(-1)).toEqual(primeira));
 expect(vi.mocked(reqProtocolo).mock.calls.filter(([path])=>path.endsWith("/previa-excecao"))).toHaveLength(1);
 expect(vi.mocked(reqProtocolo).mock.calls.filter(([path])=>path.endsWith("/excecao"))).toHaveLength(2);
});
