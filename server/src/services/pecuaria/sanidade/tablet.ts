import { UnidadeMedida } from "@prisma/client";
import { z } from "zod";
import { propriedadePrincipalId } from "../../propriedade.js";
import { nomeCompletoCatalogo } from "../../estoque/produtos-catalogo.calc.js";
import { prisma } from "../../../db.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { RebanhoError, travarAnimais, auditar } from "../rebanho/regras.js";
import { transacaoPecuaria, timeoutTransacaoAnimais } from "../transacao.js";
import { criarAplicacaoTx, travarOrigensAplicacoesTx } from "./aplicacoes.js";
import { aplicarImpactosTx, conferirImpactosTx, previaImpactosTx } from "../reproducao/impactos.js";
import { confirmacaoImpactoSchema } from "../reproducao/impactos.schemas.js";
import { tipoAplicacaoLegadaId } from "./desvios.js";

const uuid = z.string().uuid();
const produtos = z.array(uuid).max(20).refine(ids => new Set(ids).size === ids.length, "Selecione produtos distintos");
const item = z.object({ produtoId: uuid, quantidade: z.number().positive().max(999999999).multipleOf(0.001) }).strict();
const itens = z.array(item).min(1).max(20).refine(lista => new Set(lista.map(i => i.produtoId)).size === lista.length, "Selecione produtos distintos");
const itemGuardado = item.extend({ produtoCatalogoId: uuid.optional(), nome: z.string(), unidade: z.nativeEnum(UnidadeMedida).default("UN") });
export const envioSchema = z.object({
  id: uuid, corrigeId: uuid.optional(), propriedadeId: z.number().int().positive(), aplicadaEm: z.string().datetime({ offset: true }),
  animalIds: z.array(uuid).min(1).max(50).refine(ids => new Set(ids).size === ids.length, "Selecione animais distintos"),
  itens,
}).strict().refine(e => e.animalIds.length * e.itens.length <= 100, "Limite de 100 aplicações por envio");
const quantidadeTemplateSchema = z.object({ quantidade: z.number().positive().max(999999999).multipleOf(0.001), unidade: z.nativeEnum(UnidadeMedida) }).strict();
const quantidadesTemplateSchema = z.record(uuid, quantidadeTemplateSchema);
export const templateSchema = z.object({ propriedadeId: z.number().int().positive(), doencaId: uuid, produtoIds: produtos, quantidades: quantidadesTemplateSchema.optional() }).strict().refine(t => Object.keys(t.quantidades ?? {}).every(id => t.produtoIds.includes(id)), "A quantidade deve pertencer a um medicamento selecionado");
export const decisaoSchema = z.object({
  propriedadeId: z.number().int().positive(),
  motivo: z.string().trim().min(5).max(500).optional(),
  conferencia: z.array(z.object({
    produtoId: uuid, partidaId: uuid.nullable(), cienciaValidadeDesconhecida: z.boolean(),
    carenciaLeiteHoras: z.number().int().min(0).max(2147483647).nullable(),
    carenciaCarneHoras: z.number().int().min(0).max(2147483647).nullable(),
  }).strict()).max(20).optional(),
  impactos: z.array(z.object({ animalId: uuid, confirmacao: confirmacaoImpactoSchema }).strict()).max(50).optional(),
}).strict();

type Autor = { id: number; nome: string };
const diaDaFazenda = (data: Date) => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(data);

export async function buscarVacas(propriedadeId: number, modo: "numero" | "nome", termo: string) {
  return prisma.animal.findMany({
    where: { sexo: "F", localizacoes: { some: { propriedadeId, ate: null } },
      ...(modo === "numero" ? { brinco: termo } : { nome: { contains: termo, mode: "insensitive" } }) },
    select: { id: true, nome: true, brinco: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], take: 25,
  });
}

const produtoSanitario = { usoSanitario: true, ativo: true } as const;

export async function opcoesTablet(propriedadeId: number, revisao: boolean) {
  const principal = await propriedadePrincipalId(prisma);
  const movimento = propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
  const [produtosLocais, referencias, doencas, templates] = await Promise.all([
    prisma.produto.findMany({ where: produtoSanitario, select: { id: true, nome: true, unidade: true, rastrearPartidas: true, produtoCatalogoId: true }, orderBy: { nome: "asc" } }),
    prisma.produtoCatalogo.findMany({ where: produtoSanitario, select: { id: true, nome: true, apresentacao: true, unidadeSugerida: true }, orderBy: { nome: "asc" } }),
    prisma.doenca.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.templateAplicacoesTablet.findMany({ where: { propriedadeId }, select: { doencaId: true, produtoIds: true, quantidades: true } }),
  ]);
  const partidas = revisao ? await prisma.partidaProduto.findMany({
    where: { produto: produtoSanitario, lotePrincipalId: null, alocacoes: { some: { movimentoEstoque: movimento } } },
    select: { id: true, produtoId: true, codigo: true, validade: true }, orderBy: { codigo: "asc" },
  }) : [];
  const porReferencia = new Map(produtosLocais.filter(p => p.produtoCatalogoId).map(p => [p.produtoCatalogoId!, p]));
  const referenciasAtivas = new Set(referencias.map(p => p.id));
  const catalogo = [
    ...produtosLocais.filter(p => !p.produtoCatalogoId || !referenciasAtivas.has(p.produtoCatalogoId)).map(p => ({ ...p, produtoEstoqueId: p.id })),
    ...referencias.map(c => {
      const local = porReferencia.get(c.id);
      return { id: c.id, nome: local?.nome ?? nomeCompletoCatalogo(c), unidade: local?.unidade ?? c.unidadeSugerida,
        rastrearPartidas: local?.rastrearPartidas ?? false, produtoEstoqueId: local?.id ?? null };
    }),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const aliases = new Map(produtosLocais.filter(p => p.produtoCatalogoId && referenciasAtivas.has(p.produtoCatalogoId)).map(p => [p.id, p.produtoCatalogoId!]));
  const disponiveis = new Set(catalogo.map(p => p.id));
  return { catalogo, doencas, partidas, templates: templates.map(t => ({ ...t, produtoIds: [...new Set(t.produtoIds.map(id => aliases.get(id) ?? id).filter(id => disponiveis.has(id)))], quantidades: Object.fromEntries(Object.entries(quantidadesTemplateSchema.parse(t.quantidades)).flatMap(([id, q]) => { const atual = aliases.get(id) ?? id; return catalogo.find(p => p.id === atual)?.unidade === q.unidade ? [[atual, q]] : []; })) })) };
}

export async function salvarTemplate(input: z.infer<typeof templateSchema>, autorId: number) {
  const { propriedadeId, doencaId, produtoIds } = input;
  return transacaoPecuaria(async tx => {
    const doenca = await tx.doenca.findFirst({ where: { id: doencaId, ativo: true } });
    const [locais, referencias] = await Promise.all([
      tx.produto.findMany({ where: { ...produtoSanitario, id: { in: produtoIds } }, select: { id: true, unidade: true } }),
      tx.produtoCatalogo.findMany({ where: { ...produtoSanitario, id: { in: produtoIds } }, select: { id: true, unidadeSugerida: true } }),
    ]);
    const total = new Set([...locais, ...referencias].map(p => p.id)).size;
    if (!doenca || total !== produtoIds.length) throw new RebanhoError("VALIDACAO", "Confira a doença e os produtos sanitários");
    const antes = await tx.templateAplicacoesTablet.findUnique({ where: { propriedadeId_doencaId: { propriedadeId, doencaId } } });
    const quantidades = Object.fromEntries(Object.entries(input.quantidades ?? quantidadesTemplateSchema.parse(antes?.quantidades ?? {})).filter(([id]) => produtoIds.includes(id)));
    const adotados = Object.keys(quantidades).length ? await tx.produto.findMany({ where: { ...produtoSanitario, produtoCatalogoId: { in: Object.keys(quantidades) } }, select: { produtoCatalogoId: true, unidade: true } }) : [];
    for (const [id, q] of Object.entries(quantidades)) {
      const unidade = locais.find(p => p.id === id)?.unidade ?? adotados.find(p => p.produtoCatalogoId === id)?.unidade ?? referencias.find(p => p.id === id)?.unidadeSugerida;
      if (q.unidade !== unidade) throw new RebanhoError("VALIDACAO", "Confira a unidade da quantidade do template");
      if (["UN", "CX", "SC"].includes(q.unidade) && !Number.isInteger(q.quantidade)) throw new RebanhoError("VALIDACAO", "Informe quantidade inteira para este medicamento");
    }
    if (!produtoIds.length) {
      await tx.templateAplicacoesTablet.deleteMany({ where: { propriedadeId, doencaId } });
      await auditar(tx, { entidade: "TemplateAplicacoesTablet", entidadeId: `${propriedadeId}:${doencaId}`, propriedadeId, usuarioId: autorId, acao: "REMOCAO", antes });
      return { doencaId, produtoIds, quantidades: {} };
    }
    const depois = await tx.templateAplicacoesTablet.upsert({
      where: { propriedadeId_doencaId: { propriedadeId, doencaId } },
      create: { propriedadeId, doencaId, produtoIds, autorId, quantidades }, update: { produtoIds, autorId, quantidades },
      select: { doencaId: true, produtoIds: true, quantidades: true },
    });
    await auditar(tx, { entidade: "TemplateAplicacoesTablet", entidadeId: `${propriedadeId}:${doencaId}`, propriedadeId, usuarioId: autorId, acao: antes ? "EDICAO" : "CADASTRO", antes, depois });
    return depois;
  });
}

export async function enviarAplicacoes(input: z.infer<typeof envioSchema>, autor: Autor) {
  const { id, corrigeId, propriedadeId, animalIds } = input;
  const aplicadaEm = new Date(input.aplicadaEm);
  const data = new Date(diaDaFazenda(aplicadaEm) + "T00:00:00Z");
  if (aplicadaEm > new Date()) throw new RebanhoError("VALIDACAO", "A aplicação não pode ocorrer no futuro");
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, animalIds);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"tablet:" + id}))`;
    const anterior = await tx.envioAplicacoesTablet.findUnique({ where: { id } });
    if (anterior) {
      const guardados = z.array(itemGuardado).parse(anterior.itens);
      const mesmosItens = guardados.length === input.itens.length && guardados.every((g, i) => g.produtoId === input.itens[i].produtoId && g.quantidade === input.itens[i].quantidade);
      if (anterior.corrigeId !== (corrigeId ?? null) || anterior.autorId !== autor.id || anterior.propriedadeId !== propriedadeId || +anterior.aplicadaEm !== +aplicadaEm || !mesmosItens || JSON.stringify(anterior.animalIds) !== JSON.stringify(animalIds))
        throw new RebanhoError("CONFLITO", "Este envio já foi usado com outros dados");
      return { id };
    }
    if (corrigeId) {
      const original = await tx.envioAplicacoesTablet.findFirst({ where: { id: corrigeId, propriedadeId, autorId: autor.id, devolucao: { not: null } } });
      if (!original || +original.aplicadaEm !== +aplicadaEm || JSON.stringify(original.animalIds) !== JSON.stringify(animalIds))
        throw new RebanhoError("VALIDACAO", "A correção deve manter as vacas e a data originais");
      if (await tx.envioAplicacoesTablet.findUnique({ where: { corrigeId } }))
        throw new RebanhoError("CONFLITO", "Já existe um reenvio para este registro");
    }
    for (const animalId of animalIds) {
      const animal = await conferirAnimalNoFato(tx, animalId, propriedadeId, data);
      if (animal.sexo !== "F") throw new RebanhoError("VALIDACAO", "Selecione somente vacas");
    }
    const ids = input.itens.map(i => i.produtoId);
    const locais = await tx.produto.findMany({ where: { ...produtoSanitario, OR: [{ id: { in: ids } }, { produtoCatalogoId: { in: ids } }] }, select: { id: true, nome: true, unidade: true, produtoCatalogoId: true } });
    const faltantes = ids.filter(id => !locais.some(p => p.id === id));
    const referencias = faltantes.length ? await tx.produtoCatalogo.findMany({ where: { ...produtoSanitario, id: { in: faltantes } }, select: { id: true, nome: true, apresentacao: true, unidadeSugerida: true } }) : [];
    const chaves = new Set<string>();
    const guardados = input.itens.map(i => {
      const local = locais.find(p => p.id === i.produtoId);
      const referencia = referencias.find(c => c.id === i.produtoId);
      const adotado = locais.find(p => p.produtoCatalogoId === referencia?.id && referencia);
      if (!local && !referencia) throw new RebanhoError("VALIDACAO", "Selecione medicamentos ativos do catálogo");
      const chave = local?.produtoCatalogoId ?? referencia?.id ?? i.produtoId;
      if (chaves.has(chave)) throw new RebanhoError("VALIDACAO", "Selecione produtos distintos");
      chaves.add(chave);
      const nome = local?.nome ?? adotado?.nome ?? nomeCompletoCatalogo(referencia!);
      const unidade = local?.unidade ?? adotado?.unidade ?? referencia!.unidadeSugerida;
      if (["UN", "CX", "SC"].includes(unidade) && !Number.isInteger(i.quantidade)) throw new RebanhoError("VALIDACAO", "Informe quantidade inteira para " + nome);
      return { ...i, ...(referencia ? { produtoCatalogoId: referencia.id } : {}), nome, unidade };
    });
    return tx.envioAplicacoesTablet.create({ data: {
      id, corrigeId, propriedadeId, autorId: autor.id, autorNome: autor.nome, data, aplicadaEm, animalIds,
      itens: guardados,
    }, select: { id: true } });
  });
}

export async function listarDevolvidos(propriedadeId: number, autorId: number) {
  const devolvidos = await prisma.envioAplicacoesTablet.findMany({ where: { propriedadeId, autorId, devolucao: { not: null } }, select: { id: true } });
  const reenvios = await prisma.envioAplicacoesTablet.findMany({ where: { corrigeId: { in: devolvidos.map(d => d.id) } }, select: { corrigeId: true } });
  const originais = new Set(reenvios.map(r => r.corrigeId));
  return listarEnvios(propriedadeId, undefined, devolvidos.map(d => d.id).filter(id => !originais.has(id)));
}

export async function listarEnvios(propriedadeId: number, id?: string, ids?: string[]) {
  const envios = await prisma.envioAplicacoesTablet.findMany({ where: { propriedadeId, id: ids ? { in: ids } : id },
    orderBy: [{ revisadoEm: { sort: "asc", nulls: "first" } }, { enviadoEm: "desc" }], take: 100 });
  const animais = await prisma.animal.findMany({ where: { id: { in: [...new Set(envios.flatMap(e => e.animalIds))] } }, select: { id: true, brinco: true, nome: true } });
  const porId = new Map(animais.map(a => [a.id, a]));
  return envios.map(e => ({ ...e, itens: z.array(itemGuardado).parse(e.itens), animais: e.animalIds.map(id => porId.get(id) ?? { id, brinco: "", nome: null }) }));
}

const entradaImpacto = (animalId: string, propriedadeId: number, data: string) => ({
  origem: "PROCEDIMENTO" as const, animalId, propriedadeId, data, tipoAplicacaoId: tipoAplicacaoLegadaId(),
});

export async function preverRevisaoEnvio(id: string, propriedadeId: number) {
  return transacaoPecuaria(async tx => {
    const envio = await tx.envioAplicacoesTablet.findFirst({ where: { id, propriedadeId, revisadoEm: null } });
    if (!envio) throw new RebanhoError("NAO_ENCONTRADO", "Envio pendente não encontrado");
    const impactos = [];
    for (const animalId of envio.animalIds) {
      const previa = await previaImpactosTx(tx, entradaImpacto(animalId, propriedadeId, envio.data.toISOString().slice(0, 10)));
      if (previa.exigeConfirmacao) impactos.push({ animalId, revisao: previa.revisao, itens: previa.itens.map(i => ({ protocolo: i.protocolo.nome, efeito: i.efeito })) });
    }
    return impactos;
  }, { timeout: timeoutTransacaoAnimais(50) });
}

export async function revisarEnvio(id: string, input: z.infer<typeof decisaoSchema>, revisor: Autor) {
  return transacaoPecuaria(async tx => {
    const envio = await tx.envioAplicacoesTablet.findFirst({ where: { id, propriedadeId: input.propriedadeId } });
    if (!envio) throw new RebanhoError("NAO_ENCONTRADO", "Envio não encontrado");
    await travarAnimais(tx, envio.animalIds);
    if (envio.revisadoEm) {
      if (envio.revisorId === revisor.id && envio.devolucao === (input.motivo ?? null)) return { id };
      throw new RebanhoError("CONFLITO", "O envio já foi revisado");
    }
    const aplicacaoIds: string[] = [];
    if (!input.motivo) {
      const lista = z.array(itemGuardado).parse(envio.itens);
      const unidades = await tx.produto.findMany({ where: { ...produtoSanitario, OR: [{ id: { in: lista.filter(i => !i.produtoCatalogoId).map(i => i.produtoId) } }, { produtoCatalogoId: { in: lista.flatMap(i => i.produtoCatalogoId ? [i.produtoCatalogoId] : []) } }] }, select: { id: true, unidade: true, produtoCatalogoId: true } });
      const resolver = (i: z.infer<typeof itemGuardado>) => unidades.find(p => i.produtoCatalogoId ? p.produtoCatalogoId === i.produtoCatalogoId : p.id === i.produtoId);
      for (const i of lista) if (!resolver(i)) throw new RebanhoError("VALIDACAO", `Registre uma entrada de estoque de ${i.nome} antes de aprovar.`);
      if (lista.some(i => resolver(i)!.unidade !== i.unidade)) throw new RebanhoError("CONFLITO", "A unidade do produto mudou desde o envio. Devolva para correção antes de aprovar.");
      const conferencia = new Map(input.conferencia?.map(c => [c.produtoId, c]));
      if (input.conferencia?.length !== lista.length || lista.some(i => !conferencia.has(i.produtoId)))
        throw new RebanhoError("VALIDACAO", "Confira todos os itens antes de aprovar");
      const data = envio.data.toISOString().slice(0, 10);
      const confirmacoes = new Map(input.impactos?.map(i => [i.animalId, i.confirmacao]));
      const previas = new Map<string, Awaited<ReturnType<typeof conferirImpactosTx>>>();
      for (const animalId of envio.animalIds)
        previas.set(animalId, await conferirImpactosTx(tx, entradaImpacto(animalId, envio.propriedadeId, data), confirmacoes.get(animalId)));
      const itens = envio.animalIds.flatMap(animalId => lista.map(i => {
        const c = conferencia.get(i.produtoId)!;
        return {
          animalId, propriedadeId: envio.propriedadeId, data, aplicadaEm: envio.aplicadaEm.toISOString(),
          responsavel: envio.autorNome, origemInsumo: "BAIXA_ESTOQUE" as const,
          produtoId: resolver(i)!.id, nomeProdutoAplicado: i.nome, dose: String(i.quantidade), unidadeDose: i.unidade,
          partidaId: c.partidaId, cienciaValidadeDesconhecida: c.cienciaValidadeDesconhecida,
          carenciaLeiteHoras: c.carenciaLeiteHoras, carenciaCarneHoras: c.carenciaCarneHoras,
        };
      }));
      await travarOrigensAplicacoesTx(tx, itens);
      const primeirasAplicacoes = new Map<string, string>();
      for (const item of itens) {
        try {
          const criada = await criarAplicacaoTx(tx, { ...item, impacto: confirmacoes.get(item.animalId) }, revisor.id,
            { impactosConferidos: previas.get(item.animalId), adiarEfeitos: true });
          aplicacaoIds.push(criada.id);
          if (!primeirasAplicacoes.has(item.animalId)) primeirasAplicacoes.set(item.animalId, criada.id);
        } catch (erro) {
          if (erro instanceof RebanhoError) throw new RebanhoError(erro.code, `${item.nomeProdutoAplicado}: ${erro.message}`, erro.campo);
          throw erro;
        }
      }
      for (const [animalId, aplicacaoId] of primeirasAplicacoes) {
        await aplicarImpactosTx(tx, previas.get(animalId)!, { tipo: "AplicacaoProduto", id: aplicacaoId }, confirmacoes.get(animalId), revisor.id);
      }
    }
    await tx.envioAplicacoesTablet.update({ where: { id }, data: {
      revisadoEm: new Date(), revisorId: revisor.id, revisorNome: revisor.nome, devolucao: input.motivo, aplicacaoIds,
    } });
    return { id };
  }, { timeout: timeoutTransacaoAnimais(100) });
}

export async function dadosMedicamento(produtoId: string) {
  const p = await prisma.produto.findFirst({
    where: { ...produtoSanitario, OR: [{ id: produtoId }, { produtoCatalogoId: produtoId }] },
    include: { fabricante: true, classificacaoTecnica: true, perfilSanitarioProduto: true,
      produtoCatalogo: { include: { fabricante: true, classificacaoTecnica: true,
        principiosAtivos: { include: { principioAtivo: true }, orderBy: { ordem: "asc" } } } } },
  });
  if (!p) {
    const c = await prisma.produtoCatalogo.findFirst({ where: { id: produtoId, ...produtoSanitario }, include: {
      fabricante: true, classificacaoTecnica: true, principiosAtivos: { include: { principioAtivo: true }, orderBy: { ordem: "asc" } },
    } });
    if (!c) throw new RebanhoError("NAO_ENCONTRADO", "Medicamento não encontrado");
    return { nome: nomeCompletoCatalogo(c), unidade: c.unidadeSugerida, apresentacao: c.apresentacao,
      fabricante: c.fabricante?.nome ?? null, classificacao: c.classificacaoTecnica?.nome ?? null,
      principiosAtivos: c.principiosAtivos.map(i => i.principioAtivo.nome), conservacao: null, orientacaoUso: null,
      viaPadrao: null, referenciaTecnica: null, carenciaLeiteHoras: null, carenciaCarneHoras: null, bula: c.orientacaoBula, conferenciaBula: c.conferenciaBula };
  }
  const c = p.produtoCatalogo;
  return {
    nome: p.nome, unidade: p.unidade, apresentacao: p.apresentacao ?? c?.apresentacao ?? null,
    fabricante: p.fabricante?.nome ?? c?.fabricante?.nome ?? null,
    classificacao: p.classificacaoTecnica?.nome ?? c?.classificacaoTecnica?.nome ?? null,
    principiosAtivos: c?.principiosAtivos.map(i => i.principioAtivo.nome) ?? [],
    conservacao: p.conservacao, orientacaoUso: p.perfilSanitarioProduto?.orientacaoUso ?? null,
    viaPadrao: p.perfilSanitarioProduto?.viaPadrao ?? null,
    referenciaTecnica: p.perfilSanitarioProduto?.referenciaTecnica ?? null,
    carenciaLeiteHoras: p.perfilSanitarioProduto?.carenciaLeiteHoras ?? null,
    carenciaCarneHoras: p.perfilSanitarioProduto?.carenciaCarneHoras ?? null,
    bula: c?.orientacaoBula ?? null,
    conferenciaBula: c?.conferenciaBula ?? { estado: "IDENTIDADE_PENDENTE", pendencias: [{ campo: "identidade", motivo: /sint[eé]tic|demonstrativ|teste/i.test(p.nome) ? "Cadastro demonstrativo de desenvolvimento; não corresponde a um medicamento comercial com bula validada." : "Produto sem referência oficial vinculada ao catálogo. Confirmar nome comercial, fabricante e apresentação antes de associar informações clínicas." }], fontesParaConferencia: [] },
  };
}
