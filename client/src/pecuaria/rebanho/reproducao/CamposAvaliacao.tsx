import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useEffect, useState } from "react";
import { rotulosCondutaAvaliacao, rotulosResultadoAvaliacao } from "./visitas-transcricao";
import { classeInput } from "../../../financeiro/PainelCadastro";
type Dados = { resultado?: unknown; finalidade?: unknown; sexoFetal?: unknown; conduta?: unknown };
export type AlteracaoAvaliacao = { resultado?: string; finalidade?: string; sexoFetal?: string | null; conduta?: string | null };
/** Finalidade, observações e conduta são independentes; as siglas da fazenda não são resultados obrigatórios. */
export function CamposAvaliacao({ dados, onChange, secao, identificacao, administrativo }: {
  dados: Dados;
  onChange: (dados: AlteracaoAvaliacao) => void;
  secao?: "resultado" | "conduta" | "detalhes";
  identificacao?: string;
  administrativo?: { status?: string; onChange: (status: "ADIADO" | "NAO_ATENDIDO") => void };
}) {
  const resultado = typeof dados.resultado === "string" ? dados.resultado : "";
  const [realizacao, setRealizacao] = useState(resultado === "NAO_AVALIADO" ? "NAO_REALIZADO" : resultado ? "REALIZADO" : "");
  useEffect(() => { if (resultado) setRealizacao(resultado === "NAO_AVALIADO" ? "NAO_REALIZADO" : "REALIZADO"); }, [resultado]);
  const finalidade = typeof dados.finalidade === "string" && dados.finalidade ? dados.finalidade : ["RECONFIRMACAO", "SEXAGEM"].includes(resultado) ? resultado : "DIAGNOSTICO";
  const conclusao = resultado === "RECONFIRMACAO" ? "POSITIVO" : ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(resultado) ? resultado : "";
  function mudarConclusao(valor: string) { onChange({ resultado: finalidade === "RECONFIRMACAO" && valor === "POSITIVO" ? "RECONFIRMACAO" : valor, ...(valor === "NEGATIVO" ? { sexoFetal: null } : {}), ...(valor !== "NEGATIVO" && dados.conduta === "IATF" ? { conduta: null } : {}) }); }
  const rotulo = (nome: string) => identificacao ? `${nome} · ${identificacao}` : nome;
  if (secao === "resultado") return (
    <SelectCampo
      aria-label={rotulo("Resultado")}
      className={classeInput}
      value={administrativo && ["ADIADO", "NAO_ATENDIDO"].includes(administrativo.status ?? "") ? administrativo.status : resultado}
      onValueChange={valor => {
        if (administrativo && (valor === "ADIADO" || valor === "NAO_ATENDIDO")) { administrativo.onChange(valor); return; }
        onChange({
          resultado: valor,
          finalidade: valor === "RECONFIRMACAO" ? "RECONFIRMACAO" : valor === "SEXAGEM" ? "SEXAGEM" : "DIAGNOSTICO",
          ...(["NEGATIVO", "NAO_AVALIADO"].includes(valor) ? { sexoFetal: null } : {}),
          ...(valor !== "NEGATIVO" && dados.conduta === "IATF" ? { conduta: null } : {}),
        });
      }}
    >
      <option value="">Selecionar resultado</option>
      {Object.entries(rotulosResultadoAvaliacao).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
      {administrativo && <><option value="ADIADO">Adiado</option><option value="NAO_ATENDIDO">Não atendido</option></>}
    </SelectCampo>
  );
  if (secao === "conduta") return (
    <SelectCampo aria-label={rotulo("Conduta")} className={classeInput}
      value={typeof dados.conduta === "string" ? dados.conduta : ""}
      onValueChange={valor => onChange({ conduta: valor || null })}>
      <option value="">Sem conduta informada</option>
      {Object.entries(rotulosCondutaAvaliacao).filter(([valor]) => valor !== "IATF" || resultado === "NEGATIVO")
        .map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
    </SelectCampo>
  );
  if (secao === "detalhes") return (
    <div className="grid gap-3 sm:grid-cols-2">
      {resultado && resultado !== "NAO_AVALIADO" && <>
        <label>Finalidade do exame
          <SelectCampo aria-label={rotulo("Finalidade do exame")} className={classeInput} value={finalidade}
            onValueChange={valor => {
              const nova = valor;
              onChange({ finalidade: nova,
                resultado: nova === "SEXAGEM" ? "SEXAGEM"
                  : nova === "RECONFIRMACAO" && ["POSITIVO", "SEXAGEM"].includes(resultado) ? "RECONFIRMACAO"
                    : nova === "DIAGNOSTICO" && ["RECONFIRMACAO", "SEXAGEM"].includes(resultado) ? "POSITIVO" : resultado,
              });
            }}>
            <option value="DIAGNOSTICO">Diagnóstico de gestação</option>
            <option value="RECONFIRMACAO">Reconfirmação de gestação conhecida</option>
            <option value="SEXAGEM">Sexagem fetal de gestação conhecida</option>
          </SelectCampo>
        </label>
        {resultado !== "NEGATIVO" && <label>Sexo fetal {resultado === "SEXAGEM" ? "(obrigatório)" : "(se observado)"}
          <SelectCampo aria-label={rotulo("Sexo fetal")} className={classeInput}
            value={typeof dados.sexoFetal === "string" ? dados.sexoFetal : ""}
            onValueChange={valor => onChange({ sexoFetal: valor || null })}>
            <option value="">Não informado</option><option value="F">Fêmea</option><option value="M">Macho</option>
          </SelectCampo>
        </label>}
      </>}
    </div>
  );
  return <div className="grid gap-3">
    <label>Atendimento<SelectCampo className={classeInput} value={realizacao} onValueChange={valor => { setRealizacao(valor); onChange(valor === "NAO_REALIZADO" ? { resultado: "NAO_AVALIADO", sexoFetal: null, ...(dados.conduta === "IATF" ? { conduta: null } : {}) } : { resultado: "", finalidade }); }}><option value="">Informe o atendimento</option><option value="REALIZADO">Exame realizado</option><option value="NAO_REALIZADO">Exame não realizado</option></SelectCampo></label>
    {realizacao === "REALIZADO" && <>
      <label>Finalidade do exame<SelectCampo className={classeInput} value={finalidade} onValueChange={valor => onChange({ finalidade: valor, resultado: valor === "SEXAGEM" ? "SEXAGEM" : "", ...(dados.conduta === "IATF" ? { conduta: null } : {}) })}><option value="DIAGNOSTICO">Diagnóstico de gestação</option><option value="RECONFIRMACAO">Reconfirmação de gestação conhecida</option><option value="SEXAGEM">Sexagem fetal de gestação conhecida</option></SelectCampo></label>
      {finalidade !== "SEXAGEM" && <label>Conclusão sobre a gestação<SelectCampo className={classeInput} value={conclusao} onValueChange={valor => mudarConclusao(valor)}><option value="">Informe a conclusão</option><option value="POSITIVO">Gestação confirmada</option><option value="NEGATIVO">Gestação não confirmada</option><option value="INCONCLUSIVO">Inconclusivo</option></SelectCampo></label>}
      {conclusao !== "NEGATIVO" && <label>Sexo fetal {finalidade === "SEXAGEM" ? "(obrigatório)" : "(se observado)"}<SelectCampo className={classeInput} value={typeof dados.sexoFetal === "string" ? dados.sexoFetal : ""} onValueChange={valor => onChange({ sexoFetal: valor || null })}><option value="">Não informado</option><option value="F">Fêmea</option><option value="M">Macho</option></SelectCampo></label>}
    </>}
    <label>Conduta<SelectCampo className={classeInput} value={typeof dados.conduta === "string" ? dados.conduta : ""} onValueChange={valor => onChange({ conduta: valor || null })}><option value="">Sem conduta informada</option><option value="AGUARDAR">Aguardar / organizar retorno</option>{resultado === "NEGATIVO" && <option value="IATF">Indicar protocolo IATF</option>}<option value="DESCARTE">Restringir reprodução / descarte</option></SelectCampo></label>
  </div>;
}
