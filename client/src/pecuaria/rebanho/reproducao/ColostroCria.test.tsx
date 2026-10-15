// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ColostroCria } from "./ColostroCria";
import { reqV4 } from "./api";
vi.mock("./api",()=>({reqV4:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("registra fornecimento à cria com unidade explícita, Brix zero e retry idempotente",async()=>{
  const post=vi.fn().mockRejectedValueOnce(new Error("Tente novamente")).mockResolvedValueOnce({});
  vi.mocked(reqV4).mockImplementation((path,body)=>body?post(body):Promise.resolve([]));
  render(<ColostroCria criaId="cria" propriedadeId={1} dataParto="2026-10-13" podeLancar onMudou={vi.fn()}/>);
  await screen.findByText("Nenhum fornecimento informado.");
  fireEvent.click(screen.getByRole("button",{name:"Adicionar fornecimento"}));
  fireEvent.change(screen.getByLabelText("Quantidade (opcional)"),{target:{value:"1500"}});
  fireEvent.change(screen.getByLabelText("Unidade"),{target:{value:"ML"}});
  fireEvent.change(screen.getByLabelText("Método de qualidade"),{target:{value:"REFRATOMETRO_BRIX"}});
  fireEvent.change(screen.getByLabelText("Leitura Brix (%)"),{target:{value:"0"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar fornecimento"}));
  await screen.findByText("Tente novamente");
  expect(post.mock.calls[0][0]).toMatchObject({criaId:"cria",quantidade:1500,unidade:"ML",metodoQualidade:"REFRATOMETRO_BRIX",qualidadeBrix:0,qualidadeClassificacao:null});
  fireEvent.click(screen.getByRole("button",{name:"Salvar fornecimento"}));
  await waitFor(()=>expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[1][0]).toEqual(post.mock.calls[0][0]);
  expect(vi.mocked(reqV4).mock.calls.filter(([, body]) => body).every(([, , method, sitio]) => method === "POST" && sitio === 1)).toBe(true);
});
it("corrige com versão e motivo sem transformar mL em litros informados",async()=>{
  const item={id:"f",versao:3,status:"VALIDO",data:"2026-10-13",ocorridoEm:null,horarioEstimado:false,quantidadeLitros:"1.5",unidadeInformada:"ML",metodoQualidade:null,qualidadeBrix:null,qualidadeClassificacao:null,tipo:null,forma:null,responsavel:null,observacao:null};
  vi.mocked(reqV4).mockImplementation((path,body)=>Promise.resolve(body?{}:[item]));
  render(<ColostroCria criaId="cria" propriedadeId={1} dataParto="2026-10-13" podeLancar onMudou={vi.fn()}/>);
  fireEvent.click(await screen.findByRole("button",{name:"Corrigir fornecimento"}));
  expect((screen.getByLabelText("Quantidade (opcional)") as HTMLInputElement).value).toBe("1500");
  fireEvent.change(screen.getByLabelText("Motivo da correção"),{target:{value:"Correção do responsável"}});
  fireEvent.change(screen.getByLabelText("Responsável pelo fornecimento (opcional)"),{target:{value:"Maria"}});
  fireEvent.click(screen.getByRole("button",{name:"Salvar fornecimento"}));
  await waitFor(()=>expect(reqV4).toHaveBeenCalledWith("/reproducao/colostro/f",expect.objectContaining({versaoEsperada:3,motivo:"Correção do responsável",quantidade:1500,unidade:"ML",responsavel:"Maria"}),"PATCH",1));
});
