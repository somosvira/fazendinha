import { randomInt, randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { env } from '../../../env.js';
import { exigirBancoIntegracaoPecuaria } from '../../../lib/banco-pecuaria-integration.fixture.js';
const suite=process.env.PECUARIA_DB_INTEGRATION==='1'?describe:describe.skip;

/** Requer migrations já aplicadas. Toda fixture é privada e sempre sofre rollback;
 * não aplica SQL de migration, não desabilita triggers nem consulta o seed. */
suite('SQL real da regularização da retirada de colostro',()=>{
 it('corrige 6→5 L, recusa confirmação obsoleta, estorna histórico intacto e permite somente um novo vínculo ativo',async()=>{
  exigirBancoIntegracaoPecuaria();
  const db=new Client({connectionString:env.DATABASE_URL}),sitio=-randomInt(1,2_000_000_000);
  const animal=randomUUID(),parto=randomUUID(),config=randomUUID(),posicao=randomUUID(),dia=randomUUID(),sessao=randomUUID(),medicao=randomUUID(),antigo=randomUUID();
  await db.connect();
  const conferir=async()=>{await db.query('SET CONSTRAINTS ALL IMMEDIATE');await db.query('SET CONSTRAINTS ALL DEFERRED');};
  const rejeitar=async(acao:()=>Promise<unknown>,code='23514')=>{
   await db.query('SAVEPOINT tentativa');
   try{await expect((async()=>{await acao();await conferir();})()).rejects.toMatchObject({code});}
   finally{await db.query('ROLLBACK TO SAVEPOINT tentativa');await db.query('RELEASE SAVEPOINT tentativa');}
  };
  const inserir=async(id:string,litros:number,versao:number,primeira=true)=>db.query(`INSERT INTO pecuaria."LoteColostro" (id,"propriedadeId","partoId","matrizId","medicaoGeralId",data,"primeiraRetirada","quantidadeLitros","origemFisicaSnapshot",chave,hash) VALUES ($1,$2,$3,$4,$5,'2026-10-20',$6,$7,$8::jsonb,$1,'fixture privada')`,[id,sitio,parto,animal,medicao,primeira,litros,JSON.stringify({versaoMedicao:versao,recipiente:'Balde privado'})]);
  try{
   await db.query('BEGIN');
   await db.query('INSERT INTO public."Propriedade" (id,nome,"updatedAt") VALUES ($1,$2,now())',[sitio,`Retirada R07 ${antigo}`]);
   await db.query(`INSERT INTO pecuaria."Animal" (id,brinco,sexo,"dataNascimento",origem,"dataEntrada","atualizadoEm") VALUES ($1,$1,'F','2020-01-01','COMPRADO','2026-01-01',now())`,[animal]);
   await db.query(`INSERT INTO pecuaria."LocalizacaoAnimal" (id,"animalId","propriedadeId",desde,"atualizadoEm") VALUES ($1,$2,$3,'2026-01-01',now())`,[randomUUID(),animal,sitio]);
   await db.query(`INSERT INTO pecuaria."FinalidadeAnimal" (id,"animalId",aptidao,desde,"atualizadoEm") VALUES ($1,$2,'LEITE','2026-01-01',now())`,[randomUUID(),animal]);
   await db.query(`INSERT INTO pecuaria."PartoAnimal" (id,"animalId","propriedadeId",data,tipo) VALUES ($1,$2,$3,'2026-10-20','NASCIMENTO')`,[parto,animal,sitio]);
   await db.query(`INSERT INTO pecuaria."LactacaoAnimal" (id,"animalId","propriedadeId","partoId",inicio) VALUES ($1,$2,$3,$4,'2026-10-20')`,[randomUUID(),animal,sitio,parto]);
   await db.query(`INSERT INTO pecuaria."ConfiguracaoOrdenha" (id,"propriedadeId","vigenteDesde","fonteProducao","criterioColostro") VALUES ($1,$2,'2026-01-01','GERAL','{"tipo":"PRIMEIRA_ORDENHA"}')`,[config,sitio]);
   await db.query(`INSERT INTO pecuaria."PosicaoOrdenha" (id,"configuracaoId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`,[randomUUID(),config,posicao]);
   await db.query(`INSERT INTO pecuaria."DiaProducaoLeite" (id,"propriedadeId","dataOperacional","configuracaoId","atualizadoEm") VALUES ($1,$2,'2026-10-20',$3,now())`,[dia,sitio,config]);
   await db.query(`INSERT INTO pecuaria."SessaoOrdenha" (id,"diaId","posicaoId",nome,ordem) VALUES ($1,$2,$3,'Manhã',1)`,[sessao,dia,posicao]);
   const criterio={configuracaoId:config,criterio:{tipo:'PRIMEIRA_ORDENHA'},partos:[{id:parto,animalId:animal,versao:1,data:'2026-10-20'}],primeiraOrdenhaColostro:true};
   await db.query(`INSERT INTO pecuaria."MedicaoGeralLeite" (id,"sessaoId",recipiente,litros,"origemLitros",natureza,"animaisOrigem","primeiraOrdenhaColostro","criterioColostroSnapshot",responsavel,"atualizadoEm") VALUES ($1,$2,'Balde privado',6,'LITROS_INFORMADOS','COLOSTRO',$3::jsonb,true,$4::jsonb,'Fixture R07',now())`,[medicao,sessao,JSON.stringify([animal]),JSON.stringify(criterio)]);
   await inserir(antigo,6,1);await conferir();
   const snapshot=(await db.query('SELECT "origemFisicaSnapshot" FROM pecuaria."LoteColostro" WHERE id=$1',[antigo])).rows[0].origemFisicaSnapshot;
   await db.query('UPDATE pecuaria."MedicaoGeralLeite" SET litros=5,versao=versao+1 WHERE id=$1',[medicao]);await conferir();
   await rejeitar(()=>db.query(`UPDATE pecuaria."LoteColostro" SET "quantidadeLitros"=5,status='ESTORNADO',versao=versao+1,"estornadoEm"=now(),"motivoEstorno"='Correção da medição' WHERE id=$1`,[antigo]));
   // Mesmo rascunho não pode ser atualizado mantendo equivalência obsoleta.
   await rejeitar(()=>db.query('UPDATE pecuaria."LoteColostro" SET versao=versao+1 WHERE id=$1',[antigo]));
   await db.query(`UPDATE pecuaria."LoteColostro" SET status='ESTORNADO',versao=versao+1,"estornadoEm"=now(),"motivoEstorno"='Medição corrigida para cinco litros' WHERE id=$1`,[antigo]);await conferir();
   const nova=randomUUID();await inserir(nova,5,2);await conferir();
   await rejeitar(()=>inserir(randomUUID(),5,2,false),'23505');
   expect((await db.query('SELECT status,"quantidadeLitros"::text,"origemFisicaSnapshot" FROM pecuaria."LoteColostro" WHERE id=$1',[antigo])).rows).toEqual([{status:'ESTORNADO',quantidadeLitros:'6.000',origemFisicaSnapshot:snapshot}]);
   expect((await db.query(`SELECT count(*)::int n FROM pecuaria."LoteColostro" WHERE "medicaoGeralId"=$1 AND status<>'ESTORNADO'`,[medicao])).rows).toEqual([{n:1}]);
   expect((await db.query('SELECT litros::text FROM pecuaria."MedicaoGeralLeite" WHERE id=$1',[medicao])).rows).toEqual([{litros:'5.000'}]);
  }finally{
   try{await db.query('ROLLBACK');expect((await db.query('SELECT count(*)::int n FROM public."Propriedade" WHERE id=$1',[sitio])).rows).toEqual([{n:0}]);}
   finally{await db.end();}
  }
 },20_000);
});
