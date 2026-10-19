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
  return <div className="visita-toolbar">
    {mostrarBusca && <label className="visita-campo">Buscar
      <input className="visita-busca h-auto" type="search" aria-label="Buscar participantes"
        value={busca} onChange={e => onBusca(e.target.value)} placeholder="Brinco, nome ou lote" />
    </label>}
    <div className="visita-toolbar-direita">
      <span>Rascunhos salvos ao sair do campo</span>
      <details className="visita-filtros-extras">
        <summary>Filtrar atendimentos</summary>
        <div>
          <label>Atendimento
            <select className="h-auto" value={status} onChange={e => onStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="CONFIRMADO">Confirmados</option>
              <option value="ADIADO">Adiados</option>
              <option value="NAO_ATENDIDO">Não atendidos</option>
            </select>
          </label>
          {motivosDisponiveis.map(motivo => <label key={motivo}>
            <input type="checkbox" checked={motivos.includes(motivo)}
              onChange={e => onMotivos(e.target.checked ? [...motivos, motivo] : motivos.filter(v => v !== motivo))} />
            {motivo}
          </label>)}
        </div>
      </details>
      {selecionados > 0 && <span>{selecionados} selecionados</span>}
    </div>
  </div>;
}
