import { useEffect, useMemo, useState } from "react";
import { useFuncionarios, useRegistros, upsertRegistro, num, horasFmt, weekdayBR, tipoDiaPadrao, diasDoMes, mesesRecentes, mesBR } from "../api";
import type { RegistroDTO, TipoDiaPonto } from "../types";

const TIPOS: { k: TipoDiaPonto; lab: string }[] = [
  { k: "UTIL", lab: "Útil" },
  { k: "DOMINGO", lab: "Domingo" },
  { k: "FERIADO", lab: "Feriado" },
  { k: "FOLGA", lab: "Folga" },
  { k: "FALTA", lab: "Falta" },
];

// Estado editável de uma linha (um dia do mês). `dirty` marca o que mudou desde
// o fetch — só linhas sujas habilitam "Salvar".
interface Linha {
  data: string;             // YYYY-MM-DD
  tipoDia: string;
  entrada: string;          // "" ou "HH:MM"
  saida: string;
  intervaloMin: string;     // string p/ o input; vazio → default backend (60)
  observacao: string;
  reg: RegistroDTO | null;  // registro persistido (para exibir horas/extra computados)
  salvando: boolean;
}

// Monta a linha inicial de um dia: usa o registro existente, senão o padrão
// (tipoDia automático pelo dia-da-semana — domingo → DOMINGO, senão UTIL).
function linhaInicial(data: string, reg: RegistroDTO | null): Linha {
  return {
    data,
    tipoDia: reg?.tipoDia ?? tipoDiaPadrao(data),
    entrada: reg?.entrada ?? "",
    saida: reg?.saida ?? "",
    intervaloMin: reg ? String(reg.intervaloMin) : "",
    observacao: reg?.observacao ?? "",
    reg,
    salvando: false,
  };
}

/* Grade de ponto do mês: seletor de funcionário + mês → uma linha por dia do
 * calendário. tipoDia é automático pelo dia-da-semana (editável). Entrada/saída/
 * intervalo/obs são editáveis; "Salvar" faz upsert e refaz o fetch. Horas e
 * extra 50/100 exibidos vêm computados do backend (RegistroDTO). */
export function PontoTab() {
  const { data: funcionarios, loading: loadFunc } = useFuncionarios(true);
  const meses = useMemo(() => mesesRecentes(12), []);
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [mes, setMes] = useState<string>(meses[0]); // mais recente com dado esperado (2026-05)

  // Default: primeiro funcionário ativo.
  useEffect(() => {
    if (!funcionarioId && funcionarios.length) setFuncionarioId(funcionarios[0].id);
  }, [funcionarios, funcionarioId]);

  const { data: registros, loading, erro, recarregar } = useRegistros(funcionarioId || null, mes);

  // Grade = todos os dias do mês, com o registro casado por data.
  const [linhas, setLinhas] = useState<Linha[]>([]);
  useEffect(() => {
    const porData = new Map(registros.map((r) => [r.data, r]));
    setLinhas(diasDoMes(mes).map((d) => linhaInicial(d, porData.get(d) ?? null)));
  }, [registros, mes]);

  // Totais do mês — somados sobre os registros persistidos (valores já computados).
  const totais = useMemo(() => registros.reduce(
    (a, r) => ({ horas: a.horas + r.horas, extra50: a.extra50 + r.extra50, extra100: a.extra100 + r.extra100 }),
    { horas: 0, extra50: 0, extra100: 0 },
  ), [registros]);

  function set(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  }

  async function salvar(i: number) {
    const l = linhas[i];
    if (!funcionarioId) return;
    set(i, { salvando: true });
    try {
      await upsertRegistro({
        funcionarioId,
        data: l.data,
        entrada: l.entrada || undefined,
        saida: l.saida || undefined,
        intervaloMin: l.intervaloMin !== "" ? Number(l.intervaloMin) : undefined,
        tipoDia: l.tipoDia,
        observacao: l.observacao.trim() || undefined,
      });
      recarregar(); // refaz o fetch → re-hidrata a grade com horas/extra computados
    } catch (e: any) {
      alert(e?.message ?? "Erro ao salvar o ponto.");
      set(i, { salvando: false });
    }
  }

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Equipe · Ponto</div>
      <div className="rb-head"><h1>Ponto</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0 0 18px" }}>
        <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Funcionário</label>
        <select className="rb-select" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
          {loadFunc && <option value="">Carregando…</option>}
          {!loadFunc && funcionarios.length === 0 && <option value="">Nenhum funcionário ativo</option>}
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` · ${f.cargo}` : ""}</option>
          ))}
        </select>
        <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Mês</label>
        <select className="rb-select" value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{mesBR(m)}</option>)}
        </select>

        <div className="rb-sub" style={{ margin: 0, marginLeft: "auto", display: "flex", gap: 16 }}>
          <span>Horas: <b>{horasFmt(totais.horas)}</b></span>
          <span>Extra 50%: <b>{num(totais.extra50, 1)} h</b></span>
          <span>Extra 100%: <b>{num(totais.extra100, 1)} h</b></span>
        </div>
      </div>

      {!funcionarioId ? (
        <p className="rb-sub">Selecione um funcionário para lançar a jornada.</p>
      ) : erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar os registros: {erro}</p>
      ) : loading ? (
        <p className="rb-sub">Carregando…</p>
      ) : (
        <div className="rb-tbl-wrap"><table className="rb-tbl">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th style={{ textAlign: "right" }}>Interv. (min)</th>
              <th style={{ textAlign: "right" }}>Horas</th>
              <th style={{ textAlign: "right" }}>Extra 50%</th>
              <th style={{ textAlign: "right" }}>Extra 100%</th>
              <th>Obs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const dow = weekdayBR(l.data);
              const dia = l.data.split("-")[2];
              const domingo = tipoDiaPadrao(l.data) === "DOMINGO";
              return (
                <tr key={l.data} style={domingo ? { background: "var(--wash, transparent)" } : undefined}>
                  <td className="rb-anm" style={{ whiteSpace: "nowrap" }}>{dia} <small style={{ color: "var(--ink-3)" }}>{dow}</small></td>
                  <td>
                    <select className="rb-select" value={l.tipoDia} onChange={(e) => set(i, { tipoDia: e.target.value })}>
                      {TIPOS.map((t) => <option key={t.k} value={t.k}>{t.lab}</option>)}
                    </select>
                  </td>
                  <td><input type="time" value={l.entrada} onChange={(e) => set(i, { entrada: e.target.value })} style={{ width: 96 }} /></td>
                  <td><input type="time" value={l.saida} onChange={(e) => set(i, { saida: e.target.value })} style={{ width: 96 }} /></td>
                  <td style={{ textAlign: "right" }}>
                    <input type="number" step="5" value={l.intervaloMin} placeholder="60" onChange={(e) => set(i, { intervaloMin: e.target.value })} style={{ width: 70, textAlign: "right" }} />
                  </td>
                  <td style={{ textAlign: "right" }}>{l.reg ? horasFmt(l.reg.horas) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{l.reg && l.reg.extra50 > 0 ? `${num(l.reg.extra50, 1)} h` : "—"}</td>
                  <td style={{ textAlign: "right" }}>{l.reg && l.reg.extra100 > 0 ? `${num(l.reg.extra100, 1)} h` : "—"}</td>
                  <td><input value={l.observacao} onChange={(e) => set(i, { observacao: e.target.value })} placeholder="—" style={{ width: 120 }} /></td>
                  <td><button className="rb-btn" disabled={l.salvando} onClick={() => salvar(i)}>{l.salvando ? "…" : "Salvar"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}
    </main>
  );
}
