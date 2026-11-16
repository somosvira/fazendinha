import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { SelectCampo } from "@/financeiro/SelectCampo";

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
  acoes?: ReactNode;
};

/** Os filtros continuam acessíveis tanto na lista quanto no atendimento aberto. */
export function FiltrosAtendimentoVisita({
  busca, onBusca, mostrarBusca, status, onStatus,
  motivos, motivosDisponiveis, onMotivos, selecionados, acoes,
}: FiltrosAtendimentoVisitaProps) {
  const [rascunho, setRascunho] = useState<{ status: string; motivos: string[] } | null>(null);
  const quantidade = Number(!!status) + motivos.length;
  return <div className="visita-toolbar">
    {mostrarBusca && <label className="visita-campo">Buscar
      <input className="visita-busca h-auto" type="search" aria-label="Buscar participantes"
        value={busca} onChange={e => onBusca(e.target.value)} placeholder="Brinco, nome ou lote" />
    </label>}
    <div className="visita-toolbar-direita">
      {selecionados > 0 && <span role="status" className="rounded-md bg-muted px-2 py-1">{selecionados} selecionados</span>}
      {acoes}
      <Button variant="outline" onClick={() => setRascunho({ status, motivos })}><SlidersHorizontal size={18} aria-hidden/>Filtrar atendimentos{quantidade > 0 && <span aria-label={`${quantidade} filtros ativos`}>({quantidade})</span>}</Button>
      {rascunho && <PainelCadastro aberto compacto titulo="Filtrar atendimentos" rascunhoPersistido onFechar={() => setRascunho(null)}
        rodape={<>
          <Button variant="ghost" className="sm:mr-auto" disabled={!rascunho.status && !rascunho.motivos.length} onClick={() => setRascunho({ status: "", motivos: [] })}>Limpar</Button>
          <Button variant="outline" onClick={() => setRascunho(null)}>Cancelar</Button>
          <Button onClick={() => { onStatus(rascunho.status); onMotivos(rascunho.motivos); setRascunho(null); }}>Concluir filtros</Button>
        </>}>
        <div className="grid gap-4 text-base">
          <label className="grid gap-2">Atendimento
            <SelectCampo className="h-auto min-h-11 rounded-lg border border-border bg-background px-3" value={rascunho.status} onValueChange={valor => setRascunho({ ...rascunho, status: valor })}>
              <option value="">Todos</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="CONFIRMADO">Confirmados</option>
              <option value="ADIADO">Adiados</option>
              <option value="NAO_ATENDIDO">Não atendidos</option>
            </SelectCampo>
          </label>
          {motivosDisponiveis.map(motivo => <label key={motivo} className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={rascunho.motivos.includes(motivo)}
              onChange={e => setRascunho({ ...rascunho, motivos: e.target.checked ? [...rascunho.motivos, motivo] : rascunho.motivos.filter(v => v !== motivo) })} />
            {motivo}
          </label>)}
        </div>
      </PainelCadastro>}
    </div>
  </div>;
}
