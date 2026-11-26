# Convenções de apresentação matemática e gráficos

Padrão definido em 26/11/2026 para desenvolvimento e revisão dos aplicativos EEVL.
Complementa [ARCHITECTURE.md](../ARCHITECTURE.md) e [I18N.md](I18N.md).
Este documento define o comportamento esperado; não afirma que todos os aplicativos
existentes já foram adaptados.

## Equações e variáveis em LaTeX

Toda equação, expressão ou variável matemática apresentada ao usuário deve ser
renderizada a partir de LaTeX, inclusive em textos explicativos, resultados,
botões, menus, opções, rótulos de campos, diagramas, legendas, eixos e miniaturas.
O mesmo símbolo deve manter a mesma notação em toda a interface: por exemplo,
`V_S`, `V_R`, `I_R`, `Z_e` e `Y_e/2` são fontes LaTeX, não texto a exibir literalmente.

- Usar o KaTeX local já disponível, com MathML acessível, `trust: false` e sem
  interpretação de HTML ou comandos fornecidos pelo usuário.
- Usar matemática inline em frases e controles; reservar o modo de destaque
  para equações que necessitem de uma linha própria. Evitar cortes de índices,
  raízes e frações; permitir rolagem por teclado em expressões longas.
- Manter variáveis, índices e unidades independentes do idioma. Traduzir a frase
  ao redor da expressão. Apresentar unidades em estilo romano, como
  `\mathrm{kV}`, e respeitar a convenção científica de cada símbolo.
- Formatar valores para apresentação com Intl e inserir os números na expressão
  com escape apropriado; o modelo continua recebendo números, nunca texto
  localizado reinterpretado.
- Não substituir LaTeX por identificadores com underscore, subscritos Unicode
  aproximados ou formatação manual apenas parecida com matemática.
- Controles nativos cujas opções não aceitam renderização matemática devem usar
  alternativas acessíveis: preferir rádios para poucas opções; menus mais extensos
  precisam preservar foco, seleção, teclado e nomes acessíveis. Não inserir LaTeX
  cru em um `<option>`.
- Gráficos, canvas e SVG devem usar uma camada matemática compatível com a
  renderização/exportação. Imagens estáticas e miniaturas podem usar matemática
  pré-renderizada a partir da mesma fonte LaTeX, sem dependência de rede.
- O conteúdo editável e os formatos de código/dados mantêm sua sintaxe própria:
  não renderizar nem alterar expressões enquanto o usuário as edita em um campo
  de código ou em um campo numérico.

## Escala Y estável nos gráficos atualizados continuamente

Gráficos de tempo real e gráficos recalculados continuamente por animação ou por
interação com controles devem manter os limites Y fixos durante a exploração.
A amplitude de uma curva deve mudar visualmente quando o valor físico mudar;
a escala não pode acompanhar automaticamente essa mudança.

O padrão é a faixa fixa. A exceção de execução contínua com faixa acumulada,
escolhida explicitamente para o Buck PID, está definida abaixo; ela não autoriza
recalcular limites a partir da janela móvel dos demais gráficos.

### Definição inicial

Cada modelo ou experimento define previamente a faixa de Y com base em valores
nominais, condições iniciais, referências e transitórios esperados. Adotar uma
margem inicial de 10% em cada extremo do envelope esperado, salvo justificativa
documentada do modelo. Uma faixa constante precisa de amplitude mínima não nula,
definida nas unidades físicas do problema, evitando divisão por zero.

Incluir zero quando fizer sentido físico; usar faixa simétrica para grandezas
bipolares quando isso facilitar a leitura. Declarar unidades, normalizações e
escala linear/logarítmica. Não juntar grandezas de unidades diferentes no mesmo
eixo sem identificação e conversão explícitas.

Se não houver envelope previsível, a faixa pode ser obtida de uma execução
completa de referência antes de começar a animação. Não usar o primeiro quadro,
que pode conter apenas zeros, nem recalcular a faixa quadro a quadro.

### Durante a exploração

- Manter a mesma faixa ao executar, pausar, continuar, repetir, restaurar o estado
  da mesma experiência e alterar parâmetros interativamente.
- Não recalcular Y a cada amostra, quadro, atualização de parâmetros, troca de
  idioma, redimensionamento de tela ou ocultação de uma curva.
- Ao escolher explicitamente outro experimento, modelo, grandeza ou unidade,
  aplicar a faixa documentada correspondente antes de desenhar o novo resultado.
  Não reutilizar limites de tensão para corrente, por exemplo.
- Se uma curva ultrapassar a faixa, manter os dados e os limites, recortar apenas
  a representação e sinalizar que há valores fora da área visível. Não saturar
  os dados nem expandir silenciosamente o eixo.
- Oferecer **Ajustar escala** quando necessário: uma ação pontual que usa os dados
  finitos disponíveis e a margem definida, e depois congela os novos limites.
  Não é um modo automático permanente. Para dados ainda não recebidos, continua
  valendo a indicação de valores fora da faixa.
- Quando pertinente, oferecer limites mínimo/máximo manuais e **Restaurar escala**
  para retornar à faixa de referência. Esses controles ficam junto ao gráfico.
- Alterações de escala afetam apenas a visualização, nunca a simulação ou os
  parâmetros físicos. Resultados, tabelas e exportações preservam os valores reais.

Gráficos estáticos de resultados completos podem usar enquadramento automático
inicial. Isso não autoriza reenquadrar continuamente uma comparação interativa.
O comportamento do eixo X depende do experimento e não é alterado por esta regra.

### Execução contínua: faixa acumulada do Buck PID

No Buck PID, acumular os mínimos e máximos dos sinais observados desde o início
da execução. O limite inferior só pode diminuir e o superior só pode aumentar:
novos extremos expandem a faixa; a saída de um extremo da janela móvel não a reduz.
É uma política de visualização explícita, distinta de autoescala da janela atual.

Tensão e corrente têm acumuladores separados, nas respectivas unidades. A tensão
inclui a referência de controle. A razão cíclica conserva sua faixa fixa de
−0,05 a 1,05. A implementação observa os pontos Float32 já armazenados para o
gráfico após cada período, antes que a janela circular possa descartá-los; não
altera amostragem, PID ou integração. Extremos entre pontos não armazenados não
são apresentados como medições do gráfico.

Manter a margem original de 12% do Buck e amplitude não nula para sinal constante,
preservando também os limites já expandidos pela margem. Pausa/continuação, mudança
de janela, frequência, idioma e tamanho de tela conservam os acumuladores. Reiniciar
explicitamente ou a reinicialização automática já existente por estado inválido
começa uma nova execução e limpa os acumuladores. Valores não finitos não entram
na faixa. A regra fixa de RC/RL/RLC continua válida.

## Critérios de revisão

Conferir notação matemática e acessibilidade em todos os idiomas, temas, controles,
diagramas e tamanhos de tela. Para os gráficos, verificar que alterações de
parâmetros e atualizações de dados preservam Y, que valores fora da faixa são
indicados e que apenas ações explícitas ou mudanças de experimento/grandeza
aplicam outra faixa. A adequação dos aplicativos existentes deve ser registrada
conforme for executada; esta definição não é uma migração automática.

## Adoção registrada

RC/RL e RLC (interface 1.1.0) aplicam o padrão em seus componentes compartilhados:
variáveis, métricas, legendas, esquemas e expressões na prosa são renderizados por
KaTeX local, com números formatados por Intl. Os menus de excitação usam descrições
sem variáveis. Os eixos exportados usam nomes de grandezas e unidades, sem símbolos
de variáveis que precisem de uma segunda renderização matemática.

As faixas Y nominais abaixo usam os experimentos padrão completos, incluindo todas
as curvas, e margem de aproximadamente 10%, arredondada para fora. O RL inclui seu
valor assintótico de 50 mA. Valores fora da faixa são sinalizados, sem alterar os dados.

| Topologia | Tensão (V) | Corrente (mA) |
|---|---|---|
| RC | −0,5 a 5,5 | −0,5 a 5,5 |
| RL | −0,5 a 5,5 | −5 a 55 |
| RLC série | −4,957 a 9,883 | −38,911 a 50,588 |
| RLC paralelo | −1,048 a 2,036 | −17,534 a 40,985 |

Recalcular, alterar parâmetros, idiomas, curvas ou restaurar os parâmetros conserva
a faixa escolhida. Mudar de topologia carrega sua faixa nominal. Ajustar/restaurar
escala age somente no gráfico correspondente. Os demais aplicativos ainda precisam
de revisão específica; o registro acima não declara sua adequação.
