import pg from 'pg';
const url=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!='/fazendinha_seedatev3'||url.search)throw Error('Fingerprint permitido somente no banco local da seed.');
const db=new pg.Client({connectionString:url.toString()});
await db.connect();
try{
 await db.query('BEGIN READ ONLY');
 const tabelas=await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','pecuaria') AND tablename <> '_prisma_migrations' ORDER BY schemaname,tablename");
 const resultado=[];
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 for(const t of tabelas.rows){
  const {rows}=await db.query(`SELECT count(*)::int AS quantidade,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS hash FROM ${quote(t.schemaname)}.${quote(t.tablename)} t`);
  resultado.push({...t,...rows[0]});
 }
 await db.query('ROLLBACK');console.log(JSON.stringify(resultado,null,2));
}finally{await db.end();}
