import { criarTipoExame, editarTipoExame, corrigirExame } from "../sanidade/exames.js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import {
  criarProtocolo,
  criarProgramacao,
  iniciarParticipante,
  reprogramarTarefa,
  executarTarefa,
  retirarParticipante,
  adicionarParticipantes,
  regularizarTarefa,
} from "./iatf.js";
import { anularFato, previaAnulacao } from "./correcoes.js";
import { anularAplicacao, criarAplicacao, carenciaAnimal } from "../sanidade/aplicacoes.js";
import { aplicacaoSchema } from "../sanidade/aplicacoes.schemas.js";
import { substitutosTarefa } from "./iatf.js";
import { atualizarProduto } from "../../estoque/produtos.js";
const comBanco =
  process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
comBanco("IATF planejada, executada e reentrada — banco descartável", () => {
  it("preserva calendário/histórico, registra desvio, consome uma vez e reentrada não altera a participação anterior", async () => {
    const token = randomUUID();
    const sitio = await prisma.propriedade.create({
      data: { nome: `IATF ${token}` },
    });
    const categoria = await prisma.categoria.create({
      data: { nome: `Produtos IATF ${token}`, classificacao: "CUSTEIO" },
    });
    const produto = await prisma.produto.create({
      data: {
        nome: `Produto IATF ${token}`,
        unidade: "ML",
        usoSanitario: true,
        categoriaId: categoria.id,
      },
    });
    const semen = await prisma.produto.create({
      data: {
        nome: `Sêmen IATF ${token}`,
        unidade: "DOSE",
        usoGenetico: true,
        categoriaId: categoria.id,
      },
    });
    const touro = await prisma.genitorExterno.create({
      data: { nome: `Touro IATF ${token}`, sexo: "M" },
    });
    const material = await prisma.materialGenetico.create({
      data: { tipo: "SEMEN", produtoId: semen.id, touroExternoId: touro.id },
    });
    const tipo = await prisma.tipoAplicacaoSanitaria.create({
      data: { nome: `Aplicação IATF ${token}` },
    });
    const animal = await prisma.animal.create({
      data: {
        brinco: `IATF-${token}`,
        sexo: "F",
        origem: "COMPRADO",
        dataNascimento: new Date("2020-01-01"),
        dataEntrada: new Date("2024-01-01"),
        localizacoes: {
          create: { propriedadeId: sitio.id, desde: new Date("2024-01-01") },
        },
        destinos: {
          create: {
            aptidao: "LEITE",

            desde: new Date("2024-01-01"),
          },
        },
      },
    });
    await prisma.movimentoEstoque.create({
      data: {
        produtoId: produto.id,
        propriedadeId: sitio.id,
        data: new Date("2026-09-01"),
        tipo: "ENTRADA",
        origem: "INVENTARIO_INICIAL",
        quantidade: 100,
        custoUnitario: 2,
        valorTotal: 200,
      },
    });
    await prisma.movimentoEstoque.create({
      data: {
        produtoId: semen.id,
        propriedadeId: sitio.id,
        data: new Date("2026-09-01"),
        tipo: "ENTRADA",
        origem: "INVENTARIO_INICIAL",
        quantidade: 20,
        custoUnitario: 10,
        valorTotal: 200,
      },
    });
    const tipoExame = await criarTipoExame({ nome: `Exame no protocolo reprodutivo ${token}`, tipoResultado:"NUMERO", unidade:"mg" }, null);
    const protocolo = await criarProtocolo(
      {
        nome: `Protocolo IATF ${token}`,
        versao: 1,
        publicado: true,
        etapas: [
          {
            nome: "Aplicação inicial",
            tipo: "APLICACAO",
            intervalo: 0,
            unidade: "DIAS",
            planoAplicacao: {
              produtoId: produto.id,
              dose: "2",
              unidadeDose: "ML",
              via: "IM",
            },
          },
          { nome: "Retirada", tipo: "RETIRADA", intervalo: 1, unidade: "DIAS" },
          {
            nome: "IA",
            tipo: "TENTATIVA",
            intervalo: 10,
            unidade: "DIAS",
            planoTentativa: {
              tipo: "IA",
              materialId: material.id,
              quantidade: 1,
            },
          },
          { nome:"Exame sanitário", tipo:"EXAME", intervalo:2, unidade:"DIAS", planoExame:{tipoExameId:tipoExame.id} },
        ],
      },
      null,
    );
    await expect(editarTipoExame(tipoExame.id,{unidade:"kg"},null)).rejects.toMatchObject({code:"CONFLITO"});
    await expect(
      atualizarProduto(produto.id, { usoSanitario: false }),
    ).rejects.toMatchObject({ code: "CONFLITO" });
    const entrada = {
      chave: randomUUID(),
      propriedadeId: sitio.id,
      nome: `Programação ${token}`,
      protocoloId: protocolo.id,
      inicioPrevisto: "2026-09-30T12:00:00Z",
      animais: [{ animalId: animal.id }],
    };
    const programacao = await criarProgramacao(entrada, null);
    expect((await criarProgramacao(entrada, null)).id).toBe(programacao.id);
    const participante = await prisma.participanteIatf.findFirstOrThrow({
      where: { programacaoId: programacao.id },
    });
    const tarefas = await prisma.tarefaIatf.findMany({
      where: { participanteId: participante.id },
      orderBy: { etapa: "asc" },
    });
    expect(
      await prisma.aplicacaoProduto.count({ where: { animalId: animal.id } }),
    ).toBe(0);
    await reprogramarTarefa(
      tarefas[0].id,
      sitio.id,
      "2026-09-30T13:00:00Z",
      "Ajuste explícito antes do início",
      null,
    );
    await iniciarParticipante(
      participante.id,
      sitio.id,
      "2026-10-01T12:00:00Z",
      null,
    );
    const inicial = await prisma.tarefaIatf.findUniqueOrThrow({
      where: { id: tarefas[0].id },
    });
    expect(inicial.previstaEm.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(inicial.previsaoOriginal.toISOString()).toBe(
      "2026-09-30T12:00:00.000Z",
    );
    expect(inicial.historicoReprogramacao as unknown[]).toHaveLength(2);
    const ia = await prisma.tarefaIatf.findUniqueOrThrow({
      where: { id: tarefas[2].id },
    });
    expect(ia.previstaEm.toISOString()).toBe("2026-10-11T12:00:00.000Z");
    const execucao = {
      chave: randomUUID(),
      propriedadeId: sitio.id,
      realizadaEm: "2026-10-01T12:00:00Z",
      dados: {
        animalId: animal.id,
        propriedadeId: sitio.id,
        data: "2026-10-01",
        aplicadaEm: "2026-10-01T12:00:00Z",
        tipoAplicacaoId: tipo.id,
        origemInsumo: "BAIXA_ESTOQUE",
        nomeProdutoAplicado: produto.nome,
        produtoId: produto.id,
        dose: "3",
        unidadeDose: "ML",
        via: "IM",
        estadoCarenciaLeite: "INFORMADO",
        estadoCarenciaCarne: "INFORMADO",
        carenciaLeiteHoras: 0,
        carenciaCarneHoras: 0,
      },
    };
    await expect(
      executarTarefa(inicial.id, execucao, null),
    ).rejects.toMatchObject({ code: "VALIDACAO", campo: "motivo" });
    expect(
      await prisma.aplicacaoProduto.count({ where: { animalId: animal.id } }),
    ).toBe(0);
    const confirmada = {
      ...execucao,
      motivo: "Dose ajustada expressamente pelo responsável",
    };
    const salva = await executarTarefa(inicial.id, confirmada, null);
    expect((await executarTarefa(inicial.id, confirmada, null)).id).toBe(
      salva.id,
    );
    expect(
      await prisma.aplicacaoProduto.count({ where: { animalId: animal.id } }),
    ).toBe(1);
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: produto.id, tipo: "SAIDA" },
      }),
    ).toBe(1);
    expect(salva.desviosSnapshot).toMatchObject({
      aferido: true,
      diferencas: [{ campo: "dose", planejado: "2", realizado: "3" }],
    });
    expect(salva.realizadoSnapshot).toMatchObject({ dados: { dose: "3" } });
    expect(
      (await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: ia.id } }))
        .previstaEm,
    ).toEqual(ia.previstaEm);
    const execIA = {
      chave: randomUUID(),
      propriedadeId: sitio.id,
      realizadaEm: ia.previstaEm.toISOString(),
      dados: {
        chave: randomUUID(),
        tipo: "IA",
        materialId: material.id,
        origem: "ESTOQUE",
        quantidade: 1,
      },
    };
    const iaRealizada = await executarTarefa(ia.id, execIA, null);
    expect((await executarTarefa(ia.id, execIA, null)).id).toBe(iaRealizada.id);
    expect(
      await prisma.tentativaReprodutiva.count({
        where: { animalId: animal.id },
      }),
    ).toBe(1);
    expect(
      await prisma.movimentoEstoque.count({
        where: { produtoId: semen.id, tipo: "SAIDA" },
      }),
    ).toBe(1);
    expect(iaRealizada.desviosSnapshot).toMatchObject({
      aferido: true,
      diferencas: [],
    });
    await anularAplicacao(salva.aplicacaoId!, sitio.id, "Aplicação não realizada: corrigir lançamento e devolver insumo", null, "DEVOLVER_ESTOQUE");
    const tarefaAnulada = await prisma.tarefaIatf.findUniqueOrThrow({where:{id:inicial.id}});
    expect(tarefaAnulada.regularizacaoPendente).toBe(true);
    expect(tarefaAnulada.aplicacaoId).toBe(salva.aplicacaoId);
    expect(tarefaAnulada.realizadaEm).toEqual(salva.realizadaEm);
    await regularizarTarefa(inicial.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"REABRIR",motivo:"Confirmado lançamento indevido sem aplicação física",cienciaNaoExecutado:true},null);
    const reexecutada = await executarTarefa(inicial.id,{...confirmada,chave:randomUUID()},null);
    expect(reexecutada.aplicacaoId).not.toBe(salva.aplicacaoId);
    expect(reexecutada.historicoRegularizacao).toEqual(expect.arrayContaining([expect.objectContaining({acao:"REABRIR",anterior:expect.objectContaining({aplicacaoId:salva.aplicacaoId,realizadoSnapshot:salva.realizadoSnapshot})})]));
    expect(await prisma.aplicacaoProduto.count({where:{animalId:animal.id,status:"VALIDO"}})).toBe(1);
    expect(await prisma.movimentoEstoque.count({where:{produtoId:produto.id,tipo:"SAIDA",status:"CONFIRMADO"}})).toBe(1);
    const reversoesAntes = await prisma.movimentoEstoque.count({where:{produtoId:produto.id,reversaoDeId:{not:null}}});
    await anularAplicacao(reexecutada.aplicacaoId!,sitio.id,"Registro anulado preservando aplicação física comprovada",null,"MANTER_CONSUMO");
    expect(await prisma.movimentoEstoque.count({where:{produtoId:produto.id,reversaoDeId:{not:null}}})).toBe(reversoesAntes);
    expect((await prisma.aplicacaoProduto.findUniqueOrThrow({where:{id:reexecutada.aplicacaoId!}})).consumoMantido).toBe(true);
    await expect(regularizarTarefa(inicial.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"REABRIR",motivo:"Não repetir consumo que aconteceu fisicamente",cienciaNaoExecutado:true},null)).rejects.toMatchObject({code:"VALIDACAO",campo:"cienciaNaoExecutado"});
    expect((await carenciaAnimal(animal.id, sitio.id)).carne.estado).toBe("NAO_INFORMADO");
    const substituto = await criarAplicacao(aplicacaoSchema.parse({ ...execucao.dados, origemInsumo: "SEM_ORIGEM_JUSTIFICADA", justificativaSemOrigem: "Correção documentada, sem nova administração ou baixa de estoque" }), null);
    expect(await substitutosTarefa(inicial.id, sitio.id)).toEqual(expect.arrayContaining([expect.objectContaining({ id: substituto.id })]));
    await expect(substitutosTarefa(inicial.id, sitio.id + 999999)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await regularizarTarefa(inicial.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"VINCULAR_SUBSTITUTO",fatoId:substituto.id,motivo:"Substituto documentado representa a mesma administração física"},null);
    expect((await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: inicial.id } })).aplicacaoId).toBe(substituto.id);
    expect((await carenciaAnimal(animal.id, sitio.id)).carne.estado).toBe("CONHECIDO");
    expect((await prisma.aplicacaoProduto.findUniqueOrThrow({ where: { id: reexecutada.aplicacaoId! } })).consumoMantido).toBe(true);
    expect(await prisma.movimentoEstoque.count({where:{produtoId:produto.id,tipo:"SAIDA",status:"CONFIRMADO"}})).toBe(1);
    const previaTentativa = await previaAnulacao("tentativas", iaRealizada.tentativaId!, sitio.id);
    await anularFato("tentativas",iaRealizada.tentativaId!,{propriedadeId:sitio.id,chave:randomUUID(),motivo:"Registro revisto, mas dose foi usada fisicamente",fingerprint:previaTentativa.fingerprint,destinoConsumo:"MANTER_CONSUMO"},null);
    await expect(regularizarTarefa(ia.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"REABRIR",motivo:"Tentativa de reabrir com consumo conservado",cienciaNaoExecutado:true},null)).rejects.toMatchObject({code:"VALIDACAO",campo:"cienciaNaoExecutado"});
    await regularizarTarefa(ia.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"ENCERRAR_SEM_SUBSTITUICAO",motivo:"Conservar dose utilizada e encerrar correção"},null);
    expect(await prisma.movimentoEstoque.count({where:{produtoId:semen.id,reversaoDeId:{not:null}}})).toBe(0);
    const tarefaExame = await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: tarefas[3].id } });
    const exameExecutado = await executarTarefa(tarefaExame.id, { chave:randomUUID(), propriedadeId:sitio.id, realizadaEm:tarefaExame.previstaEm.toISOString(), dados:{tipoExameId:tipoExame.id,resultadoNumero:0} }, null);
    expect(exameExecutado.exameId).toBeTruthy();
    expect(exameExecutado.avaliacaoId).toBeNull();
    expect((await prisma.exameAnimal.findUniqueOrThrow({where:{id:exameExecutado.exameId!}})).resultadoNumero?.toNumber()).toBe(0);
    await corrigirExame(exameExecutado.exameId!,sitio.id,{anular:true,motivo:"Amostra de outro animal registrada indevidamente"},null);
    expect((await prisma.tarefaIatf.findUniqueOrThrow({where:{id:tarefaExame.id}})).regularizacaoPendente).toBe(true);
    await regularizarTarefa(tarefaExame.id,{propriedadeId:sitio.id,chave:randomUUID(),acao:"REABRIR",motivo:"Confirmada ausência de exame no animal",cienciaNaoExecutado:true},null);
    expect((await prisma.tarefaIatf.findUniqueOrThrow({where:{id:tarefaExame.id}})).exameId).toBeNull();
    await retirarParticipante(
      participante.id,
      sitio.id,
      "Participação encerrada pelo responsável",
      null,
    );
    const pendente = await prisma.tarefaIatf.findUniqueOrThrow({
      where: { id: tarefas[1].id },
    });
    expect(pendente.dispensadaEm).not.toBeNull();
    const anterior = await prisma.tarefaIatf.findUniqueOrThrow({
      where: { id: ia.id },
    });
    expect(anterior.realizadaEm).not.toBeNull();
    await adicionarParticipantes(
      programacao.id,
      {
        propriedadeId: sitio.id,
        chave: randomUUID(),
        animais: [
          { animalId: animal.id, inicioPrevisto: "2026-10-12T12:00:00Z" },
        ],
      },
      null,
    );
    const participacoes = await prisma.participanteIatf.findMany({
      where: { programacaoId: programacao.id, animalId: animal.id },
    });
    expect(participacoes).toHaveLength(2);
    expect(participacoes.filter((p) => !p.encerradoEm)).toHaveLength(1);
    expect(
      (await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: ia.id } }))
        .dispensadaEm,
    ).toEqual(anterior.dispensadaEm);
    expect(
      (await prisma.tarefaIatf.findUniqueOrThrow({ where: { id: inicial.id } }))
        .realizadoSnapshot,
    ).toEqual(reexecutada.realizadoSnapshot);
  }, 30000);
});
