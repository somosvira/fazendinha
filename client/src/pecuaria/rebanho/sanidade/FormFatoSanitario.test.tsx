// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormFatoSanitario } from "./FormFatoSanitario";
import { reqSanidade, SanidadeApiError } from "./api";
import { resultadoExameSanitario } from "./rotulos";
vi.mock("./api", () => ({ SanidadeApiError: class extends Error { constructor(message: string, public code?: string, public campo?: string) { super(message); } }, listarServicos: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn() }));
vi.mock("../api", () => ({ listarAnimais: vi.fn().mockResolvedValue({ itens: [{ id: "a", brinco: "GV3-1", nome: null }] }), buscarFichaAnimal: vi.fn().mockResolvedValue({ id: "a", brinco: "GV3-1", nome: null, historicoLocalizacoes: [{ desde: "2026-09-20", ate: null, propriedade: { id: 2, nome: "Sítio B" } }, { desde: "2026-09-01", ate: "2026-09-20", propriedade: { id: 1, nome: "Sítio A" } }] }) }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...p }: { value: string; onChange: (v: string) => void }) => <input {...p} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(reqSanidade).mockImplementation(async (path) => path === "/tipos-exame" ? [{ id: "tipo", nome: "Contagem", ativo: true, tipoResultado: "NUMERO", unidade: "mil cél/mL", opcoes: null }] : []); });
it("mantém o animal fixo e envia sítio histórico e zero numérico", async () => {
  render(<FormFatoSanitario tipo="exame" animalInicial="a" fixo onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText("Contagem");
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-09-10" } });
  await screen.findByText(/Sítio na data: Sítio A/);
  expect(screen.queryByLabelText("Animal")).toBeNull();
  fireEvent.change(screen.getByLabelText("Tipo de exame"), { target: { value: "tipo" } });
  fireEvent.change(screen.getByLabelText(/Resultado \(opcional\)/), { target: { value: "0" } });
  fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
  await waitFor(() => expect(vi.mocked(reqSanidade).mock.calls.some(([p]) => p === "/exames/coletivos")).toBe(true));
  const envio = vi.mocked(reqSanidade).mock.calls.find(([p]) => p === "/exames/coletivos")!;
  expect(JSON.parse(envio[1]!.body as string)).toMatchObject({ propriedadeId: 1, itens: [{ animalId: "a", propriedadeId: 1, resultadoNumero: 0 }] });
});
it("oferece seleção própria sem animal inicial", async () => {
  render(<FormFatoSanitario tipo="exame" onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText("GV3-1");
  expect(screen.getByLabelText("Animal")).toHaveProperty("value", "");
  fireEvent.change(screen.getByLabelText("Animal"), { target: { value: "a" } });
  await screen.findByText(/Sítio na data: Sítio B/);
});
it("formata apenas o resultado correspondente ao snapshot e preserva zero", () => {
  expect(resultadoExameSanitario({ formatoSnapshot: { tipoResultado: "NUMERO", unidade: "kg" }, resultadoNumero: "1234.5", resultadoTexto: "ignorar", resultadoOpcao: null })).toBe("1.234,5 kg");
  expect(resultadoExameSanitario({ formatoSnapshot: { tipoResultado: "NUMERO" }, resultadoNumero: "0", resultadoTexto: null, resultadoOpcao: null })).toBe("0");
  expect(resultadoExameSanitario({ formatoSnapshot: { tipoResultado: "NUMERO" }, resultadoNumero: null, resultadoTexto: "ignorar", resultadoOpcao: null })).toBe("Aguardando resultado");
});
it("associa erro coletivo de tipo inativo ao campo e preserva os dados", async () => {
  const consulta = vi.mocked(reqSanidade).getMockImplementation()!;
  vi.mocked(reqSanidade).mockImplementation(async (path, init) => { if (init?.method === "POST") throw new SanidadeApiError("Tipo de exame inativo. Escolha outro.", "VALIDACAO", "itens.0.tipoExameId"); return consulta(path, init); });
  render(<FormFatoSanitario tipo="exame" animalInicial="a" fixo onFechar={vi.fn()} onSalvo={vi.fn()} />);
  await screen.findByText(/Sítio na data: Sítio B/);
  fireEvent.change(screen.getByLabelText("Tipo de exame"), { target: { value: "tipo" } });
  fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
  await waitFor(() => expect(screen.getByLabelText("Tipo de exame").getAttribute("aria-invalid")).toBe("true"));
  expect(document.activeElement).toBe(screen.getByLabelText("Tipo de exame"));
  expect(screen.getByLabelText("Tipo de exame")).toHaveProperty("value", "tipo");
});
