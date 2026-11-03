import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { consultarLeite } from "./operacoes-api";
import { ControlesHistoricosLeite } from "./ControlesHistoricosLeite";
import type { ConsultaControlesColetivos } from "./historico-types";

export function HistoricoColetivoLeite({ propriedadeId, inicio, fim }: { propriedadeId: number | null; inicio: string; fim: string }) {
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<ConsultaControlesColetivos | null>(null), [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setPagina(1); }, [propriedadeId, inicio, fim]);
  useEffect(() => {
    let ativo = true; setDados(null); setErro(null);
    if (propriedadeId === null) return;
    const query = new URLSearchParams({ inicio, fim, pagina: String(pagina), tamanho: "20" });
    void consultarLeite<ConsultaControlesColetivos>(`/controles-historicos/coletivos?${query}`, propriedadeId)
      .then(r => { if (ativo) setDados(r); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar os agregados históricos"); });
    return () => { ativo = false; };
  }, [propriedadeId, inicio, fim, pagina, revisao]);
  if (propriedadeId === null) return <p>Selecione um sítio para consultar os agregados históricos.</p>;
  if (erro) return <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Consultar agregados novamente</Button></p>;
  if (!dados) return <p role="status">Consultando agregados históricos…</p>;
  return <>
    <ControlesHistoricosLeite itens={dados.itens} coletivo />
    <p className="controles-historicos-nota">O filtro de natureza não se aplica aos agregados históricos.</p>
    {dados.total > dados.tamanho && <nav className="historico-produtivo-paginas" aria-label="Páginas dos agregados históricos">
      <Button variant="outline" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Agregados anteriores</Button>
      <span>Página {dados.pagina} · {dados.total} documentos</span>
      <Button variant="outline" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próximos agregados</Button>
    </nav>}
  </>;
}
