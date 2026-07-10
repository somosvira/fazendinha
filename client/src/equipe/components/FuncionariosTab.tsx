import { useMemo, useState } from "react";
import { Loader } from "../../components/Loading";
import { useFuncionarios, useCustoMOSetor, money, horasFmt, dateBR } from "../api";
import type { FuncionarioDTO } from "../types";
import { FuncionarioForm } from "./FuncionarioForm";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebAnm, RebPill } from "@/components/rb/RebPrimitives";

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
    <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
      <div className="flex gap-1.5">
        <RebButton aria-pressed={filtro === "ATIVOS"} onClick={() => setFiltro("ATIVOS")}>Ativos</RebButton>
        <RebButton aria-pressed={filtro === "TODOS"} onClick={() => setFiltro("TODOS")}>Todos</RebButton>
      </div>
      <label className="text-[13px] text-ink-3">Setor</label>
      <ToolbarSelect
        value={setorSel}
        onChange={setSetorSel}
        ariaLabel="Filtrar por setor"
        options={[{ value: "", label: "Todos os setores" }, ...setores.map((s) => ({ value: s, label: s }))]}
      />
      <RebButton variant="pri" className="ml-auto" onClick={() => setForm({ modo: "novo" })}>+ Novo funcionário</RebButton>
    </div>
  );

  return (
    <RebMain>
      <RebHeader eyebrow="Equipe · Funcionários" title="Funcionários" />
      {controles}

      {erro ? (
        <p className="text-sm text-prejuizo">Não foi possível carregar: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : (
        <RebTable>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cargo</th>
              <th>Setor</th>
              <th className="text-right">Salário</th>
              <th className="text-right">Carga/mês</th>
              <th className="text-right">Jornada</th>
              <th>Admissão</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={9} className="text-sm text-ink-3">
                {setorSel ? `Nenhum funcionário no setor ${setorSel}.` : "Nenhum funcionário. Use “+ Novo funcionário”."}
              </td></tr>
            )}
            {linhas.map((fn) => (
              <tr key={fn.id}>
                <td><RebAnm>{fn.nome}</RebAnm></td>
                <td>{fn.cargo ?? "—"}</td>
                <td><RebPill>{setorLabel(fn)}</RebPill></td>
                <td className="text-right">{money(fn.salarioMensal)}</td>
                <td className="text-right">{horasFmt(fn.cargaMensalHoras)}</td>
                <td className="text-right">{horasFmt(fn.jornadaDiariaHoras)}</td>
                <td>{dateBR(fn.dataAdmissao)}</td>
                <td>
                  <RebPill tone={fn.ativo ? "ok" : "bad"}>{fn.ativo ? "Ativo" : "Baixado"}</RebPill>
                </td>
                <td className="whitespace-nowrap">
                  <RebButton onClick={() => setForm({ modo: "editar", funcionario: fn })}>Editar</RebButton>
                  {fn.ativo && (
                    <RebButton className="ml-1.5" onClick={() => setForm({ modo: "baixa", funcionario: fn })}>Baixar</RebButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}

      {/* Custo de mão de obra por setor — só ativos; sem setor → "Geral". Número
          disponível para a gestão; ainda NÃO amarrado ao custo dos módulos. */}
      <section className="mt-7">
        <h2 className="font-serif text-lg font-medium">Custo de mão de obra por setor</h2>
        <p className="mt-0.5 mb-3 text-xs text-ink-3">
          Soma dos salários mensais dos funcionários ativos, agrupada por setor. Não inclui hora extra.
        </p>
        {custo.erro ? (
          <p className="text-sm text-prejuizo">Não foi possível carregar: {custo.erro}</p>
        ) : custo.loading ? (
          <Loader />
        ) : custo.data.length === 0 ? (
          <p className="text-sm text-ink-3">Nenhum funcionário ativo.</p>
        ) : (
          <RebTable wrapClassName="max-w-[520px]">
            <thead>
              <tr>
                <th>Setor</th>
                <th className="text-right">Funcionários</th>
                <th className="text-right">Custo mensal</th>
              </tr>
            </thead>
            <tbody>
              {custo.data.map((c) => (
                <tr key={c.setor}>
                  <td><RebPill>{c.setor}</RebPill></td>
                  <td className="text-right">{c.qtd}</td>
                  <td className="text-right">{money(c.totalMensal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>Total</td>
                <td className="text-right">{custo.data.reduce((s, c) => s + c.qtd, 0)}</td>
                <td className="text-right">{money(custo.data.reduce((s, c) => s + c.totalMensal, 0))}</td>
              </tr>
            </tfoot>
          </RebTable>
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
    </RebMain>
  );
}
