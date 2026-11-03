import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../financeiro/financeiro-ui";
import { CustosDiretos } from "../custos/CustosDiretos";

/** Mantém o editor financeiro existente acessível sem duplicar o resumo de leitura. */
export function ClassificarCustoAplicacao({ id, propriedadeId, aoFechar }: { id: string; propriedadeId: number; aoFechar: (salvou: boolean) => void }) {
  const [rascunho, setRascunho] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const salvou = useRef(false);
  function fechar() { if (ocupado) return; if (rascunho) setConfirmar(true); else aoFechar(salvou.current); }
  return <Dialog open onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent overlayClassName="z-[1200]" className="z-[1210] w-[calc(100vw-2rem)] max-w-2xl rounded-xl" style={{ height: "min(85dvh, 900px)", maxHeight: "calc(100dvh - 32px)", display: "flex", flexDirection: "column", overflow: "hidden" }} onEscapeKeyDown={e => { if (ocupado) e.preventDefault(); }}>
    <header className="shrink-0 border-b border-border p-5 pr-12"><DialogTitle>Classificar custo da aplicação</DialogTitle><DialogDescription>Finalidade, cobertura do serviço e comprovação do material.</DialogDescription></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {confirmar && <div role="alert" className="grid gap-4"><p>Descartar alterações não salvas?</p><div className="flex flex-wrap gap-3"><Button secondary onClick={() => setConfirmar(false)}>Continuar editando</Button><Button danger onClick={() => aoFechar(salvou.current)}>Descartar alterações</Button></div></div>}
      <div hidden={confirmar}><CustosDiretos mostrarTitulo={false} somenteClassificacao aplicacaoId={id} propriedadeId={propriedadeId} podeLancar aoAlterarRascunho={setRascunho} aoGravar={setOcupado} aoSalvar={() => { salvou.current = true; }} /></div>
    </div>
    <footer className="flex shrink-0 justify-end border-t border-border p-4"><Button secondary disabled={ocupado} onClick={fechar}>Fechar</Button></footer>
  </DialogContent></Dialog>;
}
