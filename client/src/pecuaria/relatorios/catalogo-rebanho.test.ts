import {describe,expect,it} from 'vitest';
import {fontesRebanho} from './catalogo-rebanho';
describe('catálogo factual do rebanho',()=>{
 it.each(Object.entries(fontesRebanho))('%s tem campos únicos e padrão selecionável',(_id,fonte)=>{
  const ids=fonte.campos.map(c=>c.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(fonte.padrao.every(id=>ids.includes(id))).toBe(true);
  expect(fonte.campos.every(c=>c.nome&&c.grupo&&c.ajuda)).toBe(true);
 });
 it('cadastros compartilhados não alegam saldo ou posição histórica',()=>{
  for(const fonte of [fontesRebanho.genitores,fontesRebanho.materiais]){
   expect(fonte.escopo).toBe('GLOBAL');
   expect(fonte.referencia).toBe('ATUAL');
   expect(fonte.criterio).toContain('compartilhado');
   expect(fonte.campos.map(c=>c.id)).not.toContain('saldo');
  }
 });
 it('protocolos conserva a tarefa e seus vínculos como granularidade',()=>{
  expect(fontesRebanho.protocolos.linha).toBe('Uma tarefa por participação por linha');
  expect(fontesRebanho.protocolos.campos.map(c=>c.id)).toEqual(expect.arrayContaining(['participacaoId','etapaId','vinculos','precisao','regularizacaoPendente']));
 });
 it('pesagens tem unidade e critério de localização histórico explícitos',()=>{
  expect(fontesRebanho.pesagens.campos.find(c=>c.id==='peso')?.unidade).toBe('kg');
  expect(fontesRebanho.pesagens.criterio).toContain('localização histórica');
 });
});
