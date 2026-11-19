import { useEffect, useState } from "react";
import { obterAvisosAplicacoes } from "./api";

export function AvisosAplicacoesTablet({ data, sitio }: { data: string; sitio: number | null }) {
  const [animais, setAnimais] = useState<Awaited<ReturnType<typeof obterAvisosAplicacoes>>>([]);
  useEffect(() => {
    if (sitio == null) return;
    let ativo = true;
    let carregando = false;
    function consultar() {
      if (carregando || document.visibilityState === "hidden") return;
      carregando = true;
      void obterAvisosAplicacoes(data, sitio).then(lista => {
        if (ativo && Array.isArray(lista)) setAnimais(lista);
      }).catch(() => {
        // Preserva o aviso já lido quando a conexão oscila.
      }).finally(() => { carregando = false; });
    }
    consultar();
    const timer = window.setInterval(consultar, 15000);
    document.addEventListener("visibilitychange", consultar);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", consultar);
    };
  }, [data, sitio]);
  return <div aria-live="polite">{animais.length > 0 && <div className="leite-pendencia">
    <strong>Aplicações aguardando conferência</strong>
    <p>{animais.map(a => [a.brinco, a.nome].filter(Boolean).join(" · ")).join(" / ")}</p>
  </div>}</div>;
}
