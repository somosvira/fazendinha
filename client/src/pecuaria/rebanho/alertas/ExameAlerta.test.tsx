// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExameAlerta } from "./ExameAlerta";
import { reqSanidade } from "../sanidade/api";
vi.mock("../sanidade/api", () => ({ reqSanidade: vi.fn() }));
vi.mock("../sanidade/FormFatoSanitario", () => ({ FormFatoSanitario: (p: {
  tipo: string; animalInicial: string; cadastroInicial: string;
  onRegistrar: (input: Record<string, unknown>) => Promise<void>;
}) => <div><p>{p.tipo}:{p.animalInicial}:{p.cadastroInicial}</p><button onClick={() => void p.onRegistrar({ animalId: p.animalInicial, tipoExameId: p.cadastroInicial, propriedadeId: 4, data: "2026-10-28", resultadoTexto: "Conferido" }).catch(() => {})}>Confirmar exame</button></div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("reutiliza o executor e o recibo em falha de rede, com contexto e revisão do cuidado", async () => {
  vi.mocked(reqSanidade).mockRejectedValueOnce(new Error("Rede")).mockResolvedValueOnce({});
  render(<ExameAlerta alertaId="alerta" revisao={7} animalId="animal" tipoExameId="tipo-original" propriedadeId={4} titulo="Verificação" onFechar={() => {}} onSalvo={() => {}} />);
  expect(screen.getByText("exame:animal:tipo-original")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar exame" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar exame" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledTimes(2));
  const primeiro = JSON.parse(vi.mocked(reqSanidade).mock.calls[0][1]!.body as string);
  const segundo = JSON.parse(vi.mocked(reqSanidade).mock.calls[1][1]!.body as string);
  expect(primeiro).toEqual(expect.objectContaining({ animalId: "animal", tipoExameId: "tipo-original", alertaId: "alerta", alertaRevisao: 7, confirmarCuidadoAlerta: true, resultadoTexto: "Conferido" }));
  expect(segundo.chave).toBe(primeiro.chave);
  expect(reqSanidade).toHaveBeenLastCalledWith("/exames", expect.any(Object), 4);
});
