import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const anterior=readFileSync(new URL('../../../../prisma/migrations/20261028000000_bezerreiro_colostro/migration.sql',import.meta.url),'utf8');
const correcao=readFileSync(new URL('../../../../prisma/migrations/20261028220000_desambiguar_variaveis_bezerreiro/migration.sql',import.meta.url),'utf8');
function funcoes(sql:string){return [...sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION pecuaria\.(\w+)\([\s\S]*?END \$\$;/g)];}
function normalizar(sql:string,nome:string){
 const nomes:Record<string,string>={v_participacao:'p',participacao:'p',v_fornecimento:'f',fornecimento:'f',preparo_origem:'p',acompanhamento:'a',v_origem_id:'o',origem:'o'};
 // Declarações que só removem records não usados não mudam o corpo executado.
 let valor=sql.replace('OR REPLACE ','').replace(/DECLARE[\s\S]*?\bBEGIN\b/,'BEGIN');
 if(nome==='observar_fisico_colostro')valor=valor.replaceAll('conferir_saldo_colostro(v_origem_id)','conferir_saldo_colostro(o.id)');
 // Preserva todos os literais de mensagens, estados e chaves, inclusive acentos.
 return valor.split(/('(?:''|[^'])*')/).map((parte,i)=>i%2?parte:parte.replace(/\b\w+\b/g,n=>nomes[n]??n)).join('');
}
describe('desambiguação dos triggers do Bezerreiro',()=>{
 it('substitui as cinco funções afetadas sem reescrever migrations anteriores nem remover triggers',()=>{
  expect(funcoes(correcao).map(f=>f[1])).toEqual(['conferir_participacao_bezerreiro','conferir_oferta_bezerreiro','conferir_contexto_colostro','conferir_acompanhamento_colostragem','observar_fisico_colostro']);
  expect(correcao).not.toMatch(/(?:DROP|DISABLE) (?:FUNCTION|TRIGGER|TABLE)/);
  expect(correcao).not.toMatch(/(?:INSERT INTO|DELETE FROM|TRUNCATE)/);
 });
 it.each(funcoes(correcao).map(f=>[f[1],f[0]]))('%s não usa nome de record como alias SQL',(_nome,sql)=>{
  const declaracao=/DECLARE([\s\S]*?)BEGIN/.exec(sql)?.[1]??'';
  const registros=[...declaracao.matchAll(/(\w+)\s+record\b/gi)].map(r=>r[1]);
  const aliases=[...sql.matchAll(/(?:FROM|JOIN)\s+(?:pecuaria|public)\."[^"]+"\s+(\w+)\b/g)].map(r=>r[1]);
  expect(registros.filter(r=>aliases.includes(r))).toEqual([]);
 });
 it.each(funcoes(correcao).map(f=>[f[1],f[0]]))('%s conserva condições, locks, chamadas e mensagens', (nome,sql)=>{
  const original=funcoes(anterior).find(f=>f[1]===nome)![0];
  expect(normalizar(sql,nome)).toBe(normalizar(original,nome));
 });
 it('movimento comum percorre as três buscas sem acessar um record não atribuído',()=>{
  const fisico=funcoes(correcao).find(f=>f[1]==='observar_fisico_colostro')![0];
  expect(fisico).toContain('DECLARE v_origem_id text;');
  expect(fisico.match(/FOR v_origem_id IN SELECT/g)).toHaveLength(3);
  expect(fisico.match(/conferir_saldo_colostro\(v_origem_id\)/g)).toHaveLength(3);
  expect(fisico).not.toMatch(/\bo\./);
 });
});
