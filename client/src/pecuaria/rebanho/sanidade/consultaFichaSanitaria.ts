import { useEffect, useState } from "react";
import { reqSanidade } from "./api";
import type { PaginaSanitaria } from "./rodadas-api";

/** Só publica a coleção após ler todas as páginas do recorte autorizado. */
export function useColecaoFichaSanitaria<T extends { id: string }>(
  rota: string,
  recarregarEm = 0,
) {
  const [dados, setDados] = useState<T[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true;
    setDados(null);
    setErro(null);
    async function carregar() {
      const itens = new Map<string, T>();
      for (let pagina = 1; vivo; pagina++) {
        const separador = rota.includes("?") ? "&" : "?";
        const resposta = await reqSanidade<T[] | PaginaSanitaria<T>>(
          `${rota}${separador}porPagina=50&pagina=${pagina}`,
        );
        if (!vivo) return;
        const lote = Array.isArray(resposta) ? resposta : resposta.itens;
        for (const item of lote) itens.set(item.id, item);
        const terminou = Array.isArray(resposta)
          ? lote.length < 50
          : pagina * resposta.porPagina >= resposta.total;
        if (terminou) {
          setDados([...itens.values()]);
          return;
        }
        if (!lote.length)
          throw new Error(
            "A consulta mudou durante o carregamento. Tente novamente.",
          );
      }
    }
    void carregar().catch((e: unknown) => {
      if (vivo)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar os registros.",
        );
    });
    return () => {
      vivo = false;
    };
  }, [rota, recarregarEm, tentativa]);
  return { dados, erro, tentar: () => setTentativa((v) => v + 1) };
}

export function enderecoSanidadeFicha(
  aba: string,
  animalId?: string,
  loteId?: string,
) {
  return `/pecuaria/sanidade?${new URLSearchParams({ aba, ...(animalId ? { animalId } : {}), ...(loteId ? { loteId } : {}), ...(aba === "agenda" ? { visaoAgenda: "tarefas" } : {}) })}`;
}
export function useAgoraSanitario() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const atualizar = () => setAgora(new Date());
    const intervalo = window.setInterval(atualizar, 60_000);
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);
  return agora;
}
