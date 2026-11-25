import { useEffect, useState } from "react";
import { Syringe } from "lucide-react";
import { LinkInterno } from "@/components/LinkInterno";
import { getUsuario } from "@/lib/auth";
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
  const usuario = getUsuario();
  const podeConferir = !!usuario && (usuario.dono || usuario.flags.includes("revisarAplicacoesTablet"));
  const nomes = animais.map(a => [a.brinco, a.nome].filter(Boolean).join(" · ")).join(", ");
  return <div aria-live="polite">{animais.length > 0 && <div className="leite-aviso-aplicacoes" title={nomes}>
    <Syringe size={16} aria-hidden />
    <span>{animais.length === 1 ? "1 animal com aplicação aguardando conferência" : `${animais.length} animais com aplicações aguardando conferência`}</span>
    {podeConferir && <LinkInterno area="pecuaria" href="/pecuaria/sanidade/tablet/aprovacao">Conferir</LinkInterno>}
  </div>}</div>;
}
