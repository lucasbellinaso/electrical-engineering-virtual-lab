# Verificação da LT como quadripolo · v1.0.0

Modelo, equações, hipóteses, sinais, unidades, faixas e limitações:
[TRANSMISSION-LINE.md](../TRANSMISSION-LINE.md). Critérios gerais:
[VALIDATION.md](../VALIDATION.md). Casos reproduzíveis:
[transmission-line.test.mjs](../../tests/transmission-line.test.mjs).

## Escopo da evidência

Verificação analítica e de identidades do modelo em regime permanente, por fase RMS.
Não constitui validação experimental, comparação com dados de campo, nem certificação
de um projeto de linha. O exemplo da aula é uma checagem com valores arredondados,
não uma ferramenta numérica independente. Não se transfere a validação de outros aplicativos.

Base de desenvolvimento: commit `64b51fd`; nova implementação v1.0.0, 26/11/2026.
Ambiente de execução dos testes: Windows, Node.js v26.13.1, IEEE-754 double.
Execução: `node --test tests/transmission-line.test.mjs`; suíte completa: `npm.cmd test`.
Não são necessárias dependências de execução além do navegador.

## Casos e tolerâncias

| Caso | Critério |
|---|---|
| Exemplo da aula | Z_c ≈ 237,59 − j10,029 Ω; γ ≈ 53,8753×10⁻⁶ + j1,2763×10⁻³ /km; I_R ≈ 692,82∠−25,84° A; V_S,LL ≈ 522,419 kV; I_S ≈ 640,763∠31,70° A. Tolerâncias conforme precisão dos slides: 0,01 Ω, 10⁻⁷ /km em β, 0,02 kV e 0,05 A. |
| Comprimento zero | T = identidade, V_S = V_R, I_S = I_R, π com ramos nulos; perdas absolutas < 10⁻⁶ W. |
| Comprimento muito pequeno | B/ℓ → z′, C/ℓ → y′ e 2Y_shunt/ℓ → y′ em ℓ = 10⁻⁷ km; tolerâncias 10⁻¹² para z′ e 10⁻¹⁶ para y′. |
| Linha sem perdas | γ = jω√(L′C′), Z_c = √(L′/C′); ABCD comparado com seno/cosseno reais, erro absoluto < 10⁻⁹; perdas < 10⁻⁶ W. |
| Carga casada sem perdas | |S| = V_LL²/Z_c, FP = 1; magnitude uniforme de V(x), erro absoluto < 10⁻⁸ V. |
| Ferranti sem perdas | V_R = V_S/cos(βℓ), I_R = 0; erro absoluto < 10⁻⁸ V e potência na carga nula. |
| π equivalente e cascata | Produto shunt-série-shunt e produto de dois trechos de ℓ/2 recuperam T(ℓ); erro absoluto complexo < 10⁻¹⁰ por elemento. |
| Reciprocidade | |AD − BC − 1| < 2×10⁻¹⁴ nos quatro presets. |
| Condições nos extremos | Perfis recuperam V_S/I_S e V_R/I_R; erros absolutos < 10⁻⁸ V e 10⁻⁹ A. |
| Equações diferenciais | Diferenças centrais no meio da linha: resíduos < 0,001 V/km e 10⁻⁵ A/km nos presets. A discretização é apenas uma checagem da solução analítica. |
| Energia ativa | Integral de 3R′|I|² comparada com P_S−P_R; erro relativo < 2×10⁻⁵ em 401 pontos nos presets com perdas. |
| Sinais e linearidade | Q indutivo positivo/capacitivo negativo; dobrar V_R e quadruplicar S_R dobra todos os fasores, erro absoluto < 10⁻⁸. |
| Aproximação π nominal | Reduzir ℓ de 20 para 10 km reduz o erro de tensão por fator entre 7 e 9 no caso de carga do exemplo. |
| Singularidades | Rejeição em A ≈ 0 exato e nominal, e π indisponível em meia onda; usa R′ = 0, L′ = 5 mH/km e C′ = 50 nF/km para alcançar os casos dentro das faixas. |
| Entradas e extremos | Cada limite, NaN, infinito, string, modo/carga inválidos e potência não nula em vazio são rejeitados; extremos declarados produzem fasores finitos. Não é garantia de precisão uniforme em todo o domínio. |
| Idiomas e equações | Paridade EN/PT-BR/ES, placeholders, chaves usadas e renderização local de todas as deduções em KaTeX/MathML. |

O teste da PWA inclui cache sob demanda do aplicativo, dicionário e núcleo matemático
em subdiretório. Não se inclui o laboratório inteiro no precache do shell.

## Execução e interface verificadas

Em 26/11/2026, `npm.cmd test` completou com 787 testes: 786 passaram,
nenhuma falha e um teste preexistente pulado (`core-d2c`, referência SISO sem
`ss2tf` MIMO). Os dez testes específicos de LT passaram. A checagem estrutural
confirmou 13 entradas no catálogo, sintaxe, traduções e links locais.

No Microsoft Edge 158.0.4370.45 em modo headless, foram exercitados os quatro
presets, mudança PT-BR/EN/ES preservando entradas, seleção de contribuições,
alternância quadripolo/π, sonda, tabela disponível, entrada inválida, comprimento
zero, tema escuro, viewport de 390 px e navegação por teclado na sonda e no
diagrama com rolagem. As fórmulas foram renderizadas e inspecionadas em capturas.
O laboratório foi servido em `/EEVL/` e recarregado offline após a primeira visita,
inclusive executando novamente o exemplo Ferranti. Sem erros de página ou HTTP.

Não foram executados testes com toque em aparelho físico, leitor de tela,
outros navegadores, medições ou comparação com simulador externo. O uso de uma
viewport pequena não equivale a um teste em dispositivo móvel real.

English: analytical verification covers lossless closed forms, matching, Ferranti,
zero length, exact π/cascade identities, spatial residuals and active-energy balance.
No independent simulator or experimental validation is claimed.

Español: la verificación analítica cubre soluciones sin pérdidas, adaptación,
Ferranti, longitud cero, equivalencia π/cascada, residuos espaciales y balance de
energía activa. No se afirma validación experimental ni con simulador independiente.
