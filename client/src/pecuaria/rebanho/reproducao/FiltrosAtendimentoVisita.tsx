import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FiltrosAtendimentoVisitaProps = {
  busca: string;
  onBusca: (valor: string) => void;
  mostrarBusca: boolean;
  status: string;
  onStatus: (valor: string) => void;
  motivos: string[];
  motivosDisponiveis: string[];
  onMotivos: (valores: string[]) => void;
  selecionados: number;
};

/** Os filtros continuam acessíveis tanto na lista quanto no atendimento aberto. */
export function FiltrosAtendimentoVisita({
  busca, onBusca, mostrarBusca, status, onStatus,
  motivos, motivosDisponiveis, onMotivos, selecionados,
}: FiltrosAtendimentoVisitaProps) {
  const [aberto, setAberto] = useState(false);
  const quantidade = Number(!!status) + motivos.length;
  return <div className="visita-toolbar">
    {mostrarBusca && <label className="visita-campo">Buscar
      <input className="visita-busca h-auto" type="search" aria-label="Buscar participantes"
        value={busca} onChange={e => onBusca(e.target.value)} placeholder="Brinco, nome ou lote" />
    </label>}
    <div className="visita-toolbar-direita">
      <span>Rascunhos salvos ao sair do campo</span>
      <Button variant="outline" onClick={() => setAberto(true)}><SlidersHorizontal size={18} aria-hidden/>Filtrar atendimentos{quantidade > 0 && <span aria-label={`${quantidade} filtros ativos`}>({quantidade})</span>}</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader><DialogTitle>Filtrar atendimentos</DialogTitle></DialogHeader>
        <div className="grid gap-4 text-base">
          <label className="grid gap-2">Atendimento
            <select className="h-auto min-h-11 rounded-lg border border-border bg-background px-3" value={status} onChange={e => onStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="CONFIRMADO">Confirmados</option>
              <option value="ADIADO">Adiados</option>
              <option value="NAO_ATENDIDO">Não atendidos</option>
            </select>
          </label>
          {motivosDisponiveis.map(motivo => <label key={motivo} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={motivos.includes(motivo)}
              onChange={e => onMotivos(e.target.checked ? [...motivos, motivo] : motivos.filter(v => v !== motivo))} />
            {motivo}
          </label>)}
        </div>
          <DialogFooter><Button onClick={() => setAberto(false)}>Concluir filtros</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {selecionados > 0 && <span>{selecionados} selecionados</span>}
    </div>
  </div>;
}
