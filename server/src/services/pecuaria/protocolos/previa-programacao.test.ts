import { expect, it, vi } from "vitest";
import { AvisoAptidaoProgramacao } from "../reproducao/elegibilidade.js";
import { preverAutomacoesAdesao } from "./automacao.js";
import { RebanhoError } from "../rebanho/regras.js";
import { conferirDisponibilidadeTx } from "../reproducao/registros.js";
import { preverParticipacaoIndividual } from "./operacao.js";
import { obterContextosAnimaisNaDataTx } from "../reproducao/contexto-animal.js";
import { obterElegibilidadesNaDataTx } from "../reproducao/elegibilidade.js";
import { preverProgramacaoColetiva } from "./previa-programacao.js";

const animais = vi.hoisted(() => [
  { id: "00000000-0000-4000-8000-000000000001", brinco: "DEV-001", nome: null },
  { id: "00000000-0000-4000-8000-000000000002", brinco: "DEV-002", nome: "Aurora" },
]);
vi.mock("../transacao.js", () => ({
  timeoutTransacaoAnimais: () => 30000,
  transacaoPecuaria: (executar: (tx: unknown) => unknown) => executar({
    animal: { findMany: async () => [...animais].reverse().map(a => ({ ...a, localizacoes: [{ lote: null }] })) },
    etapaProtocolo: { findMany: async () => [] },
  }),
}));
vi.mock("../reproducao/contexto-animal.js", () => ({ obterContextosAnimaisNaDataTx: vi.fn(async () => new Map()) }));
vi.mock("../reproducao/elegibilidade.js", async original => ({ ...await original<typeof import("../reproducao/elegibilidade.js")>(), obterElegibilidadesNaDataTx: vi.fn(async () => new Map()) }));
vi.mock("../reproducao/registros.js", () => ({ conferirDisponibilidadeTx: vi.fn() }));
vi.mock("./operacao.js", () => ({ preverParticipacaoIndividual: vi.fn() }));
vi.mock("./automacao.js", () => ({ preverAutomacoesAdesao: vi.fn() }));

it("bloqueia a prévia quando um participante posterior não tem aptidão", async () => {
  vi.mocked(conferirDisponibilidadeTx).mockResolvedValueOnce({} as Awaited<ReturnType<typeof conferirDisponibilidadeTx>>)
    .mockRejectedValueOnce(new RebanhoError("VALIDACAO", "Animal sem aptidão confirmada nesta data", "animalId"));
  await expect(preverProgramacaoColetiva({
    propriedadeId: 1,
    protocoloId: "00000000-0000-4000-8000-000000000003",
    inicioReferencia: "2026-01-10",
    animaisIds: animais.map(animal => animal.id),
    cienciaSanitaria: true,
  })).rejects.toMatchObject({ campo: "animalId", message: "DEV-002 · Aurora: Animal sem aptidão confirmada nesta data" });
  expect(conferirDisponibilidadeTx).toHaveBeenNthCalledWith(2, expect.anything(), animais[1].id, 1, expect.any(Date), "IATF", true);
  expect(preverParticipacaoIndividual).not.toHaveBeenCalled();
});

it("lista os animais com aviso de aptidão na prévia da nova programação", async () => {
  vi.mocked(conferirDisponibilidadeTx).mockRejectedValue(new AvisoAptidaoProgramacao("Aguarda exame"));
  vi.mocked(preverParticipacaoIndividual).mockResolvedValueOnce({
    tipo: "REPRODUTIVO", modo: "INDIVIDUAL", animal: animais[0], propriedadeId: 1,
    inicioReferencia: "2026-01-10", precisaoTemporal: "DIA", avisos: [],
    protocolo: { id: "protocolo", tipo: "REPRODUTIVO", nome: "Protocolo", versao: 1 },
    itens: [], total: 0, pagina: 1, porPagina: 10,
  });
  vi.mocked(preverAutomacoesAdesao).mockResolvedValueOnce({ itens: [], automacaoHabilitada: false, referencia: "2026-01-10" });
  await expect(preverProgramacaoColetiva({
    propriedadeId: 1,
    protocoloId: "00000000-0000-4000-8000-000000000003",
    inicioReferencia: "2026-01-10",
    animaisIds: animais.map(animal => animal.id),
    aptidaoComoAviso: true,
  })).resolves.toMatchObject({
    participantes: animais,
    avisosAptidao: [
      { animalId: animais[0].id, mensagem: "DEV-001: Aguarda exame" },
      { animalId: animais[1].id, mensagem: "DEV-002 · Aurora: Aguarda exame" },
    ],
  });
});

it("aceita 101 IDs na prévia e confirmação sem truncar", async () => {
  const { previaProgramacaoSchema } = await import("./previa-programacao.js");
  const { programacaoSchema } = await import("../reproducao/schemas.js");
  const ids = Array.from({ length: 101 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
  const comum = { propriedadeId: 1, protocoloId: "00000000-0000-4000-8000-000000000999" };
  expect(previaProgramacaoSchema.parse({ ...comum, inicioReferencia: "2026-01-10", animaisIds: ids }).animaisIds).toEqual(ids);
  expect(programacaoSchema.parse({ ...comum, nome: "IATF", chave: "00000000-0000-4000-8000-000000000998", inicioPrevisto: "2026-01-10", animais: ids.map(animalId => ({ animalId })) }).animais.map(a => a.animalId)).toEqual(ids);
});

it("confere cada um dos 101 participantes e devolve o conjunto completo", async () => {
  const anteriores = [...animais];
  animais.splice(0, animais.length, ...Array.from({ length: 101 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, brinco: `B${i}`, nome: null })));
  try {
    vi.mocked(conferirDisponibilidadeTx).mockReset().mockResolvedValue({} as Awaited<ReturnType<typeof conferirDisponibilidadeTx>>);
    vi.mocked(preverParticipacaoIndividual).mockResolvedValue({ tipo: "REPRODUTIVO", modo: "INDIVIDUAL", animal: animais[0], propriedadeId: 1, inicioReferencia: "2026-01-10", precisaoTemporal: "DIA", avisos: [], protocolo: { id: "p", tipo: "REPRODUTIVO", nome: "Protocolo", versao: 1 }, itens: [], total: 0, pagina: 1, porPagina: 10 });
    vi.mocked(preverAutomacoesAdesao).mockResolvedValue({ itens: [], automacaoHabilitada: false, referencia: "2026-01-10" });
    const resultado = await preverProgramacaoColetiva({ propriedadeId: 1, protocoloId: "00000000-0000-4000-8000-000000000999", inicioReferencia: "2026-01-10", animaisIds: animais.map(a => a.id), aptidaoComoAviso: true });
    expect(resultado.participantes.map(a => a.id)).toEqual(animais.map(a => a.id));
    expect(conferirDisponibilidadeTx).toHaveBeenCalledTimes(101);
  } finally { animais.splice(0, animais.length, ...anteriores); }
});


it("expõe contexto em lote na data da disponibilidade, preservando zero", async () => {
  vi.mocked(conferirDisponibilidadeTx).mockReset().mockResolvedValue({} as Awaited<ReturnType<typeof conferirDisponibilidadeTx>>);
  vi.mocked(obterContextosAnimaisNaDataTx).mockResolvedValueOnce(new Map([[animais[0].id, { situacaoReprodutiva: "VAZIA", situacaoProdutiva: "LACTANTE", del: 0, ultimoParto: null, partosRealizados: 0, tentativasCiclo: 0 }]]) as Awaited<ReturnType<typeof obterContextosAnimaisNaDataTx>>);
  vi.mocked(obterElegibilidadesNaDataTx).mockResolvedValueOnce(new Map([[animais[0].id, { aptidao: { estado: "PENDENTE" } }]]) as Awaited<ReturnType<typeof obterElegibilidadesNaDataTx>>);
  vi.mocked(preverParticipacaoIndividual).mockResolvedValue({ tipo: "REPRODUTIVO", modo: "INDIVIDUAL", animal: animais[0], propriedadeId: 1, inicioReferencia: "2026-01-10", precisaoTemporal: "DIA", avisos: [], protocolo: { id: "p", tipo: "REPRODUTIVO", nome: "Protocolo", versao: 1 }, itens: [], total: 0, pagina: 1, porPagina: 10 });
  vi.mocked(preverAutomacoesAdesao).mockResolvedValue({ itens: [], automacaoHabilitada: false, referencia: "2026-01-10" });
  const resultado = await preverProgramacaoColetiva({ propriedadeId: 1, protocoloId: "00000000-0000-4000-8000-000000000999", inicioReferencia: "2026-01-10", animaisIds: animais.map(a => a.id), aptidaoComoAviso: true });
  expect(resultado.dataReferenciaContexto).toBe("2026-01-10");
  expect(resultado.participantes[0]).toMatchObject({ situacao: "VAZIA", del: 0, ultimoParto: null, partos: 0, tentativasCiclo: 0, aptidao: "PENDENTE" });
  expect(resultado.participantes[1]).toMatchObject({ situacao: null, del: null, partos: null, tentativasCiclo: null, aptidao: null });
  expect(obterContextosAnimaisNaDataTx).toHaveBeenCalledWith(expect.anything(), animais.map(a => a.id).reverse(), expect.any(Date));
});
