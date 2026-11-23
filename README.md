# Chess Analyzer

Página web gratuita, visual e sem necessidade de servidor para analisar partidas de xadrez após o jogo — com motor **Stockfish** rodando direto no navegador, explicações diretas com IA (**Google Gemini** ou **Groq**) e **chat interativo sobre a posição atual**.

---

## Funcionalidades

- **Importação de partidas:**
  - Busca automática pela API pública do **Chess.com** (abre a última partida com o tabuleiro virado para a sua cor e lista as últimas 20 para trocar com 1 clique).
  - Colagem de texto **PGN** ou carregamento imediato da **partida de exemplo**.
- **Tabuleiro interativo e avaliação:**
  - Navegação completa pelos lances (botões e teclas `←`, `→`, `Home`, `End`, `F` para girar o tabuleiro).
  - Barra de avaliação vertical em tempo real.
- **Análise automática com Stockfish no navegador:**
  - Inicia no modo rápido (profundidade 10) e permite refazer no modo profundo (profundidade 15).
  - Lista os **Momentos Críticos** (`Capivara`, `Erro`, `Imprecisão`) e desenha setas coloridas no tabuleiro (vermelha para o lance errado jogado e verde para o melhor lance).
- **Explicações com IA e Chat sobre a Posição:**
  - Explicação direta e objetiva nos momentos críticos (com botão para recolher/expandir).
  - **Chat sobre a Posição:** calcula primeiro no Stockfish (`MultiPV` com os melhores lances e avaliação automática de lances alternativos citados na pergunta em notação em português ou inglês, como `Cf6`, `Bb5`, `roque curto`) antes de enviar para a IA, com setas azuis clicáveis no tabuleiro e reset automático ao trocar de lance.
  - Privacidade total: suas chaves da API ficam salvas apenas no navegador (`localStorage`).

---

## Como usar localmente no Windows

> **Importante:** Não dê duplo clique direto no `index.html` (`file://`), porque os navegadores bloqueiam Web Workers do Stockfish nesse modo.

1. Dê um duplo clique em `abrir-site.bat` na pasta do projeto.
2. Ele inicia um servidor local (via Python ou Node.js) e abre `http://localhost:8000` automaticamente.
3. Clique em **Carregar partida de exemplo** ou digite um usuário do Chess.com.

---

## Como ativar as explicações com IA

Clique em **Configurar IA** ou **Tutorial API IAs** no topo do site:

- **Google Gemini (padrão `gemini-3.5-flash-lite`):** gere sua chave gratuita em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- **Groq (padrão `qwen/qwen3.8-27b`):** gere sua chave gratuita em [console.groq.com/keys](https://console.groq.com/keys).
