import test from 'node:test';
import assert from 'node:assert/strict';
import { construirPrevia } from './preview-ideagri-products.mjs';

function fixture() {
  return {
    metadata:{sourceSha256:'abc',counts:{}},
    records:{
      PRODUTO:[
        {CDPRODUTO:'1',NUMERO:'X1',NOME:'Ração Á',ATIVO:'1',CDUNIDADEMEDIDA:'1',CDCLASSIFICACAO:null,CDFABRICANTE:null,MINIMOESTOQUE:null},
        {CDPRODUTO:'2',NUMERO:null,NOME:'Ração Á',ATIVO:'0',CDUNIDADEMEDIDA:null,CDCLASSIFICACAO:'99',CDFABRICANTE:'8',MINIMOESTOQUE:null},
        {CDPRODUTO:'3',NUMERO:'LONG',NOME:'N'.repeat(81),ATIVO:'1',CDUNIDADEMEDIDA:'1',CDCLASSIFICACAO:'1',CDFABRICANTE:'8'},
      ],
      CLASSIFICACAO:[{CDCLASSIFICACAO:'1',DESCRICAO:'classe'}],
      UNIDADEMEDIDA:[{CDUNIDADEMEDIDA:'1',NOME:'Unidade',SIMBOLO:'UN'}],
      PESSOA:[{CDPESSOA:'8',NOME:'Fábrica'}],
      PRODUTOPRINCIPIOATIVO:[{CDPRODUTO:'1',CDPRINCIPIOATIVO:'4',CONCENTRACAOVALOR:null}],
      PRINCIPIOATIVO:[{CDPRINCIPIOATIVO:'4',NOME:'Ativo'}],
      NUTRIENTE:[],
    },
  };
}
const production={consultadoEm:'2026-11-08',ambiente:'producao',projectId:'p',branchId:'b',produtos:[
  {id:'dest-a',nome:'Racao A',unidade:'UN',ativo:true},
  {id:'dest-b',nome:'Ração Á',unidade:'UN',ativo:false},
  {id:'dest-c',nome:'Ração Á',unidade:'ML',ativo:true},
  {id:'1',nome:'Outro produto',unidade:'UN',ativo:true},
]};

test('normalização gera candidatos sem vincular automaticamente e sinaliza duplicidade na origem/destino',()=>{
  const preview=construirPrevia(fixture(),production);
  const first=preview.products[0];
  assert.equal(first.candidatosExatos.length,3);
  assert.equal(first.status,'PENDENTE_REVISAO');
  assert.ok(first.flags.includes('CORRESPONDENCIA_EXATA_AMBIGUA_NA_PRODUCAO'));
  assert.ok(first.flags.includes('NOME_NORMALIZADO_DUPLICADO_NA_ORIGEM'));
  assert.equal(preview.counts.productsWithExactNameCandidates,2);
  assert.equal(preview.counts.manuallyMapped,0);
});

test('preserva nulls, registra ausências e sinaliza nome longo sem truncar',()=>{
  const preview=construirPrevia(fixture(),production);
  const second=preview.products[1], long=preview.products[2];
  assert.equal(second.codigoLegado,null);
  assert.equal(second.unidade,null);
  assert.ok(second.valoresAusentes.includes('MINIMOESTOQUE'));
  assert.ok(second.flags.includes('UNIDADE_AUSENTE_OU_ORFA'));
  assert.ok(second.flags.includes('CLASSIFICACAO_ORFA'));
  assert.equal(second.ativoOrigem,'0');
  assert.equal(long.nome,'N'.repeat(81));
  assert.ok(long.flags.includes('NOME_EXCEDE_LIMITE_80_SEM_TRUNCAR'));
  assert.equal(long.status,'CANDIDATO_NOVO_INATIVO_PENDENTE_REVISAO');
});

test('mapeamento é por ID de destino explícito e decisão de criação produz candidato inativo',()=>{
  const preview=construirPrevia(fixture(),production,{
    '1':{action:'map_existing',targetId:'dest-a'},
    '3':{action:'create_inactive'},
  });
  assert.equal(preview.products[0].status,'DECISAO_MANUAL_CONFIRMADA_COM_PENDENCIAS');
  assert.equal(preview.products[0].destinoManual.id,'dest-a');
  assert.equal(preview.products[2].status,'CANDIDATO_NOVO_INATIVO_MANUAL');
  assert.equal(preview.products[2].destinoManual,null);
  assert.equal(preview.rules.identity,'somente chaves de origem tipadas; nunca parear por igualdade de ID entre fontes');
});

test('ID de origem igual a ID de produção não constitui correspondência',()=>{
  const f=fixture();
  f.records.PRODUTO=[{...f.records.PRODUTO[0],NOME:'Sem nome correspondente'}];
  const p={...production,produtos:[production.produtos.find(x=>x.id==='1')]};
  const row=construirPrevia(f,p).products[0];
  assert.equal(row.candidatosExatos.length,0);
  assert.equal(row.status,'CANDIDATO_NOVO_INATIVO_PENDENTE_REVISAO');
});

test('rejeita ação desconhecida e exige revisão quando duas origens apontam ao mesmo destino',()=>{
  assert.throws(()=>construirPrevia(fixture(),production,{'1':{action:'overwrite'}}),/não suportada/);
  const preview=construirPrevia(fixture(),production,{
    '1':{action:'map_existing',targetId:'dest-a'},
    '2':{action:'map_existing',targetId:'dest-a'},
  });
  assert.equal(preview.products[0].status,'DECISAO_MANUAL_CONFIRMADA_COM_PENDENCIAS');
  assert.ok(preview.products[0].flags.includes('MULTIPLOS_ORIGENS_MAPEADOS_AO_MESMO_DESTINO'));
});
