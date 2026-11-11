import { AjudaCampo } from "@/components/Dica";
import { formatarLitros } from "../leite/modelo";
import { useState } from "react";
import { Button, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { formatarDataBR } from "../lib/rotulos";
import { custoTexto } from "./componentes";
import { listarReferenciasLeite, revisarReferenciaLeite, type CandidatoReferenciaLeite, type FornecimentoLeiteNutricional } from "./api";
import { SelectCampo } from "@/financeiro/SelectCampo";

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
  return <div className="nutricao-referencia-leite">
    <div className="nutricao-referencia-leite-resumo">
      <div>
        <p><strong>{formatarLitros(Number(leite.quantidadeLitros))} fornecidos</strong></p>
        {leite.movimentos.length > 0 && <p>{leite.movimentos.map(m => `${formatarLitros(Number(m.quantidadeLitros))} ${m.natureza === "NAO_COMERCIAL" ? "não comerciais" : "comerciais"}`).join(" + ")}</p>}
        {verValores && <p>Custo de produção: <strong>{custoTexto(leite.custoProducao)}</strong></p>}
      </div>
      {verReferenciasComerciais && <div>
        <p>Referência gerencial <AjudaCampo rotulo="Sobre a referência gerencial" texto="A referência mostra o valor comercial dos litros. Ela não é somada ao custo de produção e não cria compra ou receita interna." /></p>
        <strong>{leite.referencia ? custoTexto(leite.referencia.valorTotal) : "Pendente — sem preço comprovado"}</strong>
        {leite.referencia && <p className="nutricao-secundario">{leite.referencia.provisoria ? "Provisória, mês anterior" : "Preço do período"} · versão {leite.referencia.versao}</p>}
      </div>}
    </div>
    {verReferenciasComerciais && <>
      {leite.referencias.length > 0 && <section className="nutricao-referencia-historico">
        <h3>Histórico das referências</h3>
        <ul>{leite.referencias.map(r => <li key={r.id}>
          <strong>Versão {r.versao}</strong> · {r.provisoria ? "provisória" : "do período"} · {formatarDataBR(r.periodoInicio)} a {formatarDataBR(r.periodoFim)} · {custoTexto(r.precoUnitario)}/L · {custoTexto(r.valorTotal)}
        </li>)}</ul>
      </section>}
      {podeLancar && leite.status === "CONFIRMADO" && <>
        <Button secondary className="justify-self-start" disabled={ocupado} onClick={() => void consultar()}>{ocupado ? "Consultando referências…" : "Conferir preço de referência"}</Button>
        <ErrorBox erro={erro} />
        {candidatos && <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void confirmar(); }}><fieldset className="grid gap-3" disabled={ocupado}>
          {!candidatos.length ? <p role="status">Não há fechamento comercial comprovado do mês do consumo ou do mês anterior. A referência permanece pendente.</p> : <>
            <label>Fechamento usado como referência<SelectCampo className={classeInput} required value={escolhido} onValueChange={(valor) => { setEscolhido(valor); setChave(crypto.randomUUID()); }}><option value="">Selecione a referência comprovada</option>{candidatos.map(c => <option key={c.fechamentoId} value={c.fechamentoId}>{c.comprador} · {formatarDataBR(c.periodoInicio)} a {formatarDataBR(c.periodoFim)} · {custoTexto(c.precoUnitario)}/L · {c.provisoria ? "provisória" : "do período"} · v{c.versao}</option>)}</SelectCampo></label>
            {candidatoEscolhido && <p className="text-sm break-words">Referência selecionada: {candidatoEscolhido.comprador} · {formatarDataBR(candidatoEscolhido.periodoInicio)} a {formatarDataBR(candidatoEscolhido.periodoFim)} · {custoTexto(candidatoEscolhido.precoUnitario)}/L · {candidatoEscolhido.provisoria ? "provisória" : "do período"} · versão {candidatoEscolhido.versao}.</p>}
            <label>Motivo da referência ou revisão<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e => { setMotivo(e.target.value); setChave(crypto.randomUUID()); }} /></label>
            <p className="text-sm">Confirmar cria uma versão auditada. Litros consumidos, origens e custo de produção são preservados.</p>
            <Button type="submit" disabled={ocupado || !escolhido || motivo.trim().length < 5}>Confirmar referência</Button>
          </>}
        </fieldset></form>}
      </>}
    </>}
    {leite.parcelas.length > 0 && <section className="nutricao-referencia-parcelas">
      <h3>Litros atribuídos por animal</h3>
      <TabelaFinanceira compacta rotulo="Litros atribuídos por animal" itens={leite.parcelas} chaveDe={p => p.animalId} colunas={[
        { chave: "animal", titulo: "Animal", principal: true, celula: p => animais.find(a => a.animalId === p.animalId)?.brinco ?? p.animalId },
        { chave: "litros", titulo: "Volume atribuído", alinhamento: "direita", celula: p => formatarLitros(Number(p.quantidadeLitros)) },
        { chave: "dias", titulo: "Dias no lote", alinhamento: "direita", celula: p => p.dias },
        ...(verReferenciasComerciais ? [{ chave: "referencia", titulo: "Referência gerencial", alinhamento: "direita" as const, celula: (p: FornecimentoLeiteNutricional["parcelas"][number]) => custoTexto(p.valorGerencial) }] : []),
      ]} />
    </section>}
  </div>;
}
