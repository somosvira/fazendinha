// @vitest-environment jsdom
import "@/lib/controles.fixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultadoVisualExame } from "./ResultadoVisualExame";
import { ConsultaCarencias, ConsultaExames } from "./ConsultasSanitariasVisuais";
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
it("preserva zero como resultado e mantém os comandos ao alternar para tabela", () => {
  const item = { ...exame, formatoSnapshot: { tipoResultado: "NUMERO", unidade: "mg" }, resultadoNumero: "0", data: "2026-10-10", status: "VALIDO", tipoExame: { nome: "Dosagem" } };
  const corrigir = vi.fn();
  render(<ConsultaExames nomeAnimal={() => "Aurora"} rotulo="Exames" itens={[item]} chaveDe={e => e.id} colunas={[{ chave: "resultado", titulo: "Resultado", celula: e => e.resultadoNumero }, { chave: "acoes", titulo: "Ações", acoes: true, celula: () => <button onClick={corrigir}>Corrigir resultado</button> }]} />);
  expect(screen.getByText("0 mg")).toBeTruthy(); expect(screen.queryByText("Aguardando resultado")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Corrigir resultado" })); expect(corrigir).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Tabela" })); expect(screen.getByRole("table", { name: "Exames" })).toBeTruthy();
});
it("distingue carência desconhecida, prazo zero e revisão da aplicabilidade", () => {
  const abrir = vi.fn();
  render(<ConsultaCarencias rotulo="Carências" itens={[{ animal: { id: "a", brinco: "A", nome: null }, leite: { estado: "NAO_INFORMADO" as const }, carne: { estado: "CONHECIDO" as const, ate: "2026-01-01T12:00:00Z", precisaoAproximada: false, prazoZero: true } }, { animal: { id: "b", brinco: "B", nome: null }, leite: { estado: "NAO_APLICAVEL" as const }, carne: { estado: "NENHUMA" as const }, revisaoLeitePendente: true }]} colunas={[]} chaveDe={c => c.animal.id} onAbrir={abrir} />);
  expect(screen.getByText("Prazo desconhecido")).toBeTruthy(); expect(screen.getByText("Prazo zero confirmado")).toBeTruthy(); expect(screen.getByText("Revisar aplicabilidade")).toBeTruthy();
  expect(screen.queryByText(/animal liberado/i)).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "A" })); expect(abrir).toHaveBeenCalledOnce();
});

it("resume laudos múltiplos na consulta e abre o resultado completo sem perder a referência", () => {
  const item = { ...exame, formatoSnapshot: { tipoResultado: "MULTIPLO", campos: [{ codigo: "CCS", rotulo: "Células somáticas", tipo: "NUMERO" as const, unidade: "mil células/mL" }, { codigo: "GORDURA", rotulo: "Gordura", tipo: "NUMERO" as const, unidade: "%" }, { codigo: "INTEGRA", rotulo: "Amostra íntegra", tipo: "BOOLEANO" as const }, { codigo: "OBS", rotulo: "Observação", tipo: "TEXTO" as const }] }, resultados: [{ campo: "CCS", valor: 0 }, { campo: "GORDURA", valor: 3.8 }, { campo: "INTEGRA", valor: true }, { campo: "OBS", valor: "Texto integral preservado no laudo" }], data: "2026-10-10", status: "VALIDO", tipoExame: { nome: "Qualidade" } };
  const abrir = vi.fn();
  render(<ConsultaExames nomeAnimal={() => "Aurora"} rotulo="Exames" itens={[item]} chaveDe={e => e.id} colunas={[]} onAbrir={abrir} />);
  expect(screen.getByText("0 mil células/mL")).toBeTruthy();
  expect(screen.getByText("3,8 %")).toBeTruthy();
  expect(screen.getByText("Sim")).toBeTruthy();
  expect(screen.queryByText("Texto integral preservado no laudo")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Ver resultado completo.*1 informação adicional/ }));
  expect(abrir).toHaveBeenCalledWith(item);
});
