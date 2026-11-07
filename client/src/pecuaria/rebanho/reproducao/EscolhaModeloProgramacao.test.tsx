// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { EscolhaModeloProgramacao } from "./EscolhaModeloProgramacao";
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn().mockResolvedValue({ itens: [{ id: "modelo", nome: "Protocolo publicado", versao: 3 }], total: 1 }) }));
afterEach(cleanup);
it("mantém escolha válida ao refocar e sair com Escape ou blur", async () => {
  function Formulario() { const [valor, mudar] = useState(""); return <form aria-label="Programação"><EscolhaModeloProgramacao valor={valor} onChange={mudar}/><button type="submit">Conferir</button></form>; }
  render(<Formulario/>);
  const input = screen.getByRole("combobox", { name: "Modelo do protocolo" });
  fireEvent.focus(input);
  fireEvent.click(await screen.findByRole("option", { name: /Protocolo publicado/ }));
  fireEvent.focus(input);
  expect(input).toHaveProperty("value", "Protocolo publicado");
  expect(input).toHaveProperty("required", false);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByRole("form")).toHaveProperty("checkValidity");
  expect((screen.getByRole("form") as HTMLFormElement).checkValidity()).toBe(true);
  fireEvent.focus(input);
  fireEvent.blur(input, { relatedTarget: screen.getByRole("button", { name: "Conferir" }) });
  expect(screen.queryByRole("listbox")).toBeNull();
});
