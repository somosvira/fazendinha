---
name: Terrano
description: Interface de registro, consulta e análise de dados da fazenda
colors:
  primary: "#006f68"
  brand-accent: "#009c91"
  canvas: "#f7f8fa"
  surface: "#ffffff"
  heading: "#203c39"
  text-muted: "#526863"
  border: "#dfe7e5"
  control-border: "#7a928d"
typography:
  headline:
    fontFamily: '"Public Sans", "Helvetica Neue", Arial, sans-serif'
    fontSize: "24px"
  body:
    fontFamily: '"Public Sans", "Helvetica Neue", Arial, sans-serif'
rounded:
  control: "6px"
  panel: "8px"
  tag: "4px"
---

# Design do Terrano

## Overview

Uma boa tela ajuda a registrar um fato corretamente ou a responder uma pergunta sobre os dados da fazenda. Escolha a composição pelo que a pessoa precisa fazer. Na [lista do rebanho](src/pecuaria/rebanho/telas/ListaAnimais.tsx), ela compara animais, abre um indivíduo ou seleciona vários para manejo. Na [ficha animal](src/pecuaria/rebanho/telas/DetalheAnimal.tsx), reconhece o indivíduo e encontra o histórico e as ações junto ao assunto.

## Colors

Use a paleta do [tema compartilhado](src/styles/cooperativa-theme.css). Petróleo identifica ações e seleção, e turquesa é o acento de marca. Superfícies claras e divisórias discretas favorecem a leitura. Dê aos estados um rótulo reconhecível também sem cor.

## Typography

Use Public Sans e a escala do tema. Campos de mesma importância devem ter o mesmo tratamento. Diferencie título, rótulo, valor e ajuda. Aproxime unidades e datas dos valores a que pertencem.

## Layout

Alinhe rótulos e controles irmãos, inclusive quando só um deles apresenta ajuda ou erro. Distribua o espaço pela necessidade do conteúdo. Nomes precisam de espaço para crescer e campos curtos relacionados podem ficar próximos. Use o espaço livre para separar assuntos ou facilitar a leitura. Em tela estreita, preserve a ordem de trabalho.

Agrupe as informações que a pessoa consegue decidir de uma vez. Quando uma escolha determina os campos seguintes ou tem efeitos que merecem conferência, explore etapas. Voltar para corrigir deve preservar o que já foi preenchido.

## Shapes

Reutilize o arredondamento, as bordas e os estados dos componentes compartilhados para que controles equivalentes sejam reconhecíveis em todas as páginas.

## Components

- **Comparação.** Priorize tabelas para conjuntos de registros repetitivos, como produtos em estoque, lotes ou protocolos em execução. Escolha as colunas pela comparação que a pessoa quer fazer.
- **Situação individual.** Um cartão ou bloco contextual funciona bem para reunir um estado, sua data e a ação relacionada, como na situação reprodutiva de um animal.
- **Controles.** Procure uma tabela, um filtro ou um seletor existente antes de criar outro. Para escolher várias categorias, parta do [multisseletor compartilhado](src/components/MultiSelect.tsx). Para marcar uma linha ou confirmar uma escolha independente, use um controle com rótulo ou nome acessível, seleção perceptível e área fácil de acionar.
- **Interação.** Mostre o efeito de selecionar, salvar ou corrigir. Nas aberturas auxiliares, use o diálogo centralizado com foco, rascunho e retorno ao contexto de origem. Confira teclado, toque e conteúdo realista. Se o padrão existente deixar uma dificuldade sem solução, leve a alternativa ao mockup.
