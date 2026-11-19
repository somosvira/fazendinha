import { randomInt, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../src/db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../src/lib/banco-pecuaria-integration.fixture.js";
import { registrarPesagemHistoricaTx } from "../../../src/services/pecuaria/importacao/pesagens.js";
import { vincularPesoSecagemTx } from "../../../src/services/pecuaria/reproducao/peso-secagem.js";
import { reconciliarTx } from "./executor.js";
import { manifestoSchema, type Operacao } from "./manifesto.js";

const dia = (d: string) => new Date(d);
const rollback = new Error("Rollback de fixtures da reconciliação");

describe.runIf(process.env.PECUARIA_DB_INTEGRATION === "1")("reconciliação IDEAGRI com PostgreSQL e rollback", () => {
  it("grava identidades, vínculos e auditorias em um lote e preserva a associação revogada", async () => {
    exigirBancoIntegracaoPecuaria();
    const token = randomUUID();
    try {
      await prisma.$transaction(async tx => {
        const autor = await tx.usuario.create({ data: { nome: token, email: `reconciliacao-${token}@example.test`, papel: "proprietario", dono: true, status: "ATIVO" } });
        const sitio = await tx.propriedade.create({ data: { nome: `Reconciliação ${token}` } });
        const criarMatriz = async (brinco: string) => {
          const animal = await tx.animal.create({ data: { sexo: "F", origem: "COMPRADO", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2024-01-01"), brinco } });
          await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, desde: animal.dataEntrada } });
          await tx.finalidadeAnimal.create({ data: { animalId: animal.id, aptidao: "LEITE", desde: animal.dataEntrada } });
          return animal;
        };
        const matriz = await criarMatriz(`matriz-${token}`), seca = await criarMatriz(`seca-${token}`);
        const [holandes, girolando] = await Promise.all([
          tx.raca.create({ data: { sigla: `H${token.slice(0, 7)}`, nome: `Holandês ${token}` } }),
          tx.raca.create({ data: { sigla: `G${token.slice(0, 7)}`, nome: `Girolando ${token}` } }),
        ]);
        await tx.composicaoRacial.create({ data: { animalId: matriz.id, racaId: girolando.id, fracao64: 64, origem: "INFORMADA" } });
        const criaId = randomUUID(), partoId = randomUUID(), lactacaoId = randomUUID(), genitorId = randomUUID();
        const baseId = randomInt(1_400_000_000, 1_500_000_000);
        const key = (t: string, i = 0) => `${t}:${baseId + i}`;
        const origem = "IDEAGRI:FAZENDA:777";
        const hashOrigemEsperado = "a".repeat(64);
        const fonte = { exemplo: "fixture", APLICADO: 1 };
        const op = { fonte, motivo: "Documento de origem conferido em fixture.", dependencias: [] as string[] };
        const contexto = { ...op, propriedadeId: sitio.id, animalId: matriz.id, data: "2026-11-03" };
        const contextoSeca = { ...contexto, animalId: seca.id, data: "2026-11-09" };
        const peso = await registrarPesagemHistoricaTx(tx, {
          animalId: seca.id, tipo: "SECAGEM", data: "2026-06-03", pesoKg: 695, origem: "MANUAL", precisao: "NAO_INFORMADO",
          bancoOrigem: origem, chaveOrigem: key("PESO"), propriedadeId: sitio.id, contexto: "INTERNO", evidencia: "Peso de secagem documentado em fixture.",
        }, autor.id);
        const lactacaoAntiga = await tx.lactacaoAnimal.create({ data: { animalId: seca.id, propriedadeId: sitio.id, inicio: dia("2025-11-01"), encerradaEm: dia("2026-06-03"), motivoEncerramento: "Encerramento antigo" } });
        const lactacaoNova = await tx.lactacaoAnimal.create({ data: { animalId: seca.id, propriedadeId: sitio.id, inicio: dia("2026-07-01") } });
        const vinculo = await vincularPesoSecagemTx(tx, { lactacaoId: lactacaoAntiga.id, pesagemId: peso.id, propriedadeId: sitio.id }, autor.id);
        const origemVinculo = (tabelaOrigem: string, entidadeDestino: string, destinoId: string) => ({ bancoOrigem: origem, tabelaOrigem, chaveOrigem: String(baseId), entidadeDestino, destinoId, hashOrigem: hashOrigemEsperado });
        await tx.vinculoImportacaoPecuaria.createMany({ data: [
          origemVinculo("PESO", "Pesagem", peso.id), origemVinculo("LACTACAO", "LactacaoAnimal", lactacaoNova.id),
          { ...origemVinculo("ANIMAL", "Animal", matriz.id), chaveOrigem: String(baseId + 1) },
        ] });
        const ops: Operacao[] = [
          { ...op, chave: key("ANIMAL", 2), tipo: "GENITOR", id: genitorId, dados: {
            sexo: "M", nome: `Genitor ${token}`, codigo: token, composicao: [{ racaId: holandes.id, fracao64: 64 }],
          } },
          { ...op, chave: key("ANIMAL"), tipo: "ANIMAL", id: criaId, dados: {
            brinco: `cria-${token.slice(0, 12)}`, sexo: "F", origem: "NASCIDO", dataNascimento: "2026-11-03", dataEntrada: "2026-11-03",
            propriedadeId: sitio.id, aptidao: "LEITE", nascimentoEstimado: false, partosAntesDaEntrada: 0, maeId: matriz.id, paiExternoId: genitorId,
            composicao: [{ racaId: holandes.id, fracao64: 32 }, { racaId: girolando.id, fracao64: 32 }],
          }, dependencias: [key("ANIMAL", 2)] },
          { ...contexto, chave: key("ANIMAL", 1), tipo: "CORRIGIR_ANIMAL", id: matriz.id, hashOrigemEsperado, dados: { brinco: `novo-${token.slice(0, 12)}` } },
          { ...contexto, chave: key("REPRODUCAO"), tipo: "PARTO", id: partoId, categoria: "NORMAL", assistencia: null, ocorridoEm: "2026-11-03T14:05:00-03:00", dependencias: [key("ANIMAL")],
            crias: [{ chave: key("ANIMAL"), animalId: criaId, sexo: "F", ordem: 1 }] },
          { ...contexto, chave: key("LACTACAO", 1), tipo: "LACTACAO", id: lactacaoId, partoId, dependencias: [key("REPRODUCAO")] },
          { ...contexto, chave: key("REPRODUCAO", 1), tipo: "TENTATIVA", data: "2026-11-04", ciclo: 1, ordem: 1, quantidade: "1", reprodutor: null,
            genitorChave: key("ANIMAL", 2), dependencias: [key("ANIMAL", 2)] },
          { ...contexto, chave: key("REPRODUCAO", 2), tipo: "DIAGNOSTICO", data: "2026-11-05", resultado: "POSITIVO", sexoFetal: "F" },
          { ...contexto, animalId: criaId, chave: key("PESO", 1), tipo: "PESO", categoria: "NASCIMENTO", precisao: "INFORMADO", contexto: "INTERNO", pesoKg: 39, dependencias: [key("ANIMAL")] },
          { ...contexto, animalId: criaId, chave: key("PESO_PARTO"), tipo: "VINCULAR_PESO_PARTO", partoId, pesoChave: key("PESO", 1), criaChave: key("ANIMAL"), dependencias: [key("REPRODUCAO"),key("PESO",1),key("ANIMAL")] },
          { ...contextoSeca, chave: key("ENCERRAMENTO_LACTACAO"), tipo: "ENCERRAR_LACTACAO", id: lactacaoNova.id, versaoEsperada: 1, motivoOrigem: "Secagem comprovada", hashOrigemEsperado },
          { ...contextoSeca, chave: key("PESO"), tipo: "CORRIGIR_PESO", id: peso.id, hashOrigemEsperado, pesoKg: 681, vinculoAntigoId: vinculo.id, lactacaoAntigaId: lactacaoAntiga.id },
          { ...contextoSeca, chave: key("PESO_SECAGEM"), tipo: "ASSOCIAR_SECAGEM", lactacaoId: lactacaoNova.id, pesoChave: key("PESO"), dependencias: [key("PESO"),key("ENCERRAMENTO_LACTACAO")] },
          { ...contextoSeca, chave: key("APLICACAOPRODUTO"), tipo: "APLICACAO", produtoId: null, nomeProduto: "Histórico sem catálogo", aplicadaEm: "2026-11-09T09:52:26-03:00" },
          { ...contextoSeca, chave: key("ANIMAL_BAIXA"), tipo: "BAIXA", data: "2026-11-10", fonte: { CDTIPOBAIXA: 1 }, motivoOrigem: "Venda", cienciaSanitaria: true },
          { ...op, chave: key("PROGRAMACAOIATF"), tipo: "DOCUMENTO_IATF", animalId: null, propriedadeId: sitio.id },
        ];
        const manifesto = manifestoSchema.parse({
          versao: 1, origem, autorId: autor.id, fonteSha256: "b".repeat(64), backupSha256: "c".repeat(64), corte: "2026-11-02 19:13:30.337",
          destino: { host: "ep-green-recipe-acyjvbqp.sa-east-1.aws.neon.tech", banco: "neondb", ambiente: "staging", branch: "br-proud-wind-ac6m6hq8" },
          operacoes: ops, exclusoes: [], guardas: [{ tabela: "Propriedade", coluna: "id", valores: [String(sitio.id)], campos: ["id", "ativo"], linhas: [{ id: String(sitio.id), ativo: "t" }] }],
        });
        const hash = token;
        expect((await reconciliarTx(tx, manifesto, hash, "PREVIA")).estado).toBe("PREVIA_CONFERIDA");
        expect(await tx.animal.findUnique({ where: { id: criaId } })).toBeNull();
        expect((await reconciliarTx(tx, manifesto, hash, "EXECUCAO")).estado).toBe("EXECUTADO");
        expect((await reconciliarTx(tx, manifesto, hash, "EXECUCAO")).estado).toBe("JA_EXECUTADO");
        expect((await reconciliarTx(tx, manifesto, hash, "VERIFICACAO")).estado).toBe("POS_APLICACAO_CONFERIDA");
        expect(await tx.animal.findUniqueOrThrow({ where: { id: criaId } })).toMatchObject({ ideagriId: baseId, criadoPorId: autor.id, paiExternoId: genitorId });
        expect(await tx.composicaoRacial.findFirstOrThrow({ where: { animalId: criaId, racaId: holandes.id } })).toMatchObject({ racaId: holandes.id, fracao64: 32, fracaoCalculada64: 32, origem: "CALCULADA" });
        expect(await tx.auditoriaPecuaria.count({ where: { entidadeId: criaId, acao: "CADASTRO" } })).toBe(1);
        expect(await tx.criaParto.count({ where: { partoId, animalId: criaId } })).toBe(1);
        expect(await tx.vinculoPesagemParto.count({ where: { partoId, sujeito: "CRIA" } })).toBe(1);
        expect(await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id: lactacaoAntiga.id } })).toMatchObject({ encerradaEm: dia("2026-06-03") });
        expect((await tx.vinculoPesagemSecagem.findUniqueOrThrow({ where: { id: vinculo.id } })).revogadoEm).not.toBeNull();
        expect(await tx.vinculoPesagemSecagem.count({ where: { lactacaoId: lactacaoNova.id, pesagemId: peso.id, revogadoEm: null } })).toBe(1);
        expect((await tx.pesagem.findUniqueOrThrow({ where: { id: peso.id } })).pesoKg.toString()).toBe("681");
        expect(await tx.aplicacaoProduto.findFirstOrThrow({ where: { animalId: seca.id } })).toMatchObject({ origemInsumo: "HISTORICO_IMPORTADO", movimentoEstoqueId: null, estadoCarenciaCarne: "NAO_INFORMADO" });
        expect(await tx.baixaAnimal.count({ where: { animalId: seca.id, tipo: "VENDA", estornadaEm: null } })).toBe(1);
        expect(await tx.gestacaoAnimal.count({ where: { animalId: matriz.id } })).toBe(0);
        expect(await tx.tentativaReprodutiva.count({ where: { animalId: matriz.id, movimentoEstoqueId: null, touroExternoId: genitorId } })).toBe(1);
        const origemPeso = { bancoOrigem: origem, tabelaOrigem: "PESO", chaveOrigem: String(baseId) };
        const pesoVinculo = await tx.vinculoImportacaoPecuaria.findUniqueOrThrow({ where: { bancoOrigem_tabelaOrigem_chaveOrigem: origemPeso } });
        await tx.vinculoImportacaoPecuaria.update({ where: { id: pesoVinculo.id }, data: { hashOrigem: "f".repeat(64) } });
        await expect(reconciliarTx(tx, manifesto, hash, "VERIFICACAO")).rejects.toThrow(/hash de origem alterado após o lote/i);
        await tx.vinculoImportacaoPecuaria.update({ where: { id: pesoVinculo.id }, data: { hashOrigem: pesoVinculo.hashOrigem } });
        await tx.animal.update({ where: { id: criaId }, data: { nome: "Alteração posterior ao lote" } });
        await expect(reconciliarTx(tx, manifesto, hash, "EXECUCAO")).rejects.toThrow(/alterado após o lote/i);
        throw rollback;
      }, { isolationLevel: "Serializable", timeout: 30_000 });
    } catch (erro) {
      if (erro !== rollback) throw erro;
    }
    expect(await prisma.usuario.count({ where: { email: `reconciliacao-${token}@example.test` } })).toBe(0);
  }, 35_000);
});
