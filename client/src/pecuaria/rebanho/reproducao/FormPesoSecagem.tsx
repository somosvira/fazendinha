import { useEffect, useRef, useState } from "react";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { RebanhoApiError } from "../api";
import { formatarDataBR } from "../lib/rotulos";
import { reqV4, type LactacaoReprodutiva, type PesoSecagemInput } from "./api";
import { PesoSecagemCampos } from "./PesoSecagemCampos";
import { dadosDaPesagemSecagem, dadosPesoSecagemVazios, pesoSecagemPayload, validarPesoSecagem, vinculoSecagemAtivo } from "./peso-secagem";

type Acao = "ADICIONAR" | "CORRIGIR" | "SUBSTITUIR" | "DESVINCULAR";
export function FormPesoSecagem({ lactacao, propriedadeId, onFechar, onSalvo }: { lactacao: LactacaoReprodutiva; propriedadeId?: number; onFechar: () => void; onSalvo: () => void | Promise<void> }) {
  const ativo = vinculoSecagemAtivo(lactacao);
  const [acao, setAcao] = useState<Acao>(ativo ? ativo.pesagem.referenciaHistorica ? "SUBSTITUIR" : "CORRIGIR" : "ADICIONAR");
  const [peso, setPeso] = useState(() => ativo && !ativo.pesagem.referenciaHistorica ? dadosDaPesagemSecagem(ativo.pesagem) : dadosPesoSecagemVazios());
  const [motivo, setMotivo] = useState(""), [erro, setErro] = useState<string | null>(null), [erros, setErros] = useState<Record<string, string>>({}), [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false), envio = useRef<{ payload: string; chave: string } | null>(null);
  useEffect(() => { const campo = Object.keys(erros)[0]; document.getElementById(campo === "motivo" ? "secagem-motivo-alteracao" : `peso-secagem-${campo}`)?.focus(); }, [erros]);
  async function salvar() {
    if (emCurso.current) return;
    const falhas = acao === "DESVINCULAR" ? {} : validarPesoSecagem(peso, lactacao.encerradaEm?.slice(0, 10) ?? "", propriedadeId, false);
    if (motivo.trim().length < 5) falhas.motivo = "Informe o motivo da alteração com ao menos cinco caracteres.";
    setErros(falhas); setErro(null); if (Object.keys(falhas).length) return;
    if (!propriedadeId || !lactacao.encerradaEm) { setErro("A manutenção exige lactação encerrada e sítio do fato identificado."); return; }
    let pesoSecagem: PesoSecagemInput;
    const motivoRevisao = motivo.trim();
    if (acao === "DESVINCULAR" && ativo) pesoSecagem = { acao: "DESVINCULAR", vinculoId: ativo.id, motivo: motivoRevisao };
    else if (acao === "CORRIGIR" && ativo && !ativo.pesagem.referenciaHistorica) pesoSecagem = { acao: "CORRIGIR", vinculoId: ativo.id, data: peso.data, pesoKg: Number(peso.pesoKg), origem: peso.origem, precisao: peso.precisao, observacao: peso.observacao.trim() || null, motivo: motivoRevisao };
    else {
      const escolha = pesoSecagemPayload(peso);
      if (escolha.acao === "NAO_INFORMAR") return;
      pesoSecagem = acao === "SUBSTITUIR" && ativo ? { acao: "SUBSTITUIR", vinculoId: ativo.id, motivo: motivoRevisao, pesagem: escolha } : escolha;
    }
    const corpo = { propriedadeId, versaoEsperada: lactacao.versao, motivo: motivoRevisao, pesoSecagem };
    const payload = JSON.stringify(corpo); if (envio.current?.payload !== payload) envio.current = { payload, chave: crypto.randomUUID() };
    emCurso.current = true; setOcupado(true);
    try { await reqV4(`/reproducao/lactacoes/${lactacao.id}/peso-secagem`, { ...corpo, chave: envio.current.chave }, "POST", propriedadeId); await onSalvo(); }
    catch (e) { const mensagem = e instanceof Error ? e.message : String(e); const campo = e instanceof RebanhoApiError ? e.campo?.replace(/^pesoSecagem(?:\.(?:pesagem\.)?|$)/, "") : undefined; if (campo && ["motivo", ...(acao !== "CORRIGIR" && acao !== "DESVINCULAR" ? ["acao"] : []), ...(acao === "DESVINCULAR" ? [] : peso.acao === "REGISTRAR" ? ["data", "pesoKg", "origem", "precisao", "observacao"] : peso.acao === "VINCULAR" ? ["pesagemId"] : [])].includes(campo)) setErros({ [campo]: mensagem }); else setErro(mensagem); }
    finally { emCurso.current = false; setOcupado(false); }
  }
  return <PainelCadastro aberto titulo={ativo ? "Revisar vínculo do peso" : "Adicionar peso ao encerramento"} onFechar={onFechar} bloqueado={ocupado} rodape={<><Button secondary disabled={ocupado} onClick={onFechar}>Cancelar</Button><Button type="submit" form="form-peso-secagem" disabled={ocupado}>{ocupado ? "Salvando…" : acao === "DESVINCULAR" ? "Desvincular peso" : ativo ? "Salvar alteração" : "Adicionar peso"}</Button></>}>
    <form id="form-peso-secagem" noValidate className="grid gap-5" onSubmit={e => { e.preventDefault(); void salvar(); }}><ErrorBox erro={erro} /><p className="text-sm">Lactação de {formatarDataBR(lactacao.inicio)} a {lactacao.encerradaEm ? formatarDataBR(lactacao.encerradaEm) : "encerramento não informado"}.</p>
      {ativo && <CampoFormulario id="peso-secagem-revisao" rotulo="O que deseja alterar?">{p => <SelectCampo {...p} className={classeInput} value={acao} onValueChange={valor => { const nova = valor as Acao; setAcao(nova); setErros({}); setPeso(nova === "CORRIGIR" ? dadosDaPesagemSecagem(ativo.pesagem) : dadosPesoSecagemVazios()); }}><option value="CORRIGIR" disabled={!!ativo.pesagem.referenciaHistorica}>Corrigir a pesagem vinculada{ativo.pesagem.referenciaHistorica ? " — exige reconciliação auditada" : ""}</option><option value="SUBSTITUIR">Substituir o vínculo</option><option value="DESVINCULAR">Desvincular o peso</option></SelectCampo>}</CampoFormulario>}
      {acao === "DESVINCULAR" ? <p className="rounded-lg bg-surface-2 p-4 text-sm">Somente a associação com esta lactação será desfeita. A pesagem e o encerramento serão preservados.</p> : <PesoSecagemCampos animalId={lactacao.animalId} propriedadeId={propriedadeId} dataEncerramento={lactacao.encerradaEm?.slice(0, 10) ?? ""} valor={peso} onChange={setPeso} erros={erros} permitirAusente={false} escolhaFixa={acao === "CORRIGIR"} />}
      {acao === "SUBSTITUIR" && <p className="text-sm text-ink-3">O vínculo anterior será revogado. A pesagem anterior continua no histórico do animal.</p>}
      <CampoFormulario id="secagem-motivo-alteracao" rotulo="Motivo da alteração" obrigatorio erro={erros.motivo}>{p => <textarea {...p} className={classeInput} required minLength={5} maxLength={1000} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} />}</CampoFormulario>
      <p className="text-xs text-ink-3">As alterações conservam autoria e histórico. Dados incompatíveis e registros importados exigem revisão auditada.</p>
    </form>
  </PainelCadastro>;
}
