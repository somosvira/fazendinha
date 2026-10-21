import { Paginacao } from "../ui";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { escreverCustos, obterPreparatorios, type CustosDTO } from "./api";

type Candidato = Awaited<ReturnType<typeof obterPreparatorios>>["itens"][number];
type Props = {
  aoMudarPaginaVinculos?:(pagina:number)=>void;
  dados: CustosDTO | null;
  visivel: boolean;
  propriedadeId: number;
  tentativaId: string;
  chave: string;
  ocupado: boolean;
  motivo: string;
  aoMudarMotivo: (motivo: string) => void;
  aoAlterar: () => void;
  aoErro: (erro: string) => void;
  gravar: (acao: () => Promise<unknown>) => Promise<void>;
};

export function VinculosPreparatorios({ dados, aoMudarPaginaVinculos,visivel, propriedadeId, tentativaId, chave, ocupado, motivo, aoMudarMotivo, aoAlterar, aoErro, gravar }: Props) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [paginada,setPaginada]=useState({total:0,pagina:1,porPagina:10});
  const [preparo, setPreparo] = useState("");
  const [modo, setModo] = useState("INTEGRAL");
  const [material, setMaterial] = useState("");
  const [servico, setServico] = useState("");
  const sequencia = useRef(0);
  useEffect(() => () => { sequencia.current++; }, []);

  async function carregarPreparos(pagina=1) {
    const pedido = ++sequencia.current;
    try {
      const r = await obterPreparatorios(tentativaId, propriedadeId,pagina);
      if (pedido === sequencia.current) {setCandidatos(r.itens);setPaginada({total:r.total??r.itens.length,pagina:r.pagina??1,porPagina:r.porPagina??10});setPreparo("");}
    } catch (e) {
      if (pedido === sequencia.current) aoErro(e instanceof Error ? e.message : String(e));
    }
  }

  if (!visivel || !dados) return null;
  return <details onToggle={e => { if (e.currentTarget.open && !candidatos.length) void carregarPreparos(); }}>
    <summary className="cursor-pointer font-semibold">Vincular preparatório à tentativa</summary>
    <form className="mt-3 grid gap-3" onChange={aoAlterar} onSubmit={e => {
      e.preventDefault();
      const f = candidatos.find(f => `${f.tipo}:${f.id}` === preparo);
      if (!f) return;
      void gravar(() => escreverCustos("/preparatorios", { chave, propriedadeId, tentativaId, tipo: f.tipo, fonteId: f.id, modo, ...modo === "PARCELA" ? { valorMaterial: material || null, valorServico: servico || null } : {}, motivo }, propriedadeId));
    }}><fieldset className="grid gap-3" disabled={ocupado}>
      <label>Preparatório<select required className={classeInput} value={preparo} onChange={e => setPreparo(e.target.value)}>
        <option value="">Selecione um fato realizado</option>{candidatos.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.data} · {f.descricao}</option>)}
      </select></label>
      <Paginacao paginaAtual={paginada.pagina} totalPaginas={Math.max(1,Math.ceil(paginada.total/10))} totalItens={paginada.total} itensPorPagina={10} onPaginaChange={p=>void carregarPreparos(p)} rotulo="candidatos" idSelect="custos-candidatos-preparo"/>
      <label>Atribuição<select className={classeInput} value={modo} onChange={e => setModo(e.target.value)}>
        <option value="INTEGRAL">Integral, exclusiva desta tentativa</option><option value="PARCELA">Parcelas explícitas compartilhadas</option>
      </select></label>
      {modo === "PARCELA" && <>
        <label>Parcela do material (R$)<input className={classeInput} type="number" min="0" step="0.01" value={material} onChange={e => setMaterial(e.target.value)} /></label>
        <label>Parcela do Serviço (R$)<input className={classeInput} type="number" min="0" step="0.01" value={servico} onChange={e => setServico(e.target.value)} /></label>
        <p className="text-xs">O restante fica a atribuir no protocolo. Nenhuma despesa ou consumo é criado.</p>
      </>}
      <label>Motivo do vínculo<textarea className={classeInput} required minLength={5} maxLength={500} value={motivo} onChange={e => aoMudarMotivo(e.target.value)} /></label>
      <Button type="submit">Confirmar vínculo</Button>
    </fieldset></form>
    {dados.atribuicoesPreparos.flatMap(a => a.vinculos.filter(v => v.tentativaId === tentativaId).map(v => <div key={v.id} className="mt-2">
      <span>{a.descricao} · {v.modo}</span>
      <Button secondary disabled={ocupado} onClick={() => {
        if (motivo.trim().length < 5) {
          aoErro("Informe o motivo do encerramento no campo Motivo do vínculo.");
          return;
        }
        void gravar(() => escreverCustos(`/preparatorios/${v.id}/encerramento`, { chave, propriedadeId, motivo }, propriedadeId));
      }}>Encerrar vínculo com motivo</Button>
    </div>))}
    {dados.atribuicoesPaginadas&&aoMudarPaginaVinculos&&<Paginacao paginaAtual={dados.atribuicoesPaginadas.pagina} totalPaginas={Math.max(1,Math.ceil(dados.atribuicoesPaginadas.total/10))} totalItens={dados.atribuicoesPaginadas.total} itensPorPagina={10} onPaginaChange={aoMudarPaginaVinculos} rotulo="vínculos" idSelect="custos-vinculos-preparo"/>}
  </details>;
}
