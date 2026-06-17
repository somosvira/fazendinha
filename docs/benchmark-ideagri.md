# Benchmark IDEAGRI × Fazendinha

> Levantamento de fontes públicas para informar o roadmap do Fazendinha.
> **Data:** 2026-06-16 · **Status:** v1 sem acesso à conta do produto (futuras versões devem incorporar prints/exports cedidos pelo team leader).
> **Escopo:** estudo de domínio e estrutura, não engenharia reversa de binário.

---

## 1. Sumário executivo

O **IDEAGRI** (hoje comercializado como **Ideagri Pro** sob o guarda-chuva da **Rumina**, sediada em MG) é o software brasileiro de referência para gestão pecuária leiteira profissional. Originalmente um **monolito desktop Windows** com módulos pagos vendidos separadamente (IATF, Techmilk, IILB), evoluiu nos últimos anos para um **ecossistema híbrido desktop + cloud + mobile**, com o desktop ainda como **fonte da verdade** e os módulos web/app alimentados por **upload de backup do banco local**.

A Rumina vem agregando ao redor desse núcleo um portfólio de **produtos físicos + serviços de IoT** (OnFarm para mastite, RúmiAction para saúde, RúmiFlow para higienização de tetos, RúmiScore para produtividade) e camadas modernas de produto (**Rúmi** — assistente IA via WhatsApp; **Rúmina Insights** — BI com 60+ KPIs em tempo real). É uma estratégia clara de "stack vertical de fazenda leiteira".

**Forças principais:**
- 20+ anos de domínio modelado (relatórios prontos para conformidade técnica e fiscal).
- **Benchmarking anônimo entre fazendas** (IILB) — moat de dados.
- Integrações nativas com as 3 grandes ordenhadeiras (DeLaval DelPro, GEA DairyPlan, Allflex/MSD SenseHub).
- Base instalada e suporte humano via WhatsApp/telefone — produto "incumbente" do setor.

**Fraquezas exploráveis:**
- Arquitetura desktop-first → sync por upload de backup, fricção, ausência de tempo real real.
- UX legada (instaladores `.exe`, "Receber Coletas" como verbo de produto, login por "chaves" em vez de e-mail/SSO).
- Módulos historicamente fragmentados (IATF roda em subdomínio próprio `sistema.ideagriiatf.com.br`) sugerem stacks heterogêneas internas.
- Modelo de licenciamento por contrato/módulo — feature behind paywall ("disponibilidade varia por perfil de contrato").
- Curva de adoção: requer **treinamento formal** (existe um produto **Ideagri Play** só para isso) — indicativo de UX que não se ensina sozinha.

**Onde o Fazendinha pode ganhar (hipóteses iniciais):**
- Web-first / cloud-native real — sem instalador, sem backup-upload, sync transparente.
- UX moderna (formulários conversacionais, mobile com paridade de funcionalidade, OCR de NF como já estamos construindo).
- Modelo de dados único e consistente entre módulos (vs. silos com SQL queries específicos por módulo).
- Foco em **regime de caixa explícito** (Realizado/Projeção) que o produtor entende, em vez de regime contábil camuflado.

---

## 2. Mapa do ecossistema IDEAGRI / Rumina

```
                       ┌─────────────────────────────────────┐
                       │       Painel Ideagri (hub UI)        │
                       └──┬────────┬────────┬────────┬───────┘
                          │        │        │        │
                          ▼        ▼        ▼        ▼
   ┌──────────────┐  ┌─────────┐ ┌────┐ ┌────────┐ ┌───────────┐
   │ IDEAGRI      │  │ IDEAGRI │ │App │ │Análises│ │ Especiali- │
   │ Desktop      │◄─┤ Web     │ │mob │ │  (BI)  │ │ zados      │
   │ (FONTE DA    │  │ (SaaS   │ │    │ │        │ │ IATF       │
   │  VERDADE,    │  │ leitura │ │    │ │        │ │ Techmilk   │
   │  Windows)    │  │  + bench)│ │    │ │        │ │ IILB       │
   └──────┬───────┘  └─────────┘ └─┬──┘ └────────┘ └───────────┘
          │                        │
          │ upload de backup       │ "Receber Coletas"
          ▼                        ▼
   ┌────────────────────────────────────────────────────────────┐
   │ Camada Rumina (mais nova)                                  │
   │ ── Rúmi (IA via WhatsApp: lançar/consultar por voz/texto)  │
   │ ── Rúmina Insights (dashboards real-time, 60+ KPIs)        │
   │ ── OnFarm / RúmiAction / RúmiFlow / RúmiScore (IoT físico) │
   └────────────────────────────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────────┐
   │ Ideagri Play — videoaulas de treinamento (separado)        │
   └────────────────────────────────────────────────────────────┘
```

**Leitura:** o Painel é um *launcher* (mais USP do que produto), o Desktop é o core monolítico, Web/App/Análises são frontends derivados. A camada Rumina é onde o produto está investindo agora (IA + IoT).

---

## 3. Módulos detalhados

### 3.1 IDEAGRI Desktop (core)

Aplicação Windows (8/10/11, Server 2012 R2+) distribuída como instalador `Ideagri500.exe`. Requisitos mínimos: dual-core, 4 GB RAM, 1280×1024.

**Módulos internos visíveis na navegação da central de recursos:**
- **Cadastros** (animais, lotes, propriedades, terceiros)
- **Reprodução** (coberturas, diagnósticos, partos, IATF básica)
- **Sanitário** (aplicações, protocolos, mortalidade)
- **Leite** (controle leiteiro, ordenhas)
- **Financeiro** (lançamentos, plano de contas, fluxo)

**Características técnicas inferidas:**
- Banco local (provavelmente Firebird ou Access — coerente com "backup do banco" sendo upado ao Web).
- Modo single-user e network (servidor de arquivo).
- Customização por **SQL Consultas** — usuários avançados escrevem `.sql` em pastas específicas e o produto vira "report". Sinal de Crystal Reports ou similar embutido.
- **85+ relatórios** prontos (segundo material Rumina Pro).

**Modelo comercial:** licença por instalação + contrato; algumas features condicionadas a perfil.

### 3.2 IDEAGRI Web

URL: `web.ideagri.com.br/ideagriweb/login/Index`. Login por **"chaves"** (um identificador alfanumérico associado à fazenda — não e-mail).

**Função:** *complementar* ao Desktop. Não substitui. Cliente faz **upload de backup do banco** → o web exibe relatórios e dashboards a partir desse snapshot.

**Funcionalidades:**
- Geração de relatórios customizados online.
- **Benchmark contra peers anônimos** (alimenta o IILB).
- Operação multi-fazenda (consolida várias unidades).
- Acesso mobile responsivo a fichas individuais de animais.
- Relatórios "Extract — Dairy Farming" (visão consolidada de 12 meses).

**Implicações:**
- Não é SaaS real — é viewer cloud do desktop. Tempo de defasagem = última vez que o cliente fez backup + upload.
- Modelo natural de migração para um concorrente: oferecer **paridade web + sync automático**, sem cerimônia de backup.

### 3.3 IDEAGRI App (mobile)

Android (Play Store) + iOS (App Store), disponibilidade por perfil de contrato.

**Funcionalidades coletadas em campo:**
- Pesagens (desmama, mensal).
- Controle leiteiro.
- Coberturas / inseminações.
- Diagnósticos de gestação.
- Partos.
- Aplicações de medicamentos.
- Consulta de ficha individual.

**Sync:** unidirecional do app para o desktop via utilitário **"Receber Coletas"** — usuário no escritório executa o import manualmente.

**Implicações:**
- Modelo "field collector" clássico, não realtime.
- Concorrente moderno ganha com sync transparente (WebSocket/queue) e capacidade offline-first com merge automático.

### 3.4 IDEAGRI IATF (módulo especializado, pago à parte)

Inseminação Artificial em Tempo Fixo. Roda em **subdomínio próprio** (`sistema.ideagriiatf.com.br`) — sinal de produto adquirido/integrado separadamente.

**Funcionalidades:**
- Programação de protocolos IATF/TETF.
- Análise de concepção por estímulo e uso de CIDR.
- Planilhas dinâmicas: produtos de implante, ordem, ciclicidade, protocolos de estrogênio.
- Análise por ordem de inseminação dentro de grupos de manejo.
- Relatórios via consultas SQL nomeadas (ex.: `Taxa_de_Concepcao_Estimulo_ECG_e_USO_CIDR_Informado_na_Programacao_IATF_TETF.sql`).

### 3.5 Techmilk

Software para **clientes registrados** — pouca informação pública (sinal de produto B2B com gating). Funcionalidades visíveis:
- Portfólio de relatórios próprios.
- Tutoriais via Ideagri Play.

**Hipótese:** módulo de integração com controles leiteiros oficiais (associação de raça, controle leiteiro de associação) — comum no segmento.

### 3.6 IILB — Índice Ideagri de Lucratividade na Bovinocultura de Leite

**Provável maior moat do produto.** Benchmarking trimestral entre fazendas clientes (anonimizadas) com métricas:

- Eficiência reprodutiva (taxa de concepção em novilhas, taxa de prenhez).
- Sobrevivência (mortalidade de bezerros, sobrevivência de fêmeas até 12 meses).
- Rankings de produtividade.
- Edições trimestrais com case studies de fazendas top.

**Por que é moat:** quanto mais clientes, mais rico o benchmark. Concorrente novo entra com base zero — precisa de outro vetor (UX, preço, integrações) para furar.

### 3.7 Análises (módulo)

Não conseguimos página dedicada (404). Inferência pela posição no portfólio: BI sobre os dados do desktop, provavelmente exportando para Excel/PDF + planilhas dinâmicas.

### 3.8 Painel Ideagri

*Launcher* unificado. Personaliza por usuário (combinação de módulos do contrato). Sinal de que o ecossistema cresceu por acreção e o painel foi a forma de não ter 5 atalhos no desktop do produtor.

### 3.9 Camada Rumina (apostas recentes)

- **Rúmi** — IA via WhatsApp: lançar/consultar registros por voz e texto, alertas diários. **Moderna e diferenciada** — mesmo conceito que estamos pensando para a aba `ia` do Fazendinha.
- **Rúmina Insights** — dashboards real-time com 60+ indicadores; sync com o Pro.
- **OnFarm / RúmiAction / RúmiFlow / RúmiScore** — hardware/software para mastite, saúde, higienização e produtividade. Movimento de "vertical stack" indo para o **chão da fazenda**.

---

## 4. Integrações conhecidas

- **Ordenhadeiras**: DeLaval (DelPro), GEA (DairyPlan), Allflex/MSD (SenseHub).
- **Identificação eletrônica**: brincos eletrônicos, coleiras de monitoramento.
- **Fiscal**: importação de XML de NFe, exportação para razão contábil.
- **WhatsApp**: canal nativo via Rúmi (entrada e saída).

---

## 5. Stack inferida

| Camada | Tecnologia provável | Pista |
|--------|--------------------|----|
| Desktop UI | Delphi ou WinForms | Look-and-feel "wizardish" típico, 20 anos de história, instalador `.exe` |
| Banco local | Firebird ou Access | Backup como artefato transferível por upload |
| Web | ASP.NET (algum sabor) | Hospedagem própria, login por chave, URL `web.ideagri.com.br/ideagriweb/login/Index` |
| Mobile | Híbrido (provável) | Funcionalidades de coleta padrão, sync via export |
| BI/Relatórios | Crystal Reports embutido + planilhas Excel | "SQL Consultas" como padrão de customização |
| IATF web | Stack separada, possivelmente PHP/Laravel | Subdomínio dedicado, aquisição? |
| Rúmi | LLM via API + bot WhatsApp (Twilio/Z-API) | Padrão atual de mercado BR |

Nada disso é confirmado — é leitura de pegadas.

---

## 6. Fazendinha hoje (baseline para comparação)

Conforme `CLAUDE.md`, `client/src/data/rionovo.ts` e `server/prisma/schema.prisma`:

**Escopo atual:**
- **Regime de caixa** explícito: `LIQUIDADO` → Realizado, `ABERTO` → Projeção.
- Domínio modelado: `Lancamento`, `Categoria`+`GrupoCategoria`, `CentroCusto` (Leite/Café/Investimento), `ContaBancaria`, `ClienteFornecedor`, `FechamentoMensal`.
- Anexo de **Nota Fiscal** com OCR/validação (`NotaFiscalArquivo`, `NotaFiscalUploadPendente`, status `PENDENTE/VALIDA/ATENCAO/REJEITADA`).
- Storage R2 com lifecycle (Standard → IA → Glacier IR → Deep Archive).
- 6 abas no frontend: dashboard, gastos, lancar, plano, ia, relatorio.
- Histórico real de 23 meses (Jul/24 → Mai/26) com ~6.700 lançamentos da Fazenda Rio Novo.

**Cobertura comparada a IDEAGRI:**

| Domínio | IDEAGRI | Fazendinha |
|---|---|---|
| Financeiro caixa | ✅ módulo Financeiro do Desktop | ✅ core do produto |
| OCR/NF | parcial (XML NFe) | ✅ com OCR + validação multi-critério (à frente) |
| Plano de contas gerencial | ✅ | ✅ |
| DRE / fluxo de caixa | ✅ relatórios | ✅ dashboard timeline 23m + DRE |
| Centros de custo | ✅ | ✅ |
| Cadastro de rebanho | ✅ | ❌ |
| Reprodução / IATF | ✅ (módulo pago) | ❌ |
| Controle leiteiro | ✅ Techmilk | ❌ |
| Sanitário | ✅ | ❌ |
| App mobile coleta de campo | ✅ | ❌ |
| Benchmark entre fazendas | ✅ IILB (moat) | ❌ |
| Dashboard real-time | ✅ Rúmina Insights | parcial (mock estático) |
| IA via WhatsApp | ✅ Rúmi | ❌ (aba `ia` existe como placeholder) |
| Integração ordenhadeira | ✅ DeLaval/GEA/Allflex | ❌ |
| Multi-fazenda | ✅ | ❌ |

**Resumo:** Fazendinha hoje é um financeiro de caixa enxuto, com vantagem real em **NF/OCR** e em **UX moderna**. O resto do ecossistema IDEAGRI (zootécnico, leiteiro, sanitário, IATF, IoT) não tem contrapartida.

---

## 7. Gaps prioritários e oportunidades de superar

### 7.1 Áreas onde IDEAGRI lidera e teríamos que construir do zero

| Gap | Esforço | Vale a pena? |
|---|---|---|
| Cadastro de rebanho + ficha individual | Médio | **Sim** — base de tudo zootécnico. |
| Controle leiteiro (ordenhas, picos, secagem) | Médio | **Sim** se mirando produtor leiteiro. |
| Sanitário (aplicações, protocolos, mortalidade) | Médio | Sim, mas baixa prioridade vs. financeiro/leite. |
| IATF (protocolos, taxa de concepção) | Alto | Só com parceria veterinária — é nicho. |
| Benchmark anônimo entre fazendas | Baixo tecnicamente, alto em volume | Só faz sentido com escala — é o **moat deles**. Não tentar furar de frente. |
| Integração com ordenhadeiras (DeLaval/GEA/Allflex) | Alto (depende dos vendors) | Decisivo para profissional leiteiro. |

### 7.2 Áreas onde podemos chegar competitivos rápido

| Oportunidade | Por que ganhamos | Próximo passo |
|---|---|---|
| **Cloud-native real** (sem backup-upload) | Stack moderna desde o dia 0 (Hono + Prisma + Neon) | Já implementado — apenas continuar evitando o anti-padrão. |
| **OCR/NF como cidadão de primeira classe** | Schema já modela `NotaFiscalArquivo` com pipeline de validação | Continuar — virar diferencial visível no marketing. |
| **Mobile com paridade real** (não só coletor) | Greenfield, escolher React Native / PWA | Decidir stack antes de modelar rebanho. |
| **Plano de contas pronto para o produtor** | Domínio em PT-BR, sem jargão contábil-fiscal | Curar plano de contas padrão por tipo de fazenda. |
| **WhatsApp IA** análoga ao Rúmi | Stack Claude API já familiar | Especificar fluxos: lançar gasto por foto/áudio, consultar saldo, alerta diário. |
| **Login moderno** (e-mail + Google SSO) | Padrão SaaS atual | Trocar "chaves" por auth real desde já. |
| **Multi-fazenda nativo no schema** | IDEAGRI faz por upload separado | Adicionar `Propriedade` como dimensão antes de virar tech debt. |
| **Onboarding sem treinamento** | UX moderna como meta | Métrica: time-to-first-lancamento < 10 min. |

### 7.3 Pegadinhas vistas no IDEAGRI a evitar

- Subdomínio próprio por módulo (`sistema.ideagriiatf.com.br`) → fragmentação de identidade. **Manter um só domínio + paths.**
- "SQL Consultas" como mecanismo de customização → vaza implementação para usuário. **Preferir filtros/saved-views com schema versionado.**
- Módulos pagos por contrato com gating opaco → frustra. **Plano simples ou freemium honesto.**
- "Receber Coletas" como verbo de produto → expõe arquitetura. **Sync deve ser invisível.**

---

## 8. Recomendações para o próximo passo

1. **Antes de seguir**: pedir ao team leader prints/exports de:
   - Tela inicial do Painel Ideagri (saber o que cabe num primeiro contato).
   - Um relatório de IILB para entender métrica e visualização.
   - Tela de cadastro de animal (campos obrigatórios — define o mínimo do schema zootécnico).
   - Tela de ordenha / controle leiteiro.
   - Tela do app mobile.
   - Lista de tabelas do banco (se conseguir ver via "consultar chaves" ou exporte/backup).

2. **Decisão de produto a tomar com a evidência acima**: posicionar o Fazendinha como
   (a) **financeiro especializado** com OCR/IA — concorrendo com a aba Financeiro do IDEAGRI;
   (b) **gestão completa light** — replicando o escopo IDEAGRI com 1/5 do esforço; ou
   (c) **wrapper inteligente** sobre IDEAGRI (lê o backup do cliente e oferece BI/IA por cima — sem competir, complementando).
   Caminhos muito diferentes, decidir antes de escrever mais código.

3. **Não tentar competir frontalmente com o IILB** sem volume — virar "fail fast". Pensar em alternativas: parceria com cooperativa, benchmark setorial via open data, ou nicho regional.

4. **Próximo deep-dive (v2 deste doc)**: análise comparativa de UI/UX a partir de prints da conta do team leader, foco em fluxos de:
   - Lançamento de gasto rotineiro (quantos cliques?).
   - Geração de relatório de fluxo de caixa.
   - Fechamento mensal.
   - Onboarding de fazenda nova.

---

## 9. Lacunas deste levantamento

Coisas que **não** consegui sem a conta:
- Preço dos módulos.
- Tela real (apenas inferida das descrições da central de recursos).
- Lista completa dos 85+ relatórios — só uns nomes soltos.
- Estrutura de tabelas (modelo de dados real do desktop).
- Detalhes do contrato (o que vem no plano base vs. add-on).
- Detalhes técnicos do Rúmi (LLM provider, fluxo de prompt).
- Documentação da API (se existe alguma).

Tudo isso entra na v2 se você passar acesso/material.

---

## 10. Fontes

- [Central de Recursos IDEAGRI](https://centralderecursos.ideagri.com.br/)
- [Página IDEAGRI no portal Rumina](http://rumina.com.br/ideagri-pro/)
- Posts módulo a módulo da central de recursos (`/posts/ideagri-app`, `/posts/ideagri-iatf`, `/posts/ideagri-desktop`, `/posts/ideagri-web`, `/posts/painel-ideagri`, `/posts/iilb`, `/posts/techmilk`).
- Estado atual do Fazendinha: `client/src/data/rionovo.ts`, `server/prisma/schema.prisma`, `CLAUDE.md`.
