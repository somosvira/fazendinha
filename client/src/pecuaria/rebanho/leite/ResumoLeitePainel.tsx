import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
interface ResumoPainelLeite {
  litros: string | null;
  diasSitioEsperados: number;
  diasSitioInformados: number;
  diasSitioSemFolha: number;
  diasSitioParciais: number;
  diasSitioSemParticipantes: number;
  medicoesPendentes: number;
  diasSitioSemAnimaisElegiveis?: number;
  diasSitioFinalidadePendente?: number;
  completa: boolean;
  rotinas: number[];
}
export function ResumoLeitePainel({
  inicio,
  fim,
  propriedadeId,
  revisao,
}: {
  inicio: string;
  fim: string;
  propriedadeId: number | null;
  revisao: number;
}) {
  const [dados, setDados] = useState<ResumoPainelLeite | null>(null),
    [erro, setErro] = useState("");
  useEffect(() => {
    let vigente = true;
    setDados(null);
    setErro("");
    void consultarLeite<ResumoPainelLeite>(
      `/painel?${new URLSearchParams({ inicio, fim })}`,
      propriedadeId,
    )
      .then((r) => {
        if (vigente) setDados(r);
      })
      .catch((e) => {
        if (vigente)
          setErro(
            e instanceof Error ? e.message : "Falha na consulta da produção",
          );
      });
    return () => {
      vigente = false;
    };
  }, [inicio, fim, propriedadeId, revisao]);
  const href = `/pecuaria/leite?${new URLSearchParams({ inicio, fim, leiteSecao: "custos", ...(propriedadeId ? { propriedadeId: String(propriedadeId) } : {}) })}`;
  return (
    <>
      {erro ? (
        <p className="ger-aviso">Produção de leite não consultada: {erro}</p>
      ) : dados ? (
        <>
          <p className="ger-valor">
            {dados.litros === null
              ? "Não informado"
              : `${Number(dados.litros).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L`}
          </p>
          <p>
            Litros medidos no período ·{" "}
            {dados.completa ? "cobertura completa" : "cobertura incompleta"}.
          </p>
          <p className="ger-muted">
            {dados.diasSitioInformados} de {dados.diasSitioEsperados} dias por
            sítio com folha · {dados.diasSitioParciais} parciais ·{" "}
            {dados.medicoesPendentes} medições pendentes.
          </p>
          {dados.diasSitioSemParticipantes > 0 && (
            <p className="ger-muted">
              {dados.diasSitioSemParticipantes} folha(s) sem participantes.
            </p>
          )}
          {!!dados.diasSitioSemAnimaisElegiveis && <p className="ger-muted">{dados.diasSitioSemAnimaisElegiveis} dia(s) por sítio sem animais elegíveis na data.</p>}
          {!!dados.diasSitioFinalidadePendente && <p className="ger-aviso">{dados.diasSitioFinalidadePendente} dia(s) por sítio com finalidade histórica a conciliar. Litros registrados preservados.</p>}
          {dados.rotinas.length > 1 && (
            <p className="ger-muted">
              Há rotinas diferentes de ordenha neste recorte. Compare também a
              cobertura.
            </p>
          )}
        </>
      ) : (
        <p className="ger-muted">Consultando produção de leite…</p>
      )}
      <div className="ger-rodape-link">
        <a className="ger-link" href={href}>
          Ver ritmo e custos do leite
        </a>
      </div>
    </>
  );
}
