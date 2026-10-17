// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ValorizacaoProduto } from "./ValorizacaoProduto";
import { abrirValorEstoque, consultarValorizacao, type DiagnosticoValorizacao } from "./api";

vi.mock("./api", () => ({ abrirValorEstoque: vi.fn(), consultarValorizacao: vi.fn() }));
const hoje = () => new Date().toISOString().slice(0, 10);
const diagnostico = (alteracoes: Partial<DiagnosticoValorizacao> = {}): DiagnosticoValorizacao => ({
  produtoId: "produto", propriedadeId: 2, data: hoje(), revisao: "revisao-conferida",
  grupos: [{ partidaId: null, grupoNome: "Sem rastreio", codigo: null, validade: null, quantidade: "2", quantidadeValorizada: "0",
    estadoValor: "DESCONHECIDO", valor: null, metodo: "FIFO_AQUISICAO_V1" }],
  retroatividade: { permitido: true, motivo: null }, legado: "Valor sem comprovação", ...alteracoes,
});
const alterar = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
async function preparar(dados = diagnostico(), podeEditar = true) {
  vi.mocked(consultarValorizacao).mockResolvedValue(dados);
  const onSalvo = vi.fn();
  render(<ValorizacaoProduto produtoId="produto" propriedadeId={2} podeEditar={podeEditar} onSalvo={onSalvo} />);
  await screen.findByRole("listitem");
  if (podeEditar && dados.grupos.some(g => g.estadoValor === "DESCONHECIDO")) alterar("Saldo a regularizar", "sem-rastreio");
  return onSalvo;
}
function preencherOrigem() {
  alterar("Valor total da origem (R$)", "40");
  alterar("Referência da origem", "Inventário documentado");
  alterar("Evidência do valor", "Documento da aquisição e contagem física");
  alterar("Explicação da abertura", "Saldo remanescente conferido");
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(abrirValorEstoque).mockResolvedValue({ salvo: true, reenvio: false }); });
afterEach(cleanup);

describe("abertura documentada do estoque — contraprovas da interface", () => {
  it("envia aquisições FIFO de 40 e 65 separadas com quantidade física, revisão e evidência", async () => {
    const onSalvo = await preparar();
    preencherOrigem(); alterar("Quantidade da origem", "1");
    fireEvent.click(screen.getByRole("button", { name: "Acrescentar origem comprovada" }));
    const primeira = within(screen.getByRole("group", { name: "Origem 1" }));
    const segunda = within(screen.getByRole("group", { name: "Origem 2" }));
    fireEvent.change(primeira.getByLabelText("Data original da aquisição ou inventário"), { target: { value: "2026-09-01" } });
    fireEvent.change(segunda.getByLabelText("Quantidade da origem"), { target: { value: "1" } });
    fireEvent.change(segunda.getByLabelText("Valor total da origem (R$)"), { target: { value: "65" } });
    fireEvent.change(segunda.getByLabelText("Data original da aquisição ou inventário"), { target: { value: "2026-09-02" } });
    fireEvent.change(segunda.getByLabelText("Referência da origem"), { target: { value: "Segunda aquisição comprovada" } });
    expect(screen.queryByText(/Confira as quantidades/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar abertura documentada" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(abrirValorEstoque).toHaveBeenCalledWith("produto", expect.objectContaining({ propriedadeId: 2, data: hoje(), revisao: "revisao-conferida",
      motivo: "Saldo remanescente conferido", evidencia: "Documento da aquisição e contagem física", bases: [
        { partidaId: null, quantidade: "1", valor: "40", disponivelDesde: "2026-09-01", referencia: "Inventário documentado" },
        { partidaId: null, quantidade: "1", valor: "65", disponivelDesde: "2026-09-02", referencia: "Segunda aquisição comprovada" },
      ] }));
  });

  it("valor vazio não se transforma em zero; zero explicitamente comprovado pode ser confirmado", async () => {
    await preparar(); preencherOrigem(); alterar("Valor total da origem (R$)", "");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar abertura documentada" }));
    expect(abrirValorEstoque).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Valor total da origem (R$)") as HTMLInputElement).validity.valueMissing).toBe(true);
    alterar("Valor total da origem (R$)", "0");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar abertura documentada" }));
    await waitFor(() => expect(abrirValorEstoque).toHaveBeenCalledOnce());
    expect(vi.mocked(abrirValorEstoque).mock.calls[0][1].bases[0].valor).toBe("0");
  });

  it.each(["Evidência do valor", "Explicação da abertura"])("%s obrigatória impede enviar abertura vazia", async rotulo => {
    await preparar(); preencherOrigem(); alterar(rotulo, "");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar abertura documentada" }));
    expect(abrirValorEstoque).not.toHaveBeenCalled();
    expect((screen.getByLabelText(rotulo) as HTMLTextAreaElement).validity.valueMissing).toBe(true);
  });

  it("mostra zero conhecido sem abrir formulário ou chamá-lo de desconhecido", async () => {
    const dados = diagnostico(); dados.grupos[0] = { ...dados.grupos[0], estadoValor: "CONHECIDO", valor: "0.00", quantidadeValorizada: "2" };
    await preparar(dados);
    expect(screen.getByRole("list").textContent).toMatch(/R\$\s*0,00/);
    expect(screen.queryByText(/Valor desconhecido — abertura necessária/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirmar abertura documentada" })).toBeNull();
  });

  it("bloqueia reenvio enquanto grava e conserva revisão/chave e rascunho após erro", async () => {
    let rejeitar!: (erro: Error) => void;
    vi.mocked(abrirValorEstoque).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejeitar = reject; }));
    const onSalvo = await preparar(); preencherOrigem();
    const confirmar = screen.getByRole("button", { name: "Confirmar abertura documentada" });
    fireEvent.click(confirmar); fireEvent.click(confirmar);
    expect(abrirValorEstoque).toHaveBeenCalledOnce();
    expect((confirmar as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Data de corte") as HTMLInputElement).disabled).toBe(true);
    await act(async () => { rejeitar(new Error("Revisão mudou: confira o saldo novamente")); });
    await screen.findByText("Revisão mudou: confira o saldo novamente");
    expect((screen.getByLabelText("Evidência do valor") as HTMLTextAreaElement).value).toBe("Documento da aquisição e contagem física");
    expect(onSalvo).not.toHaveBeenCalled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    const chamadas = vi.mocked(abrirValorEstoque).mock.calls;
    expect(chamadas[1][1]).toEqual(chamadas[0][1]);
  });

  it("data inválida suspende a consulta e respostas de uma data anterior não restauram revisão antiga", async () => {
    let resolver!: (dados: DiagnosticoValorizacao) => void;
    vi.mocked(consultarValorizacao).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
    render(<ValorizacaoProduto produtoId="produto" propriedadeId={2} podeEditar onSalvo={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toMatch(/Conferindo/);
    alterar("Data de corte", "");
    await screen.findByText("Informe uma data de corte válida");
    await act(async () => { resolver(diagnostico()); });
    expect(screen.queryByRole("list")).toBeNull();
    expect(consultarValorizacao).toHaveBeenCalledOnce();
    expect(abrirValorEstoque).not.toHaveBeenCalled();
  });

  it("conflito cronológico deixa explicação visível e impede confirmar abertura", async () => {
    await preparar(diagnostico({ retroatividade: { permitido: false, motivo: "Há fatos posteriores ao corte escolhido" } }));
    preencherOrigem();
    expect(screen.getByText("Há fatos posteriores ao corte escolhido")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirmar abertura documentada" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar abertura documentada" }));
    expect(abrirValorEstoque).not.toHaveBeenCalled();
  });

  it("leitura sem permissão de editar não oferece confirmação", async () => {
    await preparar(diagnostico(), false);
    expect(screen.getByText(/Valor desconhecido — abertura necessária/)).toBeTruthy();
    expect(screen.queryByLabelText("Saldo a regularizar")).toBeNull();
    expect(abrirValorEstoque).not.toHaveBeenCalled();
  });
});
