interface ContextItem {
  label: string;
  value: string;
}

interface ContextStripProps {
  items: ContextItem[];
}

export function ContextStrip({ items }: ContextStripProps) {
  if (!items.length) return null;
  return (
    <div className="ctx-strip" role="note" aria-label="contexto da tela">
      {items.map((it, idx) => (
        <span key={it.label} className="ctx-item">
          <span className="ctx-lab">{it.label}</span>
          <span className="ctx-val">{it.value}</span>
          {idx < items.length - 1 ? <span className="ctx-sep" aria-hidden>·</span> : null}
        </span>
      ))}
    </div>
  );
}
