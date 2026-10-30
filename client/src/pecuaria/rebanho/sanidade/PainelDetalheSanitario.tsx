import { Activity, CalendarDays, ClipboardList, FlaskConical, Syringe } from "lucide-react";
import "./detalhe-sanitario.css";
import { useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../financeiro/financeiro-ui";

export function PainelDetalheSanitario({ onFechar, children, tipo }: { onFechar: () => void; children: ReactNode; tipo?: string }) {
  const titulo = ({ ocorrencia: "Ocorrência sanitária", aplicacao: "Aplicação sanitária", exame: "Exame do animal", protocolo: "Execução de protocolo", tarefa: "Tarefa sanitária", rodada: "Ciclo sanitário" } as Record<string, string>)[tipo ?? ""] ?? "Detalhe sanitário";
  const Icone = tipo === "exame" ? FlaskConical : tipo === "aplicacao" ? Syringe : tipo === "rodada" || tipo === "tarefa" ? CalendarDays : tipo === "protocolo" ? ClipboardList : Activity;
  const origem = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return <Dialog open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
    <DialogContent overlayClassName="z-[1100]" className="painel-detalhe-sanitario z-[1100] max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl" onCloseAutoFocus={(evento) => {
      if (origem.current?.isConnected) { evento.preventDefault(); origem.current.focus(); }
    }}>
      <header className="sanitario-painel-cabecalho border-b border-border p-5 pr-12"><div className="flex items-center gap-3"><span className="fin-section-icon"><Icone aria-hidden /></span><DialogTitle>{titulo}</DialogTitle></div><DialogDescription className="sr-only">Dados e vínculos do lançamento sanitário.</DialogDescription></header>
      <div className="sanitario-painel-conteudo min-h-0 overflow-y-auto p-5">{children}</div>
      <footer className="flex justify-end border-t border-border p-4"><Button secondary onClick={onFechar}>Voltar à lista</Button></footer>
    </DialogContent>
  </Dialog>;
}
