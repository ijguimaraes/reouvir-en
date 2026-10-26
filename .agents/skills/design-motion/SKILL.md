---
name: design-motion
description: Use ao adicionar transição, animação ou feedback de toque no Reouvir EN. Movimento só para explicar estado, com durações curtas, desempenho e prefers-reduced-motion.
---

# Movimento e microinterações

É um app de uso. Movimento explica o que mudou ou confirma uma ação. Decoração não entra.

## Regras

1. **Só para estado.** Aceitável: feedback de toque, abrir/fechar painel, item atual do player mudando, progresso de download. Não: entrada animada em cada seção, hover que levanta todo cartão, carregamento coreografado.
2. **Duração** (tokens de `design-tokens`):
   - 100–150 ms: feedback imediato (pressionar botão)
   - 150–250 ms: mudança de estado de rotina
   - 250–400 ms: painel, folha inferior, troca de tela
   Saída mais rápida que entrada. Feedback longo parece lentidão.
3. **Curva:** desaceleração, `var(--ease-out)`. Sem bounce ou elástico por reflexo.
4. **Propriedades baratas:** `transform` e `opacity`. Não anime `width`, `height`, `top`, `left`, margens. Para expandir, use `grid-template-rows: 0fr → 1fr` ou FLIP.
5. **Conteúdo visível por padrão.** Se o script falhar, nada fica escondido por uma animação que não rodou.
6. `will-change` só durante a animação, nunca fixo.
7. Nada em laço fora da tela ou com a aba oculta. Sem autoplay de som.

## Reduzir movimento

```css
@media (prefers-reduced-motion: reduce) {
  /* troque deslocamento/escala por fade ou mudança de cor */
}
```

Não desligue tudo. Confirmações (cor, opacidade, texto) continuam, só sem movimento espacial.

## No player

- A troca da frase atual: fade curto (≤ 200 ms). Sem deslizar texto.
- Durante o silêncio entre audições, uma barra de tempo que avança de forma linear é informação, não decoração.
- Tela bloqueada ou aba em segundo plano: nenhuma lógica de áudio pode depender de animação (`requestAnimationFrame` é pausado). Tempo vem do relógio, não do quadro.

## Um momento de autoria (opcional)

Se houver um, que seja o ato de dar play ou o fim de uma volta da playlist. Um só, discreto.

## Verificação

- Interromper no meio (tocar de novo, trocar de tela) não deixa estado preso.
- Com movimento reduzido ativado no sistema, a tela continua clara.
- Em um celular simples, sem quedas visíveis de quadros.
