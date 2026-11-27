# Transformada discreta de Fourier: espectro, ruído e filtragem

Aplicativo em `simulators/signal-processing/dft-spectrum/`, baseado nos Exemplos 1 a 4 da aula
[4. Transformada discreta de Fourier](https://github.com/tiagoburiol/MatComp_IV/blob/main/04_transformada_discreta_de_fourier.ipynb)
da disciplina Matemática Computacional IV (T. M. Buriol). Interface em PT-BR, EN e ES (`locales.json`).

A página apresenta, de forma resumida, as equações principais (TDF, amplitude de um lado com fase e
reconstrução), as hipóteses e as limitações; este arquivo traz os detalhes.

## Modelo e convenções

- Sinal sintético: até quatro componentes `A_i sin(2π f_i t + φ_i)`, com `φ_i` em graus, mais ruído
  gaussiano branco de desvio-padrão `σ`. A semente torna o experimento reprodutível
  (`assets/js/core/random.js`, Mulberry32 + Box–Muller); a sequência não é igual à do NumPy.
- Amostragem: `t_n = nT/N`, `n = 0 … N−1`, sem o instante final (`numpy.linspace(0, T, N, endpoint=False)`).
  `f_s = N/T`, resolução `Δf = 1/T`, bin `k` em `f_k = k/T`.
- TDF: `F_k = Σ x_n e^{−i2πkn/N}`, sem normalização na direta; a inversa divide por `N` (como NumPy).
- Amplitude de um lado: `A_0 = |F_0|/N`, `A_k = 2|F_k|/N` para `0 < k < N/2`, `A_{N/2} = |F_{N/2}|/N`.
  A vista completa espelha as amplitudes de um lado nos bins `N-k`, mantendo a correção de DC e Nyquist;
  assim a linha de limiar corresponde à amplitude usada pelo filtro em todos os bins.
- Fase: `arg F_k = atan2(Im F_k, Re F_k)`, fase do cosseno `A_k cos(2π f_k t + arg F_k)`. Para uma componente seno
  com `f T` inteiro, `arg F_k = φ − π/2`. A fase é zerada quando `|F_k| ≤ 10⁻⁹ max|F|`.
- Filtragem: mantêm-se os bins `0 ≤ k ≤ N/2` com `A_k ≥ A_min` e seus espelhos `N − k`; os demais são zerados e o
  sinal é reconstruído pela inversa (parte real). O resultado equivale à soma dos cossenos mantidos, mostrada como
  curva contínua quando há no máximo 64 componentes.
- Erro eficaz `ε_rms` entre a reconstrução e o sinal sem ruído, somente no modo sintético.

## Recursos

- Experimentos pré-configurados: Exemplos 1 a 4 da aula, vazamento espectral (`f T` não inteiro) e aliasing
  (`f > f_s/2`). Nos Exemplos 2 a 4 a aula usa ruído sem semente; os valores numéricos diferem a cada execução,
  mas as componentes detectadas coincidem. Os Exemplos 2 a 4 usam `N = 1024 = 2¹⁰` (a aula usa `N = 1000`)
  para que `fft` execute a FFT radix-2; com `T = 1 s` a resolução continua `Δf = 1 Hz` e as frequências caem
  em bins inteiros. O Exemplo 1 mantém `N = 100`, como na aula.
- Importação de dados. Gramática: um valor por linha ou duas colunas `t x` com `t` crescente e uniformemente
  espaçado (`T = N Δt`); separadores espaço, tabulação, vírgula ou ponto e vírgula; ponto decimal; linhas com
  `#` ou `%` ignoradas; 8 a 4096 amostras. A vírgula nunca é interpretada como separador decimal.
- Exportação CSV do sinal, do espectro e dos bins mantidos.
- Escalas Y fixas por experimento, conforme as [convenções de interface](UI-CONVENTIONS.md): a faixa é calculada
  ao escolher um experimento, carregar dados ou trocar a origem do sinal, com margem de 10%; alterações de
  parâmetros não a mudam. Valores fora da faixa são sinalizados; **Ajustar escala** e **Restaurar escala** agem
  somente no gráfico correspondente. O gráfico de fase usa a faixa fixa `[−1,1π, 1,1π]`.

## Biblioteca compartilhada

Usa `fft`/`ifft` de `assets/js/core/signal.js` e `createRandom` de `assets/js/core/random.js`; reaproveita
`proseParts` de `simulators/electrical-circuits/shared/presentation.js`.

Para `N` que não é potência de 2, a FFT compartilhada usa o algoritmo de Bluestein (`O(N log N)`).

## Limitações

Não há janelamento (Hann, Hamming etc.), zero-padding nem estimativa espectral por média; o limiar é um filtro
didático, não causal, sobre o bloco inteiro. O ruído é gaussiano e branco. As frequências acima de `f_s/2` são
rebatidas. O número de amostras é limitado a `N ≤ 4096`.

## Evidências

`scripts/reference/gen_dft_spectrum.py` gera `tests/fixtures/dft-spectrum-numpy.json` com NumPy 1.26.4
(entradas armazenadas no fixture, incluindo o ruído). `tests/dft-spectrum.test.mjs` compara espectro complexo,
amplitude de um lado, bins mantidos e reconstrução filtrada com essa referência, com `N` par, ímpar, radix-2,
componente DC e bin de Nyquist. Também verifica casos analíticos (Exemplo 1 exato, tons puros e relação de fase),
igualdade entre a fórmula da aula e o espectro calculado em todos os bins, simetria conjugada, reconstrução exata com limiar nulo,
equivalência entre a inversa e a soma de cossenos, vazamento, aliasing, reprodutibilidade do ruído, entradas
inválidas, a gramática dos dados, paridade das traduções e a renderização KaTeX de todas as fontes LaTeX.
Isso é verificação numérica de exemplos; o catálogo declara o nível `experimental`.
