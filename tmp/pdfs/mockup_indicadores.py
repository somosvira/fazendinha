from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4
from datetime import date,timedelta
P='output/pdf/mockup-indicadores-reprodutivos.pdf'
c=canvas.Canvas(P,pagesize=A4);W,H=A4
ink=HexColor('#253c36');muted=HexColor('#586861');green=HexColor('#547568');brown=HexColor('#8b735b');line=HexColor('#dce3df');pale=HexColor('#f2f5f3')
def txt(x,y,s,size=10,bold=False,color=ink):
 c.setFillColor(color);c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,H-y,s)
def rule(y):
 c.setStrokeColor(line);c.setLineWidth(.6);c.line(40,H-y,W-40,H-y)
def box(x,y,w,h,fill=pale):
 c.setFillColor(fill);c.rect(x,H-y-h,w,h,stroke=0,fill=1)
def head(n,title,sub):
 txt(40,38,'TERRANO',14,True);txt(405,38,'Sítio principal',10);rule(51)
 txt(40,84,title,23,True);txt(40,107,sub,10,color=muted)
 txt(40,132,'01/11/2025 a 29/10/2026',10,True);txt(365,132,'Corte: 29/10/2026',10);rule(146)
 rule(798);txt(40,817,'Mockup de PDF | Dados demonstrativos | Não é uma emissão operacional',8,color=muted);txt(510,817,f'{n} / 6',9,True)
def title(y,s):txt(40,y,s,14,True)
def note(y,title_,body):
 box(40,y,W-80,52,HexColor('#f5f2ec'));txt(52,y+18,title_,10,True,color=brown);txt(52,y+36,body,9,color=muted)
def table(y,heads,rows,widths,rowh=28):
 x=40;box(x,y,sum(widths),28)
 for h,w in zip(heads,widths):txt(x+8,y+18,h,8,True);x+=w
 y+=28
 for i,row in enumerate(rows):
  if i%2==1:box(40,y,sum(widths),rowh,HexColor('#f8faf9'))
  x=40
  for val,w in zip(row,widths):txt(x+8,y+18,str(val),9);x+=w
  y+=rowh;rule(y)
 return y
def metric(x,y,label,value,detail=''):
 txt(x,y,label,10,color=muted);txt(x,y+34,value,25,True);txt(x,y+56,detail,9,color=muted)
def page():c.showPage()
# 1
head(1,'Indicadores reprodutivos','Resumo da consulta e cobertura dos resultados')
metric(40,181,'Taxa de serviço','1,18%','1 serviço / 84,62 elegíveis ponderadas')
metric(230,181,'Taxa de concepção','Sem base','0 positivas / 0 com resultado')
metric(420,181,'Taxa de prenhez','Sem base')
rule(260);note(277,'Resultado parcial','6 animais na base válida; 60 animais com elegibilidade pendente.')
title(366,'Atividade nas janelas de 21 dias')
# strip 17 windows, only 16th has service
for i in range(17):
 x=40+i*30;box(x,390,25,65,pale)
 if i==15:box(x,390,25,65,green)
 txt(x+5,474,str(i+1).zfill(2),8,color=muted)
txt(40,497,'17 janelas completas',10,True);txt(290,497,'1 janela com serviço registrado',10,True)
title(544,'Ciclos iniciados no período')
box(40,566,515,14,HexColor('#dfded5'));box(40,566,51.5,14,green)
metric(40,610,'Ciclos','10');metric(177,610,'Com serviço','1');metric(314,610,'Sem serviço','9');metric(451,610,'Saídas','0')
txt(40,721,'Conteúdo',11,True)
txt(40,744,'2 Desempenho   /   3 Bases   /   4 Ciclos   /   5 Animais   /   6 Evidências',10)
page()
# 2
head(2,'Desempenho por período','Comparação de todas as janelas completas da consulta')
title(181,'Taxa de serviço por janela')
# true % axis
for i in range(17):
 x=55+i*29;h=90 if i==15 else 0
 box(x,212,17,100,pale)
 if h:box(x,312-h,17,h,green)
 txt(x,331,str(i+1).zfill(2),7,color=muted)
txt(40,201,'Escala: 0 a 20%',8,color=muted);txt(467,211,'17,8%',10,True)
rows=[];d=date(2025,11,7)
for i in range(17):
 e=d+timedelta(days=20);rows.append([str(i+1).zfill(2),d.strftime('%d/%m/%y')+' - '+e.strftime('%d/%m/%y'),'4' if i==0 else '5,62' if i==15 else '5','1' if i==15 else '0','17,8%' if i==15 else '0%','Sem base']);d=e+timedelta(days=1)
table(354,['Janela','Período','Elegíveis','Serviços','Serviço','Concepção / prenhez'],rows,[35,130,55,50,50,145],rowh=21)
txt(40,780,'Total recalculado: 84,62 elegíveis ponderadas | 1 serviço | taxa de serviço: 1,18%',9,True)
page()
# 3
head(3,'Bases e contagens','Composição de uma janela e rastreabilidade dos denominadores')
box(40,169,515,37);txt(52,193,'Janela detalhada: 07/11/2025 a 27/11/2025',11,True)
for x,v,l in [(40,'4','Elegíveis conhecidas'),(230,'4','Elegíveis ponderadas'),(420,'0','Matrizes servidas')]:metric(x,241,l,v)
title(341,'Origens e ajustes da elegibilidade')
table(360,['Componente','Valor','Unidade / referência'],[['Vazias aptas no início','4','Animais'],['Negativas anteriores','0','Animais'],['Anteriores sem diagnóstico','0','Animais'],['Estimativa de vazias','0','Contribuição estimada'],['Saídas do PEV','0','Animais'],['Contribuição do PEV','0','Participação ponderada'],['Elegibilidade pendente','58','Animais fora da base válida']],[270,65,180])
title(625,'Tentativas e resultados')
table(643,['Tentativas','Positivas','Negativas','Sem diagnóstico','Não classificáveis'],[['0','0','0','0','0']],[90,90,90,125,120])
note(724,'Sem base para concepção','Denominador: 0 tentativas com resultado. Ausência de diagnóstico não é negativo.')
page()
# 4
head(4,'Ciclos e espera','Coorte iniciada no período e marcos comprovados')
metric(40,181,'Ciclos','10');metric(170,181,'Com serviço','1');metric(300,181,'Sem serviço','9');metric(430,181,'Liberação até serviço','305 dias')
rule(264)
for i,(name,dt) in enumerate([('DEV-001 | Lactantes 1','26/10/2026'),('DEV-002 | Lactantes 2','25/10/2026'),('DEV-003 | Lactantes 3','25/10/2026')]):
 y=296+i*145;txt(40,y,name,12,True);txt(421,y,'Sem primeiro serviço',9,color=brown)
 c.setStrokeColor(line);c.line(55,H-y-38,470,H-y-38)
 for x,lab,val,ok in [(55,'Início do ciclo',dt,True),(250,'Liberação','Não comprovada',False),(470,'Primeiro serviço','Não registrado',False)]:
  c.setFillColor(green if ok else white);c.setStrokeColor(green if ok else line);c.circle(x,H-y-38,4,stroke=1,fill=1);txt(x-15,y+62,lab,9,True);txt(x-15,y+80,val,9,color=muted)
 rule(y+113)
note(744,'Amostra de diagramação','3 ciclos exibidos neste mockup. O relatório final deve incluir toda a coorte filtrada.')
page()
# 5
head(5,'Animais considerados','Participação na janela de 07/11/2025 a 27/11/2025')
title(181,'Elegibilidade pendente')
table(202,['Animal','Participação','Contribuição','Tentativas'],[[f'DEV-00{i} | Lactantes {i}','Fora da base','Não informada','0']for i in range(1,5)],[210,110,110,85],rowh=36)
title(435,'Ficha analítica do animal')
box(40,455,515,187)
txt(56,481,'DEV-001 | Lactantes 1',13,True)
for y,label,val in [(514,'Elegibilidade','Pendente'),(544,'Apta desde','Não comprovado'),(574,'Contribuição na janela','Não informada'),(604,'Tentativas nesta janela','0')]:txt(56,y,label,10,color=muted);txt(326,y,val,10,True)
title(687,'Leitura dos campos')
txt(40,714,'Não informado: dado ausente ou não comprovado na referência consultada.',10)
txt(40,737,'Zero: contagem conhecida igual a zero. Os dois estados permanecem distintos.',10)
page()
# 6
head(6,'Evidências e contexto','Informações preservadas junto com o resultado do relatório')
title(183,'Parâmetros da consulta')
table(204,['Parâmetro','Valor'],[['Sítio','Sítio principal'],['Período solicitado','01/11/2025 a 29/10/2026'],['Data de corte','29/10/2026'],['Janelas','17 períodos completos de 21 dias'],['Cobertura inicial','6 dias fora das janelas completas'],['Concepção estimada','Não informada']],[210,305],rowh=30)
title(441,'Pendências que afetam a leitura')
for i,(h,b) in enumerate([('Elegibilidade pendente','Animais sem comprovação não participam da base válida.'),('Concepção não calculável','Não há tentativas com resultado suficiente na consulta.'),('Tentativas em aberto','Ausência de diagnóstico permanece em aberto, sem presumir negativo.')]):
 y=467+i*69;txt(40,y,h,11,True);txt(40,y+22,b,10,color=muted);rule(y+39)
note(701,'Proposta de documento','Dados e fichas são demonstrativos; esta versão valida somente a organização visual.')
c.save();print(P)
