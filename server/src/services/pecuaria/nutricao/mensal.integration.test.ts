import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";
import {
  criarEntradaValorizadaFixture,
  limparMovimentosValorizadosFixture,
} from "../../../test/estoque-valorizado.fixture.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { criarDieta, publicarDieta, atribuirDieta } from "./dietas.js";
import {
  processarDia,
  carregarMesTx,
  confirmarMes,
  confirmarDias,
  reabrirMes,
} from "./mensal.js";
import { hojeFazendaDate } from "../rebanho/regras.js";
import { textoData, somarDias } from "./mensal.calc.js";

const suite =
  process.env.PECUARIA_DB_INTEGRATION === "1" &&
  process.env.NUTRICAO_MENSAL_ENABLED === "true"
    ? describe
    : describe.skip;
const run = randomUUID().slice(0, 8);
const ids = {
  sitio: 0,
  usuario: 0,
  centro: "",
  categoria: "",
  produtos: [] as string[],
  lotes: [] as string[],
  animais: [] as string[],
  dietas: [] as string[],
};
// Cada exclusão usa somente o sítio/IDs criados por esta suíte. Nunca prepara ou limpa o banco global.
afterAll(async () => {
  if (!ids.sitio) return;
  exigirBancoIntegracaoPecuaria();
  await prisma.$transaction(async (tx) => {
    const meses = await tx.mesNutricao.findMany({
        where: { propriedadeId: ids.sitio },
        select: { id: true },
      }),
      mesId = { in: meses.map((m) => m.id) };
    await tx.classificacaoCustoPecuaria.deleteMany({
      where: { participacaoDiaria: { dia: { mesId } } },
    });
    await tx.movimentoConsumoDiario.deleteMany({
      where: { item: { dia: { mesId } } },
    });
    await tx.itemConsumoDiario.deleteMany({ where: { dia: { mesId } } });
    await tx.participacaoConsumoDiario.deleteMany({
      where: { dia: { mesId } },
    });
    await tx.consumoDiario.deleteMany({ where: { mesId } });
    await tx.mesNutricao.deleteMany({ where: { id: mesId } });
    await tx.configuracaoNutricao.deleteMany({
      where: { propriedadeId: ids.sitio },
    });
    await tx.auditoriaPecuaria.deleteMany({
      where: {
        OR: [{ propriedadeId: ids.sitio }, { entidadeId: { in: ids.dietas } }],
      },
    });
    await tx.requisicaoPecuaria.deleteMany({
      where: { propriedadeId: ids.sitio },
    });
  });
  await prisma.vigenciaDietaLote.deleteMany({
    where: { loteId: { in: ids.lotes } },
  });
  await prisma.itemDieta.deleteMany({ where: { dietaId: { in: ids.dietas } } });
  await prisma.dieta.deleteMany({ where: { id: { in: ids.dietas } } });
  await limparMovimentosValorizadosFixture(ids.produtos);
  await prisma.periodoReprodutivoAnimal.deleteMany({
    where: { animalId: { in: ids.animais } },
  });
  await prisma.finalidadeAnimal.deleteMany({
    where: { animalId: { in: ids.animais } },
  });
  await prisma.localizacaoAnimal.deleteMany({
    where: { animalId: { in: ids.animais } },
  });
  await prisma.animal.deleteMany({ where: { id: { in: ids.animais } } });
  await prisma.lote.deleteMany({ where: { id: { in: ids.lotes } } });
  await prisma.produto.deleteMany({ where: { id: { in: ids.produtos } } });
  if (ids.categoria)
    await prisma.categoria.delete({ where: { id: ids.categoria } });
  if (ids.centro)
    await prisma.centroCusto.delete({ where: { id: ids.centro } });
  await prisma.propriedade.delete({ where: { id: ids.sitio } });
  if (ids.usuario) await prisma.usuario.delete({ where: { id: ids.usuario } });
});
suite("nutrição mensal no PostgreSQL — fixtures próprias", () => {
  it("conserva estoque nos três modelos, concorrência, reenvio e correção", async () => {
    exigirBancoIntegracaoPecuaria();
    ids.sitio = (
      await prisma.propriedade.create({ data: { nome: `Nutri mensal ${run}` } })
    ).id;
    ids.usuario = (
      await prisma.usuario.create({
        data: {
          nome: `Teste ${run}`,
          email: `nutri-${run}@example.test`,
          papel: "operador",
          abas: [],
          areas: ["pecuaria"],
          flags: ["lancar"],
          status: "ATIVO",
        },
      })
    ).id;
    ids.centro = (
      await prisma.centroCusto.create({ data: { nome: `Nutri mensal ${run}` } })
    ).id;
    ids.categoria = (
      await prisma.categoria.create({
        data: { nome: `Nutri mensal ${run}`, usoNutricional: true },
      })
    ).id;
    const data = somarDias(
        textoData(hojeFazendaDate()).slice(0, 7) + "-01",
        -1,
      ),
      inicio = data.slice(0, 7) + "-01";
    for (const modelo of ["AUTOMATICO", "MANUAL", "PROVISORIO"]) {
      const lote = await prisma.lote.create({
        data: {
          nome: `${modelo} ${run}`,
          propriedadeId: ids.sitio,
          centroCustoId: ids.centro,
        },
      });
      ids.lotes.push(lote.id);
      const animal = await cadastrar(
        cadastrarAnimalSchema.parse({
          brinco: `${run}${modelo.slice(0, 3)}`,
          sexo: "F",
          origem: "COMPRADO",
          aptidao: "LEITE",
          dataNascimento: "2020-01-01",
          dataEntrada: inicio,
          propriedadeId: ids.sitio,
          loteId: lote.id,
        }),
        null,
      );
      ids.animais.push(animal.id);
      const produto = await prisma.produto.create({
        data: {
          nome: `${modelo} ${run}`,
          unidade: "KG",
          usoNutricional: true,
          categoriaId: ids.categoria,
        },
      });
      ids.produtos.push(produto.id);
      await criarEntradaValorizadaFixture({
        data: {
          produtoId: produto.id,
          propriedadeId: ids.sitio,
          tipo: "ENTRADA",
          origem: "INVENTARIO_INICIAL",
          data: new Date(inicio),
          quantidade: 100,
          custoUnitario: 2,
          valorTotal: 200,
        },
      });
      const dieta = await criarDieta(
        {
          nome: `${modelo} ${run}`,
          itens: [{ produtoId: produto.id, quantidadeCabecaDia: 10 }],
        },
        null,
      );
      ids.dietas.push(dieta.id);
      await publicarDieta(dieta.id, null);
      await atribuirDieta(
        {
          loteId: lote.id,
          propriedadeId: ids.sitio,
          dietaId: dieta.id,
          desde: inicio,
        },
        null,
      );
      // Configuração histórica exclusivamente da fixture: simula adoção no último dia do mês.
      await prisma.configuracaoNutricao.create({
        data: {
          escopo: `lote:${lote.id}`,
          loteId: lote.id,
          propriedadeId: ids.sitio,
          desde: new Date(data),
          modelo,
          diaConferencia: 5,
          usuarioId: ids.usuario,
        },
      });
      await Promise.all([
        processarDia(lote.id, ids.sitio, data),
        processarDia(lote.id, ids.sitio, data),
      ]);
      const identidade = await prisma.mesNutricao.findFirstOrThrow({
        where: { loteId: lote.id },
      });
      let mes = await carregarMesTx(prisma, identidade.id, ids.sitio);
      expect(
        await prisma.movimentoConsumoDiario.count({
          where: { item: { dia: { mesId: mes.id } } },
        }),
      ).toBe(modelo === "AUTOMATICO" ? 1 : 0);
      if (modelo === "MANUAL") {
        await confirmarDias(mes.id, ids.sitio, ids.usuario, {
          chave: randomUUID(),
          revisao: mes.revisao,
          motivo: "",
          dias: [
            {
              id: mes.dias[0].id,
              itens: [{ produtoId: produto.id, quantidade: "10" }],
            },
          ],
        });
        mes = await carregarMesTx(prisma, mes.id, ids.sitio);
      }
      const input = {
        chave: randomUUID(),
        revisao: mes.revisao,
        motivo: "",
        itens: [{ produtoId: produto.id, quantidade: "10" }],
      };
      await Promise.all([
        confirmarMes(mes.id, ids.sitio, ids.usuario, input),
        confirmarMes(mes.id, ids.sitio, ids.usuario, input),
      ]);
      expect(
        await prisma.movimentoConsumoDiario.count({
          where: { item: { dia: { mesId: mes.id } } },
        }),
      ).toBe(1);
      await expect(
        prisma.itemConsumoDiario.update({
          where: { id: mes.dias[0].itens[0].id },
          data: { confirmada: 11 },
        }),
      ).rejects.toThrow();
      await reabrirMes(
        mes.id,
        ids.sitio,
        ids.usuario,
        "Quantidade física conferida",
      );
      mes = await carregarMesTx(prisma, mes.id, ids.sitio);
      await confirmarMes(mes.id, ids.sitio, ids.usuario, {
        ...input,
        chave: randomUUID(),
        revisao: mes.revisao,
        motivo: "Consumo efetivo oito quilos",
        itens: [{ produtoId: produto.id, quantidade: "8" }],
      });
      const item = await prisma.itemConsumoDiario.findUniqueOrThrow({
        where: { id: mes.dias[0].itens[0].id },
      });
      expect(item.confirmada.toString()).toBe("8");
      expect(item.custoLiquido.toString()).toBe("16");
    }
  }, 60000);
});
