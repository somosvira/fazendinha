// @vitest-environment jsdom
import "@/lib/controles.fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultadoVisualExame } from "./ResultadoVisualExame";
import { ConsultaCarencias, ConsultaExames } from "./ConsultasSanitariasVisuais";
import { PrazoCarencia } from "./IndicadoresSanitarios";
import type { ExameResultado } from "./ResultadoExame";
const exame: ExameResultado = { id: "exame", formatoSnapshot: { tipoResultado: "MULTIPLO" }, resultados: [{ campo: "ESCORE", valor: "3" }, { campo: "ESCALA_MIN", valor: "1" }, { campo: "ESCALA_MAX", valor: "5" }, { campo: "ESCALA_DESCRICAO", valor: "Escala registrada" }], resultadoNumero: null, resultadoTexto: null, resultadoOpcao: null };
beforeEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/pecuaria/sanidade"); });
afterEach(cleanup);
it("mostra o escore com os limites históricos sem acrescentar interpretação clínica", () => {
  render(<ResultadoVisualExame exame={exame} />);
  expect(screen.getByText("3 / 5")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Escala registrada de 1 a 5" })).toBeTruthy();
  expect(screen.getByText(/Mínimo 1/)).toBeTruthy();
  expect(screen.queryByText(/normal|saudável|ideal/i)).toBeNull();
});
it("preserva zero como resultado e mantém os comandos na tabela", () => {
  const item = { ...exame, formatoSnapshot: { tipoResultado: "NUMERO", unidade: "mg" }, resultadoNumero: "0", data: "2026-10-10", status: "VALIDO", tipoExame: { nome: "Dosagem" } };
  const corrigir = vi.fn();
  render(<ConsultaExames nomeAnimal={() => "Aurora"} rotulo="Exames" itens={[item]} chaveDe={e => e.id} colunas={[{ chave: "resultado", titulo: "Resultado", celula: e => e.resultadoNumero }, { chave: "acoes", titulo: "Ações", acoes: true, celula: () => <button onClick={corrigir}>Corrigir resultado</button> }]} />);
  expect(screen.getByText("0")).toBeTruthy(); expect(screen.queryByText("Aguardando resultado")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Corrigir resultado" })); expect(corrigir).toHaveBeenCalledOnce();
expect(screen.getByRole("table", { name: "Exames" })).toBeTruthy();
});
it("distingue carência desconhecida, prazo zero e revisão da aplicabilidade", () => {
  const abrir = vi.fn();
  render(<ConsultaCarencias rotulo="Carências" itens={[{ animal: { id: "a", brinco: "A", nome: null }, leite: { estado: "NAO_INFORMADO" as const }, carne: { estado: "CONHECIDO" as const, ate: "2026-01-01T12:00:00Z", precisaoAproximada: false, prazoZero: true } }, { animal: { id: "b", brinco: "B", nome: null }, leite: { estado: "NAO_APLICAVEL" as const }, carne: { estado: "NENHUMA" as const }, revisaoLeitePendente: true }]} colunas={[{ chave: "animal", titulo: "Animal", principal: true, celula: c => <button type="button" onClick={() => abrir()}>{c.animal.brinco}</button> }, { chave: "leite", titulo: "Leite", celula: c => <PrazoCarencia estado={c.leite} agora={Date.parse("2026-10-20T12:00:00Z")} revisao={c.revisaoLeitePendente} /> }, { chave: "carne", titulo: "Abate / carne", celula: c => <PrazoCarencia estado={c.carne} agora={Date.parse("2026-10-20T12:00:00Z")} /> }]} chaveDe={c => c.animal.id} />);
  expect(screen.getByText("Prazo desconhecido")).toBeTruthy(); expect(screen.getByText("Prazo zero confirmado")).toBeTruthy(); expect(screen.getByText("Revisar aplicabilidade")).toBeTruthy();
  expect(screen.queryByText(/animal liberado/i)).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "A" })); expect(abrir).toHaveBeenCalledOnce();
});
