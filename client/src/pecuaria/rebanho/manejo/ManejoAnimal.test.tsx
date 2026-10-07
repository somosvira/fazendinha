// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManejoAnimal } from "./ManejoAnimal";
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...props }: { value: string; onChange: (value: string) => void }) => <input {...props} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("oculta desmama válida e permite novo lançamento após anulação com motivo", async () => {
  let status = "VALIDO";
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toMatchObject({ propriedadeId: 1, motivo: "Desmama lançada na data incorreta" });
      status = "ANULADO";
      return new Response(JSON.stringify({ id: "manejo" }));
    }
    return new Response(JSON.stringify([{ id: "manejo", propriedadeId: 1, data: "2026-09-01", tipo: "DESMAMA", status, pesagem: { pesoKg: "100" } }]));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onSalvo = vi.fn();
  render(<ManejoAnimal animalId="animal" propriedadeId={1} podeLancar onSalvo={onSalvo} />);
  fireEvent.click(await screen.findByRole("button", { name: "Registrar manejo" }));
  expect(screen.queryByRole("option", { name: "Desmama" })).toBeNull();
  expect(screen.getByLabelText("Tipo")).toHaveProperty("value", "CASTRACAO");
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  fireEvent.click(screen.getByRole("button", { name: "Anular com motivo" }));
  fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: "Desmama lançada na data incorreta" } });
  fireEvent.submit(document.getElementById("form-manejo")!);
  await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
  await screen.findByText("Anulado");
  fireEvent.click(screen.getByRole("button", { name: "Registrar manejo" }));
  expect(screen.getByRole("option", { name: "Desmama" })).toBeTruthy();
  expect(screen.getByLabelText("Tipo")).toHaveProperty("value", "DESMAMA");
  expect(screen.getAllByRole("option")).toHaveLength(2);
});

it("erro da API aponta ao campo e conserva o peso digitado com vírgula", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toMatchObject({ pesoKg: 128.5 });
      return new Response(JSON.stringify({ error: "Confira a data histórica", campo: "data" }), { status: 422 });
    }
    return new Response("[]");
  }));
  render(<ManejoAnimal animalId="animal" propriedadeId={1} podeLancar onSalvo={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Registrar manejo" }));
  fireEvent.change(screen.getByLabelText(/Peso/), { target: { value: "128,5" } });
  fireEvent.submit(document.getElementById("form-manejo")!);
  await waitFor(() => expect(document.getElementById("manejo-data")?.getAttribute("aria-invalid")).toBe("true"));
  await waitFor(() => expect(document.activeElement).toBe(document.getElementById("manejo-data")));
  expect(screen.getByLabelText(/Peso/)).toHaveProperty("value", "128,5");
});
