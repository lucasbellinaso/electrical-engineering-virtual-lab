// Language-independent LaTeX derivations, rendered locally via KaTeX.
// Explanations and step headings live in locales.json.
export const steps = [
  [
    String.raw`k = \log_2 M,\quad E_s = \frac{1}{M}\sum_{m=0}^{M-1}|s_m|^2 = 1,\quad E_b = \frac{E_s}{k},\quad \frac{E_s}{N_0} = k\,\frac{E_b}{N_0}`,
    String.raw`r = s_m e^{j\Delta\phi} + n,\quad n = n_I + j n_Q,\quad n_I, n_Q \stackrel{\text{i.i.d.}}{\sim} \mathcal{N}(0,\sigma^2),\quad \sigma^2 = \frac{N_0}{2} = \frac{E_s}{2 k (E_b/N_0)}`
  ],
  [
    String.raw`Q(z) = \frac{1}{\sqrt{2\pi}}\int_z^{\infty} e^{-t^2/2}\,dt = \frac{1}{2}\operatorname{erfc}\!\left(\frac{z}{\sqrt{2}}\right),\quad \hat{m} = \arg\min_{m} \|r - s_m\|_2`,
    String.raw`P_{b,\text{BPSK}} = P_{s,\text{BPSK}} = Q\!\left(\sqrt{\frac{2E_b}{N_0}}\right),\quad P_{b,\text{QPSK}} = Q\!\left(\sqrt{\frac{2E_b}{N_0}}\right),\quad P_{s,\text{QPSK}} = 2Q\!\left(\sqrt{\frac{2E_b}{N_0}}\right) - Q^2\!\left(\sqrt{\frac{2E_b}{N_0}}\right)`
  ],
  [
    String.raw`P_{s,M\text{-PSK}} = \frac{1}{\pi}\int_0^{\pi - \pi/M} \exp\!\left(-\frac{(E_s/N_0)\sin^2(\pi/M)}{\sin^2\theta}\right)d\theta,\quad P_{b,8\text{-PSK}} = \frac{2}{3}(p_1 + p_2 - p_1 p_2)`,
    String.raw`p_1 = Q\!\left(\sqrt{\frac{2E_s}{N_0}}\sin\frac{\pi}{8}\right),\quad p_2 = Q\!\left(\sqrt{\frac{2E_s}{N_0}}\sin\frac{3\pi}{8}\right)`
  ],
  [
    String.raw`a = \sqrt{\frac{3 E_s}{2(M-1)}},\quad d_{\min} = 2a = \sqrt{\frac{6E_s}{M-1}},\quad P_{\text{PAM}} = 2\!\left(1 - \frac{1}{\sqrt{M}}\right)Q\!\left(\sqrt{\frac{3E_s}{(M-1)N_0}}\right)`,
    String.raw`P_{s,M\text{-QAM}} = 2P_{\text{PAM}} - P_{\text{PAM}}^2,\quad P_{b,16\text{-QAM}} = \frac{1}{4}\!\left[3Q\!\left(\frac{a}{\sigma}\right) + 2Q\!\left(\frac{3a}{\sigma}\right) - Q\!\left(\frac{5a}{\sigma}\right)\right]`
  ]
];
