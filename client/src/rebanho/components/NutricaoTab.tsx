import { useMemo, useState } from "react";
import { useLotes, useDietas, type DietaDTO, type LoteDTO } from "../api";
import { DietaForm } from "./DietaForm";
import { LoteForm } from "./LoteForm";

const POR_PAGINA = 8;

export function NutricaoTab() {
  const { data: lotes, loading: loadingLotes, erro: erroLotes, recarregar: recarregarLotes } = useLotes();
  const { data: dietas, recarregar: recarregarDietas } = useDietas();
  const animaisAtivos = lotes.reduce((a, l) => a + l.numAnimais, 0);
  const recarregarTudo = () => { recarregarLotes(); recarregarDietas(); };

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · {animaisAtivos} {animaisAtivos === 1 ? "animal ativo" : "animais ativos"} em lotes</div>
      <div className="rb-head"><h1>Nutrição</h1></div>

      <SecaoLotes lotes={lotes} loading={loadingLotes} erro={erroLotes} recarregar={recarregarTudo} />
      <SecaoDietas dietas={dietas} recarregar={recarregarTudo} />
    </main>
  );
}

function SecaoLotes({ lotes, loading, erro, recarregar }: { lotes: LoteDTO[]; loading: boolean; erro: string | null; recarregar: () => void }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<LoteDTO | null>(null);
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(lotes.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const visiveis = useMemo(() => lotes.slice(inicio, inicio + POR_PAGINA), [lotes, inicio]);

  return (
    <section style={{ marginBottom: 36 }}>
      <div className="rb-listhead">
        <h3>Lotes</h3>
        <button className="rb-btn pri" onClick={() => setNovo(true)}>+ Novo lote</button>
      </div>
      <p className="rb-sec-sub">Cada lote agrupa animais que recebem a mesma dieta. Crie um lote, escolha a dieta e adicione os animais.</p>

      {loading ? <p className="rb-sub">Carregando…</p>
        : erro ? <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p>
        : lotes.length === 0 ? <p className="rb-empty">Nenhum lote cadastrado ainda. Clique em <b>+ Novo lote</b> para começar.</p>
        : (
          <>
            <div className="rb-tbl-wrap"><table className="rb-tbl">
              <thead><tr><th>Lote</th><th>Animais</th><th>Produção média</th><th>Dieta</th><th></th></tr></thead>
              <tbody>{visiveis.map((l) => (
                <tr key={l.id}>
                  <td className="rb-anm">{l.nome}</td>
                  <td>{l.numAnimais}</td>
                  <td>{l.producaoMedia != null ? `${l.producaoMedia} L/d` : "—"}</td>
                  <td>{l.dietaNome ?? <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="rb-btn" onClick={() => setEditando(l)}>Editar</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
            {totalPaginas > 1 && (
              <Paginacao pagina={paginaAtual} total={totalPaginas} totalItens={lotes.length} inicio={inicio + 1} fim={Math.min(inicio + POR_PAGINA, lotes.length)} onMudar={setPagina} />
            )}
          </>
        )}

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
      <div className="rb-listhead">
        <h3>Dietas</h3>
        <button className="rb-btn pri" onClick={() => setNovo(true)}>+ Nova dieta</button>
      </div>
      <p className="rb-sec-sub">Receitas de alimentação que podem ser atribuídas aos lotes.</p>

      {dietas.length === 0 ? (
        <p className="rb-empty">Nenhuma dieta cadastrada ainda.</p>
      ) : (
        <div className="rb-dcards">{dietas.map((d) => (
          <button className="rb-dcard" key={d.id} onClick={() => setEditando(d)} type="button">
            <h4>{d.nome}<span className="go">Editar →</span></h4>
            <ul>
              {d.descricao && <li>{d.descricao}</li>}
              {d.pb != null && <li>{d.pb}% PB</li>}
              {d.edMcal != null && <li>{d.edMcal} Mcal/kg</li>}
              {!d.descricao && d.pb == null && d.edMcal == null && <li style={{ color: "var(--ink-3)", fontStyle: "italic" }}>Sem detalhes nutricionais</li>}
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
    <div className="rb-pag">
      <span className="rb-pag-info">{inicio}–{fim} de {totalItens}</span>
      <span className="rb-pag-ctrl">
        <button className="rb-btn" disabled={pagina === 1} onClick={() => onMudar(pagina - 1)}>← Anterior</button>
        <span className="rb-pag-page">Página {pagina} de {total}</span>
        <button className="rb-btn" disabled={pagina === total} onClick={() => onMudar(pagina + 1)}>Próxima →</button>
      </span>
    </div>
  );
}
