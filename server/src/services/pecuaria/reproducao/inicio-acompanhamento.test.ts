import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { iniciarParticipanteTx } from "./iatf.js";
import { conferirAptidaoParaAcaoTx } from "./elegibilidade.js";
import { conferirMatrizTx } from "./registros.js";

vi.mock("./elegibilidade.js", () => ({ conferirAptidaoParaAcaoTx: vi.fn() }));
vi.mock("./registros.js", async original => ({ ...await original<typeof import("./registros.js")>(), conferirMatrizTx: vi.fn() }));

function fixture() {
  const participante = { id: "participacao", animalId: "animal", inicioEfetivo: null, encerradoEm: null };
  const comum = { ...participante, propriedadeId: 7, protocoloId: "protocolo", origemCalendario: "REFERENCIA_PROGRAMADA", rodada: null };
  const db = {
    $executeRaw: vi.fn(),
    participanteIatf: { findUnique: vi.fn().mockResolvedValue(participante), findUniqueOrThrow: vi.fn().mockResolvedValue(participante) },
    participacaoProtocolo: { findFirst: vi.fn().mockResolvedValue(comum), update: vi.fn().mockResolvedValue(comum) },
    protocoloIatf: { findUniqueOrThrow: vi.fn().mockResolvedValue({ etapas: [] }) },
    auditoriaPecuaria: { create: vi.fn() },
  };
  return { tx: db as unknown as Prisma.TransactionClient, db };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(conferirAptidaoParaAcaoTx).mockRejectedValue(new Error("GESTACAO_CONFIRMADA"));
});

describe("início efetivo pelo primeiro atendimento de uma gestante", () => {
  it.each(["EXAME", "AVALIACAO"] as const)("%s registra início sem exigir aptidão para nova reprodução", async acao => {
    const f = fixture();
    await iniciarParticipanteTx(f.tx, "participacao", 7, "2026-01-25", null, false, acao);
    expect(conferirMatrizTx).toHaveBeenCalledWith(f.tx, "animal", 7, new Date("2026-01-25"));
    expect(conferirAptidaoParaAcaoTx).not.toHaveBeenCalled();
    expect(f.db.participacaoProtocolo.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inicioEfetivo: new Date("2026-01-25") }),
    }));
  });
  it.each([undefined, "APLICACAO", "TENTATIVA", "MANEJO", "RETIRADA"] as const)("%s conserva a exigência de aptidão", async acao => {
    const f = fixture();
    await expect(iniciarParticipanteTx(f.tx, "participacao", 7, "2026-01-25", null, false, acao)).rejects.toThrow("GESTACAO_CONFIRMADA");
    expect(f.db.participacaoProtocolo.update).not.toHaveBeenCalled();
  });
});
