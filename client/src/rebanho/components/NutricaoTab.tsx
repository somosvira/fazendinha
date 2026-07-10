import { useMemo, useState } from "react";
import { Loader } from "../../components/Loading";
import { useLotes, useDietas, type DietaDTO, type LoteDTO } from "../api";
import { DietaForm } from "./DietaForm";
import { LoteForm } from "./LoteForm";
import { ConsumoLoteDrawer } from "./ConsumoLoteDrawer";
import { RebHeader } from "./RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebMain, RebAnm, RebEmpty, REB_SEC_SUB, REB_PAG, REB_PAG_INFO, REB_PAG_CTRL, REB_PAG_PAGE } from "@/components/rb/RebPrimitives";

const POR_PAGINA = 8;

export function NutricaoTab() {
  const { data: lotes, loading: loadingLotes, erro: erroLotes, recarregar: recarregarLotes } = useLotes();
  const { data: dietas, recarregar: recarregarDietas } = useDietas();
  const animaisAtivos = lotes.reduce((a, l) => a + l.numAnimais, 0);
  const recarregarTudo = () => { recarregarLotes(); recarregarDietas(); };

  return (
    <RebMain>
      <RebHeader eyebrow={`Rebanho · ${animaisAtivos} ${animaisAtivos === 1 ? "animal ativo" : "animais ativos"} em lotes`} title="Nutrição" />

      <SecaoLotes lotes={lotes} loading={loadingLotes} erro={erroLotes} recarregar={recarregarTudo} />
      <SecaoDietas dietas={dietas} recarregar={recarregarTudo} />
    </RebMain>
  );
}

function SecaoLotes({ lotes, loading, erro, recarregar }: { lotes: LoteDTO[]; loading: boolean; erro: string | null; recarregar: () => void }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<LoteDTO | null>(null);
  const [consumindo, setConsumindo] = useState<LoteDTO | null>(null);
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(lotes.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const visiveis = useMemo(() => lotes.slice(inicio, inicio + POR_PAGINA), [lotes, inicio]);

  return (
    <section style={{ marginBottom: 36 }}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Lotes</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo lote</RebButton>
      </div>
      <p className={REB_SEC_SUB}>Cada lote agrupa animais que recebem a mesma dieta. Crie um lote, escolha a dieta e adicione os animais.</p>

      {loading ? <Loader />
        : erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : lotes.length === 0 ? <RebEmpty>Nenhum lote cadastrado ainda. Clique em <b>+ Novo lote</b> para começar.</RebEmpty>
        : (
          <>
            <RebTable>
              <thead><tr><th>Lote</th><th>Animais</th><th>Produção média</th><th>Dieta</th><th></th></tr></thead>
              <tbody>{visiveis.map((l) => (
                <tr key={l.id}>
                  <td><RebAnm>{l.nome}</RebAnm></td>
                  <td>{l.numAnimais}</td>
                  <td>{l.producaoMedia != null ? `${l.producaoMedia} L/d` : "—"}</td>
                  <td>{l.dietaNome ?? <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <RebButton onClick={() => setConsumindo(l)} disabled={!l.dietaId} title={l.dietaId ? "Fechar consumo do período" : "Atribua uma dieta ao lote primeiro"}>Consumo</RebButton>
                    {" "}
                    <RebButton onClick={() => setEditando(l)}>Editar</RebButton>
                  </td>
                </tr>
              ))}</tbody>
            </RebTable>
            {totalPaginas > 1 && (
              <Paginacao pagina={paginaAtual} total={totalPaginas} totalItens={lotes.length} inicio={inicio + 1} fim={Math.min(inicio + POR_PAGINA, lotes.length)} onMudar={setPagina} />
            )}
          </>
        )}

      {consumindo && <ConsumoLoteDrawer lote={consumindo} onFechar={() => setConsumindo(null)} onMudou={recarregar} />}
      {novo && <LoteForm onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
      {editando && (
        <LoteForm
          lote={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); recarregar(); }}
          onExcluido={() => { setEditando(null); recarregar(); }}
        />
      )}
    </section>
  );
}

function SecaoDietas({ dietas, recarregar }: { dietas: DietaDTO[]; recarregar: () => void }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<DietaDTO | null>(null);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Dietas</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Nova dieta</RebButton>
      </div>
      <p className={REB_SEC_SUB}>Receitas de alimentação que podem ser atribuídas aos lotes.</p>

      {dietas.length === 0 ? (
        <RebEmpty>Nenhuma dieta cadastrada ainda.</RebEmpty>
      ) : (
        <div className="grid grid-cols-2 gap-3 content-start max-[900px]:grid-cols-1">{dietas.map((d) => (
          <button
            className="cursor-pointer rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-3.5 text-left font-sans hover:bg-[color:var(--bg-card-2)]"
            key={d.id}
            onClick={() => setEditando(d)}
            type="button"
          >
            <h4 className="mb-[9px] mt-0 flex items-baseline justify-between font-serif text-[17px] font-medium">{d.nome}<span className="text-sm font-semibold text-cafe">Editar →</span></h4>
            <ul className="m-0 list-none p-0">
              {d.descricao && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{d.descricao}</li>}
              {d.pb != null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{d.pb}% PB</li>}
              {d.edMcal != null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm text-ink-2 last:border-0">{d.edMcal} Mcal/kg</li>}
              {!d.descricao && d.pb == null && d.edMcal == null && <li className="border-b border-dashed border-[color:var(--rule-soft)] py-1 text-sm italic text-ink-3 last:border-0">Sem detalhes nutricionais</li>}
            </ul>
          </button>
        ))}</div>
      )}

      {novo && <DietaForm onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
      {editando && (
        <DietaForm
          dieta={editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => { setEditando(null); recarregar(); }}
          onExcluido={() => { setEditando(null); recarregar(); }}
        />
      )}
    </section>
  );
}

function Paginacao({ pagina, total, totalItens, inicio, fim, onMudar }: { pagina: number; total: number; totalItens: number; inicio: number; fim: number; onMudar: (p: number) => void }) {
  return (
    <div className={REB_PAG}>
      <span className={REB_PAG_INFO}>{inicio}–{fim} de {totalItens}</span>
      <span className={REB_PAG_CTRL}>
        <RebButton disabled={pagina === 1} onClick={() => onMudar(pagina - 1)}>← Anterior</RebButton>
        <span className={REB_PAG_PAGE}>Página {pagina} de {total}</span>
        <RebButton disabled={pagina === total} onClick={() => onMudar(pagina + 1)}>Próxima →</RebButton>
      </span>
    </div>
  );
}
