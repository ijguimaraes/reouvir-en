---
name: design-accessibility
description: Use em toda UI nova ou alterada do Reouvir EN. Contraste WCAG AA, foco visível, alvos de toque, semântica, ARIA, movimento reduzido e leitores de tela.
---

# Acessibilidade

Meta: WCAG 2.2 AA nos dois apps. Vale mais ainda aqui: o aluno usa o app em movimento, com suor, sol e fones.

## Checklist

**Contraste**
- Texto normal ≥ 4,5:1; texto grande (≥ 24px, ou ≥ 18,66px em negrito) e ícones/bordas de controle ≥ 3:1.
- Meça nos dois temas. `--text-muted` e as cores de estado são as que mais falham.

**Foco e teclado**
- Todo controle alcançável por Tab, na ordem visual. Sem armadilha de teclado.
- `:focus-visible` com anel de alto contraste (ver `design-components`).
- Atalhos de teclado do player (espaço, setas) não podem disparar enquanto se digita em um campo.

**Alvos de toque**
- Mínimo 44×44px para controles do aluno (WCAG exige 24×24px como piso; adote o maior). Espaço entre alvos vizinhos.
- Ícone pequeno com área de toque maior via `padding`.

**Semântica**
- `<button>` para ação, `<a>` para navegação, nunca `div` clicável.
- Marcos (`header`, `nav`, `main`), títulos em ordem (`h1` → `h2`), uma `h1` por tela.
- Campos com `<label>`; erros ligados por `aria-describedby`; `aria-invalid` nos inválidos.
- Listas como `ul/ol`. A lista de frases do player é `ol`; a atual leva `aria-current="true"`.

**ARIA, só quando o HTML não basta**
- Ícone sem texto: `aria-label` em português.
- Mudança de estado importante (baixando, erro, silêncio) em região `aria-live="polite"`.
- Barra de progresso com `role="progressbar"` e `aria-valuenow`.
- Alternância de tema como `button` com `aria-pressed` ou rótulo que diz o estado.

**Movimento**
- `@media (prefers-reduced-motion: reduce)` reduz movimento espacial, mantém mudanças de cor/opacidade que confirmam ação. Não zere tudo com `0.01ms`.

**Cor e texto**
- Cor nunca é o único sinal. Zoom a 200% sem perder conteúdo. Sem `maximum-scale` no viewport.
- `lang="pt-BR"` no `<html>`. Trechos em inglês (as frases) levam `lang="en"`, para o leitor de tela pronunciar certo.

## Específico do player

- Mídia: a Media Session API expõe título, playlist e controles na tela de bloqueio e em fones. É acessibilidade, não detalhe.
- Texto da frase atual visível e de tamanho grande; não depender de ouvir para saber o estado.

## Verificação

1. Percorrer cada tela só com teclado.
2. Rodar uma ferramenta automática (axe ou Lighthouse) e tratar os achados; ela cobre só parte do que importa.
3. Testar um leitor de tela (VoiceOver no iPhone, TalkBack no Android) no fluxo entrar → escolher playlist → tocar.
