// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PreparacaoAutomacao } from "./PreparacaoAutomacao";
import { reqProtocolo } from "./api";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("../../../financeiro/PainelCadastro", () => ({ classeInput: "input", PainelCadastro: ({ titulo, children, rodape }: { titulo: string; children: ReactNode; rodape: ReactNode }) => <section><h2>{titulo}</h2>{children}{rodape}</section> }));
vi.mock("../sanidade/FormAplicacaoServico", () => ({ FormAplicacaoServico: ({ onConferirConjunto }: { onConferirConjunto: (itens: unknown[]) => Promise<void> }) => <button onClick={() => void onConferirConjunto([{ animalId: "a", propriedadeId: 1, data: "2026-11-03", produtoId: "produto", partidaId: "lote", dose: "2", unidadeDose: "ML" }])}>Guardar preparação</button> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const etapas = [{ id: "e", nome: "Aplicação", tipo: "APLICACAO" as const, intervalo: 0, unidade: "DIAS" as const, momento: { nome: "Dia zero", ordem: 1, politicaExecucao: "AUTOMATICA_EXCECAO" as const, horarioPadrao: "08:00", fusoHorario: "America/Sao_Paulo" } }];
it("usa prévia do servidor e guarda preparo sem confirmar fatos ou enviar identidades do executor", async () => {
  vi.mocked(reqProtocolo).mockResolvedValue({ automacaoHabilitada: true, itens: [{ animalId: "a", etapaId: "e", programadaPara: "2026-11-03T11:00:00Z", vencida: false, previsaoPendente: false }] });
  const mudar = vi.fn();
  render(<PreparacaoAutomacao etapas={etapas} animais={[{ id: "a", brinco: "101" }]} propriedadeId={1} protocoloId="modelo" inicio="2026-11-03" onChange={mudar} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Preparar" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button", { name: "Preparar" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar preparação" }));
  await waitFor(() => expect(mudar).toHaveBeenLastCalledWith([{ animalId: "a", etapaId: "e", dados: { tipo: "APLICACAO", cienciaSanitaria: false, produtoId: "produto", partidaId: "lote", dose: "2", unidadeDose: "ML" } }], true, []));
  expect(reqProtocolo).toHaveBeenCalledTimes(1);
  expect(vi.mocked(reqProtocolo).mock.calls[0][0]).toBe("/automacoes/previa-adesao");
});
it("etapa vencida exige revisão e não recebe preparação automática silenciosa", async () => {
  vi.mocked(reqProtocolo).mockResolvedValue({ automacaoHabilitada: true, itens: [{ animalId: "a", etapaId: "e", programadaPara: "2026-11-03T11:00:00Z", vencida: true, previsaoPendente: false }] });
  const mudar = vi.fn();
  render(<PreparacaoAutomacao etapas={etapas} animais={[{ id: "a", brinco: "101" }]} propriedadeId={1} protocoloId="modelo" inicio="2026-11-03" onChange={mudar} />);
  fireEvent.click(await screen.findByRole("button", { name: "Revisar etapa vencida" }));
  fireEvent.change(screen.getByLabelText("Como tratar esta etapa?"), { target: { value: "REGISTRAR_MANUALMENTE" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferir o registro de campo" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar revisão" }));
  await waitFor(() => expect(mudar).toHaveBeenLastCalledWith([], true, [{ animalId: "a", etapaId: "e", decisao: "REGISTRAR_MANUALMENTE", motivo: "Conferir o registro de campo" }]));
});
