import { IdentificacaoReproducao, LinkReproducao } from "./ConsultaReproducaoUI";
import { useEffect, useState } from "react";
import { Button as BotaoAcao } from "../../../components/ui/button";
import { CalendarDays, HeartPulse, Users, Weight } from "lucide-react";
import {
  Button,
  ErrorBox,
  Metric,
  Modal,
  Pill,
  TabelaFinanceira,
  type ColunaTabela,
} from "../../../financeiro/financeiro-ui";
import { formatBRDateISO } from "../../../lib/hoje";
import { navegarPara } from "../../../router";
import { SecaoRecolhivel, SecaoFicha } from "../components/SecaoRecolhivel";
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
import { ColostroCria } from "./ColostroCria";
export type PartoOperacional = Omit<PartoRelatorio, "crias"> & {
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
        <p className="p-4 text-sm text-ink-3">Nenhum registro informado.</p>
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
  const [criaAberta, setCriaAberta] = useState<CriaRelatorio | null>(null);
  const [complemento, setComplemento] = useState<"escore" | "peso" | "retencao" | undefined>();
  const [criaColostro, setCriaColostro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    setParto(null);
    setCriaAberta(null);
    setCriaColostro(null);
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
        <Button secondary onClick={() => setRevisao((v) => v + 1)}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!parto) return <p role="status">Carregando parto…</p>;
  const p = parto;
  const podeEditar = podeLancar && p.status === "VALIDO";
  const criaSelecionada = p.crias.find(c => c.id === criaColostro && c.viva);
  const atualizar = () => {
    setAcao(null);
    setCriaColostro(null);
    setRevisao(v => v + 1);
  };
  const escores = p.escoresMatriz.flatMap((e) =>
    e.resultados.map((r) => ({
      id: e.id + ":" + r.campo,
      data: e.data,
      campo: rotulos[r.campo] ?? "Observação do escore",
      valor: texto(r.valor),
      responsavel: e.responsavel,
    })),
  );
  const colostro = p.crias.flatMap((c) =>
    c.colostro.map((f) => ({ ...f, cria: `Cria ${c.ordem}` })),
  );
  const pesos = [
    ...p.pesosMatriz.map((w) => ({ ...w, sujeito: "Matriz" })),
    ...p.crias.flatMap((c) =>
      c.pesos.map((w) => ({ ...w, sujeito: `Cria ${c.ordem}` })),
    ),
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
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
          secondary
          onClick={() =>
            navegarPara(`/pecuaria/rebanho/animais/${p.matriz.id}#reproducao`)
          }
        >
          Ver ficha da matriz
        </Button>
      </div>
      {podeEditar && <div className="flex flex-wrap gap-3">
        <Button secondary onClick={() => {setComplemento(undefined);setAcao("corrigir");}}>Corrigir / completar parto</Button>
        <Button danger onClick={() => setAcao("anular")}>Conferir anulação</Button>
      </div>}
      {p.status !== "VALIDO" && (
        <Pill tone="amber">Registro anulado · preservado no histórico</Pill>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CalendarDays}
          label="Desfecho"
          valor={texto(p.desfecho)}
          detalhe={texto(p.tipo)}
        />
        <Metric
          icon={Users}
          label="Crias"
          valor={String(p.crias.length)}
          detalhe={`${p.crias.filter((c) => c.viva).length} vivas`}
        />
        <Metric
          icon={HeartPulse}
          label="Retenção de placenta"
          valor={texto(p.retencaoPlacenta)}
        />
        <Metric
          icon={Weight}
          label="Dificuldade"
          valor={texto(p.dificuldade)}
          detalhe={p.assistenciaDescricao ?? "Assistência não informada"}
        />
      </div>
      <SecaoFicha
        titulo="Crias"
        resumo="Identificação e situação de cada cria"
      >
        <Lista
          rotulo="Crias do parto"
          itens={p.crias}
          colunas={[
            {
              chave: "cria",
              titulo: "Cria",
              principal: true,
              celula: c => c.animalId ? <IdentificacaoReproducao id={c.animalId} brinco={texto(registro(c.filiacaoSnapshot).brincoInformado ?? `Cria ${c.ordem}`)} sitio={propriedadeId}/> : <BotaoAcao variant="ghost" onClick={()=>setCriaAberta(c)}>{texto(registro(c.filiacaoSnapshot).brincoInformado ?? `Cria ${c.ordem}`)}</BotaoAcao>,
            },
            { chave: "sexo", titulo: "Sexo", celula: (c) => texto(c.sexo) },
            {
              chave: "situacao",
              titulo: "Situação",
              celula: (c) => (
                <Pill tone={c.viva ? "green" : "neutral"}>
                  {c.viva ? "Viva" : "Sem vida"}
                </Pill>
              ),
            },
            {
              chave: "mae",
              titulo: "Mãe genética",
              celula: (c) => c.filiacao?.mae ?? "Não informada",
            },
            {
              chave: "pai",
              titulo: "Pai",
              celula: (c) => c.filiacao?.pai ?? "Não informado",
            },
            {
              chave: "receptora",
              titulo: "Receptora",
              celula: (c) => c.filiacao?.receptora ?? "Não informada",
            },
            {
              chave: "peso",
              titulo: "Peso ao nascer",
              celula: (c) =>
                registro(c.filiacaoSnapshot).pesoKg == null
                  ? "Não informado"
                  : `${texto(registro(c.filiacaoSnapshot).pesoKg)} kg`,
            },
            {
              chave: "acao",
              titulo: "Ação",
              acoes: true,
              celula: (c) => <div className="flex flex-wrap gap-3">
                {c.animalId ? <Button secondary onClick={() => navegarPara(`/pecuaria/rebanho/animais/${c.animalId}`)}>Ver ficha</Button> : <span>Sem cadastro de animal</span>}
                {podeEditar && c.viva && <BotaoAcao variant="outline" aria-label={`Gerenciar colostro da cria ${c.ordem}`} onClick={() => setCriaColostro(c.id)}>Colostro</BotaoAcao>}
              </div>,
            },
          ]}
        />
      </SecaoFicha>
      <SecaoFicha
        titulo="Pesos vinculados"
        acoes={podeEditar ? <Button secondary onClick={()=>{setComplemento("peso");setAcao("corrigir");}}>Registrar pesagem da matriz</Button> : undefined}
        resumo="Pesagens da matriz e das crias associadas ao parto"
      >
        <Lista
          rotulo="Pesos do parto"
          itens={pesos}
          colunas={[
            {
              chave: "sujeito",
              titulo: "Animal",
              principal: true,
              celula: (w) => w.sujeito,
            },
            {
              chave: "data",
              titulo: "Data",
              celula: (w) => formatBRDateISO(w.data),
            },
            {
              chave: "peso",
              titulo: "Peso",
              celula: (w) => `${numero(w.pesoKg)} kg`,
            },
          ]}
        />
      </SecaoFicha>
      <SecaoFicha titulo="Escore corporal da matriz">
        <Lista
          rotulo="Escores da matriz"
          itens={escores}
          colunas={[
            {
              chave: "data",
              titulo: "Data",
              principal: true,
              celula: (e) => formatBRDateISO(e.data),
            },
            { chave: "campo", titulo: "Informação", celula: (e) => e.campo },
            { chave: "valor", titulo: "Valor", celula: (e) => e.valor },
            {
              chave: "responsavel",
              titulo: "Responsável",
              celula: (e) => e.responsavel ?? "Não informado",
            },
          ]}
        />
      </SecaoFicha>
      <SecaoFicha
        titulo="Fornecimentos de colostro"
        resumo="Quantidade em litros; unidade original preservada nos detalhes"
      >
        <Lista
          rotulo="Fornecimentos de colostro"
          itens={colostro}
          colunas={[
            {
              chave: "cria",
              titulo: "Cria",
              principal: true,
              celula: (f) => f.cria,
            },
            {
              chave: "data",
              titulo: "Data e hora",
              celula: (f) =>
                horarioRelatorio(
                  formatBRDateISO(f.data),
                  f.ocorridoEm,
                  f.horarioEstimado,
                ),
            },
            {
              chave: "quantidade",
              titulo: "Quantidade",
              celula: (f) =>
                f.quantidadeLitros == null
                  ? "Não informada"
                  : `${numero(f.quantidadeLitros)} L`,
            },
            {
              chave: "qualidade",
              titulo: "Qualidade",
              celula: (f) =>
                f.qualidadeBrix != null
                  ? `Brix: ${numero(f.qualidadeBrix)}%`
                  : texto(f.qualidadeClassificacao),
            },
            { chave: "forma", titulo: "Forma", celula: (f) => texto(f.forma) },
            {
              chave: "detalhes",
              titulo: "Detalhes",
              acoes: true,
              celula: (f) => (
                <details>
                  <summary className="ficha-link-contorno cursor-pointer">
                    Ver detalhes
                  </summary>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt>Unidade informada originalmente</dt>
                      <dd>{texto(f.unidadeInformada)}</dd>
                    </div>
                    <div>
                      <dt>Método</dt>
                      <dd>{texto(f.metodoQualidade)}</dd>
                    </div>
                    <div>
                      <dt>Tipo</dt>
                      <dd>{texto(f.tipo)}</dd>
                    </div>
                    <div>
                      <dt>Responsável</dt>
                      <dd>{texto(f.responsavel)}</dd>
                    </div>
                    <div>
                      <dt>Observações</dt>
                      <dd>{texto(f.observacao)}</dd>
                    </div>
                  </dl>
                </details>
              ),
            },
          ]}
        />
      </SecaoFicha>
      <SecaoFicha titulo="Avaliações pós-parto" acoes={podeEditar ? <Button secondary onClick={()=>{setComplemento("escore");setAcao("corrigir");}}>Registrar avaliação de escore</Button> : undefined}>
        <Lista
          rotulo="Avaliações vinculadas ao parto"
          itens={p.acompanhamentos ?? []}
          colunas={[
            {
              chave: "data",
              titulo: "Data",
              principal: true,
              celula: (e) => formatBRDateISO(e.data),
            },
            {
              chave: "tipo",
              titulo: "Avaliação",
              larguraFlexivel: true,
              celula: (e) => e.tipo,
            },
            {
              chave: "realizacao",
              titulo: "Realização",
              celula: (e) => texto(e.realizacao),
            },
            {
              chave: "status",
              titulo: "Situação",
              celula: (e) => texto(e.status),
            },
          ]}
        />
      </SecaoFicha>
      <SecaoFicha titulo="Retenção de placenta" acoes={podeEditar ? <Button secondary onClick={()=>{setComplemento("retencao");setAcao("corrigir");}}>Completar retenção de placenta</Button> : undefined}>
        <Lista
          rotulo="Ocorrências pós-parto"
          itens={p.ocorrenciasRetencaoPlacenta}
          colunas={[
            {
              chave: "inicio",
              titulo: "Início",
              principal: true,
              celula: (o) => formatBRDateISO(o.inicio),
            },
            {
              chave: "fim",
              titulo: "Fim",
              celula: (o) => (o.fim ? formatBRDateISO(o.fim) : "Em aberto"),
            },
          ]}
        />
      </SecaoFicha>
      {podeEditar && acao === "corrigir" && <CorrigirFato complementoInicial={complemento} tipo="parto" id={p.id} animalId={p.matriz.id} propriedadeId={propriedadeId} tipoPartoInicial={p.tipo ?? undefined} onFechar={() => setAcao(null)} onSalvo={atualizar}/>}
      {podeEditar && acao === "anular" && <AnularFato tipo="partos" id={p.id} propriedadeId={propriedadeId} onFechar={() => setAcao(null)} onSalvo={atualizar}/>}
      {criaAberta && <Modal titulo={`Cria ${criaAberta.ordem}`} eyebrow="Registro do parto" onClose={()=>setCriaAberta(null)}><div className="p-5"><p>{criaAberta.viva ? "Viva · identificação provisória" : "Sem vida · sem cadastro de animal ativo"}</p><p className="mt-2">Sexo: {texto(criaAberta.sexo)}</p><p className="mt-2">Peso informado: {texto(registro(criaAberta.filiacaoSnapshot).pesoKg)}</p></div></Modal>}
      {podeEditar && criaSelecionada && <Modal titulo={`Colostro · cria ${criaSelecionada.ordem}`} eyebrow="Parto e pós-parto" onClose={() => setCriaColostro(null)}>
        <div className="p-5"><ColostroCria key={criaSelecionada.id} criaId={criaSelecionada.id} propriedadeId={propriedadeId} dataParto={p.data} podeLancar={podeLancar} onMudou={atualizar}/></div>
      </Modal>}
      <SecaoRecolhivel titulo="Autoria e observações" abertaInicial={false}>
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
