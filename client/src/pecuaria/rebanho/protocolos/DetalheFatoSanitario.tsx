import { useEffect, useState } from "react";
import { DetalheSanitario } from "../sanidade/DetalheSanitario";
import { reqSanidade } from "../sanidade/api";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";

/** Consulta o fato original com o mesmo escopo usado na página de Sanidade. */
export function DetalheFatoSanitario({ id, tipo, propriedadeId }: { id: string; tipo: "aplicacao" | "exame"; propriedadeId: number }) {
  const [valor, setValor] = useState<unknown>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setValor(null); setErro(null);
    reqSanidade<unknown>(`/${tipo === "aplicacao" ? "aplicacoes" : "exames"}/${encodeURIComponent(id)}?propriedadeId=${propriedadeId}`)
      .then(d => { if (ativo) setValor(d); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { ativo = false; };
  }, [id, tipo, propriedadeId, revisao]);
  return <div><ErrorBox erro={erro}/>{erro ? <Button secondary onClick={() => setRevisao(v => v + 1)}>Tentar novamente</Button> : valor ? <DetalheSanitario tipo={tipo} valor={valor} onAtualizado={() => setRevisao(v => v + 1)} abrir={(destino, fatoId, sitio) => navegarPara(`/pecuaria/sanidade?detalheTipo=${encodeURIComponent(destino)}&detalheId=${encodeURIComponent(fatoId)}&propriedadeId=${sitio ?? propriedadeId}&retorno=${encodeURIComponent(window.location.pathname + window.location.search)}`)}/> : <p role="status">Consultando atendimento…</p>}</div>;
}
