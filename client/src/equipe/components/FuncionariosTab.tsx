import { useState } from "react";
import { useFuncionarios, money, horasFmt, dateBR } from "../api";
import type { FuncionarioDTO } from "../types";
import { FuncionarioForm } from "./FuncionarioForm";

type Filtro = "ATIVOS" | "TODOS";

/* Lista de funcionários (nome/cargo/salário/jornada/ativo) + drawer de
 * cadastro/edição/baixa. Espelha o TalhaoTab (filtro + tabela + "+ Novo"). */
export function FuncionariosTab() {
  const [filtro, setFiltro] = useState<Filtro>("ATIVOS");
  const { data, loading, erro, recarregar } = useFuncionarios(filtro === "ATIVOS" ? true : undefined);
  const [form, setForm] = useState<{ modo: "novo" | "editar" | "baixa"; funcionario?: FuncionarioDTO } | null>(null);

  const controles = (
    <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
      <div className="rb-seg" style={{ display: "flex", gap: 6 }}>
        <button className="rb-btn" aria-pressed={filtro === "ATIVOS"} onClick={() => setFiltro("ATIVOS")}>Ativos</button>
        <button className="rb-btn" aria-pressed={filtro === "TODOS"} onClick={() => setFiltro("TODOS")}>Todos</button>
      </div>
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
              <th style={{ textAlign: "right" }}>Salário</th>
              <th style={{ textAlign: "right" }}>Carga/mês</th>
              <th style={{ textAlign: "right" }}>Jornada</th>
              <th>Admissão</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={8} className="rb-sub">Nenhum funcionário. Use “+ Novo funcionário”.</td></tr>
            )}
            {data.map((fn) => (
              <tr key={fn.id}>
                <td className="rb-anm">{fn.nome}</td>
                <td>{fn.cargo ?? "—"}</td>
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

      {form && (
        <FuncionarioForm
          modo={form.modo}
          funcionario={form.funcionario}
          onFechar={() => setForm(null)}
          onSalvo={() => { setForm(null); recarregar(); }}
        />
      )}
    </main>
  );
}
