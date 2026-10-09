# DESIGN.md

## Filosofia de Design

Este sistema **NÃO** é um software para veterinários.

Também **NÃO** é um ERP genérico.

Ele é uma **plataforma de gestão para produtores rurais**.

Toda decisão de design deve partir do usuário final.

Nosso principal usuário é um produtor de leite entre **45 e 70 anos**.

Ele possui vasta experiência no campo, porém pouca familiaridade com tecnologia.

A interface deve transmitir **simplicidade, confiança e clareza**.

Nunca devemos impressionar pelo design.

Devemos impressionar pela **facilidade de uso**.

---

## Nossa prioridade

Sempre seguir esta ordem:

1. **Legibilidade**
2. **Clareza**
3. **Rapidez**
4. **Consistência**
5. **Beleza**

Nunca inverter essa ordem.

---

## Regra de Ouro

Toda tela deve responder esta pergunta:

> **"Um produtor conseguiria entender essa informação em menos de 5 segundos?"**

Se a resposta for **não**, simplifique.

---

## Hierarquia Visual

Toda informação pertence a um destes níveis.

### Nível 1 — Decisão

É aquilo que faz o produtor agir.

Exemplos:

- Lucro
- Receita
- Produção
- Alertas
- CCS
- DEL
- Dias de prenhez
- Meta
- Rentabilidade
- Características

**Regras visuais do Nível 1:**

- Fonte grande.
- Peso 700.
- Maior contraste.
- Maior destaque da tela.

---

### Nível 2 — Informação

Explica o indicador.

Exemplos:

- Receita da lactação
- Produção atual
- CCS
- Diagnóstico

**Regras visuais do Nível 2:**

- Peso intermediário.
- Boa leitura.
- Sem competir com os números do Nível 1.

---

### Nível 3 — Contexto

Descrições.

Observações.

Datas.

Textos auxiliares.

**Regras visuais do Nível 3:**

- Podem utilizar cinza.
- Nunca competir com informações importantes.

---

## Tipografia

Nunca utilizar fontes extremamente finas.

Priorizar pesos:

- **500**
- **600**
- **700**

Evitar peso **300**.

Evitar textos pequenos.

Toda informação importante deve poder ser lida a aproximadamente **um metro de distância**.

---

## Tamanho das Fontes

| Tipo | Tamanho |
|---|---|
| Título principal | **40px** |
| KPIs | **30–36px** |
| Títulos de cards | **20–24px** |
| Texto padrão | **16–18px** |
| Texto auxiliar | **15–16px** |

Nunca utilizar menos que **14px**.

---

## Contraste

Contraste é **obrigatório**.

Informações importantes **nunca** devem utilizar cinza claro.

Usar **preto** ou **quase preto**.

Cinza apenas para informações secundárias.

---

## Cores

As cores possuem significado.

| Cor | Significado |
|---|---|
| **Verde** | Lucro · Bom · Saudável · Confirmado |
| **Vermelho** | Prejuízo · Erro · Doença · Urgência |
| **Amarelo** | Atenção · Monitoramento |
| **Azul** | Informação · Indicadores · Neutro |
| **Marrom** | Categorias rurais · Linha do tempo |

Nunca utilizar cores apenas por estética.

**Toda cor deve comunicar significado.**

---

## KPIs

Cada KPI deve responder:

1. **O que aconteceu?**
2. **O que significa?**
3. **Preciso fazer algo?**

**Exemplo ruim**

```
21 litros
```

**Exemplo bom**

```
Produção
21 litros/dia
Estável nas últimas quatro semanas.
```

---

## Cards

- Poucos cards.
- Muito espaço em branco.
- Sem excesso de bordas.
- Sem sombras exageradas.
- Visual limpo.

---

## Botões

- Poucos.
- Grandes.
- Bem espaçados.
- Texto claro.
- Nunca esconder ações importantes.

---

## Ícones

- Todo ícone deve possuir significado.
- Nunca decorar.
- Ícones ajudam a leitura.
- **Não substituem texto.**

---

## Timeline

A Timeline é o **coração do sistema**.

Ela deve contar a história do animal.

Cada evento precisa responder:

- O que aconteceu?
- Quando aconteceu?
- Quem realizou?
- Qual o impacto?
- Qual o próximo passo?

Sempre que possível, adicionar uma **interpretação automática**.

**Exemplos:**

- Produção manteve estabilidade.
- CCS melhorou.
- Prenhez confirmada.
- Persistência acima da média.

---

## Inteligência

O sistema **nunca** deve apenas mostrar números.

Sempre que possível, **explicar**.

**Exemplo 1:**

```
CCS
130 mil
Excelente.
Muito abaixo do limite recomendado.
Nenhuma ação necessária.
```

**Exemplo 2:**

```
Produção caiu 12%.
Prováveis causas:
• início da secagem
• estresse térmico
• alteração alimentar
```

---

## Linguagem

Evitar linguagem técnica quando possível.

Sempre que existir uma alternativa simples, utilizar a simples.

**Ao invés de:**

> Persistência da curva de lactação.

**Preferir:**

> Produção continua estável.

---

## Financeiro

Sempre relacionar eventos com dinheiro.

O produtor pensa em **lucro**.

Todo módulo deve responder:

- Quanto isso **custa**?
- Quanto isso **gera**?
- Quanto isso **economiza**?

---

## Navegação

O usuário **nunca** deve ficar perdido.

Sempre deixar claro:

- Onde estou?
- Qual animal?
- Qual lote?
- Qual período?

---

## Acessibilidade

Projetar considerando:

- Usuários acima de 50 anos.
- Baixa visão.
- Óculos multifocal.
- Uso em ambientes muito iluminados.
- Notebook antigo.
- Tablet.
- Celular.

Todo componente deve permanecer legível.

---

## Filosofia Geral

Este software deve parecer um **gerente experiente da fazenda**.

Não um sistema burocrático.

Cada tela deve responder:

1. O que aconteceu?
2. O que está acontecendo?
3. O que vai acontecer?
4. O que preciso fazer agora?
5. Qual o impacto financeiro?

Se uma informação **não ajuda o produtor a tomar decisão**, ela provavelmente **não merece destaque**.

---

## Mantra do Projeto

> **Transformamos dados em decisões.**
>
> **Transformamos eventos em inteligência.**
>
> **Transformamos gestão em lucro.**

Antes de implementar qualquer tela, componente ou funcionalidade, pergunte:

> **"Isso ajuda o produtor a tomar uma decisão melhor?"**

Se a resposta for **não**, repense a implementação.

## Cores nas páginas financeiras em grid

Nas páginas financeiras revisadas, preserve o bege Terrano, cards claros e os detalhes aprovados: faixas finas, cabeçalhos suaves, ícones e cards de efeitos. A paleta de interface fica restrita a marrom, verde, vermelho e preto/grafite, além das superfícies neutras. Não usar azul informativo nem amarelo forte. Abas selecionadas mantêm grafite com texto branco.

`financeiro/cores-financeiro.css` usa verde (`--lucro`) para entradas/disponibilidade e confirmação, vermelho (`--prejuizo`) para saídas, atrasos e ações destrutivas, e marrom (`--rural`/`--cafe`) para informação, classificação e pendência. A diferenciação de categorias nos gráficos continua discreta. Preserve rótulos, sinais e status: cor nunca é a única indicação. A camada se aplica às telas e diálogos revisados, mantendo o grid compacto e as primitivas shadcn.

Nas demais telas financeiras auditadas, aplique o mesmo padrão: sempre primitivas shadcn locais, tabela compacta com rolagem contida e paginação, formulários extensos em Sheet largo com grid e cadastros simples em Dialog. Compactar significa organizar e reduzir repetições; não reduzir legibilidade nem retirar dados da consulta.
