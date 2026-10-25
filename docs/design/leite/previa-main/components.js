/* Componentes HTML compartilhados da prévia. Sem dependência da aplicação real. */
const MockupUI = (() => {
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function Button(label, attributes = '', leadingIcon = '') {
    return `<button type="button" class="outline" ${attributes}>${leadingIcon}${escape(label)}</button>`;
  }

  function ActionPanel({ title, description = '', body = '', actions = '', className = '' }) {
    return `<section class="action-panel ${className}">
      <div class="action-panel-heading"><strong>${escape(title)}</strong>
        ${description ? `<p>${escape(description)}</p>` : ''}
      </div>
      ${body ? `<div class="action-panel-body">${body}</div>` : ''}
      ${actions ? `<div class="action-panel-actions">${actions}</div>` : ''}
    </section>`;
  }

  return { Button, ActionPanel };
})();
