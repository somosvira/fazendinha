// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormAplicacaoServico } from "./FormAplicacaoServico";
import { reqSanidade } from "./api";

vi.mock("./api", () => ({
  listarServicos: vi.fn().mockResolvedValue([{ id: "servico", numero: 12, descricao: "Atendimento" }]),
  listarTiposAplicacao: vi.fn().mockResolvedValue([{ id: "tipo", nome: "Tratamento personalizado", ativo: true }, { id: "inativo", nome: "Inativo", ativo: false }]),
  listarComprasDiretas: vi.fn().mockResolvedValue([]), reqSanidade: vi.fn().mockResolvedValue([]), registrarAplicacao: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([{ id: "produto", nome: "Medicamento teste", unidade: "ML", rastrearPartidas: false, perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 48 } }]) }));
vi.mock("../api", () => ({ buscarFichaAnimal: vi.fn().mockResolvedValue({ sexo: "F", aptidao: "LEITE" }) }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...p }: { value: string; onChange: (v: string) => void }) => <input {...p} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("aplicação sanitária V3", () => {
  it("aplica estoque sem Serviço com prazo zero informado e confirmação idempotente", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    expect(screen.queryByText("Inativo")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Tipo de aplicação/), { target: { value: "tipo" } });
    fireEvent.change(screen.getByLabelText(/Produto do estoque/), { target: { value: "produto" } });
    fireEvent.change(screen.getByLabelText(/Quantidade aplicada/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText(/Hora/), { target: { value: "10:00" } });
    expect((screen.getByLabelText(/Serviço de atendimento/) as HTMLSelectElement).required).toBe(false);
    fireEvent.submit(document.getElementById("form-aplicacao-sanitaria")!);
    await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/aplicacoes/coletivas", expect.any(Object)));
    const call = vi.mocked(reqSanidade).mock.calls.find(([path]) => path === "/aplicacoes/coletivas")!;
    const payload = JSON.parse(call[1]!.body as string);
    expect(payload.chave).toMatch(/^[a-f0-9-]{36}$/);
    expect(payload.itens[0]).toMatchObject({ origemInsumo: "BAIXA_ESTOQUE", dose: "10", unidadeDose: "ML", estadoCarenciaLeite: "INFORMADO", carenciaLeiteHoras: 0 });
    expect(payload.itens[0].operacaoServicoId).toBeUndefined();
  });
  it("medicamento incluído em Serviço aceita nome livre e Produto opcional", async () => {
    render(<FormAplicacaoServico animalId="animal" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText("Tratamento personalizado");
    fireEvent.change(screen.getByLabelText(/Origem do medicamento/), { target: { value: "INCLUSO_SERVICO" } });
    expect((screen.getByLabelText(/Produto cadastrado/) as HTMLSelectElement).required).toBe(false);
    expect((screen.getByLabelText(/Serviço que incluiu/) as HTMLSelectElement).required).toBe(true);
    expect((screen.getByLabelText(/Medicamento utilizado/) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.queryByLabelText(/Partida do Produto/)).toBeNull();
  });
});
