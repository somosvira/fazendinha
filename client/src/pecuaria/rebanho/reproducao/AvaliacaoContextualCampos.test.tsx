// @vitest-environment jsdom
import { useState, type ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  adotarCatalogoAvaliacao,
  AvaliacaoContextualCampos,
  type DadosFormularioContextual,
} from "./AvaliacaoContextualCampos";
import { PreviaAvaliacaoContextual } from "./PreviaAvaliacaoContextual";
import type { CatalogoAvaliacao } from "./avaliacao-contextual-api";
const m = vi.hoisted(() => ({ catalogo: vi.fn() }));
vi.mock("./avaliacao-contextual-api", async (original) => ({
  ...(await original<typeof import("./avaliacao-contextual-api")>()),
  consultarCatalogoAvaliacao: m.catalogo,
}));
vi.mock("../../../financeiro/SelectCampo", () => ({
  SelectCampo: ({
    value,
    onValueChange,
    children,
    ...props
  }: {
    value?: string;
    onValueChange: (s: string) => void;
    children: ReactNode;
  }) => (
    <select
      {...props}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
}));
const catalogo: CatalogoAvaliacao = {
  id: "catalogo",
  versao: 2,
  tipoExameId: "tipo",
  itens: [
    {
      codigo: "UTERO",
      rotulo: "Útero",
      tipo: "UTERO",
      campo: "OBS_UTERO",
      contextos: ["NOVILHA"],
    },
    {
      codigo: "DG",
      rotulo: "Diagnóstico de gestação",
      tipo: "DIAGNOSTICO",
      contextos: ["APOS_TENTATIVA"],
    },
    {
      codigo: "APTIDAO",
      rotulo: "Aptidão",
      tipo: "APTIDAO",
      contextos: ["NOVILHA"],
    },
  ],
  condutas: [
    { codigo: "RETORNO", rotulo: "Organizar retorno", tipo: "RETORNO" },
    {
      codigo: "NAO",
      rotulo: "Não prosseguir",
      tipo: "NAO_PROSSEGUIR",
      exigeRevisao: true,
    },
  ],
};
function Formulario() {
  const [dados, setDados] = useState<DadosFormularioContextual>({});
  return (
    <>
      <AvaliacaoContextualCampos
        propriedadeId={1}
        contexto="NOVILHA"
        dados={dados}
        campos={[
          { codigo: "OBS_UTERO", tipo: "TEXTO", rotulo: "Achado uterino" },
        ]}
        necessidades={[{ id: "demanda", finalidade: "DIAGNOSTICO" }]}
        onChange={(patch) => setDados((d) => ({ ...d, ...patch }))}
        onTipoExame={() => {}}
      />
      <output data-testid="dados">{JSON.stringify(dados)}</output>
    </>
  );
}
function dadosAtuais(): DadosFormularioContextual {
  return JSON.parse(screen.getByTestId("dados").textContent ?? "{}");
}
beforeEach(() => {
  vi.resetAllMocks();
  m.catalogo.mockResolvedValue({ catalogo, sugeridos: ["UTERO", "APTIDAO"] });
});
afterEach(cleanup);
it("sugestões não adotam catálogo nem escolhem conclusões sem ação do usuário", async () => {
  render(<Formulario />);
  await screen.findByRole("button", { name: /Usar catálogo/ });
  expect(dadosAtuais().avaliacaoContextual).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: /Usar catálogo/ }));
  expect(
    dadosAtuais().avaliacaoContextual?.itens.every(
      (i) => i.estado === "NAO_AVALIADO",
    ),
  ).toBe(true);
  expect(dadosAtuais().resultado).toBe("NAO_AVALIADO");
  expect(dadosAtuais().realizadoSemDG).toBe(true);
  expect(dadosAtuais().resultadoAptidao).toBeUndefined();
});
it("adotar preserva zero, observação e DG informado sem atribuir aptidão", () => {
  const adotado = adotarCatalogoAvaliacao(catalogo, {
    resultado: "NEGATIVO",
    finalidade: "DIAGNOSTICO",
    resultados: [{ campo: "OBS_UTERO", valor: 0 }],
  });
  expect(adotado.itens.map((i) => [i.codigo, i.estado])).toEqual([
    ["UTERO", "CONCLUSIVO"],
    ["DG", "CONCLUSIVO"],
    ["APTIDAO", "NAO_AVALIADO"],
  ]);
  expect(adotado.condutas).toEqual([]);
});
it("item inconclusivo sem DG conserva avaliação parcial e exige vínculo explícito do cuidado", async () => {
  render(<Formulario />);
  fireEvent.click(await screen.findByRole("button", { name: /Usar catálogo/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "Estado de Útero" }), {
    target: { value: "INCONCLUSIVO" },
  });
  expect(dadosAtuais().resultado).toBe("NAO_AVALIADO");
  expect(dadosAtuais().avaliacaoContextual?.itens[0].estado).toBe(
    "INCONCLUSIVO",
  );
  expect(dadosAtuais().vinculosConclusao).toBeUndefined();
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Diagnóstico · sem prazo/ }),
  );
  expect(dadosAtuais().vinculosConclusao).toEqual([
    { demandaId: "demanda", campo: "CONCLUSAO_GESTACIONAL" },
  ]);
  fireEvent.click(
    screen.getByRole("checkbox", { name: /Diagnóstico · sem prazo/ }),
  );
  expect(dadosAtuais().vinculosConclusao).toEqual([]);
});
it("não prosseguir exige destino e oferece revisão datada separada da conclusão", async () => {
  render(<Formulario />);
  fireEvent.click(await screen.findByRole("button", { name: /Usar catálogo/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Não prosseguir" }));
  const destino = screen.getByLabelText(
    "Destino de Não prosseguir",
  ) as HTMLInputElement;
  expect(destino.required).toBe(true);
  fireEvent.change(destino, {
    target: { value: "Reavaliar condição clínica" },
  });
  expect(dadosAtuais().avaliacaoContextual?.condutas).toEqual([
    { codigo: "NAO", destino: "Reavaliar condição clínica" },
  ]);
  expect(screen.getByText("Revisar Não prosseguir em")).toBeTruthy();
  expect(dadosAtuais().resultado).toBe("NAO_AVALIADO");
});
it("falha no catálogo mantém erro recuperável distinto de catálogo não configurado", async () => {
  m.catalogo.mockRejectedValueOnce(new Error("Serviço indisponível"));
  render(<Formulario />);
  expect(await screen.findByText("Serviço indisponível")).toBeTruthy();
  expect(screen.queryByText(/ainda não tem catálogo/)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Consultar catálogo novamente" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Usar catálogo/ })).toBeTruthy(),
  );
});
it("prévia mostra DG não avaliado e cuidado preservado sem apresentá-lo como negativo", () => {
  render(
    <PreviaAvaliacaoContextual
      dados={{
        exame: {
          tipoExameId: "tipo",
          data: "2026-11-07",
          resultado: "NAO_AVALIADO",
          gestacaoCriada: false,
        },
        itens: [],
        condutas: [],
        necessidades: [
          {
            id: "d",
            finalidade: "DIAGNOSTICO",
            previstaPara: null,
            conclusaoCompativel: null,
            acao: "PRESERVAR",
          },
        ],
        necessidadesGeradas: [],
        revisao: "hash",
      }}
    />,
  );
  expect(screen.getByText("DG não avaliado neste atendimento")).toBeTruthy();
  expect(screen.getByText(/Permanece pendente/)).toBeTruthy();
  expect(screen.queryByText("Gestação não confirmada")).toBeNull();
});
