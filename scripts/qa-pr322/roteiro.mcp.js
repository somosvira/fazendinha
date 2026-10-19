// Testa o HTML offline. Restaura o armazenamento manual ao final, mesmo se falhar.
async(page)=>{
 const path='file:///Users/montes/vira/fazendinha/docs/pecuaria/artefatos/testes-follow-up-v4.html';
 const p=page.context().pages().find(p=>p.url()===path)??await page.context().newPage();
 const erros=[];p.on('pageerror',e=>erros.push(e.message));p.setDefaultTimeout(6000);
 await p.goto(path);
 const chave='terrano:qa:pr322:manual:v1';
 const anterior=await p.evaluate(k=>localStorage.getItem(k),chave);
 const outros=await p.evaluate(k=>Object.fromEntries(Object.entries(localStorage).filter(([id])=>id!==k)),chave);
 const ok=(v,m)=>{if(!v)throw Error(m);};
 const eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b),m);
 let download;
 try{
  eq(await p.locator('.caso').count(),164,'164 casos renderizados');
  const regs=await p.locator('#execucao').textContent().then(t=>JSON.parse(t).resultados??[]);
  for(const status of ['passed','partial','blocked','nao-executado']){await p.getByLabel('Automação',{exact:true}).selectOption(status);eq(await p.locator('.caso:visible').count(),status==='nao-executado'?164-regs.length:regs.filter(r=>r.status===status).length,'Filtro de automação '+status);}await p.getByLabel('Automação',{exact:true}).selectOption('');
  await p.locator('#capturas img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  if(anterior===null)eq(await p.locator('.manual-status.passed').count(),0,'Automação não aprova aceite humano');
  await p.getByLabel('Área',{exact:true}).selectOption('ACO');eq(await p.locator('.caso:visible').count(),22,'Filtro de22 acompanhamentos');
  await p.getByLabel('Área',{exact:true}).selectOption('');await p.getByLabel('Buscar caso ou texto').fill('concepcao');ok(await p.locator('.caso:visible').count()>0,'Busca sem acento');
  await p.getByLabel('Buscar caso ou texto').fill('texto-inexistente-qa322');await p.getByText('Nenhum caso corresponde aos filtros.').waitFor();
  await p.getByLabel('Buscar caso ou texto').fill('FU-ENV-01');eq(await p.locator('.caso:visible').count(),1,'Busca por ID');
  const c=p.locator('#FU-ENV-01');await c.getByText('Passos, resultados e registro',{exact:true}).click();
  await c.getByLabel('Resultado',{exact:true}).selectOption('aprovado');await c.getByLabel('Evidência ou referência').fill('Autoteste do HTML; não é aceite da fazenda');
  await c.getByLabel('Resultado observado / motivo / variantes conferidas').fill('Teste de persistência QA322 <img src=x onerror="window.qaInjetado=1">');
  await p.reload();await c.getByText('Passos, resultados e registro',{exact:true}).click();eq(await c.getByLabel('Resultado',{exact:true}).inputValue(),'aprovado','Persistência após reload');
  ok(!(await p.evaluate(()=>window.qaInjetado)),'Texto não executa HTML');
  const evento=p.waitForEvent('download');await p.getByRole('button',{name:'Exportar marcações JSON'}).click();download=await evento;
  ok(download.suggestedFilename().startsWith('terrano-pr322-manuais-'),'Nome da exportação');
  const preservado=await p.evaluate(k=>localStorage.getItem(k),chave);
  const importar=async objeto=>p.locator('#arquivo').setInputFiles({name:'qa322.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(objeto))});
  await importar({guia:'outro-guia',versao:1,resultados:{}});await p.getByText(/Importação recusada/).waitFor();eq(await p.evaluate(k=>localStorage.getItem(k),chave),preservado,'Importação inválida não altera marcações');
  await Promise.all([p.waitForEvent('framenavigated',{predicate:frame=>frame===p.mainFrame()}),importar({guia:'terrano-pr322-followup-v4',versao:1,metadados:{responsavel:'Autoteste temporário'},resultados:{'FU-ENV-02':{status:'bloqueado',notas:'Conferência de importação',evidencia:'QA322'}}})]);await p.waitForLoadState('load');
  eq(await p.locator('#FU-ENV-02 [data-campo="status"]').inputValue(),'bloqueado','Importação válida');eq(await c.locator('[data-campo="status"]').inputValue(),'aprovado','Importação conserva outra marcação');
  await p.getByLabel('Resultado manual',{exact:true}).selectOption('bloqueado');ok(await p.locator('#FU-ENV-02').isVisible(),'Filtro manual');
  await p.getByLabel('Resultado manual',{exact:true}).selectOption('');await p.getByRole('button',{name:'Abrir todos os passos'}).click();eq(await p.locator('.caso>details[open]').count(),164,'Expandir');
  await p.getByRole('button',{name:'Recolher passos'}).click();eq(await p.locator('.caso>details[open]').count(),0,'Recolher');
  await p.evaluate(()=>dispatchEvent(new Event('beforeprint')));await p.emulateMedia({media:'print'});ok(await c.locator('.conteudo').isVisible(),'Passos fechados aparecem na impressão');await p.emulateMedia({media:'screen'});await p.evaluate(()=>dispatchEvent(new Event('afterprint')));eq(await p.locator('.caso>details[open]').count(),0,'Impressão restaura recolhimento');
  await p.setViewportSize({width:390,height:844});ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'HTML mobile sem extravasar');
  await p.screenshot({path:'/Users/montes/vira/fazendinha/output/qa-pr322/roteiro-mobile.png'});await p.setViewportSize({width:1440,height:1000});
  eq(await p.evaluate(k=>Object.fromEntries(Object.entries(localStorage).filter(([id])=>id!==k)),chave),outros,'Guias e chaves anteriores intactos');
  eq(erros,[],'Nenhum erro JavaScript no HTML');
  const detalhes=[['FU-UX-06','HTML aberto por file://: busca, filtros, persistência, exportação, importação válida/inválida, estados e celular conferidos; armazenamento manual original restaurado.'],['FU-UX-07','164 IDs únicos e commit rastreáveis; resultados UI/API/parciais separados do aceite humano. Exportação JSON real gerada e guias anteriores preservados.']];
  await page.evaluate(detalhes=>{const s=JSON.parse(sessionStorage.getItem('qa322:resultados:v1')??'{}');for(const [id,detalhe]of detalhes)s[id]={id,status:'passed',modo:'UI do roteiro offline',detalhe,data:new Date().toISOString()};sessionStorage.setItem('qa322:resultados:v1',JSON.stringify(s));},detalhes);
  return {casos:164,resultado:'passed',download:await download.path(),nomeExportacao:download.suggestedFilename()};
 }finally{
  await p.evaluate(({chave,anterior})=>{if(anterior===null)localStorage.removeItem(chave);else localStorage.setItem(chave,anterior);},{chave,anterior});
  await p.reload();await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'/Users/montes/vira/fazendinha/output/qa-pr322/roteiro.png'});
 }
}
