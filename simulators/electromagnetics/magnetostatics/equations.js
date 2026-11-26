const tex=String.raw;
export function equations(mode){
 const common=[['ampere',tex`\oint_\Gamma\mathbf H\cdot d\mathbf l=I_{\rm enc},\qquad \mathbf B=\mu\mathbf H,\qquad \mu=\mu_0\mu_r`]];
 if(mode==='wires')return [...common,
  ['wireSymmetry',tex`H_\phi(\rho)\,2\pi\rho=I_{\rm enc}(\rho),\qquad I_{\rm enc}=\begin{cases}I\rho^2/b^2,&\rho<b\\I,&\rho\ge b\end{cases}`],
  ['wireSolution',tex`\boxed{B_\phi=\frac{\mu I}{2\pi}\begin{cases}\rho/b^2,&\rho<b\\1/\rho,&\rho\ge b\end{cases}}`],
  ['wireCartesian',tex`\mathbf B_i=\frac{\mu I_i}{2\pi\max(\rho_i^2,b^2)}\begin{bmatrix}-(y-y_i)\\x-x_i\\0\end{bmatrix},\qquad\mathbf B=\sum_i\mathbf B_i`]
 ];
 const ring=[
  ['biot',tex`\mathbf B(\mathbf r)=\frac{\mu I}{4\pi}\oint\frac{d\mathbf l'\times(\mathbf r-\mathbf r')}{\lVert\mathbf r-\mathbf r'\rVert^3}`],
  ['parameterize',tex`\mathbf r'(\phi)=\begin{bmatrix}a\cos\phi\\a\sin\phi\\z_c\end{bmatrix},\qquad d\mathbf l'=a\begin{bmatrix}-\sin\phi\\\cos\phi\\0\end{bmatrix}d\phi`],
  ['meridian',tex`\begin{bmatrix}B_x\\B_z\end{bmatrix}=\frac{\mu I a}{4\pi}\int_0^{2\pi}\frac{\begin{bmatrix}(z-z_c)\cos\phi\\a-x\cos\phi\end{bmatrix}}{[x^2+a^2-2ax\cos\phi+(z-z_c)^2]^{3/2}}\,d\phi,\quad B_y=0`],
  ['axisSolution',tex`\boxed{B_z(0,z)=\frac{\mu I a^2}{2[a^2+(z-z_c)^2]^{3/2}}},\qquad B_x(0,z)=0`]
 ];
 return [...common,...ring,...(mode==='solenoid'?[
  ['coilSum',tex`z_k=-\frac\ell2+\left(k+\frac12\right)\frac\ell N,\quad k=0,\ldots,N-1,\qquad\mathbf B=\sum_{k=0}^{N-1}\mathbf B_{\rm loop}(z-z_k)`],
  ['continuous',tex`B_{z,\rm cont}(0,z)=\frac{\mu NI}{2\ell}\left[\frac{z+\ell/2}{\sqrt{a^2+(z+\ell/2)^2}}-\frac{z-\ell/2}{\sqrt{a^2+(z-\ell/2)^2}}\right]`],
  ['longLimit',tex`\ell\gg a,\quad |z|\ll\ell/2\quad\Longrightarrow\quad B_z\simeq\mu\frac N\ell I`]
 ]:[])];
}
