import { useEffect, useMemo, useState } from "react";
import { upsertRegistroSchema } from "@rionovo/shared";
import { Loader } from "../../components/Loading";
import { useFuncionarios, useRegistros, useUpsertRegistro, preencherGrade, num, horasFmt, weekdayBR, tipoDiaPadrao, diasDoMes, mesesRecentes, mesBR } from "../api";
import type { RegistroDTO, TipoDiaPonto } from "../types";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { RebTable } from "@/components/rb/RebTable";
import { REB_INP, RebMain, RebAnm } from "@/components/rb/RebPrimitives";
import { useToast } from "@/components/Toast";
import { useOnlineStatus } from "@/lib/offline/useOnlineStatus";

const TIPOS: { k: TipoDiaPonto; lab: string }[] = [
  { k: "UTIL", lab: "Útil" },
  { k: "DOMINGO", lab: "Domingo" },
  { k: "FERIADO", lab: "Feriado" },
  { k: "FOLGA", lab: "Folga" },
  { k: "FALTA", lab: "Falta" },
];

// Estado editável de uma linha (um dia do mês). `dirty` marca o que mudou desde
// o fetch — só linhas sujas habilitam "Salvar". Volta a false após recarregar
// (o useEffect recria as linhas a partir dos registros persistidos).
interface Linha {
  data: string;             // YYYY-MM-DD
  tipoDia: string;
  entrada: string;          // "" ou "HH:MM"
  saida: string;
  intervaloMin: string;     // string p/ o input; vazio → default backend (60)
  observacao: string;
  reg: RegistroDTO | null;  // registro persistido (para exibir horas/extra computados)
  salvando: boolean;
  dirty: boolean;
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
    dirty: false,
  };
}

/* Grade de ponto do mês: seletor de funcionário + mês → uma linha por dia do
 * calendário. tipoDia é automático pelo dia-da-semana (editável). Entrada/saída/
 * intervalo/obs são editáveis; "Salvar" faz upsert e refaz o fetch. Horas e
 * extra 50/100 exibidos vêm computados do backend (RegistroDTO). */
export function PontoTab() {
  const { data: funcionarios, loading: loadFunc, erro: erroFunc } = useFuncionarios(true);
  const toast = useToast();
  const meses = useMemo(() => mesesRecentes(12), []);
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [mes, setMes] = useState<string>(meses[0]); // mais recente com dado esperado (2026-05)

  // Default: primeiro funcionário ativo.
  useEffect(() => {
    if (!funcionarioId && funcionarios.length) setFuncionarioId(funcionarios[0].id);
  }, [funcionarios, funcionarioId]);

  const { data: registros, loading, erro, recarregar } = useRegistros(funcionarioId || null, mes);
  const upsert = useUpsertRegistro();
  // upsert.pendentes é global (toda escrita de ponto pendente, de qualquer
  // funcionário/mês) — filtra pro recorte desta tela.
  const pendentes = useMemo(() => {
    const s = new Set<string>();
    for (const v of upsert.pendentes) if (v.funcionarioId === funcionarioId && v.data.slice(0, 7) === mes) s.add(v.data);
    return s;
  }, [upsert.pendentes, funcionarioId, mes]);
  const online = useOnlineStatus();

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

  // Funcionário selecionado + se tem horário padrão (habilita "Preencher grade").
  const funcSel = useMemo(() => funcionarios.find((f) => f.id === funcionarioId) ?? null, [funcionarios, funcionarioId]);
  const temPadrao = !!(funcSel?.horaEntradaPadrao && funcSel?.horaSaidaPadrao);
  const [preenchendo, setPreenchendo] = useState(false);

  // Pré-preenche os dias úteis do mês com o horário padrão do funcionário.
  // Idempotente no backend — só cria os dias faltantes; depois recarrega a grade.
  async function preencherComPadrao() {
    if (!funcionarioId || !temPadrao) return;
    const [ano, m] = mes.split("-").map(Number);
    setPreenchendo(true);
    try {
      const { criados } = await preencherGrade(funcionarioId, ano, m);
      recarregar();
      if (criados === 0) toast.info("Nada a preencher", "Os dias úteis deste mês já têm registro.");
    } catch (e: any) {
      toast.error("Erro ao preencher a grade", e?.message ?? undefined);
    } finally {
      setPreenchendo(false);
    }
  }

  // Setter: patch de campo do usuário marca dirty; toggles internos ({salvando})
  // não sujam a linha (senão o Salvar volta pra habilitado depois do submit).
  function set(i: number, patch: Partial<Linha>) {
    const chaves = Object.keys(patch) as (keyof Linha)[];
    const soInterno = chaves.every((k) => k === "salvando" || k === "reg" || k === "dirty");
    const proximoDirty = soInterno ? undefined : { dirty: true };
    setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch, ...proximoDirty } : l)));
  }

  // Offline: onSuccess/onError só rodam quando a fila (lib/offline/fila.ts)
  // sincronizar de verdade — pode ser numa sessão futura. O indicador
  // confiável de "salvo vs. pendente" é `pendentes`, não este callback.
  function salvar(i: number) {
    const l = linhas[i];
    if (!funcionarioId) return;
    const body = {
      funcionarioId,
      data: l.data,
      entrada: l.entrada || undefined,
      saida: l.saida || undefined,
      intervaloMin: l.intervaloMin !== "" ? Number(l.intervaloMin) : undefined,
      tipoDia: l.tipoDia,
      observacao: l.observacao.trim() || undefined,
    };
    // Mesmo schema Zod do backend (packages/shared) — pega erro de input
    // (ex.: intervalo negativo, observação > 400 chars) antes de enfileirar.
    const valido = upsertRegistroSchema.safeParse(body);
    if (!valido.success) {
      toast.error("Corrija antes de salvar", valido.error.issues[0]?.message);
      return;
    }
    set(i, { salvando: true, dirty: false });
    upsert.mutate(
      body,
      {
        onSuccess: () => set(i, { salvando: false }),
        onError: (e: any) => {
          toast.error("Erro ao salvar o ponto", e?.message ?? undefined);
          set(i, { salvando: false, dirty: true });
        },
      },
    );
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Equipe · Ponto" title="Ponto" />

      <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
        <label className="text-[13px] text-ink-3">Funcionário</label>
        <ToolbarSelect
          value={funcionarioId}
          onChange={setFuncionarioId}
          ariaLabel="Escolher funcionário"
          options={[
            ...(loadFunc ? [{ value: "", label: "Carregando…" }] : []),
            // Distingue "sem funcionário ativo" (dado real) de "não deu pra
            // carregar" (offline sem cache prévio) — senão parece que a
            // fazenda não tem ninguém ativo quando na verdade é falta de rede.
            ...(!loadFunc && erroFunc && funcionarios.length === 0 ? [{ value: "", label: "Sem conexão e sem dado salvo neste aparelho" }] : []),
            ...(!loadFunc && !erroFunc && funcionarios.length === 0 ? [{ value: "", label: "Nenhum funcionário ativo" }] : []),
            ...funcionarios.map((f) => ({ value: String(f.id), label: `${f.nome}${f.cargo ? ` · ${f.cargo}` : ""}` })),
          ]}
        />
        <label className="text-[13px] text-ink-3">Mês</label>
        <ToolbarSelect
          value={mes}
          onChange={setMes}
          ariaLabel="Escolher mês"
          options={meses.map((m) => ({ value: m, label: mesBR(m) }))}
        />

        <RebButton
          disabled={!funcionarioId || !temPadrao || preenchendo || loading || !online}
          title={!online
            ? "Precisa de conexão — cria vários lançamentos de uma vez, não dá pra enfileirar como um só (diferente do Salvar por linha)"
            : temPadrao
              ? "Cria os dias úteis do mês com o horário padrão do funcionário (não sobrescreve dias já lançados)"
              : "Defina o horário padrão do funcionário (Entrada/Saída padrão no cadastro) para usar isto"}
          onClick={preencherComPadrao}
        >
          {preenchendo ? "Preenchendo…" : "Preencher grade com horário padrão"}
        </RebButton>

        <div className="ml-auto flex items-center gap-4 text-sm text-ink-3">
          {!online && <span className="text-[13px] text-atencao">Sem conexão — lançamentos ficam salvos no aparelho até sincronizar</span>}
          {pendentes.size > 0 && (
            <span className="text-[13px] text-atencao">{pendentes.size} pendente{pendentes.size > 1 ? "s" : ""} de sincronização</span>
          )}
          <span>Horas: <b>{horasFmt(totais.horas)}</b></span>
          <span>Extra 50%: <b>{num(totais.extra50, 1)} h</b></span>
          <span>Extra 100%: <b>{num(totais.extra100, 1)} h</b></span>
        </div>
      </div>

      {!funcionarioId ? (
        <p className="text-sm text-ink-3">Selecione um funcionário para lançar a jornada.</p>
      ) : erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar os registros: {erro}</p>
      ) : !online && loading ? (
        // Offline + `loading` ainda true: a query nunca chegou a tentar o
        // fetch (fica pausada até voltar a conexão) — sem isso o usuário via
        // um <Loader/> girando pra sempre, indistinguível de "carregando
        // rápido", num mês/funcionário nunca visitado antes deste aparelho.
        <p className="text-sm text-atencao">Sem conexão e sem dado salvo pra este mês neste aparelho. Troque pra um mês já visitado online, ou conecte pra buscar.</p>
      ) : loading ? (
        <Loader />
      ) : (
        <RebTable>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th className="text-right">Interv. (min)</th>
              <th className="text-right">Horas</th>
              <th className="text-right">Extra 50%</th>
              <th className="text-right">Extra 100%</th>
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
                  <td className="whitespace-nowrap"><RebAnm>{dia} <small className="text-ink-3">{dow}</small></RebAnm></td>
                  <td>
                    <ToolbarSelect
                      value={l.tipoDia}
                      onChange={(v) => set(i, { tipoDia: v })}
                      ariaLabel="Tipo do dia"
                      options={TIPOS.map((t) => ({ value: t.k, label: t.lab }))}
                    />
                  </td>
                  <td><input className={REB_INP} type="time" value={l.entrada} onChange={(e) => set(i, { entrada: e.target.value })} style={{ width: 108 }} /></td>
                  <td><input className={REB_INP} type="time" value={l.saida} onChange={(e) => set(i, { saida: e.target.value })} style={{ width: 108 }} /></td>
                  <td className="text-right">
                    <input className={REB_INP} type="number" step="5" value={l.intervaloMin} placeholder={funcSel?.intervaloPadraoMin != null ? String(funcSel.intervaloPadraoMin) : "60"} onChange={(e) => set(i, { intervaloMin: e.target.value })} style={{ width: 78, textAlign: "right" }} />
                  </td>
                  <td className="text-right">{l.reg ? horasFmt(l.reg.horas) : "—"}</td>
                  <td className="text-right">{l.reg && l.reg.extra50 > 0 ? `${num(l.reg.extra50, 1)} h` : "—"}</td>
                  <td className="text-right">{l.reg && l.reg.extra100 > 0 ? `${num(l.reg.extra100, 1)} h` : "—"}</td>
                  <td><input className={REB_INP} value={l.observacao} onChange={(e) => set(i, { observacao: e.target.value })} placeholder="—" style={{ width: 140 }} /></td>
                  <td>
                    {pendentes.has(l.data)
                      ? <span className="text-[13px] text-atencao" title="Aguardando conexão pra sincronizar com o servidor">Pendente…</span>
                      : <RebButton disabled={l.salvando || !l.dirty} onClick={() => salvar(i)}>{l.salvando ? "…" : "Salvar"}</RebButton>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </RebTable>
      )}
    </RebMain>
  );
}
