import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { criarPartoTx, corrigirPartoTx } from "./registros.js";
import { editarPesagemTx } from "../rebanho/animais.js";
import { lerPartoTx } from "./partos.js";
import { registrarColostroTx, corrigirColostroTx } from "./colostro.js";
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const rollback = new Error("ROLLBACK_FIXTURES_PARTO");
async function emRollback(executar: (tx: Prisma.TransactionClient) => Promise<void>) {
  exigirBancoIntegracaoPecuaria();
  try {
    await prisma.$transaction(async tx => {
      await executar(tx);
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      throw rollback;
    });
  } catch (erro) { if (erro !== rollback) throw erro; }
}
async function fixtures(tx: Prisma.TransactionClient) {
  const sitio = await tx.propriedade.create({ data: { nome: `Parto rollback ${randomUUID()}` } });
  const matriz = await tx.animal.create({ data: { brinco: `P-${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01"),
    localizacoes: { create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") } },
    destinos: { create: { aptidao: "LEITE", desde: new Date("2024-01-01") } },
    papeisReprodutivos: { create: { tipo: "NENHUM", inicio: new Date("2024-01-01"), origem: "MANUAL" } },
  } });
  return { sitio, matriz };
}
suite("parto/pós-parto com fixtures inteiramente revertidas", () => {
  it("cria RP e peso matriz na mesma transação e conserva RP após encerramento", async () => {
    await emRollback(async tx => {
      const { sitio, matriz } = await fixtures(tx);
      const doenca = await tx.doenca.create({ data: { nome: `RP ${randomUUID()}` } });
      const p = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio.id, data: "2026-01-01", tipo: "ABORTO", iniciarLactacao: false, crias: [], retencaoPlacenta: true,
        ocorrenciaRetencao: { acao: "CRIAR", doencaId: doenca.id, inicio: "2026-01-02" }, pesoMatriz: { acao: "REGISTRAR", data: "2026-01-03", pesoKg: 520 } }, null);
      expect(p.vinculosPesagem).toHaveLength(1);
      expect(p.vinculosPesagem[0].pesagem.data.toISOString().slice(0, 10)).toBe("2026-01-03");
      const o = p.ocorrenciasRetencaoPlacenta[0];
      await tx.ocorrenciaSanitaria.update({ where: { id: o.id }, data: { fim: new Date("2026-01-04"), desfecho: "Tratamento encerrado" } });
      expect((await lerPartoTx(tx, p.id)).retencaoPlacenta).toBe(true);
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
      const correcao = { chave: randomUUID(), propriedadeId: sitio.id, versaoEsperada: 1, motivo: "Revisão da identificação clínica", retencaoPlacenta: false,
        ocorrenciaRetencao: { acao: "DESVINCULAR" as const, ocorrenciaId: o.id, motivo: "Revisão da identificação clínica" } };
      const corrigido = await corrigirPartoTx(tx, p.id, correcao, null);
      expect(corrigido.versao).toBe(2);
      expect((await corrigirPartoTx(tx, p.id, correcao, null)).versao).toBe(2);
      await expect(corrigirPartoTx(tx, p.id, { ...correcao, chave: randomUUID() }, null)).rejects.toMatchObject({ code: "CONFLITO" });
      expect((await lerPartoTx(tx, p.id)).ocorrenciasRetencaoPlacenta).toHaveLength(0);
    });
  });
  it("gêmeos conservam pesos em fontes próprias e fornecimentos múltiplos pertencem à cria viva", async () => {
    await emRollback(async tx => {
      const { sitio, matriz } = await fixtures(tx);
      const p = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio.id, data: "2026-01-01", desfecho: "NASCIMENTO", iniciarLactacao: false,
        crias: [{ viva: true, sexo: "F", aptidao: "LEITE", pesoKg: 32 }, { viva: false, sexo: "M", aptidao: "CORTE", pesoKg: 29 }] }, null);
      expect(p.crias[0].animalId).not.toBeNull();
      expect(p.crias[1].animalId).toBeNull();
      expect(p.vinculosPesagem).toHaveLength(1);
      expect(p.vinculosPesagem[0].criaId).toBe(p.crias[0].id);
      expect(p.crias[1].filiacaoSnapshot).toMatchObject({ pesoKg: 29 });
      for (const quantidade of [2000, 1000]) await registrarColostroTx(tx, { chave: randomUUID(), propriedadeId: sitio.id, criaId: p.crias[0].id, data: "2026-01-01", quantidade, unidade: "ML", metodoQualidade: "REFRATOMETRO_BRIX", qualidadeBrix: 23 }, null);
      const eventos = await tx.fornecimentoColostro.findMany({ where: { criaId: p.crias[0].id } });
      expect(eventos).toHaveLength(2);
      expect(eventos.reduce((s, e) => s + Number(e.quantidadeLitros), 0)).toBe(3);
      const correcao = { chave: randomUUID(), propriedadeId: sitio.id, versaoEsperada: 1, motivo: "Conferência do fornecimento", quantidade: 1500, unidade: "ML" as const };
      expect((await corrigirColostroTx(tx, eventos[0].id, correcao, null)).versao).toBe(2);
      expect((await corrigirColostroTx(tx, eventos[0].id, correcao, null)).versao).toBe(2);
      await expect(corrigirColostroTx(tx, eventos[0].id, { ...correcao, chave: randomUUID() }, null)).rejects.toMatchObject({ code: "CONFLITO" });
      await expect(registrarColostroTx(tx, { chave: randomUUID(), propriedadeId: sitio.id, criaId: p.crias[1].id, data: "2026-01-01" }, null)).rejects.toThrow(/cria viva/);
    });
  });
  it("escore usa exame com escala explícita e substitui preservando o anterior", async () => {
    await emRollback(async tx => {
      const { sitio, matriz } = await fixtures(tx);
      const p = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio.id, data: "2026-01-01", tipo: "ABORTO", iniciarLactacao: false, crias: [],
        escoreMatriz: { acao: "REGISTRAR", data: "2026-01-02", valor: 3, escalaMin: 1, escalaMax: 5, escalaDescricao: "Escala declarada na coleta", responsavel: "Responsável pela avaliação" } }, null);
      expect(p.examesPosParto).toHaveLength(1);
      expect(p.examesPosParto[0].finalidadePrincipal).toBe("ESCORE_CORPORAL");
      expect(p.examesPosParto[0].formatoSnapshot).toMatchObject({ escala: { minimo: 1, maximo: 5 } });
      const corrigido = await corrigirPartoTx(tx, p.id, { chave: randomUUID(), propriedadeId: sitio.id, motivo: "Corrigir leitura do escore", versaoEsperada: 1,
        escoreMatriz: { acao: "SUBSTITUIR", exameId: p.examesPosParto[0].id, motivo: "Leitura original corrigida", data: "2026-01-02", valor: 3.5, escalaMin: 1, escalaMax: 5 } }, null);
      expect(corrigido.examesPosParto).toHaveLength(2);
      expect(corrigido.examesPosParto.filter(e => e.status === "VALIDO")).toHaveLength(1);
      expect(corrigido.examesPosParto.find(e => e.id === p.examesPosParto[0].id)?.status).toBe("ANULADO");
      expect(await tx.resultadoExame.count({ where: { exameId: p.examesPosParto[0].id } })).toBe(4);
    });
  });
  it("corrige o peso vivo na fonte comum e invalida a versão do parto quando editado por fora", async () => {
    await emRollback(async tx => {
      const { sitio, matriz } = await fixtures(tx);
      const p = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio.id,
        data: "2026-01-01", desfecho: "NASCIMENTO", iniciarLactacao: false,
        crias: [{ viva: true, sexo: "F", aptidao: "LEITE", pesoKg: 32 }] }, null);
      const vinculo = p.vinculosPesagem[0];
      const corrigido = await corrigirPartoTx(tx, p.id, { chave: randomUUID(), propriedadeId: sitio.id,
        motivo: "Conferência do peso de nascimento", versaoEsperada: p.versao,
        pesosCrias: [{ criaId: p.crias[0].id, peso: { acao: "CORRIGIR", vinculoId: vinculo.id, data: "2026-01-01", pesoKg: 34 } }] }, null);
      expect(corrigido.vinculosPesagem[0].pesagemId).toBe(vinculo.pesagemId);
      expect(Number(corrigido.vinculosPesagem[0].pesagem.pesoKg)).toBe(34);
      expect(await tx.pesagem.count({ where: { animalId: p.crias[0].animalId! } })).toBe(1);
      await expect(editarPesagemTx(tx, vinculo.pesagemId, { data: "2026-01-02" }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
      await expect(editarPesagemTx(tx, vinculo.pesagemId, { tipo: "ROTINA" }, null)).rejects.toMatchObject({ code: "VALIDACAO" });
      await editarPesagemTx(tx, vinculo.pesagemId, { pesoKg: 35 }, null);
      expect((await lerPartoTx(tx, p.id)).versao).toBeGreaterThan(corrigido.versao);
      await expect(corrigirPartoTx(tx, p.id, { chave: randomUUID(), propriedadeId: sitio.id,
        motivo: "Versão anterior à pesagem", versaoEsperada: corrigido.versao }, null)).rejects.toMatchObject({ code: "CONFLITO" });
      // O SQL protege também um cliente que não passou pelo serviço.
      await tx.$executeRawUnsafe("SAVEPOINT peso_invalido");
      await tx.pesagem.update({ where: { id: vinculo.pesagemId }, data: { tipo: "ROTINA" } });
      await expect(tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE")).rejects.toThrow();
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT peso_invalido");
    });
  });

  it("editar peso pela fonte comum preserva o sítio histórico do pós-parto", async () => {
    await emRollback(async tx => {
      const { sitio, matriz } = await fixtures(tx);
      const outro = await tx.propriedade.create({ data: { nome: `Destino peso ${randomUUID()}` } });
      const p = await criarPartoTx(tx, { chave: randomUUID(), animalId: matriz.id, propriedadeId: sitio.id,
        data: "2026-01-01", tipo: "ABORTO", iniciarLactacao: false, crias: [],
        pesoMatriz: { acao: "REGISTRAR", data: "2026-01-03", pesoKg: 520 } }, null);
      await tx.localizacaoAnimal.updateMany({ where: { animalId: matriz.id, ate: null }, data: { ate: new Date("2026-01-05") } });
      await tx.localizacaoAnimal.create({ data: { animalId: matriz.id, propriedadeId: outro.id, desde: new Date("2026-01-05") } });
      await expect(editarPesagemTx(tx, p.vinculosPesagem[0].pesagemId, { data: "2026-01-06" }, null)).rejects.toThrow(/não estava neste sítio/);
      expect((await lerPartoTx(tx, p.id)).vinculosPesagem[0].pesagem.data.toISOString().slice(0, 10)).toBe("2026-01-03");
    });
  });

});
