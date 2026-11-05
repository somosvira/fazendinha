import { Button } from "../../../components/ui/button";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { useEffect, useState } from "react";
import "./reproducao-consultas.css";
import {
  ErrorBox,
  Modal,
  Pill,
  TabelaFinanceira,
  type ColunaTabela,
} from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Paginacao } from "../ui";
import { reqV4 } from "./api";
import {
  horarioRelatorio,
  type PartoRelatorio,
  type CriaRelatorio,
} from "./RelatorioPartos";
import { registro } from "./folha-regras";
import { CorrigirFato } from "./CorrigirFato";
import { AnularFato } from "./AnularFato";
import { VacaIcon } from "../../../components/icons/VacaIcon";
import { Empty } from "@/financeiro/financeiro-ui";
import { EsqueletoFicha } from "../../../components/Esqueleto";
export type PartoOperacional = Omit<PartoRelatorio, "crias"> & {
  coletasColostro?: Array<{ id:string; data:string; ocorridoEm:string|null; horarioEstimado:boolean; quantidadeLitros:string; status:string; primeiraRetirada:boolean; brix:{resultado:string|null}|null; destinos:Array<{id:string;tipo:'FORNECIMENTO'|'BANCO'|'PREPARO';descricao:string;quantidadeLitros:string;data:string;viaBanco:boolean}> }>;
  grauRetencaoPlacenta?: 1 | 2 | 3 | null;
  propriedadeId: number;
  status: string;
  crias: Array<
    CriaRelatorio & {
      filiacao?: {
        mae: string | null;
        pai: string | null;
        receptora: string | null;
      };
    }
  >;
  acompanhamentos?: Array<{
    id: string;
    data: string;
    tipo: string;
    realizacao: string;
    status: string;
  }>;
};
const rotulos: Record<string, string> = {
  NORMAL: "Normal",
  DISTOCICO: "Distócico",
  PARTO_DISTOCICO: "Distócico",
  NASCIMENTO: "Nascimento",
  ABORTO: "Aborto",
  NATIMORTO: "Natimorto",
  F: "Fêmea",
  M: "Macho",
  MAMADEIRA: "Mamadeira",
  SONDA: "Sonda",
  NATURAL: "Natural",
  FRESCO: "Fresco",
  CONGELADO: "Congelado",
  REFRATOMETRO_BRIX: "Refratômetro Brix",
  ESCORE: "Escore",
  ESCALA_MIN: "Mínimo da escala",
  ESCALA_MAX: "Máximo da escala",
  ESCALA_DESCRICAO: "Descrição da escala",
  REALIZADO: "Realizado",
  NAO_REALIZADO: "Não realizado",
  VALIDO: "Válido",
  ANULADO: "Anulado",
};
const texto = (v: unknown): string =>
  v == null
    ? "Não informado"
    : typeof v === "boolean"
      ? v
        ? "Sim"
        : "Não"
      : typeof v === "string"
        ? (rotulos[v] ?? v)
        : typeof v === "number"
          ? v.toLocaleString("pt-BR")
          : "Informação registrada";
const numero = (v: string | null) =>
  v == null
    ? "Não informado"
    : Number.isFinite(Number(v))
      ? Number(v).toLocaleString("pt-BR")
      : "A conferir";
function Lista<T extends { id: string }>({
  itens,
  colunas,
  rotulo,
}: {
  itens: T[];
  colunas: ColunaTabela<T>[];
  rotulo: string;
}) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(itens.length / 10)),
    atual = Math.min(pagina, total);
  return (
    <>
      <TabelaFinanceira
        rotulo={rotulo}
        itens={itens.slice((atual - 1) * 10, atual * 10)}
        chaveDe={(x) => x.id}
        colunas={colunas}
      />
      {!itens.length && (
        <Empty>Nenhum registro informado.</Empty>
      )}
      {itens.length > 10 && (
        <Paginacao
          paginaAtual={atual}
          totalPaginas={total}
          totalItens={itens.length}
          itensPorPagina={10}
          onPaginaChange={setPagina}
          rotulo="registros"
          idSelect={`pagina-${rotulo}`}
        />
      )}
    </>
  );
}
export function DetalheParto({
  id,
  propriedadeId,
  podeLancar = false,
}: {
  id: string;
  propriedadeId: number;
  podeLancar?: boolean;
}) {
  const [parto, setParto] = useState<PartoOperacional | null>(null),
    [erro, setErro] = useState<string | null>(null),
    [revisao, setRevisao] = useState(0);
  const [acao, setAcao] = useState<"corrigir" | "anular" | null>(null);
  const [pesagensCria, setPesagensCria] = useState<CriaRelatorio | null>(null);
  const [criaAberta, setCriaAberta] = useState<CriaRelatorio | null>(null);
  const [complemento, setComplemento] = useState<"escore" | "peso" | "retencao" | undefined>();

  useEffect(() => {
    let ativo = true;
    setParto(null);
    setCriaAberta(null);

    setComplemento(undefined);
    setAcao(null);
    setErro(null);
    void reqV4<PartoOperacional>(
      `/reproducao/partos/${encodeURIComponent(id)}`,
      undefined,
      "GET",
      propriedadeId,
    )
      .then((p) => {
        if (ativo) setParto(p);
      })
      .catch((e) => {
        if (ativo)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar o parto.",
          );
      });
    return () => {
      ativo = false;
    };
  }, [id, propriedadeId, revisao]);
  if (erro)
    return (
      <div className="space-y-4">
        <ErrorBox erro={erro} />
        <Button variant="outline" onClick={() => setRevisao((v) => v + 1)}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!parto) return <EsqueletoFicha label="Carregando parto" />;
  const p = parto;
  const podeEditar = podeLancar && p.status === "VALIDO";

  const atualizar = () => {
    setAcao(null);

    setRevisao(v => v + 1);
  };
  const escores = p.escoresMatriz.map(e => {
    const valores = Object.fromEntries(e.resultados.map(r => [r.campo, r.valor]));
    return { ...e, escore: `${texto(valores.ESCORE)}${valores.ESCALA_MAX == null ? "" : ` / ${texto(valores.ESCALA_MAX)}`}`,
      detalhes: e.resultados.filter(r => !["ESCORE", "ESCALA_MAX"].includes(r.campo)).map(r => `${rotulos[r.campo] ?? r.campo}: ${texto(r.valor)}`).join(" · ") };
  });
  return (
    <div className="repro-parto-detalhe">
      <div className="repro-parto-identidade flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Parto de {p.matriz.brinco}</h2>
          <p className="mt-2 text-sm text-ink-3">
            {horarioRelatorio(
              formatBRDateISO(p.data),
              p.ocorridoEm,
              p.horarioEstimado,
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            navegarPara(`/pecuaria/rebanho/animais/${p.matriz.id}?sitio=${propriedadeId}#reproducao`)
          }
        >
          Ver ficha da matriz
        </Button>
      </div>
      {p.status !== "VALIDO" && <Pill tone="amber">Registro anulado · preservado no histórico</Pill>}
      <SecaoRecolhivel className="ficha-geral-secao" titulo={<><span className="pec-icone"><VacaIcon/></span>Parto e condição da matriz</>} setaAoFinal acoesSomenteAberta acoes={podeEditar ? <><Button variant="outline" onClick={() => {setComplemento(undefined);setAcao("corrigir");}}>Corrigir / completar parto</Button><Button variant="outline" onClick={() => navegarPara(`/pecuaria/bezerreiro?aba=colostragem&propriedadeId=${propriedadeId}&partoId=${encodeURIComponent(p.id)}&novaRetirada=1`)}>Registrar retirada de colostro</Button></> : undefined}>
        <dl className="repro-dados-grade">
          <div><dt>Desfecho</dt><dd>{texto(p.desfecho)}</dd></div><div><dt>Tipo de parto</dt><dd>{texto(p.tipo)}</dd></div>
          <div><dt>Dificuldade</dt><dd>{texto(p.dificuldade)}</dd></div><div><dt>Assistência</dt><dd>{p.assistenciaDescricao ?? "Não informada"}</dd></div>
          <div><dt>Indução</dt><dd>{texto(p.induzido)}</dd></div><div><dt>Responsável</dt><dd>{p.responsavel ?? "Não informado"}</dd></div>
          <div><dt>Retenção de placenta</dt><dd>{texto(p.retencaoPlacenta)}</dd></div><div><dt>Grau de RP</dt><dd>{p.grauRetencaoPlacenta == null ? "Não informado" : `Grau ${p.grauRetencaoPlacenta}`}</dd></div>
        </dl>
        <header className="ficha-subcabecalho mt-6"><h3>Peso pós-parto da matriz</h3>{podeEditar && <Button variant="outline" onClick={()=>{setComplemento("peso");setAcao("corrigir");}}>Registrar pesagem da matriz</Button>}</header>
        <Lista rotulo="Pesos da matriz" itens={p.pesosMatriz} colunas={[{chave:"data",titulo:"Data",principal:true,celula:w=>formatBRDateISO(w.data)},{chave:"peso",titulo:"Peso",celula:w=>`${numero(w.pesoKg)} kg`}]}/>
        <header className="ficha-subcabecalho mt-6"><h3>ECC pós-parto da matriz</h3>{podeEditar && <Button variant="outline" onClick={()=>{setComplemento("escore");setAcao("corrigir");}}>Registrar avaliação de escore</Button>}</header>
        <Lista rotulo="Escores da matriz" itens={escores} colunas={[{chave:"data",titulo:"Data",principal:true,celula:e=>formatBRDateISO(e.data)},{chave:"escore",titulo:"ECC",celula:e=><><span>{e.escore}</span>{e.detalhes && <p className="text-sm text-ink-3">{e.detalhes}</p>}</>},{chave:"responsavel",titulo:"Responsável",celula:e=>e.responsavel??"Não informado"}]}/>
        <header className="ficha-subcabecalho mt-6"><h3>Retenção de placenta</h3>{podeEditar && <Button variant="outline" onClick={()=>{setComplemento("retencao");setAcao("corrigir");}}>Completar retenção de placenta</Button>}</header>
        <Lista rotulo="Ocorrências pós-parto" itens={p.ocorrenciasRetencaoPlacenta} colunas={[{chave:"inicio",titulo:"Início",principal:true,celula:o=>formatBRDateISO(o.inicio)},{chave:"fim",titulo:"Fim",celula:o=>o.fim?formatBRDateISO(o.fim):"Em aberto"}]}/>
        {!!p.acompanhamentos?.length && <><h3 className="mt-6 mb-3 font-semibold">Avaliações pós-parto</h3><Lista rotulo="Avaliações vinculadas ao parto" itens={p.acompanhamentos} colunas={[{chave:"data",titulo:"Data",principal:true,celula:e=>formatBRDateISO(e.data)},{chave:"tipo",titulo:"Avaliação",celula:e=>e.tipo},{chave:"realizacao",titulo:"Realização",celula:e=>texto(e.realizacao)},{chave:"status",titulo:"Situação",celula:e=>texto(e.status)}]}/></>}
        <ColetasParto key={`${p.id}:${propriedadeId}`} coletas={p.coletasColostro ?? []}/>
        {p.observacao && <><h3 className="mt-6 mb-3 font-semibold">Observações do parto</h3><p className="whitespace-pre-wrap">{p.observacao}</p></>}
      </SecaoRecolhivel>
      <SecaoRecolhivel className="ficha-geral-secao repro-parto-crias" titulo={<><span className="pec-icone"><VacaIcon/></span>Crias deste parto</>} setaAoFinal>
        <div className="repro-crias-grade">{p.crias.map(c => <article className="repro-cria" key={c.id}>
          <header><h3>{texto(registro(c.filiacaoSnapshot).brincoInformado ?? `Cria ${c.ordem}`)}</h3><Pill tone={c.viva ? "green" : "neutral"}>{c.viva ? "Viva" : "Sem vida"}</Pill><div className="flex flex-wrap gap-2">{c.pesos.length > 0 && <Button variant="outline" onClick={() => setPesagensCria(c)}>Ver pesagens</Button>}{c.animalId ? <><LinkReproducao botao href={`/pecuaria/rebanho/animais/${c.animalId}`} sitio={propriedadeId}>Ver ficha</LinkReproducao><LinkReproducao botao href={`/pecuaria/bezerreiro/animais/${c.animalId}`} sitio={propriedadeId}>Abrir no Bezerreiro</LinkReproducao></> : <Button variant="outline" onClick={()=>setCriaAberta(c)}>Ver identificação</Button>}</div></header>
          <dl className="repro-dados-grade"><div><dt>Sexo</dt><dd>{texto(c.sexo)}</dd></div><div><dt>Peso ao nascer</dt><dd>{registro(c.filiacaoSnapshot).pesoKg == null ? "Não informado" : `${texto(registro(c.filiacaoSnapshot).pesoKg)} kg`}</dd></div><div><dt>Mãe genética</dt><dd>{c.filiacao?.mae ?? "Não informada"}</dd></div><div><dt>Pai</dt><dd>{c.filiacao?.pai ?? "Não informado"}</dd></div><div><dt>Receptora</dt><dd>{c.filiacao?.receptora ?? "Não informada"}</dd></div></dl>

        </article>)}</div>{!p.crias.length && <p>Nenhuma cria informada.</p>}
      </SecaoRecolhivel>
      {podeEditar && acao === "corrigir" && <CorrigirFato complementoInicial={complemento} tipo="parto" id={p.id} animalId={p.matriz.id} propriedadeId={propriedadeId} tipoPartoInicial={p.tipo ?? undefined} onFechar={() => setAcao(null)} onSalvo={atualizar}/>}
      {podeEditar && acao === "anular" && <AnularFato tipo="partos" id={p.id} propriedadeId={propriedadeId} onFechar={() => setAcao(null)} onSalvo={atualizar}/>}
      {pesagensCria && <Modal titulo={`Pesagens da cria ${pesagensCria.ordem}`} eyebrow="" onClose={()=>setPesagensCria(null)}><div className="p-5"><Lista rotulo="Pesagens registradas" itens={pesagensCria.pesos} colunas={[{chave:"data",titulo:"Data",principal:true,celula:w=>formatBRDateISO(w.data)},{chave:"peso",titulo:"Peso",celula:w=>`${numero(w.pesoKg)} kg`}]}/></div></Modal>}
      {criaAberta && <Modal titulo={`Cria ${criaAberta.ordem}`} eyebrow="" onClose={()=>setCriaAberta(null)}><div className="p-5"><p>{criaAberta.viva ? "Viva · identificação provisória" : "Sem vida · sem cadastro de animal ativo"}</p><p className="mt-2">Sexo: {texto(criaAberta.sexo)}</p><p className="mt-2">Peso informado: {texto(registro(criaAberta.filiacaoSnapshot).pesoKg)}</p></div></Modal>}
      <SecaoRecolhivel titulo="Autoria e observações" abertaInicial={false} acoes={podeEditar ? <Button variant="ghost" onClick={() => setAcao("anular")}>Conferir anulação</Button> : undefined}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt>Responsável pelo parto</dt>
            <dd>{p.responsavel ?? "Não informado"}</dd>
          </div>
          <div>
            <dt>Registro</dt>
            <dd>
              Versão {p.versao} · {formatBRDateISO(p.criadoEm)}
            </dd>
          </div>
          <div>
            <dt>Lançador</dt>
            <dd>{p.lancador?.nome ?? "Não informado"}</dd>
          </div>
          <div>
            <dt>Indução</dt>
            <dd>{texto(p.induzido)}</dd>
          </div>
        </dl>
        {p.observacao && (
          <p className="mt-4 whitespace-pre-wrap">{p.observacao}</p>
        )}
      </SecaoRecolhivel>
    </div>
  );
}

function ColetasParto({coletas}:{coletas:NonNullable<PartoOperacional['coletasColostro']>}) {
  const confirmadas=coletas.filter(c=>c.status==='CONFIRMADO');
  return <div className="mt-6"><header className="ficha-subcabecalho"><h3>Colostro coletado da matriz</h3></header><dl className="repro-dados-grade mb-4"><div><dt>Total coletado confirmado</dt><dd>{confirmadas.length?`${confirmadas.reduce((s,c)=>s+Number(c.quantidadeLitros),0).toLocaleString('pt-BR',{maximumFractionDigits:3})} L`:'Não informado'}</dd></div></dl>
    <Lista rotulo="Retiradas de colostro deste parto" itens={coletas} colunas={[{chave:"data",titulo:"Data e horário",principal:true,celula:r=>horarioRelatorio(formatBRDateISO(r.data),r.ocorridoEm,r.horarioEstimado)},{chave:"volume",titulo:"Quantidade",celula:r=>`${Number(r.quantidadeLitros).toLocaleString("pt-BR")} L`},{chave:"primeira",titulo:"Retirada",celula:r=>r.primeiraRetirada?"Primeira retirada":"Retirada adicional"},{chave:"brix",titulo:"Brix",celula:r=>r.brix?.resultado!=null?`${r.brix.resultado}%`:"Não informado"},{chave:"status",titulo:"Situação",celula:r=>r.status==='CONFIRMADO'?'Confirmada':r.status==='ESTORNADO'?'Estornada':'Rascunho'}]}/>
    {coletas.some(c=>c.destinos.length>0)&&<><h3 className="mt-6 mb-3 font-semibold">Destinos da coleta</h3><Lista rotulo="Destinos do colostro" itens={coletas.flatMap(c=>c.destinos.map(d=>({...d,id:c.id+':'+d.id,coleta:c.data})))} colunas={[{chave:"coleta",titulo:"Coleta",principal:true,celula:d=>formatBRDateISO(d.coleta)},{chave:"destino",titulo:"Destino",celula:d=><>{d.descricao}{d.viaBanco && <span className="block text-xs text-ink-3">Fornecimento a partir do banco</span>}</>},{chave:"volume",titulo:"Quantidade",celula:d=>`${Number(d.quantidadeLitros).toLocaleString("pt-BR")} L`}]}/></>}

  </div>;
}
