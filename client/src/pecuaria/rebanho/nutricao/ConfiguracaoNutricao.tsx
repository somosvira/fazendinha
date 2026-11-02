import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox, hoje } from "@/financeiro/financeiro-ui";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { PropriedadeDTO } from "@/api/propriedades";
import type { Lote } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import * as api from "./mensal-api";
import { LinkNutricional } from "./componentes";

export const modelosNutricionais: Record<api.ModeloMensal, { nome: string; descricao: string; efeito: string }> = {
  AUTOMATICO: { nome: "Baixa automática diária", descricao: "O estoque é descontado diariamente. No fechamento mensal, confira os totais e ajuste diferenças com justificativa.", efeito: "O estoque confirmado muda a cada baixa diária bem-sucedida." },
  MANUAL: { nome: "Confirmar antes de baixar", descricao: "Confira um dia ou vários dias juntos, corrija quantidades e confirme a baixa. A conferência mensal revisa o conjunto, sem repetir as baixas.", efeito: "O estoque confirmado muda quando os dias são confirmados." },
  PROVISORIO: { nome: "Estimar e baixar no fechamento", descricao: "A estimativa diária reduz o saldo disponível estimado. No fechamento mensal, confira as quantidades e confirme a baixa.", efeito: "O estoque confirmado muda somente ao confirmar o mês. O saldo estimado permanece separado." },
};
function inicioMinimo(alteracao: boolean) {
  const d = new Date(hoje() + "T12:00:00Z");
  if (alteracao) { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); } else d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function prazoConfiguracao(desde: string, dia: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !Number.isInteger(dia) || dia < 1 || dia > 31) return null;
  const [ano, mes] = desde.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, Math.min(dia, new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
}
export function ConfiguracaoNutricao({ podeLancar, escopo, sitios, lotes, configs, onSalvo }: { podeLancar: boolean; escopo: number | null; sitios: PropriedadeDTO[]; lotes: Lote[]; configs: api.ConfiguracaoMensal[]; onSalvo: () => void }) {
  const [sitio, setSitio] = useState(String(escopo ?? ""));
  const [excecao, setExcecao] = useState(false), [lote, setLote] = useState("");
  const [modelo, setModelo] = useState<api.ModeloMensal>("AUTOMATICO"), [dia, setDia] = useState(5), [validade, setValidade] = useState(false);
  const [desde, setDesde] = useState(inicioMinimo(false)), [revisar, setRevisar] = useState(false), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  const anteriores = configs.filter(c => c.propriedadeId === Number(sitio) && (excecao ? c.loteId === lote || c.loteId === null : c.loteId === null));
  const alteracao = anteriores.length > 0;
  const minimo = inicioMinimo(alteracao);
  const vigente = anteriores.filter(c => c.desde.slice(0,10) <= hoje()).sort((a,b) => Number(!!b.loteId) - Number(!!a.loteId) || b.desde.localeCompare(a.desde))[0];
  useEffect(() => { setDesde(minimo); }, [sitio, lote, excecao, minimo]);
  const prazo = prazoConfiguracao(desde, dia);
  const dataValida = desde >= minimo && (!alteracao || desde.endsWith("-01"));
  async function salvar() {
    if (enviando.current || !podeLancar || !sitio || (excecao && !lote) || !dataValida || !prazo) return;
    enviando.current = true; setOcupado(true); setErro(null);
    try { await api.salvarConfiguracaoMensal({ propriedadeId: Number(sitio), loteId: excecao ? lote : null, modelo, diaConferencia: dia, autorizaValidade: validade, desde }); setRevisar(false); onSalvo(); }
    catch(e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { enviando.current = false; setOcupado(false); }
  }
  return <div className="nutricao-configuracao">
    {podeLancar ? <form onSubmit={e => { e.preventDefault(); if (dataValida && prazo) { setErro(null); setRevisar(true); } }}><fieldset disabled={ocupado}>
      <section><h2>Onde aplicar</h2><p>Use um padrão para o sítio ou configure um lote que precisa de outra rotina.</p><div className="mensal-campos">
        <label>Sítio<SelectCampo required value={sitio} onValueChange={v => { setSitio(v); setLote(""); }}><option value="">Selecione</option>{sitios.filter(s => escopo === null || s.id === escopo).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</SelectCampo></label>
        <label>Aplicar a<SelectCampo value={excecao ? "lote" : "sitio"} onValueChange={v => { setExcecao(v === "lote"); setLote(""); }}><option value="sitio">Padrão do sítio</option><option value="lote">Um lote específico</option></SelectCampo></label>
        {excecao && <label>Lote<SelectCampo required value={lote} onValueChange={setLote}><option value="">Selecione</option>{lotes.filter(l => l.ativo && l.propriedade.id === Number(sitio)).map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelectCampo></label>}
      </div><p className="mensal-ajuda">{excecao ? "A exceção vigente do lote prevalece sobre o padrão do sítio." : "Aplicável aos lotes sem uma exceção vigente."}</p>
      {sitio && <p className="nutricao-config-contexto">{vigente ? `Vigente: ${modelosNutricionais[vigente.modelo].nome} · conferência dia ${vigente.diaConferencia} · desde ${formatarDataBR(vigente.desde)}.` : "Nenhuma configuração vigente neste contexto."}</p>}</section>
      <section><h2>Como dar baixa no estoque</h2><p>O consumo diário considera a dieta vigente e os animais presentes em cada dia.</p><fieldset><legend className="sr-only">Modelo de consumo</legend>{(Object.keys(modelosNutricionais) as api.ModeloMensal[]).map(m => <label className="mensal-opcao" key={m}><input type="radio" name="modeloMensal" value={m} checked={modelo === m} onChange={() => setModelo(m)} /><span><strong>{modelosNutricionais[m].nome}{m === "AUTOMATICO" ? " · recomendado" : ""}</strong><span>{modelosNutricionais[m].descricao}</span><small>{modelosNutricionais[m].efeito}</small></span></label>)}</fieldset></section>
      <section><h2>Conferência mensal e início</h2><p>O consumo é agrupado por mês civil. Escolha o prazo para conferir o mês anterior.</p><div className="mensal-campos"><label>Dia da conferência no mês seguinte<input type="number" required min={1} max={31} value={dia} onChange={e => setDia(Number(e.target.value))} /></label><label>Válido a partir de<input type="date" required min={minimo} value={desde} onChange={e => setDesde(e.target.value)} /></label></div><p className="mensal-ajuda">{alteracao ? "Alterações começam no primeiro dia de um mês seguinte. Meses iniciados são preservados." : "A primeira ativação pode começar amanhã ou depois, com mês inicial parcial."} Dias inexistentes vencem no último dia do mês.</p>{!dataValida && <p role="alert">Escolha {alteracao ? "o primeiro dia de um mês" : "uma data"} a partir de {formatarDataBR(minimo)}.</p>}{prazo && dataValida && <div className="nutricao-config-contexto"><strong>Consumo de {desde.slice(0,7).split("-").reverse().join("/")} → conferência em {formatarDataBR(prazo)}</strong><p>Na data escolhida, o fechamento aparece em Alertas da Nutrição. Se não for conferido, permanece como atrasado.</p></div>}</section>
      <section><h2>Seleção dos produtos no estoque</h2><p>Defina se o sistema pode escolher as partidas para as baixas.</p><label className="nutricao-config-check"><input type="checkbox" checked={validade} onChange={e => setValidade(e.target.checked)} />Autorizar seleção dos lotes de produto com menor validade.</label><p className="mensal-ajuda">Partidas vencidas na data do consumo são bloqueadas; validade desconhecida exige seleção manual. Falta de saldo ou valor comprovado gera pendência.</p></section>
      <div className="nutricao-config-rodape"><span>O histórico e as configurações anteriores são preservados.</span><LinkNutricional className="nutricao-botao-secundario" href="/pecuaria/nutricao">Cancelar</LinkNutricional><Button type="submit" disabled={!sitio || (excecao && !lote) || !dataValida || !prazo || ocupado}>Revisar configuração</Button></div>
    </fieldset></form> : <p>Seu perfil pode consultar as configurações.</p>}
    <section><h2>Configurações registradas</h2>{configs.length ? <div className="nutricao-tabela-scroll"><table className="nutricao-tabela consulta-tabela"><thead><tr><th>Aplicação</th><th>Modelo</th><th>Conferência</th><th>Vigência</th></tr></thead><tbody>{configs.map(c => <tr key={c.id}><td>{sitios.find(s => s.id === c.propriedadeId)?.nome} · {c.loteId ? lotes.find(l => l.id === c.loteId)?.nome : "Padrão do sítio"}</td><td>{modelosNutricionais[c.modelo].nome}</td><td>Dia {c.diaConferencia}</td><td>Desde {formatarDataBR(c.desde)}</td></tr>)}</tbody></table></div> : <p>Nenhuma configuração registrada.</p>}</section>
    <Dialog open={revisar} onOpenChange={v => { if (!ocupado) setRevisar(v); }}><DialogContent><DialogHeader><DialogTitle>Revisar configuração</DialogTitle><DialogDescription>Confira o escopo, a vigência e o efeito no estoque antes de confirmar.</DialogDescription></DialogHeader><ErrorBox erro={erro} /><dl className="nutricao-config-resumo"><dt>Aplicação</dt><dd>{sitios.find(s => s.id === Number(sitio))?.nome} · {excecao ? lotes.find(l => l.id === lote)?.nome : "Padrão do sítio"}</dd><dt>Modelo</dt><dd>{modelosNutricionais[modelo].nome}</dd><dt>Efeito no estoque</dt><dd>{modelosNutricionais[modelo].efeito}</dd><dt>Início e conferência</dt><dd>{formatarDataBR(desde)} · conferência dia {dia} do mês seguinte</dd><dt>Seleção de partidas</dt><dd>{validade ? "Automática, por menor validade elegível" : "Sem autorização de seleção automática"}</dd></dl><p>Esta configuração não atribui dietas nem altera meses anteriores.</p><DialogFooter><Button secondary disabled={ocupado} onClick={() => setRevisar(false)}>Voltar</Button><Button disabled={ocupado} onClick={() => void salvar()}>{ocupado ? "Salvando…" : "Confirmar configuração"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
