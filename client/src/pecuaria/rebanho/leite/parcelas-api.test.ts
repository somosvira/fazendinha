// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { confirmarParcelas } from "./parcelas-api";
import { registrarLeite } from "./operacoes-api";
import { getUsuario } from "../../../lib/auth";
vi.mock("./operacoes-api", () => ({ registrarLeite: vi.fn(), consultarLeite: vi.fn() }));
vi.mock("../../../lib/auth", () => ({ getUsuario: vi.fn() }));
const parcelas = [{ medicaoId: "m1", versaoEsperada: 1, produtoId: "p1", motivoNatureza: "Natureza conferida na ordenha" }];
beforeEach(() => { sessionStorage.clear(); vi.mocked(registrarLeite).mockReset(); vi.mocked(getUsuario).mockReturnValue(null); });
function enviada(indice: number) {
  return vi.mocked(registrarLeite).mock.calls[indice][2] as { parcelas: (typeof parcelas[number] & { chave: string })[] };
}
it("reutiliza chaves só no retry e renova após operação concluída ou versão corrigida", async () => {
  vi.mocked(registrarLeite).mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValue({ entradas: [] });
  await expect(confirmarParcelas(1, parcelas)).rejects.toThrow("Resposta perdida");
  const primeira = enviada(0).parcelas[0].chave;
  await confirmarParcelas(1, parcelas);
  expect(enviada(1).parcelas[0].chave).toBe(primeira);
  await confirmarParcelas(1, [{ ...parcelas[0], versaoEsperada: 3, motivoNatureza: "Nova confirmação após anulação" }]);
  expect(enviada(2).parcelas[0].chave).not.toBe(primeira);
  await confirmarParcelas(1, parcelas);
  expect(enviada(3).parcelas[0].chave).not.toBe(primeira);
  expect(enviada(3).parcelas[0].chave).not.toBe("m1");
});
it("não compartilha tentativa pendente entre usuários", async () => {
  vi.mocked(registrarLeite).mockRejectedValue(new Error("Resposta perdida"));
  await expect(confirmarParcelas(9, parcelas)).rejects.toThrow();
  vi.mocked(getUsuario).mockReturnValue({ id: 2, nome: "Outro", email: "outro@example.test", papel: "OPERADOR", abas: [], areas: [], flags: [], status: "ATIVO", dono: false });
  await expect(confirmarParcelas(9, parcelas)).rejects.toThrow();
  expect(enviada(1).parcelas[0].chave).not.toBe(enviada(0).parcelas[0].chave);
});
