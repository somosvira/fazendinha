// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FormLactacao } from "./FormLactacao";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
vi.mock("../../../propriedadeScope",()=>({getPropriedadeAtiva:()=>1}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("informa lactação histórica sem inventar parto e mantém chave no reenvio",async()=>{
  vi.mocked(reqV4).mockRejectedValueOnce(new Error("Revisar intervalo")).mockResolvedValueOnce({});
  render(<FormLactacao animalId="a" onFechar={vi.fn()} onSalvo={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText("Início da lactação"),{target:{value:"2026-01-12"}});
  fireEvent.change(screen.getByLabelText("Encerramento (opcional)"),{target:{value:"2026-10-13"}});
  fireEvent.change(screen.getByLabelText("Motivo / fonte do histórico"),{target:{value:"Conferência com os registros da fazenda"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar lactação"}));
  await screen.findByText("Revisar intervalo");
  const corpo=vi.mocked(reqV4).mock.calls[0][1];
  expect(corpo).toMatchObject({animalId:"a",inicio:"2026-01-12",encerradaEm:"2026-10-13",partoId:null,chave:expect.any(String)});
  fireEvent.click(screen.getByRole("button",{name:"Registrar lactação"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledTimes(2));
  expect(vi.mocked(reqV4).mock.calls[1][1]).toEqual(corpo);
});


it("grava a lactação no sítio explícito sem depender do sítio ativo", async () => {
  vi.mocked(reqV4).mockResolvedValue({});
  render(<FormLactacao animalId="a" propriedadeId={7} onFechar={vi.fn()} onSalvo={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Início da lactação"), { target: { value: "2026-10-13" } });
  fireEvent.change(screen.getByLabelText("Motivo / fonte do histórico"), { target: { value: "Conferência do sítio de origem" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar lactação" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/lactacoes", expect.objectContaining({ propriedadeId: 7 }), "POST", 7));
});
