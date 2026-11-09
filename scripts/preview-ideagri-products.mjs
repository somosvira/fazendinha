#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

export function normalizarNome(nome) {
  return typeof nome === 'string' ? nome.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') : null;
}
function byId(items, key) { return new Map(items.filter(x=>x[key] != null).map(x=>[String(x[key]),x])); }
export function construirPrevia(extracao, producao, decisoes = {}) {
  const { metadata, records } = extracao;
  if (!metadata?.sourceSha256 || !Array.isArray(records?.PRODUTO)) throw new Error('Extração inválida ou sem metadados de fonte');
  if (!Array.isArray(producao?.produtos)) throw new Error('Snapshot de produtos da produção inválido');
  const products = records.PRODUTO, existing = producao.produtos;
  const sourceCodes=new Map(), targetAssignments=new Map();
  const sourceKeys=new Set(products.map(p=>String(p.CDPRODUTO)));
  for(const [key,decision] of Object.entries(decisoes)) {
    if(!sourceKeys.has(key)) throw new Error(`Decisão aponta para código de origem inexistente: ${key}`);
    if(!decision || !['map_existing','create_inactive'].includes(decision.action)) throw new Error(`Ação manual não suportada para ${key}`);
    if(decision.action==='map_existing') {
      if(typeof decision.targetId!=='string' || !existing.some(x=>x.id===decision.targetId)) throw new Error(`Destino manual inexistente para ${key}`);
      targetAssignments.set(decision.targetId,[...(targetAssignments.get(decision.targetId)||[]),key]);
    } else if(decision.targetId!=null) throw new Error(`create_inactive não aceita targetId (${key})`);
  }
  for(const p of products) if(p.NUMERO!=null) { const k=String(p.NUMERO).trim().toLocaleLowerCase('pt-BR'); sourceCodes.set(k,[...(sourceCodes.get(k)||[]),p]); }
  const manufacturerIds = new Set(products.map(x=>x.CDFABRICANTE).filter(x=>x!=null).map(String));
  const manufacturers = records.PESSOA.filter(p=>manufacturerIds.has(String(p.CDPESSOA)));
  const classById = byId(records.CLASSIFICACAO,'CDCLASSIFICACAO');
  const unitsById = byId(records.UNIDADEMEDIDA,'CDUNIDADEMEDIDA');
  const manufacturerById = byId(manufacturers,'CDPESSOA');
  const links = records.PRODUTOPRINCIPIOATIVO;
  const linkedCounts = new Map();
  for (const link of links) linkedCounts.set(String(link.CDPRODUTO), (linkedCounts.get(String(link.CDPRODUTO))||0)+1);
  const sourceNames = new Map(), targetNames = new Map();
  for (const p of products) { const n=normalizarNome(p.NOME); if(n) sourceNames.set(n,[...(sourceNames.get(n)||[]),p]); }
  for (const p of existing) { const n=normalizarNome(p.nome); if(n) targetNames.set(n,[...(targetNames.get(n)||[]),p]); }
  const rows = products.map((p)=>{
    const candidates = targetNames.get(normalizarNome(p.NOME)) || [];
    const sourceKey=String(p.CDPRODUTO);
    const decision = decisoes[sourceKey] ?? null;
    let status = candidates.length ? 'PENDENTE_REVISAO' : 'CANDIDATO_NOVO_INATIVO_PENDENTE_REVISAO';
    let mappedTarget = null;
    if (decision?.action === 'map_existing' && typeof decision.targetId === 'string') {
      mappedTarget = existing.find(x=>x.id===decision.targetId) || null;
      status = mappedTarget ? 'DECISAO_MANUAL_CONFIRMADA_SEM_FLAGS' : 'MAPEAMENTO_MANUAL_INVALIDO';
    } else if (decision?.action === 'create_inactive') status = 'CANDIDATO_NOVO_INATIVO_MANUAL';
    const flags=[];
    if (!p.NOME?.trim()) flags.push('NOME_AUSENTE');
    if (String(p.NOME ?? '').length > 80) flags.push('NOME_EXCEDE_LIMITE_80_SEM_TRUNCAR');
    if ((sourceNames.get(normalizarNome(p.NOME)) || []).length > 1) flags.push('NOME_NORMALIZADO_DUPLICADO_NA_ORIGEM');
    if (p.NUMERO != null && (sourceCodes.get(String(p.NUMERO).trim().toLocaleLowerCase('pt-BR')) || []).length>1) flags.push('CODIGO_LEGADO_DUPLICADO_NA_ORIGEM');
    if (candidates.length > 1) flags.push('CORRESPONDENCIA_EXATA_AMBIGUA_NA_PRODUCAO');
    if (candidates.some(x=>x.ativo === false || x.ativo === 0 || x.ativo === '0' || String(x.ativo).toUpperCase()==='FALSE')) flags.push('CANDIDATO_PRODUCAO_INATIVO');
    if (!p.CDUNIDADEMEDIDA || !unitsById.has(String(p.CDUNIDADEMEDIDA))) flags.push('UNIDADE_AUSENTE_OU_ORFA');
    if (p.CDCLASSIFICACAO != null && !classById.has(String(p.CDCLASSIFICACAO))) flags.push('CLASSIFICACAO_ORFA');
    if (p.CDFABRICANTE != null && !manufacturerById.has(String(p.CDFABRICANTE))) flags.push('FABRICANTE_SEM_NOME_NO_RECORTE');
    if (p.ATIVO == null) flags.push('ATIVO_AUSENTE');
    if (p.NUMERO == null) flags.push('CODIGO_ORIGEM_AUSENTE');
    if (p.CDPRODUTO == null || String(p.CDPRODUTO).trim()==='') flags.push('IDENTIDADE_ORIGEM_INVALIDA');
    if (mappedTarget && targetAssignments.get(mappedTarget.id)?.length>1) flags.push('MULTIPLOS_ORIGENS_MAPEADOS_AO_MESMO_DESTINO');
    if (mappedTarget && (!p.CDUNIDADEMEDIDA || !unitsById.has(String(p.CDUNIDADEMEDIDA)))) flags.push('MAPEAMENTO_BLOQUEADO_UNIDADE_NAO_RESOLVIDA');
    if (mappedTarget && p.CDCLASSIFICACAO == null) flags.push('MAPEAMENTO_PENDENTE_CLASSIFICACAO_TECNICA');
    if (mappedTarget && flags.length) status='DECISAO_MANUAL_CONFIRMADA_COM_PENDENCIAS';
    const missing = Object.entries(p).filter(([,v])=>v==null).map(([k])=>k);
    return { codigoOrigem:String(p.CDPRODUTO), codigoLegado:p.NUMERO, nome:p.NOME, ativoOrigem:p.ATIVO, ativoProposto:status.startsWith('CANDIDATO_NOVO_INATIVO') ? false : null, unidade: p.CDUNIDADEMEDIDA == null ? null : unitsById.get(String(p.CDUNIDADEMEDIDA)) ?? null, classificacao: p.CDCLASSIFICACAO == null ? null : classById.get(String(p.CDCLASSIFICACAO)) ?? null, fabricante: p.CDFABRICANTE == null ? null : manufacturerById.get(String(p.CDFABRICANTE)) ?? null, principiosAtivosVinculados: linkedCounts.get(String(p.CDPRODUTO))||0, candidatosExatos: candidates.map(x=>({id:x.id,nome:x.nome,ativo:x.ativo,unidade:x.unidade})), decisaoManual:decision, destinoManual:mappedTarget ? {id:mappedTarget.id,nome:mappedTarget.nome} : null, status, flags, valoresAusentes:missing };
  });
  const exactCandidateRows = rows.filter(r=>r.candidatosExatos.length>0).length;
  return { formatVersion:1, generatedAt:new Date().toISOString(), scope:'PREVIEW_ONLY_NO_WRITES', source:{...metadata}, productionSnapshot:{consultadoEm:producao.consultadoEm, ambiente:producao.ambiente, projectId:producao.projectId, branchId:producao.branchId, productCount:existing.length, warning:'snapshot pontual; não representa estado garantidamente atual após a consulta'}, counts:{sourceProducts:products.length, productionProducts:existing.length, productsWithExactNameCandidates:exactCandidateRows, productsWithNoExactNameCandidates:rows.length-exactCandidateRows, manufacturerNames:manufacturers.length, activePrinciples:records.PRINCIPIOATIVO.length, productPrincipleLinks:links.length, nutrients:records.NUTRIENTE.length, classificationRows:records.CLASSIFICACAO.length, unitRows:records.UNIDADEMEDIDA.length, manuallyMapped:rows.filter(r=>r.status==='DECISAO_MANUAL_CONFIRMADA_SEM_FLAGS').length, manuallySelectedInactiveCandidates:rows.filter(r=>r.status==='CANDIDATO_NOVO_INATIVO_MANUAL').length}, rules:{identity:'somente chaves de origem tipadas; nunca parear por igualdade de ID entre fontes', exactName:'candidatos por nome normalizado; não aplica vínculo sem decisão manual', newProducts:'somente candidato INATIVO após decisão manual', financialCategory:'não inferida', concentration:'não interpretada; preservar valor literal da origem ou null', clinicalOrStockEffects:'nenhum'}, products:rows, referenceCatalogs:{principios:records.PRINCIPIOATIVO, composicoes:links.map(x=>({...x, CONCENTRACAOVALOR_LITERAL:x.CONCENTRACAOVALOR, concentrationParsed:false})), nutrientes:records.NUTRIENTE}};
}

if (process.argv[1]?.endsWith('preview-ideagri-products.mjs')) {
  const [extractionPath, productionPath, outputPath, mappingPath] = process.argv.slice(2);
  if (!extractionPath || !productionPath || !outputPath) throw new Error('Uso: node scripts/preview-ideagri-products.mjs <extração.json> <snapshot-producao.json> <saida.json> [decisoes.json]');
  const extracao=JSON.parse(await readFile(extractionPath,'utf8'));
  const producao=JSON.parse(await readFile(productionPath,'utf8'));
  const decisoes=mappingPath ? JSON.parse(await readFile(mappingPath,'utf8')) : {};
  await writeFile(outputPath,JSON.stringify(construirPrevia(extracao,producao,decisoes),null,2)+'\n');
}
