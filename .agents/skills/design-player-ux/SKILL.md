---
name: design-player-ux
description: Use ao mexer no player e nas telas do aluno em apps/web do Reouvir EN. Uso mãos livres (corrida, spinning), alvos grandes, legibilidade em movimento, estados offline e de download.
---

# UX do player (mãos livres)

O app é um player de música para treinar escuta. O aluno corre, pedala, às vezes olha de relance. A tela é secundária; o áudio é o produto.

## Princípios

1. **Olhar de relance.** A frase atual e o estado (tocando, silêncio, pausado) são lidos a 40–60 cm, em movimento. Texto grande, alto contraste, pouco por tela.
2. **Controles que se acertam sem mirar.** Play/pausa grande (≥ 72px, como hoje), anterior/próxima ≥ 54px, com espaço entre eles. Ações raras ficam longe das frequentes.
3. **Uma mão, polegar.** Controles na metade de baixo, respeitando `safe-area-inset-bottom`. Nada importante junto à borda superior.
4. **Sem gestos escondidos.** Deslizar e segurar podem existir como atalho, nunca como único caminho.
5. **Tela bloqueada é o uso normal.** Media Session API com título, contexto/nível/tópico e controles; a interface não pode ser a única forma de pausar. (Comportamento real depende de teste manual em iPhone e Android; ver a fase 2 no `AGENTS.md`.)
6. **Silêncio não é falha.** A regra é fixa: `duração ÷ velocidade + 1,5 s`. A tela mostra que é um silêncio de resposta, com tempo restante, para o aluno não achar que travou. Cor mais texto ("Sua vez"), nunca só cor.
7. **Confiança no offline.** Mostrar claramente: baixado ✓, baixando N%, falhou (com ação "Tentar de novo"), sem rede (e o que ainda funciona). Baixar não pode exigir manter a tela aberta sem avisar.
8. **Retomar de onde parou.** Abrir o app oferece continuar a última playlist em uma ação.

## Hierarquia da tela do player (de cima para baixo)

1. Contexto · nível · tópico (pequeno, `meta`)
2. **Frase atual** (`display`, ao centro, quebra balanceada) e, logo abaixo, a **tradução** em português (`title`, cor `--text-muted`, opcional; reserva altura para o layout não pular)
3. Estado: tocando / silêncio / pausado, mais repetição (ex.: "2 de 2")
4. Progresso da playlist
5. Controles (play, anterior, próxima)
6. Configurações rápidas: repetições, velocidade (0,75x/1x), loop, tradução, tela ligada
7. Lista de frases (secundária, recolhida)

## Navegação do aluno

Contexto → nível → tópico → playlist. Mostre sempre onde está e permita voltar um passo. A ordem dos tópicos é a do currículo.

## Contexto de uso adverso

- Sol: contraste alto, evitar cinzas claros; tema escuro como opção real (à noite, na esteira).
- Suor/luva: alvos grandes e sem exigir precisão.
- Fones: volume e pausa não dependem da tela.
- Bateria: sem animação contínua, sem manter a tela acesa à força: "Manter a tela ligada" é uma opção do aluno, desligada por padrão.

## Evitar

Excesso de opções no player, confirmação em modal para ações reversíveis, rolagem longa antes de chegar ao play, textos pequenos em tela de estado.

## Verificação

Em um celular real, de pé, braço estendido e tela com brilho médio, é possível ler a frase e pausar sem olhar? Veja também `design-visual-qa`.
