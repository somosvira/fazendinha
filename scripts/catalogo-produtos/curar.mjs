#!/usr/bin/env node
// Curadoria do catálogo de produtos (fonte IDEAGRI_DADOS000).
//
// Uso: node scripts/catalogo-produtos/curar.mjs <extracao.json> <saida-dir>
//
// O julgamento fica nos mapeamentos explícitos (classificacao-uso.json e unidade-medida.json);
// este script só aplica regras determinísticas. Mesma entrada + mesmos mapeamentos = mesma saída
// (geradoEm vem da extração, não do relógio).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONTE = 'IDEAGRI_DADOS000';
export const UNIDADES_VALIDAS = ['UN', 'KG', 'G', 'T', 'L', 'ML', 'SC', 'DOSE', 'CX', 'M', 'HA'];
export const USOS_VALIDOS = ['sanitario', 'nutricional', 'genetico'];
const SEMENTE_RNG = 42;

// ---------------------------------------------------------------------------
// Texto

/** Remove espaços nas pontas e colapsa sequências de espaços em branco. Não altera caixa nem acentos. */
export function limparEspacos(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

/** Chave de comparação: minúsculas, sem acentos, espaços colapsados. */
export function normalizar(texto) {
  return limparEspacos(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const PALAVRAS_EMBALAGEM =
  /^(embalagem|emb\.?|frasco|fr[.,]?|saco|bombona|balde|tambor|seringa|pote|ampola|bisnaga|caixa|cx\.?|lata|envelopes?|sach[êe]|gal[ãa]o|tanque|tubo|barrica|cartucho|bujão|rolo|injetor|pacote|tira|blister|cartela|cilindro|vela|flaconete|garrafa)/i;

/**
 * Separa a apresentação do nome. Só olha o último grupo entre parênteses no fim do nome e só o
 * trata como apresentação se tiver dígito ou começar por palavra de embalagem (evita "Caldex (Mgp)").
 * Não interpreta quantidades.
 */
export function separarApresentacao(nomeBruto) {
  const limpo = limparEspacos(nomeBruto);
  const m = /^(.*\S)\s*\(([^()]*)\)$/.exec(limpo);
  if (!m) return { nome: limpo, apresentacao: null };
  const nome = limparEspacos(m[1]);
  const apresentacao = limparEspacos(m[2]);
  if (!nome || !apresentacao) return { nome: limpo, apresentacao: null };
  if (!/\d/.test(apresentacao) && !PALAVRAS_EMBALAGEM.test(apresentacao)) {
    return { nome: limpo, apresentacao: null };
  }
  return { nome, apresentacao };
}

// ---------------------------------------------------------------------------
// Mapeamentos

/** Valida o arquivo de unidades e devolve-o. Lança erro se algum valor não for UnidadeMedida. */
export function validarMapaUnidades(mapa) {
  if (!UNIDADES_VALIDAS.includes(mapa?.fallback)) throw new Error(`fallback de unidade inválido: ${mapa?.fallback}`);
  for (const [cod, u] of Object.entries(mapa.unidades ?? {})) {
    if (!UNIDADES_VALIDAS.includes(u.unidade)) throw new Error(`unidade ${cod} mapeada para valor inválido: ${u.unidade}`);
  }
  return mapa;
}

/** Valida o mapeamento de classes. */
export function validarMapaClasses(mapa) {
  for (const [cod, c] of Object.entries(mapa?.classes ?? {})) {
    if (typeof c.incluir !== 'boolean') throw new Error(`classe ${cod}: "incluir" deve ser booleano`);
    if (!Array.isArray(c.uso)) throw new Error(`classe ${cod}: "uso" deve ser lista`);
    for (const u of c.uso) if (!USOS_VALIDOS.includes(u)) throw new Error(`classe ${cod}: uso inválido "${u}"`);
    if (!c.motivo) throw new Error(`classe ${cod}: "motivo" é obrigatório`);
  }
  return mapa;
}

/** Resolve a unidade de um código de origem. Devolve a unidade e se caiu em fallback. */
export function mapearUnidade(codigo, mapa) {
  const entrada = codigo == null ? undefined : mapa.unidades[String(codigo)];
  if (!entrada) return { unidade: mapa.fallback, fallback: true, motivo: 'codigo-ausente-no-mapa' };
  return { unidade: entrada.unidade, fallback: Boolean(entrada.fallback), motivo: entrada.fallback ? 'sem-equivalente' : null };
}

// ---------------------------------------------------------------------------
// Núcleo

const porCodigo = (a, b) => Number(a) - Number(b);

function indexar(lista, chave) {
  return new Map(lista.map((x) => [String(x[chave]), x]));
}

function rotuloUso(p) {
  const u = [p.usoSanitario && 'sanitario', p.usoNutricional && 'nutricional', p.usoGenetico && 'genetico'].filter(Boolean);
  return u.length ? u.join('+') : 'nenhum';
}

function contar(obj, chave, n = 1) {
  obj[chave] = (obj[chave] ?? 0) + n;
}

/**
 * Função pura: extração + mapeamentos -> catálogo curado e estatísticas.
 * Ordem de exclusão por produto (primeira que casa vence):
 * composto > tipo-nao-produto > classe-excluida > nome-vazio > duplicado.
 * Produto sem classificação (e TIPO P) é mantido, sem flags de uso.
 */
export function curar(extracao, { classes: mapaClasses, unidades: mapaUnidades, versao = 1, geradoEm } = {}) {
  validarMapaClasses(mapaClasses);
  validarMapaUnidades(mapaUnidades);
  const rec = extracao.records;
  const classesFonte = indexar(rec.CLASSIFICACAO, 'CDCLASSIFICACAO');
  const fabsFonte = indexar(rec.PESSOA, 'CDPESSOA');
  const pasFonte = indexar(rec.PRINCIPIOATIVO, 'CDPRINCIPIOATIVO');

  const semMapa = [...classesFonte.keys()].filter((c) => !mapaClasses.classes[c]);
  if (semMapa.length) throw new Error(`Classificações sem mapeamento em classificacao-uso.json: ${semMapa.join(', ')}`);

  // Vínculos produto -> PAs, ordenados por CDPRODUTOPRINCIPIOATIVO, sem repetir PA.
  const vinculos = new Map();
  let paRepetidos = 0;
  for (const v of [...rec.PRODUTOPRINCIPIOATIVO].sort((a, b) => porCodigo(a.CDPRODUTOPRINCIPIOATIVO, b.CDPRODUTOPRINCIPIOATIVO))) {
    const lista = vinculos.get(String(v.CDPRODUTO)) ?? [];
    const pa = String(v.CDPRINCIPIOATIVO);
    if (lista.includes(pa)) paRepetidos += 1;
    else lista.push(pa);
    vinculos.set(String(v.CDPRODUTO), lista);
  }

  const stats = {
    entrada: rec.PRODUTO.length,
    saida: 0,
    porMotivo: {},
    excluidosPorClasse: {},
    uso: {},
    unidadeOrigem: {},
    unidadeFallbackProdutos: 0,
    semApresentacao: 0,
    semFabricante: 0,
    fabricanteDesconhecido: 0,
    semPrincipioAtivo: 0,
    vinculosPaRepetidos: 0,
    classesIncluidasSemItens: [],
    classesRevisar: [],
  };
  const excluidos = [];
  const duplicados = [];
  const vistos = new Map(); // chave dedup -> codigoOrigem mantido
  const produtos = [];

  const exclui = (p, motivo, detalhe = null) => {
    contar(stats.porMotivo, motivo);
    if (p.CDCLASSIFICACAO != null) contar(stats.excluidosPorClasse, String(p.CDCLASSIFICACAO));
    excluidos.push({
      codigoOrigem: String(p.CDPRODUTO),
      nome: p.NOME,
      classificacaoCodigo: p.CDCLASSIFICACAO == null ? null : String(p.CDCLASSIFICACAO),
      classificacaoNome: classesFonte.get(String(p.CDCLASSIFICACAO))?.DESCRICAO ?? null,
      motivo,
      detalhe,
    });
  };

  for (const p of [...rec.PRODUTO].sort((a, b) => porCodigo(a.CDPRODUTO, b.CDPRODUTO))) {
    const codigoOrigem = String(p.CDPRODUTO);
    if (String(p.COMPOSTO) === '1') { exclui(p, 'composto', 'mistura feita na fazenda'); continue; }
    if (p.TIPO !== 'P') { exclui(p, 'tipo-nao-produto', `TIPO=${p.TIPO}`); continue; }
    const cls = p.CDCLASSIFICACAO == null ? null : mapaClasses.classes[String(p.CDCLASSIFICACAO)];
    if (cls && !cls.incluir) { exclui(p, 'classe-excluida', cls.motivo); continue; }

    const { nome, apresentacao } = separarApresentacao(p.NOME);
    if (!nome) { exclui(p, 'nome-vazio'); continue; }
    const fabricanteCodigo = p.CDFABRICANTE == null ? null : String(p.CDFABRICANTE);
    const fabValido = fabricanteCodigo != null && fabsFonte.has(fabricanteCodigo);
    if (fabricanteCodigo != null && !fabValido) stats.fabricanteDesconhecido += 1;

    const chave = [normalizar(nome), normalizar(apresentacao ?? ''), fabValido ? fabricanteCodigo : ''].join('|');
    if (vistos.has(chave)) {
      duplicados.push({ mantido: vistos.get(chave), descartado: codigoOrigem, nome: p.NOME });
      exclui(p, 'duplicado', `mantido ${vistos.get(chave)}`);
      continue;
    }
    vistos.set(chave, codigoOrigem);

    const un = mapearUnidade(p.CDUNIDADEMEDIDA, mapaUnidades);
    contar(stats.unidadeOrigem, String(p.CDUNIDADEMEDIDA));
    if (un.fallback) stats.unidadeFallbackProdutos += 1;
    const uso = cls?.uso ?? [];
    const pas = vinculos.get(codigoOrigem) ?? [];

    const produto = {
      codigoOrigem,
      nome,
      apresentacao,
      fabricanteCodigo: fabValido ? fabricanteCodigo : null,
      classificacaoCodigo: p.CDCLASSIFICACAO == null ? null : String(p.CDCLASSIFICACAO),
      unidadeSugerida: un.unidade,
      usoSanitario: uso.includes('sanitario'),
      usoNutricional: uso.includes('nutricional'),
      usoGenetico: uso.includes('genetico'),
      principiosAtivos: pas.filter((c) => pasFonte.has(c)),
      // ATIVO da fonte não significa "descontinuado" (ver relatório): todo item curado entra ativo.
      ativo: true,
    };
    produtos.push(produto);
    contar(stats.uso, rotuloUso(produto));
    if (!apresentacao) stats.semApresentacao += 1;
    if (!fabValido) stats.semFabricante += 1;
    if (!produto.principiosAtivos.length) stats.semPrincipioAtivo += 1;
  }
  stats.saida = produtos.length;
  stats.vinculosPaRepetidos = paRepetidos;

  const usadas = (campo) => new Set(produtos.map((p) => p[campo]).filter((x) => x != null));
  const fabUsados = usadas('fabricanteCodigo');
  const clsUsadas = usadas('classificacaoCodigo');
  const paUsados = new Set(produtos.flatMap((p) => p.principiosAtivos));

  const catalogo = {
    versao,
    fonte: FONTE,
    geradoEm: geradoEm ?? extracao.metadata?.extractedAt ?? null,
    fabricantes: [...fabUsados].sort(porCodigo).map((c) => ({ codigo: c, nome: limparEspacos(fabsFonte.get(c).NOME) })),
    classificacoes: [...clsUsadas].sort(porCodigo).map((c) => ({
      codigo: c,
      nome: limparEspacos(classesFonte.get(c).DESCRICAO),
      estrutura: classesFonte.get(c).ESTRUTURA ?? null,
    })),
    principiosAtivos: [...paUsados].sort(porCodigo).map((c) => ({ codigo: c, nome: limparEspacos(pasFonte.get(c).NOME) })),
    produtos,
  };

  for (const [cod, c] of Object.entries(mapaClasses.classes)) {
    if (c.incluir && !clsUsadas.has(cod)) stats.classesIncluidasSemItens.push(cod);
    if (c.revisar) stats.classesRevisar.push(cod);
  }

  // Diagnósticos de qualidade
  stats.colisoesNomeNormalizado = {};
  for (const [rotulo, lista] of [['fabricantes', catalogo.fabricantes], ['classificacoes', catalogo.classificacoes], ['principiosAtivos', catalogo.principiosAtivos]]) {
    const g = new Map();
    for (const x of lista) g.set(normalizar(x.nome), [...(g.get(normalizar(x.nome)) ?? []), x.codigo]);
    stats.colisoesNomeNormalizado[rotulo] = [...g.entries()].filter(([, v]) => v.length > 1).map(([nome, codigos]) => ({ nome, codigos }));
  }
  const porNomeApres = new Map();
  for (const p of produtos) {
    const k = `${normalizar(p.nome)}|${normalizar(p.apresentacao ?? '')}`;
    const s = porNomeApres.get(k) ?? new Set();
    s.add(p.fabricanteCodigo ?? '');
    porNomeApres.set(k, s);
  }
  stats.mesmoNomeApresentacaoFabricantesDiferentes = [...porNomeApres.values()].filter((s) => s.size > 1).length;
  stats.diagnosticoFonte = diagnosticarAtivoTipo(rec.PRODUTO, rec.PRODUTOPRINCIPIOATIVO);

  return { catalogo, excluidos, duplicados, stats };
}

/** Números que sustentam a decisão sobre ATIVO/TIPO. */
export function diagnosticarAtivoTipo(produtos, vinculos) {
  const ativoTipo = {};
  let padraoIgualCodigo = 0;
  const preenchidos = {};
  const campos = ['ESTOCAVEL', 'SAIDAIMEDIATA', 'MINIMOESTOQUE', 'ESTOQUEINICIAL', 'VRUNITARIOESTOQUE', 'CDCONTAGERENCIALDESPESA', 'CDCONTAGERENCIALRECEITA', 'CDLOCALARMAZENAMENTO', 'IDUNICO', 'EXIBIRNAAGENDA'];
  const comPA = new Set(vinculos.map((v) => String(v.CDPRODUTO)));
  const ativoPorPA = {};
  const unidades = {};
  for (const p of produtos) {
    contar(ativoTipo, `ATIVO=${p.ATIVO}/TIPO=${p.TIPO}`);
    if (p.PADRAO != null && String(p.PADRAO) === String(p.CDPRODUTO)) padraoIgualCodigo += 1;
    for (const c of campos) {
      const v = p[c];
      if (v != null && v !== '' && v !== '0') contar(preenchidos, c);
    }
    contar(ativoPorPA, `ATIVO=${p.ATIVO}/comPA=${comPA.has(String(p.CDPRODUTO))}`);
    contar(unidades, String(p.CDUNIDADEMEDIDA));
  }
  const ativoUm = produtos.filter((p) => String(p.ATIVO) === '1').map((p) => ({ codigoOrigem: String(p.CDPRODUTO), nome: p.NOME, tipo: p.TIPO, classificacao: p.CDCLASSIFICACAO ?? null, padrao: p.PADRAO ?? null }));
  const tipoS = produtos.filter((p) => p.TIPO !== 'P').map((p) => ({ codigoOrigem: String(p.CDPRODUTO), nome: p.NOME, tipo: p.TIPO }));
  return { ativoTipo, padraoIgualCodigo, camposOperacionaisPreenchidos: preenchidos, ativoPorPA, unidadesNaFonte: unidades, ativoUm, tipoS };
}

// ---------------------------------------------------------------------------
// Amostragem com semente

export function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function amostrar(lista, n, rng) {
  const idx = lista.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => lista[i]);
}

// ---------------------------------------------------------------------------
// Relatório

const cel = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const tabela = (cab, linhas) => [`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map(cel).join(' | ')} |`)].join('\n');
const fmt = (n) => new Intl.NumberFormat('pt-BR').format(n);

export function gerarRelatorio({ catalogo, excluidos, duplicados, stats }, { mapaClasses, mapaUnidades, extracao }) {
  const rng = mulberry32(SEMENTE_RNG);
  const classeNome = new Map(catalogo.classificacoes.map((c) => [c.codigo, c.nome]));
  const amostraInc = amostrar(catalogo.produtos, 30, rng);
  const amostraExc = amostrar(excluidos, 15, rng);
  const d = stats.diagnosticoFonte;
  const L = [];
  L.push('# Relatório de curadoria do catálogo de produtos');
  L.push('');
  L.push(`Fonte: ${FONTE}. Versão do catálogo: ${catalogo.versao}. Extração de ${extracao.metadata?.extractedAt ?? 'data desconhecida'} (sha256 ${extracao.metadata?.sourceSha256 ?? 'n/d'}). Gerado por \`scripts/catalogo-produtos/curar.mjs\`; todo julgamento está em \`classificacao-uso.json\` e \`unidade-medida.json\`.`);
  L.push('');
  L.push('## Contagens');
  L.push('');
  L.push(`Entraram ${fmt(stats.entrada)} produtos; saíram ${fmt(stats.saida)} no catálogo (${fmt(stats.entrada - stats.saida)} excluídos).`);
  L.push('');
  const motivos = Object.entries(stats.porMotivo).sort((a, b) => b[1] - a[1]);
  L.push(tabela(['Motivo da exclusão', 'Produtos'], [...motivos.map(([m, n]) => [m, fmt(n)]), ['Total excluídos', fmt(stats.entrada - stats.saida)]]));
  L.push('');
  L.push(`Fabricantes referenciados: ${catalogo.fabricantes.length}. Classificações: ${catalogo.classificacoes.length}. Princípios ativos: ${catalogo.principiosAtivos.length}.`);
  L.push('');
  L.push('## Distribuição de uso (produtos incluídos)');
  L.push('');
  L.push(tabela(['Uso', 'Produtos'], Object.entries(stats.uso).sort((a, b) => b[1] - a[1]).map(([u, n]) => [u, fmt(n)])));
  L.push('');
  const porClasse = new Map();
  for (const p of catalogo.produtos) {
    const k = p.classificacaoCodigo ?? '(sem)';
    porClasse.set(k, (porClasse.get(k) ?? 0) + 1);
  }
  L.push('### Incluídos por classe');
  L.push('');
  L.push(tabela(['Código', 'Estrutura', 'Classe', 'Uso', 'Revisar', 'Produtos'],
    [...porClasse.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, mapaClasses.classes[c]?.estrutura, mapaClasses.classes[c]?.nome, (mapaClasses.classes[c]?.uso ?? []).join('+') || 'nenhum', mapaClasses.classes[c]?.revisar ? 'sim' : '', fmt(n)])));
  L.push('');
  L.push('Nenhum item recebe uso genético: as classes "Animal/Embrião", "Sêmen" e "Inseminação" não têm produtos na extração.');
  L.push('');
  L.push('## Classes excluídas');
  L.push('');
  const exCls = Object.entries(stats.excluidosPorClasse).sort((a, b) => b[1] - a[1]);
  L.push(tabela(['Código', 'Estrutura', 'Classe', 'Produtos excluídos'], exCls.map(([c, n]) => [c, mapaClasses.classes[c]?.estrutura, mapaClasses.classes[c]?.nome, fmt(n)])));
  L.push('');
  const exSemItens = Object.entries(mapaClasses.classes).filter(([c, v]) => !v.incluir && !stats.excluidosPorClasse[c]);
  L.push(`Outras ${exSemItens.length} classes estão marcadas como excluídas mas não têm produtos na extração (ver o mapeamento). Classes incluídas sem itens: ${stats.classesIncluidasSemItens.length}.`);
  L.push('');
  L.push(`Classes marcadas \`revisar\` no mapeamento: ${stats.classesRevisar.map((c) => `${c} ${mapaClasses.classes[c].nome}`).join('; ') || 'nenhuma'}.`);
  L.push('');
  L.push('## Unidades');
  L.push('');
  L.push(tabela(['Código origem', 'Nome', 'Produtos (incluídos)', 'UnidadeMedida', 'Fallback'],
    Object.entries(mapaUnidades.unidades).map(([c, u]) => [c, `${u.nome} (${u.simbolo})`, fmt(stats.unidadeOrigem[c] ?? 0), u.unidade, u.fallback ? 'sim' : 'não'])));
  L.push('');
  const fb = Object.values(mapaUnidades.unidades).filter((u) => u.fallback).length;
  L.push(`${fb} das ${Object.keys(mapaUnidades.unidades).length} unidades de origem não têm equivalente no enum e caem em ${mapaUnidades.fallback}. Produtos que dependeram de fallback: ${fmt(stats.unidadeFallbackProdutos)}.`);
  L.push('');
  const unCodes = Object.keys(d.unidadesNaFonte);
  L.push(`Achado: todos os produtos da fonte usam a mesma unidade de origem (${unCodes.map((c) => `${c} = ${mapaUnidades.unidades[c]?.nome}`).join(', ')}), então \`unidadeSugerida\` não carrega informação da fonte. UN é coerente porque o item é comprado pela embalagem da apresentação (frasco, saco), mas não distingue, por exemplo, sal mineral a granel em KG.`);
  L.push('');
  L.push('## Duplicidades');
  L.push('');
  L.push(`Regra: mesmo nome + apresentação + fabricante, normalizados (minúsculas, sem acentos, espaços colapsados); fica o menor CDPRODUTO. Duplicados removidos: ${duplicados.length}.`);
  if (duplicados.length) {
    L.push('');
    L.push(tabela(['Mantido', 'Descartado', 'Nome (origem)'], duplicados.slice(0, 40).map((x) => [x.mantido, x.descartado, x.nome])));
    if (duplicados.length > 40) L.push(`\n(${duplicados.length - 40} outros omitidos.)`);
  } else {
    L.push('A fonte já não repete nome + fabricante (nem antes da normalização).');
  }
  L.push('');
  L.push(`Itens com mesmo nome + apresentação mas fabricantes diferentes (mantidos): ${stats.mesmoNomeApresentacaoFabricantesDiferentes} grupos.`);
  L.push('');
  L.push('## O que significam ATIVO e TIPO');
  L.push('');
  L.push(`Distribuição ATIVO/TIPO: ${Object.entries(d.ativoTipo).map(([k, n]) => `${k} = ${fmt(n)}`).join('; ')}.`);
  L.push('');
  L.push(`- **ATIVO não é "descontinuado".** Quase tudo é ATIVO=0, e esses itens são o catálogo-padrão da fonte: ${fmt(d.padraoIgualCodigo)} produtos têm PADRAO igual ao próprio CDPRODUTO (provável registro padrão distribuído pelo fornecedor do sistema). Campos operacionais (estoque, estoque mínimo, valor, conta gerencial, local, agenda, ID único) estão vazios em todos${Object.keys(d.camposOperacionaisPreenchidos).length ? ` exceto ${JSON.stringify(d.camposOperacionaisPreenchidos)}` : ''}. Isso é uma lista-modelo ainda não ativada por nenhuma fazenda. ATIVO parece ser "ativado/em uso na fazenda" (equivalente ao nosso \`Produto\`), não o status do item do catálogo.`);
  L.push(`- ATIVO tampouco se correlaciona com vínculo a princípio ativo: ${Object.entries(d.ativoPorPA).map(([k, n]) => `${k} = ${fmt(n)}`).join('; ')}.`);
  L.push(`- O único ATIVO=1 é ${d.ativoUm.map((x) => `"${x.nome}" (${x.codigoOrigem}, TIPO=${x.tipo}, sem classificação, PADRAO=${x.padrao})`).join('; ') || 'inexistente'}: um serviço interno criado fora do padrão, não um insumo.`);
  L.push(`- **TIPO**: P = produto (${fmt(stats.entrada - d.tipoS.length)}); S = serviço (${d.tipoS.map((x) => `"${x.nome}"`).join(', ')}). Inferido dos dados; não há dicionário da fonte.`);
  L.push('');
  L.push('**Decisão:** `ativo = true` para todo item incluído, independente do ATIVO da fonte (usar ATIVO=1 esvaziaria o catálogo). Itens com TIPO diferente de P são excluídos (motivo `tipo-nao-produto`). COMPOSTO é 0 em todos os registros, então a regra de excluir misturas da fazenda não removeu nada, mas continua aplicada. A regra de "só excluir sem classificação se claramente não pecuário" também não foi necessária: o único item sem classificação é o serviço acima.');
  L.push('');
  L.push('## Qualidade dos dados');
  L.push('');
  L.push(`- Produtos incluídos sem apresentação (nome sem parêntese final de embalagem): ${fmt(stats.semApresentacao)}.`);
  L.push(`- Produtos incluídos sem fabricante: ${fmt(stats.semFabricante)}; com fabricante ausente em PESSOA: ${fmt(stats.fabricanteDesconhecido)}.`);
  L.push(`- Produtos incluídos sem princípio ativo: ${fmt(stats.semPrincipioAtivo)}.`);
  L.push(`- Vínculos produto/princípio ativo repetidos na fonte (descartados, mantida a primeira ocorrência): ${fmt(stats.vinculosPaRepetidos)}.`);
  L.push('- Concentração e unidade do princípio ativo vêm vazias na fonte (consistente com o contrato: lista simples).');
  const col = stats.colisoesNomeNormalizado;
  L.push(`- Colisões de \`nomeNormalizado\` (unique no banco): fabricantes ${col.fabricantes.length}, classificações ${col.classificacoes.length}, princípios ativos ${col.principiosAtivos.length}.${[...col.fabricantes, ...col.classificacoes, ...col.principiosAtivos].length ? ' Exemplos: ' + [...col.fabricantes, ...col.classificacoes, ...col.principiosAtivos].slice(0, 5).map((x) => `${x.nome} [${x.codigos.join(',')}]`).join('; ') + '.' : ''}`);
  L.push('- Caixa dos nomes vem da fonte (ex.: "Pó C/", "Cd"); não foi alterada.');
  L.push('');
  L.push('## Perguntas abertas para o dono do produto');
  L.push('');
  L.push('1. **ATIVO**: confirmar que a leitura "ativado pela fazenda" está certa e que nenhum item do modelo deve nascer inativo.');
  L.push('2. **Unidade sugerida**: a fonte só tem UN. Aceitar UN para tudo, ou derivar a unidade da apresentação (ex.: "Saco 25 kg" sugerir KG, "Frasco 100 ml" sugerir ML)? Isso exigiria interpretar quantidades.');
  L.push('3. **Uso único** (decidido em 09/11/2026): cada classe tem um só uso. Vitaminas, minerais, complexos, probióticos e concentrado suplementar ficam apenas nutricionais; as demais mantêm o uso original (sanitário por padrão).');
  L.push('4. **Uso genético**: nenhum item na fonte (sêmen, embrião, inseminação sem itens). O catálogo nasce sem itens genéticos; ficam para cadastro manual ou outra fonte.');
  L.push('5. **Ordenha e identificação animal**: as classes "Material, equipamentos e produtos para ordenha" e "Identificação Animal" ficaram assim por falta de itens; decidir se entram no escopo (brincos hoje caem em Ectoparasiticidas, ex.: "Top Tag").');
  L.push('6. **Classes "Outros", "Princípios ativos e ações clínicas diferenciadas" e "Otimizadores das condições ambientais"** foram marcadas como sanitário por padrão (ver `revisar`).');
  L.push('7. **Fora de escopo pecuário**: todo o ramo 3.xx (defensivos, adjuvantes, sementes) foi excluído, incluindo acaricidas/inseticidas agrícolas; nenhum nome veterinário apareceu nessas classes na verificação por palavras-chave (vacina, carrapato, bovino, ivermectina etc.).');
  L.push('');
  L.push('## Amostra aleatória (semente 42)');
  L.push('');
  L.push('### 30 incluídos');
  L.push('');
  L.push(tabela(['Código', 'Nome', 'Apresentação', 'Classe', 'Uso', 'Unid.', 'PAs'],
    amostraInc.map((p) => [p.codigoOrigem, p.nome, p.apresentacao, classeNome.get(p.classificacaoCodigo), rotuloUso(p), p.unidadeSugerida, p.principiosAtivos.length])));
  L.push('');
  L.push('### 15 excluídos');
  L.push('');
  L.push(tabela(['Código', 'Nome (origem)', 'Classe', 'Motivo'], amostraExc.map((x) => [x.codigoOrigem, x.nome, x.classificacaoNome, x.motivo])));
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Serialização estável: uma linha por item nas listas de topo (diffs legíveis).

export function serializarCatalogo(c) {
  const lista = (arr) => (arr.length ? `[\n${arr.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]` : '[]');
  return `{
  "versao": ${JSON.stringify(c.versao)},
  "fonte": ${JSON.stringify(c.fonte)},
  "geradoEm": ${JSON.stringify(c.geradoEm)},
  "fabricantes": ${lista(c.fabricantes)},
  "classificacoes": ${lista(c.classificacoes)},
  "principiosAtivos": ${lista(c.principiosAtivos)},
  "produtos": ${lista(c.produtos)}
}
`;
}

// ---------------------------------------------------------------------------
// CLI

async function lerJson(caminho) {
  return JSON.parse(await readFile(caminho, 'utf8'));
}

export async function main(argv) {
  const [extracaoArg, saidaArg] = argv;
  if (!extracaoArg || !saidaArg) {
    throw new Error('Uso: node scripts/catalogo-produtos/curar.mjs <extracao.json> <saida-dir>');
  }
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const mapaClasses = await lerJson(path.join(aqui, 'classificacao-uso.json'));
  const mapaUnidades = await lerJson(path.join(aqui, 'unidade-medida.json'));
  const extracao = await lerJson(path.resolve(extracaoArg));
  const resultado = curar(extracao, { classes: mapaClasses, unidades: mapaUnidades });
  const saida = path.resolve(saidaArg);
  await mkdir(saida, { recursive: true });
  await writeFile(path.join(saida, 'catalogo-curado.json'), serializarCatalogo(resultado.catalogo));
  await writeFile(path.join(saida, 'relatorio.md'), gerarRelatorio(resultado, { mapaClasses, mapaUnidades, extracao }));
  console.log(`Catálogo curado: ${resultado.stats.saida} de ${resultado.stats.entrada} produtos -> ${saida}`);
  return resultado;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
