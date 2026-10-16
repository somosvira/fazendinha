import type { AtividadeVisita } from "./visitas-api";
import { origemAtividadeVisita } from "./apresentacao-visita";
import { ordenarParticipantes } from "./visitas-regras";
import { CabecalhoContextoVisita, CelulasContextoVisita } from "./ContextoTabelaVisita";
import { criteriosFolha, detalhesTarefaFolha, LEGENDA_FOLHA, motivosComunsFolha, motivosIndividuaisFolha } from "./folha-regras";

export type SnapshotFolhaVisita = {
  atividades: AtividadeVisita[];
  nome?: string;
  data?: string;
  dataReferencia?: string;
  versao?: number;
};

export function FolhaVisita({ snapshot }: { snapshot: SnapshotFolhaVisita }) {
  const referencia = snapshot.dataReferencia ?? snapshot.data;
  return (
    <div className="hidden print:block folha-visita-print">
      <style>{`@page { size: A4 landscape; margin: 10mm; } .folha-visita-print table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:8pt } .folha-visita-print th,.folha-visita-print td { border:1px solid #777; padding:3px 4px; vertical-align:top; overflow-wrap:anywhere } .folha-visita-print th { background:#eee; text-align:left } .folha-visita-print .text-right { text-align:right } .folha-visita-print .tabular-nums { font-variant-numeric:tabular-nums } .folha-visita-print section { break-inside:auto } .folha-visita-print tr { break-inside:avoid; page-break-inside:avoid } .folha-visita-print thead { display:table-header-group }`}</style>
      <h1>{snapshot.nome ?? "Visita veterinária — cabeçalho não preservado"}</h1>
      <p>Data de referência: {referencia?.slice(0, 10) ?? "não preservada"} · Versão da emissão: {snapshot.versao ?? "não preservada"}</p>
      <p className="my-3 text-xs">{LEGENDA_FOLHA}</p>
      {snapshot.atividades.map((atividade) => (
        <section key={atividade.id}>
          <h2 className="mt-6 mb-2">{atividade.nome || "Grupo sem nome preservado"}{atividade.extra && !origemAtividadeVisita(atividade) ? " · Atividade extra" : ""}</h2>
          <p className="text-xs">Origem do grupo: {origemAtividadeVisita(atividade) === "agenda" ? "Agenda do dia" : origemAtividadeVisita(atividade) === "livre" ? "Seleção livre" : "Não informada"}</p>
          {detalhesTarefaFolha(atividade.nome, atividade.contexto, atividade.participantes).map((linha, i) => <p key={`grupo-${i}`} className="text-xs">{linha}</p>)}
          {(() => {
            const comuns = motivosComunsFolha(atividade.participantes);
            const individuais = atividade.participantes.map(p => motivosIndividuaisFolha(p.snapshot, comuns));
            const incluirColuna = individuais.some(m => m.length > 0);
            return <>
          <div className="mb-3 text-xs">
            {criteriosFolha(atividade.contexto).map((linha, i) => <p key={i}>{linha}</p>)}
            {comuns.length > 0 && <p><strong>Motivos comuns:</strong> {comuns.join("; ")}</p>}
          </div>
          <table className="w-full border-collapse text-xs">
            <thead className="table-header-group">
              <tr>
                <th>Ordem</th>
                <CabecalhoContextoVisita />
                {incluirColuna && <th>Observação individual</th>}
                <th>Resultado / anotações</th>
              </tr>
            </thead>
            <tbody>
              {ordenarParticipantes(atividade.participantes).map((p) => {
                const s = p.snapshot;
                const individuais = motivosIndividuaisFolha(s, comuns);
                return (
                  <tr key={p.id} className="break-inside-avoid">
                    <td>{p.ordem}</td>
                    <CelulasContextoVisita contexto={s} dataReferencia={referencia} />
                    {incluirColuna && <td>{individuais.join("; ") || "—"}</td>}
                    <td className="h-16" />
                  </tr>
                );
              })}
            </tbody>
          </table>
            </>;
          })()}
        </section>
      ))}
    </div>
  );
}
