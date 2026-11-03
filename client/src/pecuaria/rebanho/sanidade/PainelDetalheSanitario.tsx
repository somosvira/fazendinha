import { Activity, CalendarDays, ClipboardList, FlaskConical, Syringe } from "lucide-react";
import "./detalhe-sanitario.css";
import { useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../financeiro/financeiro-ui";

export function PainelDetalheSanitario({ onFechar, children, tipo, acaoRodape, aberto = true }: { onFechar: () => void; children: ReactNode; tipo?: string; acaoRodape?: ReactNode; aberto?: boolean }) {
  const titulo = ({ ocorrencia: "Ocorrência sanitária", aplicacao: "Aplicação sanitária", exame: "Exame do animal", protocolo: "Execução de protocolo", tarefa: "Tarefa sanitária", rodada: "Ciclo sanitário" } as Record<string, string>)[tipo ?? ""] ?? "Detalhe sanitário";
  const Icone = tipo === "exame" ? FlaskConical : tipo === "aplicacao" ? Syringe : tipo === "rodada" || tipo === "tarefa" ? CalendarDays : tipo === "protocolo" ? ClipboardList : Activity;
  const origem = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Dialog open={aberto} onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
    <DialogContent overlayClassName="z-[1100]" style={{ height: "min(85dvh, 900px)", maxHeight: "calc(100dvh - 32px)", overflow: "hidden", display: "flex", flexDirection: "column" }} className="painel-detalhe-sanitario z-[1100] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl" onCloseAutoFocus={(evento) => {
      if (origem.current?.isConnected) { evento.preventDefault(); origem.current.focus(); }
    }}>
      <header className="sanitario-painel-cabecalho shrink-0 border-b border-border p-5 pr-12"><div className="flex items-center gap-3"><span className="fin-section-icon"><Icone aria-hidden /></span><DialogTitle>{titulo}</DialogTitle></div><DialogDescription className="sr-only">Dados e vínculos do lançamento sanitário.</DialogDescription></header>
      <div className="sanitario-painel-conteudo min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      <footer className="sanitario-painel-rodape shrink-0 flex flex-wrap justify-end gap-3 border-t border-border p-4">{acaoRodape}<Button secondary onClick={onFechar}>Fechar</Button></footer>
    </DialogContent>
  </Dialog>;
}
