// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AlertasSanitarios } from "./AlertasSanitarios";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
afterEach(cleanup);
it("apresenta o array do contrato HTTP e distingue bloqueio", async()=>{
  vi.mocked(reqV4).mockResolvedValue([{motivo:"Ocorrência ativa",efeito:"BLOQUEAR",doencaId:"d"}]);
  render(<AlertasSanitarios animalId="a" data="2026-10-13" acao="IATF"/>);
  expect(await screen.findByText("Bloqueio: Ocorrência ativa")).toBeTruthy();
});
