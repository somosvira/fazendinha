/**
 * Banner promocional — anuncia promoções temporárias na assinatura.
 * Pode ser fechado pelo usuário (estado local, volta na próxima sessão).
 */

import { useState } from "react";

export function PromoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="promo-banner">
      <div className="promo-banner-content">
        <div className="promo-banner-icon">🎉</div>
        <div className="promo-banner-text">
          <strong>Promoção especial na assinatura!</strong>
          <span className="promo-banner-detail">Aproveite condições exclusivas por tempo limitado.</span>
        </div>
        <a 
          href="https://example.com/promocao" 
          className="promo-banner-cta"
          target="_blank"
          rel="noopener noreferrer"
        >
          Saiba mais →
        </a>
        <button 
          className="promo-banner-close"
          onClick={() => setDismissed(true)}
          aria-label="Fechar"
          title="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
