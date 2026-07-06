import { useMemo, useState } from "react";
import { useFuncionarios, useCustoMOSetor, money, horasFmt, dateBR } from "../api";
import type { FuncionarioDTO } from "../types";
import { FuncionarioForm } from "./FuncionarioForm";

type Filtro = "ATIVOS" | "TODOS";

// Sem setor cadastrado → "Geral" na exibição/filtro (mesma borda do backend).
const setorLabel = (fn: FuncionarioDTO) => fn.setor ?? "Geral";

/* Lista de funcionários (nome/cargo/setor/salário/jornada/ativo) + drawer de
 * cadastro/edição/baixa + bloco de Custo de MO por setor. Espelha o TalhaoTab
 * (filtro + tabela + "+ Novo"). */
export function FuncionariosTab() {
  const [filtro, setFiltro] = useState<Filtro>("ATIVOS");
  const [setorSel, setSetorSel] = useState<string>(""); // "" = todos os setores
  const { data, loading, erro, recarregar } = useFuncionarios(filtro === "ATIVOS" ? true : undefined);
  const custo = useCustoMOSetor();
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; funcionario?: FuncionarioDTO } | null>(null);

  // Setores presentes no quadro atual (para o select). Filtro é client-side —
  // as opções refletem a lista carregada (Ativos/Todos), sem opção "fantasma".
  const setores = useMemo(
    () => Array.from(new Set(data.map(setorLabel))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data]
  );
  const linhas = useMemo(
    () => (setorSel ? data.filter((fn) => setorLabel(fn) === setorSel) : data),
    [data, setorSel]
  );

  // Recarrega lista + custo por setor após salvar/baixar (o custo depende do quadro ativo).
  const aposSalvar = () => { setForm(null); recarregar(); custo.recarregar(); };

  const controles = (
    <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
      <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
        <button className="rb-btn" aria-pressed={filtro === "ATIVOS"} onClick={() => setFiltro("ATIVOS")}>Ativos</button>
        <button className="rb-btn" aria-pressed={filtro === "TODOS"} onClick={() => setFiltro("TODOS")}>Todos</button>
      </div>
      <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Setor</label>
      <select className="rb-select" value={setorSel} onChange={(e) => setSetorSel(e.target.value)}>
        <option value="">Todos os setores</option>
        {setores.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="rb-btn pri" style={{ marginLeft: "auto" }} onClick={() => setForm({ modo: "novo" })}>+ Novo funcionário</button>
    </div>
  );

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Equipe · Funcionários</div>
      <div className="rb-head"><h1>Funcionários</h1></div>
      {controles}

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar: {erro}</p>
      ) : loading ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cargo</th>
              <th>Setor</th>
              <th style={{ textAlign: "right" }}>Salário</th>
              <th style={{ textAlign: "right" }}>Carga/mês</th>
              <th style={{ textAlign: "right" }}>Jornada</th>
              <th>Admissão</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={9} className="rb-sub">
                {setorSel ? `Nenhum funcionário no setor ${setorSel}.` : "Nenhum funcionário. Use “+ Novo funcionário”."}
              </td></tr>
            )}
            {linhas.map((fn) => (
              <tr key={fn.id}>
                <td className="rb-anm">{fn.nome}</td>
                <td>{fn.cargo ?? "—"}</td>
                <td><span className="rb-pill">{setorLabel(fn)}</span></td>
                <td style={{ textAlign: "right" }}>{money(fn.salarioMensal)}</td>
                <td style={{ textAlign: "right" }}>{horasFmt(fn.cargaMensalHoras)}</td>
                <td style={{ textAlign: "right" }}>{horasFmt(fn.jornadaDiariaHoras)}</td>
                <td>{dateBR(fn.dataAdmissao)}</td>
                <td>
                  <span className={"rb-pill" + (fn.ativo ? " ok" : " bad")}>{fn.ativo ? "Ativo" : "Baixado"}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="rb-btn" onClick={() => setForm({ modo: "editar", funcionario: fn })}>Editar</button>
                  {fn.ativo && (
                    <button className="rb-btn" style={{ marginLeft: 6 }} onClick={() => setForm({ modo: "baixa", funcionario: fn })}>Baixar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {/* Custo de mão de obra por setor — só ativos; sem setor → "Geral". Número
          disponível para a gestão; ainda NÃO amarrado ao custo dos módulos. */}
      <section style={{ marginTop: 28 }}>
        <div className="rb-head"><h2 style={{ fontSize: 18 }}>Custo de mão de obra por setor</h2></div>
        <p className="rb-sub" style={{ margin: "2px 0 12px", fontSize: 12 }}>
          Soma dos salários mensais dos funcionários ativos, agrupada por setor. Não inclui hora extra.
        </p>
        {custo.erro ? (
          <p className="rb-sub" style={{ color: "var(--neg)" }}>Não foi possível carregar: {custo.erro}</p>
        ) : custo.loading ? (
          <p className="rb-sub">Carregando…</p>
        ) : custo.data.length === 0 ? (
          <p className="rb-sub">Nenhum funcionário ativo.</p>
        ) : (
          <div className="rb-tbl-wrap" style={{ maxWidth: 520 }}><table className="rb-tbl">
            <thead>
              <tr>
                <th>Setor</th>
                <th style={{ textAlign: "right" }}>Funcionários</th>
                <th style={{ textAlign: "right" }}>Custo mensal</th>
              </tr>
            </thead>
            <tbody>
              {custo.data.map((c) => (
                <tr key={c.setor}>
                  <td><span className="rb-pill">{c.setor}</span></td>
                  <td style={{ textAlign: "right" }}>{c.qtd}</td>
                  <td style={{ textAlign: "right" }}>{money(c.totalMensal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td>
                <td style={{ textAlign: "right" }}>{custo.data.reduce((s, c) => s + c.qtd, 0)}</td>
                <td style={{ textAlign: "right" }}>{money(custo.data.reduce((s, c) => s + c.totalMensal, 0))}</td>
              </tr>
            </tfoot>
          </table></div>
        )}
      </section>

      {form && (
        <FuncionarioForm
          modo={form.modo}
          funcionario={form.funcionario}
          onFechar={() => setForm(null)}
          onSalvo={aposSalvar}
        />
      )}
    </main>
  );
}
