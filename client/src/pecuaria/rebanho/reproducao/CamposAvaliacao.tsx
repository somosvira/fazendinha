import { useEffect, useState } from "react";
import { rotulosCondutaAvaliacao, rotulosResultadoAvaliacao } from "./visitas-transcricao";
import { classeInput } from "../../../financeiro/PainelCadastro";
type Dados = { resultado?: unknown; finalidade?: unknown; sexoFetal?: unknown; conduta?: unknown };
export type AlteracaoAvaliacao = { resultado?: string; finalidade?: string; sexoFetal?: string | null; conduta?: string | null };
/** Finalidade, observações e conduta são independentes; as siglas da fazenda não são resultados obrigatórios. */
export function CamposAvaliacao({ dados, onChange, secao, identificacao }: {
  dados: Dados;
  onChange: (dados: AlteracaoAvaliacao) => void;
  secao?: "resultado" | "conduta" | "detalhes";
  identificacao?: string;
}) {
  const resultado = typeof dados.resultado === "string" ? dados.resultado : "";
  const [realizacao, setRealizacao] = useState(resultado === "NAO_AVALIADO" ? "NAO_REALIZADO" : resultado ? "REALIZADO" : "");
  useEffect(() => { if (resultado) setRealizacao(resultado === "NAO_AVALIADO" ? "NAO_REALIZADO" : "REALIZADO"); }, [resultado]);
  const finalidade = typeof dados.finalidade === "string" && dados.finalidade ? dados.finalidade : ["RECONFIRMACAO", "SEXAGEM"].includes(resultado) ? resultado : "DIAGNOSTICO";
  const conclusao = resultado === "RECONFIRMACAO" ? "POSITIVO" : ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(resultado) ? resultado : "";
  function mudarConclusao(valor: string) { onChange({ resultado: finalidade === "RECONFIRMACAO" && valor === "POSITIVO" ? "RECONFIRMACAO" : valor, ...(valor === "NEGATIVO" ? { sexoFetal: null } : {}), ...(valor !== "NEGATIVO" && dados.conduta === "IATF" ? { conduta: null } : {}) }); }
  const rotulo = (nome: string) => identificacao ? `${nome} · ${identificacao}` : nome;
  if (secao === "resultado") return (
    <select
      aria-label={rotulo("Resultado")}
      className={classeInput}
      value={resultado}
      onChange={e => {
        const valor = e.target.value;
        onChange({
          resultado: valor,
          finalidade: valor === "RECONFIRMACAO" ? "RECONFIRMACAO" : valor === "SEXAGEM" ? "SEXAGEM" : "DIAGNOSTICO",
          ...(["NEGATIVO", "NAO_AVALIADO"].includes(valor) ? { sexoFetal: null } : {}),
          ...(valor !== "NEGATIVO" && dados.conduta === "IATF" ? { conduta: null } : {}),
        });
      }}
    >
      <option value="">Registrar resultado</option>
      {Object.entries(rotulosResultadoAvaliacao).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
    </select>
  );
  if (secao === "conduta") return (
    <select aria-label={rotulo("Conduta")} className={classeInput}
      value={typeof dados.conduta === "string" ? dados.conduta : ""}
      onChange={e => onChange({ conduta: e.target.value || null })}>
      <option value="">Sem conduta informada</option>
      {Object.entries(rotulosCondutaAvaliacao).filter(([valor]) => valor !== "IATF" || resultado === "NEGATIVO")
        .map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
    </select>
  );
  if (secao === "detalhes") return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resultado && resultado !== "NAO_AVALIADO" && <>
        <label>Finalidade do exame
          <select aria-label={rotulo("Finalidade do exame")} className={classeInput} value={finalidade}
            onChange={e => {
              const nova = e.target.value;
              onChange({ finalidade: nova,
                resultado: nova === "SEXAGEM" ? "SEXAGEM"
                  : nova === "RECONFIRMACAO" && ["POSITIVO", "SEXAGEM"].includes(resultado) ? "RECONFIRMACAO"
                    : nova === "DIAGNOSTICO" && ["RECONFIRMACAO", "SEXAGEM"].includes(resultado) ? "POSITIVO" : resultado,
              });
            }}>
            <option value="DIAGNOSTICO">Diagnóstico de gestação</option>
            <option value="RECONFIRMACAO">Reconfirmação de gestação conhecida</option>
            <option value="SEXAGEM">Sexagem fetal de gestação conhecida</option>
          </select>
        </label>
        {resultado !== "NEGATIVO" && <label>Sexo fetal {resultado === "SEXAGEM" ? "(obrigatório)" : "(se observado)"}
          <select aria-label={rotulo("Sexo fetal")} className={classeInput}
            value={typeof dados.sexoFetal === "string" ? dados.sexoFetal : ""}
            onChange={e => onChange({ sexoFetal: e.target.value || null })}>
            <option value="">Não informado</option><option value="F">Fêmea</option><option value="M">Macho</option>
          </select>
        </label>}
      </>}
    </div>
  );
  return <div className="grid gap-3">
    <label>Atendimento<select className={classeInput} value={realizacao} onChange={e => { setRealizacao(e.target.value); onChange(e.target.value === "NAO_REALIZADO" ? { resultado: "NAO_AVALIADO", sexoFetal: null, ...(dados.conduta === "IATF" ? { conduta: null } : {}) } : { resultado: "", finalidade }); }}><option value="">Informe o atendimento</option><option value="REALIZADO">Exame realizado</option><option value="NAO_REALIZADO">Exame não realizado</option></select></label>
    {realizacao === "REALIZADO" && <>
      <label>Finalidade do exame<select className={classeInput} value={finalidade} onChange={e => onChange({ finalidade: e.target.value, resultado: e.target.value === "SEXAGEM" ? "SEXAGEM" : "", ...(dados.conduta === "IATF" ? { conduta: null } : {}) })}><option value="DIAGNOSTICO">Diagnóstico de gestação</option><option value="RECONFIRMACAO">Reconfirmação de gestação conhecida</option><option value="SEXAGEM">Sexagem fetal de gestação conhecida</option></select></label>
      {finalidade !== "SEXAGEM" && <label>Conclusão sobre a gestação<select className={classeInput} value={conclusao} onChange={e => mudarConclusao(e.target.value)}><option value="">Informe a conclusão</option><option value="POSITIVO">Gestação confirmada</option><option value="NEGATIVO">Gestação não confirmada</option><option value="INCONCLUSIVO">Inconclusivo</option></select></label>}
      {conclusao !== "NEGATIVO" && <label>Sexo fetal {finalidade === "SEXAGEM" ? "(obrigatório)" : "(se observado)"}<select className={classeInput} value={typeof dados.sexoFetal === "string" ? dados.sexoFetal : ""} onChange={e => onChange({ sexoFetal: e.target.value || null })}><option value="">Não informado</option><option value="F">Fêmea</option><option value="M">Macho</option></select></label>}
    </>}
    <label>Conduta<select className={classeInput} value={typeof dados.conduta === "string" ? dados.conduta : ""} onChange={e => onChange({ conduta: e.target.value || null })}><option value="">Sem conduta informada</option><option value="AGUARDAR">Aguardar / organizar retorno</option>{resultado === "NEGATIVO" && <option value="IATF">Indicar protocolo IATF</option>}<option value="DESCARTE">Restringir reprodução / descarte</option></select></label>
  </div>;
}
