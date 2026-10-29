import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { CampoFormulario, classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import type { LactacaoReprodutiva, PesoSecagemInput } from "./api";
import { PesoSecagemCampos } from "./PesoSecagemCampos";
import { dadosDaPesagemSecagem, dadosPesoSecagemVazios, pesoSecagemPayload, validarPesoSecagem, vinculoSecagemAtivo, type DadosPesoSecagem } from "./peso-secagem";

export type DadosRevisaoPesoSecagem = { acao: "CONSERVAR" | "CORRIGIR" | "SUBSTITUIR" | "DESVINCULAR"; cienciaReabertura: boolean; peso: DadosPesoSecagem };
export const revisaoPesoSecagemVazia = (): DadosRevisaoPesoSecagem => ({ acao: "CONSERVAR", cienciaReabertura: false, peso: dadosPesoSecagemVazios() });
export function validarRevisaoPesoSecagem(lactacao: LactacaoReprodutiva | undefined, fim: string, dados: DadosRevisaoPesoSecagem, motivo: string, propriedadeId?: number | null): { erro?: string; pesoSecagem?: PesoSecagemInput } {
  const ativo = lactacao ? vinculoSecagemAtivo(lactacao) : null;
  if (!ativo) return {};
  if (!fim) return dados.cienciaReabertura ? {} : { erro: "Confirme a revogação do vínculo de peso ao reabrir a lactação." };
  if (dados.acao === "CONSERVAR") return fim === ativo.pesagem.data.slice(0, 10) ? {} : { erro: "Revise explicitamente o vínculo de peso ao alterar a data do encerramento." };
  if (dados.acao === "DESVINCULAR") return { pesoSecagem: { acao: "DESVINCULAR", vinculoId: ativo.id, motivo } };
  const erros = validarPesoSecagem(dados.peso, fim, propriedadeId, false);
  if (Object.keys(erros).length) return { erro: Object.values(erros)[0] };
  if (dados.acao === "CORRIGIR") {
    if (ativo.pesagem.referenciaHistorica) return { erro: "A pesagem importada exige reconciliação auditada." };
    return { pesoSecagem: { acao: "CORRIGIR", vinculoId: ativo.id, data: dados.peso.data, pesoKg: Number(dados.peso.pesoKg), origem: dados.peso.origem, precisao: dados.peso.precisao, observacao: dados.peso.observacao.trim() || null, motivo } };
  }
  const escolha = pesoSecagemPayload(dados.peso);
  return escolha.acao === "NAO_INFORMAR" ? { erro: "Escolha o peso substituto." } : { pesoSecagem: { acao: "SUBSTITUIR", vinculoId: ativo.id, motivo, pesagem: escolha } };
}
export function RevisaoPesoSecagem({ lactacao, fim, valor, onChange, propriedadeId }: { lactacao: LactacaoReprodutiva; fim: string; valor: DadosRevisaoPesoSecagem; onChange: (valor: DadosRevisaoPesoSecagem) => void; propriedadeId?: number }) {
  const ativo = vinculoSecagemAtivo(lactacao);
  if (!ativo) return null;
  return <section className="grid gap-4 border-t border-border pt-4" aria-label="Conferência do vínculo de peso"><h3 className="text-sm font-semibold">Peso vinculado ao encerramento</h3>{!fim ? <><p className="text-sm">Reabrir a lactação revoga o vínculo ativo. A pesagem permanece no histórico do animal e as associações anteriores são preservadas.</p><ConfirmacaoCiencia id="secagem-ciencia-reabertura" checked={valor.cienciaReabertura} onChange={cienciaReabertura => onChange({ ...valor, cienciaReabertura })} obrigatorio>Confirmo a revogação do vínculo de peso ao reabrir a lactação.</ConfirmacaoCiencia></> : <><CampoFormulario id="secagem-revisao-correcao" rotulo="Revisão do peso do encerramento">{p => <SelectCampo {...p} className={classeInput} value={valor.acao} onValueChange={acao => onChange({ ...valor, acao: acao as DadosRevisaoPesoSecagem["acao"], peso: acao === "CORRIGIR" ? dadosDaPesagemSecagem(ativo.pesagem) : dadosPesoSecagemVazios() })}><option value="CONSERVAR">Conservar vínculo atual</option><option value="CORRIGIR" disabled={!!ativo.pesagem.referenciaHistorica}>Corrigir a pesagem vinculada{ativo.pesagem.referenciaHistorica ? " — exige reconciliação auditada" : ""}</option><option value="SUBSTITUIR">Substituir o vínculo</option><option value="DESVINCULAR">Desvincular peso, preservando a pesagem</option></SelectCampo>}</CampoFormulario>{fim !== ativo.pesagem.data.slice(0, 10) && <p className="text-sm text-ink-3">A nova data não coincide com a pesagem atual. Escolha corrigir, substituir ou desvincular o peso na mesma confirmação.</p>}{["CORRIGIR", "SUBSTITUIR"].includes(valor.acao) && <PesoSecagemCampos animalId={lactacao.animalId} propriedadeId={propriedadeId} dataEncerramento={fim} valor={valor.peso} onChange={peso => onChange({ ...valor, peso })} permitirAusente={false} escolhaFixa={valor.acao === "CORRIGIR"} />}</>}</section>;
}
