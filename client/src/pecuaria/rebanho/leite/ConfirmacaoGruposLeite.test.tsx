// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfirmacaoGruposLeite } from "./ConfirmacaoGruposLeite";
import type { FolhaLeite, AnimalFolhaLeite, MedicaoLeite } from "./types";
const resumo = {
  litros: 25,
  esperadas: 3,
  medidas: 3,
  naoOrdenhadas: 0,
  pendentes: 0,
  resolvidas: 3,
  completa: true,
};
function animal(
  id: string,
  nome: string,
  litros: number | null,
  patch: Partial<MedicaoLeite> = {},
): AnimalFolhaLeite {
  return {
    animalId: id,
    brinco: id,
    nome,
    participanteId: `p-${id}`,
    finalidade: { estado: "COMPROVADA", finalidadeId: "f", aptidao: "LEITE", dataOperacional: "2026-10-19", regra: "FINALIDADE_LEITE_V1" },
    lactacaoId: "l",
    localizacaoId: "loc",
    pendencias: [],
    excluidoEm: null,
    motivoExclusao: null,
    totais: resumo,
    medicoes: [
      {
        id: `m-${id}`,
        posicaoId: "manha",
        estado: "MEDIDO",
        litros,
        motivo: null,
        versao: 1,
        confirmacaoEstoque: null,
        ...patch,
      },
    ],
  };
}
function folha(): FolhaLeite {
  return {
    id: "dia",
    propriedadeId: 2,
    dataOperacional: "2026-10-19",
    versao: 2,
    congelada: true,
    configuracao: {
      id: "cfg",
      propriedadeId: 2,
      vigenteDesde: "2026-10-01",
      inicial: false,
      ordenhas: [{ posicaoId: "manha", nome: "Manhã", ordem: 1 }],
    },
    sessoes: [
      {
        id: "sessao",
        posicaoId: "manha",
        nome: "Manhã",
        ordem: 1,
        versao: 2,
        totais: resumo,
        entradasEstoque: [
          {
            entradaId: "grupo-outro",
            produtoId: "outro",
            natureza: "COLOSTRO",
            quantidadeLitros: "10",
            status: "CONFIRMADA",
          },
        ],
      },
    ],
    animais: [
      animal("a", "Aurora", 12),
      animal("b", "Brisa", 3),
      animal("c", "Clara", 10, {
        confirmacaoEstoque: {
          entradaId: "grupo-outro",
          produtoId: "outro",
          natureza: "COLOSTRO",
        },
      }),
    ],
    animaisExcluidos: [],
    impedimentos: [],
    totais: resumo,
  };
}
const executar = vi.fn().mockResolvedValue(undefined);
const props = {
  produtoId: "leite",
  produtos: [
    { id: "leite", nome: "Leite do sítio" },
    { id: "outro", nome: "Outro produto" },
  ],
  podeLancar: true,
  ocupado: false,
  executar,
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function natureza(tipo: string) {
  fireEvent.change(screen.getByLabelText("Natureza do grupo de Manhã"), {
    target: { value: tipo },
  });
  fireEvent.change(
    screen.getByLabelText("Justificativa da natureza de Manhã"),
    { target: { value: "Separação declarada pela equipe" } },
  );
}
describe("confirmação da produção por grupos de animais", () => {
  it("prepara grupos distintos e confirma todas as origens em uma única ação", async () => {
    render(<ConfirmacaoGruposLeite {...props} folha={folha()} />);
    fireEvent.click(screen.getByLabelText("Selecionar Aurora em Manhã · brinco a"));
    natureza("COMERCIAL");
    fireEvent.click(screen.getByRole("button", { name: "Preparar grupo de Manhã · 12 L" }));
    expect(executar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Confirmar sessão de Manhã · 12 L" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Selecionar Brisa em Manhã · brinco b"));
    natureza("NAO_COMERCIAL");
    fireEvent.click(screen.getByRole("button", { name: "Preparar grupo de Manhã · 3 L" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sessão de Manhã · 15 L" }));
    await waitFor(() => expect(executar).toHaveBeenCalledOnce());
    expect(executar.mock.calls[0][0]).toBe("/estoque/confirmacoes-sessao");
    expect(executar.mock.calls[0][1]).toMatchObject({ sessaoId: "sessao", versaoEsperada: 2,
      grupos: [{ produtoId: "leite", medicaoIds: ["m-a"], natureza: "COMERCIAL" }, { produtoId: "leite", medicaoIds: ["m-b"], natureza: "NAO_COMERCIAL" }] });
    expect(executar.mock.calls[0][1].grupos[0].chave).not.toBe(executar.mock.calls[0][1].grupos[1].chave);
  });
  it("preserva colostro, permite revisar grupos e mantém o mesmo payload para retry", async () => {
    render(<ConfirmacaoGruposLeite {...props} folha={folha()} />);
    fireEvent.click(screen.getByLabelText("Selecionar Aurora em Manhã · brinco a"));
    fireEvent.click(screen.getByLabelText("Selecionar Brisa em Manhã · brinco b"));
    natureza("COLOSTRO");
    fireEvent.click(screen.getByRole("button", { name: "Preparar grupo de Manhã · 15 L" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover grupo 1 de Manhã" }));
    expect((screen.getByLabelText("Selecionar Aurora em Manhã · brinco a") as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText("Selecionar Aurora em Manhã · brinco a"));
    fireEvent.click(screen.getByLabelText("Selecionar Brisa em Manhã · brinco b"));
    natureza("COLOSTRO");
    fireEvent.click(screen.getByRole("button", { name: "Preparar grupo de Manhã · 15 L" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sessão de Manhã · 15 L" }));
    await waitFor(() => expect(executar).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sessão de Manhã · 15 L" }));
    await waitFor(() => expect(executar).toHaveBeenCalledTimes(2));
    expect(executar.mock.calls[1][1]).toEqual(executar.mock.calls[0][1]);
    expect(executar.mock.calls[0][1].grupos[0].natureza).toBe("COLOSTRO");
  });
  it("bloqueia medição já confirmada em qualquer produto, mesmo após trocar o produto de destino", () => {
    const view = render(<ConfirmacaoGruposLeite {...props} folha={folha()} />);
    expect(
      (screen.getByLabelText("Selecionar Clara em Manhã · brinco c") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    view.rerender(
      <ConfirmacaoGruposLeite {...props} produtoId="outro" folha={folha()} />,
    );
    expect(
      (screen.getByLabelText("Selecionar Clara em Manhã · brinco c") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(executar).not.toHaveBeenCalled();
  });
  it("não confirma DTO sem evidência de disponibilidade nem usa zero ou pendente como volume", () => {
    const f = folha();
    delete f.animais[0].medicoes[0].confirmacaoEstoque;
    f.animais.push(
      animal("z", "Zero", 0),
      animal("p", "Pendente", null, { estado: "PENDENTE" }),
    );
    render(<ConfirmacaoGruposLeite {...props} folha={f} />);
    expect(
      (screen.getByLabelText("Selecionar Aurora em Manhã · brinco a") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Selecionar Zero em Manhã · brinco z") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByLabelText(
          "Selecionar Pendente em Manhã · brinco p",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("disponibilidade");
  });
  it("consulta mantém busca e paginação acessíveis, sem confirmação", () => {
    render(
      <ConfirmacaoGruposLeite {...props} podeLancar={false} folha={folha()} />,
    );
    const busca = screen.getByLabelText(
      "Buscar animal em Manhã",
    ) as HTMLInputElement;
    expect(busca.disabled).toBe(false);
    fireEvent.change(busca, { target: { value: "Brisa" } });
    expect(screen.queryByLabelText("Selecionar Aurora em Manhã · brinco a")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Confirmar grupo/ }),
    ).toBeNull();
  });
  it("exige justificativa adicional quando a ordenha tem medições pendentes", () => {
    const f = folha();
    f.sessoes[0].totais = { ...resumo, completa: false, pendentes: 1 };
    render(<ConfirmacaoGruposLeite {...props} folha={f} />);
    fireEvent.click(screen.getByLabelText("Selecionar Aurora em Manhã · brinco a"));
    fireEvent.click(screen.getByLabelText("Selecionar Brisa em Manhã · brinco b"));
    natureza("NAO_COMERCIAL");
    fireEvent.click(screen.getByRole("button", { name: "Preparar grupo de Manhã · 15 L" }));
    const botao = screen.getByRole("button", {
      name: "Confirmar sessão de Manhã · 15 L",
    }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(
      screen.getByLabelText("Justificativa da produção parcial de Manhã"),
      { target: { value: "Outra medição aguardando conferência" } },
    );
    expect(botao.disabled).toBe(false);
  });
});
