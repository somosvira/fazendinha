import { useEffect, useState } from "react";
/** Conserva o recorte da lista no retorno do editor, sem alterar outros parâmetros. */
export function useConsultaCadastroProtocolos(ativo = true) {
  const ler = () => {
    const p = new URLSearchParams(window.location.search);
    const situacao = p.get("cadastroSituacao");
    return { busca: p.get("cadastroBusca") ?? p.get("busca") ?? "", pagina: Math.max(1, Math.floor(Number(p.get("cadastroPagina")) || 1)), situacao: situacao && ["TODAS", "ATIVA", "INATIVA", "RASCUNHO", "PUBLICADA"].includes(situacao) ? situacao : "ATIVA" };
  };
  const [inicial] = useState(ler);
  const [busca, setBusca] = useState(inicial.busca);
  const [pagina, setPagina] = useState(inicial.pagina);
  const [situacao, setSituacao] = useState(inicial.situacao);
  useEffect(() => {
    if (!ativo) return;
    const url = new URL(window.location.href);
    const definir = (chave: string, valor: string | null) => valor ? url.searchParams.set(chave, valor) : url.searchParams.delete(chave);
    definir("cadastroBusca", busca); definir("cadastroPagina", pagina > 1 ? String(pagina) : null); definir("cadastroSituacao", situacao !== "ATIVA" ? situacao : null);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [ativo, busca, pagina, situacao]);
  useEffect(() => {
    if (!ativo) return;
    const atualizar = () => { const p = ler(); setBusca(p.busca); setPagina(p.pagina); setSituacao(p.situacao); };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, [ativo]);
  return { busca, setBusca, pagina, setPagina, situacao, setSituacao };
}
