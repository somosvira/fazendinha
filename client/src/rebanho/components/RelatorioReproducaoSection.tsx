import { useEffect, useState } from "react";
import { obterRelatorioReproducao, type RelatorioReproducaoDTO } from "../api";
import { Loader } from "../../components/Loading";
import { RebBox, RebEmpty } from "@/components/rb/RebPrimitives";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

const pct = (t: number | null) => (t == null ? "—" : `${(t * 100).toFixed(1)}%`);
const METODO_LABEL: Record<string, string> = { IA: "Inseminação", MN: "Monta natural", TE: "Transferência de embrião" };

export function RelatorioReproducaoSection() {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [dados, setDados] = useState<RelatorioReproducaoDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = () => {
    setCarregando(true); setErro(null);
    obterRelatorioReproducao(de || undefined, ate || undefined)
      .then(setDados)
      .catch((e) => setErro(String(e.message ?? e)))
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RebBox>
      <h4>Relatório reprodutivo</h4>
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
        <RebField label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></RebField>
        <RebField label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></RebField>
        <RebButton variant="pri" onClick={carregar}>Aplicar período</RebButton>
      </div>

      {erro ? <p role="alert" className="text-sm text-prejuizo">Erro: {erro}</p>
        : carregando || dados == null ? <Loader />
        : dados.coberturas === 0 && dados.partos === 0 ? <RebEmpty>Sem eventos reprodutivos no período.</RebEmpty>
        : (
          <>
            <p className="text-sm" style={{ marginBottom: 8 }}>
              {`${dados.coberturas} coberturas · ${dados.prenhes} prenhezes · ${dados.partos} partos · taxa de concepção ${pct(dados.taxaConcepcao)}`}
            </p>
            <RebTable>
              <thead><tr><th>Método</th><th>Coberturas</th><th>Prenhezes</th><th>Taxa</th></tr></thead>
              <tbody>{dados.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td>{METODO_LABEL[m.metodo] ?? m.metodo}</td>
                  <td>{m.coberturas}</td>
                  <td>{m.prenhes}</td>
                  <td>{pct(m.taxa)}</td>
                </tr>
              ))}</tbody>
            </RebTable>
          </>
        )}
    </RebBox>
  );
}
