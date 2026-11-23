import { useState } from "react";
import { Syringe, Milk, Beef } from "lucide-react";
import { CartaoConsulta, FatoConsulta, LinhaTempoConsulta } from "@/components/ConsultaVisual";
import { TabelaFinanceira, Empty } from "@/financeiro/financeiro-ui";
import { SubTabs } from "../../../components/SubTabs";
import type { ExameResultado } from "./ResultadoExame";
import type { AplicacaoSanitaria, CarenciaAnimal } from "./api";
import { dataAplicacaoSanitaria, nomeAnimalSanitario, origemSanitaria, tipoSanitario, unidadeSanitaria } from "./rotulos";
import { PrazoCarencia } from "./IndicadoresSanitarios";
import "./consultas-visuais.css";
import { ICONES_TABELA } from "@/components/iconesTabela";

type Props<T> = Parameters<typeof TabelaFinanceira<T>>[0];
type ExameVisual = ExameResultado & { data: string; status: string; tipoExame: { nome: string } };
export function ConsultaExames<T extends ExameVisual>({ nomeAnimal: _nomeAnimal, abas, ...props }: Props<T> & { nomeAnimal: (e: T) => string; abas?: React.ReactNode }) {
  return <>{abas && <div className="consulta-visual-barra sanidade-agenda-visoes">{abas}</div>}<TabelaFinanceira icone={ICONES_TABELA.exame} {...props} />{!props.itens.length && <Empty>Nenhum exame nesta consulta.</Empty>}</>;
}
export function ConsultaAplicacoes(props: Props<AplicacaoSanitaria>) {
  const [mostrarCronologia, setMostrarCronologia] = useState(false);
  const cartao = (a: AplicacaoSanitaria) => <CartaoConsulta key={props.chaveDe(a)} icon={Syringe}
    titulo={a.animal ? nomeAnimalSanitario(a.animal) : "Aplicação sanitária"} detalhe={tipoSanitario(a)}
    onAbrir={props.onAbrir && (() => props.onAbrir?.(a))}
    status={props.colunas.find(c => c.chave === "situacao")?.celula(a)}
    acoes={props.colunas.find(c => c.chave === "acoes")?.celula(a)}>
    <div className="consulta-fatos">
      <FatoConsulta rotulo="Produto">{a.nomeProdutoAplicado || a.produto?.nome || "Não informado"}</FatoConsulta>
      <FatoConsulta rotulo="Dose"><strong>{a.dose} {unidadeSanitaria(a.unidadeDose)}</strong></FatoConsulta>
      <FatoConsulta rotulo="Origem">{origemSanitaria(a.origemInsumo)}</FatoConsulta>
      <FatoConsulta rotulo="Registro">{dataAplicacaoSanitaria(a)}</FatoConsulta>
    </div>
    {a.status === "ANULADO" && a.consumoMantido && <p className="mt-3 text-sm text-muted-foreground">Consumo mantido no histórico.</p>}
  </CartaoConsulta>;

  return <>
    <div className="consulta-visual-barra sanidade-agenda-visoes">
      <SubTabs variant="financeiro" aparencia="segmentado" ariaLabel="Visão das aplicações" active={mostrarCronologia ? "linha" : "lista"} onSelect={v => setMostrarCronologia(v === "linha")} tabs={[{ id: "lista", label: "Lista" }, { id: "linha", label: "Linha do tempo" }]} />
    </div>
    {!props.itens.length ? <Empty>Nenhuma aplicação sanitária registrada neste recorte.</Empty> :
      mostrarCronologia ? <LinhaTempoConsulta rotulo="Histórico de aplicações" itens={props.itens}
        dataDe={a => a.data} chaveDe={a => String(props.chaveDe(a))} render={cartao} /> :
      <TabelaFinanceira icone={ICONES_TABELA.aplicacao} {...props} />}
  </>;
}
type CarenciaVisual = CarenciaAnimal & { animal: { id: string; brinco: string; nome: string | null } };
export function ConsultaCarencias<T extends CarenciaVisual>(props: Props<T>) {
  const [mostrarPrazos, setMostrarPrazos] = useState(false);
  const agora = Date.now();
  const datas = props.itens.flatMap(c => [c.leite, c.carne].flatMap(p => p.estado === "CONHECIDO" && !p.prazoZero ? [new Date(p.ate).getTime()] : [])).filter(Number.isFinite);
  const minimo = Math.min(agora, ...datas) - 86400000;
  const maximo = Math.max(agora, ...datas) + 86400000;
  const posicao = (n: number) => `${(n - minimo) / (maximo - minimo) * 100}%`;
  return <><div className="consulta-visual-barra sanidade-agenda-visoes">
    <SubTabs variant="financeiro" aparencia="segmentado" ariaLabel="Visão das carências" active={mostrarPrazos ? "prazos" : "lista"} onSelect={v => setMostrarPrazos(v === "prazos")} tabs={[{ id: "lista", label: "Lista" }, { id: "prazos", label: "Prazos" }]} />
  </div>{!mostrarPrazos ? <TabelaFinanceira icone={ICONES_TABELA.carencia} {...props} /> : <div className="carencias-prazos-rolagem"><div className="carencias-prazos"><div className="carencias-prazos-eixo"><span>Prazos por animal</span><div><span>{new Date(minimo).toLocaleDateString("pt-BR")}</span><strong style={{ left: posicao(agora) }}>Hoje</strong><span>{new Date(maximo).toLocaleDateString("pt-BR")}</span></div></div>{props.itens.map(c => <section key={props.chaveDe(c)} className="carencias-prazos-animal"><h3><button type="button" onClick={() => props.onAbrir?.(c)}>{nomeAnimalSanitario(c.animal)}</button></h3><div>{(["leite", "carne"] as const).map(destino => {
    const p = c[destino], Icone = destino === "leite" ? Milk : Beef;
    return <div className="carencias-prazo" key={destino}><span><Icone size={18} aria-hidden />{destino === "leite" ? "Leite" : "Abate / carne"}</span><div className="carencias-prazo-trilho"><i className="carencias-prazo-hoje" style={{ left: posicao(agora) }} />{p.estado === "CONHECIDO" && !p.prazoZero && <i className="carencias-prazo-marco" data-vigente={new Date(p.ate).getTime() > agora} style={{ left: posicao(new Date(p.ate).getTime()) }} />}<div className="carencias-prazo-texto"><PrazoCarencia estado={p} agora={agora} revisao={destino === "leite" && c.revisaoLeitePendente} /></div></div></div>;
  })}{c.revisaoAdministracaoPendente && <p className="text-sm text-amber-800">Administração não confirmada · revisar os registros</p>}</div></section>)}{!props.itens.length && <Empty>Nenhuma carência encontrada.</Empty>}</div></div>}</>;
}
