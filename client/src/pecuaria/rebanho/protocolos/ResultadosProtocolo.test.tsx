// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ResultadosProtocolo,
  type DadosResultadosProtocolo,
  type LinhaResultadoProtocolo,
} from "./ResultadosProtocolo";
const m = vi.hoisted(() => ({
  req: vi.fn(),
  painel: vi.fn(),
  formulario: vi.fn(),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  reqProtocolo: m.req,
}));
vi.mock("../reproducao/api", async (original) => ({
  ...(await original<typeof import("../reproducao/api")>()),
  obterReproducao: m.painel,
}));
vi.mock("../reproducao/FormReproducao", () => ({
  FormReproducao: (props: unknown) => {
    m.formulario(props);
    return <p>Formulário real delegado</p>;
  },
}));
vi.mock("../../../estoque/navegacao", () => ({ podeAcessarArea: () => true }));
const linha: LinhaResultadoProtocolo = {
  participacaoId: "p",
  animal: { id: "a", brinco: "123", nome: "Brisa" },
  preparo: { situacao: "CONCLUIDO", atendidas: 3, total: 3 },
  tentativaPrevista: "IA",
  modalidadeTentativa: "EXTERNA",
  modalidadeDiagnostico: "EXTERNO",
  tentativas: [],
  tentativasTotal: 0,
  primeiroDg: null,
  conclusao: "TENTATIVA_PENDENTE",
  perdaPosterior: false,
  situacaoAtual: "DESCONHECIDA",
  encaminhamento: null,
  retornoEm: null,
  pendencia: null,
  vinculoExterno: null,
  demandaDiagnostico: null,
};
const taxa = { numerador: 0, denominador: 0, percentual: null };
const dados: DadosResultadosProtocolo = {
  liberado: true,
  itens: [linha],
  total: 1,
  pagina: 1,
  porPagina: 10,
  resumo: {
    participacoes: 1,
    incluidos: 1,
    preparoConcluido: 1,
    tentativasRealizadas: 0,
    animaisComTentativa: 0,
    examinados: 0,
    aguardandoDiagnostico: 0,
    positivos: 0,
    negativos: 0,
    inconclusivos: 0,
    perdasPosteriores: 0,
    taxas: {
      porTentativa: taxa,
      porExaminada: taxa,
      porAnimalIncluido: { ...taxa, denominador: 1 },
    },
  },
};
const consulta = (d = dados) => ({
  dados: d,
  erro: null,
  pagina: 1,
  busca: "",
  setPagina: vi.fn(),
  aoBuscar: vi.fn(),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.req.mockImplementation(
    async (path: string, _site: number, body?: object) =>
      body
        ? { id: "v" }
        : {
            itens: [
              {
                id: "tentativa",
                tipo: "IA",
                data: "2026-01-12",
                responsavel: "Responsável",
                revisao: "a".repeat(64),
              },
            ],
            total: 1,
            pagina: 1,
            porPagina: 10,
          },
  );
  m.painel.mockResolvedValue({ animais: [], tentativas: [], gestacoes: [] });
});
afterEach(cleanup);
it("preparo concluído sem tentativa/DG permanece pendente e permite selecionar um fato existente", async () => {
  const salvo = vi.fn();
  render(
    <ResultadosProtocolo
      consulta={consulta()}
      propriedadeId={1}
      podeLancar
      aoSalvar={salvo}
      aoOperarEtapa={vi.fn()}
    />,
  );
  expect(screen.getByText("IA · sem atendimento registrado")).toBeTruthy();
  expect(screen.getByText("Aguardando tentativa")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Vincular tentativa" }));
  fireEvent.click(
    await screen.findByRole("radio", { name: /IA · 12\/01\/2026/ }),
  );
  fireEvent.change(screen.getByLabelText("Justificativa"), {
    target: { value: "Serviço conferido na ficha" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar vínculo" }));
  await waitFor(() =>
    expect(m.req).toHaveBeenCalledWith(
      "/participacoes/p/tentativa-externa",
      1,
      expect.objectContaining({
        tentativaId: "tentativa",
        revisao: "a".repeat(64),
        propriedadeId: 1,
        motivo: "Serviço conferido na ficha",
      }),
    ),
  );
  expect(salvo).toHaveBeenCalledOnce();
});
it("DG externo abre o formulário existente com animal, demanda e sítio exatos", async () => {
  const l = {
    ...linha,
    tentativas: [
      {
        id: "t",
        tipo: "IA",
        data: "2026-01-01",
        origem: "EXTERNA",
        primeiroDg: null,
        conclusao: "AGUARDANDO_DIAGNOSTICO",
        perdaPosterior: false,
        posteriores: [],
        posterioresTotal: 0,
      },
    ],
    demandaDiagnostico: {
      id: "d",
      tentativaId: "t",
      gestacaoId: null,
      etapaId: null,
      tipoExameId: "tipo",
    },
  };
  render(
    <ResultadosProtocolo
      consulta={consulta({ ...dados, itens: [l] })}
      propriedadeId={1}
      podeLancar
      aoSalvar={vi.fn()}
      aoOperarEtapa={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar diagnóstico" }),
  );
  await screen.findByText("Formulário real delegado");
  expect(m.painel).toHaveBeenCalledWith("a", 1);
  expect(m.formulario).toHaveBeenCalledWith(
    expect.objectContaining({
      animalInicial: "a",
      propriedadeId: 1,
      demandaInicial: expect.objectContaining({ id: "d", tentativaId: "t" }),
      tipoExameInicial: "tipo",
    }),
  );
});
it("DG incluído opera a tarefa na própria aba e leitor não recebe comandos de escrita", () => {
  const operar = vi.fn(),
    l = {
      ...linha,
      tentativas: [
        {
          id: "t",
          tipo: "IA",
          data: "2026-01-01",
          origem: "ETAPA",
          primeiroDg: null,
          conclusao: "AGUARDANDO_DIAGNOSTICO",
          perdaPosterior: false,
          posteriores: [],
          posterioresTotal: 0,
        },
      ],
      demandaDiagnostico: {
        id: "d",
        tentativaId: "t",
        gestacaoId: null,
        etapaId: "etapa-dg",
        tipoExameId: "tipo",
      },
    };
  const tela = render(
    <ResultadosProtocolo
      consulta={consulta({ ...dados, itens: [l] })}
      propriedadeId={1}
      podeLancar
      aoSalvar={vi.fn()}
      aoOperarEtapa={operar}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar diagnóstico" }),
  );
  expect(operar).toHaveBeenCalledWith("etapa-dg");
  tela.rerender(
    <ResultadosProtocolo
      consulta={consulta({ ...dados, itens: [l] })}
      propriedadeId={1}
      podeLancar={false}
      aoSalvar={vi.fn()}
      aoOperarEtapa={operar}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Registrar diagnóstico" }),
  ).toBeNull();
});
