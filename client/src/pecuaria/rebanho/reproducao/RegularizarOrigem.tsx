import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { reqV4 } from "./api";
export type EventoRegularizacao = { acao?: string; destinoConsumo?: string | null };
export function consumoMantidoUltimaAnulacao(historico?: EventoRegularizacao[]) {
  return [...(historico ?? [])].reverse().find(e => e.acao === "FATO_ANULADO")?.destinoConsumo === "MANTER_CONSUMO";
}
export function RegularizarOrigem({path, propriedadeId, consumoMantido, reabrirPermitido = true, onMudou}: {path:string;propriedadeId:number;consumoMantido:boolean;reabrirPermitido?:boolean;onMudou:()=>Promise<void>}) {
  const [aberto,setAberto]=useState(false), [motivo,setMotivo]=useState(""), [fatoId,setFatoId]=useState("");
  const [acao,setAcao]=useState("ENCERRAR_SEM_SUBSTITUICAO"), [ciencia,setCiencia]=useState(false);
  const [erro,setErro]=useState<string|null>(null), [ocupado,setOcupado]=useState(false);
  const [chave,setChave]=useState(()=>crypto.randomUUID());
  const [substitutos, setSubstitutos] = useState<Array<{id:string; descricao:string}>>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState<string|null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    if (!aberto || acao !== "VINCULAR_SUBSTITUTO") return;
    let vigente = true;
    setCarregando(true); setErroConsulta(null); setSubstitutos([]);
    reqV4<Array<{id:string;descricao:string}>>(path.replace(/\/regularizacao$/, "/substitutos") + `?propriedadeId=${propriedadeId}`, undefined, "GET", propriedadeId)
      .then(r => { if (vigente) setSubstitutos(r); })
      .catch(e => { if (vigente) setErroConsulta(e.message); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [aberto, acao, path, propriedadeId, revisao]);
  const semSubstituto = acao === "VINCULAR_SUBSTITUTO" && (carregando || !!erroConsulta || !substitutos.some(s => s.id === fatoId));
  return <><Button secondary onClick={()=>{setChave(crypto.randomUUID());setMotivo("");setCiencia(false);setErro(null);setAcao("ENCERRAR_SEM_SUBSTITUICAO");setFatoId("");setAberto(true);}}>Regularizar origem do fato anulado</Button>
    {aberto && <PainelCadastro aberto titulo="Regularizar origem" onFechar={()=>setAberto(false)} bloqueado={ocupado}
      rodape={<Button type="submit" form={`regularizar-${chave}`} disabled={ocupado || semSubstituto}>Confirmar regularização</Button>}>
      <form id={`regularizar-${chave}`} className="grid gap-4" onSubmit={e=>{
        e.preventDefault();
        if (semSubstituto || ocupado) return;
        setOcupado(true);setErro(null);
        reqV4(path,{propriedadeId,chave,motivo,acao,...(acao === "REABRIR" ? {cienciaNaoExecutado:ciencia}:{}),...(acao === "VINCULAR_SUBSTITUTO"?{fatoId}:{})}, "POST", propriedadeId)
          .then(async()=>{setAberto(false);await onMudou();}).catch(e=>setErro(e.message)).finally(()=>setOcupado(false));
      }}>
        <ErrorBox erro={erro}/><p className="text-sm">O vínculo e a execução anteriores permanecem no histórico. {consumoMantido && "O consumo foi mantido; a origem não pode ser reaberta para executar novamente."}</p>
        <label>Ação<select className={classeInput} value={acao} onChange={e=>{setAcao(e.target.value);setFatoId("");}}><option value="ENCERRAR_SEM_SUBSTITUICAO">Encerrar sem substituição</option><option value="REABRIR" disabled={consumoMantido || !reabrirPermitido}>Reabrir pendência</option><option value="VINCULAR_SUBSTITUTO">Vincular fato substituto comprovado</option></select></label>
        {acao === "REABRIR" && <label><input type="checkbox" required checked={ciencia} onChange={e=>setCiencia(e.target.checked)}/> Confirmo que o procedimento não foi executado fisicamente.</label>}
        {acao === "VINCULAR_SUBSTITUTO" && <>
          {carregando && <p role="status">Consultando fatos disponíveis…</p>}
          <ErrorBox erro={erroConsulta}/>
          {erroConsulta && <Button secondary onClick={()=>setRevisao(v=>v+1)}>Tentar consulta novamente</Button>}
          {!carregando && !erroConsulta && !substitutos.length && <p>Nenhum fato substituto compatível disponível. Registre o procedimento comprovado antes de vinculá-lo.</p>}
          <label>Fato substituto comprovado<select required className={classeInput} disabled={carregando || !!erroConsulta} value={fatoId} onChange={e=>setFatoId(e.target.value)}>
            <option value="">Selecione o procedimento registrado</option>
            {substitutos.map(s=><option key={s.id} value={s.id}>{s.descricao}</option>)}
          </select></label>
          <p className="text-sm">Vincular reutiliza o fato registrado e seus efeitos. Esta ação não registra outro procedimento ou despesa.</p>
        </>}
        <label>Motivo<textarea required minLength={5} className={classeInput} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label>
      </form>
    </PainelCadastro>}
  </>;
}
