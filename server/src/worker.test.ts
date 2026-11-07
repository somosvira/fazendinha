import { describe,it,expect,vi,beforeEach } from "vitest";
const mock=vi.hoisted(()=>({env:{ASSISTENTE_CONSULTA_ENABLED:false,REPRODUCAO_AUTOMACAO_ENABLED:false,ALERTAS_CRON_ENABLED:false,NUTRICAO_MENSAL_ENABLED:false,NUTRICAO_AUTOMACAO_ENABLED:false},radar:vi.fn(),isolar:vi.fn(),automacoes:vi.fn(),nutricao:vi.fn(),criar:vi.fn(),avaliar:vi.fn(),disconnect:vi.fn(),fetch:vi.fn().mockResolvedValue(new Response("ok"))}));
vi.mock("./env.js",()=>({env:mock.env}));
vi.mock("./app.js",()=>({app:{fetch:mock.fetch}}));
vi.mock("./db.js",()=>({criarPrismaClient:mock.criar,comPrismaPorRequisicao:mock.isolar}));
vi.mock("./services/pecuaria/sanidade/alertas/avaliador.js",()=>({avaliarAlertasTemporais:mock.avaliar}));
vi.mock("./services/pecuaria/nutricao/mensal.js",()=>({processarPendentes:mock.nutricao}));
vi.mock("./services/assistente/radar/servico.js",()=>({processarRadarDiario:mock.radar}));
vi.mock("./services/pecuaria/protocolos/automacao.js",()=>({processarAutomacoes:mock.automacoes}));
import worker from "./worker.js";
describe("Worker fetch e scheduled",()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.env.ASSISTENTE_CONSULTA_ENABLED=false;mock.env.REPRODUCAO_AUTOMACAO_ENABLED=false;mock.env.ALERTAS_CRON_ENABLED=false;mock.env.NUTRICAO_MENSAL_ENABLED=false;mock.env.NUTRICAO_AUTOMACAO_ENABLED=false;mock.isolar.mockImplementation(f=>f());mock.criar.mockReturnValue({$disconnect:mock.disconnect});});
 it("radar usa contexto isolado e preserva gate",async()=>{mock.env.ASSISTENTE_CONSULTA_ENABLED=true;await worker.scheduled({scheduledTime:123});expect(mock.radar).toHaveBeenCalledWith(new Date(123));expect(mock.isolar).toHaveBeenCalledOnce();});
 it("fetch mantém encaminhamento Hono",async()=>{const r=await worker.fetch(new Request("http://localhost/api/health"));expect(r.status).toBe(200);expect(mock.fetch).toHaveBeenCalledOnce();});
 it("cron fica desligado por padrão sem criar client",async()=>{await worker.scheduled({scheduledTime:0});expect(mock.criar).not.toHaveBeenCalled();});
 it("nutrição exige ambos os gates e usa contexto próprio mesmo sem cron sanitário",async()=>{
  mock.env.NUTRICAO_MENSAL_ENABLED=true;
  await worker.scheduled({scheduledTime:123});expect(mock.nutricao).not.toHaveBeenCalled();
  mock.env.NUTRICAO_AUTOMACAO_ENABLED=true;
  await worker.scheduled({scheduledTime:123});expect(mock.isolar).toHaveBeenCalledOnce();expect(mock.nutricao).toHaveBeenCalledOnce();expect(mock.criar).not.toHaveBeenCalled();
 });
 it("cada scheduled possui client e encerra mesmo em falha",async()=>{mock.env.ALERTAS_CRON_ENABLED=true;mock.avaliar.mockRejectedValueOnce(new Error("falha controlada"));await expect(worker.scheduled({scheduledTime:123})).rejects.toThrow("falha controlada");expect(mock.criar).toHaveBeenCalledOnce();expect(mock.avaliar).toHaveBeenCalledWith(expect.objectContaining({$disconnect:mock.disconnect}),new Date(123));expect(mock.disconnect).toHaveBeenCalledOnce();});
 it("automação tem gate próprio e roda a cada minuto; alertas conservam 15 minutos",async()=>{
   mock.env.REPRODUCAO_AUTOMACAO_ENABLED=true;mock.env.ALERTAS_CRON_ENABLED=true;
   await worker.scheduled({scheduledTime:60_000,cron:"* * * * *"});
   expect(mock.automacoes).toHaveBeenCalledWith(new Date(60_000));expect(mock.avaliar).not.toHaveBeenCalled();
   await worker.scheduled({scheduledTime:900_000,cron:"* * * * *"});expect(mock.avaliar).toHaveBeenCalledOnce();
 });
 it("falha da fila de reprodução não impede alertas e nutrição",async()=>{
   mock.env.REPRODUCAO_AUTOMACAO_ENABLED=true;mock.env.ALERTAS_CRON_ENABLED=true;mock.env.NUTRICAO_MENSAL_ENABLED=true;mock.env.NUTRICAO_AUTOMACAO_ENABLED=true;
   mock.automacoes.mockRejectedValueOnce(new Error("banco indisponível"));const log=vi.spyOn(console,"error").mockImplementation(()=>{});
   await worker.scheduled({scheduledTime:900_000,cron:"* * * * *"});expect(mock.avaliar).toHaveBeenCalledOnce();expect(mock.nutricao).toHaveBeenCalledOnce();log.mockRestore();
 });
});
