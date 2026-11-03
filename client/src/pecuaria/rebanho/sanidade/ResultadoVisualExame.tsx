import { resultadoExameSanitario } from "./rotulos";
import type { ExameResultado } from "./ResultadoExame";
import { nomeCampoExame } from "./CamposExame";

/** Usa somente o escore e os limites preservados na coleta; não atribui interpretação clínica. */
export function escalaRegistrada(exame: ExameResultado) {
  if (exame.formatoSnapshot.tipoResultado !== "MULTIPLO") return null;
  const ler = (codigo: string) => exame.resultados?.find(r => r.campo === codigo)?.valor;
  const numero = (valor: unknown) => typeof valor === "number" ? valor : typeof valor === "string" && /^-?\d+(?:[.,]\d+)?$/.test(valor.trim()) ? Number(valor.trim().replace(",", ".")) : null;
  const valor = numero(ler("ESCORE")), minimo = numero(ler("ESCALA_MIN")), maximo = numero(ler("ESCALA_MAX"));
  if (valor == null || minimo == null || maximo == null || ![valor, minimo, maximo].every(Number.isFinite) || maximo <= minimo) return null;
  return { valor, minimo, maximo, descricao: ler("ESCALA_DESCRICAO") };
}
export function ResultadoVisualExame({ exame, onAbrirCompleto }: { exame: ExameResultado; onAbrirCompleto?: () => void }) {
  const escala = escalaRegistrada(exame);
  const resultado = resultadoExameSanitario(exame);
  if (!escala && exame.formatoSnapshot.tipoResultado === "MULTIPLO" && exame.resultados?.length && onAbrirCompleto) {
    const visiveis = exame.resultados.slice(0, 3);
    const adicionais = exame.resultados.length - visiveis.length;
    return <div className="san-exame-resumo"><dl>{visiveis.map(r => {
      const campo = exame.formatoSnapshot.campos?.find(c => c.codigo === r.campo);
      const valor = typeof r.valor === "boolean" ? r.valor ? "Sim" : "Não" : typeof r.valor === "number" ? r.valor.toLocaleString("pt-BR", { maximumFractionDigits: 20 }) : String(r.valor);
      return <div key={r.campo}><dt>{nomeCampoExame(campo ?? { codigo: r.campo })}</dt><dd>{valor}{campo?.unidade ? ` ${campo.unidade}` : ""}</dd></div>;
    })}</dl><button type="button" className="consulta-entidade-acao san-exame-abrir" onClick={onAbrirCompleto}>Ver resultado completo{adicionais > 0 ? ` · ${adicionais} ${adicionais === 1 ? "informação adicional" : "informações adicionais"}` : ""}</button></div>;
  }
  if (!escala) return <span className="text-base font-semibold break-words">{resultado === "Aguardando resultado" ? "—" : resultado}</span>;
  const pontos = Number.isInteger(escala.minimo) && Number.isInteger(escala.maximo) && escala.maximo - escala.minimo <= 9 ? Array.from({ length: escala.maximo - escala.minimo + 1 }, (_, i) => escala.minimo + i) : null;
  return <><div className="consulta-escala"><span>{escala.valor.toLocaleString("pt-BR")} / {escala.maximo.toLocaleString("pt-BR")}</span>{pontos && <ol aria-label={`Escala registrada de ${escala.minimo} a ${escala.maximo}`}>{pontos.map(n => <li key={n} aria-current={n === escala.valor ? "true" : undefined}>{n}</li>)}</ol>}</div><details className="consulta-entidade-acao mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer">Escala e informações registradas</summary><p className="mt-2">Mínimo {escala.minimo} · máximo {escala.maximo}{typeof escala.descricao === "string" ? ` · ${escala.descricao}` : ""}</p>{exame.resultados?.filter(r => !["ESCORE", "ESCALA_MIN", "ESCALA_MAX", "ESCALA_DESCRICAO"].includes(r.campo)).map(r => <p key={r.campo}>{nomeCampoExame(exame.formatoSnapshot.campos?.find(c => c.codigo === r.campo) ?? { codigo: r.campo })}: {String(r.valor)}</p>)}</details></>;
}
