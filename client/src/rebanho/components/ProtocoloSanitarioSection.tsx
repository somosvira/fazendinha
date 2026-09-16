import { useState } from "react";
import { useAplicacoesSanitarias, useProtocolosSanitarios, aplicarProtocoloSanitario, excluirAplicacaoSanitaria } from "../api";
import { getHojeISO } from "../../lib/hoje";
import { CampoData } from "@/components/CampoData";
import { SelectBusca } from "@/components/SelectBusca";

// Gatilhos no mesmo look de caixa pequena dos inputs vizinhos.
const CAIXA_SELECT = "mt-0.5 w-auto min-w-44 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-[color:var(--ink)]";
const CAIXA_DATA = "mt-0.5 w-36 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-[color:var(--ink)]";

const fmtData = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("pt-BR");

// Aplica um protocolo sanitário do catálogo a um animal com uma data de início (o D0) e mostra a
// agenda derivada. Espelha IatfSection.
export function ProtocoloSanitarioSection({ animalId }: { animalId: string }) {
  const { data: aplicacoes, loading, recarregar } = useAplicacoesSanitarias(animalId);
  const { data: protocolos, loading: loadingProto } = useProtocolosSanitarios();
  const [protocoloId, setProtocoloId] = useState("");
  const [dataInicio, setDataInicio] = useState(getHojeISO());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (loading || loadingProto) return null;
  const lista = aplicacoes ?? [];
  const protos = protocolos ?? [];

  async function aplicar(e: React.FormEvent) {
    e.preventDefault();
    if (!protocoloId || !dataInicio) return;
    setSalvando(true); setErro(null);
    try {
      await aplicarProtocoloSanitario(animalId, { protocoloId: Number(protocoloId), dataInicio });
      setProtocoloId(""); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao aplicar protocolo."); }
    finally { setSalvando(false); }
  }
  async function remover(id: number) { await excluirAplicacaoSanitaria(id); recarregar(); }

  return (
    <div className="mb-4 rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <h4 className="mb-[11px] mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Protocolo sanitário</h4>

      {protos.length === 0 ? (
        <p className="mb-3 text-sm text-ink-3">Nenhum protocolo cadastrado. Cadastre em <b>Sanidade → Protocolos sanitários</b> para aplicar aqui.</p>
      ) : (
        <form onSubmit={aplicar} className="mb-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-ink-3">Protocolo
            <SelectBusca variante="sublinhado" className={CAIXA_SELECT} aria-label="Protocolo" value={protocoloId} onValueChange={setProtocoloId} placeholder="selecione…" buscaPlaceholder="Buscar protocolo…" options={protos.map((p) => ({ value: String(p.id), label: p.nome }))} />
          </label>
          <label className="flex flex-col text-xs text-ink-3">Início (D0)
            <CampoData variante="sublinhado" className={CAIXA_DATA} aria-label="Início (D0)" value={dataInicio} onChange={setDataInicio} />
          </label>
          <button type="submit" disabled={salvando || !protocoloId || !dataInicio} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Aplicar</button>
        </form>
      )}
      {erro && <p className="mb-2 text-sm text-prejuizo">{erro}</p>}

      {lista.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum protocolo aplicado a este animal.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((a) => (
            <div key={a.id} className="rounded border border-dashed border-[color:var(--rule-soft)] p-3">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-[color:var(--ink)]">{a.protocoloNome}</span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  início {fmtData(a.dataInicio)}
                  <button onClick={() => remover(a.id)} className="text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir aplicação ${a.protocoloNome}`}>excluir</button>
                </span>
              </div>
              <ol className="flex flex-col gap-0.5">
                {a.etapas.map((et, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <b className="w-9 shrink-0 font-semibold text-[color:var(--cafe)]">{et.rotulo}</b>
                    <span className="w-24 shrink-0 tabular-nums text-ink-2">{fmtData(et.data)}</span>
                    <span className="flex-1 text-[color:var(--ink)]">{et.acao}{et.produto ? <span className="text-ink-3"> · {et.produto}</span> : null}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
