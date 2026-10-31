import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../../lib/banco-pecuaria-integration.fixture.js";
import { transacaoPecuaria } from "../../transacao.js";
import { hojeFazendaDate } from "../../rebanho/regras.js";
import { criarTipoExame, registrarExame, corrigirExame } from "../exames.js";
import { criarProtocolo, publicarProtocolo, iniciarExecucao } from "../protocolos.js";
import { publicarNecessidadeTx } from "./produtor.js";

const habilitado = process.env.PECUARIA_DB_INTEGRATION === "1";
const marca = `alerta-protocolo-exame-${randomUUID()}`;
const hoje = hojeFazendaDate();
let sitio: number | undefined, usuario: number | undefined;
let animal: string | undefined, tipoExame: string | undefined, protocolo: string | undefined, regra: string | undefined, necessidade: string | undefined, alerta: string | undefined, participacao: string | undefined;

/** Fluxo real; somente IDs e marca exclusivos desta execução. Sem seed/reset/migration. */
describe.skipIf(!habilitado)("alerta de protocolo EXAME — coleta, resultado e anulação", () => {
  beforeAll(async () => {
    const banco = exigirBancoIntegracaoPecuaria();
    if (process.env.DIRECT_URL) {
      const direta = new URL(process.env.DIRECT_URL);
      if (direta.pathname !== `/${banco}` || !["localhost", "127.0.0.1", "[::1]"].includes(direta.hostname)) throw new Error("DIRECT_URL fora da base autorizada");
    }
    const efetivo = await prisma.$queryRaw<{ banco: string }[]>`SELECT current_database()::text AS banco`;
    if (efetivo[0]?.banco !== banco) throw new Error("Conexão efetiva fora da base autorizada");
    sitio = (await prisma.propriedade.create({ data: { nome: marca } })).id;
    usuario = (await prisma.usuario.create({ data: { nome: marca, email: `${marca}@example.test`, papel: "DONO", abas: ["cadastros"], areas: ["pecuaria"], flags: ["lancar"], dono: true, status: "ATIVO" } })).id;
    animal = (await prisma.animal.create({ data: { brinco: marca, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2024-01-01Z"), dataEntrada: new Date("2025-01-01Z") } })).id;
    await prisma.localizacaoAnimal.create({ data: { animalId: animal, propriedadeId: sitio, desde: new Date("2025-01-01Z") } });
    tipoExame = (await criarTipoExame({ nome: marca, tipoResultado: "OPCAO", opcoes: ["NEGATIVO", "POSITIVO"] }, usuario)).id;
    protocolo = (await criarProtocolo({ nome: marca, etapas: [{ tipo: "EXAME", nome: "Coleta e resultado fictícios", diaRelativo: 0, tipoExameId: tipoExame }] }, usuario)).id;
    await publicarProtocolo(protocolo, usuario);
    regra = (await prisma.regraAlertaSanitario.create({ data: { nome: marca, protocoloId: protocolo, gatilho: "DATA_FIXA", dataFixa: hoje, vigencia: hoje, adocao: hoje, ativo: true, propriedadeIds: [sitio], criadoPorId: usuario } })).id;
    necessidade = (await prisma.necessidadeSanitaria.create({ data: { regraId: regra, animalId: animal, propriedadeId: sitio, revisaoRegra: 1, situacao: "PENDENTE", dataTeorica: hoje, dataAtencao: hoje, adocao: hoje } })).id;
    alerta = (await transacaoPecuaria(tx => publicarNecessidadeTx(tx, necessidade!, { usuarioId: usuario! }))).alertaId;
  }, 30_000);

  afterAll(async () => {
    if (!sitio) return;
    exigirBancoIntegracaoPecuaria();
    const sitioProprio = await prisma.propriedade.findUnique({ where: { id: sitio }, select: { nome: true } });
    if (sitioProprio?.nome !== marca) throw new Error("Limpeza recusada: marca da propriedade da fixture divergiu");
    const necessidades = regra ? await prisma.necessidadeSanitaria.findMany({ where: { regraId: regra }, select: { id: true, alertaId: true, animalId: true } }) : [];
    if (necessidades.some(n => n.animalId !== animal)) throw new Error("Limpeza recusada: necessidade fora do animal da fixture");
    const idsNecessidades = necessidades.map(n => n.id);
    const idsAlertas = [...new Set([...(alerta ? [alerta] : []), ...necessidades.flatMap(n => n.alertaId ? [n.alertaId] : [])])];
    const idsEntidades = [tipoExame, protocolo, participacao, ...idsNecessidades].filter((id): id is string => !!id);
    await prisma.vinculoAtendimentoAlerta.deleteMany({ where: { necessidadeRegraId: { in: idsNecessidades } } });
    await prisma.eventoAlerta.deleteMany({ where: { alertaId: { in: idsAlertas } } });
    await prisma.necessidadeSanitaria.deleteMany({ where: { id: { in: idsNecessidades } } });
    await prisma.alerta.deleteMany({ where: { id: { in: idsAlertas } } });
    if (regra) {
      await prisma.revisaoRegraAlertaSanitario.deleteMany({ where: { regraId: regra } });
      await prisma.regraAlertaSanitario.delete({ where: { id: regra } });
    }
    await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: sitio } });
    await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [...(animal ? [{ animalId: animal }] : []), { entidadeId: { in: idsEntidades } }] } });
    if (animal) {
      await prisma.resultadoExame.deleteMany({ where: { exame: { animalId: animal } } });
      await prisma.vinculoTarefaProtocolo.deleteMany({ where: { exame: { animalId: animal } } });
      await prisma.exameAnimal.deleteMany({ where: { animalId: animal } });
    }
    if (participacao) {
      await prisma.eventoTarefaProtocolo.deleteMany({ where: { tarefa: { execucaoId: participacao } } });
      await prisma.tarefaProtocolo.deleteMany({ where: { execucaoId: participacao } });
      await prisma.participacaoProtocolo.delete({ where: { id: participacao } });
    }
    if (protocolo) {
      // Remover o pai permite a cascata da fixture; excluir etapa publicada isolada é proibido pelo SQL.
      await prisma.protocolo.delete({ where: { id: protocolo } });
    }
    if (tipoExame) await prisma.tipoExame.delete({ where: { id: tipoExame } });
    if (animal) {
      await prisma.localizacaoAnimal.deleteMany({ where: { animalId: animal } });
      await prisma.animal.delete({ where: { id: animal } });
    }
    await prisma.propriedade.delete({ where: { id: sitio } });
    if (usuario) await prisma.usuario.delete({ where: { id: usuario } });
  }, 30_000);

  it("coleta não encerra; resultado válido encerra; anulação reabre a mesma necessidade para revisão", async () => {
    const snapshot = (await prisma.alerta.findUniqueOrThrow({ where: { id: alerta! } })).snapshotInicial;
    const inicio = { chave: randomUUID(), protocoloId: protocolo!, animalId: animal!, propriedadeId: sitio!, inicio: hoje.toISOString().slice(0, 10), alertaId: alerta!, alertaRevisao: 1, confirmarCuidadoAlerta: true };
    const inscricao = await iniciarExecucao(inicio, usuario!);
    participacao = inscricao.id;
    expect(inscricao.tarefas).toHaveLength(1);
    const tarefaId = inscricao.tarefas[0].id;
    expect(await prisma.necessidadeSanitaria.findUnique({ where: { id: necessidade! } })).toMatchObject({ participacaoId: participacao, situacao: "PROGRAMADO" });
    const coleta = { chave: randomUUID(), animalId: animal!, propriedadeId: sitio!, tipoExameId: tipoExame!, data: hoje.toISOString().slice(0, 10), tarefaId };
    const exame = await registrarExame(coleta, usuario!);
    expect(exame).toMatchObject({ status: "VALIDO", realizacao: "COLETA_REGISTRADA" });
    expect((await registrarExame(coleta, usuario!)).id).toBe(exame.id);
    expect(await prisma.necessidadeSanitaria.findUnique({ where: { id: necessidade! } })).toMatchObject({ id: necessidade, participacaoId: participacao, situacao: "PROGRAMADO" });
    expect(await prisma.alerta.findUnique({ where: { id: alerta! } })).toMatchObject({ ciclo: "ABERTO", situacao: "PROGRAMADO" });

    await corrigirExame(exame.id, sitio!, { resultadoOpcao: "NEGATIVO", motivo: "Resultado fictício conferido para a fixture" }, usuario!);
    expect(await prisma.exameAnimal.findUnique({ where: { id: exame.id } })).toMatchObject({ status: "VALIDO", realizacao: "REALIZADO", resultadoOpcao: "NEGATIVO" });
    expect(await prisma.necessidadeSanitaria.findUnique({ where: { id: necessidade! } })).toMatchObject({ id: necessidade, participacaoId: participacao, situacao: "REALIZADO" });
    expect(await prisma.alerta.findUnique({ where: { id: alerta! } })).toMatchObject({ id: alerta, ciclo: "ENCERRADO", situacao: "REALIZADO", snapshotInicial: snapshot });

    await corrigirExame(exame.id, sitio!, { anular: true, motivo: "Anulação explícita do resultado da fixture" }, usuario!);
    expect(await prisma.exameAnimal.findUnique({ where: { id: exame.id } })).toMatchObject({ status: "ANULADO", resultadoOpcao: "NEGATIVO" });
    expect(await prisma.tarefaProtocolo.findUnique({ where: { id: tarefaId } })).toMatchObject({ regularizacaoPendente: true });
    expect(await prisma.vinculoTarefaProtocolo.findFirst({ where: { tarefaId, exameId: exame.id } })).toMatchObject({ exameId: exame.id });
    expect(await prisma.necessidadeSanitaria.findUnique({ where: { id: necessidade! } })).toMatchObject({ id: necessidade, participacaoId: participacao, situacao: "NECESSITA_REVISAO" });
    expect(await prisma.alerta.findUnique({ where: { id: alerta! } })).toMatchObject({ id: alerta, ciclo: "ABERTO", situacao: "NECESSITA_REVISAO", snapshotInicial: snapshot });
    expect(await prisma.exameAnimal.count({ where: { animalId: animal! } })).toBe(1);
    expect(await prisma.participacaoProtocolo.count({ where: { animalId: animal! } })).toBe(1);
    expect(await prisma.necessidadeSanitaria.count({ where: { regraId: regra! } })).toBe(1);
    const eventos = await prisma.eventoAlerta.findMany({ where: { alertaId: alerta! }, orderBy: { revisao: "asc" }, select: { comando: true } });
    expect(eventos.some(e => e.comando === "ENCERRAR")).toBe(true);
    expect(eventos.at(-1)?.comando).toBe("REABRIR");
  }, 30_000);
});
