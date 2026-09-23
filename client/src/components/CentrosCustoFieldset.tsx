// Rio Novo — fieldset reutilizável de centros de custo (checkboxes), usado no
// cadastro de Produto (`financeiro/FormProduto.tsx`, único formulário desde a
// unificação). `ativo` é opcional porque algumas listagens só trazem centros ativos.

export interface CentroCustoOpcao {
  id: number;
  nome: string;
  ativo?: boolean;
}

export function CentrosCustoFieldset({
  centros,
  selecionados,
  onToggle,
  erro,
  ajuda,
  idBase = "centros-custo",
}: {
  centros: CentroCustoOpcao[];
  selecionados: Set<number>;
  onToggle: (id: number) => void;
  erro?: string;
  ajuda?: string;
  idBase?: string;
}) {
  const ajudaId = `${idBase}-ajuda`;
  const erroId = `${idBase}-erro`;

  return (
    <fieldset
      className="rounded-lg border border-border p-3"
      aria-describedby={erro ? erroId : ajuda ? ajudaId : undefined}
    >
      <legend className="px-1 text-sm font-medium">Centros de custo</legend>
      {ajuda && <p id={ajudaId} className="mb-3 text-xs text-ink-3">{ajuda}</p>}
      <div className="grid max-h-48 gap-2 overflow-y-auto">
        {centros.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum centro de custo cadastrado.</p>
        ) : (
          centros
            .filter((c) => c.ativo !== false || selecionados.has(c.id))
            .map((centro) => (
              <label key={centro.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selecionados.has(centro.id)}
                  disabled={centro.ativo === false}
                  onChange={() => onToggle(centro.id)}
                />{" "}
                <span>{centro.nome}{centro.ativo === false ? " (inativo)" : ""}</span>
              </label>
            ))
        )}
      </div>
      {erro && <p id={erroId} role="alert" className="mt-2 text-xs text-red-700">{erro}</p>}
    </fieldset>
  );
}
