// Language-independent LaTeX, rendered locally. Explanations are in locales.json.
export const steps = [
  [String.raw`V_{R,\phi}=\frac{V_{R,LL}}{\sqrt{3}},\quad S_R=|S_R|(\mathrm{FP}\pm j\sqrt{1-\mathrm{FP}^2}),\quad I_R=\left(\frac{S_R}{3V_R}\right)^*`],
  [String.raw`z'=R'+j\omega L',\quad y'=j\omega C',\quad \omega=2\pi f,\quad \gamma=\sqrt{z'y'}=\alpha+j\beta,\quad Z_c=\frac{z'}{\gamma}`,
    String.raw`\begin{bmatrix}V_S\\I_S\end{bmatrix}=\begin{bmatrix}A&B\\C&D\end{bmatrix}\begin{bmatrix}V_R\\I_R\end{bmatrix},\quad A=D=\cosh(\gamma\ell),\quad B=Z_c\sinh(\gamma\ell),\quad C=\frac{\sinh(\gamma\ell)}{Z_c}`,
    String.raw`A=D,\quad AD-BC=1,\quad [A]=[D]=1,\quad [B]=\Omega,\quad [C]=\mathrm{S}`],
  [String.raw`Z_e=B,\quad \frac{Y_e}{2}=\frac{A-1}{B}=\frac{\tanh(\gamma\ell/2)}{Z_c}`,
    String.raw`\operatorname{sinhc}(u)=\frac{\sinh u}{u},\quad \operatorname{sinhc}(0)=1,\quad B=z'\ell\operatorname{sinhc}(\gamma\ell),\quad C=y'\ell\operatorname{sinhc}(\gamma\ell)`,
    String.raw`\frac{Y_e}{2}=\frac{y'\ell}{2}\frac{\operatorname{sinhc}(\gamma\ell/2)}{\cosh(\gamma\ell/2)},\quad \ell\to0:\;\mathbf{T}\to\mathbf{I}`,
    String.raw`\mathbf{T}_{\pi\,\mathrm{nom}}=\begin{bmatrix}1+ZY/2&Z\\Y(1+ZY/4)&1+ZY/2\end{bmatrix},\quad Z=z'\ell,\quad Y=y'\ell`],
  [String.raw`\begin{bmatrix}V(x)\\I(x)\end{bmatrix}=\mathbf{T}(\ell-x)\begin{bmatrix}V_R\\I_R\end{bmatrix},\quad 0\le x\le\ell`,
    String.raw`S_S=3V_S I_S^*,\quad S_R=3V_R I_R^*,\quad P_{\mathrm{loss}}=\Re(S_S-S_R)=3\int_0^\ell R'|I(x)|^2\,dx`,
    String.raw`I_R=0,\ V_S=\mathrm{const}:\quad V_R=\frac{V_S}{A},\quad I_S=CV_R`]
];
