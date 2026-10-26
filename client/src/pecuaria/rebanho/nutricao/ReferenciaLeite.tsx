import { AjudaCampo } from "@/components/Dica";
import { formatarLitros } from "../leite/modelo";
import { useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { custoTexto } from "./componentes";
import { listarReferenciasLeite, revisarReferenciaLeite, type CandidatoReferenciaLeite, type FornecimentoLeiteNutricional } from "./api";

export function ReferenciaLeite({ leite, propriedadeId, verValores, verReferenciasComerciais, animais, podeLancar, onRecarregar }: { leite: FornecimentoLeiteNutricional; propriedadeId: number; verValores: boolean; verReferenciasComerciais: boolean; animais: { animalId: string; brinco: string }[]; podeLancar: boolean; onRecarregar?: () => Promise<void> }) {
  const [candidatos,setCandidatos] = useState<CandidatoReferenciaLeite[] | null>(null);
  const [escolhido,setEscolhido] = useState("");
  const [motivo,setMotivo] = useState("");
  const [erro,setErro] = useState<string | null>(null);
  const [ocupado,setOcupado] = useState(false);
  const [chave,setChave] = useState(() => crypto.randomUUID());
  async function consultar() { setOcupado(true); setErro(null); try { setCandidatos((await listarReferenciasLeite(leite.id)).itens); } catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); } }
  async function confirmar() { if (!escolhido || ocupado) return; setOcupado(true); setErro(null);
    try { await revisarReferenciaLeite(leite.id, { chave, propriedadeId, fechamentoId: escolhido, versaoEsperada: leite.referencia?.versao ?? 0, motivo }); await onRecarregar?.(); setCandidatos(null); setEscolhido(""); setMotivo(""); setChave(crypto.randomUUID()); }
    catch(e) { setErro(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }
  const candidatoEscolhido = candidatos?.find(c => c.fechamentoId === escolhido);
  return <div className="grid gap-3 py-3">
    <p><strong>{formatarLitros(Number(leite.quantidadeLitros))} fornecidos</strong> · {leite.movimentos.map(m => `${formatarLitros(Number(m.quantidadeLitros))} ${m.natureza === "NAO_COMERCIAL" ? "não comerciais" : "comerciais"}`).join(" + ")}</p>
    {verValores && <p>Custo de produção: <strong>{custoTexto(leite.custoProducao)}</strong></p>}
    {verReferenciasComerciais && <><p>Referência gerencial: <AjudaCampo rotulo="Sobre a referência gerencial" texto={"A referência mostra o valor comercial dos litros. Ela não é somada ao custo de produção e não cria compra ou receita interna."} /> <strong>{leite.referencia ? custoTexto(leite.referencia.valorTotal) : "Pendente — sem preço comprovado"}</strong>{leite.referencia && <> ({leite.referencia.provisoria ? "provisória, mês anterior" : "preço do período"} · versão {leite.referencia.versao})</>}</p>

      {!!leite.referencias.length && <details><summary className="cursor-pointer">Histórico das referências</summary>{leite.referencias.map(r => <p key={r.id} className="mt-2 text-sm">Versão {r.versao} · {r.provisoria ? "provisória" : "do período"} · {formatarDataBR(r.periodoInicio)} a {formatarDataBR(r.periodoFim)} · {custoTexto(r.precoUnitario)}/L · {custoTexto(r.valorTotal)} · {r.motivo}</p>)}</details>}
      {podeLancar && leite.status === "CONFIRMADO" && <>
        <Button secondary disabled={ocupado} onClick={() => void consultar()}>{ocupado ? "Consultando referências…" : "Conferir preço de referência"}</Button>
        <ErrorBox erro={erro} />
        {candidatos && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void confirmar(); }}><fieldset className="grid gap-3" disabled={ocupado}>
          {!candidatos.length ? <p role="status">Não há fechamento comercial comprovado do mês do consumo ou do mês anterior. A referência permanece pendente.</p> : <>
            <label>Fechamento usado como referência<select className={classeInput} required value={escolhido} onChange={e => { setEscolhido(e.target.value); setChave(crypto.randomUUID()); }}><option value="">Selecione a referência comprovada</option>{candidatos.map(c => <option key={c.fechamentoId} value={c.fechamentoId}>{c.comprador} · {formatarDataBR(c.periodoInicio)} a {formatarDataBR(c.periodoFim)} · {custoTexto(c.precoUnitario)}/L · {c.provisoria ? "provisória" : "do período"} · v{c.versao}</option>)}</select></label>
            {candidatoEscolhido && <p className="text-sm break-words">Referência selecionada: {candidatoEscolhido.comprador} · {formatarDataBR(candidatoEscolhido.periodoInicio)} a {formatarDataBR(candidatoEscolhido.periodoFim)} · {custoTexto(candidatoEscolhido.precoUnitario)}/L · {candidatoEscolhido.provisoria ? "provisória" : "do período"} · versão {candidatoEscolhido.versao}.</p>}
            <label>Motivo da referência ou revisão<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e => { setMotivo(e.target.value); setChave(crypto.randomUUID()); }} /></label>
            <p className="text-sm">Confirmar cria uma versão auditada. Litros consumidos, origens e custo de produção são preservados.</p>
            <Button type="submit" disabled={ocupado || !escolhido || motivo.trim().length < 5}>Confirmar referência</Button>
          </>}
        </fieldset></form>}
      </>}
    </>}
    <details><summary className="cursor-pointer">Litros atribuídos por animal</summary>{leite.parcelas.map(p => <p key={p.animalId} className="mt-2 text-sm">Animal {animais.find(a => a.animalId === p.animalId)?.brinco ?? p.animalId}: {formatarLitros(Number(p.quantidadeLitros))} atribuídos por {p.dias} dias{verReferenciasComerciais && <> · referência {custoTexto(p.valorGerencial)}</>}</p>)}</details>
  </div>;
}
