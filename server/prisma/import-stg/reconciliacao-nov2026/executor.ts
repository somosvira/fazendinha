import { Prisma, type PrismaClient } from "@prisma/client";
import { registrarEvidenciaAvaliacaoTx } from "../../../src/services/pecuaria/exames/evidencia-reprodutiva.js";
import { conferirFatosNaBaixa } from "../../../src/services/pecuaria/fatos.js";
import { conferirLactacaoComProducaoTx } from "../../../src/services/pecuaria/leite/guardas.js";
import { pesagemHistoricaSchema, registrarPesagemHistoricaTx, validarContextoHistoricoAnimalTx } from "../../../src/services/pecuaria/importacao/pesagens.js";
import { cadastrarTx, registrarBaixaTx } from "../../../src/services/pecuaria/rebanho/animais.js";
import { brincoDisponivel, normalizarBrinco } from "../../../src/services/pecuaria/rebanho/brinco.calc.js";
import { criarGenitorTx } from "../../../src/services/pecuaria/rebanho/genitores.js";
import { mapBaixaIdeagri } from "../../../src/services/pecuaria/rebanho/classificacao-baixa-origem.js";
import { auditar, travarAnimais, travarBrinco } from "../../../src/services/pecuaria/rebanho/regras.js";
import { aplicarPesoPartoTx, lerPartoTx } from "../../../src/services/pecuaria/reproducao/partos.js";
import { revogarPesoSecagemTx, vincularPesoSecagemTx } from "../../../src/services/pecuaria/reproducao/peso-secagem.js";
import { conferirIntervaloLactacaoTx, conferirMatrizTx, genitorTx } from "../../../src/services/pecuaria/reproducao/registros.js";
import { chaveVinculo, conferirOrdem, conferirSnapshots, type Guarda, type Manifesto, type Operacao } from "./manifesto.js";
import { conferirEstadoFinal, conferirResultadoTx, hashFonte, resultadoSchema, type Recibo } from "./pos-aplicacao.js";

type Tx = Prisma.TransactionClient;
type Modo = "PREVIA" | "EXECUCAO" | "VERIFICACAO";
type Registro = { id: string };
type Resultado = { entidade: string; registro: Registro; antes?: unknown };
const data = (dia: string) => new Date(dia + "T00:00:00.000Z");
const json = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
const texto = (valor: string | number | null | undefined) => valor == null ? null : String(valor).trim() || null;
const apenasProtecaoBezerreiro = (g: Guarda) => ["PerfilBezerreiro", "ParticipacaoBezerreiro"].includes(g.tabela);
const identificador = (nome: string) => {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(nome)) throw new Error("Identificador SQL inválido.");
  return Prisma.raw(`"${nome}"`);
};

async function conferirGuardas(tx: Tx, guardas: Guarda[]) {
  for (const g of guardas) {
    if (!g.campos.includes("id")) throw new Error(`Guarda sem identidade em ${g.tabela}.`);
    const esquema = ["Produto", "Propriedade"].includes(g.tabela) ? Prisma.raw("public") : Prisma.raw("pecuaria");
    const colunas = g.campos.map(campo => {
      const c = identificador(campo);
      return Prisma.sql`CASE WHEN pg_typeof(${c}) = 'boolean'::regtype THEN left(${c}::text, 1) ELSE ${c}::text END AS ${c}`;
    });
    const where = g.coluna ? Prisma.sql`WHERE ${identificador(g.coluna)}::text = ANY(${g.valores}::text[])` : Prisma.empty;
    const atual = await tx.$queryRaw<Guarda["linhas"]>`SELECT ${Prisma.join(colunas)} FROM ${esquema}.${identificador(g.tabela)} ${where}`;
    conferirSnapshots(g.tabela, g.linhas, atual);
  }
}

async function conferirAutor(tx: Tx, autorId: number) {
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { status: true, papel: true, dono: true } });
  if (autor?.status !== "ATIVO" || (autor.papel !== "proprietario" && !autor.dono))
    throw new Error("A reconciliação exige o proprietário ativo indicado no manifesto.");
}

async function conferirVinculos(tx: Tx, m: Manifesto) {
  const chaves = m.operacoes.map(op => chaveVinculo(m.origem, op));
  const chavesOperacionaisIatf = m.operacoes.flatMap((op, i) => op.tipo === "DOCUMENTO_IATF"
    ? [{ ...chaves[i], tabelaOrigem: op.chave.split(":")[0] }] : []);
  const vinculos = await tx.vinculoImportacaoPecuaria.findMany({ where: { OR: [...chaves, ...chavesOperacionaisIatf] } });
  const porOrigem = new Map(vinculos.map(v => [`${v.tabelaOrigem}:${v.chaveOrigem}`, v]));
  for (const [i, op] of m.operacoes.entries()) {
    const origem = chaves[i];
    const existente = porOrigem.get(`${origem.tabelaOrigem}:${origem.chaveOrigem}`);
    if ("hashOrigemEsperado" in op ? existente?.hashOrigem !== op.hashOrigemEsperado || existente.destinoId !== op.id : existente != null)
      throw new Error(`${op.chave}: vínculo de origem divergente ou já registrado.`);
    if (op.tipo === "DOCUMENTO_IATF" && porOrigem.has(op.chave))
      throw new Error(`${op.chave}: a origem IATF já tem vínculo operacional.`);
  }
  return porOrigem;
}

async function conferirDependenciasClinicas(tx: Tx, m: Manifesto) {
  for (const op of m.operacoes) {
    try {
      if (op.tipo === "BAIXA") await conferirFatosNaBaixa(tx, op.animalId, data(op.data));
      if (op.tipo === "LACTACAO") {
        await conferirIntervaloLactacaoTx(tx, op.animalId, data(op.data), null);
        await conferirLactacaoComProducaoTx(tx, op.animalId, op.id, data(op.data), null);
      }
      if (op.tipo === "ENCERRAR_LACTACAO") {
        const lactacao = await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id: op.id } });
        await conferirLactacaoComProducaoTx(tx, op.animalId, op.id, lactacao.inicio, data(op.data));
      }
    } catch (erro) {
      throw new Error(`${op.chave}: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
  }
}

async function executarOperacao(tx: Tx, m: Manifesto, op: Operacao, feitos: ReadonlyMap<string, Recibo>): Promise<Resultado> {
  const autor = m.autorId;
  const referenciaExterna = `${m.origem}:${op.chave}`;
  const referenciaHistorica = JSON.stringify([m.origem, op.chave]);
  const evidencia = `${op.chave} no arquivo Firebird SHA256 ${m.fonteSha256}. ${op.motivo}`;
  const ler = (chave: string, entidade: string) => {
    const fato = feitos.get(chave);
    if (fato?.entidade !== entidade) throw new Error(`Dependência ${chave} não resolveu ${entidade}.`);
    return fato.id;
  };
  if (op.tipo === "GENITOR") {
    const registro = await criarGenitorTx(tx, op.dados, autor, { id: op.id, ideagriId: Number(op.chave.split(":")[1]) });
    return { entidade: "GenitorExterno", registro };
  }
  if (op.tipo === "ANIMAL") {
    const { animal } = await cadastrarTx(tx, op.dados, autor, {
      nascimentoHistorico: true, identidadeIdeagri: { id: op.id, ideagriId: Number(op.chave.split(":")[1]) },
    });
    return { entidade: "Animal", registro: animal };
  }
  if (op.tipo === "DOCUMENTO_IATF") {
    const registro = await tx.auditoriaPecuaria.create({ data: {
      entidade: "IatfHistoricoIDEAGRI", entidadeId: referenciaExterna, acao: "IMPORTACAO_DOCUMENTAL",
      usuarioId: autor, animalId: op.animalId, propriedadeId: op.propriedadeId,
      depois: json({ fonte: op.fonte, motivo: op.motivo, semExecucaoPresumida: true }),
    } });
    return { entidade: "AuditoriaPecuaria", registro };
  }
  const quando = data(op.data);
  const contexto = { animalId: op.animalId, data: op.data, contexto: "INTERNO" as const, propriedadeId: op.propriedadeId, evidencia };
  const base = { animalId: op.animalId, propriedadeId: op.propriedadeId, data: quando, origem: "IDEAGRI", criadoPorId: autor };
  if (op.tipo === "PESO") {
    const registro = await registrarPesagemHistoricaTx(tx, { ...contexto, pesoKg: op.pesoKg, tipo: op.categoria, precisao: op.precisao, origem: "MANUAL", bancoOrigem: m.origem, chaveOrigem: op.chave, observacao: texto(op.fonte.OBSERVACAO) }, autor);
    await tx.pesagem.update({ where: { id: registro.id }, data: { ideagriId: Number(op.chave.split(":")[1]) } });
    return { entidade: "Pesagem", registro };
  }
  await validarContextoHistoricoAnimalTx(tx, contexto);
  switch (op.tipo) {
    case "CORRIGIR_ANIMAL": {
      const antes = await tx.animal.findUniqueOrThrow({ where: { id: op.id } });
      if (antes.id !== op.animalId) throw new Error("Animal da correção diverge da origem.");
      if (op.dados.brinco) {
        await travarBrinco(tx, op.propriedadeId, normalizarBrinco(op.dados.brinco));
        const ativos = await tx.localizacaoAnimal.findMany({ where: { propriedadeId: op.propriedadeId, ate: null }, select: { propriedadeId: true, animalId: true, animal: { select: { brinco: true } } } });
        if (!brincoDisponivel({ brinco: op.dados.brinco, propriedadeId: op.propriedadeId, ignorarAnimalId: op.id, ativosNoSitio: ativos.map(l => ({ ...l, brinco: l.animal.brinco })) }))
          throw new Error("Brinco já ocupado no sítio.");
      }
      return { entidade: "Animal", antes, registro: await tx.animal.update({ where: { id: op.id }, data: op.dados }) };
    }
    case "CORRIGIR_PESO": {
      const antes = await tx.pesagem.findUniqueOrThrow({ where: { id: op.id } });
      if (antes.animalId !== op.animalId || antes.referenciaHistorica !== referenciaHistorica || antes.tipo !== "SECAGEM" ||
        await tx.vinculoPesagemParto.count({ where: { pesagemId: antes.id, revogadoEm: null } }))
        throw new Error("Peso não corresponde à origem ou tem vínculo de parto ativo.");
      const lactacao = await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id: op.lactacaoAntigaId } });
      if (lactacao.animalId !== op.animalId || lactacao.encerradaEm?.getTime() !== antes.data.getTime())
        throw new Error("Encerramento anterior diverge da data histórica do peso.");
      const vinculo = await tx.vinculoPesagemSecagem.findUniqueOrThrow({ where: { id: op.vinculoAntigoId } });
      if (vinculo.pesagemId !== antes.id) throw new Error("Associação de secagem aponta para outra pesagem.");
      const dados = pesagemHistoricaSchema.parse({
        ...contexto, pesoKg: op.pesoKg, tipo: antes.tipo, origem: antes.origem, precisao: antes.precisao,
        bancoOrigem: m.origem, chaveOrigem: op.chave, observacao: antes.observacao,
      });
      await revogarPesoSecagemTx(tx, lactacao, vinculo.id, op.propriedadeId, op.motivo, autor);
      const registro = await tx.pesagem.update({ where: { id: op.id }, data: {
        data: quando, pesoKg: new Prisma.Decimal(dados.pesoKg), propriedadeId: op.propriedadeId, contextoHistorico: "INTERNO",
        provenienciaHistoricaSnapshot: json({ dados, fonte: op.fonte, usuarioId: autor, registradaEm: new Date().toISOString(), antes, versao: 1 }),
      } });
      return { entidade: "Pesagem", registro, antes };
    }
    case "ASSOCIAR_SECAGEM":
      return { entidade: "VinculoPesagemSecagem", registro: await vincularPesoSecagemTx(tx, {
        lactacaoId: op.lactacaoId, pesagemId: ler(op.pesoChave, "Pesagem"), propriedadeId: op.propriedadeId, evidenciaOrigem: json({ fonte: op.fonte, evidencia }),
      }, autor) };
    case "PARTO": {
      await conferirMatrizTx(tx, op.animalId, op.propriedadeId, quando);
      const [jaExiste, tentativaPosterior, gestacaoAberta] = await Promise.all([
        tx.partoAnimal.count({ where: { animalId: op.animalId, data: quando, status: "VALIDO" } }),
        tx.tentativaReprodutiva.count({ where: { animalId: op.animalId, status: "VALIDO", data: { gt: quando } } }),
        tx.gestacaoAnimal.count({ where: { animalId: op.animalId, status: "VALIDO", encerradaEm: null } }),
      ]);
      if (jaExiste || tentativaPosterior || gestacaoAberta) throw new Error("Cronologia ou identidade do parto exige revisão.");
      const registro = await tx.partoAnimal.create({ data: {
        ...base, id: op.id, referenciaExterna, tipo: op.categoria, desfecho: "NASCIMENTO",
        ocorridoEm: op.ocorridoEm ? new Date(op.ocorridoEm) : null, assistenciaDescricao: op.assistencia,
        observacao: `IDEAGRI. ${op.motivo}`,
      } });
      for (const c of op.crias) {
        if (ler(c.chave, "Animal") !== c.animalId) throw new Error("Identidade da cria não confere.");
        const cria = await tx.animal.findUniqueOrThrow({ where: { id: c.animalId } });
        if (cria.dataNascimento.getTime() !== quando.getTime() || cria.sexo !== c.sexo) throw new Error("A cria diverge do nascimento comprovado.");
        const origemCria = m.operacoes.find(x => x.chave === c.chave)?.fonte;
        await tx.criaParto.create({ data: { partoId: registro.id, animalId: cria.id, ordem: c.ordem, viva: true, sexo: cria.sexo, filiacaoSnapshot: json({
          origem: m.origem, maeId: cria.maeId, paiId: cria.paiId, maeExternaId: cria.maeExternaId, paiExternoId: cria.paiExternoId,
          referenciaGeneticaOriginal: { mae: origemCria?.CDMAE ?? null, pai: origemCria?.CDPAI ?? null },
        }) } });
      }
      return { entidade: "PartoAnimal", registro };
    }
    case "TENTATIVA": {
      const matriz = await conferirMatrizTx(tx, op.animalId, op.propriedadeId, quando);
      const ciclo = matriz.partosAntesDaEntrada + await tx.partoAnimal.count({ where: { animalId: op.animalId, status: "VALIDO", incluidoSaldoAnterior: false, data: { lte: quando } } });
      const tentativas = await tx.tentativaReprodutiva.findMany({ where: { animalId: op.animalId } });
      const ordem = Math.max(0, ...tentativas.filter(t => t.ciclo === ciclo).map(t => t.ordem)) + 1;
      if (ciclo !== op.ciclo || ordem !== op.ordem || tentativas.some(t => t.status === "VALIDO" && t.data >= quando))
        throw new Error("Ordem, ciclo ou duplicidade de tentativa exige revisão.");
      const touroExternoId = op.genitorChave ? ler(op.genitorChave, "GenitorExterno") : null;
      const [mae, pai] = await Promise.all([
        genitorTx(tx, matriz.id, null, "F"),
        genitorTx(tx, null, touroExternoId, "M"),
      ]);
      const registro = await tx.tentativaReprodutiva.create({ data: {
        ...base, referenciaExterna, tipo: "IA", ciclo, ordem, origemMaterial: "HISTORICO",
        touroExternoId,
        quantidade: op.quantidade === null ? null : new Prisma.Decimal(op.quantidade), observacao: texto(op.fonte.OBSERVACAO),
        geneticaSnapshot: json({ origem: m.origem, fonte: op.fonte, reprodutor: op.reprodutor, mae, pai, semConsumoAtual: true }),
      } });
      return { entidade: "TentativaReprodutiva", registro };
    }
    case "DIAGNOSTICO": {
      await conferirMatrizTx(tx, op.animalId, op.propriedadeId, quando);
      const registro = await registrarEvidenciaAvaliacaoTx(tx, {
        ...base, referenciaExterna, resultado: op.resultado, sexoFetal: op.sexoFetal, anotacaoOriginal: JSON.stringify(op.fonte),
      });
      return { entidade: "ExameAnimal", registro };
    }
    case "LACTACAO": {
      await conferirMatrizTx(tx, op.animalId, op.propriedadeId, quando);
      const parto = await tx.partoAnimal.findUniqueOrThrow({ where: { id: op.partoId } });
      if (parto.animalId !== op.animalId || parto.data.getTime() !== quando.getTime() || parto.status !== "VALIDO")
        throw new Error("Parto não comprova início da lactação.");
      await conferirIntervaloLactacaoTx(tx, op.animalId, quando, null);
      await conferirLactacaoComProducaoTx(tx, op.animalId, op.id, quando, null);
      const registro = await tx.lactacaoAnimal.create({ data: {
        id: op.id, animalId: op.animalId, propriedadeId: op.propriedadeId, partoId: parto.id, inicio: quando, referenciaExterna, origem: "IDEAGRI", criadoPorId: autor,
      } });
      return { entidade: "LactacaoAnimal", registro };
    }
    case "ENCERRAR_LACTACAO": {
      await conferirMatrizTx(tx, op.animalId, op.propriedadeId, quando);
      const antes = await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id: op.id } });
      if (antes.animalId !== op.animalId || antes.propriedadeId !== op.propriedadeId || antes.versao !== op.versaoEsperada || antes.encerradaEm || quando < antes.inicio)
        throw new Error("Lactação diverge do encerramento revisado.");
      await conferirLactacaoComProducaoTx(tx, op.animalId, antes.id, antes.inicio, quando);
      const registro = await tx.lactacaoAnimal.update({ where: { id: antes.id }, data: { encerradaEm: quando, motivoEncerramento: op.motivoOrigem, versao: { increment: 1 } } });
      return { entidade: "LactacaoAnimal", registro, antes };
    }
    case "BAIXA": {
      const { tipo } = mapBaixaIdeagri(op.motivoOrigem, Number(op.fonte.CDTIPOBAIXA));
      const registro = await registrarBaixaTx(tx, { animalId: op.animalId, data: op.data, tipo, observacao: evidencia,
        cienciaSanitaria: op.cienciaSanitaria, justificativaSanitaria: op.cienciaSanitaria ? "Reconciliação documental de saída já realizada conforme IDEAGRI. Carências são preservadas como registradas, inclusive quando desconhecidas." : undefined,
      }, autor);
      return { entidade: "BaixaAnimal", registro };
    }
    case "APLICACAO": {
      if (op.fonte.APLICADO !== 1 || op.fonte.DOSEAPLICADA != null || op.fonte.CARENCIA != null || op.fonte.CDDOENCAANIMAL != null)
        throw new Error("Aplicação exige conferência específica da administração, dose, carência ou ocorrência.");
      const registro = await tx.aplicacaoProduto.create({ data: {
        animalId: op.animalId, propriedadeId: op.propriedadeId, produtoId: op.produtoId, nomeProdutoAplicado: op.nomeProduto,
        data: quando, aplicadaEm: op.aplicadaEm ? new Date(op.aplicadaEm) : null, precisaoTemporal: op.aplicadaEm ? "HORA" : "DIA",
        origem: "IDEAGRI", origemInsumo: "HISTORICO_IMPORTADO", situacaoCusto: "NAO_APURADO",
        estadoCarenciaLeite: "NAO_INFORMADO", estadoCarenciaCarne: "NAO_INFORMADO",
      } });
      return { entidade: "AplicacaoProduto", registro };
    }
    case "VINCULAR_PESO_PARTO": {
      const parto = await lerPartoTx(tx, op.partoId);
      const cria = op.criaChave ? await tx.criaParto.findUniqueOrThrow({ where: { animalId: ler(op.criaChave, "Animal") } }) : undefined;
      if (cria && cria.partoId !== parto.id) throw new Error("Cria pertence a outro parto.");
      const pesoId = ler(op.pesoChave, "Pesagem");
      await aplicarPesoPartoTx(tx, parto, { acao: "VINCULAR", pesagemId: pesoId }, autor, cria);
      const registro = await tx.vinculoPesagemParto.findFirstOrThrow({ where: { partoId: parto.id, pesagemId: pesoId, revogadoEm: null } });
      return { entidade: "VinculoPesagemParto", registro };
    }
  }
}

export async function reconciliarTx(tx: Tx, m: Manifesto, hash: string, modo: Modo) {
  conferirOrdem(m.operacoes);
  await conferirAutor(tx, m.autorId);
  if (modo === "EXECUCAO") {
    const animais = m.operacoes.flatMap(op => op.tipo === "ANIMAL" ? [op.id] : "animalId" in op && op.animalId ? [op.animalId] : []);
    await travarAnimais(tx, animais);
  }
  const marca = await tx.auditoriaPecuaria.findFirst({ where: { entidade: "ReconciliacaoIDEAGRI", entidadeId: hash, acao: "LOTE_CONFIRMADO", usuarioId: m.autorId }, select: { depois: true } });
  if (marca) {
    const { recibo, estadoFinal } = resultadoSchema.parse(marca.depois);
    const atual = await conferirResultadoTx(tx, m, recibo);
    conferirEstadoFinal(estadoFinal, atual);
    return { estado: modo === "VERIFICACAO" ? "POS_APLICACAO_CONFERIDA" : "JA_EXECUTADO", recibo,
      registrosVerificados: atual.length, documentaisIatf: m.operacoes.filter(o => o.tipo === "DOCUMENTO_IATF").length };
  }
  if (modo === "VERIFICACAO") throw new Error("O manifesto ainda não possui recibo de aplicação neste destino.");
  await conferirGuardas(tx, m.guardas);
  const vinculos = await conferirVinculos(tx, m);
  if (modo === "PREVIA") {
    await conferirDependenciasClinicas(tx, m);
    return { estado: "PREVIA_CONFERIDA", unidades: m.operacoes.length };
  }
  const feitos = new Map<string, Recibo>();
  for (const op of m.operacoes) {
    try {
      const origem = chaveVinculo(m.origem, op);
      const onde = { bancoOrigem_tabelaOrigem_chaveOrigem: origem };
      const vinculo = vinculos.get(`${origem.tabelaOrigem}:${origem.chaveOrigem}`);
      const { entidade, registro, antes } = await executarOperacao(tx, m, op, feitos);
      const hashOrigem = hashFonte(op);
      if (vinculo) {
        if (vinculo.entidadeDestino !== entidade) throw new Error("Entidade do vínculo mudou.");
        await tx.vinculoImportacaoPecuaria.update({ where: onde, data: { hashOrigem } });
      } else {
        await tx.vinculoImportacaoPecuaria.create({ data: { ...origem, entidadeDestino: entidade, destinoId: registro.id, hashOrigem } });
      }
      const animalId = op.tipo === "ANIMAL" ? registro.id : "animalId" in op ? op.animalId : null;
      const propriedadeId = op.tipo === "ANIMAL" ? op.dados.propriedadeId : "propriedadeId" in op ? op.propriedadeId : null;
      await auditar(tx, { entidade, entidadeId: registro.id, animalId, propriedadeId, usuarioId: m.autorId,
        acao: vinculo ? "RECONCILIAR_IDEAGRI" : "IMPORTACAO_IDEAGRI",
        antes: vinculo ? { registro: antes, vinculo } : undefined,
        depois: { manifesto: hash, arquivoSha256: m.fonteSha256, origem, decisao: op, registro },
      });
      feitos.set(op.chave, { chave: op.chave, entidade, id: registro.id });
    } catch (erro) {
      throw new Error(`${op.chave}: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
  }
  await conferirGuardas(tx, m.guardas.filter(apenasProtecaoBezerreiro));
  await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
  const recibo = [...feitos.values()];
  const estadoFinal = await conferirResultadoTx(tx, m, recibo);
  await auditar(tx, { entidade: "ReconciliacaoIDEAGRI", entidadeId: hash, usuarioId: m.autorId, acao: "LOTE_CONFIRMADO",
    depois: { recibo, estadoFinal, fonteSha256: m.fonteSha256, backupSha256: m.backupSha256, destino: m.destino } });
  return { estado: "EXECUTADO", recibo, registrosVerificados: estadoFinal.length,
    documentaisIatf: m.operacoes.filter(o => o.tipo === "DOCUMENTO_IATF").length };
}

export async function reconciliar(db: PrismaClient, m: Manifesto, hash: string, modo: Modo) {
  return db.$transaction(async tx => {
    if (modo !== "EXECUCAO") await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
    return reconciliarTx(tx, m, hash, modo);
  }, { isolationLevel: "Serializable", timeout: 600_000 });
}
