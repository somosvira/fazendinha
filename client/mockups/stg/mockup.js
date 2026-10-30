const telas = [...document.querySelectorAll('.tela')];
const feedback = document.querySelector('#feedback');
function navegar() {
  const selecionada = telas.some(t => '#' + t.id === location.hash) ? location.hash.slice(1) : 'baixa';
  telas.forEach(t => { t.hidden = t.id !== selecionada; });
  document.querySelectorAll('.abas a').forEach(a => {
    if (a.dataset.view === selecionada) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  feedback.hidden = true;
}
window.addEventListener('hashchange', navegar);
navegar();
document.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
  const prazo = document.querySelector(`[data-prazo="${r.name}"]`);
  const campo = prazo.querySelector('input');
  prazo.hidden = r.value !== 'prazo';
  campo.disabled = prazo.hidden;
  campo.required = !prazo.hidden;
}));
document.querySelectorAll('[data-criterio]').forEach(c => c.addEventListener('change', () => {
  const campo = document.querySelector(`[data-parametro="${c.dataset.criterio}"]`);
  campo.disabled = !c.checked;
  campo.required = c.checked;
}));
document.querySelector('#resultado-toque').addEventListener('change', e => {
  document.querySelector('#decisao').hidden = true;
});
document.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault();
  if (f.id === 'toque') document.querySelector('#decisao').hidden = document.querySelector('#resultado-toque').value !== 'apta';
  feedback.textContent = f.dataset.feedback;
  feedback.hidden = false;
  feedback.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}));
