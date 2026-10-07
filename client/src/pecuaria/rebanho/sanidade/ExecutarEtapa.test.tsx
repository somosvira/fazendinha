// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ req: vi.fn(), ficha: vi.fn(), servicos: vi.fn() }));
vi.mock("./api", () => ({ reqSanidade: mocks.req, listarServicos: mocks.servicos, listarComprasDiretas: vi.fn(), listarTiposAplicacao: vi.fn() }));
vi.mock("../api", () => ({ buscarFichaAnimal: mocks.ficha }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...props }: { value: string; onChange: (v: string) => void }) => <input {...props} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
import { ExecutarEtapa } from "./ExecutarEtapa";
import type { TarefaRodada } from "./rodadas-api";
const tarefa: TarefaRodada = { id: "t", etapaId: "etapa", execucaoId: "execucao", previstaPara: "2026-09-10", situacao: "PENDENTE", propriedadeAtualId: 2, parametros: { tipo: "EXAME", tipoExameId: "exame", tipoExameNomeSnapshot: "Coleta" }, execucao: { animalId: "animal", propriedadeId: 1, animal: { id: "animal", brinco: "RN01", nome: null }, protocolo: { nome: "Sanitário", versao: 3 } } };
const previa = { fingerprint: "b".repeat(64), itens: [{ tarefaId: "t", animalId: "animal", referencia: "SNAPSHOT_PLANEJADO", diferencas: [{ campo: "data", planejado: "2026-09-10", realizado: "2026-10-01" }], motivoObrigatorio: true, motivo: "Aplicação após transferência", carencia: null }], consumos: [], temDesvios: true };
beforeEach(() => { vi.clearAllMocks(); mocks.servicos.mockResolvedValue([]); mocks.ficha.mockResolvedValue({ id: "animal", brinco: "RN01", historicoLocalizacoes: [{ desde: "2026-01-01", ate: "2026-09-20", propriedade: { id: 1, nome: "Sítio A" } }, { desde: "2026-09-20", ate: null, propriedade: { id: 2, nome: "Sítio B" } }] }); mocks.req.mockImplementation(async (path: string) => path === "/tipos-exame" ? [{ id: "exame", nome: "Coleta", tipoResultado: "TEXTO", ativo: true }] : path === "/tarefas/execucao/previa" ? previa : {}); });
afterEach(cleanup);
describe("execução de etapas", () => {
  it("exame fixa planejamento e desvio usa sítio histórico do fato e prévia antes de confirmar", async () => {
    const salvo = vi.fn(); render(<ExecutarEtapa tarefas={[tarefa]} onFechar={vi.fn()} onSalvo={salvo} />);
    await screen.findByRole("option", { name: "Coleta" });
    expect(screen.getByLabelText("Data realizada")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Tipo de exame")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Registrar desvio" }));
    fireEvent.change(screen.getByLabelText("Data realizada"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Motivo comum do desvio"), { target: { value: "Aplicação após transferência" } });
    await waitFor(() => expect(mocks.servicos).toHaveBeenLastCalledWith(2));
    fireEvent.submit(document.getElementById("execucao-exame")!);
    await screen.findByText("Planejado e realizado");
    expect(salvo).not.toHaveBeenCalled();
    const chamada = mocks.req.mock.calls.find(([path]) => path === "/tarefas/execucao/previa")!;
    expect(JSON.parse(chamada[1].body)).toMatchObject({ propriedadeId: 2, itens: [{ tarefaId: "t", propriedadeId: 2, data: "2026-10-01", desvio: { motivo: "Aplicação após transferência" } }] });
    fireEvent.submit(document.getElementById("execucao-exame")!);
    await waitFor(() => expect(salvo).toHaveBeenCalledTimes(1));
    expect(mocks.req).toHaveBeenCalledWith("/tarefas/execucao/confirmacao", expect.objectContaining({ body: expect.stringContaining('"fingerprint":"bbbb') }));
  });
  it("recusa mistura de etapas antes de abrir campos ou chamar API", () => {
    render(<ExecutarEtapa tarefas={[tarefa, { ...tarefa, id: "outra", etapaId: "outra-etapa" }]} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    expect(screen.getByText(/Selecione até 100 tarefas/)).toBeTruthy(); expect(mocks.req).not.toHaveBeenCalled();
  });
});
