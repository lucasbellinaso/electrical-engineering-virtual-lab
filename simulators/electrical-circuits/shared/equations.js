// Original EEVL derivations, typeset from trusted LaTeX with local KaTeX.
const tex=String.raw;
const first={
 rc:[
  ['circuit_rcKVL',tex`V_s=v_R+v_C,\qquad v_R=Ri,\qquad i=C\frac{dv_C}{dt}`],
  ['circuit_substitute',tex`RC\frac{dv_C}{dt}+v_C=V_s,\qquad v_C(0^+)=V_0`],
  ['circuit_rcShift',tex`y=v_C-V_s\;\Longrightarrow\;\frac{dy}{y}=-\frac{dt}{RC}`],
  ['circuit_integrate',tex`\ln\!\left|\frac{y(t)}{y(0)}\right|=-\frac{t}{RC}\;\Longrightarrow\;y(t)=y(0)e^{-t/(RC)}`],
  ['circuit_rcSolution',tex`\boxed{v_C(t)=V_s+(V_0-V_s)e^{-t/\tau}},\quad\tau=RC,\quad i(t)=\frac{V_s-v_C(t)}R`],
  ['circuit_zeroState',tex`H_{RC}(s)=\frac{V_C(s)}{V_s(s)}=\frac{1}{RCs+1},\qquad E_C=\frac12 Cv_C^2`]
 ],
 rl:[
  ['circuit_rlKVL',tex`V_s=v_R+v_L,\qquad v_R=Ri_L,\qquad v_L=L\frac{di_L}{dt}`],
  ['circuit_substitute',tex`L\frac{di_L}{dt}+Ri_L=V_s,\qquad i_L(0^+)=I_0`],
  ['circuit_rlShift',tex`I_\infty=\frac{V_s}{R},\qquad y=i_L-I_\infty\;\Longrightarrow\;\frac{dy}{y}=-\frac RL\,dt`],
  ['circuit_integrate',tex`\ln\!\left|\frac{y(t)}{y(0)}\right|=-\frac RL t\;\Longrightarrow\;y(t)=y(0)e^{-Rt/L}`],
  ['circuit_rlSolution',tex`\boxed{i_L(t)=\frac{V_s}R+\left(I_0-\frac{V_s}R\right)e^{-t/\tau}},\quad\tau=\frac LR,\quad v_L=V_s-Ri_L`],
  ['circuit_zeroState',tex`H_{RL}(s)=\frac{I_L(s)}{V_s(s)}=\frac1{Ls+R},\qquad E_L=\frac12 Li_L^2`]
 ]
};
const second={
 series:[
  ['circuit_seriesKVL',tex`V_s=Ri_L+L\frac{di_L}{dt}+v_C,\qquad i_L=C\frac{dv_C}{dt}`],
  ['circuit_seriesStates',tex`\boxed{\frac{dv_C}{dt}=\frac{i_L}{C},\qquad\frac{di_L}{dt}=\frac{V_s-Ri_L-v_C}{L}}`],
  ['circuit_seriesODE',tex`LC\frac{d^2v_C}{dt^2}+RC\frac{dv_C}{dt}+v_C=V_s`],
  ['circuit_seriesShift',tex`y=v_C-V_s,\quad y_0=V_0-V_s,\quad d_0=\dot y(0^+)=\frac{I_0}{C}`],
  ['circuit_seriesCoefficients',tex`\omega_0=\frac1{\sqrt{LC}},\quad\alpha=\frac{R}{2L},\quad\zeta=\frac\alpha{\omega_0},\quad R_{\mathrm{crit}}=2\sqrt{\frac LC}`]
 ],
 parallel:[
  ['circuit_parallelKCL',tex`I_s=i_R+i_C+i_L,\qquad i_R=\frac vR,\quad i_C=C\frac{dv}{dt},\quad v=L\frac{di_L}{dt}`],
  ['circuit_parallelStates',tex`\boxed{\frac{dv}{dt}=\frac{I_s-v/R-i_L}{C},\qquad\frac{di_L}{dt}=\frac vL}`],
  ['circuit_parallelODE',tex`\frac{dI_s}{dt}=\frac1R\frac{dv}{dt}+C\frac{d^2v}{dt^2}+\frac vL\;\Longrightarrow\;\ddot v+\frac1{RC}\dot v+\frac1{LC}v=0`],
  ['circuit_parallelShift',tex`y=v,\quad y_0=V_0,\quad d_0=\frac{I_s-V_0/R-I_0}{C},\quad v_\infty=0,\quad i_{L,\infty}=I_s`],
  ['circuit_parallelCoefficients',tex`\omega_0=\frac1{\sqrt{LC}},\quad\alpha=\frac1{2RC},\quad\zeta=\frac\alpha{\omega_0},\quad R_{\mathrm{crit}}=\frac12\sqrt{\frac LC}`]
 ]
};
const roots=[
 ['circuit_characteristic',tex`\ddot y+2\alpha\dot y+\omega_0^2y=0,\qquad s_{1,2}=-\alpha\pm\sqrt{\alpha^2-\omega_0^2}`],
 ['circuit_underSolution',tex`\alpha<\omega_0:\quad y=e^{-\alpha t}\left[y_0\cos(\omega_dt)+\frac{d_0+\alpha y_0}{\omega_d}\sin(\omega_dt)\right],\quad\omega_d=\sqrt{\omega_0^2-\alpha^2}`],
 ['circuit_criticalSolution',tex`\alpha=\omega_0:\quad y=e^{-\alpha t}\left[y_0+(d_0+\alpha y_0)t\right]`],
 ['circuit_overSolution',tex`\alpha>\omega_0:\quad y=Ae^{s_1t}+Be^{s_2t},\quad A=\frac{d_0-s_2y_0}{s_1-s_2},\quad B=y_0-A`]
];
export function equations(topology){
 if(first[topology])return first[topology];
 return [...second[topology],...roots,
  [topology==='series'?'circuit_seriesRecover':'circuit_parallelRecover',topology==='series'?tex`v_C=V_s+y,\qquad i_L=C\dot y,\qquad H(s)=\frac{V_C(s)}{V_s(s)}=\frac1{LCs^2+RCs+1}`:tex`v=y,\qquad i_L=I_s-\frac yR-C\dot y,\qquad Z(s)=\frac{V(s)}{I_s(s)}=\frac{Ls}{LCs^2+(L/R)s+1}`],
  ['circuit_energyEquation',topology==='series'?tex`E=\frac12 Cv_C^2+\frac12 Li_L^2,\qquad\frac{dE}{dt}=V_si_L-Ri_L^2`:tex`E=\frac12 Cv^2+\frac12 Li_L^2,\qquad\frac{dE}{dt}=I_sv-\frac{v^2}{R}`]
 ];
}
