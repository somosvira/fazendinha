import { useState } from "react";
import {
  aplicarAptidaoAutomatica,
  registrarAptidao,
  useAptidoes,
  useSugestoesAptidao,
} from "../api";
import type { Animal } from "../types";
import { getHojeISO } from "../../lib/hoje";
import { RebButton } from "@/components/rb/RebButton";
import { RebBox, RebEmpty, RebPill } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import { RebSelect } from "@/components/rb/RebSelect";
import { SelectBusca } from "@/components/SelectBusca";
import { CampoData } from "@/components/CampoData";

// Visual em caixa dos campos desta faixa, aplicado aos gatilhos estilizados.
const CAIXA = "rounded border border-[color:var(--rule-soft)] bg-card px-2 py-1.5 text-sm text-foreground";

const fmtData = (data: string) => new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-BR");

export function AptidaoSection({
  novilhas = [],
  idadeMinMeses = 13,
  pesoMinKg = 320,
}: {
  novilhas?: Animal[];
  idadeMinMeses?: number;
  pesoMinKg?: number;
}) {
  const { data: sugestoes, loading, erro, recarregar } = useSugestoesAptidao();
  const [animalId, setAnimalId] = useState<string>("");
  const historico = useAptidoes(animalId || null);
  const [data, setData] = useState(getHojeISO());
  const [apta, setApta] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  async function aplicarAutomaticas() {
    setSalvando(true); setErroAcao(null); setMensagem(null);
    try {
      const resultado = await aplicarAptidaoAutomatica(getHojeISO());
      setMensagem(`${resultado.aplicadas} aptidão(ões) registrada(s) · ${resultado.ignoradas} já existente(s).`);
      recarregar();
      historico.recarregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível aplicar as aptidões.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarManual(e: React.FormEvent) {
    e.preventDefault();
    if (!animalId || !data) return;
    setSalvando(true); setErroAcao(null); setMensagem(null);
    try {
      await registrarAptidao(animalId, { data, apta, motivo: motivo.trim() || undefined });
      setMensagem("Decisão manual registrada no histórico da novilha.");
      setMotivo("");
      historico.recarregar();
      recarregar();
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : "Não foi possível registrar a aptidão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebBox className="relative overflow-hidden border-l-[3px] border-l-[color:var(--leite)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="mb-1 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Aptidão de novilhas</h4>
          <p className="m-0 text-sm text-ink-3">
            Entrada na reprodução a partir de <b className="text-ink-2">{idadeMinMeses} meses</b> e <b className="text-ink-2">{pesoMinKg} kg</b>.
          </p>
        </div>
        <RebButton variant="pri" disabled={salvando || loading || (sugestoes?.length ?? 0) === 0} onClick={aplicarAutomaticas}>
          {salvando ? "Aplicando…" : `Aplicar aptas (${sugestoes?.length ?? 0})`}
        </RebButton>
      </div>

      {loading ? (
        <p className="text-sm text-ink-3">Carregando candidatas…</p>
      ) : erro ? (
        <p className="text-sm text-prejuizo">{erro}</p>
      ) : (sugestoes?.length ?? 0) === 0 ? (
        <RebEmpty>Nenhuma novilha atingiu os dois critérios agora.</RebEmpty>
      ) : (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sugestoes!.map((item) => (
            <button
              type="button"
              key={item.animalId}
              onClick={() => setAnimalId(String(item.animalId))}
              className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] px-3 py-2 text-left hover:border-[color:var(--leite)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cafe"
            >
              <span>
                <b className="block text-sm text-foreground">Novilha {item.numero}</b>
                <small className="text-xs text-ink-3">{item.motivo}</small>
              </span>
              <RebPill tone="warn">apta</RebPill>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={salvarManual} className="mt-4 grid items-end gap-2 border-t border-dashed border-[color:var(--rule-soft)] pt-3 sm:grid-cols-[minmax(150px,1.4fr)_130px_110px_minmax(170px,1.5fr)_auto]">
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Decisão manual
          <SelectBusca
            className={CAIXA}
            aria-label="Novilha"
            value={animalId}
            onValueChange={setAnimalId}
            placeholder="selecione a novilha…"
            buscaPlaceholder="Buscar animal…"
            options={novilhas.map((animal) => ({ value: String(animal.id), label: `${animal.numero}${animal.nome ? ` · ${animal.nome}` : ""}` }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Data
          <CampoData className={CAIXA} aria-label="Data" value={data} onChange={setData} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Decisão
          <RebSelect className={CAIXA} aria-label="Decisão" value={apta ? "1" : "0"} onChange={(v) => setApta(v === "1")}>
            <option value="1" data-descricao="A novilha pode entrar na reprodução.">Apta</option>
            <option value="0" data-descricao="A novilha ainda não entra na reprodução.">Inapta</option>
          </RebSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          Motivo
          <input className="rounded border border-[color:var(--rule-soft)] bg-card px-2 py-1.5 text-sm text-foreground" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: avaliação clínica" maxLength={200} />
        </label>
        <RebButton type="submit" disabled={salvando || !animalId || !data}>Registrar</RebButton>
      </form>

      {mensagem && <p role="status" className="mb-0 mt-2 text-sm text-[color:var(--outros)]">{mensagem}</p>}
      {erroAcao && <p role="alert" className="mb-0 mt-2 text-sm text-prejuizo">{erroAcao}</p>}

      {animalId && !historico.loading && (historico.data?.length ?? 0) > 0 && (
        <RebTable wrapClassName="mt-3">
          <thead><tr><th>Data</th><th>Decisão</th><th>Origem</th><th>Motivo</th></tr></thead>
          <tbody>
            {historico.data!.map((item) => (
              <tr key={item.id}>
                <td>{fmtData(item.data)}</td>
                <td><RebPill tone={item.apta ? "ok" : "bad"}>{item.apta ? "Apta" : "Inapta"}</RebPill></td>
                <td>{item.origem === "AUTOMATICA" ? "Automática" : "Manual"}</td>
                <td>{item.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </RebTable>
      )}
    </RebBox>
  );
}
