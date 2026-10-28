import { AjudaCampo } from "@/components/Dica";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { registrarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
interface Previa {
  propriedade: { id: number; nome: string };
  periodo: { inicio: string; fim: string };
  origemArquivo: string;
  assinaturaFonte: string;
  litrosNovosMedidos: string;
  conferenciaSemConflitos: boolean;
  totais: Record<string, number>;
  linhas: {
    linha: number;
    origemId: string;
    brinco: string;
    data: string;
    ordenha: string;
    estado: string;
    litros: number | null;
    situacao: string;
    motivo: string;
    pendencias: string[];
  }[];
  conciliacao: {
    movimentosLeiteNoPeriodo: number;
    versoesVendaNoPeriodo: number;
    estoqueAlterado: false;
    financeiroAlterado: false;
    importacaoExecutada: false;
  };
  avisos: string[];
}
const rotulo = (s: string) =>
  ({
    NOVO_REGISTRO: "Novo registro para conferir",
    JA_REGISTRADO: "Já registrado",
    CONFLITO_EXISTENTE: "Conflito com registro existente",
    DUPLICADO_NO_LOTE: "Repetido no lote",
    ANIMAL_NAO_CONCILIADO: "Animal não conciliado",
    CONTEXTO_INCOMPATIVEL: "Contexto histórico incompatível",
    ORDENHA_NAO_CONCILIADA: "Ordenha não conciliada",
  })[s] ?? "Pendente de conferência";
export function PreviaHistoricaLeite({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [inicio, setInicio] = useState(
      () => `${hojeOperacional().slice(0, 7)}-01`,
    ),
    [fim, setFim] = useState(hojeOperacional);
  const [arquivo, setArquivo] = useState(""),
    [linhas, setLinhas] = useState<unknown[]>([]),
    [referencia, setReferencia] = useState(""),
    [unidade, setUnidade] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [pagina, setPagina] = useState(1);
  const geracao = useRef(0),
    trava = useRef(false);
  function invalidar() {
    geracao.current++;
    setPrevia(null);
    setErro("");
    setPagina(1);
  }
  async function ler(file: File) {
    invalidar();
    setArquivo("");
    setLinhas([]);
    if (file.size > 8 * 1024 * 1024) {
      setErro("Prepare um arquivo de até 8 MB por lote.");
      return;
    }
    const atual = geracao.current;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const dados = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "linhas" in parsed
          ? parsed.linhas
          : null;
      if (!Array.isArray(dados))
        throw new Error(
          "O arquivo precisa conter as linhas de preparação do lote.",
        );
      if (atual === geracao.current) {
        setLinhas(dados);
        setArquivo(file.name);
      }
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Arquivo inválido");
    }
  }
  async function conferir() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    setPrevia(null);
    const atual = geracao.current;
    try {
      const r = await registrarLeite<Previa>(
        "/previa-historica",
        sitio,
        {
          inicio,
          fim,
          unidade: "L",
          referenciaUnidade: referencia,
          origemArquivo: arquivo,
          linhas,
        },
        false,
      );
      if (atual === geracao.current) setPrevia(r);
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha na conferência");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Conferir importação de leite <AjudaCampo rotulo="Sobre a prévia da importação" texto={"Prepare o lote a partir dos registros reais da fazenda. Esta prévia compara animais, ordenhas, datas e medições existentes. Não importa registros nem movimenta leite, vendas ou dinheiro."} /></h2>

      <ol className="leite-etapas-importacao" aria-label="Etapas da conferência"><li><b>1</b>Arquivo e origem</li><li><b>2</b>Validação de unidades</li><li><b>3</b>Prévia e pendências</li></ol>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void conferir();
        }}
      >
        <fieldset disabled={ocupado || !podeLancar}>
          <legend>Lote para conferência</legend>
          <div className="leite-form-inline">
            <label>
              Início do lote
              <input
                type="date"
                required
                max={fim}
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  invalidar();
                }}
              />
            </label>
            <label>
              Fim do lote
              <input
                type="date"
                required
                min={inicio}
                max={hojeOperacional()}
                value={fim}
                onChange={(e) => {
                  setFim(e.target.value);
                  invalidar();
                }}
              />
            </label>
            <label>
              Arquivo de preparação (JSON)
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void ler(f);
                }}
              />
            </label>
          </div>
          <p>
            {arquivo
              ? `${arquivo} · ${linhas.length} linha(s) lida(s)`
              : "Nenhum arquivo selecionado."}
          </p>
          <label className="leite-checkbox">
            <input
              type="checkbox"
              required
              checked={unidade}
              onChange={(e) => {
                setUnidade(e.target.checked);
                invalidar();
              }}
            />
            A fonte foi conferida e os volumes estão em litros
          </label>
          <label>
            Evidência da unidade na fonte
            <input
              required
              minLength={5}
              maxLength={500}
              value={referencia}
              onChange={(e) => {
                setReferencia(e.target.value);
                invalidar();
              }}
              placeholder="Indique o cabeçalho ou a conferência que comprova litros"
            />
          </label>
          <Button disabled={
              !podeLancar ||
              ocupado ||
              !unidade ||
              !linhas.length ||
              referencia.trim().length < 5
            }>
            {ocupado ? "Conferindo lote…" : "Conferir arquivo sem importar"}
          </Button>
        </fieldset>
      </form>
      {!podeLancar && <p>Conferir lotes exige permissão de lançamento.</p>}
      {erro && <p role="alert">{erro}</p>}
      {previa && (
        <>
          <h2>{previa.propriedade.nome} · resultado da prévia</h2>
          <dl className="leite-indicadores">
            <div>
              <dt>Litros novos para conferir</dt>
              <dd>{formatarLitros(Number(previa.litrosNovosMedidos))}</dd>
            </div>
            {Object.entries(previa.totais).map(([s, n]) => (
              <div key={s}>
                <dt>{rotulo(s)}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <p>
            {previa.conferenciaSemConflitos
              ? "Nenhum conflito estrutural identificado. A origem dos dados, a unidade e a reconciliação física ainda precisam ser conferidas."
              : "Há pendências de mapeamento ou conflito. Revise as linhas antes de qualquer carga."}
          </p>
          <p>
            {previa.conciliacao.movimentosLeiteNoPeriodo} movimento(s)
            leiteiro(s) e {previa.conciliacao.versoesVendaNoPeriodo} versão(ões)
            comercial(is) já existem no período. Esses fatos precisam ser
            conciliados; esta prévia não os apaga nem os repete.
          </p>
          <div className="leite-tabela-scroll">
            <Table semContainer>
              <TableCaption>Conferência por registro de origem</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Animal e ordenha</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Conferência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previa.linhas
                  .slice((pagina - 1) * 20, pagina * 20)
                  .map((l) => (
                    <TableRow key={l.linha}>
                      <TableCell>
                        {l.linha}
                        <small>{l.origemId}</small>
                      </TableCell>
                      <TableCell>
                        {l.brinco} · {l.ordenha}
                      </TableCell>
                      <TableCell>{l.data}</TableCell>
                      <TableCell>{formatarLitros(l.litros)}</TableCell>
                      <TableCell>
                        {rotulo(l.situacao)}
                        <small>{l.motivo}</small>
                        {l.pendencias.length > 0 && (
                          <small>Lactação ainda não conciliada.</small>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="leite-form-inline">
            <Button variant="outline" className="leite-secondary"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}>
              Linhas anteriores
            </Button>
            <span>Página {pagina}</span>
            <Button variant="outline" className="leite-secondary"
              disabled={pagina * 20 >= previa.linhas.length}
              onClick={() => setPagina((p) => p + 1)}>
              Próximas linhas
            </Button>
          </div>
          <ul>
            {previa.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}
      <div className="flex items-center gap-2"><span>Como preparar o arquivo</span><AjudaCampo rotulo="Sobre a preparação do arquivo" texto={"O arquivo de preparação contém uma lista chamada “linhas”. Cada linha conserva seu identificador de origem, brinco literal, data, nome da ordenha, estado e litros, além de motivo e responsável quando documentados. Zeros só devem ser informados quando medidos; ausências permanecem sem volume. O mapeamento usa a rotina e a localização na data, sem retirar zeros à esquerda do brinco. O formato deve ser preparado após inspecionar a planilha ou folha real. Ainda não há execução automática da carga neste fluxo."} /></div>
    </section>
  );
}
