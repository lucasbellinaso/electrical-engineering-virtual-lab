const tex=String.raw;
/** Derivation for the selected geometry as ordered blocks: ['h'|'p', dictionaryKey] or ['eq', LaTeX]. */
export function blocks(s){
 const out=[
  ['p','p_plane'],
  ['eq',tex`\varepsilon_0\approx8.8541878188\times10^{-12}\;\mathrm{F/m},\qquad k=\frac{1}{4\pi\varepsilon_0}`],
  ['h','h_coords'],['p','p_coords'],
  ['eq',tex`\rho=\sqrt{x^2+y^2},\quad r=\sqrt{x^2+y^2+z^2},\quad \varphi=\operatorname{atan2}(y,x),\quad \theta=\arccos(z/r)`],
  ['eq',tex`z=0:\quad r=\rho,\quad\theta=\frac{\pi}{2}\;(r>0),\quad\hat{\mathbf e}_{\rho}=\hat{\mathbf e}_r=(\cos\varphi,\sin\varphi,0),\quad\hat{\mathbf e}_{\varphi}=(-\sin\varphi,\cos\varphi,0)`],
  ['eq',tex`E_{\rho}=E_r=E_x\cos\varphi+E_y\sin\varphi,\quad E_{\varphi}=-E_x\sin\varphi+E_y\cos\varphi,\quad E_z=E_{\theta}=0`],
  ['p','p_undefined']
 ];
 if(s.mode==='charges')out.push(
  ['h','h_charges'],['p','p_coulomb'],
  ['eq',tex`\mathbf R_i=\mathbf r-\mathbf r_i,\qquad\mathbf E_i=k\frac{q_i}{R_i^2}\hat{\mathbf R}_i=kq_i\frac{\mathbf r-\mathbf r_i}{\lVert\mathbf r-\mathbf r_i\rVert^3}`],
  ['p','p_superposition'],
  ['eq',tex`\mathbf E=\sum_i\mathbf E_i,\quad E_x=k\sum_i\frac{q_i(x-x_i)}{[(x-x_i)^2+(y-y_i)^2]^{3/2}},\quad E_y=k\sum_i\frac{q_i(y-y_i)}{[(x-x_i)^2+(y-y_i)^2]^{3/2}}`],
  ['eq',tex`V=k\sum_i\frac{q_i}{\sqrt{(x-x_i)^2+(y-y_i)^2}},\qquad \mathbf E=-\nabla V`],
  ['p','p_chargeLimits']
 );
 else if(s.mode==='sphere'){
  out.push(['h','h_sphere'],['p','p_sphereGauss'],
   ['eq',tex`\oint\mathbf E\cdot d\mathbf A=\frac{Q_{\mathrm{int}}}{\varepsilon_0}\quad\Longrightarrow\quad E_r\,4\pi r^2=\frac{Q_{\mathrm{int}}}{\varepsilon_0}`]);
  if(s.material==='conductor')out.push(['p','p_conductor'],
   ['eq',tex`E_r=\begin{cases}0,&r<R,\\kQ/r^2,&r>R,\end{cases}\qquad V=\begin{cases}kQ/R,&r\le R,\\kQ/r,&r\ge R.\end{cases}`],
   ['p','p_jump']);
  else out.push(['p','p_insulator'],
   ['eq',tex`Q_{\mathrm{int}}=Q\frac{r^3}{R^3}\;(r<R)\quad\Longrightarrow\quad E_r=\begin{cases}kQr/R^3,&r\le R,\\kQ/r^2,&r\ge R.\end{cases}`],
   ['eq',tex`V(r)=\int_r^\infty E_r(r')\,dr'=\begin{cases}\dfrac{kQ}{2R}\left(3-\dfrac{r^2}{R^2}\right),&r\le R,\\kQ/r,&r\ge R.\end{cases}`],
   ['p','p_continuous']);
  out.push(['eq',tex`E_x=E_r\frac{x}{r},\quad E_y=E_r\frac{y}{r}\quad(r>0),\qquad V(\infty)=0`]);
 }else if(s.mode==='wire')out.push(
  ['h','h_wire'],['p','p_wireGauss'],
  ['eq',tex`E_{\rho}(2\pi\rho L)=\frac{\lambda L}{\varepsilon_0}\quad\Longrightarrow\quad\mathbf E=\frac{\lambda}{2\pi\varepsilon_0\rho}\hat{\mathbf e}_{\rho}`],
  ['eq',tex`E_x=\frac{\lambda x}{2\pi\varepsilon_0(x^2+y^2)},\qquad E_y=\frac{\lambda y}{2\pi\varepsilon_0(x^2+y^2)}`],
  ['p','p_wireRef'],
  ['eq',tex`V(\rho)-V(\rho_0)=-\int_{\rho_0}^{\rho}\frac{\lambda}{2\pi\varepsilon_0\rho'}\,d\rho'=-\frac{\lambda}{2\pi\varepsilon_0}\ln\left(\frac{\rho}{\rho_0}\right)`],
  ['p','p_wireSingular']
 );
 else out.push(
  ['h','h_plates'],['p','p_platesGauss'],
  ['eq',tex`2EA=\frac{\sigma A}{\varepsilon_0}\quad\Longrightarrow\quad E_{\mathrm{sheet}}=\frac{\sigma}{2\varepsilon_0}`],
  ['p','p_platesSuper'],
  ['eq',tex`E_x=\frac{\sigma}{2\varepsilon_0}\left[\operatorname{sgn}(x+d/2)-\operatorname{sgn}(x-d/2)\right],\quad E_y=0`],
  ['eq',tex`E_x=\begin{cases}\sigma/\varepsilon_0,&|x|<d/2,\\0,&|x|>d/2,\end{cases}\quad V(x)=\frac{\sigma}{2\varepsilon_0}\left(|x-d/2|-|x+d/2|\right),\quad V(0)=0`],
  ['eq',tex`V(-d/2)-V(d/2)=\frac{\sigma d}{\varepsilon_0}`],
  ['p','p_platesLimits']
 );
 out.push(['h','h_reading'],['eq',tex`|\mathbf E|=\sqrt{E_x^2+E_y^2},\qquad \alpha=\operatorname{atan2}(E_y,E_x)`],['p','p_reading'],['p','p_limits']);
 return out;
}
