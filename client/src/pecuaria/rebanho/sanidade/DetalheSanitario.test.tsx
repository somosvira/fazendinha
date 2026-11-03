// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as permissoesFinanceiras from "../../../financeiro/permissoes";
import { DetalheSanitario } from "./DetalheSanitario";
vi.mock("./HistoricoExame", () => ({ HistoricoExame: () => <section>Histórico preservado</section> }));
vi.mock("../../../estoque/navegacao", () => ({ podeAcessarArea: () => true }));
afterEach(cleanup);
it("exibe nomes históricos no desvio e oculta IDs legados sem nome preservado", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  render(<DetalheSanitario tipo="exame" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: { exibicao: { planejado: { tipoExameId: "Exame histórico" }, realizado: { tipoExameId: "Exame realizado" } }, diferencas: [{ campo: "tipoExameId", planejado: id, realizado: id }, { campo: "produtoId", planejado: id, realizado: id }], motivo: "Mudança autorizada" } }} />);
  expect(screen.getByText("Tipo de exame: Exame histórico → Exame realizado")).toBeTruthy();
  expect(screen.getByText("Produto: Identificação não disponível no registro original → Identificação não disponível no registro original")).toBeTruthy();
  expect(document.body.textContent).not.toContain(id);
});
it("distingue snapshot antigo não aferido de execução conforme o planejado", () => {
  const { rerender } = render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: null }} />);
  expect(screen.getByText("Desvio não aferido no registro original.")).toBeTruthy();
  expect(screen.queryByText("Conforme o planejado.")).toBeNull();
  rerender(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: { referencia: "SNAPSHOT_PLANEJADO", diferencas: [], motivo: null } }} />);
  expect(screen.getByText("Conforme o planejado.")).toBeTruthy();
  expect(screen.queryByText("Desvio não aferido no registro original.")).toBeNull();
  rerender(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ tarefaId: "t", desvioProtocoloSnapshot: { referencia: "LEGADO_SEM_SNAPSHOT", diferencas: [], motivo: "Histórico revisado" } }} />);
  expect(screen.getByText(/Conformidade não aferida/)).toBeTruthy();
  expect(screen.queryByText("Conforme o planejado.")).toBeNull();
});
it("mostra snapshots, horário, vínculos e compra sem expor referência técnica", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ animal: { id: "a1", brinco: "GV3-1", nome: null }, propriedadeId: 1, aplicadaEm: "2026-10-05T13:04:00Z", tipoAplicacaoNomeSnapshot: "Tratamento antigo", nomeProdutoAplicado: "Medicamento histórico", origemInsumo: "COMPRA_CONSUMO_DIRETO", status: "VALIDO", referenciaCarencia: "Não mostrar", compraDireta: { quantidadeDestinada: "2", unidade: "mL", operacao: { id: "op1", numero: 12 } }, estorno: { id: "m1" } }} />);
  expect(screen.getByText("05/10/2026 às 10:04")).toBeTruthy();
  expect(screen.getByText("Tratamento antigo")).toBeTruthy();
  expect(screen.getByRole("link", { name: "GV3-1" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Operação #12" }).getAttribute("href")).toBe("/financeiro/operacoes/op1");
  expect(screen.queryByText("Não mostrar")).toBeNull();
  expect(screen.queryByText("null")).toBeNull();
});
it("preserva o dia de validade e identifica o sítio histórico", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ propriedade: { id: 1, nome: "Sítio de origem" }, partidaValidadeSnapshot: "2027-09-17T00:00:00.000Z", data: "2026-10-05T00:00:00.000Z" }} />);
  expect(screen.getByText("17/09/2027")).toBeTruthy();
  expect(screen.getByText("05/10/2026")).toBeTruthy();
  expect(screen.getByText("Sítio de origem")).toBeTruthy();
});
it("torna a justificativa original consultável mesmo após reconciliar a origem", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ origemInsumo: "BAIXA_ESTOQUE", justificativaSemOrigem: "Aplicação de campo sem comprovante de origem" }} />);
  expect(screen.getByText("Justificativa original da origem:")).toBeTruthy();
  expect(screen.getByText("Aplicação de campo sem comprovante de origem")).toBeTruthy();
});
it("distingue o Produto vinculado do nome preservado da aplicação", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ produto: { id: "p1", nome: "Nome cadastrado" }, nomeProdutoAplicado: "Nome usado no campo" }} />);
  expect(screen.getByRole("link", { name: "Nome cadastrado" }).getAttribute("href")).toBe("/estoque/produtos/p1");
  expect(screen.getByText(/Nome histórico do medicamento/).parentElement?.textContent).toContain("Nome usado no campo");
});

it("organiza o exame sem recolher resultado, observações e autoria", () => {
  render(<DetalheSanitario tipo="exame" abrir={vi.fn()} valor={{ id: "exame-1", data: "2026-10-26", animal: { id: "a", brinco: "RN01" }, propriedade: { nome: "Sede" }, tipoExame: { nome: "Exame de referência" }, status: "VALIDO", formatoSnapshot: { tipoResultado: "NUMERO", unidade: "mg" }, resultadoNumero: "0", responsavel: "Veterinária", observacao: "Conferir amostra preservada.", criadoEm: "2026-10-26T13:00:00Z", criadoPor: { nome: "Ana" } }} />);
  expect(screen.getByRole("region", { name: "Resultado do exame" }).textContent).toContain("0 mg");
  expect(screen.getByText("Válido")).toBeTruthy();
  expect(screen.getByText("Conferir amostra preservada.")).toBeTruthy();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.getByText("Histórico preservado")).toBeTruthy();
  expect(document.querySelector("details")).toBeNull();
});
it("mantém zero, falso e JSON composto nos resultados múltiplos", () => {
  render(<DetalheSanitario tipo="exame" abrir={vi.fn()} valor={{ id: "exame-2", formatoSnapshot: { tipoResultado: "MULTIPLO", campos: [{ codigo: "contagem", nome: "Contagem" }, { codigo: "reagente", nome: "Reagente" }, { codigo: "dados", nome: "Dados da amostra" }] }, resultados: [{ campo: "contagem", valor: 0 }, { campo: "reagente", valor: false }, { campo: "dados", valor: { lote: "A", valor: 0, reagente: false } }] }} />);
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.getByText("Não")).toBeTruthy();
  expect(screen.getByText('{"lote":"A","valor":0,"reagente":false}')).toBeTruthy();
  expect(screen.queryByText("[object Object]")).toBeNull();
});

it("separa custo comprovado dos detalhes e conserva cobertura parcial", () => {
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ status: "VALIDO", responsavel: "Ana", data: "2026-10-30", resumoCusto: { cobertura: "PARCIAL", situacao: "PARCIAL", totalConhecido: "12.30", componentes: [{ chave: "produto", natureza: "MATERIAL", valor: "12.30", estado: "CONHECIDO" }, { chave: "servico", natureza: "SERVICO", valor: null, estado: "DESCONHECIDO" }], limitacoes: ["Custos indiretos fora deste total"] } }} />);
  expect(screen.getByRole("heading", { name: "Detalhes" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Custo da aplicação" })).toBeTruthy();
  expect(screen.getByText("Parcelas conhecidas · parcial")).toBeTruthy();
  expect(screen.getByText("Serviço / procedimento atribuído")).toBeTruthy();
  expect(screen.getByText("Custos indiretos fora deste total")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Serviço/ })).toBeNull();
});

it("tarefa usa somente o planejamento recebido e não inventa responsável ou reavaliação", () => {
  render(<DetalheSanitario tipo="tarefa" abrir={vi.fn()} valor={{ id: "t", previstaPara: "2026-11-01", situacao: "PENDENTE", parametros: { tipo: "EXAME", tipoExameNomeSnapshot: "Avaliação registrada" }, execucao: { animal: { id: "a", brinco: "RN02" }, protocolo: { nome: "Protocolo real", versao: 2 } } }} />);
  expect(screen.getByText("01/11/2026")).toBeTruthy();
  expect(screen.getByText("Avaliação registrada")).toBeTruthy();
  expect(screen.getByText(/Protocolo real/)).toBeTruthy();
  expect(screen.queryByText("Próxima reavaliação")).toBeNull();
});

it("custos operacionais não concedem acesso ao documento financeiro sem verValores", () => {
  const gate = vi.spyOn(permissoesFinanceiras, "podeVerValoresFinanceiros").mockReturnValue(false);
  render(<DetalheSanitario tipo="aplicacao" abrir={vi.fn()} valor={{ operacaoServicoId: "servico", operacaoServico: { numero: 42 }, resumoCusto: { cobertura: "COMPLETO", situacao: "COMPLETO", totalConhecido: "7.40", componentes: [{ chave: "servico", natureza: "SERVICO", valor: "7.40", estado: "CONHECIDO" }], limitacoes: [] } }} />);
  expect(screen.getByText("Serviço vinculado")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Operação #42/ })).toBeNull();
  expect(screen.getByText("Custo direto registrado")).toBeTruthy();
  gate.mockRestore();
});

it("abre o fato realizado pelo sítio próprio mesmo quando a tarefa pertence a outro sítio", () => {
  const abrir = vi.fn();
  render(<DetalheSanitario tipo="tarefa" abrir={abrir} valor={{ id: "t", execucao: { propriedadeId: 2 }, aplicacoes: [{ id: "aplicacao-b", propriedadeId: 9, data: "2026-10-30" }] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Aplicação · 30/10/2026" }));
  expect(abrir).toHaveBeenCalledWith("aplicacao", "aplicacao-b", 9);
});
