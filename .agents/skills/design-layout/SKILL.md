---
name: design-layout
description: Use ao montar ou ajustar telas, grids, espaçamento e responsividade no Reouvir EN. Mobile-first, safe areas, hierarquia por proximidade e ritmo.
---

# Layout e responsividade

Ordem de raciocínio: prioridade do conteúdo → agrupamento → ritmo → adaptação por tamanho.

## Contexto do produto

- **web (aluno):** coluna única, estreita (hoje `max-width: 480px`), uso com uma mão, no celular. É o caso principal.
- **admin:** desktop primeiro, mas precisa funcionar em tablet e celular (barra lateral vira linha abaixo de 760px).

## Estrutura

1. **Mobile-first.** CSS base é o celular. Camadas maiores entram com `min-width`.
2. **Pontos de quebra pelo conteúdo**, não por aparelho. Três bastam: 640, 768 e 1024px. Use `clamp()`, `minmax()` e `auto-fit` para evitar quebras.
3. **Grid e flex** para reorganizar. Sem larguras fixas em px que estouram em 320px.
4. **Container queries** quando o mesmo componente aparece em contextos de largura diferente.
5. **Sem rolagem horizontal** em nenhum tamanho, nem com texto ampliado a 200%.

## Telas de celular

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Respeite áreas seguras: `padding-bottom: max(16px, env(safe-area-inset-bottom))` em barras fixas e no player.
- Use `100dvh`, não `100vh` (a barra do navegador móvel muda de altura).
- Controles primários na metade de baixo da tela (zona do polegar). Ações destrutivas longe dela.
- Teclado virtual aberto não pode cobrir o campo focado nem o botão de enviar.
- Considere paisagem. O player deve continuar usável.

## Hierarquia e espaço

- **Teste de apertar os olhos:** com a tela desfocada, ainda se distingue o elemento principal, o secundário e os grupos?
- **Proximidade antes de caixa.** Itens relacionados ficam juntos; grupos distintos se separam com espaço, não com mais bordas.
- **Ritmo:** alterne espaços apertados e generosos. Mais espaço acima de um título do que abaixo.
- Escala de espaço do `design-tokens` (base 4). Sem valores avulsos.
- `gap` entre irmãos em vez de margens nos filhos.
- Cartão dentro de cartão é sempre errado. Não use cartões iguais como estrutura de página por reflexo.
- Ordem do DOM = ordem visual = ordem do foco.

## Evitar

- `display: none` para esconder funcionalidade no celular. Se importa, faz funcionar.
- Hover como único meio de acessar algo. Use `@media (hover: hover)` para realces.
- Mudar a arquitetura de informação entre tamanhos de tela.

## Verificação

Abra em 360, 390, 768 e 1280px, nos dois temas. Veja `design-visual-qa`.
