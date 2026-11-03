import { createHash } from "node:crypto";
import { Prisma, type VinculoImportacaoPecuaria } from "@prisma/client";
import { prisma } from "../../src/db.js";
import { transacaoPecuaria } from "../../src/services/pecuaria/transacao.js";
import { auditar, travarAnimais } from "../../src/services/pecuaria/rebanho/regras.js";
import { prepararFatoHistoricoTx, gravarFatoHistoricoTx } from "../../src/services/pecuaria/importacao/historico.js";
import { identificarDestinoImportacao, validarDestinoImportacao } from "../../src/services/pecuaria/importacao/destino.js";
import { criarManifesto, executarPlano, separarChave } from "../import-v4/plano.js";
import { cargaStgSchema, type ItemStg } from "./contrato.js";

type Destino = ReturnType<typeof identificarDestinoImportacao>;
type Preparado = { entidade: string; existenteId: string | null; candidatosDuplicidade: string[]; contexto: unknown; pendente?: { motivo: string }; animalId?: string | null };
type EstadoGravacao = "CRIADO" | "REUTILIZADO" | "VINCULADO" | "CORRIGIDO";
export type OpcoesImportacaoStg = {
  executar?: boolean; manifestoConfirmado?: string;
  destino: { databaseUrl: string; namespace: string; bancoConfirmado?: string; ambienteConfirmado?: string; destinoConfirmado?: string };
};
export type ReciboStg = {
  chave: string; estado: EstadoGravacao | "PENDENTE" | "FALHOU" | "BLOQUEADO"; destinoId?: string; motivo?: string;
  entidade?: string; operacao: ItemStg["operacao"]; origem: { bancoOrigem: string; chave: string; hash: string };
  contextoPreparado?: unknown; manifestoExecutado?: string;
};
export interface AssociacaoSecagemRelatorio {
  chave: string; estado: "COMPROVADA" | "PENDENTE" | "CONFLITO"; pesagemId: string | null; lactacaoId: string | null;
  referenciaPesagem: unknown; motivo?: string; executada: boolean; vinculoId: string | null;
}
export interface RelatorioStg {
  modo: "PREVIA" | "EXECUCAO"; destino: Destino; autorId: number; bancoOrigem: string;
  pesosSecagem: { total: number; aCriar: number; reutilizaveis: number; comCandidatosDuplicidade: number; conflitos: number; criados: number; reutilizados: number };
  manifesto: ReturnType<typeof criarManifesto>; manifestoConfirmado?: string; reenvioIntegral: boolean;
  planejados: number; pendentes: number; associacoesSecagem: AssociacaoSecagemRelatorio[]; criados: number; reutilizados: number; vinculados: number; corrigidos: number;
  conflitos: { chave: string; motivo: string }[]; recibo: ReciboStg[];
}
function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
function canonico(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor !== null && typeof valor === "object") return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([chave, v]) => [chave, canonico(v)]));
  return valor;
}
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(canonico(JSON.parse(JSON.stringify(valor))))).digest("hex");
const erroTexto = (erro: unknown) => erro instanceof Error ? erro.message : String(erro);
const opcoesFato = (item: ItemStg) => ({ operacao: item.operacao, destinoId: item.destinoId, motivo: item.motivo, versaoEsperada: item.versaoEsperada, duplicidadesRevisadas: item.duplicidadesRevisadas });
const identidade = (bancoOrigem: string, chave: string) => ({ bancoOrigem, ...separarChave(chave) });
function normalizarPreparado(preparado: Preparado): Preparado {
  return { ...preparado, candidatosDuplicidade: [...new Set(preparado.candidatosDuplicidade)].sort() };
}
function conferirDuplicidades(item: ItemStg, preparado: Preparado) {
  if (item.operacao === "VINCULAR") return;
  const candidatos = preparado.candidatosDuplicidade.filter(id => id !== preparado.existenteId && id !== item.destinoId);
  if (candidatos.length && (!item.motivo || candidatos.some(id => !item.duplicidadesRevisadas.includes(id)))) {
    throw new Error(`Revise explicitamente os candidatos a duplicidade antes de gravar: ${candidatos.join(", ")}.`);
  }
}
function conferirVinculo(item: ItemStg, vinculo: VinculoImportacaoPecuaria | undefined | null, hashOrigem: string) {
  if (!vinculo) {
    if (item.operacao === "CORRIGIR") throw new Error("Correção exige um vínculo de origem existente; use VINCULAR para reconhecer um fato.");
    return;
  }
  if (item.destinoId && item.destinoId !== vinculo.destinoId) throw new Error("O destino informado diverge do vínculo de origem persistido.");
  if (vinculo.hashOrigem === hashOrigem) return;
  if (item.operacao !== "CORRIGIR" || item.hashOrigemEsperado !== vinculo.hashOrigem) throw new Error("Hash da origem divergente: confira CORRIGIR, hash anterior, versão e motivo antes de sobrescrever.");
}
function contar(relatorio: RelatorioStg) {
  relatorio.criados = relatorio.recibo.filter(i => i.estado === "CRIADO").length;
  relatorio.reutilizados = relatorio.recibo.filter(i => i.estado === "REUTILIZADO").length;
  relatorio.vinculados = relatorio.recibo.filter(i => i.estado === "VINCULADO").length;
  relatorio.corrigidos = relatorio.recibo.filter(i => i.estado === "CORRIGIDO").length;
  relatorio.pendentes = relatorio.associacoesSecagem.filter(i => i.estado === "PENDENTE").length;
  return relatorio;
}

function projetarAssociacoes(relatorio: RelatorioStg, itens: ItemStg[], preparados: Map<string, Preparado>) {
  const pesos = itens.filter(i => i.fato.tipo === "PESAGEM" && registro(i.fato.dados).tipo === "SECAGEM");
  const comErro = (chave: string) => relatorio.conflitos.some(c => c.chave === chave);
  relatorio.pesosSecagem = { total: pesos.length,
    aCriar: pesos.filter(i => preparados.has(i.chave) && !preparados.get(i.chave)!.existenteId && !comErro(i.chave)).length,
    reutilizaveis: pesos.filter(i => (!!preparados.get(i.chave)?.existenteId || relatorio.recibo.some(r => r.chave === i.chave && r.estado === "REUTILIZADO")) && !comErro(i.chave)).length,
    comCandidatosDuplicidade: pesos.filter(i => !!preparados.get(i.chave)?.candidatosDuplicidade.length).length,
    conflitos: pesos.filter(i => comErro(i.chave)).length,
    criados: pesos.filter(i => relatorio.recibo.some(r => r.chave === i.chave && r.estado === "CRIADO")).length,
    reutilizados: pesos.filter(i => relatorio.recibo.some(r => r.chave === i.chave && r.estado === "REUTILIZADO")).length };

  relatorio.associacoesSecagem = itens.filter(i => i.fato.tipo === "ASSOCIACAO_PESO_SECAGEM").map(item => {
    const recibo = relatorio.recibo.find(r => r.chave === item.chave);
    const dados = registro(item.fato.dados), contexto = registro(registro(recibo?.contextoPreparado ?? preparados.get(item.chave)?.contexto).associacaoSecagem);
    const conflito = relatorio.conflitos.find(c => c.chave === item.chave);
    const estado: AssociacaoSecagemRelatorio["estado"] = conflito || recibo?.estado === "FALHOU" ? "CONFLITO" : recibo?.estado === "BLOQUEADO" ? "PENDENTE" : contexto.estado === "COMPROVADA" ? "COMPROVADA" : "PENDENTE";
    return { chave: item.chave, estado, pesagemId: typeof contexto.pesagemId === "string" ? contexto.pesagemId : null, lactacaoId: typeof dados.lactacaoId === "string" ? dados.lactacaoId : null,
      referenciaPesagem: dados.pesagem, motivo: conflito?.motivo ?? recibo?.motivo ?? (typeof contexto.motivo === "string" ? contexto.motivo : undefined),
      executada: !!recibo && ["CRIADO", "REUTILIZADO", "VINCULADO", "CORRIGIDO"].includes(recibo.estado), vinculoId: recibo?.destinoId ?? (typeof contexto.vinculoId === "string" ? contexto.vinculoId : null) };
  });
  relatorio.pendentes = relatorio.associacoesSecagem.filter(i => i.estado === "PENDENTE").length;
}
/** Fonte técnica revisável. Apenas os handlers de domínio podem decidir sobre fatos históricos. */
export async function importarStg(entrada: unknown, opcoes: OpcoesImportacaoStg): Promise<RelatorioStg> {
  const carga = cargaStgSchema.parse(entrada);
  const destino = identificarDestinoImportacao(opcoes.destino.databaseUrl, opcoes.destino.namespace);
  const relatorio: RelatorioStg = { modo: opcoes.executar ? "EXECUCAO" : "PREVIA", destino, autorId: carga.autorId, bancoOrigem: carga.bancoOrigem,
    manifesto: criarManifesto(carga.bancoOrigem, [], { autorId: carga.autorId, destino }), manifestoConfirmado: opcoes.manifestoConfirmado, reenvioIntegral: false,
    pesosSecagem: { total: carga.itens.filter(i => i.fato.tipo === "PESAGEM" && registro(i.fato.dados).tipo === "SECAGEM").length, aCriar: 0, reutilizaveis: 0, comCandidatosDuplicidade: 0, conflitos: 0, criados: 0, reutilizados: 0 },
    planejados: carga.itens.length, pendentes: 0, associacoesSecagem: [], criados: 0, reutilizados: 0, vinculados: 0, corrigidos: 0, conflitos: [], recibo: [] };
  try {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(opcoes.destino.databaseUrl).hostname);
    if (destino.ambiente === "prod" || local && destino.banco !== "fazendinha_seedatev3") throw new Error("Destino bloqueado: produção não é aceita e o único banco local é fazendinha_seedatev3.");
    if (opcoes.executar) validarDestinoImportacao({ ...opcoes.destino, manifestoConfirmado: opcoes.manifestoConfirmado });
  } catch (erro) { relatorio.conflitos.push({ chave: "$destino", motivo: erroTexto(erro) }); return relatorio; }
  const autor = await prisma.usuario.findUnique({ where: { id: carga.autorId }, select: { id: true, status: true } });
  if (!autor || autor.status !== "ATIVO") { relatorio.conflitos.push({ chave: "$autor", motivo: "Informe um autor explícito ativo no destino." }); return relatorio; }
  const chavesLote = new Set(carga.itens.map(i => i.chave));
  const todasChaves = [...new Set(carga.itens.flatMap(i => [i.chave, ...i.dependencias]))];
  const vinculos = await prisma.vinculoImportacaoPecuaria.findMany({ where: { bancoOrigem: carga.bancoOrigem, OR: todasChaves.map(chave => separarChave(chave)) } });
  const porChave = new Map(vinculos.map(v => [`${v.tabelaOrigem}:${v.chaveOrigem}`, v]));
  const auditorias = vinculos.length ? await prisma.auditoriaPecuaria.findMany({ where: { entidade: "VinculoImportacaoPecuaria", entidadeId: { in: vinculos.map(v => v.id) }, acao: { startsWith: "IMPORTACAO_STG_" } }, orderBy: { em: "desc" } }) : [];
  const hashCarga = hash({ ...carga, itens: [...carga.itens].sort((a, b) => a.chave < b.chave ? -1 : 1).map(i => ({ ...i, dependencias: [...i.dependencias].sort(), duplicidadesRevisadas: [...i.duplicidadesRevisadas].sort() })) });
  const hashes = new Map(carga.itens.map(i => [i.chave, hash(i.fato)]));
  const preparados = new Map<string, Preparado>();
  const reaproveitados = new Map<string, VinculoImportacaoPecuaria>();

  const associacoesRevalidadas = new Map<string, Preparado>(), errosAssociacao = new Map<string, unknown>();
  async function revalidarAssociacao(tx: Prisma.TransactionClient, item: ItemStg, vinculo: VinculoImportacaoPecuaria) {
    const preparado = normalizarPreparado(await prepararFatoHistoricoTx(tx, item.fato, carga.autorId, opcoesFato(item)));
    if (!preparado.pendente && preparado.existenteId !== vinculo.destinoId) throw new Error("A origem aponta a um vínculo de secagem que não está mais ativo; revise o histórico sem remapear ou reativar silenciosamente.");
    return preparado;
  }
  for (const item of carga.itens) {
    const vinculo = porChave.get(item.chave);
    if (item.fato.tipo !== "ASSOCIACAO_PESO_SECAGEM" || !vinculo || vinculo.hashOrigem !== hashes.get(item.chave)) continue;
    try { associacoesRevalidadas.set(item.chave, await revalidarAssociacao(prisma, item, vinculo)); }
    catch (erro) { errosAssociacao.set(item.chave, erro); }
  }

  // Recuperar o mesmo manifesto é leitura: exige lote completo e evidência de cada decisão.
  const manifestoAnterior = auditorias.flatMap(a => {
    const candidato = registro(registro(a.depois).manifesto);
    if (candidato.hash !== opcoes.manifestoConfirmado || candidato.bancoOrigem !== carga.bancoOrigem || !Array.isArray(candidato.itens)) return [];
    try {
      const original = candidato as unknown as ReturnType<typeof criarManifesto>;
      return criarManifesto(original.bancoOrigem, original.itens, original.contexto).hash === original.hash ? [original] : [];
    } catch { return []; }
  })[0];
  const reenvio = !!opcoes.executar && !!manifestoAnterior && carga.itens.every(item => {
    const vinculo = porChave.get(item.chave);
    if (item.fato.tipo === "ASSOCIACAO_PESO_SECAGEM" && (errosAssociacao.has(item.chave) || !associacoesRevalidadas.has(item.chave) || associacoesRevalidadas.get(item.chave)!.pendente || associacoesRevalidadas.get(item.chave)!.existenteId !== vinculo?.destinoId)) return false;
    if (!vinculo || vinculo.hashOrigem !== hashes.get(item.chave) || item.destinoId && item.destinoId !== vinculo.destinoId) return false;
    return auditorias.some(a => {
      const depois = registro(a.depois), alvo = registro(depois.destino);
      return a.entidadeId === vinculo.id && a.usuarioId === carga.autorId && depois.manifestoHash === opcoes.manifestoConfirmado && depois.hashCarga === hashCarga
        && depois.hashOrigem === vinculo.hashOrigem && depois.destinoId === vinculo.destinoId && hash(alvo) === hash(destino);
    });
  });
  if (reenvio) {
    relatorio.reenvioIntegral = true;
    relatorio.manifesto = manifestoAnterior!;
    relatorio.recibo = carga.itens.map(item => {
      const vinculo = porChave.get(item.chave)!;
      const audit = auditorias.find(a => a.entidadeId === vinculo.id && registro(a.depois).manifestoHash === opcoes.manifestoConfirmado)!;
      return { chave: item.chave, estado: "REUTILIZADO", destinoId: vinculo.destinoId, entidade: vinculo.entidadeDestino, operacao: item.operacao,
        origem: { bancoOrigem: carga.bancoOrigem, chave: item.chave, hash: hashes.get(item.chave)! }, contextoPreparado: associacoesRevalidadas.get(item.chave)?.contexto ?? registro(audit.depois).contextoPreparado, manifestoExecutado: opcoes.manifestoConfirmado };
    });
    projetarAssociacoes(relatorio, carga.itens, preparados);
    return contar(relatorio);
  }

  for (const item of carga.itens) {
    try {
      const vinculo = porChave.get(item.chave), hashOrigem = hashes.get(item.chave)!;
      conferirVinculo(item, vinculo, hashOrigem);
      if (vinculo?.hashOrigem === hashOrigem && item.fato.tipo === "ASSOCIACAO_PESO_SECAGEM") {
        if (errosAssociacao.has(item.chave)) throw errosAssociacao.get(item.chave);
        const preparado = associacoesRevalidadas.get(item.chave)!;
        preparados.set(item.chave, preparado);
        if (!preparado.pendente) reaproveitados.set(item.chave, vinculo);
      } else if (vinculo?.hashOrigem === hashOrigem) {
        reaproveitados.set(item.chave, vinculo);
        const audit = auditorias.find(a => a.entidadeId === vinculo.id && registro(a.depois).hashOrigem === hashOrigem);
        preparados.set(item.chave, { entidade: vinculo.entidadeDestino, existenteId: vinculo.destinoId, candidatosDuplicidade: [], contexto: registro(audit?.depois).contextoPreparado ?? { origemIdentica: true, destinoId: vinculo.destinoId } });
      } else {
        const preparado = normalizarPreparado(await prepararFatoHistoricoTx(prisma, item.fato, carga.autorId, opcoesFato(item)));
        conferirDuplicidades(item, preparado); preparados.set(item.chave, preparado);
        if (vinculo && preparado.entidade !== vinculo.entidadeDestino) throw new Error("A entidade do fato diverge do vínculo persistido.");
      }
      for (const dependencia of item.dependencias) if (!preparados.get(item.chave)?.pendente && !chavesLote.has(dependencia) && !porChave.has(dependencia)) throw new Error(`Dependência não encontrada na origem: ${dependencia}.`);
    } catch (erro) { relatorio.conflitos.push({ chave: item.chave, motivo: erroTexto(erro) }); }
  }
  const externas = [...porChave].filter(([chave]) => !chavesLote.has(chave));
  // Detecta ciclos antes de executar qualquer item; executarPlano preserva bloqueio após falhas reais.
  const resolvidas = new Set(externas.map(([chave]) => chave)), pendentes = new Set(chavesLote);
  while (pendentes.size) {
    const livres = carga.itens.filter(i => pendentes.has(i.chave) && (preparados.get(i.chave)?.pendente || i.dependencias.every(d => resolvidas.has(d))));
    if (!livres.length) { for (const chave of pendentes) relatorio.conflitos.push({ chave, motivo: "Dependência indisponível ou cíclica no lote." }); break; }
    for (const item of livres) { pendentes.delete(item.chave); resolvidas.add(item.chave); }
  }
  const contextoItens = carga.itens.map(item => ({ chave: item.chave, operacao: item.operacao, destinoId: item.destinoId ?? null, motivo: item.motivo ?? null, versaoEsperada: item.versaoEsperada ?? null,
    hashOrigemEsperado: item.hashOrigemEsperado ?? null, duplicidadesRevisadas: [...item.duplicidadesRevisadas].sort(), preparado: preparados.get(item.chave) ?? null, ...(item.fato.tipo === "ASSOCIACAO_PESO_SECAGEM" ? { mapeamentoAssociacaoSecagem: item.fato.dados } : {}),
    vinculoAnterior: porChave.get(item.chave) ? { entidade: porChave.get(item.chave)!.entidadeDestino, id: porChave.get(item.chave)!.destinoId, hash: porChave.get(item.chave)!.hashOrigem } : null,
  })).sort((a, b) => a.chave < b.chave ? -1 : 1);
  projetarAssociacoes(relatorio, carga.itens, preparados);
  relatorio.manifesto = criarManifesto(carga.bancoOrigem, carga.itens.map(item => ({ chave: item.chave, hash: hashes.get(item.chave)!, entidade: preparados.get(item.chave)?.entidade ?? item.fato.tipo,
    dependencias: item.dependencias, operacao: reaproveitados.has(item.chave) ? "REUTILIZAR" : "CRIAR", destinoId: item.destinoId ?? preparados.get(item.chave)?.existenteId ?? null })),
    { autorId: carga.autorId, destino, hashCarga, itens: contextoItens, resumoSecagens: { pesos: relatorio.pesosSecagem, associacoes: relatorio.associacoesSecagem }, dependenciasExternas: externas.map(([chave, v]) => ({ chave, destinoId: v.destinoId, hash: v.hashOrigem })).sort((a, b) => a.chave < b.chave ? -1 : 1) });
  projetarAssociacoes(relatorio, carga.itens, preparados);
  if (!opcoes.executar) return relatorio;
  if (opcoes.manifestoConfirmado !== relatorio.manifesto.hash) relatorio.conflitos.push({ chave: "$manifesto", motivo: "O manifesto mudou: gere e revise uma nova prévia. Reenvio parcial exige nova prévia." });
  if (relatorio.conflitos.length) return relatorio;

  async function auditarDecisao(tx: Prisma.TransactionClient, item: ItemStg, vinculo: VinculoImportacaoPecuaria, estado: EstadoGravacao, preparado: Preparado, antes: unknown) {
    await auditar(tx, { entidade: "VinculoImportacaoPecuaria", entidadeId: vinculo.id, acao: `IMPORTACAO_STG_${estado}`, usuarioId: carga.autorId, antes,
      depois: { ...identidade(carga.bancoOrigem, item.chave), entidadeDestino: preparado.entidade, destinoId: vinculo.destinoId, hashOrigem: hashes.get(item.chave)!, chaveCompleta: item.chave,
        hashCarga, manifestoHash: relatorio.manifesto.hash, ...(item.chave === carga.itens[0].chave ? { manifesto: relatorio.manifesto } : {}), destino, operacao: item.operacao, motivo: item.motivo ?? null,
        versaoEsperada: item.versaoEsperada ?? null, contextoPreparado: preparado.contexto, candidatosDuplicidade: preparado.candidatosDuplicidade, duplicidadesRevisadas: item.duplicidadesRevisadas } });
  }
  const resultados = new Map<string, { estado: EstadoGravacao | "PENDENTE"; entidade: string; contexto: unknown }>();
  const recibo = await executarPlano(carga.itens.map(item => ({ chave: item.chave, dependencias: preparados.get(item.chave)?.pendente ? [] : item.dependencias, gravar: async () => {
    const preparadoPendente = preparados.get(item.chave);
    if (preparadoPendente?.pendente) {
      resultados.set(item.chave, { estado: "PENDENTE", entidade: preparadoPendente.entidade, contexto: preparadoPendente.contexto });
      // Sem sucesso no coordenador: a pendência não libera descendentes nem recebe ID/origem fictícios.
      throw new Error(preparadoPendente.pendente.motivo);
    }
    return transacaoPecuaria(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`import-stg:${carga.bancoOrigem}:${item.chave}`}))`;
    const autorAtual = await tx.usuario.findUnique({ where: { id: carga.autorId }, select: { status: true } });
    if (!autorAtual || autorAtual.status !== "ATIVO") throw new Error("A autoria deixou de estar ativa; revise a prévia.");
    const chave = identidade(carga.bancoOrigem, item.chave), hashOrigem = hashes.get(item.chave)!;
    const atual = await tx.vinculoImportacaoPecuaria.findUnique({ where: { bancoOrigem_tabelaOrigem_chaveOrigem: chave } });
    const vinculoPrevisto = porChave.get(item.chave);
    if (vinculoPrevisto && atual && (atual.destinoId !== vinculoPrevisto.destinoId || atual.entidadeDestino !== vinculoPrevisto.entidadeDestino)) throw new Error("O destino da origem mudou depois da prévia; confira novamente.");
    conferirVinculo(item, atual, hashOrigem);
    const esperado = preparados.get(item.chave)!;
    if (atual?.hashOrigem === hashOrigem) {
      if (atual.entidadeDestino !== esperado.entidade) throw new Error("A entidade mudou após a prévia.");
      if (item.fato.tipo === "ASSOCIACAO_PESO_SECAGEM") {
        if (!esperado.animalId) throw new Error("Confira a identidade do animal antes de reutilizar a associação de secagem.");
        await travarAnimais(tx, [esperado.animalId]);
        const revalidado = await revalidarAssociacao(tx, item, atual);
        if (revalidado.pendente || hash(revalidado) !== hash(esperado)) throw new Error("O encerramento ou o vínculo ativo mudou após a prévia; revalide a associação sem alterar o peso.");
      }
      const decisaoAuditada = auditorias.some(a => a.entidadeId === atual.id && a.usuarioId === carga.autorId && registro(a.depois).manifestoHash === relatorio.manifesto.hash && registro(a.depois).hashCarga === hashCarga);
      if (!decisaoAuditada) await auditarDecisao(tx, item, atual, "REUTILIZADO", esperado, atual);
      resultados.set(item.chave, { estado: "REUTILIZADO", entidade: atual.entidadeDestino, contexto: esperado.contexto }); return { destinoId: atual.destinoId, reutilizado: true };
    }
    for (const dependencia of item.dependencias) {
      const v = await tx.vinculoImportacaoPecuaria.findUnique({ where: { bancoOrigem_tabelaOrigem_chaveOrigem: identidade(carga.bancoOrigem, dependencia) } });
      if (!v || porChave.has(dependencia) && !chavesLote.has(dependencia) && (v.destinoId !== porChave.get(dependencia)!.destinoId || v.hashOrigem !== porChave.get(dependencia)!.hashOrigem)) throw new Error(`Dependência mudou após a prévia: ${dependencia}.`);
    }
    const preparado = normalizarPreparado(await prepararFatoHistoricoTx(tx, item.fato, carga.autorId, opcoesFato(item)));
    conferirDuplicidades(item, preparado);
    if (hash(preparado) !== hash(esperado)) throw new Error("O contexto preparado mudou após a prévia; confira novamente.");
    const salvo = await gravarFatoHistoricoTx(tx, item.fato, carga.autorId, opcoesFato(item));
    if (item.destinoId && salvo.id !== item.destinoId || preparado.existenteId && salvo.id !== preparado.existenteId) throw new Error("O handler retornou um destino diferente do revisado.");
    const antes = atual ? { ...atual } : null;
    const dados = { ...chave, entidadeDestino: preparado.entidade, destinoId: salvo.id, hashOrigem };
    const vinculo = atual ? await tx.vinculoImportacaoPecuaria.update({ where: { id: atual.id }, data: dados }) : await tx.vinculoImportacaoPecuaria.create({ data: dados });
    const estado: EstadoGravacao = item.operacao === "CORRIGIR" ? "CORRIGIDO" : item.operacao === "VINCULAR" ? "VINCULADO" : preparado.existenteId ? "REUTILIZADO" : "CRIADO";
    await auditarDecisao(tx, item, vinculo, estado, preparado, antes);
    resultados.set(item.chave, { estado, entidade: preparado.entidade, contexto: preparado.contexto }); return { destinoId: salvo.id, reutilizado: estado === "REUTILIZADO" };
  }); } })), new Set(externas.map(([chave]) => chave)));
  relatorio.recibo = recibo.map(r => {
    const item = carga.itens.find(i => i.chave === r.chave)!, resultado = resultados.get(r.chave);
    return { ...r, estado: resultado?.estado === "PENDENTE" ? "PENDENTE" : r.estado === "CRIADO" || r.estado === "REUTILIZADO" ? resultado!.estado : r.estado, entidade: resultado?.entidade, operacao: item.operacao,
      origem: { bancoOrigem: carga.bancoOrigem, chave: item.chave, hash: hashes.get(item.chave)! }, contextoPreparado: resultado?.contexto, manifestoExecutado: relatorio.manifesto.hash };
  });
  projetarAssociacoes(relatorio, carga.itens, preparados);
  return contar(relatorio);
}
