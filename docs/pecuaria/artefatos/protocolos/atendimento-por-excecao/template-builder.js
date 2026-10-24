'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types = ['Aplicação de produto','Inserção de dispositivo','Retirada de dispositivo','Inseminação','Transferência de embrião','Exame / diagnóstico'];
// Catálogos fictícios. A implementação consultará os cadastros compartilhados.
const products = [
  {id:'produto-a',name:'Produto A',unit:'mL',via:'Intramuscular',guidance:'Conferir a identificação do produto antes do uso.'},
  {id:'produto-b',name:'Produto B',unit:'mL'},
  {id:'dispositivo',name:'Dispositivo de demonstração',unit:'un',via:'Intravaginal'},
];
const exams = [
  {id:'diagnostico',name:'Diagnóstico de gestação',domain:'Reprodutivo',version:1,fields:'Resultado, data e responsável'},
  {id:'avaliacao',name:'Avaliação reprodutiva',domain:'Reprodutivo',version:2,fields:'Achados da avaliação e conclusão'},
  {id:'sanitario',name:'Exame sanitário de demonstração',domain:'Sanitário',version:1,fields:'Resultado e observações'},
];
const usesProduct = a => ['Aplicação de produto','Inserção de dispositivo'].includes(a.type);
const needsManual = a => ['Inseminação','Transferência de embrião','Exame / diagnóstico'].includes(a.type);
let identity=0;
const uid = prefix => `${prefix}-${++identity}`;
const action = (type='Aplicação de produto', productId='', q='', examId='') => ({id:uid('action'),type,productId,q,examId});
const stage = (name,day,mode,actions,instructions='') => ({id:uid('stage'),name,day,intervalo:day,unidadeIntervalo:'DIAS',orientacaoTemporal:null,mode,actions,instructions});
const purposes = {SANITARIO:'Sanitário',PREPARACAO:'Pré-sincronização / preparação',IATF:'IATF',TETF:'TETF'};
const fieldId = (a,field) => `${a.id}-${field}`;
let fieldErrors=[];
function clearErrors(){
  fieldErrors=[];
  document.querySelectorAll('#template-editor [aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby');});
  document.querySelectorAll('#template-editor .field-error').forEach(el=>el.remove());
}
function showErrors(){
  for(const error of fieldErrors){
    if(error.stageIndex!==undefined&&error.stageIndex!==selected)continue;
    if($(`${error.field}-error`))continue;
    const el=$(error.field);if(!el)continue;
    const message=document.createElement('small');message.id=`${error.field}-error`;message.className='field-error';message.textContent=error.message;
    el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby',message.id);el.after(message);
  }
}
function renderPurpose(){
  const sanitary=draft.domain==='Sanitário';
  $('model-purpose').innerHTML=(sanitary?['SANITARIO']:['','PREPARACAO','IATF','TETF']).map(p=>`<option value="${p}">${purposes[p]||'Selecionar finalidade…'}</option>`).join('');
  $('model-purpose').value=sanitary?'SANITARIO':draft.finalidade||'';
  $('model-purpose').disabled=sanitary;
  $('purpose-note').textContent=sanitary?'Finalidade derivada do domínio sanitário.':draft.finalidade?'A finalidade não muda pelo nome nem cria encadeamento entre protocolos.':'Versão sem classificação: escolha a finalidade desta nova versão. O original permanece preservado.';
}
function temporalLabel(s){return `${s.unidadeIntervalo==='HORAS'?'H':'D'}${s.intervalo}`;}
function temporalSupported(s){
  const o=s.orientacaoTemporal;
  return Number.isFinite(s.intervalo)&&s.intervalo>=0&&s.intervalo<=10000&&['DIAS','HORAS'].includes(s.unidadeIntervalo)&&(!o||(o.versao===1&&o.efeito==='ALERTA'&&['INICIO_EFETIVO','ETAPA_ANTERIOR'].includes(o.referencia)&&Number.isFinite(o.intervaloHoras)&&o.intervaloHoras>=0&&o.intervaloHoras<=24000&&['toleranciaAntesMinutos','toleranciaDepoisMinutos'].every(k=>Number.isInteger(o[k])&&o[k]>=0&&o[k]<=10080)));
}
function renderTemporal(){
  const s=current(),o=s.orientacaoTemporal;
  $('stage-day').value=s.intervalo;$('stage-unit').value=s.unidadeIntervalo;
  $('temporal-reference').value=o?.referencia||'';
  $('temporal-fields').hidden=!o;
  for(const [id,key] of [['temporal-hours','intervaloHoras'],['temporal-before','toleranciaAntesMinutos'],['temporal-after','toleranciaDepoisMinutos']])$(id).value=o?.[key]??0;
  $('temporal-preview').textContent=temporalSupported(s)?`${temporalLabel(s)}: ${s.intervalo*(s.unidadeIntervalo==='DIAS'?24:1)} horas desde o início. ${o?`Orientação: ${o.intervaloHoras} horas após ${o.referencia==='ETAPA_ANTERIOR'?'a realização da etapa anterior':'o início efetivo'}, tolerância de ${o.toleranciaAntesMinutos} min antes e ${o.toleranciaDepoisMinutos} min depois.`:'Sem orientação adicional.'} Sem horário real, a precisão continua desconhecida; não é presumida meia-noite.`:'Configuração temporal legada não suportada. O original está preservado; a publicação desta derivação está bloqueada.';
}

let serial=5;
let models = [
  {id:1,name:'IATF · Fazenda Escola',domain:'Reprodutivo',version:1,published:true,stages:[
    stage('Início',0,'AUTOMATIZADA',[action('Inserção de dispositivo','dispositivo',1),action('Aplicação de produto','produto-a',2),action('Aplicação de produto','produto-b',1)],'Conferir a identificação dos animais e registrar qualquer exceção antes de confirmar a etapa.'),
    stage('Aplicação',7,'AUTOMATIZADA',[action('Aplicação de produto','produto-a',2)]),
    stage('Retirada',8,'AUTOMATIZADA',[action('Retirada de dispositivo')]),
    stage('Inseminação',10,'MANUAL',[action('Inseminação')]),
    stage('Diagnóstico',40,'MANUAL',[action('Exame / diagnóstico','',1,'diagnostico')]),
  ]},
  {id:2,name:'TETF · Receptoras',domain:'Reprodutivo',version:1,published:true,stages:[
    stage('Início',0,'AUTOMATIZADA',[action('Inserção de dispositivo','dispositivo',1),action('Aplicação de produto','produto-a',2)]),
    stage('Retirada',8,'AUTOMATIZADA',[action('Retirada de dispositivo')]),
    stage('Transferência de embrião',17,'MANUAL',[action('Transferência de embrião')]),
  ]},
  {id:3,name:'Protocolo sanitário',domain:'Sanitário',version:1,published:true,stages:[
    stage('Aplicação inicial',0,'AUTOMATIZADA',[action('Aplicação de produto','produto-b',1)]),
    stage('Avaliação',7,'MANUAL',[action('Exame / diagnóstico','',1,'sanitario')]),
  ]},
  {id:4,name:'Pré-sincronização · Exemplo',domain:'Reprodutivo',version:1,published:true,stages:[
    stage('Preparação',0,'AUTOMATIZADA',[action('Aplicação de produto','produto-a',2)],'Seguir a orientação do responsável pelo protocolo. Este exemplo não define uma prescrição.'),
  ]},
];
let draft=null,selected=0,modelPage=1,stagePage=1,actionPage=1,query='';
function paginate(id,total,page,kind){
  const pages=Math.max(1,Math.ceil(total/10));
  $(id).innerHTML=`<span>${total?`${(page-1)*10+1}–${Math.min(page*10,total)} de ${total}`:'Nenhum item'} · até 10 por página</span><div><button data-page="${kind}" data-value="${page-1}" ${page===1?'disabled':''}>Anterior</button><span>${page} / ${pages}</span><button data-page="${kind}" data-value="${page+1}" ${page===pages?'disabled':''}>Próxima</button></div>`;
}
function renderCatalog(){
  const list=models.filter(m=>m.name.toLowerCase().includes(query));
  modelPage=Math.min(modelPage,Math.max(1,Math.ceil(list.length/10)));
  $('template-list').innerHTML=list.slice((modelPage-1)*10,modelPage*10).map(m=>`<tr><td data-label="Modelo"><strong>${esc(m.name)}</strong><small>Versão ${m.version} · ${purposes[m.finalidade]||'Legado sem finalidade declarada'}</small></td><td data-label="Domínio">${m.domain}</td><td data-label="Etapas">${m.stages.length}</td><td data-label="Situação"><span class="tag ${m.published?'':'neutral'}">${m.published?'Publicado':'Rascunho'}</span></td><td data-label="Ação"><button data-edit-model="${m.id}">${m.published?'Criar nova versão':'Editar rascunho'}</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhum modelo encontrado.</td></tr>';
  paginate('template-pager',list.length,modelPage,'models');
}
function startDraft(id){
  const source=models.find(m=>m.id===id);
  if(source){
    draft=structuredClone(source);
    if(source.published){draft.id=serial++;draft.version=Math.max(...models.filter(m=>m.name===source.name&&m.domain===source.domain).map(m=>m.version))+1;draft.published=false;}
  } else draft={id:serial++,name:'',domain:'Reprodutivo',version:1,published:false,stages:[stage('Nova etapa',0,'AUTOMATIZADA',[action()])]};
  selected=0;stagePage=1;actionPage=1;
  $('model-name').value=draft.name;$('model-domain').value=draft.domain;
  $('catalog').hidden=true;$('template-editor').hidden=false;
  $('editor-title').textContent=source?(source.published?'Editar nova versão do modelo':'Editar rascunho'):'Criar modelo';
  $('version-hint').textContent=`Rascunho · v${draft.version} · sem vínculo com animais ou turmas. As versões publicadas permanecem preservadas.`;
  clearErrors();$('model-feedback').textContent='';renderPurpose();renderEditor();$('model-name').focus();
}
function current(){return draft.stages[selected];}
function renderAction(a,n){
  const s=current(),p=products.find(p=>p.id===a.productId);
  let fields='';
  if(usesProduct(a)){
    fields=`<div class="fields"><label class="full">Produto cadastrado<select data-action="${a.id}" data-field="productId"><option value="">Selecionar produto…</option>${products.map(p=>`<option value="${p.id}" ${p.id===a.productId?'selected':''}>${p.name}</option>`).join('')}</select><small>Mesmo cadastro utilizado pelo estoque.</small></label><label>${s.mode==='MANUAL'?'Quantidade de referência por animal':'Quantidade por animal'}<input type="number" min="0.001" step="0.001" data-action="${a.id}" data-field="q" value="${a.q}"></label><div class="inherited-unit"><span>Unidade do produto</span><strong>${p?esc(p.unit):'Selecione um produto'}</strong></div></div>`;
    if(p&&(p.via||p.guidance))fields+=`<dl class="product-information">${p.via?`<div><dt>Via</dt><dd>${esc(p.via)}</dd></div>`:''}${p.guidance?`<div><dt>Orientação</dt><dd>${esc(p.guidance)}</dd></div>`:''}</dl><small class="inherited-note">Informações do cadastro do produto.</small>`;
    if(s.mode==='MANUAL')fields+='<p class="procedure-help">O produto é a referência. No atendimento, informe o que foi utilizado por animal ou grupo.</p>';
  }else if(a.type==='Retirada de dispositivo'){
    fields='<div class="procedure-help"><strong>Sem consumo de produto</strong><p>No atendimento, a retirada será vinculada à inserção registrada em cada animal. A retirada não devolve o dispositivo ao estoque.</p></div>';
  }else if(a.type==='Exame / diagnóstico'){
    const options=exams.filter(e=>e.domain===draft.domain),ex=exams.find(e=>e.id===a.examId);
    fields=`<div class="fields"><label class="full">Modelo de exame<select data-action="${a.id}" data-field="examId"><option value="">Selecionar modelo cadastrado…</option>${options.map(e=>`<option value="${e.id}" ${e.id===a.examId?'selected':''}>${e.name} · v${e.version}</option>`).join('')}${ex&&ex.domain!==draft.domain?`<option value="${ex.id}" selected>${esc(ex.name)} · incompatível com ${esc(draft.domain)}</option>`:''}</select></label></div>${ex?`<div class="procedure-help"><strong>Campos do modelo · v${ex.version}</strong><p>${esc(ex.fields)}</p><p>Resultados preenchidos no atendimento, por animal ou grupo quando permitido pelo exame.</p></div>`:'<p class="procedure-help">Os campos e resultados são definidos pelo modelo de exame cadastrado.</p>'}`;
  }else{
    fields=`<div class="procedure-help"><strong>${a.type==='Inseminação'?'Sêmen definido no atendimento':'Embrião definido no atendimento'}</strong><p>${a.type==='Inseminação'?'Informe o sêmen, a origem, o lote e a quantidade efetivamente utilizados.':'Informe os embriões utilizados, sua origem e as identificações disponíveis.'} É possível distribuir o mesmo material entre animais de um grupo, preservando o registro individual.</p></div>`;
  }
  const markup = `<article class="action-editor" id="${a.id}"><div class="sectiontitle"><h3>Procedimento ${n+1}</h3><button data-remove-action="${n}">Remover procedimento ${n+1}</button></div><label class="procedure-type">Tipo de procedimento<select data-action="${a.id}" data-field="type">${types.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join('')}</select></label>${fields}${needsManual(a)&&s.mode!=='MANUAL'?'<p class="error">Este procedimento exige dados reais. Altere a etapa para Manual antes de publicar.</p>':''}</article>`;
  return markup.replace(/data-field="([^"]+)"/g,(_,field)=>`id="${fieldId(a,field)}" data-field="${field}"`);
}
function updateAction(a,field){
  const old=$(a.id);if(!old)return;
  const holder=document.createElement('div');holder.innerHTML=renderAction(a,current().actions.indexOf(a));old.replaceWith(holder.firstElementChild);
  if(field)($(fieldId(a,field))||$(fieldId(a,'type')))?.focus();
}

function renderEditor(renderActions=true){
  const previous=document.activeElement,previousId=previous?.id,previousStage=previous?.dataset.stage,previousPage=previous?.dataset.page;
  const s=current();
  $('stage-list').innerHTML=draft.stages.slice((stagePage-1)*10,stagePage*10).map((st,i)=>{const n=(stagePage-1)*10+i;return `<button id="${st.id}" class="stage-option" data-stage="${n}" aria-pressed="${selected===n}"><strong>${temporalLabel(st)} · ${esc(st.name)}</strong><small>${st.mode==='AUTOMATIZADA'?'Automatizada · confirmar o previsto':'Manual · registrar dados'} · ${st.actions.length} ${st.actions.length===1?'procedimento':'procedimentos'}</small></button>`;}).join('');
  paginate('stages-pager',draft.stages.length,stagePage,'stages');
  $('stage-editor-title').textContent=`Etapa ${selected+1} de ${draft.stages.length}`;
  $('stage-name').value=s.name;$('stage-instructions').value=s.instructions;renderTemporal();
  document.querySelectorAll('[name="stage-mode"]').forEach(r=>r.checked=r.value===s.mode);
  $('stage-mode-note').textContent=s.mode==='AUTOMATIZADA'?'O atendimento vem preenchido para todos os pendentes. Confirmar os OKs registra os procedimentos e o consumo de estoque, com possibilidade de ajustar exceções.':'O atendimento exige os dados reais por animal ou grupo. Produtos de aplicação podem servir de referência; materiais genéticos e resultados são informados durante o atendimento.';
  actionPage=Math.min(actionPage,Math.max(1,Math.ceil(s.actions.length/10)));
  if(renderActions)$('template-actions').innerHTML=s.actions.slice((actionPage-1)*10,actionPage*10).map((a,i)=>renderAction(a,(actionPage-1)*10+i)).join('')||'<p class="empty">Adicione os procedimentos que compõem esta etapa.</p>';
  paginate('actions-pager',s.actions.length,actionPage,'actions');
  $('remove-stage').disabled=draft.stages.length===1;
  focusAfterRender(previousId,previousStage,previousPage);
  $('model-summary').textContent=`${draft.stages.length} etapas · ${draft.stages.filter(s=>s.mode==='AUTOMATIZADA').length} automatizadas · ${draft.stages.filter(s=>s.mode==='MANUAL').length} manuais`;
}
function focusAfterRender(previousId,previousStage,previousPage){
  if(previousId&&$(previousId))$(previousId).focus();
  else if(previousStage!==undefined)document.querySelector(`[data-stage="${previousStage}"]`)?.focus();
  else if(previousPage)document.querySelector(`[data-page="${previousPage}"]:not(:disabled)`)?.focus();
}
function store(publish){
  clearErrors();
  const errors=[];
  const error=(field,message,stageIndex,actionIndex)=>{errors.push(message);fieldErrors.push({field,message,stageIndex,actionIndex});};
  if(!draft.name.trim())error('model-name','Informe o nome do modelo.');
  if(publish){
    if(draft.domain==='Sanitário')draft.finalidade='SANITARIO';
    if(!Object.hasOwn(purposes,draft.finalidade)||((draft.finalidade==='SANITARIO')!==(draft.domain==='Sanitário')))error('model-purpose','Selecione uma finalidade compatível com o domínio.');
    const all=draft.stages.flatMap(s=>s.actions);
    if(draft.finalidade==='IATF'&&!all.some(a=>a.type==='Inseminação'))error('model-purpose','IATF exige ao menos uma ação de inseminação.');
    if(draft.finalidade==='TETF'&&!all.some(a=>a.type==='Transferência de embrião'))error('model-purpose','TETF exige ao menos uma ação de transferência de embrião.');
    for(const [i,s]of draft.stages.entries()){
      const prefix=`Etapa ${i+1}: `;
      if(!s.name.trim())error('stage-name',prefix+'informe o nome.',i);
      if(!temporalSupported(s)){
        const o=s.orientacaoTemporal;
        const temporalField=o&&(!Number.isFinite(o.intervaloHoras)||o.intervaloHoras<0||o.intervaloHoras>24000)?'temporal-hours':o&&(!Number.isInteger(o.toleranciaAntesMinutos)||o.toleranciaAntesMinutos<0||o.toleranciaAntesMinutos>10080)?'temporal-before':o&&(!Number.isInteger(o.toleranciaDepoisMinutos)||o.toleranciaDepoisMinutos<0||o.toleranciaDepoisMinutos>10080)?'temporal-after':'stage-day';
        error(temporalField,prefix+'configuração temporal inválida ou legada não suportada; publicação bloqueada.',i);
      }
      if(!s.actions.length)error('add-template-action',prefix+'adicione ao menos um procedimento.',i);
      for(const [j,a] of s.actions.entries()){
        const fail=(field,message)=>error(fieldId(a,field),prefix+`procedimento ${j+1}: `+message,i,j);
        if(!types.includes(a.type))fail('type','selecione um tipo disponível.');
        if(usesProduct(a)){
          if(!products.some(p=>p.id===a.productId))fail('productId','selecione um produto cadastrado.');
          if(typeof a.q!=='number'||!Number.isFinite(a.q)||a.q<=0)fail('q','informe novamente uma quantidade positiva para o produto escolhido.');
        }
        if(a.type==='Exame / diagnóstico'&&!exams.some(e=>e.id===a.examId&&e.domain===draft.domain))fail('examId','selecione um exame compatível com o domínio.');
        if(needsManual(a)&&s.mode!=='MANUAL')error('stage-mode-manual',prefix+`procedimento ${j+1}: configure a etapa como Manual para registrar material ou resultado.`,i,j);
        if(draft.domain==='Sanitário'&&['Inseminação','Transferência de embrião'].includes(a.type))fail('type','IA e TE pertencem ao domínio Reprodutivo.');
      }
    }
  }
  if(errors.length){
    const first=fieldErrors[0];
    if(first.stageIndex!==undefined){selected=first.stageIndex;stagePage=Math.floor(selected/10)+1;actionPage=Math.floor((first.actionIndex||0)/10)+1;renderEditor();}
    showErrors();$('model-feedback').className='error';$('model-feedback').textContent=[...new Set(errors)].join('\n');$(first.field)?.focus();return;
  }
  draft.published=publish;
  const pos=models.findIndex(m=>m.id===draft.id);
  if(pos>=0)models[pos]=structuredClone(draft);else models.push(structuredClone(draft));
  $('model-feedback').className='ready';
  $('model-feedback').textContent='Rascunho salvo nesta demonstração. Nenhum animal ou atendimento foi alterado.';
  if(publish){$('catalog').hidden=false;$('template-editor').hidden=true;renderCatalog();$('new-template').focus();$('catalog-feedback').textContent=`${draft.name} · v${draft.version} publicada nesta demonstração.`;}
}
$('template-search').oninput=e=>{query=e.target.value.toLowerCase();modelPage=1;renderCatalog();};
$('new-template').onclick=()=>startDraft();
$('back-catalog').onclick=()=>{$('template-editor').hidden=true;$('catalog').hidden=false;renderCatalog();$('new-template').focus();};
$('model-name').oninput=e=>{clearErrors();draft.name=e.target.value;};
$('model-domain').onchange=e=>{clearErrors();draft.domain=e.target.value;draft.finalidade=draft.domain==='Sanitário'?'SANITARIO':null;renderPurpose();renderEditor();};
$('model-purpose').onchange=e=>{clearErrors();draft.finalidade=e.target.value||null;renderPurpose();};
$('stage-name').onchange=e=>{clearErrors();current().name=e.target.value;renderEditor(false);};
const numberValue = value => value===''?null:Number(value);
$('stage-day').onchange=e=>{clearErrors();current().intervalo=numberValue(e.target.value);renderEditor(false);};
$('stage-unit').onchange=e=>{clearErrors();current().unidadeIntervalo=e.target.value;renderEditor(false);};
$('temporal-reference').onchange=e=>{clearErrors();const s=current();s.orientacaoTemporal=e.target.value?{...(s.orientacaoTemporal||{versao:1,efeito:'ALERTA',intervaloHoras:0,toleranciaAntesMinutos:0,toleranciaDepoisMinutos:0}),referencia:e.target.value}:null;renderTemporal();};
for(const [id,key] of [['temporal-hours','intervaloHoras'],['temporal-before','toleranciaAntesMinutos'],['temporal-after','toleranciaDepoisMinutos']])$(id).onchange=e=>{clearErrors();current().orientacaoTemporal[key]=numberValue(e.target.value);renderTemporal();};
$('stage-instructions').oninput=e=>{current().instructions=e.target.value;};
document.querySelectorAll('[name="stage-mode"]').forEach(r=>r.onchange=()=>{clearErrors();current().mode=r.value;renderEditor(false);current().actions.forEach(a=>updateAction(a));});
$('add-stage').onclick=()=>{draft.stages.push(stage('Nova etapa',current().intervalo+1,'AUTOMATIZADA',[action()]));selected=draft.stages.length-1;stagePage=Math.floor(selected/10)+1;actionPage=1;renderEditor();};
$('remove-stage').onclick=()=>{if(draft.stages.length<2)return;draft.stages.splice(selected,1);selected=Math.min(selected,draft.stages.length-1);stagePage=Math.floor(selected/10)+1;actionPage=1;renderEditor();};
$('add-template-action').onclick=()=>{current().actions.push(action());actionPage=Math.ceil(current().actions.length/10);renderEditor();$(fieldId(current().actions.at(-1),'type')).focus();};
$('save-template').onclick=()=>store(false);
$('publish-template').onclick=()=>store(true);
$('reset-template').onclick=()=>location.reload();
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.editModel)startDraft(Number(b.dataset.editModel));
  if(b.dataset.stage!==undefined){selected=Number(b.dataset.stage);actionPage=1;renderEditor();}
  if(b.dataset.removeAction!==undefined){clearErrors();const index=Number(b.dataset.removeAction);current().actions.splice(index,1);const neighbour=current().actions[Math.min(index,current().actions.length-1)];actionPage=neighbour?Math.floor(current().actions.indexOf(neighbour)/10)+1:1;renderEditor();(neighbour?$(fieldId(neighbour,'type')):$('add-template-action')).focus();}
  if(b.dataset.page){const n=Number(b.dataset.value);if(b.dataset.page==='models'){modelPage=n;renderCatalog();document.querySelector('[data-page="models"]:not(:disabled)')?.focus();}else{if(b.dataset.page==='stages')stagePage=n;else actionPage=n;renderEditor();}}
});
document.addEventListener('change',e=>{
  const t=e.target;if(t.dataset.action===undefined)return;
  clearErrors();const index=current().actions.findIndex(a=>a.id===t.dataset.action),a=current().actions[index];if(!a)return;
  if(t.dataset.field==='type'){
    // Trocar o tipo descarta parâmetros incompatíveis, sem herdar consumo ou resultado.
    current().actions[index]={...action(t.value),id:a.id};
  }else if(t.dataset.field==='productId'){
    if(a.productId!==t.value){a.productId=t.value;a.q='';}
  }else a[t.dataset.field]=t.dataset.field==='q'?numberValue(t.value):t.value;
  if(t.dataset.field!=='q')updateAction(current().actions[index],t.dataset.field);
});
renderCatalog();
