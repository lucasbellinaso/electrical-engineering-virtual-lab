# Modulação digital M-ária e canal AWGN / M-ary digital modulation over AWGN

Aplicativo v1.0.0 em [Comunicações Digitais](../simulators/digital-communications/digital-modulation/index.html).
Interface, explicações, erros e deduções disponíveis em PT-BR, EN e ES.
Modelo puro: [model.js](../simulators/digital-communications/digital-modulation/model.js).
Contratos em [API.md](API.md); evidências em [validation/digital-modulation.md](validation/digital-modulation.md).

## Objetivo e experiências

Relacionar constelação I/Q, codificação Gray, distância euclidiana mínima $d_{\min}$, eficiência espectral $k = \log_2 M$ e probabilidades de erro de símbolo ($P_s$) e de bit ($P_b$) em canal AWGN sem memória. Inclui quatro experiências guiadas (QPSK ideal, BPSK em baixo SNR, 16-QAM e 64-QAM com erro de fase da portadora), curvas analíticas de comparação e inspeção bit a bit de amostras recebidas.

## Hipóteses, normalizações e convenções

- **Energia média unitária:** toda constelação é normalizada de modo que $E_s = \frac{1}{M}\sum_{m=0}^{M-1} |s_m|^2 = 1$, com $E_b = E_s / k$ e $E_s/N_0 = k\,(E_b/N_0)$.
- **Canal equivalente em banda base:** $r = s_m e^{j\Delta\phi} + n$, onde $n = n_I + j n_Q$, com $n_I, n_Q \stackrel{\text{i.i.d.}}{\sim} \mathcal{N}(0, \sigma^2)$, $\sigma^2 = N_0 / 2 = E_s / (2 k \cdot 10^{(E_b/N_0)_{\mathrm{dB}}/10})$ e $\mathbb{E}[|n|^2] = N_0$.
- **Codificação Gray:** símbolos adjacentes em 1D (eixos I/Q em QPSK, 16-QAM, 64-QAM) ou em ângulo (8-PSK) diferem por exatamente 1 bit.
- **Receptor:** filtro casado ideal amostrado sem interferência intersimbólica (ISI) e detector de máxima verossimilhança (ML) coerente com fronteiras fixas para $\Delta\phi = 0^\circ$ e símbolos equiprováveis.
- **Escopo excluído:** não modela codificação de canal (FEC), formatação de pulso, sincronismo de portadora/relógio, desvanecimento Rayleigh/Rician ou equalização.

## Equações e métodos

1. **Função $Q$ e aproximação de $\operatorname{erfc}$:** $Q(z) = \frac{1}{2}\operatorname{erfc}(z/\sqrt{2})$, implementada pelas aproximações racionais de Chebyshev de Cody (1969) com precisão relativa próxima de $10^{-15}$.
2. **BPSK ($M=2, k=1$):** $s \in \{\pm 1\}$, $d_{\min} = 2\sqrt{E_s}$, $P_s = P_b = Q(\sqrt{2E_b/N_0})$.
3. **QPSK ($M=4, k=2$):** $s \in \{(\pm 1/\sqrt{2}, \pm 1/\sqrt{2})\}$, $d_{\min} = \sqrt{2 E_s}$, $P_b = Q(\sqrt{2E_b/N_0})$ e $P_s = 2P_b - P_b^2$.
4. **8-PSK ($M=8, k=3$):** $s_m = (\cos(2\pi m/8), \sin(2\pi m/8))$, $d_{\min} = 2\sin(\pi/8)\sqrt{E_s}$. $P_s$ é calculada pela integral exata de Craig no intervalo $[0, 7\pi/8]$ com regra de Simpson composta ($512$ subintervalos); $P_b = \frac{2}{3}(p_1 + p_2 - p_1 p_2)$, onde $p_1 = Q(\sqrt{2E_s/N_0}\sin(\pi/8))$ e $p_2 = Q(\sqrt{2E_s/N_0}\sin(3\pi/8))$.
5. **16-QAM e 64-QAM ($M \in \{16, 64\}, L = \sqrt{M}$):** níveis $L$-PAM com fator $a = \sqrt{3/(2(M-1))}$, $d_{\min} = 2a$, $P_{\text{PAM}} = 2(1 - 1/L)Q(\sqrt{3(E_s/N_0)/(M-1)})$, $P_s = 2P_{\text{PAM}} - P_{\text{PAM}}^2$ e $P_b$ exata pela fórmula de Cho & Yoon (2002).
6. **Erro de fase $\Delta\phi \neq 0$:** para BPSK, QPSK, 16-QAM e 64-QAM, as regiões ML são retângulos separáveis nos eixos I/Q e a probabilidade analítica com rotação é obtida exatamente via produtos de diferenças da CDF normal; para 8-PSK ($|\Delta\phi| < 22{,}5^\circ$), $P_s$ usa cunhas assimétricas de Craig.
7. **Monte Carlo determinístico:** gerador Mulberry32 parametrizado por `seed` e transformação de Box–Muller com proteção `max(u, 1e-15)` contra $\ln(0)$.

## Domínio, limites e estatística

- Faixas válidas: $E_b/N_0 \in [0, 24]\;\mathrm{dB}$, $N_{\text{sym}} \in [100, 20000]$ inteiro, $\Delta\phi \in [-45^\circ, 45^\circ]$ e `seed` inteiro em $[1, 2147483647]$.
- Entradas não finitas, tipos inválidos ou modulações desconhecidas lançam `RangeError` com `code = 'invalid'`.
- Quando nenhum erro ocorre em $N_{\text{sym}}$ amostras, o modelo reporta `0` exato sem substituir por piso artificial; o gráfico logarítmico indica pontos fora da faixa vertical ($< 10^{-6}$ ou nulos).

## Referências gerais

- Proakis, J. G.; Salehi, M. *Digital Communications*, 5th ed., McGraw-Hill (referência geral de teoria; deduções e código são originais do EEVL).
- Cho, K.; Yoon, D. "On the general BER expression of one- and two-dimensional amplitude modulations", *IEEE Trans. Commun.*, vol. 50, no. 7, pp. 1074–1080, 2002.
- Craig, J. W. "A new, simple and exact result for calculating the probability of error for two-dimensional signal constellations", *Proc. IEEE MILCOM*, 1991.

## English

The application models M-ary BPSK, QPSK, 8-PSK, 16-QAM and 64-QAM over a memoryless complex baseband AWGN channel with unit average symbol energy ($E_s = 1$), Gray bit mapping, coherent maximum-likelihood boundaries ($\Delta\phi = 0^\circ$), optional carrier phase offset ($\Delta\phi \in [-45^\circ, 45^\circ]$), exact analytical BER/SER expressions (including Craig's M-PSK integral and Cho–Yoon's square M-QAM Gray BER) and deterministic seeded Monte Carlo simulation.
