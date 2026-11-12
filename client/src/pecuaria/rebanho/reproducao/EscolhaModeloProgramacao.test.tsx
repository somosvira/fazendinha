// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { EscolhaModeloProgramacao } from "./EscolhaModeloProgramacao";
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn().mockResolvedValue({ itens: [{ id: "modelo", nome: "Protocolo publicado", versao: 3 }], total: 1 }) }));
afterEach(cleanup);
it("abre a busca no dropdown e preserva o modelo ao fechar uma nova busca", async () => {
  function Formulario() {
    const [valor, mudar] = useState("");
    return <EscolhaModeloProgramacao valor={valor} onChange={mudar} />;
  }
  render(<Formulario />);
  const gatilho = screen.getByRole("button", { name: "Modelo do protocolo" });
  expect(screen.queryByRole("searchbox")).toBeNull();
  fireEvent.click(gatilho);
  fireEvent.click(await screen.findByRole("button", { name: "Protocolo publicado · versão 3" }));
  expect(gatilho.textContent).toContain("Protocolo publicado");
  fireEvent.click(gatilho);
  const busca = screen.getByRole("searchbox", { name: "Pesquisar modelo publicado" });
  fireEvent.change(busca, { target: { value: "outro" } });
  fireEvent.keyDown(busca, { key: "Escape" });
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(gatilho.textContent).toContain("Protocolo publicado");
});
