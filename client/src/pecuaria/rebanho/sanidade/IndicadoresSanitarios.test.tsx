import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CarenciaIndicador, ContagensEtapa, ResumoPaginaSanitaria, rotuloTarefaSanitaria } from "./IndicadoresSanitarios";

describe("indicadores sanitários de apresentação", () => {
  it("atraso é um recorte de tarefas pendentes, nunca de realizadas ou canceladas", () => {
    expect(rotuloTarefaSanitaria("PENDENTE", "2026-10-01", "2026-10-14")).toBe("Atrasada");
    expect(rotuloTarefaSanitaria("PENDENTE", "2026-10-14", "2026-10-14")).toBe("Pendente");
    expect(rotuloTarefaSanitaria("REALIZADA", "2026-10-01", "2026-10-14")).toBe("Realizada");
    expect(rotuloTarefaSanitaria("EXECUCAO_CANCELADA", "2026-10-01", "2026-10-14")).toBe("Execução cancelada");
  });
  it("carência desconhecida/revisão nunca recebe aparência de liberação", () => {
    expect(renderToStaticMarkup(<CarenciaIndicador estado={{ estado: "NAO_INFORMADO" }} agora={0} />)).toContain("pec-estado-alerta");
    const revisao = renderToStaticMarkup(<CarenciaIndicador estado={{ estado: "CONHECIDO", ate: "2026-01-01", prazoZero: true, precisaoAproximada: false }} agora={0} revisao />);
    expect(revisao).toContain("Aplicabilidade pendente");
    expect(revisao).not.toContain("pec-estado-verde");
    expect(renderToStaticMarkup(<CarenciaIndicador estado={{ estado: "NENHUMA" }} agora={0} />)).toContain("Sem aplicações válidas");
  });
  it("mantém todas as contagens de uma etapa, inclusive canceladas, com descrição acessível", () => {
    const html = renderToStaticMarkup(<ContagensEtapa contagens={{ total: 8, pendentes: 4, realizadas: 2, dispensadas: 1, atrasadas: 3, canceladas: 1 }} />);
    expect(html).toContain("8 previstas · 4 pendentes · 2 realizadas · 1 dispensadas · 3 atrasadas · 1 canceladas");
  });
  it("apresenta pendências sem outro card e explicita que atraso é um subconjunto", () => {
    const html = renderToStaticMarkup(<ResumoPaginaSanitaria itens={[{ nome: "pendentes", qtd: 4 }, { nome: "atrasadas", qtd: 3 }]} />);
    expect(html).toContain("pec-resumo-sanitario-inline");
    expect(html).not.toContain("pec-resumo-consulta");
    expect(html).toContain("Nesta página, nos filtros atuais");
    expect(html).toContain("Atrasadas estão incluídas nas pendentes");
  });
});
