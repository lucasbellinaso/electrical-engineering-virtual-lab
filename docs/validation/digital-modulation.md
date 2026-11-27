# Verificação de Modulação Digital M-ária e Canal AWGN · v1.0.0

Modelo, equações, hipóteses, unidades, faixas e limitações:
[DIGITAL-MODULATION.md](../DIGITAL-MODULATION.md). Critérios gerais:
[VALIDATION.md](../VALIDATION.md). Casos reproduzíveis:
[digital-modulation.test.mjs](../../tests/digital-modulation.test.mjs).

## Escopo da evidência

Verificação analítica e consistência estatística do modelo em banda base equivalente com canal AWGN sem memória. Inclui conferência de `erfc`/`Q` por quadratura numérica independente, identidades fechadas de energia e distância mínima, adjacência Gray, equivalência da integral de Craig para $M \in \{2, 4\}$ com as fórmulas fechadas de BPSK/QPSK, conferência da fórmula de Cho–Yoon contra integração analítica célula a célula de regiões retangulares, consistência estatística de Monte Carlo (com e sem erro de fase) e paridade de traduções e KaTeX. Não constitui validação experimental com hardware de RF nem comparação contra simulador comercial externo.

Base de desenvolvimento: commit `2167d2f`; nova implementação v1.0.0, 27/11/2026.
Ambiente de execução: Windows, Node.js >= 22, IEEE-754 double.
Execução: `node --test tests/digital-modulation.test.mjs`; suíte completa: `npm.cmd test`.

## Casos e tolerâncias

| Caso | Critério |
|---|---|
| Função `erfc` e `Q` | Valores de referência em $x \in \{0, 0{,}5, 1, 2, 3, 4, 5\}$ (erro relativo $< 10^{-14}$), simetria $\operatorname{erfc}(x) + \operatorname{erfc}(-x) = 2$ e quadratura numérica de $Q(z)$ por regra de Simpson ($< 10^{-11}$). |
| Normalização e geometria | $\frac{1}{M}\sum |s_m|^2 = 1$ para as cinco modulações (erro $< 10^{-14}$), $d_{\min}$ exato contra busca por pares de pontos ($< 10^{-14}$) e $\sum s_m = 0$ por simetria. |
| Adjacência Gray | Todos os pares de vizinhos à distância $d_{\min}$ têm distância de Hamming igual a $1$ em BPSK, QPSK, 8-PSK, 16-QAM e 64-QAM. |
| BPSK e QPSK | $P_{b,\text{BPSK}} = P_{b,\text{QPSK}}$ em toda a grade $E_b/N_0 \in [0, 24]\;\mathrm{dB}$ (erro $< 10^{-15}$) e $P_{s,\text{QPSK}} = 2P_b - P_b^2$. |
| Integral de Craig ($M=2,4$) | Integral numérica de Craig (512 subintervalos) reproduz as fórmulas fechadas de $P_s$ de BPSK e QPSK com erro absoluto $< 10^{-11}$. |
| Cho–Yoon vs. soma retangular | Fórmula fechada de Cho–Yoon para QPSK, 16-QAM e 64-QAM coincide com o somatório direto das probabilidades retangulares sobre os $M^2$ pares $(s_m, \hat{s}_n)$ (erro relativo $< 10^{-12}$). |
| Erro de fase $\Delta\phi$ | `impairedTheoreticalErrorRates` com $\Delta\phi = 0$ coincide com `theoreticalErrorRates` ($< 10^{-15}$); em BPSK com $\Delta\phi \neq 0$, coincide com $Q(\sqrt{2E_b/N_0}\cos\Delta\phi)$ ($< 10^{-14}$). |
| Consistência Monte Carlo | Com $20\,000$ símbolos, $E_s$ amostral $= 1$ ($< 10^{-13}$ em PSK; $< 0{,}025$ em QAM), $N_0$ medido dentro de $3\%$ do nominal e taxas observadas dentro de $4{,}5$ desvios padrão binomiais da teoria (incluindo $\Delta\phi = 8^\circ$ em 16-QAM/64-QAM e 8-PSK). |
| Entradas inválidas e imutabilidade | Rejeição por `RangeError` (`invalid`) para modulação desconhecida, `NaN`, `Infinity`, strings, não-inteiros em `symbolCount`/`seed` e valores fora dos limites; entrada nunca é mutada. |
| Idiomas e equações KaTeX | Paridade exata de chaves e placeholders em `pt-BR`/`en`/`es`, uso de todas as chaves e renderização de todas as equações em `equations.js` com `throwOnError: true`. |

## English

Analytical and statistical verification covers Cody's `erfc`/`Q` against independent quadrature, unit average constellation energy and minimum-distance checks, nearest-neighbor Gray adjacency, equivalence between Craig's integral and BPSK/QPSK closed forms, Cho–Yoon exact QAM BER against direct $M^2$ rectangular cell summation, carrier phase offset analytical models, Monte Carlo binomial consistency bounds, invalid-input rejection and complete trilingual i18n/KaTeX checks. No RF hardware measurements or external commercial simulator runs are claimed.
