import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
import type { HistoricoProdutivo } from "./historico-types";

export function periodoProducao(dias = 30) {
  const fim = hojeOperacional(), inicio = new Date(`${fim}T00:00:00Z`);
  inicio.setUTCDate(inicio.getUTCDate() - dias + 1);
  return { inicio: inicio.toISOString().slice(0, 10), fim };
}
/** O recorte existente limita a consulta a 366 dias. Busca e situação operam sobre todo ele. */
export function useHistoricoProdutivo(animalId: string, propriedadeId: number | null, periodo: { inicio: string; fim: string }, token: number, todasPaginas = true) {
  const [dados, setDados] = useState<HistoricoProdutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vigente = true;
    setDados(null); setErro(null); setCarregando(true);
    if (propriedadeId == null) { setCarregando(false); return; }
    const consultar = (pagina: number) => consultarLeite<HistoricoProdutivo>(`/animais/${encodeURIComponent(animalId)}?${new URLSearchParams({ ...periodo, pagina: String(pagina), tamanho: "100" })}`, propriedadeId);
    void (async () => {
      try {
        const primeiro = await consultar(1);
        if (!vigente) return;
        const restantes = todasPaginas && primeiro.total > primeiro.itens.length
          ? await Promise.all(Array.from({ length: Math.max(0, Math.ceil(primeiro.total / primeiro.tamanho) - 1) }, (_, i) => consultar(i + 2))) : [];
        if (vigente) setDados({ ...primeiro, itens: [...primeiro.itens, ...restantes.flatMap(p => p.itens)] });
      } catch (e) { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar a produção"); }
      finally { if (vigente) setCarregando(false); }
    })();
    return () => { vigente = false; };
  }, [animalId, propriedadeId, periodo.inicio, periodo.fim, token, revisao, todasPaginas]);
  return { dados, erro, carregando, tentarNovamente: () => setRevisao(r => r + 1) };
}
