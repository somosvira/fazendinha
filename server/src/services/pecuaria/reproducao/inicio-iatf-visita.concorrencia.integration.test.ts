import { randomUUID } from "node:crypto";
import { Prisma, type Animal } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { adicionarAtividadeTx, confirmarAtividade, criarVisitaTx } from "./visitas.js";
import { atividadeSchema, confirmacaoVisitaSchema } from "./schemas.js";

const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
async function criarFixture(tx: Prisma.TransactionClient) {
  const token = randomUUID();
  const sitio = await tx.propriedade.create({ data: { nome: `Corrida início visita ${token}` } });
  const animais: Animal[] = [];
  for (let i = 0; i < 4; i++) animais.push(await tx.animal.create({ data: { brinco: `IVC-${token}-${i}`, sexo: "F", origem: "COMPRADO",
    dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"), localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") } } } }));
  const estrutura = await tx.protocolo.create({ data: { nome: `Corrida IATF ${token}`, versao: 1, tipo: "REPRODUTIVO",
    etapas: { create: { nome: "Retirada", ordem: 1, tipo: "RETIRADA", diaRelativo: 1, configuracao: { nome: "Retirada", tipo: "RETIRADA", intervalo: 1, unidade: "DIAS" } } } } });
  const protocolo = await tx.protocolo.update({where:{id:estrutura.id},data:{publicado:true,publicadoEm:new Date()}});
  const visita = await criarVisitaTx(tx, { propriedadeId: sitio.id, data: "2026-10-14", nome: `Visita ${token}` }, null);
  const atividade = await adicionarAtividadeTx(tx, visita.id, atividadeSchema.parse({ propriedadeId: sitio.id, nome: "Turma concorrente", tipo: "INICIAR_IATF",
    contexto: { protocoloId: protocolo.id }, participantes: animais.map(a => ({ animalId: a.id })) }), null);
  return { token, sitio, animais, protocolo, visita, atividade };
}
type Fixture = Awaited<ReturnType<typeof criarFixture>>;
/** Só remove IDs gerados neste teste. Setup atômico; falha no setup não deixa fixtures parciais. */
async function limparFixture(f: Fixture) {
  await prisma.$transaction(async tx => {
    const dono = await tx.propriedade.findFirst({ where: { id: f.sitio.id, nome: `Corrida início visita ${f.token}` } });
    if (!dono) throw new Error("A limpeza exige a identidade exata da fixture");
    const animaisIds = f.animais.map(a => a.id);
    const participacoes = await tx.participacaoProtocolo.findMany({ where: { propriedadeId: f.sitio.id, protocoloId: f.protocolo.id, animalId: { in: animaisIds } }, select: { id: true } });
    await tx.auditoriaPecuaria.deleteMany({ where: { propriedadeId: f.sitio.id } });
    await tx.requisicaoPecuaria.deleteMany({ where: { propriedadeId: f.sitio.id } });
    await tx.participanteVisita.deleteMany({ where: { atividadeId: f.atividade.id, animalId: { in: animaisIds } } });
    await tx.atividadeVisita.delete({ where: { id: f.atividade.id } });
    await tx.visitaVeterinaria.delete({ where: { id: f.visita.id } });
    await tx.tarefaProtocolo.deleteMany({ where: { execucaoId: { in: participacoes.map(p => p.id) } } });
    await tx.participacaoProtocolo.deleteMany({ where: { id: { in: participacoes.map(p => p.id) } } });
    await tx.programacaoProtocolo.deleteMany({ where: { propriedadeId: f.sitio.id, protocoloId: f.protocolo.id } });
    await tx.protocolo.delete({ where: { id: f.protocolo.id } });
    await tx.localizacaoAnimal.deleteMany({ where: { animalId: { in: animaisIds }, propriedadeId: f.sitio.id } });
    await tx.animal.deleteMany({ where: { id: { in: animaisIds } } });
    await tx.propriedade.delete({ where: { id: f.sitio.id } });
  }, { timeout: 30000 });
  expect(await prisma.propriedade.count({ where: { id: f.sitio.id } })).toBe(0);
  expect(await prisma.animal.count({ where: { id: { in: f.animais.map(a => a.id) } } })).toBe(0);
  expect(await prisma.protocolo.count({ where: { id: f.protocolo.id } })).toBe(0);
}
async function comFixtures(executar: (f: Fixture) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  const f = await prisma.$transaction(criarFixture, { timeout: 30000 });
  try { await executar(f); } finally { await limparFixture(f); }
}
function entrada(f: Fixture, indices: number[], chave = randomUUID(), inicioEfetivo = "2026-10-14") {
  return confirmacaoVisitaSchema.parse({ propriedadeId: f.sitio.id, chave, itens: indices.map(i => ({ participanteId: f.atividade.participantes[i].id,
    versaoRascunho: 0, dados: { inicioEfetivo } })) });
}
const confirmar = (f: Fixture, input: ReturnType<typeof entrada>) => confirmarAtividade(f.visita.id, f.atividade.id, input, null);

suite("início IATF — concorrência real com limpeza exclusiva das fixtures", () => {
  it("serializa blocos, recupera reenvio simultâneo e rejeita segunda chave para a mesma linha", async () => comFixtures(async f => {
    // Chamadas simultâneas usam transações/conexões independentes do serviço real.
    const blocos = await Promise.allSettled([confirmar(f, entrada(f, [0])), confirmar(f, entrada(f, [1]))]);
    expect(blocos.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const mesmoEnvelope = entrada(f, [2]);
    const repetidos = await Promise.allSettled([confirmar(f, mesmoEnvelope), confirmar(f, mesmoEnvelope)]);
    expect(repetidos.map(r => r.status)).toEqual(["fulfilled", "fulfilled"]);
    const valores = repetidos.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
    expect(JSON.parse(JSON.stringify(valores[0]))).toEqual(JSON.parse(JSON.stringify(valores[1])));
    const concorrentes = await Promise.allSettled([confirmar(f, entrada(f, [3])), confirmar(f, entrada(f, [3]))]);
    expect(concorrentes.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejeitado = concorrentes.find(r => r.status === "rejected");
    expect(rejeitado?.status === "rejected" && rejeitado.reason).toMatchObject({ code: "CONFLITO" });
    const participacoes = await prisma.participacaoProtocolo.findMany({ where: { propriedadeId: f.sitio.id } });
    expect(participacoes).toHaveLength(4);
    expect(new Set(participacoes.map(p => p.rodadaId)).size).toBe(1);
    expect(await prisma.programacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(1);
    expect(await prisma.tarefaProtocolo.count({ where: { execucaoId: { in: participacoes.map(p => p.id) } } })).toBe(4);
    expect(await prisma.tentativaReprodutiva.count({ where: { animalId: { in: f.animais.map(a => a.id) } } })).toBe(0);
    expect(await prisma.movimentoEstoque.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
  }), 30000);

  it("serviço real reverte o bloco inteiro se a segunda linha falha e permite corrigir/repetir", async () => comFixtures(async f => {
    const input = entrada(f, [0, 1]);
    input.itens[1].dados = { inicioEfetivo: "2099-01-01" };
    await expect(confirmar(f, input)).rejects.toThrow("Linha 2");
    expect(await prisma.programacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect(await prisma.participacaoProtocolo.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect(await prisma.requisicaoPecuaria.count({ where: { propriedadeId: f.sitio.id } })).toBe(0);
    expect((await prisma.atividadeVisita.findUniqueOrThrow({ where: { id: f.atividade.id } })).contexto).toEqual(f.atividade.contexto);
    expect((await prisma.participanteVisita.findMany({ where: { atividadeId: f.atividade.id } })).every(p => p.status === "PENDENTE" && p.versaoRascunho === 0 && !p.fatoId)).toBe(true);
    input.itens[1].dados = { inicioEfetivo: "2026-10-14" };
    await confirmar(f, input);
    expect(await prisma.participacaoProtocolo.count({ where: { propriedadeId: f.sitio.id, inicioEfetivo: { not: null } } })).toBe(2);
  }), 30000);
});
