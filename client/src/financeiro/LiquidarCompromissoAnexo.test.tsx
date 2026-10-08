// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LiquidarCompromissoModal } from "./LiquidarCompromissoModal";
import { anexarDocumentoOperacao, liquidarCompromisso, type Compromisso, type Conta } from "./novo-api";

vi.mock("./novo-api", () => ({ anexarDocumentoOperacao: vi.fn(), liquidarCompromisso: vi.fn() }));
const compromisso = { id: "compromisso", tipo: "PAGAR", saldoPendente: "100.00", parceiro: null, operacao: { id: "operacao", descricao: "Energia" } } as Compromisso;
const contas = [{ id: "conta", nome: "Banco", ativo: true, saldoAtual: "500" }] as Conta[];
beforeEach(() => { vi.resetAllMocks(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
function abrir() {
  render(<LiquidarCompromissoModal compromisso={compromisso} contas={contas} onClose={vi.fn()} onLiquidado={vi.fn()} onErro={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Conta" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: /Banco/ }));
}
function soltar(arquivo: File) {
  fireEvent.drop(screen.getByRole("region", { name: "Nota fiscal" }).querySelector("div")!, { dataTransfer: { files: [arquivo] } });
}
it("aceita nota por drop e conclui o upload na operação antes de registrar o pagamento", async () => {
  abrir();
  const arquivo = new File(["nota"], "nota.pdf", { type: "application/pdf" });
  let concluir!: () => void;
  vi.mocked(anexarDocumentoOperacao).mockImplementation(() => new Promise(resolve => { concluir = () => resolve({ id: "doc" } as never); }));
  soltar(arquivo);
  fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));
  expect(anexarDocumentoOperacao).toHaveBeenCalledWith("operacao", { arquivo, tipo: "NOTA_FISCAL" });
  expect(liquidarCompromisso).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Enviando nota…" }).hasAttribute("disabled")).toBe(true);
  concluir();
  await waitFor(() => expect(liquidarCompromisso).toHaveBeenCalledOnce());
});
it("upload falho não liquida; tentativa de pagamento falha não reenvia uma nota já salva", async () => {
  abrir();
  fireEvent.change(screen.getByLabelText("Anexar nota fiscal"), { target: { files: [new File(["nota"], "nota.xml")] } });
  vi.mocked(anexarDocumentoOperacao).mockRejectedValueOnce(new Error("Falha no envio")).mockResolvedValue({ id: "doc" } as never);
  vi.mocked(liquidarCompromisso).mockRejectedValueOnce(new Error("Conta indisponível")).mockResolvedValue({});
  fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));
  await screen.findByText("Falha no envio");
  expect(liquidarCompromisso).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));
  await screen.findByText("Conta indisponível");
  expect(screen.getByText("Nota salva na operação vinculada.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar liquidação" }));
  await waitFor(() => expect(liquidarCompromisso).toHaveBeenCalledTimes(2));
  expect(anexarDocumentoOperacao).toHaveBeenCalledTimes(2);
});
it("rejeita formatos e tamanhos inválidos e permite remover antes do envio", () => {
  abrir();
  soltar(new File(["x"], "nota.exe"));
  expect(screen.getByRole("alert").textContent).toContain("Formato não suportado");
  const grande = new File(["x"], "nota.pdf"); Object.defineProperty(grande, "size", { value: 10 * 1024 * 1024 + 1 });
  soltar(grande);
  expect(screen.getByRole("alert").textContent).toContain("até 10 MB");
  soltar(new File(["nota"], "nota.pdf"));
  fireEvent.click(screen.getByRole("button", { name: "Remover nota fiscal" }));
  expect(screen.queryByText("nota.pdf")).toBeNull();
  expect(anexarDocumentoOperacao).not.toHaveBeenCalled();
});
