from pathlib import Path
from html import escape as e
base=Path(__file__).parent
# Diagramas conceituais: não são DDL nem schema aplicado.
graphs=[('participacao','Participação, fases e ficha',[
('Lote','existente',['id · propriedadeId','Localização e movimentos existentes']),('PerfilBezerreiro','novo',['id · loteId UNIQUE','Especializa um lote autorizado']),('Animal','existente',['id · nascimento · sexo','Identidade única durante toda a vida']),
('FaseBezerreiroVersao','novo',['id · coleiraId · vigência','Nome, programação e versão']),('ParticipacaoBezerreiro','novo',['id · animalId · perfilId','entrada · saída · motivo · autoria']),('ColeiraBezerreiro','novo',['id · propriedadeId · nome · cor','Identificação visual configurável']),
('PeriodoFaseBezerreiro','novo',['id · participacaoId · faseVersaoId','desde · até · motivo; sem sobreposição']),('Historico do bezerreiro','consulta',['Projeção da participação e fatos','Não cria outro cadastro de animal']),('OfertaProgramadaBezerreiro','novo',['id · faseVersaoId · identidadeId','ordem · percentual · hora opcional'])],[(0,1,'1 : 0..1'),(1,4,'1 : N'),(2,4,'1 : N'),(5,3,'1 : N'),(3,6,'1 : N'),(4,6,'1 : N'),(4,7,'consulta'),(3,8,'1 : N')]),
('alimentacao','Previsão, oferta coletiva e custo',[
('PeriodoFase + OfertaProgramada','novo',['Versões vigentes na data/oferta','Participantes e doses por coleira']),('PrevisaoAlimentacao','consulta',['Contagem × dose diária da coleira','Não gera estoque ou consumo']),('EntradaProducaoLeite','existente',['Origens confirmadas e saldo','NAO_COMERCIAL antes de COMERCIAL']),
('OfertaBezerreiro','novo',['data · hora opcional · chave','perfilId · programação opcional']),('GrupoOfertaBezerreiro','novo',['coleiraId · volume coletivo','Snapshots de participantes/fase']),('ItemFechamentoConsumo','ampliar',['grupoOfertaId OU fechamentoId','Sem fechamento/animal-dias fictícios']),
('FornecimentoNutricionalLeite','existente',['itemId UNIQUE · quantidadeLitros','Mantém núcleo de baixa e R07']),('MovimentoFornecimento…','existente',['fornecimentoId · entradaId','movimentoId UNIQUE → estoque']),('ParcelaFornecimento…','ampliar',['animalId · quantidadeLitros','ATRIBUIDA_POR_OFERTA; dias null']),
('ReferenciaGerencialLeite','existente',['fornecimentoId · preço · versão','Separada do custo de produção']),('MovimentoEstoque','existente',['Quantidade e valorização real','Estorno inverso; nunca dupla baixa'])],[(0,1,'calcula'),(1,3,'conferir'),(3,4,'1 : N'),(4,5,'1 : 0..1'),(5,6,'1 : 0..1'),(6,8,'1 : N'),(6,7,'1 : N'),(2,7,'1 : N'),(7,10,'1 : 1'),(6,9,'1 : N')]),
('colostro','Origem, banco, enriquecimento e exame da cria',[
('PartoAnimal + matriz','existente',['Parto produtor ≠ parto destinatário','CriaParto mantém a cria real']),('LoteColostro','novo',['partoId · matrizId · produção','Origem bruta, recipiente e saldo']),('AmostraQualidadeLeite','ampliar',['Alvo lote ou preparo explícito','Resultados e formato versionados']),
('UnidadeBancoColostro','novo',['origemId · código · volume 2 L','congelamento · retirada · tipo']),('PreparoColostro','novo',['origens N:N por alocações','insumos reais · volume final']),('OrigemColostro','novo',['Tipo BRUTA ou PREPARADA','Exatamente um vínculo de origem']),
('FornecimentoColostro','ampliar',['criaId · data/hora · litros','N:N origens via alocações']),('ExameAnimal','existente',['animalId · tipoExameId · resultado','Exame da cria, independente do Brix']),('AcompanhamentoColostragem','novo',['criaId · política · exame vinculado','Vínculos e pendências sem inferência']),('CriaParto destinatária','existente',['partoId próprio · animalId','Pode ser de outra matriz']),('Animal destinatário','existente',['id · identidade da cria','O exame pertence a este animal']),('TipoExame','existente',['Método · formato · unidade','Não herda referência do alimento'])],[(0,1,'1 : N'),(1,5,'1 : 1'),(4,5,'1 : 1'),(5,3,'1 : N'),(5,2,'1 : N'),(5,4,'N : N*'),(5,6,'N : N*'),(9,6,'1 : N'),(9,8,'1 : 0..1'),(10,9,'1 : 0..1'),(10,7,'1 : N'),(11,7,'1 : N'),(6,8,'N : 1'),(7,8,'N : 1')])]
colors={'existente':('#e8eff0','#58727a'),'novo':('#e1efeb','#006f68'),'ampliar':('#f8eedb','#8e652d'),'consulta':('#f1edf6','#795a92')}
for slug,title,nodes,edges in graphs:
    w,h=1170,65+((len(nodes)+2)//3)*215; boxes=[]
    for i,(name,status,fields) in enumerate(nodes):
        x=30+(i%3)*390;y=65+(i//3)*215;boxes.append((x,y,330,135))
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{e(title)}"><title>{e(title)}</title><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#7a928d"/></marker></defs><rect width="1170" height="{h}" fill="#fff"/><text x="30" y="30" font-family="sans-serif" font-size="18" fill="#203c39" font-weight="bold">{e(title)} · proposta conceitual</text>']
    for n,(a,b,label) in enumerate(edges):
        ax,ay,aw,ah=boxes[a];bx,by,bw,bh=boxes[b]
        if ay==by and abs(ax-bx)>400:
            sx,sy=ax+aw/2,ay;tx,ty=bx+bw/2,by;mid=ay-20;path=f'M{sx} {sy} V{mid} H{tx} V{ty}';lx,ly=(sx+tx)/2,mid-5
        elif abs(ay-by)>220:
            sx,sy=ax,ay+ah/2;tx,ty=bx+bw/2,by;outside=12+(n%2)*8;mid=by-20;path=f'M{sx} {sy} H{outside} V{mid} H{tx} V{ty}';lx,ly=tx-30,mid-5
        elif ay==by:
            sx,sy=(ax+aw if bx>ax else ax),ay+ah/2;tx,ty=(bx if bx>ax else bx+bw),by+bh/2;mid=(sx+tx)/2;path=f'M{sx} {sy} H{mid} V{ty} H{tx}';lx,ly=mid,sy-9
        else:
            sx,sy=ax+aw/2,ay+ah;tx,ty=bx+bw/2,by;mid=(sy+ty)/2+(n%3-1)*12
            if by<ay:sy=ay;ty=by+bh;mid=(sy+ty)/2
            path=f'M{sx} {sy} V{mid} H{tx} V{ty}';lx,ly=(sx+tx)/2,mid-6
        svg.append(f'<path d="{path}" stroke="#7a928d" stroke-width="1.4" fill="none" marker-end="url(#arrow)"/><text x="{lx}" y="{ly}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#3b5550" paint-order="stroke" stroke="white" stroke-width="4">{e(label)}</text>')
    for (name,status,fields),(x,y,ww,hh) in zip(nodes,boxes):
        fill,stroke=colors[status];svg.append(f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" rx="8" fill="{fill}" stroke="{stroke}"/><text x="{x+14}" y="{y+23}" font-family="sans-serif" font-size="11" fill="{stroke}">{status.upper()}</text><text x="{x+14}" y="{y+48}" font-family="sans-serif" font-size="15" fill="#203c39" font-weight="bold">{e(name)}</text>')
        for j,f in enumerate(fields):svg.append(f'<text x="{x+14}" y="{y+78+j*22}" font-family="sans-serif" font-size="12" fill="#36564d">{e(f)}</text>')
    svg.append('</svg>');(base/(slug+'.svg')).write_text(''.join(svg))
