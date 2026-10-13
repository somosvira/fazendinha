// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnularFato } from "./AnularFato";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));afterEach(cleanup);
it("anulação de tentativa com dose exige escolher manter consumo ou devolver sem default",async()=>{
 vi.mocked(reqV4).mockResolvedValueOnce({fingerprint:"f",impedimentos:[],efeitos:["Consumo exige conferência"],criasIds:[],exigeDestinoConsumo:true}).mockResolvedValueOnce({});
 render(<AnularFato tipo="tentativas" id="t" propriedadeId={1} onFechar={vi.fn()} onSalvo={vi.fn()}/>);
 await screen.findByText("Destino do material consumido");const confirmar=screen.getByRole("button",{name:"Confirmar anulação"}) as HTMLButtonElement;expect(confirmar.disabled).toBe(true);
 expect(screen.getAllByRole("radio").every(r=>!(r as HTMLInputElement).checked)).toBe(true);
 fireEvent.change(screen.getByLabelText("Motivo"),{target:{value:"Correção do vínculo ao animal"}});fireEvent.click(screen.getByRole("radio",{name:/Manter o consumo/}));fireEvent.click(confirmar);
 await waitFor(()=>expect(reqV4).toHaveBeenCalledTimes(2));expect(vi.mocked(reqV4).mock.calls[1][1]).toMatchObject({destinoConsumo:"MANTER_CONSUMO",fingerprint:"f"});
});
