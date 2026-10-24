import { useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { OperacaoProtocolo } from "./OperacaoProtocolo";
import { reqProtocolo, consultaProtocolo, type CabecalhoProtocolo } from "./api";
import type { PaginaProtocolo } from "./EtapasProtocolo";

/** Abre o recorte do animal, inclusive quando a inscrição pertence a uma programação. */
export function AtendimentoParticipacaoAnimal({ participacaoId, programacaoId, animalId, propriedadeId, podeLancar, aoSalvar }: {
  participacaoId?: string; programacaoId?: string; animalId: string; propriedadeId?: number; podeLancar: boolean; aoSalvar?: () => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function abrir() {
    if (ocupado) return;
    if (aberta) { setAberta(null); return; }
    setErro(null);
    if (participacaoId) { setAberta(participacaoId); return; }
    setOcupado(true);
    try {
      const dados = await reqProtocolo<PaginaProtocolo<CabecalhoProtocolo>>(`/participacoes${consultaProtocolo({ animalId, programacaoId, pagina: 1 })}`, propriedadeId);
      if (dados.total !== 1 || dados.itens[0]?.animal?.id !== animalId) throw new Error("Confira a participação deste animal na programação antes do atendimento.");
      setAberta(dados.itens[0].id);
    } catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <div className="grid gap-3"><Button secondary disabled={ocupado} aria-expanded={!!aberta} onClick={()=>{void abrir();}}>{ocupado?"Consultando participação…":aberta?"Fechar atendimento na ficha":"Consultar e atender nesta ficha"}</Button><ErrorBox erro={erro}/>{aberta&&<OperacaoProtocolo participacaoId={aberta} propriedadeId={propriedadeId} podeLancar={podeLancar} aoSalvar={aoSalvar}/>}</div>;
}
