import{useState}from'react';
import{Card}from'../../src/components/ui/card';
import{Badge}from'../../src/components/ui/badge';
import{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from'../../src/components/ui/select';
import{Table,TableHeader,TableBody,TableHead,TableRow,TableCell}from'../../src/components/ui/table';
import{AlternarVisualizacaoConsulta}from'../../src/components/VisualizacaoConsulta';
import{AjudaCampo}from'../../src/components/Dica';
import{TrendingUp,TrendingDown,CalendarDays}from'lucide-react';
import{ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip}from'recharts';
import'./producao-individual.css';
// Aferições ilustrativas independentes. Não são rateio da produção geral ou registros importados.
const afericoes=[
 {data:'2026-03-20',manha:9.6,tarde:7.1,noite:8.1},
 {data:'2026-04-20',manha:10.2,tarde:7.6,noite:8.4},
 {data:'2026-05-20',manha:9.8,tarde:7.4,noite:8.2},
 {data:'2026-06-20',manha:10.8,tarde:8.2,noite:8.9},
 {data:'2026-07-20',manha:11,tarde:8.3,noite:9},
 {data:'2026-08-20',manha:10.6,tarde:7.9,noite:8.6},
 {data:'2026-09-20',manha:11.3,tarde:8.6,noite:9.3},
 {data:'2026-10-20',manha:11.8,tarde:8.9,noite:9.7},
].map(a=>({...a,total:Math.round((a.manha+a.tarde+a.noite)*10)/10}));
const n=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const data=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR');
function Campo({nome,valor}:{nome:string;valor:React.ReactNode}){return <div><dt>{nome}</dt><dd>{valor}</dd></div>}
export function ProducaoIndividual(){const[meses,setMeses]=useState('12'),[modo,setModo]=useState<'visual'|'tabela'>('visual');
 const periodo=meses==='3'?afericoes.slice(-3):meses==='6'?afericoes.slice(-6):afericoes;
 const ultima=periodo.at(-1)!;const anterior=periodo.at(-2);const variacao=anterior?Math.round((ultima.total-anterior.total)*10)/10:null;
 const media=periodo.reduce((a,r)=>a+r.total,0)/periodo.length;const maior=periodo.reduce((a,r)=>r.total>a.total?r:a);
 return <div className="animal-producao-previa"><header className="animal-producao-titulo"><h2>Produção individual<AjudaCampo rotulo="Sobre as aferições desta prévia" texto="Aferições ilustrativas do animal, independentes da planilha geral. A implementação usa os registros individuais existentes; não divide o volume do sítio pelo número de vacas."/></h2><div><Badge variant="secondary">Dados ilustrativos</Badge><Select value={meses} onValueChange={setMeses}><SelectTrigger aria-label="Período das aferições do animal"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem></SelectContent></Select></div></header>
 <div className="animal-indicadores"><Card asChild><section><span>Última aferição</span><strong>{n(ultima.total)}<small> L</small></strong><div className={variacao!=null&&variacao>=0?'variacao-positiva':'variacao-negativa'}>{variacao!=null&&(variacao>=0?<TrendingUp size={15}/>:<TrendingDown size={15}/>)}{variacao==null?'Sem comparação':`${variacao>=0?'+':''}${n(variacao)} L frente à anterior`}<AjudaCampo rotulo="Sobre a variação da produção" texto={anterior?`Compara ${data(ultima.data)} com ${data(anterior.data)}. Variação de ${n((ultima.total-anterior.total)/anterior.total*100)}%.`:'É preciso ter duas aferições para comparar.'}/></div></section></Card>
 <Card asChild><section><span>Média das aferições<AjudaCampo rotulo="Sobre a média das aferições" texto="Média somente dos dias em que houve controle individual. Não representa a média de todos os dias do mês nem estima o volume nos intervalos."/></span><strong>{n(media)}<small> L</small></strong><div>{periodo.length} controles no período</div></section></Card>
 <Card asChild><section><span>Maior aferição</span><strong>{n(maior.total)}<small> L</small></strong><div>{data(maior.data)}</div></section></Card></div>
 <div className="animal-curva-rotina"><Card asChild className="animal-curva"><section aria-label="Evolução das aferições individuais"><header><h3>Evolução da produção</h3><AjudaCampo rotulo="Como ler a evolução individual" texto="Cada ponto é uma aferição individual registrada. A linha apenas conecta os pontos para comparação; não preenche nem estima a produção dos dias entre controles. Aumentos e quedas referem-se às medições observadas."/></header><div className="animal-curva-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={periodo} margin={{top:16,right:16,bottom:8,left:0}}><CartesianGrid vertical={false} stroke="var(--border)"/><XAxis dataKey="data" tickFormatter={s=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'})} fontSize={11} axisLine={false} tickLine={false}/><YAxis domain={[0,'auto']} tickFormatter={v=>`${n(v)} L`} fontSize={11} width={48} axisLine={false} tickLine={false}/><Tooltip labelFormatter={s=>data(String(s))} formatter={v=>[`${n(Number(v))} L`,'Aferição individual']}/><Line dataKey="total" type="linear" stroke="var(--primary)" strokeWidth={2.5} dot={{r:4,fill:'var(--card)',strokeWidth:2}} activeDot={{r:6}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></section></Card>
 <Card asChild className="animal-rotina"><section><header><CalendarDays size={18}/><h3>Controle individual</h3></header><dl><Campo nome="Intervalo" valor="Mensal"/><Campo nome="Último controle" valor={data(ultima.data)}/><Campo nome="Próxima referência" valor="20/11/2026"/></dl></section></Card></div>
 <Card asChild className="animal-historico"><section><header><h3>Aferições do animal</h3><AlternarVisualizacaoConsulta modo={modo} mudar={setModo} rotulo="Apresentação das aferições do animal"/></header>{modo==='visual'?<div className="animal-afericoes">{[...periodo].reverse().map(r=>{const pos=afericoes.findIndex(a=>a.data===r.data),ant=afericoes[pos-1],dif=ant?Math.round((r.total-ant.total)*10)/10:null;return <Card asChild key={r.data}><article><time dateTime={r.data}>{data(r.data)}</time><strong>{n(r.total)}<small> L</small></strong><dl><Campo nome="Manhã" valor={n(r.manha)}/><Campo nome="Tarde" valor={n(r.tarde)}/><Campo nome="Noite" valor={n(r.noite)}/></dl><span className={dif!=null&&dif<0?'variacao-negativa':'variacao-positiva'}>{dif==null?'Primeiro controle':`${dif>=0?'+':''}${n(dif)} L frente à anterior`}</span></article></Card>})}</div>:<Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Manhã · L</TableHead><TableHead>Tarde · L</TableHead><TableHead>Noite · L</TableHead><TableHead>Total · L</TableHead></TableRow></TableHeader><TableBody>{[...periodo].reverse().map(r=><TableRow key={r.data}><TableCell>{data(r.data)}</TableCell><TableCell>{n(r.manha)}</TableCell><TableCell>{n(r.tarde)}</TableCell><TableCell>{n(r.noite)}</TableCell><TableCell><strong>{n(r.total)}</strong></TableCell></TableRow>)}</TableBody></Table>}</section></Card>
 </div>
}
