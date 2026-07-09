import { Loader } from "../../components/Loading";
import { useTalhoes, useLavouras, usePlanosAdubacao } from "../api";
import { LavouraDomainView } from "./LavouraDomainView";
import { DOMAINS } from "../domains";
import { insightDaLavoura } from "../mock";
import type { ResumoTalhao, Talhao, Lavoura, PlanoAdubacao } from "../types";

export function NutricaoTab({ onRegistrarOperacao }: { onRegistrarOperacao: (talhao: Talhao) => void }) {
  const { data, loading, erro } = useTalhoes({ estado: "ATIVO" });
  const { data: lavouras } = useLavouras();
  const { data: planos } = usePlanosAdubacao();

  if (loading) return <main className="rb-main"><div className="rb-eyebrow">Lavoura</div><div className="rb-head"><h1>Nutrição & Solo</h1></div><Loader /></main>;
  if (erro) return <main className="rb-main"><div className="rb-head"><h1>Nutrição & Solo</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {erro}</p></main>;
  // Resumo real embutido em cada talhão (.resumo); filtra nulos (talhão sem resumo).
  const resumos: ResumoTalhao[] = data.map((t) => t.resumo).filter(Boolean) as ResumoTalhao[];
  const nomes = Object.fromEntries(data.map((t) => [t.id, { nome: t.nome, codigo: t.codigo }]));
  const abrir = (id: string) => { const t = data.find((x) => x.id === id); if (t) onRegistrarOperacao(t); };

  return (
    <>
      <LavouraDomainView
        key="nutricao"
        config={DOMAINS.nutricao}
        resumos={resumos}
        insight={insightDaLavoura("nutricao")}
        nomes={nomes}
        onAbrirTalhao={abrir}
        dicaLinha="clique numa linha pra registrar adubação ou amostragem"
      />
      <main className="rb-main" style={{ paddingTop: 0 }}>
        <SecaoLavouras lavouras={lavouras} />
        <SecaoPlanos planos={planos} />
      </main>
    </>
  );
}

function SecaoLavouras({ lavouras }: { lavouras: Lavoura[] }) {
  return (
    <section style={{ marginTop: 8, marginBottom: 36 }}>
      <div className="rb-listhead">
        <h3>Lavouras</h3>
        <span className="hint">{lavouras.length} {lavouras.length === 1 ? "agrupamento" : "agrupamentos"} de talhões</span>
      </div>
      <p className="rb-sec-sub">Cada lavoura agrupa talhões da mesma variedade ou plano de manejo. Crie uma lavoura, escolha o plano de adubação e adicione os talhões.</p>
      {lavouras.length === 0 ? (
        <p className="rb-empty">Nenhuma lavoura cadastrada ainda.</p>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead><tr><th>Lavoura</th><th>Talhões</th><th>Área</th><th>Variedade dominante</th><th>Produtividade</th><th>Plano de adubação</th></tr></thead>
          <tbody>{lavouras.map((l) => (
            <tr key={l.id}>
              <td className="rb-anm">{l.nome}</td>
              <td>{l.numTalhoes}</td>
              <td>{l.areaHa} ha</td>
              <td>{l.variedade ?? "—"}</td>
              <td>{l.produtividadeMedia ? `${l.produtividadeMedia} sc/ha` : <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
              <td>{l.planoAdubacaoNome ?? <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

function SecaoPlanos({ planos }: { planos: PlanoAdubacao[] }) {
  return (
    <section>
      <div className="rb-listhead">
        <h3>Planos de adubação</h3>
        <span className="hint">{planos.length} {planos.length === 1 ? "receita" : "receitas"}</span>
      </div>
      <p className="rb-sec-sub">Receitas de NPK que podem ser atribuídas a uma lavoura inteira. Valores em kg/ha/safra distribuídos nas parcelas indicadas.</p>
      {planos.length === 0 ? (
        <p className="rb-empty">Nenhum plano cadastrado.</p>
      ) : (
        <div className="rb-dcards">{planos.map((d) => (
          <div className="rb-dcard" key={d.id} style={{ cursor: "default" }}>
            <h4>{d.nome}</h4>
            <ul>
              {d.descricao && <li>{d.descricao}</li>}
              {d.nKgHa != null && <li><b>N</b>: {d.nKgHa} kg/ha · {d.parcelas ?? 4} parcelas</li>}
              {d.p2o5KgHa != null && <li><b>P₂O₅</b>: {d.p2o5KgHa} kg/ha</li>}
              {d.k2oKgHa != null && <li><b>K₂O</b>: {d.k2oKgHa} kg/ha</li>}
            </ul>
          </div>
        ))}</div>
      )}
    </section>
  );
}
