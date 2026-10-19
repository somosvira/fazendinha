// Preparação de apoio; não conta como execução de caso pela interface.
async(page)=>page.evaluate(async()=>{
 const lote='visita'; // visita | clinica | indicadores
 if(!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Somente aplicação local');
 const f=JSON.parse(sessionStorage.getItem('qa322:fixtures:v1'));
 if(!f?.sitioA?.nome.startsWith('QA322-'))throw Error('Executar preparar.mcp.js e preservar o registro de fixtures');
 const root='/pecuaria/rebanho',rep=root+'/reproducao',save=()=>sessionStorage.setItem('qa322:fixtures:v1',JSON.stringify(f));
 const dia=n=>{const d=new Date(f.dataBase+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const req=async(path,method='GET',body)=>{const r=await fetch('/api'+path,{method,headers:{authorization:'Bearer '+localStorage.getItem('rionovo:auth-token'),'content-type':'application/json','X-Propriedade-Id':String(f.sitioA.id)},...(body?{body:JSON.stringify(body)}:{})});const b=await r.json();if(!r.ok)throw Error(path+' '+r.status+' '+JSON.stringify(b));return b;};
 if(lote==='visita'){
  if(!f.visita){f.visita=await req(root+'/visitas','POST',{chave:crypto.randomUUID(),propriedadeId:f.sitioA.id,data:f.dataBase,nome:'QA322 atendimento individual'});save();}
  if(!f.atividade){f.atividade=await req(root+'/visitas/'+f.visita.id+'/atividades','POST',{propriedadeId:f.sitioA.id,tipo:'AVALIACAO_REPRODUTIVA',nome:'QA322 avaliação individual',contexto:{percursoVisita:{origem:'LIVRE'},grupoPlanner:{origem:'LIVRE'}},participantes:[{animalId:f.animais[3].id,motivos:['Retorno previsto']},{animalId:f.animais[4].id,motivos:['Avaliação independente']}]});save();}
 }
 if(lote==='clinica'){
  if(!f.politica||!f.materialId)throw Error('Registrar política pela UI antes da clínica');
  if(!f.animalLegado){f.animalLegado=await req(root+'/animais','POST',{brinco:'QA322-08',nome:'QA322 · Ocorrências clínicas isoladas',sexo:'F',dataNascimento:dia(-1400),origem:'COMPRADO',dataEntrada:dia(-700),propriedadeId:f.sitioA.id,aptidao:'LEITE'});save();await req(rep+'/situacoes-iniciais','POST',{chave:crypto.randomUUID(),animalId:f.animalLegado.id,propriedadeId:f.sitioA.id,data:dia(-100),situacao:'APTA',aptaDesde:dia(-100),observacao:'QA322 fixture clínica fictícia'});}
  if(!f.protocoloClinico){const tipos=await req(rep+'/tipos-exame'),tipo=tipos.find(t=>t.ativo!==false&&t.tipoResultado==='MULTIPLO');if(!tipo)throw Error('Exame reprodutivo múltiplo necessário');f.protocoloClinico=await req(rep+'/protocolos','POST',{nome:'QA322 ocorrência clínica',versao:1,publicado:true,etapas:[{nome:'Tentativa QA',tipo:'TENTATIVA',unidade:'DIAS',intervalo:0,planoTentativa:{tipo:'IA',materialId:f.materialId,quantidade:1}},...[1,2].map(n=>({nome:'Reconfirmação '+n+' QA',tipo:'AVALIACAO',unidade:'DIAS',intervalo:10,planoAvaliacao:{tipo:'RECONFIRMACAO',tipoExameId:tipo.id}}))]});save();}
  if(!f.programacaoClinica){f.programacaoClinica=await req(rep+'/programacoes','POST',{chave:crypto.randomUUID(),propriedadeId:f.sitioA.id,protocoloId:f.protocoloClinico.id,nome:'QA322 turma clínica isolada',inicioPrevisto:dia(-60),animais:[{animalId:f.animalLegado.id}]});save();}
  if(!f.participanteClinico){const p=await req(rep+'/programacoes/'+f.programacaoClinica.id);f.participanteClinico=p.participantes.find(p=>p.animalId===f.animalLegado.id);if(!f.participanteClinico)throw Error('Participante próprio ausente');save();}
  if(!f.inicioClinico){f.inicioClinico=await req(rep+'/participantes-iatf/'+f.participanteClinico.id+'/inicio','POST',{propriedadeId:f.sitioA.id,inicioEfetivo:dia(-60)});save();}
  if(!f.tarefasClinicas){const p=await req(rep+'/programacoes/'+f.programacaoClinica.id);f.tarefasClinicas=p.participantes.find(p=>p.id===f.participanteClinico.id).tarefas;save();}
  if(!f.tentativaClinica){const t=f.tarefasClinicas.find(t=>t.tipo==='TENTATIVA');f.tentativaClinica=await req(rep+'/tarefas-iatf/'+t.id+'/execucao','POST',{chave:crypto.randomUUID(),propriedadeId:f.sitioA.id,realizadaEm:dia(-60),dados:{origem:'DOCUMENTADA',justificativaSemOrigem:'QA322 material fictício documentado sem consumir estoque original'}});save();}
 }
 if(lote==='indicadores'){
  if(!f.perda)throw Error('Registrar a perda própria pela UI antes do oráculo');
  if(!f.seguimentoIndicadores){f.seguimentoIndicadores=await req(rep+'/avaliacoes','POST',{chave:crypto.randomUUID(),animalId:f.animais[2].id,propriedadeId:f.sitioA.id,data:f.dataBase,resultado:'RECONFIRMACAO',gestacaoId:f.animais[2].positivo.gestacaoId});save();}
  if(!f.gestacaoIncompleta){f.gestacaoIncompleta=await req(rep+'/avaliacoes','POST',{chave:crypto.randomUUID(),animalId:f.animais[4].id,propriedadeId:f.sitioA.id,data:dia(-20),resultado:'POSITIVO',motivoVinculoDesconhecido:'QA322 gestação fictícia sem seguimento suficiente'});save();}
 }
 return {lote,execucao:f.execucao,visitaId:f.visita?.id,animalLegadoId:f.animalLegado?.id,gestacaoLegadoId:f.gestacaoLegado?.id};
})
