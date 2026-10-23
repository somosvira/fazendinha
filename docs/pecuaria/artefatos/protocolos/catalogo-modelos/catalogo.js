const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const sanitario = params.get('area') === 'sanitario';
let mode = params.get('visual') === 'tabela' ? 'tabela' : 'visual';
let page = 1, stepPage = 1, opened = null, noticeTimer;
const procPages = new Map();
const proc = (nome, referencia, quantidade = '—', observacao = '') => ({nome, referencia, quantidade, observacao});
const stage = (dia, nome, modo, procedimentos, instrucoes = '') => ({dia, nome, modo, procedimentos, instrucoes});
const ia = [
  stage('D0','Aplicação inicial','Confirmação do previsto',[
    proc('Inserção','Dispositivo A · produto cadastrado','1 un / animal'),
    proc('Aplicação','Produto B · produto cadastrado','2 mL / animal')], 'Conferir identificação do animal antes do atendimento.'),
  stage('D7','Aplicação complementar','Confirmação do previsto',[proc('Aplicação','Produto C · produto cadastrado','1 mL / animal')]),
  stage('D8','Retirada','Confirmação do previsto',[proc('Retirada do dispositivo','Sem produto vinculado')]),
  stage('D10','Inseminação','Preenchimento no atendimento',[proc('Inseminação artificial','Sêmen escolhido no atendimento','Definida no atendimento','Pode ser informado por animal ou por grupo que recebeu o mesmo material.')]),
  stage('D40','Diagnóstico','Preenchimento no atendimento',[proc('Exame / diagnóstico','Diagnóstico de gestação · modelo cadastrado','—','Resultado registrado por animal; interpretação segue as regras do exame.')])
];
const san = [
  stage('D0','Avaliação inicial','Preenchimento no atendimento',[proc('Exame','Avaliação clínica · modelo cadastrado')]),
  stage('D0','Aplicação','Confirmação do previsto',[proc('Aplicação','Produto sanitário A · produto cadastrado','2 mL / animal')], 'Quantidades deste mockup são fictícias.'),
  stage('D7','Reavaliação','Preenchimento no atendimento',[proc('Exame','Reavaliação clínica · modelo cadastrado')])
];
const nomes = sanitario ? ['Acompanhamento sanitário','Manejo preventivo','Avaliação de entrada','Controle sanitário','Reavaliação de tratamento','Acompanhamento clínico','Preparação para manejo','Avaliação periódica','Modelo extenso','Acompanhamento individual','Cadastro antigo','Tratamento anterior'] : ['IATF · Modelo de referência','TETF · Receptoras','Pré-sincronização','IATF · Manejo em etapas','Avaliação reprodutiva','Preparação de receptoras','IATF · Segunda versão','Acompanhamento reprodutivo','Modelo extenso','Preparação individual','Cadastro antigo','IATF · Versão anterior'];
const modelos = nomes.map((nome,i) => {
  let etapas = structuredClone(sanitario ? san : ia);
  if (!sanitario && i === 1) etapas[3] = stage('D17','Transferência de embrião','Preenchimento no atendimento',[proc('Transferência de embrião','Embrião escolhido no atendimento','Definida no atendimento','Por animal ou grupo que recebeu o mesmo material genético.')]);
  if (!sanitario && [2,5,9].includes(i)) etapas = etapas.slice(0,3);
  if (!sanitario && [4,7].includes(i)) etapas = [etapas[4]];
  if (i === 8) etapas = Array.from({length:12},(_,j) => stage(`D${j*3}`,`Avaliação ${j+1}`,'Preenchimento no atendimento',[proc('Exame','Modelo de avaliação cadastrado')]));
  if (i === 10) etapas = etapas.slice(0,2).map(e=>({...e,modo:null}));
  return {id:i,nome,versao:i===6?2:1,finalidade:sanitario?'Sanitário':i===1?'TETF':[2,5,9].includes(i)?'Pré-sincronização':[4,7].includes(i)?'Reprodutivo':'IATF',ativo:i!==11,legado:i===10,etapas};
});
$('title').textContent = sanitario?'Protocolos sanitários':'Protocolos reprodutivos';
$(sanitario?'area-san':'area-repro').setAttribute('aria-current','page');
$('new').href = `http://localhost:41875/configuracoes/pecuaria/${sanitario?'sanidade':'reproducao'}/protocolos/novo`;
function feedback(msg) { clearTimeout(noticeTimer); $('feedback').textContent=msg; $('feedback').hidden=false; noticeTimer=setTimeout(()=>$('feedback').hidden=true,7000); }
function pager(id,at,total,rotulo,action) {
  const pages=Math.max(1,Math.ceil(total/10));
  $(id).innerHTML=`<span>${total?`${(at-1)*10+1}–${Math.min(at*10,total)} de ${total} ${rotulo}`:`0 ${rotulo}`} · máximo 10 por página</span><div><button data-page="${at-1}" ${at<=1?'disabled':''} aria-label="Página anterior de ${rotulo}">Anterior</button><button data-page="${at+1}" ${at>=pages?'disabled':''} aria-label="Próxima página de ${rotulo}">Próxima</button></div>`;
  $(id).querySelectorAll('button').forEach(b=>b.onclick=()=>action(Number(b.dataset.page)));
}
const badge = m => `${!m.ativo?'<span class="badge">Inativo</span>':''}${m.legado?'<span class="badge warning">Cadastro não concluído</span>':''}`;
const actions = m => `<button data-open="${m.id}">Ver detalhes</button><div class="secondary-actions"><button class="subtle" data-version="${m.id}">${m.legado?'Concluir cadastro':'Nova versão'}</button>${m.ativo?`<button class="subtle" data-inactivate="${m.id}">Inativar</button>`:''}</div>`;
function render() {
  const q=$('search').value.trim().toLocaleLowerCase('pt-BR');
  const all=modelos.filter(m=>(m.ativo||$('inactive').checked)&&`${m.nome} ${m.finalidade}`.toLocaleLowerCase('pt-BR').includes(q));
  page=Math.min(page,Math.max(1,Math.ceil(all.length/10)));
  const rows=all.slice((page-1)*10,page*10);
  $('count').textContent=`${all.length} protocolos${$('inactive').checked?' · incluindo inativos':' ativos'}`;
  $('cards').setAttribute('aria-pressed',String(mode==='visual')); $('table').setAttribute('aria-pressed',String(mode==='tabela'));
  if(!rows.length) $('results').innerHTML='<div class="empty"><strong>Nenhum protocolo encontrado</strong><p>Revise a busca ou inclua os protocolos inativos.</p></div>';
  else if(mode==='visual') $('results').innerHTML=`<div class="cards">${rows.map(m=>`<article class="card"><div class="cardhead"><h2>${esc(m.nome)}</h2><div class="meta"><span>Versão ${m.versao}</span><span>· ${esc(m.finalidade)}</span><span>· ${m.etapas.length} ${m.legado?'procedimentos':m.etapas.length===1?'etapa':'etapas'}</span>${badge(m)}</div></div><ol class="stage-preview" aria-label="${m.legado?'Procedimentos':'Etapas'} de ${esc(m.nome)}">${m.etapas.slice(0,4).map(e=>`<li><time>${esc(e.dia)}</time><span>${esc(e.nome)}</span></li>`).join('')}${m.etapas.length>4?`<li class="more">+ ${m.etapas.length-4} ${m.etapas.length===5?'etapa':'etapas'} em Ver detalhes</li>`:''}</ol><footer class="cardfoot">${actions(m)}</footer></article>`).join('')}</div>`;
  else $('results').innerHTML=`<div class="table-wrap"><table aria-label="Protocolos cadastrados"><thead><tr><th>Protocolo</th><th>Finalidade</th><th>Versão</th><th>Estrutura</th><th>Ações</th></tr></thead><tbody>${rows.map(m=>`<tr><td><strong>${esc(m.nome)}</strong>${badge(m)}</td><td>${esc(m.finalidade)}</td><td>${m.versao}</td><td>${m.etapas.length} ${m.legado?'procedimentos':m.etapas.length===1?'etapa':'etapas'}</td><td><div class="table-actions">${actions(m)}</div></td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDetail(Number(b.dataset.open)));
  document.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>feedback(modelos[Number(b.dataset.version)].legado?'Na aplicação, abre o cadastro antigo para conclusão. Este mockup não altera registros.':'Na aplicação, abre o builder com esta versão como base. O nome e a origem são preservados; salva como uma nova versão.'));
  document.querySelectorAll('[data-inactivate]').forEach(b=>b.onclick=()=>{modelos[Number(b.dataset.inactivate)].ativo=false;render();feedback('Protocolo inativado apenas na demonstração. Use “Mostrar inativos” para consultá-lo.');});
  pager('pagination',page,all.length,'protocolos',p=>{page=p;render();$('count').scrollIntoView({block:'start'});});
}
function procedures(e,index) {
  const at=procPages.get(index)||1, total=e.procedimentos.length;
  return `<div class="table-wrap"><table aria-label="Procedimentos de ${esc(e.nome)}"><thead><tr><th>Procedimento</th><th>Produto / modelo</th><th>Quantidade prevista</th></tr></thead><tbody>${e.procedimentos.slice((at-1)*10,at*10).map(p=>`<tr><td>${esc(p.nome)}</td><td>${esc(p.referencia)}${p.observacao?`<small>${esc(p.observacao)}</small>`:''}</td><td>${esc(p.quantidade)}</td></tr>`).join('')}</tbody></table></div>${total>10?`<nav class="pager" aria-label="Paginação dos procedimentos de ${esc(e.nome)}"><span>${(at-1)*10+1}–${Math.min(at*10,total)} de ${total} procedimentos</span><div><button data-proc-index="${index}" data-proc-page="${at-1}" ${at===1?'disabled':''}>Anterior</button><button data-proc-index="${index}" data-proc-page="${at+1}" ${at*10>=total?'disabled':''}>Próxima</button></div></nav>`:''}`;
}
function renderSteps() {
  $('steps').innerHTML=opened.etapas.slice((stepPage-1)*10,stepPage*10).map((e,i)=>`<section class="step"><header class="stephead"><h3><time>${esc(e.dia)}</time>${esc(e.nome)}</h3><span class="mode">${esc(e.modo||'Forma de atendimento não informada')}</span></header>${procedures(e,(stepPage-1)*10+i)}${e.instrucoes?`<p class="instructions"><strong>Instruções:</strong> ${esc(e.instrucoes)}</p>`:''}</section>`).join('');
  document.querySelectorAll('[data-proc-index]').forEach(b=>b.onclick=()=>{procPages.set(Number(b.dataset.procIndex),Number(b.dataset.procPage));renderSteps();});
  pager('steps-pagination',stepPage,opened.etapas.length,opened.legado?'procedimentos':'etapas',p=>{stepPage=p;renderSteps();$('detail').querySelector('.modalbody').scrollTop=0;});
}
function openDetail(id) {
  opened=modelos[id];stepPage=1;procPages.clear();
  $('detail-title').textContent=opened.nome;
  $('detail-meta').textContent=`Versão ${opened.versao} · ${opened.finalidade} · ${opened.etapas.length} ${opened.legado?'procedimentos':'etapas'}${!opened.ativo?' · Inativo':''}`;
  $('legacy').hidden=!opened.legado;
  $('legacy').textContent='Cadastro antigo: os procedimentos ainda não foram organizados em etapas. Datas e configurações originais permanecem preservadas. Conclua o cadastro para disponibilizar o modelo.';
  renderSteps();$('detail').showModal();
}
['close','close-footer'].forEach(id=>$(id).onclick=()=>$('detail').close());
$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
$('search').oninput=()=>{page=1;render();};$('inactive').onchange=()=>{page=1;render();};
function changeMode(next){mode=next;const url=new URL(location.href);url.searchParams.set('visual',mode);history.replaceState(null,'',url);render();}
$('cards').onclick=()=>changeMode('visual');$('table').onclick=()=>changeMode('tabela');render();
