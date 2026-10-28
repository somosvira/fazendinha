import { randomInt, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { env } from '../../../env.js';
const suite = process.env.PECUARIA_DB_INTEGRATION === '1' ? describe : describe.skip;
// Somente fixtures privadas; todas as gravações e seq explícitas negativas são desfeitas.
suite('SQL real das retiradas internas do leite',()=>{
 it('valida a saída única e impede reescrever/apagar fatos e origens incompatíveis',async()=>{
  const url=new URL(env.DATABASE_URL);
  expect(['localhost','127.0.0.1','[::1]']).toContain(url.hostname);expect(url.pathname).toBe('/fazendinha_seedatev3');
  const db=new Client({connectionString:url.toString()});await db.connect();
  const sitio=-randomInt(1,2_000_000_000), produto=randomUUID(),config=randomUUID(),posicao=randomUUID(),dia=randomUUID(),sessao=randomUUID(),medicao=randomUUID(),entrada=randomUUID(),movEntrada=randomUUID(),classificacao=randomUUID(),movSaida=randomUUID(),retirada=randomUUID();
  try{
   await db.query('BEGIN');
   await db.query(`INSERT INTO public."Propriedade"(id,nome,"updatedAt") VALUES($1,$2,now())`,[sitio,`Fixture retirada ${retirada}`]);
   await db.query(`INSERT INTO public."Produto"(id,nome,unidade,"updatedAt") VALUES($1,$1,'L',now())`,[produto]);
   await db.query(`INSERT INTO pecuaria."ConfiguracaoOrdenha"(id,"propriedadeId","vigenteDesde","fonteProducao") VALUES($1,$2,'2026-01-01','GERAL')`,[config,sitio]);
   await db.query(`INSERT INTO pecuaria."PosicaoOrdenha"(id,"configuracaoId","posicaoId",nome,ordem) VALUES($1,$2,$3,'Manhã',1)`,[randomUUID(),config,posicao]);
   await db.query(`INSERT INTO pecuaria."DiaProducaoLeite"(id,"propriedadeId","dataOperacional","configuracaoId","atualizadoEm") VALUES($1,$2,'2026-10-20',$3,now())`,[dia,sitio,config]);
   await db.query(`INSERT INTO pecuaria."SessaoOrdenha"(id,"diaId","posicaoId",nome,ordem) VALUES($1,$2,$3,'Manhã',1)`,[sessao,dia,posicao]);
   const criterio={configuracaoId:config,criterio:null,partos:[],primeiraOrdenhaColostro:null};
   await db.query(`INSERT INTO pecuaria."MedicaoGeralLeite"(id,"sessaoId",recipiente,litros,"origemLitros",natureza,"animaisOrigem","criterioColostroSnapshot",responsavel,"atualizadoEm") VALUES($1,$2,'Balde privado',20,'LITROS_INFORMADOS','COMERCIAL','[]',$3::jsonb,'Fixture privada',now())`,[medicao,sessao,JSON.stringify(criterio)]);
   await db.query(`INSERT INTO public."MovimentoEstoque"(id,seq,"produtoId",tipo,origem,data,quantidade,"propriedadeId","metodoValorizacao","updatedAt") VALUES($1,$2,$3,'ENTRADA','PRODUCAO','2026-10-20',20,$4,'LEITE_FIFO_V1',now())`,[movEntrada,-randomInt(1,2_000_000_000),produto,sitio]);
   const snapshot={fonte:'GERAL',medicaoGeralId:medicao,litros:20,versaoMedicaoGeral:1,animaisOrigem:[],recipiente:'Balde privado',tanqueId:null,natureza:'COMERCIAL',declaracaoDireta:null,primeiraOrdenhaColostro:null,criterioColostroSnapshot:criterio};
   await db.query(`INSERT INTO pecuaria."EntradaProducaoLeite"(id,"sessaoId","versaoSessao","movimentoId",chave,hash,snapshot,"medicaoGeralId") VALUES($1,$2,1,$3,$1,$4,$5::jsonb,$6)`,[entrada,sessao,movEntrada,'a'.repeat(64),JSON.stringify(snapshot),medicao]);
   await db.query(`INSERT INTO pecuaria."ClassificacaoEntradaLeite"(id,"entradaId",versao,natureza,motivo) VALUES($1,$2,1,'NAO_INFORMADA','Classificação inicial privada'),($3,$2,2,'COMERCIAL','Declaração explícita privada')`,[randomUUID(),entrada,classificacao]);
   await db.query(`INSERT INTO public."MovimentoEstoque"(id,seq,"produtoId",tipo,origem,data,quantidade,"propriedadeId","metodoValorizacao","updatedAt") VALUES($1,$2,$3,'SAIDA','NUTRICAO','2026-10-20',3,$4,'LEITE_FIFO_V1',now())`,[movSaida,-randomInt(1,2_000_000_000),produto,sitio]);
   await db.query(`INSERT INTO pecuaria."AlocacaoLeiteEstoque"(id,"entradaId","movimentoId",quantidade,finalidade,"classificacaoId") VALUES($1,$2,$3,3,'CONSUMO',$4)`,[randomUUID(),entrada,movSaida,classificacao]);
   await db.query(`INSERT INTO pecuaria."RetiradaInternaLeite"(id,"propriedadeId","entradaId","movimentoId",destino,responsavel,data,"quantidadeLitros","saldoOrigemAntes","saldoOrigemDepois",motivo) VALUES($1,$2,$3,$4,'CASA','Responsável privado','2026-10-20',3,20,17,'Consumo interno privado')`,[retirada,sitio,entrada,movSaida]);
   await db.query('SET CONSTRAINTS ALL IMMEDIATE');await db.query('SET CONSTRAINTS ALL DEFERRED');
   for(const sql of [`DELETE FROM pecuaria."RetiradaInternaLeite" WHERE id=$1`,`UPDATE pecuaria."RetiradaInternaLeite" SET destino='FUNCIONARIOS' WHERE id=$1`,`UPDATE pecuaria."RetiradaInternaLeite" SET "quantidadeLitros"=2 WHERE id=$1`]){
    await db.query('SAVEPOINT invalidar');await expect(db.query(sql,[retirada])).rejects.toMatchObject({code:'23514'});await db.query('ROLLBACK TO SAVEPOINT invalidar');
   }
   await db.query('SAVEPOINT movimento_invalido');
   await expect((async()=>{await db.query(`UPDATE public."MovimentoEstoque" SET status='REVERTIDO' WHERE id=$1`,[movSaida]);await db.query('SET CONSTRAINTS ALL IMMEDIATE')})()).rejects.toBeTruthy();await db.query('ROLLBACK TO SAVEPOINT movimento_invalido');
  }finally{await db.query('ROLLBACK');expect((await db.query('SELECT count(*)::int n FROM public."Propriedade" WHERE id=$1',[sitio])).rows).toEqual([{n:0}]);await db.end()}
 },20_000);
});
