const $ = (seletor) => document.querySelector(seletor);
function visivel(elemento, mostrar) {
  elemento.hidden = !mostrar;
  elemento.querySelectorAll('input,select,textarea').forEach(campo => { campo.disabled = !mostrar; });
}
function navegar() {
  const alvo = location.hash === '#manutencao' ? 'manutencao' : 'encerrar';
  document.querySelectorAll('.tela').forEach(tela => { tela.hidden = tela.id !== alvo; });
  document.querySelectorAll('.abas a').forEach(a => { if (a.hash === '#' + alvo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
window.addEventListener('hashchange', navegar); navegar();
$('#peso-acao').addEventListener('change', () => {
  const acao = $('#peso-acao').value;
  document.querySelectorAll('[data-selecao]').forEach(el => visivel(el, el.dataset.selecao === (acao || 'vazio')));
});
function trocarManutencao() {
  const acao = $('#acao-manutencao').value;
  document.querySelectorAll('[data-manutencao]').forEach(el => visivel(el, el.dataset.manutencao === acao));
  trocarNovoVinculo();
  $('#salvar-manutencao').textContent = $('#acao-manutencao-label').hidden ? 'Adicionar peso' : acao === 'desvincular' ? 'Desvincular peso' : 'Salvar alteração';
}
function trocarNovoVinculo() {
  document.querySelectorAll('[data-novo]').forEach(el => visivel(el, !el.closest('[data-manutencao]').hidden && el.dataset.novo === $('#novo-vinculo-acao').value));
}
$('#acao-manutencao').addEventListener('change', trocarManutencao);
$('#novo-vinculo-acao').addEventListener('change', trocarNovoVinculo);
function abrirManutencao(adicionando) {
  $('#manter-vinculo').hidden = false;
  $('#titulo-manutencao').textContent = adicionando ? 'Adicionar peso ao encerramento' : 'Revisar vínculo do peso';
  $('#acao-manutencao-label').hidden = adicionando;
  $('#rotulo-novo-vinculo').textContent = adicionando ? 'Como deseja adicionar o peso?' : 'Novo vínculo';
  $('#aviso-substituicao').hidden = adicionando;
  $('#acao-manutencao').value = adicionando ? 'substituir' : 'corrigir';
  trocarManutencao();
  $('#titulo-manutencao').focus();
  $('#titulo-manutencao').scrollIntoView({ block: 'nearest' });
}
$('#abrir-manutencao').addEventListener('click', () => abrirManutencao(false));
$('#abrir-adicao').addEventListener('click', () => abrirManutencao(true));
$('#cancelar-manutencao').addEventListener('click', () => { $('#manter-vinculo').hidden = true; ($('#cenario-vinculo').value === 'sem' ? $('#abrir-adicao') : $('#abrir-manutencao')).focus(); });
$('#cenario-vinculo').addEventListener('change', () => { const sem = $('#cenario-vinculo').value === 'sem'; $('#peso-atual').hidden = sem; $('#peso-ausente').hidden = !sem; $('#vinculo-atual-historico').hidden = sem; $('#manter-vinculo').hidden = true; });
$('#cancelar-encerramento').addEventListener('click', () => { $('#resposta-encerramento').hidden = false; $('#resposta-encerramento').textContent = 'Demonstração cancelada. A lactação real não foi alterada.'; });
document.querySelectorAll('[data-origem]').forEach(origem => origem.addEventListener('change', () => {
  const precisao = origem.closest('.campos').querySelector('[data-precisao]');
  [...precisao.options].forEach(o => { o.disabled = origem.value === 'Balança' && ['Estimado', 'Informado'].includes(o.value); });
  if (origem.value === 'Balança' && ['Estimado', 'Informado'].includes(precisao.value)) precisao.value = 'Não informada';
}));
$('#encerramento').addEventListener('submit', evento => { evento.preventDefault(); $('#resposta-encerramento').hidden = false; $('#resposta-encerramento').textContent = 'Conferência ilustrativa: encerramento manual' + ($('#peso-acao').value ? ' com peso e vínculo na mesma confirmação.' : ' sem peso. O vínculo poderá ser acrescentado depois.') + ' Nenhum dado foi gravado.'; });
$('#manter-vinculo').addEventListener('submit', evento => { evento.preventDefault(); $('#resposta-manutencao').hidden = false; $('#resposta-manutencao').textContent = 'Alteração apenas demonstrada. A implementação conservará autoria, motivo, pesagem e histórico das associações.'; });
