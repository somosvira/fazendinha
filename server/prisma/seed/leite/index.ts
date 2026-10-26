import { type Contexto, diretorio } from '../contexto.js';
import { cadastros, producaoIndividual, producaoGeral } from './producao.js';
import { qualidade } from './qualidade.js';
import { comercial } from './comercial.js';
import { destinos, nutricao, regularizacoes } from './destinos.js';
import { relatorios } from './relatorios.js';
import { coberturaParcelas } from './cobertura-parcelas.js';
export async function prepararLeite(c: Contexto) {
  await c.guardar('seedatev5-v1:animal:cria',c.id('animal:65'));
  await c.guardar('seedatev5-v1:cria:parto',c.id('cria:65'));
  for(const [nome,fn] of [
    ['cadastros',()=>cadastros(c)],['individual',()=>producaoIndividual(c)],
    ['geral-anterior',()=>producaoGeral(c,'anterior')],['qualidade-anterior',()=>qualidade(c,'anterior')],['comercial-anterior',()=>comercial(c,'anterior')],
    ['geral-atual',()=>producaoGeral(c,'atual')],['qualidade-atual',()=>qualidade(c,'atual')],
    ['destinos',()=>destinos(c)],['nutricao',()=>nutricao(c)],['comercial-atual',()=>comercial(c,'atual')],['regularizacoes',()=>regularizacoes(c)],['relatorios',()=>relatorios(c,diretorio)],['cobertura-parcelas',()=>coberturaParcelas(c)],
  ] as const) await c.etapa(`leite:${nome}`,fn);
}

export { arquivos as prepararArquivos } from './arquivos.js';
