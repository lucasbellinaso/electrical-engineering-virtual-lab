/** LaTeX sources shared by all languages; the surrounding sentences live in locales.json. */
export const equationBlocks = Object.freeze([
  ['eqSignal', String.raw`x(t)=\sum_{i=1}^{4}A_i\sin\left(2\pi f_i t+\varphi_i\right),\qquad t_n=\frac{nT}{N},\qquad x_n=x(t_n)+\sigma\,\eta_n,\quad \eta_n\sim\mathcal{N}(0,1)`],
  ['eqDft', String.raw`F_k=\sum_{n=0}^{N-1}x_n\,e^{-i2\pi kn/N},\qquad k=0,\dots,N-1,\qquad f_k=\frac{k}{T},\qquad f_s=\frac{N}{T}`],
  ['eqInverse', String.raw`x_n=\frac{1}{N}\sum_{k=0}^{N-1}F_k\,e^{i2\pi kn/N},\qquad F_{N-k}=\overline{F_k}\ \ (x_n\in\mathbb{R})`],
  ['eqAmplitude', String.raw`A_k=\frac{2|F_k|}{N}\ \ \left(0<k<\tfrac{N}{2}\right),\qquad A_0=\frac{|F_0|}{N},\qquad A_{N/2}=\frac{|F_{N/2}|}{N},\qquad \arg F_k=\operatorname{atan2}\left(\operatorname{Im}F_k,\operatorname{Re}F_k\right)`],
  ['eqFilter', String.raw`\tilde F_k=\begin{cases}F_k, & A_{\min(k,\,N-k)}\ge A_{\min}\\[2pt] 0, & A_{\min(k,\,N-k)}<A_{\min}\end{cases}\qquad \tilde x_n=\frac{1}{N}\sum_{k=0}^{N-1}\tilde F_k\,e^{i2\pi kn/N}=\sum_{k\in\mathcal{K}}A_k\cos\left(2\pi f_k t_n+\arg F_k\right)`],
  ['eqPhase', String.raw`A\sin\left(2\pi f t+\varphi\right)=A\cos\left(2\pi f t+\varphi-\tfrac{\pi}{2}\right)\ \Rightarrow\ \arg F_k=\varphi-\tfrac{\pi}{2}\quad (f\,T=k\in\mathbb{Z},\ 0<k<\tfrac{N}{2})`],
  ['eqError', String.raw`\varepsilon_{\mathrm{rms}}=\sqrt{\frac{1}{N}\sum_{n=0}^{N-1}\left(\tilde x_n-s_n\right)^2},\qquad s_n=\sum_{i}A_i\sin\left(2\pi f_i t_n+\varphi_i\right)`]
]);

/** Operation counts for the current N (complex multiplications). */
export function compareLatex(samples, counts, number) {
  const fast = counts.radix2 ? String.raw`C_{\mathrm{FFT}}=\tfrac{N}{2}\log_2 N=${number(counts.fft)}` : String.raw`N\neq 2^m\ \Rightarrow\ C_{\mathrm{FFT}}=C_{\mathrm{TDF}}`;
  return String.raw`N=${samples}:\qquad C_{\mathrm{TDF}}=N^2=${number(counts.direct)},\qquad ${fast}`;
}
