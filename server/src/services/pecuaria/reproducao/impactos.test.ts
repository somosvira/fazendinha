import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  transacao: vi.fn(),
  trava: vi.fn(),
  auditar: vi.fn(),
  reconciliar: vi.fn(),
  regras: vi.fn(),
  procedimentos: vi.fn(),
  participacoes: vi.fn(),
  dispositivos: vi.fn(),
  ocorrencia: vi.fn(),
  doenca: vi.fn(),
  participacao: vi.fn(),
  tarefas: vi.fn(),
  jobs: vi.fn(),
}));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn() }));
vi.mock("../rebanho/regras.js", async (original) => ({
  ...(await original<object>()),
  travarAnimais: m.trava,
  auditar: m.auditar,
}));
vi.mock("./alertas/produtor.js", () => ({
  reconciliarAlertasReprodutivosAnimalTx: m.reconciliar,
}));
vi.mock("./operacoes.js", async (original) => ({
  ...(await original<object>()),
  operacaoIdempotenteTx: (
    _tx: unknown,
    _input: unknown,
    _usuario: unknown,
    _tipo: unknown,
    executar: () => Promise<unknown>,
  ) => executar(),
}));
import { preverImpactos } from "./impactos.js";
import { criarOcorrencia } from "../sanidade/ocorrencias.js";
import { regraImpactoProtocolarSchema } from "./impactos.schemas.js";
const id = "9192047d-ab87-4ff6-bbc7-f7c6702eb83a",
  animalId = "9192047d-ab87-4ff6-bbc7-f7c6702eb83b",
  doencaId = "9192047d-ab87-4ff6-bbc7-f7c6702eb83c",
  tipoId = "9192047d-ab87-4ff6-bbc7-f7c6702eb83d";
const entrada = {
  origem: "OCORRENCIA" as const,
  animalId,
  propriedadeId: 1,
  doencaId,
  data: "2026-11-01",
};
const p = () => ({
  id: "participacao",
  protocolo: { nome: "Preparo", versao: 1, finalidade: "IATF" },
  tarefas: [
    {
      id: "tarefa",
      nomeSnapshot: "Aplicação",
      previstaPara: new Date("2026-11-05"),
      realizadaEm: null,
      dispensadaEm: null,
    },
  ],
  automacoes: [
    {
      id: "job",
      estado: "AGENDADA",
      revisao: 1,
      atualizadaEm: new Date("2026-11-01"),
      programadaPara: new Date("2026-11-05"),
    },
  ],
});
const regra = (efeito = "BLOQUEAR", extra = {}) => ({
  id: "regra",
  acao: "IATF",
  motivo: "Regra explícita da fazenda",
  atualizadoEm: new Date("2026-11-01"),
  impactoProtocolar: { versao: 1, gatilho: "OCORRENCIA", efeito, ...extra },
});
beforeEach(() => {
  vi.clearAllMocks();
  m.regras.mockResolvedValue([regra()]);
  m.procedimentos.mockResolvedValue([]);
  m.participacoes.mockResolvedValue([p()]);
  m.dispositivos.mockResolvedValue([
    { id: "insercao", data: new Date("2026-11-01"), tarefaId: "tarefa" },
  ]);
  m.doenca.mockResolvedValue({ id: doencaId, nome: "Doença configurada" });
  m.ocorrencia.mockResolvedValue({ id: "fato", animalId, propriedadeId: 1 });
  m.participacao.mockResolvedValue({});
  const tx = {
    regraSanitariaReprodutiva: { findMany: m.regras },
    regraImpactoProcedimentoReprodutivo: { findMany: m.procedimentos },
    participacaoProtocolo: {
      findMany: m.participacoes,
      update: m.participacao,
    },
    aplicacaoProduto: { findMany: m.dispositivos },
    ocorrenciaSanitaria: { create: m.ocorrencia },
    doenca: { findFirst: m.doenca },
    tarefaProtocolo: { updateMany: m.tarefas },
    automacaoProtocolo: { updateMany: m.jobs },
  };
  m.transacao.mockImplementation(
    (executar: (t: typeof tx) => Promise<unknown>) => executar(tx),
  );
});
describe("impactos explícitos de fatos sanitários", () => {
  it("regra antiga/qualquer doença ou produto não retira participação", async () => {
    m.regras.mockResolvedValue([{ ...regra(), impactoProtocolar: null }]);
    const previa = await preverImpactos(entrada);
    expect(previa.itens).toEqual([]);
    expect(previa.exigeConfirmacao).toBe(false);
    expect(m.ocorrencia).not.toHaveBeenCalled();
  });
  it("procedimento só usa a classificação explícita na regra versionada", async () => {
    m.procedimentos.mockImplementation(async ({ where }) =>
      where.tipoAplicacaoId === tipoId
        ? [
            {
              id: "regra-procedimento",
              tipoAplicacaoId: tipoId,
              finalidade: "IATF",
              efeito: "RETIRAR",
              motivo: "Classificação explícita do procedimento",
              versao: 2,
              atualizadoEm: new Date("2026-11-01"),
            },
          ]
        : [],
    );
    expect(
      (
        await preverImpactos({
          ...entrada,
          origem: "PROCEDIMENTO",
          doencaId: undefined,
          tipoAplicacaoId: doencaId,
        })
      ).itens,
    ).toEqual([]);
    expect(
      (
        await preverImpactos({
          ...entrada,
          origem: "PROCEDIMENTO",
          doencaId: undefined,
          tipoAplicacaoId: tipoId,
        })
      ).itens[0]?.efeito,
    ).toBe("RETIRAR");
    expect(
      regraImpactoProtocolarSchema.safeParse({
        versao: 1,
        gatilho: "PROCEDIMENTO",
        efeito: "RETIRAR",
      }).success,
    ).toBe(false);
  });
  it("prévia lista tarefas, autorização e dispositivo, sem gravar fato", async () => {
    const previa = await preverImpactos(entrada);
    expect(previa.itens[0]).toMatchObject({
      efeito: "BLOQUEAR",
      tarefas: [{ id: "tarefa" }],
      automacoes: [{ id: "job" }],
      dispositivos: [{ id: "insercao" }],
    });
    expect(m.ocorrencia).not.toHaveBeenCalled();
    expect(m.jobs).not.toHaveBeenCalled();
  });
  it("confirmação revalida concorrência com automação antes do fato", async () => {
    const previa = await preverImpactos(entrada);
    m.participacoes.mockResolvedValue([
      {
        ...p(),
        automacoes: [{ ...p().automacoes[0], estado: "EXECUTADA", revisao: 2 }],
      },
    ]);
    await expect(
      criarOcorrencia(
        {
          chave: id,
          animalId,
          propriedadeId: 1,
          doencaId,
          inicio: entrada.data,
          impacto: {
            revisao: previa.revisao,
            motivo: "Revisado antes de confirmar",
          },
        },
        9,
      ),
    ).rejects.toThrow("mudaram");
    expect(m.trava).toHaveBeenCalledWith(expect.anything(), [animalId]);
    expect(m.ocorrencia).not.toHaveBeenCalled();
    expect(m.jobs).not.toHaveBeenCalled();
  });
  it.each(["BLOQUEAR", "RETIRAR", "AVISAR"])(
    "%s confirma fato e efeitos na mesma transação e preserva inserção",
    async (efeito) => {
      m.regras.mockResolvedValue([regra(efeito)]);
      const previa = await preverImpactos(entrada);
      await criarOcorrencia(
        {
          chave: id,
          animalId,
          propriedadeId: 1,
          doencaId,
          inicio: entrada.data,
          impacto: {
            revisao: previa.revisao,
            motivo: "Revisão clínica e operacional",
          },
        },
        9,
      );
      expect(m.ocorrencia).toHaveBeenCalledTimes(1);
      expect(m.auditar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ acao: `IMPACTO_${efeito}` }),
      );
      expect(m.reconciliar).toHaveBeenCalledWith(
        expect.anything(),
        animalId,
        9,
      );
      if (efeito === "AVISAR") {
        expect(m.participacao).not.toHaveBeenCalled();
        expect(m.jobs).not.toHaveBeenCalled();
      } else
        expect(m.jobs).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              estado: "CANCELADA",
              revisao: { increment: 1 },
            }),
          }),
        );
      if (efeito === "RETIRAR")
        expect(m.tarefas).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              execucaoId: "participacao",
              realizadaEm: null,
              dispensadaEm: null,
            },
          }),
        );
      else expect(m.tarefas).not.toHaveBeenCalled();
      // Não existe comando de retirada física nesta transação.
      expect(m.dispositivos).toHaveBeenCalled();
    },
  );
  it("falta de prévia não vira condição clínica nem falha técnica com retirada", async () => {
    await expect(
      criarOcorrencia(
        { animalId, propriedadeId: 1, doencaId, inicio: entrada.data },
        9,
      ),
    ).rejects.toThrow("impactos");
    expect(m.ocorrencia).not.toHaveBeenCalled();
    expect(m.participacao).not.toHaveBeenCalled();
    expect(m.tarefas).not.toHaveBeenCalled();
  });
});
