// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { CampoDataIatf, dataHoraISO, horarioIatf, inputHorarioIatf } from "./CampoDataIatf";
import { dadosConfirmacaoVisita } from "./visitas-transcricao";
afterEach(cleanup);
it("pede a data, deixa a hora opcional e permite apagar uma hora conhecida", () => {
  const mudou=vi.fn();
  function Form(){const [v,set]=useState("");return <CampoDataIatf rotulo="Início" valor={v} onChange={v=>{set(v);mudou(v);}}/>;}
  render(<Form/>);
  const data=screen.getByLabelText("Início") as HTMLInputElement, hora=screen.getByLabelText("Horário (opcional) · Início") as HTMLInputElement;
  expect(data.required).toBe(true);expect(hora.required).toBe(false);
  fireEvent.change(data,{target:{value:"2026-10-01"}});expect(mudou).toHaveBeenLastCalledWith("2026-10-01");
  fireEvent.change(hora,{target:{value:"08:30"}});expect(mudou).toHaveBeenLastCalledWith("2026-10-01T08:30");
  fireEvent.change(hora,{target:{value:""}});expect(mudou).toHaveBeenLastCalledWith("2026-10-01");
});
it("não fabrica hora na requisição, na transcrição ou na apresentação", () => {
  expect(dataHoraISO("2026-10-01")).toBe("2026-10-01");
  expect(inputHorarioIatf("2026-10-01T00:00:00.000Z","DIA")).toBe("2026-10-01");
  expect(horarioIatf("2026-10-01T00:00:00.000Z","DIA")).toBe("01/10/2026 · horário não informado");
  expect(dadosConfirmacaoVisita("INICIAR_IATF",{inicioEfetivo:"2026-10-01"})).toMatchObject({inicioEfetivo:"2026-10-01"});
  expect(dadosConfirmacaoVisita("TAREFA_IATF",{realizadaEm:"2026-10-01",dados:{}})).toMatchObject({realizadaEm:"2026-10-01"});
  expect(()=>dataHoraISO("2026-02-30")).toThrow();
});
