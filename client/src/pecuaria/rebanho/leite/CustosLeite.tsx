import { Button } from "@/components/ui/button";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import { RitmoLeite, type DiaRitmoLeite } from "./RitmoLeite";
import { baixarRelatorioLeite } from "./relatorio-csv";
interface Resumo {
  custoPorLitro: string | null;
  situacao: string;
  motivos: string[];
  producao: { litros: number | null; completa: boolean };
  custos: { totalConhecido: string | null; cobertura: string };
}
interface Relatorio {
  ritmo: DiaRitmoLeite[];
  coberturaPeriodo: {
    diasInformados: number;
    diasSemFolha: string[];
    diasParciais: string[];
    diasSemAnimaisElegiveis?: string[];
    diasFinalidadePendente?: string[];
    completa: boolean;
  };
  consolidado: Resumo;
  animais: (Resumo & {
    animalId: string;
    brinco: string | null;
    nome: string | null;
  })[];
}
const dinheiro = (valor: string | null) =>
  valor === null
    ? "Não apurado"
    : Number(valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
export function CustosLeite({
  podeExportar = false,
}: {
  podeExportar?: boolean;
}) {
  const [inicio, setInicio] = useState(
    () =>
      new URLSearchParams(location.search).get("inicio") ??
      `${hojeOperacional().slice(0, 7)}-01`,
  );
  const [fim, setFim] = useState(
    () => new URLSearchParams(location.search).get("fim") ?? hojeOperacional(),
  );
  const [dados, setDados] = useState<Relatorio | null>(null),
    [erro, setErro] = useState(""),
    [carregando, setCarregando] = useState(false);
  const geracao = useRef(0);
  const [exportando, setExportando] = useState(false);
  const travaExportacao = useRef(false);
  async function exportar() {
    if (travaExportacao.current) return;
    travaExportacao.current = true;
    setExportando(true);
    setErro("");
    const atual = geracao.current;
    try {
      const relatorio = await consultarLeite<Relatorio>(
        `/custos/exportacao?${new URLSearchParams({ inicio, fim })}`,
        getPropriedadeAtiva(),
      );
      if (atual === geracao.current) {
        setDados(relatorio);
        baixarRelatorioLeite(relatorio, inicio, fim);
      }
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha na exportação");
    } finally {
      travaExportacao.current = false;
      setExportando(false);
    }
  }
  function invalidar() {
    geracao.current++;
    setDados(null);
    setErro("");
    setCarregando(false);
  }
  async function consultar() {
    const atual = ++geracao.current;
    setCarregando(true);
    setErro("");
    setDados(null);
    try {
      const r = await consultarLeite<Relatorio>(
        `/custos?${new URLSearchParams({ inicio, fim })}`,
        getPropriedadeAtiva(),
      );
      if (atual === geracao.current) setDados(r);
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha na consulta");
    } finally {
      if (atual === geracao.current) setCarregando(false);
    }
  }
  return (
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Ritmo e custos no mesmo período</h2>
      <p>
        Nutrição, sanidade e reprodução dos animais presentes nas folhas. Esta
        consulta usa os períodos de finalidade Leite comprovados pelo servidor.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void consultar();
        }}
        className="leite-form-inline"
      >
        <label>
          Início
          <input
            type="date"
            required
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              invalidar();
            }}
          />
        </label>
        <label>
          Fim
          <input
            type="date"
            required
            min={inicio}
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
              invalidar();
            }}
          />
        </label>
        <Button disabled={carregando}>
          {carregando ? "Consultando…" : "Consultar período"}
        </Button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {dados && (
        <>
          <dl className="leite-indicadores">
            <div>
              <dt>Litros medidos</dt>
              <dd>{formatarLitros(dados.consolidado.producao.litros)}</dd>
            </div>
            <div>
              <dt>Custo registrado</dt>
              <dd>
                {dados.consolidado.situacao === "OCULTO"
                  ? "Sem acesso a valores"
                  : dinheiro(dados.consolidado.custos.totalConhecido)}
              </dd>
            </div>
            <div>
              <dt>Custo por litro</dt>
              <dd>
                {dados.consolidado.situacao === "OCULTO"
                  ? "Sem acesso a valores"
                  : dinheiro(dados.consolidado.custoPorLitro)}
              </dd>
            </div>
          </dl>
          <p>
            {dados.coberturaPeriodo.diasInformados} dia(s) com folha ·{" "}
            {dados.coberturaPeriodo.diasSemFolha.length} sem folha ·{" "}
            {dados.coberturaPeriodo.diasParciais.length} parcial(is).
          </p>
          {!dados.coberturaPeriodo.completa && (
            <p role="status">
              O período está incompleto. Os litros informados não representam
              toda a produção esperada.
            </p>
          )}
          {!!dados.coberturaPeriodo.diasSemAnimaisElegiveis?.length && <p>{dados.coberturaPeriodo.diasSemAnimaisElegiveis.length} dia(s) sem animais elegíveis na data.</p>}
          {!!dados.coberturaPeriodo.diasFinalidadePendente?.length && <p role="status">Finalidade histórica a conciliar em {dados.coberturaPeriodo.diasFinalidadePendente.length} dia(s). Litros registrados preservados; custo por litro não apurado.</p>}
          {dados.consolidado.situacao !== "OCULTO" && <MotivosCusto motivos={dados.consolidado.motivos} />}
          {podeExportar && (
            <Button variant="outline"
              className="leite-secondary"
              disabled={exportando}
              onClick={() => void exportar()}
            >
              {exportando
                ? "Preparando exportação…"
                : "Exportar período em CSV"}
            </Button>
          )}
          <RitmoLeite dias={dados.ritmo} />
          <div className="leite-tabela-scroll">
            <Table semContainer>
              <TableCaption>Custos individuais no período</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Animal</TableHead>
                  <TableHead>Litros medidos</TableHead>
                  <TableHead>Custo registrado</TableHead>
                  <TableHead>Custo/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.animais.map((a) => (
                  <TableRow key={a.animalId}>
                    <TableCell>
                      <a href={`/pecuaria/rebanho/animais/${a.animalId}`}>
                        {a.brinco ?? "Sem brinco"}
                        {a.nome ? ` · ${a.nome}` : ""}
                      </a>
                      {a.situacao !== "OCULTO" && <MotivosCusto motivos={a.motivos} />}
                    </TableCell>
                    <TableCell>{formatarLitros(a.producao.litros)}</TableCell>
                    <TableCell>
                      {a.situacao === "OCULTO"
                        ? "Restrito"
                        : dinheiro(a.custos.totalConhecido)}
                    </TableCell>
                    <TableCell>
                      {a.situacao === "OCULTO"
                        ? "Restrito"
                        : dinheiro(a.custoPorLitro)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!dados.animais.length && (
            <p>
              Nenhum animal com medição no período. Registre as ordenhas para
              relacionar produção e custos.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function MotivosCusto({ motivos }: { motivos: string[] }) {
  const rotulos: Record<string, string> = {
    FINALIDADE_CUSTO_PENDENTE: "Finalidade na data de um custo não comprovada; custo por litro não apurado.",
    PERIODO_FINALIDADE_SEM_RATEIO: "Custo de um intervalo com mais de uma finalidade, sem separação comprovada; custo por litro não apurado.",
    FINALIDADE_PRODUCAO_PENDENTE: "Finalidade histórica da produção a conciliar; litros registrados preservados.",
  };
  return <>{motivos.filter(m => rotulos[m]).map(m => <p key={m} className="leite-muted">{rotulos[m]}</p>)}</>;
}
