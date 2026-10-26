import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Leite } from "./Leite";
import { obterCandidatos, obterFolha, salvarFolha } from "./api";
import type { FolhaLeite } from "./types";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./api", () => ({
  obterFolha: vi.fn(),
  salvarFolha: vi.fn(),
  salvarConfiguracao: vi.fn(),
  obterCandidatos: vi.fn(),
}));
vi.mock("../../../components/Toast", () => ({
  useToast: () => ({ success: vi.fn() }),
}));
const resumo = {
  litros: null,
  esperadas: 1,
  medidas: 0,
  naoOrdenhadas: 0,
  pendentes: 1,
  resolvidas: 0,
  completa: false,
};
function folha(versao = 0): FolhaLeite {
  return {
    id: null,
    propriedadeId: 1,
    dataOperacional: "2026-10-19",
    versao,
    congelada: false,
    configuracao: {
      id: null,
      propriedadeId: 1,
      vigenteDesde: "1900-01-01",
      inicial: true,
      ordenhas: [{ posicaoId: "p", nome: "Manhã", ordem: 1, horario: null }],
    },
    sessoes: [
      {
        id: null,
        versao: 0,
        posicaoId: "p",
        nome: "Manhã",
        ordem: 1,
        horario: null,
        totais: resumo,
      },
    ],
    animais: [
      {
        animalId: "a",
        brinco: "123",
        nome: "Aurora",
        participanteId: null,
        finalidade: { estado: "COMPROVADA", finalidadeId: "f", aptidao: "LEITE", dataOperacional: "2026-10-19", regra: "FINALIDADE_LEITE_V1" },
    lactacaoId: null,
        localizacaoId: "loc",
        excluidoEm: null,
        motivoExclusao: null,
        pendencias: [],
        medicoes: [
          {
            id: null,
            posicaoId: "p",
            estado: "PENDENTE",
            litros: null,
            motivo: null,
            versao: 0,
          },
        ],
        totais: resumo,
      },
    ],
    animaisExcluidos: [],
    impedimentos: [],
    totais: resumo,
  };
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  history.replaceState(null, "", "/pecuaria/leite?dataOperacional=2026-10-19");
  setPropriedadeAtiva(1);
  vi.mocked(obterFolha).mockResolvedValue(folha());
});
describe("Folha de ordenha", () => {
  it("exige justificativa e envia a identidade do animal na exclusão", async () => {
    vi.mocked(obterFolha).mockResolvedValue({ ...folha(1), congelada: true });
    vi.mocked(salvarFolha).mockResolvedValue(folha(2));
    render(<Leite podeLancar />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.click(screen.getByRole("button", { name: "Excluir do dia" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await screen.findByRole("alert");
    expect(salvarFolha).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Motivo da alteração/), {
      target: { value: "Animal fora da ordenha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalled());
    expect(vi.mocked(salvarFolha).mock.calls[0][0]).toMatchObject({
      animaisExcluir: ["a"],
      motivoCorrecao: "Animal fora da ordenha",
    });
  });
  it("inclui fêmea sem lactação a partir dos candidatos da data", async () => {
    vi.mocked(obterCandidatos).mockResolvedValue({
      itens: [
        {
          animalId: "b",
          brinco: "456",
          nome: "Jasmim",
          finalidade: { estado: "COMPROVADA", finalidadeId: "f", aptidao: "LEITE", dataOperacional: "2026-10-19", regra: "FINALIDADE_LEITE_V1" },
    lactacaoId: null,
          pendencias: ["LACTACAO_NAO_INFORMADA"],
        },
      ],
      total: 1,
      pagina: 1,
      porPagina: 10,
      impedimentos: [],
    });
    vi.mocked(salvarFolha).mockResolvedValue(folha(1));
    render(<Leite podeLancar />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.click(screen.getByRole("button", { name: "Incluir animal" }));
    await screen.findByRole("button", { name: "Incluir" });
    fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
    await screen.findByLabelText("Litros de Jasmim, brinco 456");
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalled());
    expect(vi.mocked(salvarFolha).mock.calls[0][0].animaisAdicionar).toEqual([
      "b",
    ]);
    expect(obterCandidatos).toHaveBeenCalledWith("2026-10-19", "", 1, 1);
  });
  it("troca de dia preserva o rascunho somente na sua data", async () => {
    render(<Leite podeLancar />);
    fireEvent.change(
      await screen.findByLabelText("Litros de Aurora, brinco 123"),
      {
        target: { value: "8" },
      },
    );
    vi.mocked(obterFolha).mockResolvedValue({
      ...folha(),
      dataOperacional: "2026-10-18",
    });
    fireEvent.change(screen.getByLabelText("Data operacional"), {
      target: { value: "2026-10-18" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            "Litros de Aurora, brinco 123",
          ) as HTMLInputElement
        ).value,
      ).toBe(""),
    );
    expect(sessionStorage.getItem("terrano:leite:1:2026-10-19")).toContain(
      '"litros":8',
    );
    expect(sessionStorage.getItem("terrano:leite:1:2026-10-18")).toBeNull();
  });

  it("salva com sucesso e remove o rascunho sem afirmar completude operacional", async () => {
    const retorno = folha(1);
    retorno.animais[0].medicoes[0] = {
      ...retorno.animais[0].medicoes[0],
      estado: "MEDIDO",
      litros: 4,
    };
    vi.mocked(salvarFolha).mockResolvedValue(retorno);
    render(<Leite podeLancar />);
    fireEvent.change(
      await screen.findByLabelText("Litros de Aurora, brinco 123"),
      {
        target: { value: "4" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Salvar ordenha",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    expect(sessionStorage.getItem("terrano:leite:1:2026-10-19")).toBeNull();
    expect(screen.queryByText("Concluída")).toBeNull();
  });
  it("reutiliza payload e chave do retry após reabrir a tela com resposta perdida", async () => {
    vi.mocked(salvarFolha).mockRejectedValue(new Error("Resposta perdida"));
    const primeira = render(<Leite podeLancar />);
    fireEvent.change(
      await screen.findByLabelText("Litros de Aurora, brinco 123"),
      {
        target: { value: "3" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await screen.findByRole("alert");
    const input = vi.mocked(salvarFolha).mock.calls[0][0];
    primeira.unmount();
    const atual = folha(1);
    atual.animais[0].medicoes[0] = {
      ...atual.animais[0].medicoes[0],
      estado: "MEDIDO",
      litros: 3,
    };
    vi.mocked(obterFolha).mockResolvedValue(atual);
    render(<Leite podeLancar />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salvarFolha).mock.calls[1][0]).toEqual(input);
  });

  it("salva zero explicitamente e conserva a chave ao repetir payload após erro", async () => {
    vi.mocked(salvarFolha).mockRejectedValue(new Error("Conexão perdida"));
    render(<Leite podeLancar />);
    const input = await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await screen.findByRole("alert");
    const primeiro = vi.mocked(salvarFolha).mock.calls[0][0];
    expect(primeiro.medicoes[0]).toMatchObject({ estado: "MEDIDO", litros: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salvarFolha).mock.calls[1][0].chave).toBe(primeiro.chave);
    expect(sessionStorage.getItem("terrano:leite:1:2026-10-19")).toContain(
      '"litros":0',
    );
  });
  it("renova a chave quando o conteúdo muda após falha", async () => {
    vi.mocked(salvarFolha).mockRejectedValue(new Error("Falha"));
    render(<Leite podeLancar />);
    const input = await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await screen.findByRole("alert");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salvarFolha).mock.calls[1][0].chave).not.toBe(
      vi.mocked(salvarFolha).mock.calls[0][0].chave,
    );
  });
  it("salva um animal e conserva os outros rascunhos com a nova versão", async () => {
    const inicial = folha();
    inicial.animais.push({ ...inicial.animais[0], animalId: "b", brinco: "456", nome: "Jasmim", medicoes: inicial.animais[0].medicoes.map(m => ({ ...m })) });
    vi.mocked(obterFolha).mockResolvedValue(inicial);
    const retorno = structuredClone(inicial);
    retorno.versao = 1;
    retorno.animais[0].medicoes[0] = { ...retorno.animais[0].medicoes[0], id: "m-a", estado: "MEDIDO", litros: 4 };
    vi.mocked(salvarFolha).mockResolvedValue(retorno);
    const tela = render(<Leite podeLancar />);
    fireEvent.change(await screen.findByLabelText("Litros de Aurora, brinco 123"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Litros de Jasmim, brinco 456"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Aurora" }));
    await screen.findByText("Salvo no servidor");
    expect(vi.mocked(salvarFolha).mock.calls[0][0]).toMatchObject({ versaoEsperada: 0, medicoes: [{ animalId: "a", litros: 4 }] });
    expect(vi.mocked(salvarFolha).mock.calls[0][0].medicoes).toHaveLength(1);
    expect((screen.getByLabelText("Litros de Jasmim, brinco 456") as HTMLInputElement).value).toBe("7");
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem("terrano:leite:1:2026-10-19")!).versao).toBe(1));
    tela.unmount();
    vi.mocked(obterFolha).mockResolvedValue(retorno);
    render(<Leite podeLancar />);
    expect((await screen.findByLabelText("Litros de Aurora, brinco 123") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Litros de Jasmim, brinco 456") as HTMLInputElement).value).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Jasmim" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salvarFolha).mock.calls[1][0]).toMatchObject({ versaoEsperada: 1, medicoes: [{ animalId: "b", litros: 7 }] });
  });
  it("mostra falha por animal e reaproveita a tentativa ao reabrir", async () => {
    vi.mocked(salvarFolha).mockRejectedValue(new Error("Sem rede"));
    const tela = render(<Leite podeLancar />);
    fireEvent.change(await screen.findByLabelText("Litros de Aurora, brinco 123"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Aurora" }));
    await screen.findByText("Falha ao salvar · rascunho local");
    const enviado = vi.mocked(salvarFolha).mock.calls[0][0];
    tela.unmount();
    render(<Leite podeLancar />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Aurora" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(2));
    expect(vi.mocked(salvarFolha).mock.calls[1][0]).toEqual(enviado);
  });
  it("preserva chave de A após tentar salvar B entre falhas e reabrir", async () => {
 const inicial=folha();
 inicial.animais.push({...inicial.animais[0],animalId:"b",brinco:"456",nome:"Jasmim",medicoes:inicial.animais[0].medicoes.map(m=>({...m}))});
 vi.mocked(obterFolha).mockResolvedValue(inicial);
 vi.mocked(salvarFolha).mockRejectedValue(new Error("Resposta perdida ou conflito"));
 const tela = render(<Leite podeLancar />);
 fireEvent.change(await screen.findByLabelText("Litros de Aurora, brinco 123"),{target:{value:"4"}});
 fireEvent.change(screen.getByLabelText("Litros de Jasmim, brinco 456"),{target:{value:"7"}});
 fireEvent.click(screen.getByRole("button",{name:"Salvar animal · Aurora"}));
 await screen.findByText("Falha ao salvar · rascunho local");
 const a=vi.mocked(salvarFolha).mock.calls[0][0];
 fireEvent.click(screen.getByRole("button",{name:"Salvar animal · Jasmim"}));
 await waitFor(()=>expect(screen.getAllByText("Falha ao salvar · rascunho local")).toHaveLength(2));
 tela.unmount();
 render(<Leite podeLancar />);
 await screen.findByLabelText("Litros de Aurora, brinco 123");
 fireEvent.click(screen.getByRole("button",{name:"Salvar animal · Aurora"}));
 await waitFor(()=>expect(salvarFolha).toHaveBeenCalledTimes(3));
 expect(vi.mocked(salvarFolha).mock.calls[2][0]).toEqual(a);
});

  it("perfil de consulta não recebe ações de escrita", async () => {
    render(<Leite podeLancar={false} />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    expect(screen.queryByRole("button", { name: "Salvar ordenha" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Configurar ordenhas" }),
    ).toBeNull();
    expect(
      (
        screen.getByLabelText(
          "Litros de Aurora, brinco 123",
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
  });
  it("não substitui a data atual com uma resposta antiga", async () => {
    let resolver: ((f: FolhaLeite) => void) | undefined;
    vi.mocked(obterFolha)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      )
      .mockResolvedValueOnce({
        ...folha(),
        dataOperacional: "2026-10-18",
        animais: [],
      });
    render(<Leite podeLancar />);
    fireEvent.change(screen.getByLabelText("Data operacional"), {
      target: { value: "2026-10-18" },
    });
    await screen.findByText(/Nenhum animal na população/);
    resolver?.(folha());
    await waitFor(() =>
      expect(
        screen.queryByLabelText("Litros de Aurora, brinco 123"),
      ).toBeNull(),
    );
    expect(location.search).toContain("2026-10-18");
  });
  it("preserva a versão original do rascunho em conflito", async () => {
    sessionStorage.setItem(
      "terrano:leite:1:2026-10-19",
      JSON.stringify({
        versao: 1,
        celulas: [
          {
            animalId: "a",
            posicaoId: "p",
            estado: "MEDIDO",
            litros: 3,
            motivo: null,
          },
        ],
        excluir: [],
        motivo: "",
      }),
    );
    vi.mocked(obterFolha).mockResolvedValue(folha(2));
    vi.mocked(salvarFolha).mockRejectedValue(new Error("Conflito"));
    render(<Leite podeLancar />);
    await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
    await waitFor(() => expect(salvarFolha).toHaveBeenCalled());
    expect(vi.mocked(salvarFolha).mock.calls[0][0].versaoEsperada).toBe(1);
  });
  it("bloqueia números inválidos em vez de salvar o valor válido anterior", async () => {
    render(<Leite podeLancar />);
    const input = await screen.findByLabelText("Litros de Aurora, brinco 123");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.change(input, { target: { value: "-2" } });
    expect(
      (
        screen.getByRole("button", {
          name: "Salvar ordenha",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(salvarFolha).not.toHaveBeenCalled();
  });
});
it("explica finalidade impeditiva sem interromper a folha dos elegíveis", async () => {
  vi.mocked(obterFolha).mockResolvedValue({ ...folha(), impedimentos: [
    { animalId: "reprodutora", brinco: "456", nome: "Lua", codigo: "FINALIDADE_REPRODUCAO", motivo: "Animal com finalidade Reprodução na data não participa da produção de leite" },
    { animalId: "conflito", brinco: "789", nome: null, codigo: "FINALIDADE_CONFLITANTE", motivo: "Há finalidades sobrepostas na data; concilie o cadastro antes de medir" },
  ] });
  render(<Leite podeLancar />);
  await screen.findByLabelText("Litros de Aurora, brinco 123");
  expect(screen.getByText(/Lua · Brinco 456: Animal com finalidade Reprodução/)).toBeTruthy();
  expect(screen.getByText(/Há finalidades sobrepostas na data/)).toBeTruthy();
  expect(screen.queryByLabelText("Litros de Lua, brinco 456")).toBeNull();
});
it("identifica finalidade pendente preservando litros e modo consulta", async () => {
  const f = folha();
  f.animais[0].finalidade = { ...f.animais[0].finalidade, estado: "PENDENTE_CONCILIACAO", aptidao: null, regra: null };
  f.animais[0].pendencias = ["FINALIDADE_NAO_COMPROVADA"];
  f.animais[0].medicoes[0] = { ...f.animais[0].medicoes[0], estado: "MEDIDO", litros: 12 };
  vi.mocked(obterFolha).mockResolvedValue(f);
  render(<Leite podeLancar={false} />);
  await screen.findByText("Finalidade histórica a conciliar; litros registrados preservados");
  expect(screen.getAllByText("12 L").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Salvar ordenha" })).toBeNull();
});
it("situação no seletor compartilhado conserva motivo e rascunho após falha do salvamento individual", async () => {
  vi.mocked(salvarFolha).mockRejectedValue(new Error("Falha na gravação individual"));
  render(<Leite podeLancar />);
  await screen.findByLabelText("Litros de Aurora, brinco 123");
  await selecionarCampoLeite("Situação de Aurora, brinco 123", "NAO_ORDENHADO");
  expect((screen.getByLabelText("Litros de Aurora, brinco 123") as HTMLInputElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Motivo de Aurora, brinco 123"), { target: { value: "Animal em descanso" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Aurora" }));
  await screen.findByText(/Falha na gravação individual/);
  expect(vi.mocked(salvarFolha).mock.calls[0][0].medicoes).toEqual([expect.objectContaining({ animalId: "a", estado: "NAO_ORDENHADO", litros: null, motivo: "Animal em descanso" })]);
  expect((screen.getByLabelText("Motivo de Aurora, brinco 123") as HTMLInputElement).value).toBe("Animal em descanso");
  expect(sessionStorage.getItem("terrano:leite:1:2026-10-19")).toContain("Animal em descanso");
});
it("seletor de situação mantém zero medido distinto de pendente", async () => {
  render(<Leite podeLancar />);
  await screen.findByLabelText("Litros de Aurora, brinco 123");
  await selecionarCampoLeite("Situação de Aurora, brinco 123", "MEDIDO");
  expect((screen.getByLabelText("Litros de Aurora, brinco 123") as HTMLInputElement).value).toBe("0");
  expect(screen.getByRole("combobox", { name: "Situação de Aurora, brinco 123" }).textContent).toContain("0 litro medido");
  await selecionarCampoLeite("Situação de Aurora, brinco 123", "PENDENTE");
  expect((screen.getByLabelText("Litros de Aurora, brinco 123") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("combobox", { name: "Situação de Aurora, brinco 123" }).textContent).toContain("Pendente");
});

for (const entrada of ["31/02/2026", "12/1", ""]) it(`não grava animal nem ordenha com data operacional digitada inválida (${entrada || "vazia"})`, async () => {
  vi.mocked(salvarFolha).mockResolvedValue(folha(1));
  render(<Leite podeLancar />);
  const litros = await screen.findByLabelText("Litros de Aurora, brinco 123") as HTMLInputElement;
  fireEvent.change(litros, { target: { value: "8" } });
  const campo = screen.getByLabelText("Data operacional") as HTMLInputElement;
  fireEvent.change(campo, { target: { value: entrada } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar animal · Aurora" }));
  expect(salvarFolha).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
  expect(salvarFolha).not.toHaveBeenCalled();
  expect(campo.value).toBe(entrada);
  expect(litros.value).toBe("8");
  fireEvent.change(campo, { target: { value: "19/10/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
  await waitFor(() => expect(salvarFolha).toHaveBeenCalledTimes(1));
  expect(salvarFolha).toHaveBeenCalledWith(expect.objectContaining({ dataOperacional: "2026-10-19", medicoes: [expect.objectContaining({ animalId: "a", litros: 8 })] }));
});
