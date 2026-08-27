// @vitest-environment jsdom
// Regressão: "Preencher grade com horário padrão" chama preencherGrade()
// direto via req(), fora da fila de escrita offline (é bulk/idempotente no
// backend, não um upsert único enfileirável) — offline, o clique só falhava
// com um erro genérico de fetch, sem enfileirar nada. Este teste prova que o
// botão fica desabilitado sem conexão em vez de aceitar o clique perdido.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PontoTab } from "./PontoTab";
import { ToastProvider } from "../../components/Toast";
import { onlineManager } from "../../lib/offline/resume";
import type { FuncionarioDTO } from "../types";

vi.mock("../../lib/offline/req", () => ({
  req: vi.fn(() => Promise.reject(new Error("offline"))),
}));

vi.mock("../../lib/offline/fila", () => {
  const filaVazia: unknown[] = [];
  return {
    enfileirarMutation: vi.fn(() => new Promise(() => {})),
    inscrever: () => () => {},
    obterFila: () => filaVazia, // referência estável — nova a cada chamada quebraria useSyncExternalStore
  };
});

const FUNCIONARIO: FuncionarioDTO = {
  id: "1",
  nome: "Maria",
  cargo: "Ordenhadora",
  setor: "Leite",
  salarioMensal: 2200,
  cargaMensalHoras: 220,
  jornadaDiariaHoras: 8,
  horaEntradaPadrao: "06:00",
  horaSaidaPadrao: "15:00",
  intervaloPadraoMin: 60,
  dataAdmissao: "2024-01-10",
  cpf: null,
  chavePix: null,
  ativo: true,
};

describe("PontoTab — 'Preencher grade com horário padrão' offline", () => {
  // Import explícito de vitest (sem test.globals) — @testing-library/react
  // não auto-limpa entre testes nesse setup, então dois render() no mesmo
  // arquivo deixam DOM duplicado sem isto.
  afterEach(cleanup);

  it("fica desabilitado sem conexão", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Simula funcionário já restaurado do cache (persister) — funcionário tem
    // horário padrão, então sem a trava de `online` o botão estaria clicável.
    queryClient.setQueryData(["ponto", "funcionarios", true], [FUNCIONARIO]);
    onlineManager.setOnline(false);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PontoTab />
        </ToastProvider>
      </QueryClientProvider>,
    );

    const botao = await screen.findByRole<HTMLButtonElement>("button", { name: /preencher grade com horário padrão/i });
    expect(botao.disabled).toBe(true);
  });

  // Achado ao escrever o teste acima: com um funcionário/mês nunca visitado
  // (sem registros em cache) e offline, a query de registros fica pausada
  // pra sempre (networkMode padrão "online" nem tenta buscar) — e o
  // `query.data ?? []` de useFuncionarios/useRegistros criava um array novo
  // a cada render, o que fazia o useEffect de PontoTab (depende de
  // `registros`) reentrar em loop infinito. Corrigido com referência
  // estável (FUNCIONARIOS_VAZIO/REGISTROS_VAZIO em api.ts). Sem o fix este
  // teste trava (timeout), não falha rápido.
  it("não trava em loop infinito offline com funcionário/mês nunca cacheado (sem registros em cache)", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["ponto", "funcionarios", true], [FUNCIONARIO]);
    onlineManager.setOnline(false);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PontoTab />
        </ToastProvider>
      </QueryClientProvider>,
    );

    // Só prova que renderizou (não travou) — o botão sempre existe no shell.
    expect(await screen.findByRole("button", { name: /preencher grade com horário padrão/i })).toBeTruthy();
  });

  // Achado verificando "trocar de mês offline": um mês já cacheado (visitado
  // online antes) mostra os dados na hora, mesmo offline — mas um mês nunca
  // visitado fica com `loading: true` pra sempre (query pausada, nunca chega
  // a tentar o fetch, nunca erra) sem o fix acima. Antes desta mudança isso
  // aparecia como um <Loader/> girando pra sempre, indistinguível de
  // "carregando rápido" — sem indicação de que é por falta de conexão.
  it("mostra mensagem específica (não spinner infinito) pra mês nunca cacheado offline", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["ponto", "funcionarios", true], [FUNCIONARIO]);
    // Só o mês default (mesesRecentes(12)[0] = "2026-05") tem cache — nenhum
    // registros para "2026-05" foi seedado, então já nasce sem dado.
    onlineManager.setOnline(false);

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PontoTab />
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/sem dado salvo pra este mês/i)).toBeTruthy();
  });
});
