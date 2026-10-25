import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./consultas-leite.css";
export function DialogConsultaLeite({ titulo, children, className = "" }: { titulo: ReactNode; children: ReactNode; className?: string; inicialmenteAberto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return <><Button type="button" variant="outline" onClick={() => setAberto(true)}>{titulo}</Button><Dialog open={aberto} onOpenChange={setAberto}><DialogContent className={`leite-consulta-dialog ${className}`} aria-describedby={undefined}><DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>{children}</DialogContent></Dialog></>;
}
