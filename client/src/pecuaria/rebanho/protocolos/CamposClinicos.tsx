import { AvaliacaoContextualCampos, type DadosFormularioContextual } from "../reproducao/AvaliacaoContextualCampos";
import { contextoAvaliacao } from "../reproducao/avaliacao-contextual-api";
import { DatePicker } from "../../../components/DatePicker";
import { AjudaCampo } from "../../../components/Dica";
import { CamposAptidao } from "../reproducao/CamposAptidao";
import { useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { CamposResultadoExame } from "../sanidade/CamposExame";
import type { TarefaOperacional } from "./api";
import { SeletorClinico } from "./SeletorClinico";
import { obterOpcoesClinicas, type DadosClinicos, type AcompanhamentoClinico } from "./clinica-api";
import { SelectCampo } from "@/financeiro/SelectCampo";
export type TarefaClinica = TarefaOperacional & { acompanhamento?: AcompanhamentoClinico | null; acoes: TarefaOperacional["acoes"] & { reavaliar?: boolean } };
type Props = { tarefa: TarefaOperacional; dados: DadosClinicos; onChange: (patch: Partial<DadosClinicos>) => void; identificacao?: string };
export function CamposTentativaClinica({ tarefa: t, dados: d, onChange, identificacao }: Props) {
  const [quantidadeAberta, setQuantidadeAberta] = useState(!!d.quantidade && d.quantidade !== "1");
  const rotulo = (v: string) => identificacao ? `${v} · ${identificacao}` : v;
  const seletor = (opcao: "MATERIAL" | "PARTIDA" | "SERVICO" | "REPRODUTOR", nome: string, valor: string, mudar: (id: string) => void) => <SeletorClinico tarefaId={t.id} propriedadeId={t.propriedadeId} opcao={opcao} rotulo={rotulo(nome)} valor={valor} materialId={d.materialId} tipoTentativa={d.tipoTentativa === "COBERTURA" ? undefined : d.tipoTentativa} externo={d.reprodutorExterno} onChange={mudar} />;
  return <div className="clinica-campos-tentativa grid gap-3">
    <label>{rotulo("Tipo de tentativa")}<SelectCampo className={classeInput} value={d.tipoTentativa} onValueChange={valor => onChange({ tipoTentativa: valor as DadosClinicos["tipoTentativa"], materialId: "", partidaId: "", quantidade: "", touroId: "", touroExternoId: "", ...(valor === "COBERTURA" ? { origem: "DOCUMENTADA" } : {}) })}><option value="IA">Inseminação artificial</option><option value="TE">Transferência de embrião</option><option value="COBERTURA">Cobertura</option></SelectCampo></label>
    <label className="relative">{rotulo("Origem do material ou reprodutor")}<SelectCampo className={classeInput} value={d.origem} onValueChange={valor => onChange({ origem: valor as DadosClinicos["origem"], partidaId: "", operacaoServicoId: "" })}><option value="ESTOQUE">Estoque do sítio</option><option value="SERVICO">Incluso em Serviço</option><option value="DOCUMENTADA">Origem documentada</option></SelectCampo></label>
    {d.tipoTentativa === "COBERTURA" ? <><label>{rotulo("Cadastro do reprodutor")}<SelectCampo className={classeInput} value={String(d.reprodutorExterno)} onValueChange={valor => onChange({ reprodutorExterno: valor === "true", touroId: "", touroExternoId: "" })}><option value="true">Reprodutor externo</option><option value="false">Animal do rebanho</option></SelectCampo></label>{seletor("REPRODUTOR", "reprodutor", d.reprodutorExterno ? d.touroExternoId : d.touroId, id => onChange(d.reprodutorExterno ? { touroExternoId: id, touroId: "" } : { touroId: id, touroExternoId: "" }))}</> : <>{seletor("MATERIAL", "material genético", d.materialId, materialId => onChange({ materialId, partidaId: "" }))}<p className="text-sm">Uso habitual: {d.tipoTentativa === "TE" ? "1 embrião por receptora" : "1 dose por inseminação"}. <AjudaCampo rotulo="Ajuda sobre quantidade de material" texto="A unidade do produto será conferida. Registre somente o material utilizado no animal; perdas de estoque são separadas."/></p><Button secondary type="button" aria-expanded={quantidadeAberta} onClick={() => setQuantidadeAberta(v => !v)}>Quantidade excepcional ou registro histórico</Button>{quantidadeAberta && <div className="grid gap-3"><label>{rotulo("Quantidade por animal")}<input className={classeInput} type="number" min="0.001" step="0.001" placeholder="1" value={d.quantidade} onChange={e => onChange({ quantidade: e.target.value })} /></label><label>{rotulo("Motivo da quantidade excepcional")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.motivoQuantidadeExcepcional ?? ""} onChange={e => onChange({ motivoQuantidadeExcepcional: e.target.value })} /></label><p className="text-sm text-ink-3">Informe somente o material efetivamente utilizado. Perdas de estoque não aumentam a dose do animal.</p></div>}{d.origem === "ESTOQUE" && d.materialId && seletor("PARTIDA", "lote do material", d.partidaId, partidaId => onChange({ partidaId }))}</>}
    {d.origem === "SERVICO" && seletor("SERVICO", "Serviço", d.operacaoServicoId, operacaoServicoId => onChange({ operacaoServicoId }))}
    {d.origem === "DOCUMENTADA" && <label>{rotulo("Justificativa da origem documentada")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.justificativaSemOrigem} onChange={e => onChange({ justificativaSemOrigem: e.target.value })} /></label>}
    {d.tipoTentativa !== "COBERTURA" && <><label className="flex gap-2"><input type="checkbox" checked={d.cienciaValidadeDesconhecida} onChange={e => onChange({ cienciaValidadeDesconhecida: e.target.checked })} />{rotulo("Confirmo ciência da validade desconhecida, quando aplicável")}</label><label className="flex gap-2"><input type="checkbox" checked={d.documentacaoExcepcional} onChange={e => onChange({ documentacaoExcepcional: e.target.checked })} />{rotulo("Documentar uso excepcional de material vencido")}</label>{d.documentacaoExcepcional && <label>{rotulo("Motivo da documentação excepcional")}<textarea className={classeInput} minLength={5} maxLength={1000} value={d.motivoDocumentacaoExcepcional} onChange={e => onChange({ motivoDocumentacaoExcepcional: e.target.value })} /></label>}</>}

  </div>;
}
export function CamposAvaliacaoClinica({
  tarefa: t,
  dados: d,
  onChange,
}: Props) {
  const rotulo = (v: string) => `${v} · ${t.animal.brinco}`;
  const mudarContextuais = (patch: Partial<DadosFormularioContextual>) => {
    const { sexoFetal, finalidade, ...resto } = patch;
    onChange({
      ...resto,
      ...(sexoFetal !== undefined ? { sexoFetal: sexoFetal ?? "" } : {}),
      ...(finalidade !== undefined
        ? { finalidade: finalidade as DadosClinicos["finalidade"] }
        : {}),
      ...(patch.avaliacaoContextual && !d.avaliacaoContextual
        ? { decisaoIatf: null, retornoEm: "" }
        : {}),
    });
  };
  const acompanhamento = (t as TarefaClinica).acompanhamento;
  const necessidades =
    acompanhamento?.estado === "PENDENTE" ? [acompanhamento] : [];
  async function adotarTipo(id: string) {
    if (id === d.tipoExameId && d.formato?.formatoExameHash) return;
    const pagina = await obterOpcoesClinicas(
      t.id,
      t.propriedadeId,
      "TIPO_EXAME",
      1,
      "",
      id,
    );
    const tipo = pagina.itens.find((v) => v.id === id);
    if (!tipo?.formatoExameHash)
      throw new Error(
        "O tipo de exame do catálogo não está disponível para esta tarefa.",
      );
    onChange({
      tipoExameId: id,
      formato: {
        tipoResultado: tipo.tipoResultado ?? "MULTIPLO",
        campos: tipo.campos,
        versaoFormato: tipo.versaoFormato,
        formatoExameHash: tipo.formatoExameHash,
      },
    });
  }
  return (
    <div className="grid gap-3">
      <AvaliacaoContextualCampos
        propriedadeId={t.propriedadeId}
        contexto={contextoAvaliacao({
          gestacaoId: d.gestacaoId,
          tentativaId: d.tentativaId,
        })}
        dados={d}
        campos={d.formato?.campos ?? []}
        necessidades={necessidades}
        onChange={mudarContextuais}
        onTipoExame={adotarTipo}
        identificacao={t.animal.brinco}
      />
      {!d.avaliacaoContextual && (
        <>
          <label>
            {rotulo("Resultado da avaliação")}
            <SelectCampo
              className={classeInput}
              value={d.resultado}
              onValueChange={(valor) =>
                onChange({
                  resultado: valor,
                  finalidade:
                    valor === "SEXAGEM"
                      ? "SEXAGEM"
                      : valor === "RECONFIRMACAO"
                        ? "RECONFIRMACAO"
                        : valor === "INCONCLUSIVO"
                          ? d.finalidade
                          : "DIAGNOSTICO",
                  decisaoIatf: null,
                  ...(valor === "NEGATIVO" ? { sexoFetal: "" } : {}),
                })
              }
            >
              <option value="">Informe o resultado observado</option>
              <option value="POSITIVO">Gestação confirmada</option>
              <option value="NEGATIVO">Gestação não confirmada</option>
              <option value="INCONCLUSIVO">Inconclusivo</option>
              <option value="RECONFIRMACAO">
                Gestação conhecida reconfirmada
              </option>
              <option value="SEXAGEM">Sexagem de gestação conhecida</option>
            </SelectCampo>
          </label>
          {d.resultado === "NEGATIVO" && (
            <section className="grid gap-3 rounded-lg border border-border p-4">
              <label>
                {rotulo("Indicação para nova IATF")}
                <SelectCampo
                  className={classeInput}
                  value={d.decisaoIatf ?? ""}
                  onValueChange={(valor) =>
                    onChange({
                      decisaoIatf: (valor ||
                        null) as DadosClinicos["decisaoIatf"],
                    })
                  }
                >
                  <option value="">Decidir depois</option>
                  <option value="INDICAR">Indicar para nova IATF</option>
                  <option value="NAO_INDICAR">
                    Não indicar neste atendimento
                  </option>
                </SelectCampo>
              </label>
              <p className="text-sm text-ink-3">
                A indicação será registrada com o diagnóstico. A inclusão em
                outro protocolo exige preparação e confirmação próprias; o
                resultado negativo não inicia uma IATF.
              </p>
            </section>
          )}
          <label>
            {rotulo("Finalidade do exame")}
            <SelectCampo
              className={classeInput}
              value={d.finalidade}
              onValueChange={(valor) =>
                onChange({
                  finalidade: valor as DadosClinicos["finalidade"],
                  resultado:
                    d.resultado === "INCONCLUSIVO"
                      ? "INCONCLUSIVO"
                      : valor === "SEXAGEM"
                        ? "SEXAGEM"
                        : valor === "RECONFIRMACAO" &&
                            ["POSITIVO", "SEXAGEM", "RECONFIRMACAO"].includes(
                              d.resultado,
                            )
                          ? "RECONFIRMACAO"
                          : ["SEXAGEM", "RECONFIRMACAO"].includes(d.resultado)
                            ? "POSITIVO"
                            : d.resultado,
                  decisaoIatf: null,
                })
              }
            >
              <option value="DIAGNOSTICO">Diagnóstico</option>
              <option value="RECONFIRMACAO">Reconfirmação</option>
              <option value="SEXAGEM">Sexagem</option>
            </SelectCampo>
          </label>
          {d.formato?.campos && (
            <CamposResultadoExame
              campos={d.formato.campos.filter(
                (c) =>
                  !["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(c.codigo),
              )}
              valores={d.resultados}
              onChange={(resultados) => onChange({ resultados })}
            />
          )}
        </>
      )}
      <SeletorClinico
        tarefaId={t.id}
        propriedadeId={t.propriedadeId}
        opcao="TENTATIVA"
        rotulo={rotulo("tentativa de origem")}
        valor={d.tentativaId}
        onChange={(tentativaId) => onChange({ tentativaId })}
      />
      <SeletorClinico
        tarefaId={t.id}
        propriedadeId={t.propriedadeId}
        opcao="GESTACAO"
        rotulo={rotulo("gestação conhecida")}
        valor={d.gestacaoId}
        onChange={(gestacaoId) => onChange({ gestacaoId })}
      />
      <label>
        {rotulo("Motivo de vínculo desconhecido, se necessário")}
        <textarea
          className={classeInput}
          minLength={5}
          maxLength={1000}
          value={d.motivoVinculoDesconhecido}
          onChange={(e) =>
            onChange({ motivoVinculoDesconhecido: e.target.value })
          }
        />
      </label>
      {!d.avaliacaoContextual && d.resultado !== "NEGATIVO" && (
        <label>
          {rotulo("Sexo fetal observado")}
          <SelectCampo
            className={classeInput}
            value={d.sexoFetal}
            onValueChange={(valor) => onChange({ sexoFetal: valor })}
          >
            <option value="">Não informado</option>
            <option value="F">Fêmea</option>
            <option value="M">Macho</option>
          </SelectCampo>
        </label>
      )}
      <label>
        {rotulo("Retorno definido pelo responsável (opcional)")}
        <DatePicker
          className="mt-1.5"
          value={d.retornoEm}
          onChange={(valor) => onChange({ retornoEm: valor })}
        />
      </label>
      <label>
        {rotulo("Previsão de parto informada (opcional)")}
        <DatePicker
          className="mt-1.5"
          value={d.previsaoParto}
          onChange={(valor) => onChange({ previsaoParto: valor })}
        />
      </label>
      {d.resultado === "INCONCLUSIVO" && (
        <p className="text-sm">
          O exame inconclusivo permanece como fato. Acompanhamento e nova
          avaliação preservam esse histórico.
        </p>
      )}
      {!d.avaliacaoContextual && (
        <CamposAptidao dados={d} onChange={onChange} />
      )}
      <ReavaliacaoClinica tarefa={t} dados={d} onChange={onChange} />
    </div>
  );
}
function ReavaliacaoClinica({ tarefa, dados, onChange }: Props) {
  const t = tarefa as TarefaClinica;
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  if (!t.acoes.reavaliar && t.acompanhamento?.estado !== "PENDENTE") return null;
  async function vincular() {
    if (ocupado) return; setOcupado(true); setErro(null);
    try {
      const pagina = await obterOpcoesClinicas(t.id, t.propriedadeId, "TIPO_EXAME", 1, "", dados.tipoExameId || undefined);
      const demanda = pagina.acompanhamento;
      if (!demanda || demanda.estado !== "PENDENTE") throw new Error("O acompanhamento mudou. Feche o editor e atualize esta tarefa.");
      onChange({ demandaAcompanhamentoId: demanda.id, reavaliacao: true, finalidade: demanda.finalidade as DadosClinicos["finalidade"], tentativaId: demanda.tentativaId ?? "", gestacaoId: demanda.gestacaoId ?? "" });
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  return <section className="grid gap-2 border-t border-border pt-3"><p>Há acompanhamento pendente deste animal. A reavaliação cria outro exame e conserva o procedimento anterior.</p><a className="text-sm underline" href={`/pecuaria/reproducao?animalId=${t.animal.id}&participacaoId=${t.participacaoId}&propriedadeId=${t.propriedadeId}`}>Consultar histórico do acompanhamento</a><ErrorBox erro={erro} />{dados.demandaAcompanhamentoId ? <p role="status">Nova avaliação vinculada ao acompanhamento pendente.</p> : <Button secondary type="button" disabled={ocupado} onClick={() => void vincular()}>{ocupado ? "Conferindo acompanhamento…" : "Vincular esta reavaliação"}</Button>}</section>;
}
