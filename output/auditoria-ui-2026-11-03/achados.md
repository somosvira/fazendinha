# Achados — auditoria de UI 03/11/2026 (rascunho de trabalho)

## Central de alertas — ref. docs/design/alertas/mockup-v1/capturas/feedback-user-1888-central.png
- P2: situações (Demandam atenção/Próximos/Programados) sem contagem; a referência mostra (8)/(2)/(1). Com 126 abertos em Próximos, nada indica que a aba tem itens.
- P3: chips de situação na mesma linha da busca (ref.: linha própria); três marcadores preenchidos simultâneos (situação, Filtros, Tabela).

## Bezerreiro — Animais — ref. docs/design/bezerreiro/index.html#animais (ref-bezerreiro-animais.png)
- P3: sem ordenação "Nome A–Z"; espaço vazio de ~50 px entre título e busca.

## Bezerreiro — Alimentação
- Dado da seed (não UI): fases com identidades de oferta distintas geraram "Oferta 3"; a tela de Configurações usa uma lista única compartilhada. Seed corrigida; banco local mantém a versão antiga.
- P3: horário realizado não indica "estimado" quando horarioEstimado=true.
- P3: Custo "A apurar / oculto" mistura dois estados num rótulo.

## Bezerreiro — Colostragem — ref. index.html#colostragem (ref-bezerreiro-colostragem.png)
- P2: ações das tabelas (origens, banco) empilhadas verticalmente → linhas de 160–200 px; `.bez-acoes` com flex-wrap dentro da célula estreita. Ref.: ações em linha. CORRIGIR (CSS para td .bez-acoes).
- P2: ações sem efeito exibidas desabilitadas ("Destinar" e "Enriquecer" com 0 L livres); "Destinar" desabilitado parece primário claro. Ref.: só ações aplicáveis. CORRIGIR (ocultar quando saldo livre = 0).
- P3: falta o resumo por bezerro (colostro fornecido, Brix, exame) que abre a aba na referência; a informação existe no Acompanhar de cada animal.
- P3: chips Origens/Banco/Enriquecidos/Pendentes coexistem com seções Banco/Embalagens/Histórico sempre visíveis abaixo.

## Bezerreiro — Sanidade / Acompanhamento — sem P0–P2.
- P3 (acompanhamento): "Cancelar programação" aparece mesmo com oferta confirmada no período; o servidor recusa com orientação para estornar.

## Bezerreiro — Custos
- P2: indicador "Alimentação registrada R$ 0,00" exibia apenas o custo conhecido, sem indicar 26 pendências (contrato: desconhecido ≠ zero). CORRIGIDO: rótulo "Alimentação · custo conhecido" + "N pendência(s) a apurar".

## Configurações › Bezerreiro e colostro
- P2: Critérios de transição — nome da fase ocupava uma célula do grid de 2 colunas; campos de fases distintas intercalados. CORRIGIDO: fieldset/legend por fase, grade de 3 colunas (1 no celular).
- Dado da seed: 3 ofertas somando 200% (identidades distintas por fase). Seed corrigida.
- P3: página sem h1 (título "Bezerreiro e colostro" é h2/h3).

## Nutrição — Fechamentos (mensal) — ref. docs/design/nutricao/mockup-fechamento.html (ref-nutricao-fechamento.png)
- Ambiente: nutrição mensal fica atrás de NUTRICAO_MENSAL_ENABLED; servidor local reiniciado com a flag só no processo.
- P3: paginação "Anterior · Página 1 · 0 meses · Próxima" exibida no estado vazio; seletor de lote nativo destoa do SelectCampo; dois botões primários no topo (Conferir consumo, Configurar nutrição).
- P3 (calendário por período): barra "Lactantes" do mês anterior e "+1 períodos…" sobrepostos às linhas da primeira semana.

## Configurações › Nutrição › Modelo e prazo de fechamento
- P2: configuração agendada (a partir de amanhã) não aparecia — "Nenhuma configuração vigente". CORRIGIDO: linha "Agendada: … a partir de dd/mm/aaaa".

## Leite (V5) — ref. docs/design/leite (implementacao-main) + caderno de campo
- P2: ícone em caixa ao lado do título das rotinas (`.leite-identidade-rotina`) e folha no título da Nutrição — o caderno remove ícone ao lado de título; `campo.css` não incluía essas classes. CORRIGIDO (classe incluída na regra; ícone removido do título da Nutrição).
- P2: cabeçalho de Vendas quebrava "Configurações" em segunda linha a 1440 px (identidade com base fixa de 320 px). CORRIGIDO: identidade das rotinas do leite cede espaço (flex 1 1 auto); ações em uma linha.
- P2: listas genéricas do leite (Vendas, Casa e Funcionários, Descarte, Estoque, Qualidade, Configurações) abriam em Cartões, contra "listas abrem em tabela"; cartões desalinham colunas entre linhas. CORRIGIDO: `ListaConsultaLeite` com padrão "tabela" e opção explícita `padrao="visual"`; Ordenhas mantêm cartões via controle próprio. Preferência salva do usuário continua valendo.
- P3: Vendas sem resultado mostra dois estados vazios (bloco superior + cartão da lista).

## Configurações › Sanidade › Alertas (regras e programações) — ref. docs/design/alertas/mockup-configuracao/capturas
- Regras: escopo por sítio correto (regra do Arrendado não aparece no Principal). Sem P0–P2.
- P2: Programações — coluna "Programação" com ~120 px (texto em 4 linhas) e ações empilhadas; linha com ~110 px. CORRIGIDO: larguras de referência (240/220) e ações alinhadas à direita; linha com 64 px.
- P3: ação principal muda de lugar entre as abas ("Nova regra" no cabeçalho, "Adicionar programação" na seção) e os botões de aba mudam ~10 px de posição.

## Agenda de Sanidade — ref. docs/design/alertas/mockup-v1/capturas/agenda-desktop-mes.png
- Sem P0–P2. P3: "1 atividades neste recorte" (concordância).

## Relatórios da Pecuária — ref. client/mockups/catalogo-relatorios, filtros-relatorios, relatorios-pecuaria
- P2: catálogo exibia enums crus ("LEITE") na tabela (caderno: sem caixa alta; texto técnico). CORRIGIDO: `formatarCelula` traduz enums conhecidos do rebanho (aptidão, papel, situação, tipo/classe de baixa); siglas e códigos seguem inalterados.
- P3: busca de Partos sem ícone de lupa (demais barras têm); abas dos relatórios com espaçamento diferente das demais.

## Ficha do animal (reorganizada após 18/10: Geral #344, Produção #348, Reprodução, Sanidade, Alertas)
- Composição, abas e superfícies preservadas desde a bateria de 18/10. Sem regressão visual nas abas Geral e Reprodução.
- P2: auditoria exibia nomes técnicos de entidades novas ("Alteração · VinculoPesagemSecagem"; também MedicaoLeite, AmostraQualidadeLeite, ParcelaDestinoLeite, LoteColostro, NecessidadeSanitaria, ParticipacaoBezerreiro — levantadas no banco local). CORRIGIDO: rótulos no registro do servidor (`auditoria-animal.ts`); pesagem da secagem e retirada de colostro no eixo Reprodução, necessidade sanitária no eixo Sanidade, leite e bezerreiro sem eixo (o eixo Nutrição tem filtro próprio de participação).
- Dado: DEV-033 seca hoje permanece no lote "Lactantes" (a secagem não movimenta lote).
- P2 (ficha › Produção): bloco "Peso da matriz no encerramento" exibia "Registro: <UUID da pesagem>". CORRIGIDO: linha removida (o vínculo segue no histórico e na auditoria).
- P3 (ficha › Produção): vaca seca mostra "Início da lactação/Dias em lactação: Não informado" e "Abrir controle individual" como ação principal.

## Busca global — ref. client/mockups/busca-global/desktop.png
- P2: contexto exibia "Sítio selecionado" sem o nome (ref.: nome do escopo). CORRIGIDO: nome do sítio ativo carregado ao abrir a busca; Consolidado mantém "Consolidado · Todos os sítios".
- Teclado: Ctrl+K abre, Esc fecha. P3: ao abrir pelo atalho, o foco volta ao body.
- P3: anel de foco duplo no campo; movimentos de estoque com observação "bezerreiro" aparecem antes da página Bezerreiro.
