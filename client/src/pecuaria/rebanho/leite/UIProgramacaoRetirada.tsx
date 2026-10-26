import { DatePicker } from "@/components/DatePicker";
import { Input } from "@/components/ui/input";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { DialogConsultaLeite as SecaoDetalhesLeite } from "./DialogConsultaLeite";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import {
  dataValida,
  formatarLitros,
  hojeOperacional,
  lerLitros,
} from "./modelo";
import {
  diasSemana,
  nomeProgramacao,
  type ConsultaProgramacaoDTO,
  type TipoProgramacao,
} from "./programacao-types";
import "./operacoes.css";
import "./leite.css";
const dataPt = (data: string) =>
  new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export function ProgramacaoRetirada({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [data, setData] = useState(hojeOperacional);
  const [dados, setDados] = useState<ConsultaProgramacaoDTO | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [config, setConfig] = useState(false);
  const [aviso, setAviso] = useState("");
  const geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    setDados(null);
    setErro("");
    setCarregando(true);
    if (!dataValida(data)) {
      setCarregando(false);
      return;
    }
    void consultarLeite<ConsultaProgramacaoDTO>(
      `/programacao?data=${data}`,
      sitio,
    )
      .then((r) => {
        if (atual === geracao.current) setDados(r);
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar a programação.",
          );
      })
      .finally(() => {
        if (atual === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [data, sitio, revisao]);
  return (
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Rotina de coleta</h2>
      <p>
        Configure a frequência e consulte as próximas previsões. A rotina não cria
        retirada, venda, alerta ou movimento automático.
      </p>
      <div className="leite-form-inline">
        <label>
          Data de referência
          <DatePicker aria-label="Data de referência" value={data} onChange={setData} />
        </label>
        <Button variant="outline" className="leite-secondary"
          disabled={carregando}
          onClick={() => setRevisao((r) => r + 1)}>
          Atualizar
        </Button>
        {podeLancar && (
          <Button disabled={!dados || carregando}
            onClick={() => setConfig(true)}>
            <Settings2 size={16} aria-hidden /> Configurar rotina de coleta
          </Button>
        )}
      </div>
      {carregando && <p role="status">Consultando a programação…</p>}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {dados && (
        <>
          <h2>Rotina vigente na referência</h2>
          {dados.vigente ? (
            <p>
              <strong>{nomeProgramacao(dados.vigente)}</strong> · versão{" "}
              {dados.vigente.versao} · vigente desde{" "}
              {dataPt(dados.vigente.vigenteDesde)}
            </p>
          ) : (
            <p>Nenhuma programação vigente nesta data.</p>
          )}
          {dados.meta && (
            <div>
              <h2>Conferência da meta</h2>
              <p>
                {dados.meta.estado === "NAO_AFERIVEL"
                  ? "Meta não aferível"
                  : dados.meta.estado === "ATINGIDA"
                    ? "Meta atingida: conferir a necessidade de retirada"
                    : "Saldo abaixo da meta"}
              </p>
              <dl className="leite-indicadores">
                <div>
                  <dt>Meta configurada</dt>
                  <dd>{formatarLitros(Number(dados.meta.metaLitros))}</dd>
                </div>
                <div>
                  <dt>Saldo físico disponível</dt>
                  <dd>
                    {dados.meta.saldoLitros === null
                      ? "Não aferível"
                      : formatarLitros(Number(dados.meta.saldoLitros))}
                  </dd>
                </div>
              </dl>
              {dados.meta.motivo && <p>{dados.meta.motivo}</p>}
              <small>
                A conferência usa o produto configurado neste sítio. Uma
                retirada parcial altera o saldo na próxima consulta. Não há
                alerta persistente ou retirada automática.
              </small>
            </div>
          )}
          <h2>
            <CalendarDays size={20} aria-hidden /> Próximos 14 dias · previsão
          </h2>
          {dados.previsoes.length ? (
            <div className="leite-tabela-scroll">
              <Table semContainer>
                <TableCaption>Datas previstas de coleta</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Programação</TableHead>
                    <TableHead>Natureza</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.previsoes.map((p) => (
                    <TableRow key={p.data}>
                      <TableCell>{dataPt(p.data)}</TableCell>
                      <TableCell>
                        {nomeProgramacao(
                          dados.historico.find(
                            (h) => h.id === p.programacaoId,
                          )!,
                        )}
                      </TableCell>
                      <TableCell>Previsão</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p>
              {dados.vigente?.tipo === "META_LITROS"
                ? "A meta de litros não determina uma data de retirada."
                : "Nenhuma retirada prevista no intervalo."}
            </p>
          )}
          <SecaoDetalhesLeite  titulo={<>
              Histórico da rotina de coleta ({dados.historico.length})
            </>}>

            {dados.historico.length ? (
              <div className="leite-tabela-scroll">
                <Table semContainer>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead>Regra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.historico.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.versao}</TableCell>
                        <TableCell>{dataPt(p.vigenteDesde)}</TableCell>
                        <TableCell>{nomeProgramacao(p)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p>Ainda não há versões registradas.</p>
            )}
          </SecaoDetalhesLeite>
          {config && (
            <ConfigurarRetirada
              dados={dados}
              aoFechar={() => setConfig(false)}
              aoSalvar={() => {
                setConfig(false);
                setAviso(
                  "Nova rotina de coleta salva. As versões anteriores foram preservadas.",
                );
                setRevisao((r) => r + 1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function ConfigurarRetirada({
  dados,
  aoFechar,
  aoSalvar,
}: {
  dados: ConsultaProgramacaoDTO;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ultima = dados.historico[0];
  const vigente = dados.vigente;
  const proximaData = ultima
    ? new Date(`${ultima.vigenteDesde}T12:00:00Z`)
    : null;
  if (proximaData) proximaData.setUTCDate(proximaData.getUTCDate() + 1);
  const minima =
    proximaData && proximaData.toISOString().slice(0, 10) > hojeOperacional()
      ? proximaData.toISOString().slice(0, 10)
      : hojeOperacional();
  const [vigencia, setVigencia] = useState(minima);
  const [tipo, setTipo] = useState<TipoProgramacao>(vigente?.tipo ?? "DIARIA");
  const [dia, setDia] = useState(vigente?.diaSemana ?? 1);
  const [dias, setDias] = useState(vigente?.diasSemana ?? []);
  const [meta, setMeta] = useState(vigente?.metaLitros ?? "");
  const [produto, setProduto] = useState(vigente?.produtoId ?? "");
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [erro, setErro] = useState("");
  const [erroProdutos, setErroProdutos] = useState("");
  const [revisaoProdutos, setRevisaoProdutos] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  useEffect(() => {
    let atual = true;
    setErroProdutos("");
    void listarProdutos({ ativo: true })
      .then((r) => {
        if (atual)
          setProdutos(
            r.filter((p) => p.unidade === "L" && !p.rastrearPartidas),
          );
      })
      .catch((e) => {
        if (atual)
          setErroProdutos(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar produtos.",
          );
      });
    return () => {
      atual = false;
    };
  }, [revisaoProdutos]);
  async function salvar() {
    if (salvando) return;
    setErro("");
    let extra: Record<string, unknown> = {};
    if (tipo === "SEMANAL") extra = { diaSemana: dia };
    else if (tipo === "DIAS_ESCOLHIDOS") {
      if (!dias.length) {
        setErro("Escolha ao menos um dia da semana.");
        return;
      }
      extra = { diasSemana: [...dias].sort() };
    } else if (tipo === "META_LITROS") {
      try {
        const litros = lerLitros(meta);
        if (litros === null || litros <= 0 || !produto) {
          setErro("Informe uma meta positiva e selecione o produto de leite.");
          return;
        }
        extra = { produtoId: produto, metaLitros: litros };
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Meta inválida");
        return;
      }
    }
    setSalvando(true);
    try {
      await registrarLeite("/programacao", dados.propriedadeId, {
        propriedadeId: dados.propriedadeId,
        versaoEsperada: dados.versaoAtual,
        vigenteDesde: vigencia,
        tipo,
        ...extra,
      });
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível salvar. Os campos foram preservados.",
        );
    } finally {
      if (vivo.current) setSalvando(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) aoFechar();
      }}
    >
      <DialogContent className="leite-config leite-operacoes">
        <DialogTitle>Configurar rotina de coleta</DialogTitle>
        <DialogDescription>
          Escolha uma única regra. A nova vigência preserva as programações
          anteriores e não registra retirada física.
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <fieldset disabled={salvando}>
            <label>
              Vigente desde
              <DatePicker aria-label="Vigente desde" required min={minima} disabled={salvando} value={vigencia} onChange={setVigencia} />
            </label>
            <label>
              Frequência da coleta
              <SelectCampo disabled={salvando}
                value={tipo}
                onValueChange={valor => setTipo(valor as TipoProgramacao)}
              >
                <option value="DIARIA">Diária</option>
                <option value="SEMANAL">Semanal</option>
                <option value="DIAS_ESCOLHIDOS">Dias escolhidos</option>
                <option value="META_LITROS">Meta de litros</option>
              </SelectCampo>
            </label>
            {tipo === "SEMANAL" && (
              <label>
                Dia da semana
                <SelectCampo disabled={salvando}
                  value={dia}
                  onValueChange={valor => setDia(Number(valor))}
                >
                  {diasSemana.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </SelectCampo>
              </label>
            )}
            {tipo === "DIAS_ESCOLHIDOS" && (
              <fieldset>
                <legend>Dias da semana</legend>
                {diasSemana.map((d, i) => (
                  <label
                    key={d}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Input
                      style={{ width: 20, minHeight: 20 }}
                      type="checkbox"
                      checked={dias.includes(i)}
                      onChange={(e) =>
                        setDias((atual) =>
                          e.target.checked
                            ? [...atual, i]
                            : atual.filter((v) => v !== i),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </fieldset>
            )}
            {tipo === "META_LITROS" && (
              <>
                <label>
                  Produto de leite
                  <SelectCampo disabled={salvando}
                    required
                    value={produto}
                    onValueChange={setProduto}
                  >
                    <option value="">Selecione</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </SelectCampo>
                </label>
                {erroProdutos && (
                  <p role="alert">
                    {erroProdutos}
                    <Button variant="outline" type="button"
                      className="leite-secondary"
                      onClick={() => setRevisaoProdutos((r) => r + 1)}>
                      Consultar produtos novamente
                    </Button>
                  </p>
                )}
                <label>
                  Meta de litros
                  <Input
                    inputMode="decimal"
                    required
                    value={meta}
                    onChange={(e) => setMeta(e.target.value)}
                  />
                </label>
                <small>
                  Saldo físico disponível do produto neste sítio. Produção
                  acumulada não comprova disponibilidade.
                </small>
              </>
            )}
            {erro && <p role="alert">{erro}</p>}
            <div className="leite-form-inline">
              <Button variant="outline" type="button"
                className="leite-secondary"
                onClick={aoFechar}>
                Cancelar
              </Button>
              <Button >{salvando ? "Salvando…" : "Salvar rotina de coleta"}</Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
