import type { AtividadeVisita } from "./visitas-api";
import { ordenarParticipantes } from "./visitas-regras";
import { criteriosFolha, LEGENDA_FOLHA, registro, rpFolha, textoPreservado } from "./folha-regras";

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
    <div className="hidden print:block">
      <h1>{snapshot.nome ?? "Visita veterinária — cabeçalho não preservado"}</h1>
      <p>Data de referência: {referencia?.slice(0, 10) ?? "não preservada"} · Versão da emissão: {snapshot.versao ?? "não preservada"}</p>
      <p className="my-3 text-xs">{LEGENDA_FOLHA}</p>
      {snapshot.atividades.map((atividade) => (
        <section key={atividade.id}>
          <h2 className="mt-6 mb-2">{atividade.nome}{atividade.extra ? " · Atividade extra" : ""}</h2>
          <div className="mb-3 text-xs">
            {criteriosFolha(atividade.contexto).map((linha, i) => <p key={i}>{linha}</p>)}
          </div>
          <table className="w-full border-collapse text-xs">
            <thead className="table-header-group">
              <tr>
                <th>Ordem / animal</th>
                <th>Lote / categoria / motivo</th>
                <th>Produção / DEL / partos / RP</th>
                <th>Tentativa / situação reprodutiva</th>
                <th>Resultado / conduta / anotações</th>
              </tr>
            </thead>
            <tbody>
              {ordenarParticipantes(atividade.participantes).map((p) => {
                const s = p.snapshot, dados = registro(s), categoria = registro(dados.categoria);
                return (
                  <tr key={p.id} className="break-inside-avoid">
                    <td className="border p-2">{p.ordem} · {s.brinco ?? p.animalId}<p>{s.nome}</p></td>
                    <td className="border p-2">
                      <p>Lote: {s.lote?.nome ?? "—"}</p>
                      <p>Categoria: {textoPreservado(categoria.nome)}</p>
                      <p><strong>Inclusão:</strong> {s.motivos?.join("; ") || "Motivo não preservado"}</p>
                    </td>
                    <td className="border p-2">
                      <p>{s.situacaoProdutiva ?? "—"} · DEL (D0): {textoPreservado(s.del)}</p>
                      <p>Partos realizados: {textoPreservado(s.partos)}</p>
                      <p>Último parto: {s.ultimoParto?.data.slice(0, 10) ?? (s.ultimoParto === null ? "Sem parto registrado" : "—")}</p>
                      <p>RP: {rpFolha(s)}</p>
                    </td>
                    <td className="border p-2">
                      <p>{s.tentativa ? `${s.tentativa.tipo} · ${s.tentativa.data.slice(0, 10)}` : "Tentativa não comprovada"}</p>
                      <p>Dias desde tentativa: {textoPreservado(dados.diasTentativa)}</p>
                      <p>Tentativas no ciclo: {textoPreservado(s.tentativasCiclo)} · Ordem: {textoPreservado(registro(s.tentativa).ordem)}</p>
                      <p>Touro: {s.tentativa?.geneticaSnapshot?.pai?.nome ?? "—"}</p>
                      <p>Situação: {textoPreservado(dados.situacao)}</p>
                    </td>
                    <td className="h-24 min-w-32 border p-2" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
