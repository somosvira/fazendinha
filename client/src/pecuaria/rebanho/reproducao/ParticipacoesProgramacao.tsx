import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Check, Clock3, X, Minus, UserMinus } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Dica, AjudaCampo } from "../../../components/Dica";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { consultaProtocolo, obterTarefasProtocolo, obterEtapasProtocolo, reqProtocolo, type EtapaProtocolo, type TarefaOperacional } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";
import type { ParticipanteIatf } from "./Iatf";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { RevisaoBloqueioParticipacao } from "./RevisaoBloqueioParticipacao";
import type { BloqueioParticipacao } from "./revisao-impacto-api";
import { Pill } from "../../../financeiro/financeiro-ui";
import { Empty } from "@/financeiro/financeiro-ui";

type Participacao = Omit<ParticipanteIatf, "tarefas"> & BloqueioParticipacao;
/** Consulta individual explícita: nenhuma data coletiva substitui a participação. */
export function ParticipacoesProgramacao({ id, propriedadeId, revisao, aoRetirar, acoes, podeRevisarBloqueio, aoRevisarBloqueio }: { id: string; propriedadeId?: number; revisao: number; aoRetirar?: (id: string) => void; acoes?: ReactNode; podeRevisarBloqueio?: boolean; aoRevisarBloqueio?: () => void }) {
  const [etapas, setEtapas] = useState<EtapaProtocolo[]>([]);
  const [tarefas, setTarefas] = useState<Record<string,TarefaOperacional[]>>({});
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaProtocolo<Participacao> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [revisando, setRevisando] = useState<Participacao | null>(null);
  const [mensagem, setMensagem] = useState("");
  const podeRevisar = (podeRevisarBloqueio ?? Boolean(aoRetirar)) && propriedadeId != null;
  useEffect(() => {
    let vigente = true; setDados(null); setErro(null);
    reqProtocolo<PaginaProtocolo<Participacao>>(`/programacoes/${encodeURIComponent(id)}/participantes${consultaProtocolo({ pagina, busca })}`, propriedadeId)
      .then(async d => {
        const primeira = await obterEtapasProtocolo({programacaoId:id}, 1, propriedadeId);
        const todas = [...primeira.itens];
        for (let pagina = 2; vigente && pagina <= Math.ceil(primeira.total / primeira.porPagina); pagina++) todas.push(...(await obterEtapasProtocolo({programacaoId:id}, pagina, propriedadeId)).itens);
        const linhas = await Promise.all(d.itens.map(async p => {
          const primeira = await obterTarefasProtocolo({participacaoId:p.id}, {pagina:1}, propriedadeId);
          const itens = [...primeira.itens];
          for(let pagina=2; vigente && pagina<=Math.ceil(primeira.total/primeira.porPagina); pagina++) itens.push(...(await obterTarefasProtocolo({participacaoId:p.id},{pagina},propriedadeId)).itens);
          return [p.id,itens] as const;
        }));
        if(vigente){setEtapas(todas);setTarefas(Object.fromEntries(linhas));setDados(d);}
      }).catch(e => { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar as participações."); });
    return () => { vigente = false; };
  }, [id, propriedadeId, pagina, busca, revisao, tentativa]);
  return <SecaoRecolhivel recolhivel={false} className="ficha-geral-secao protocolo-etapa-ficha repro-participacoes" titulo={<span className="inline-flex items-center gap-2">Participantes <AjudaCampo rotulo="Legenda das etapas" texto="Check: atendido. Relógio: pendente, inclusive agendado. X: não atendido, dispensado ou retirado. Passe o mouse ou foque o ícone para ver o detalhe."/></span>} acoes={acoes}>
    <Input aria-label="Buscar animal nas participações" placeholder="Buscar animal nas participações" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}/>
    {mensagem && <p role="status">{mensagem}</p>}
    <ErrorBox erro={erro}/>{erro ? <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Atualizar participações individuais</Button> : !dados ? <p role="status">Consultando participações individuais…</p> : <>
      <div className="protocolo-tabela mt-4"><Table containerLabel="Participantes por etapa" aria-label="Participantes por etapa"><TableHeader><TableRow><TableHead>Animal</TableHead>{etapas.map(e=><TableHead key={e.id}>{e.unidadeIntervalo === "HORAS" ? "H" : "D"}{e.diaRelativo} · {e.nome}</TableHead>)}<TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
      {dados.itens.map(p=><TableRow key={p.id}><TableCell><LinkReproducao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}?participacaoId=${encodeURIComponent(p.id)}&programacaoId=${encodeURIComponent(id)}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#reproducao`}>{p.animal?.brinco ?? "Animal"}{p.animal?.nome ? ` · ${p.animal.nome}` : ""}</LinkReproducao>{p.bloqueadaEm && <div className="mt-2 space-y-1"><Pill tone="amber">Participação bloqueada</Pill><p className="text-sm text-ink-3">{p.motivoBloqueio || "Motivo não informado."}</p>
        {podeRevisar && !p.encerradoEm && <Button variant="outline" size="sm" onClick={() => setRevisando(p)}>Revisar bloqueio</Button>}</div>}</TableCell>{etapas.map(e=>{
        const t=tarefas[p.id]?.find(t=>t.etapaId===e.id);
        const feito=t?.situacao === "ATENDIDO";
        const ausente=!!t && ["NAO_ATENDIDO","RETIRADO","DISPENSADO","ENCERRADO"].includes(t.situacao);
        const rotulos:Record<string,string>={ATENDIDO:"Atendido",NAO_ATENDIDO:"Não atendido",RETIRADO:"Retirado do protocolo",DISPENSADO:"Dispensado",ENCERRADO:"Encerrado sem substituição",PREVISTO:"Pendente · agendado",SEM_REGISTRO:"Sem atendimento registrado",ADIADO:"Pendente · adiado",REGULARIZACAO_PENDENTE:"Pendente · regularização"};
        const rotulo=t ? rotulos[t.situacao] ?? "Pendente" : "Sem tarefa vinculada";
        const Icone=feito ? Check : ausente ? X : t ? Clock3 : Minus;
        return <TableCell key={e.id}><Dica rotulo={`${e.nome}: ${rotulo}`} conteudo={<>{rotulo}{t?.ultimoEvento?.motivo && <p>{t.ultimoEvento.motivo}</p>}</>}><Icone size={18} className={feito ? "text-emerald-700" : ausente ? "text-red-600" : "text-ink-3"}/></Dica></TableCell>;
      })}<TableCell>{aoRetirar && !p.encerradoEm && <Button
        variant="outline" size="icon" className="text-destructive hover:text-destructive"
        aria-label={`Retirar do protocolo: ${p.animal?.brinco ?? "Animal"}`}
        title="Retirar do protocolo" onClick={() => aoRetirar(p.id)}>
        <UserMinus aria-hidden="true" />
      </Button>}</TableCell></TableRow>)}
      </TableBody></Table></div>
      {!dados.total && <Empty>Nenhuma participação corresponde à busca.</Empty>}
      {dados.total > dados.porPagina && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} totalItens={dados.total} itensPorPagina={dados.porPagina} onPaginaChange={setPagina} rotulo="participações" idSelect="participacoes-individuais-programacao"/>}
    </>}
    {revisando?.bloqueadaEm && propriedadeId != null && podeRevisar && <RevisaoBloqueioParticipacao
      key={`${revisando.id}:${revisando.bloqueadaEm}`}
      participacaoId={revisando.id} animal={[revisando.animal?.brinco || "Animal", revisando.animal?.nome].filter(Boolean).join(" · ")}
      propriedadeId={propriedadeId} bloqueadaEm={revisando.bloqueadaEm} motivoBloqueio={revisando.motivoBloqueio}
      aoFechar={()=>setRevisando(null)} aoReconsultar={()=>{setRevisando(null);setTentativa(v=>v+1);}}
      aoConfirmar={destino=>{setRevisando(null);setTentativa(v=>v+1);setMensagem(destino==="RETOMAR"?"Revisão registrada. O bloqueio operacional da participação foi removido.":"Revisão registrada. A participação foi retirada do protocolo.");aoRevisarBloqueio?.();}}
    />}
  </SecaoRecolhivel>;
}
