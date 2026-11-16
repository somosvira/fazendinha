#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TABLES = {
  PRODUTO: null,
  CLASSIFICACAO: null,
  UNIDADEMEDIDA: null,
  PRINCIPIOATIVO: null,
  PRODUTOPRINCIPIOATIVO: null,
  NUTRIENTE: null,
  PESSOA: ['CDPESSOA', 'NOME'],
};
const PRIMARY_KEYS = { PRODUTO:['CDPRODUTO'], CLASSIFICACAO:['CDCLASSIFICACAO'], UNIDADEMEDIDA:['CDUNIDADEMEDIDA'], PRINCIPIOATIVO:['CDPRINCIPIOATIVO'], PRODUTOPRINCIPIOATIVO:['CDPRODUTOPRINCIPIOATIVO'], NUTRIENTE:['CDNUTRIENTE'], PESSOA:['CDPESSOA'] };
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const qIdent = (x) => `"${x.replaceAll('"', '""')}"`;
const sqlLiteral = (s) => `'${s.replaceAll("'", "''")}'`;
function jsonExpr(field) {
  return jsonField(field);
}
function jsonField(field, alias='') {
  const col=`${alias ? `${alias}.` : ''}${qIdent(field)}`;
  const val=`CAST(${col} AS VARCHAR(8192))`;
  let escaped=val;
  for (const code of [92,34,...Array.from({length:32},(_,i)=>i)]) {
    const replacement = code===92 ? "ASCII_CHAR(92)||ASCII_CHAR(92)" : code===34 ? "ASCII_CHAR(92)||ASCII_CHAR(34)" : code===8 ? "ASCII_CHAR(92)||'b'" : code===9 ? "ASCII_CHAR(92)||'t'" : code===10 ? "ASCII_CHAR(92)||'n'" : code===12 ? "ASCII_CHAR(92)||'f'" : code===13 ? "ASCII_CHAR(92)||'r'" : `ASCII_CHAR(92)||'u00${code.toString(16).padStart(2,'0')}'`;
    escaped=`REPLACE(${escaped},ASCII_CHAR(${code}),${replacement})`;
  }
  return `CASE WHEN ${col} IS NULL THEN 'null' ELSE ASCII_CHAR(34)||${escaped}||ASCII_CHAR(34) END`;
}
function queryFor(table, fields) {
  const list = fields.map((field) => `ASCII_CHAR(34)||${sqlLiteral(field)}||ASCII_CHAR(34)||':'||${jsonExpr(field)}`).join(`||','||`);
  return `SELECT '{'||${list}||'}' AS LINHA FROM ${qIdent(table)} ORDER BY 1;`;
}
async function runQuery(copyDir, sql) {
  await writeFile(path.join(copyDir, 'query.sql'), `${sql}\n`);
  await writeFile(path.join(copyDir, 'run.sh'), '#!/bin/sh\n/usr/local/firebird/bin/isql -nod -b -user SYSDBA -password masterkey -ch ISO8859_1 /analise/DADOS000.FDB -i /analise/query.sql\n');
  return new Promise((resolve, reject) => {
    const result = spawnSync('docker', ['run','--rm','--network','none','-e','ISC_PASSWORD=masterkey','-v',`${copyDir}:/analise`,'jacobalberty/firebird:2.5.9-sc','/bin/sh','/analise/run.sh'], { maxBuffer: 128 * 1024 * 1024 });
    if (result.error) return reject(result.error);
    if (result.status !== 0) return reject(new Error(`Firebird query failed: ${result.stderr.toString('utf8')}`));
    const rawLines = result.stdout.toString('latin1').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const lines = rawLines.filter(x=>x.startsWith('{'));
    if (rawLines.some(x=>x.startsWith('{') && !x.endsWith('}'))) return reject(new Error('Firebird output contains a truncated or malformed JSON row'));
    try { resolve(lines.map(x=>JSON.parse(x))); }
    catch (err) { reject(new Error(`Could not parse Firebird JSON output: ${err.message}`)); }
  });
}

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw new Error('Uso: node scripts/extract-ideagri-products.mjs <FDB-original> <diretorio-de-saida>');
const sourcePath = path.resolve(sourceArg);
const outputDir = path.resolve(outputArg);
const originalBefore = await readFile(sourcePath);
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'fazendinha-ideagri-products-'));
const copyPath = path.join(tempRoot, 'DADOS000.FDB');
await copyFile(sourcePath, copyPath);
const copyBefore = sha(await readFile(copyPath));
if (copyBefore !== sha(originalBefore)) throw new Error('Fresh isolated copy hash does not match original before attachment');
try {
  const charsetRows = await runQuery(tempRoot, `SET TRANSACTION READ ONLY;
SET HEADING OFF;
SELECT '{"charset":"'||TRIM(RDB$CHARACTER_SET_NAME)||'"}' AS LINHA FROM RDB$DATABASE;
ROLLBACK;`);
  if (charsetRows.length !== 1 || charsetRows[0].charset !== 'ISO8859_1') throw new Error('Esta extração foi validada para fonte ISO8859_1; revise explicitamente o charset da nova fonte');
  const records = {};
  for (const [table, limited] of Object.entries(TABLES)) {
    let fields = limited;
    const fieldsSql = `SELECT '{"field":'||ASCII_CHAR(34)||TRIM(RDB$FIELD_NAME)||ASCII_CHAR(34)||'}' AS LINHA FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=${sqlLiteral(table)} ORDER BY RDB$FIELD_POSITION;`;
    if (!fields) fields=(await runQuery(tempRoot,`SET TRANSACTION READ ONLY;\nSET HEADING OFF;\nSET WIDTH LINHA 8192;\n${fieldsSql}\nROLLBACK;`)).map(x=>x.field);
    if (table === 'PESSOA') {
      records[table]=await runQuery(tempRoot,`SET TRANSACTION READ ONLY;\nSET HEADING OFF;\nSET WIDTH LINHA 8192;\nSELECT '{"CDPESSOA":'||${jsonField('CDPESSOA','p')}||',"NOME":'||${jsonField('NOME','p')}||'}' AS LINHA FROM PESSOA p WHERE EXISTS (SELECT 1 FROM PRODUTO pr WHERE pr.CDFABRICANTE=p.CDPESSOA) ORDER BY p.CDPESSOA;\nROLLBACK;`);
    } else records[table] = await runQuery(tempRoot, `SET TRANSACTION READ ONLY;\nSET HEADING OFF;\nSET WIDTH LINHA 8192;\n${queryFor(table,fields)}\nROLLBACK;`);
    const countRows=await runQuery(tempRoot,`SET TRANSACTION READ ONLY;\nSET HEADING OFF;\nSET WIDTH LINHA 8192;\nSELECT '{"count":"'||CAST(COUNT(*) AS VARCHAR(20))||'"}' AS LINHA FROM ${qIdent(table)}${table==='PESSOA' ? ' p WHERE EXISTS (SELECT 1 FROM PRODUTO pr WHERE pr.CDFABRICANTE=p.CDPESSOA)' : ''};\nROLLBACK;`);
    records[`${table}__COUNT`] = countRows;
    if (records[`${table}__COUNT`].length !== 1 || Number(records[`${table}__COUNT`][0].count) !== (table==='PESSOA' ? records.PESSOA.length : records[table].length)) throw new Error(`${table} extracted row count differs from count sentinel`);
    delete records[`${table}__COUNT`];
  }
  const byManufacturer = new Set(records.PRODUTO.map(x=>x.CDFABRICANTE).filter(Boolean));
  records.PESSOA = records.PESSOA.filter(x=>byManufacturer.has(x.CDPESSOA));
  const counts = Object.fromEntries(Object.entries(records).map(([t, rows])=>[t, rows.length]));
  const keyDuplicates={};
  for (const [table, keys] of Object.entries(PRIMARY_KEYS)) {
    const seen=new Set(); const duplicates=[];
    for(const row of records[table]) { const key=keys.map(k=>row[k]).join('|'); if(keys.some(k=>row[k]==null)||seen.has(key)) duplicates.push(key); seen.add(key); }
    if(duplicates.length) keyDuplicates[table]=duplicates;
  }
  if(Object.keys(keyDuplicates).length) throw new Error(`Duplicate or null source primary keys: ${JSON.stringify(keyDuplicates)}`);
  const productKeys=new Set(records.PRODUTO.map(x=>String(x.CDPRODUTO)));
  const principleKeys=new Set(records.PRINCIPIOATIVO.map(x=>String(x.CDPRINCIPIOATIVO)));
  const orphanLinks=records.PRODUTOPRINCIPIOATIVO.filter(x=>!productKeys.has(String(x.CDPRODUTO))||!principleKeys.has(String(x.CDPRINCIPIOATIVO))).map(x=>({linkId:x.CDPRODUTOPRINCIPIOATIVO,productId:x.CDPRODUTO,principleId:x.CDPRINCIPIOATIVO}));
  if(orphanLinks.length) throw new Error(`Orphan product-principle links: ${JSON.stringify(orphanLinks.slice(0,20))}`);
  const badReplacement=[];
  for(const [table,rows] of Object.entries(records)) for(const [i,row] of rows.entries()) for(const [field,value] of Object.entries(row)) if(typeof value==='string'&&value.includes('\uFFFD')) badReplacement.push(`${table}[${i}].${field}`);
  if(badReplacement.length) throw new Error(`Replacement character U+FFFD found in extracted values: ${badReplacement.slice(0,20).join(', ')}`);
  const originalAfter = sha(await readFile(sourcePath));
  if (originalAfter !== sha(originalBefore)) throw new Error('Original source changed during extraction');
  const metadata = { formatVersion:1, sourcePath, sourceSha256:sha(originalBefore), isolatedCopySha256BeforeAttachment:copyBefore, isolatedCopySha256AfterAttachment:sha(await readFile(copyPath)), originalSha256AfterExtraction:originalAfter, extractedAt:new Date().toISOString(), database:'DADOS000.FDB', databaseCharacterSet:charsetRows[0].charset, firebirdClientCharacterSet:'ISO8859_1', jsonEncoding:'UTF-8', firebirdImage:'jacobalberty/firebird:2.5.9-sc', transaction:'READ ONLY', connectionTriggerDisabled:true, counts, primaryKeysValidated:PRIMARY_KEYS, orphanProductPrincipleLinkCount:0, unicodeReplacementCharacters:0, tableFields:Object.fromEntries(Object.entries(records).map(([t, rows])=>[t, rows.length ? Object.keys(rows[0]) : TABLES[t]])) };
  await mkdir(outputDir,{recursive:true});
  await writeFile(path.join(outputDir,'ideagri-produtos.json'), JSON.stringify({metadata, records}, null, 2)+'\n');
  console.log(JSON.stringify(metadata,null,2));
} finally { await rm(tempRoot,{recursive:true,force:true}); }
