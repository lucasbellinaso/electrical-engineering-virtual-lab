/*
 * Solução de sistemas de equações não lineares F(x) = 0 por Newton–Raphson ou Gauss–Seidel — módulo
 * puro (ESM, sem DOM). Nomes e retorno no estilo do MATLAB (fsolve, numjac).
 *
 * Convenções do núcleo: vetores são arrays planos de números (x, F); matrizes são arrays de linhas.
 * O sistema é quadrado: fun recebe x (n números) e devolve F(x) (n números).
 *
 *   fsolve(fun, x0, options) → { x, fval, exitflag, output }     (≈ [x, fval, exitflag, output] do MATLAB)
 *
 * Algoritmo (Newton–Raphson): em cada iteração resolve J(x)·Δx = −F(x) e faz x ← x + t·Δx.
 *   - Por padrão t = 1 (Newton puro, convergência quadrática perto da raiz; útil para fluxo de potência
 *     e para mostrar a sequência de iterações). Com lineSearch: true, t é reduzido pela metade
 *     (backtracking, até 30 vezes) até ½‖F‖² cair pela condição de Armijo (c = 1e-4).
 *   - J vem de options.jacobian(x) (analítico, recomendado) ou de diferenças finitas (numjac).
 *
 * Algoritmo (Gauss–Seidel, options.algorithm = 'gauss-seidel'): a cada iteração (varredura) atualiza as
 * componentes em ordem, i = 0…n−1, sempre com os valores mais recentes de x:
 *   - com options.update(x, i): xᵢ ← update(x, i) (forma de ponto fixo, p. ex. a fórmula clássica de
 *     tensão de barra do fluxo de potência; x já contém as componentes 0…i−1 atualizadas);
 *   - sem update: passo de Newton escalar em xᵢ, xᵢ ← xᵢ − Fᵢ(x)/(∂Fᵢ/∂xᵢ) (Newton–Gauss–Seidel); em
 *     F(x) = Ax − b isso é exatamente o Gauss–Seidel clássico. ∂Fᵢ/∂xᵢ vem de options.jacobian(x)[i][i]
 *     ou de diferença finita avançada em xᵢ.
 *   - fator de aceleração: xᵢ ← xᵢ + accel·(novoᵢ − xᵢ); accel = 1 é Gauss–Seidel, 1 < accel < 2 é SOR.
 *   Convergência só linear (e condicional: ex. diagonal dominante); pare por ‖F‖∞ ≤ tolFun medido após cada
 *   varredura. lineSearch e diffType não se aplicam.
 *
 * Opções (todas opcionais):
 *   algorithm   'newton-raphson' (padrão) | 'gauss-seidel'
 *   tolFun      1e-8   para quando ‖F(x)‖∞ ≤ tolFun (exitflag 1). Em fluxo de potência: desvio de potência em pu.
 *   tolX        1e-12  para quando ‖passo‖∞ ≤ tolX·(1 + ‖x‖∞) sem ser raiz (exitflag 2)
 *   maxIter     100 (Newton) | 1000 (Gauss–Seidel)   número máximo de iterações (exitflag 0 ao atingir)
 *   jacobian    —      função x → J (n×n, J[i][j] = ∂Fᵢ/∂xⱼ); no Gauss–Seidel só a diagonal é usada
 *   diffType    'forward' | 'central'  diferenças finitas quando não há jacobian (padrão 'forward'; só Newton)
 *   lineSearch  false  ativa o backtracking acima (só Newton)
 *   update      —      (Gauss–Seidel) função (x, i) → novo valor de xᵢ
 *   accel       1      (Gauss–Seidel) fator de aceleração, 0 < accel < 2
 *
 * exitflag:   1 raiz encontrada (‖F‖∞ ≤ tolFun)          2 passo desprezível (estagnou fora da tolerância)
 *             0 maxIter atingido                          −2 pivô nulo no Jacobiano (Gauss–Seidel: ∂Fᵢ/∂xᵢ = 0) ou sem passo de descida
 *            −3 F, x ou o passo de Newton deixou de ser finito (divergiu; x devolvido é a última iteração finita)
 *
 * output: { iterations, funcCount, jacCount, firstOrderOpt (= ‖F‖∞ final), stepNorm (último ‖passo‖∞),
 *           history (‖F‖∞ na iteração 0, 1, …), message, algorithm }.
 *
 * Limites: msolve só detecta pivô exatamente nulo; Jacobiano muito mal condicionado produz passos enormes
 * (visíveis em history) e termina em maxIter, −3 ou, com lineSearch, −2.
 *
 *   numjac(fun, x, options) → J (m×n): Jacobiano por diferenças finitas, h = ε^(1/2) (forward) ou
 *   ε^(1/3) (central) vezes max(|xⱼ|, 1). options: f0 (F(x) já calculado, evita uma avaliação),
 *   diffType.
 *
 * Erros: TypeError para tipo inválido; RangeError para valor inválido (x0 vazio ou não finito,
 * F(x0) não finita, F com dimensão ≠ n, opção fora do domínio).
 */
import { msolve } from './matrix.js';

const SQRT_EPS = Math.sqrt(Number.EPSILON);
const CBRT_EPS = Math.cbrt(Number.EPSILON);
const MAX_BACKTRACK = 30;
const ARMIJO = 1e-4;

/* ------------------------- validação ------------------------- */

function vetor(x, nome) {
  if (!Array.isArray(x)) throw new TypeError(`${nome} deve ser um array de números`);
  if (x.length === 0) throw new RangeError(`${nome} não pode ser vazio`);
  for (let i = 0; i < x.length; i++) {
    if (typeof x[i] !== 'number') throw new TypeError(`${nome}[${i}] deve ser um número`);
    if (!Number.isFinite(x[i])) throw new RangeError(`${nome}[${i}] deve ser finito`);
  }
  return x;
}

function avalia(fun, x, m) {
  const f = fun(x.slice());   // cópia: fun não altera o iterando
  if (!Array.isArray(f)) throw new TypeError('fun deve devolver um array de números');
  if (m !== undefined && f.length !== m) {
    throw new RangeError(`fun deve devolver ${m} componentes (sistema quadrado), devolveu ${f.length}`);
  }
  for (let i = 0; i < f.length; i++) {
    if (typeof f[i] !== 'number') throw new TypeError(`fun(x)[${i}] deve ser um número`);
  }
  return f;
}

const normaInf = (v) => v.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
const todosFinitos = (v) => v.every(Number.isFinite);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function tipoDiff(t) {
  if (t === undefined) return 'forward';
  if (t !== 'forward' && t !== 'central') throw new RangeError("diffType deve ser 'forward' ou 'central'");
  return t;
}

/* ------------------------- numjac ------------------------- */

/**
 * Jacobiano por diferenças finitas. J[i][j] ≈ ∂Fᵢ/∂xⱼ.
 * @param {(x:number[])=>number[]} fun @param {number[]} x
 * @param {{f0?:number[], diffType?:'forward'|'central'}} [options]
 * @returns {number[][]} matriz m×n
 */
export function numjac(fun, x, options = {}) {
  if (typeof fun !== 'function') throw new TypeError('fun deve ser uma função');
  vetor(x, 'x');
  const tipo = tipoDiff(options.diffType);
  const n = x.length;
  const f0 = tipo === 'forward' ? (options.f0 ? vetor(options.f0, 'f0') : avalia(fun, x)) : null;
  const colunas = [];
  for (let j = 0; j < n; j++) {
    const h = (tipo === 'central' ? CBRT_EPS : SQRT_EPS) * Math.max(Math.abs(x[j]), 1);
    const xp = x.slice(); xp[j] = x[j] + h;
    const hp = xp[j] - x[j];   // passo realmente representável
    if (tipo === 'central') {
      const xm = x.slice(); xm[j] = x[j] - h;
      const hm = x[j] - xm[j];
      const fp = avalia(fun, xp), fm = avalia(fun, xm);
      colunas.push(fp.map((v, i) => (v - fm[i]) / (hp + hm)));
    } else {
      const fp = avalia(fun, xp, f0.length);
      colunas.push(fp.map((v, i) => (v - f0[i]) / hp));
    }
  }
  const m = colunas[0].length;
  return Array.from({ length: m }, (_, i) => colunas.map((c) => c[i]));
}

/* ------------------------- fsolve ------------------------- */

function opcoes(o) {
  if (o === null || typeof o !== 'object') throw new TypeError('options deve ser um objeto');
  const num = (v, padrao, nome, ok) => {
    if (v === undefined) return padrao;
    if (typeof v !== 'number' || !Number.isFinite(v) || !ok(v)) throw new RangeError(`${nome} inválido (recebido ${v})`);
    return v;
  };
  if (o.jacobian !== undefined && typeof o.jacobian !== 'function') throw new TypeError('jacobian deve ser uma função');
  const algoritmo = o.algorithm === undefined ? 'newton-raphson' : o.algorithm;
  if (algoritmo !== 'newton-raphson' && algoritmo !== 'gauss-seidel') {
    throw new RangeError("algorithm deve ser 'newton-raphson' ou 'gauss-seidel'");
  }
  if (o.update !== undefined && typeof o.update !== 'function') throw new TypeError('update deve ser uma função');
  return {
    algorithm: algoritmo,
    tolFun: num(o.tolFun, 1e-8, 'tolFun', (v) => v > 0),
    tolX: num(o.tolX, 1e-12, 'tolX', (v) => v >= 0),
    maxIter: num(o.maxIter, algoritmo === 'gauss-seidel' ? 1000 : 100, 'maxIter', (v) => Number.isInteger(v) && v >= 0),
    jacobian: o.jacobian,
    diffType: tipoDiff(o.diffType),
    lineSearch: o.lineSearch === undefined ? false : Boolean(o.lineSearch),
    update: o.update,
    accel: num(o.accel, 1, 'accel', (v) => v > 0 && v < 2),
  };
}

function jacobianoAnalitico(jac, x, n) {
  const J = jac(x.slice());
  if (!Array.isArray(J) || J.length !== n) throw new RangeError(`jacobian deve devolver matriz ${n}×${n}`);
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(J[i]) || J[i].length !== n) throw new RangeError(`jacobian deve devolver matriz ${n}×${n}`);
    for (let j = 0; j < n; j++) {
      if (typeof J[i][j] !== 'number') throw new TypeError(`jacobian[${i}][${j}] deve ser um número`);
    }
  }
  return J;
}

/* ------------------------- Gauss–Seidel ------------------------- */

function gaussSeidel(fun, x0, f0, o, F, getFuncCount, getJacCount, addJac) {
  const n = x0.length;
  let x = x0.slice(), f = f0;
  const history = [normaInf(f)];
  let iter = 0, exitflag = 0, mensagem = 'Número máximo de iterações atingido', stepNorm = 0;
  const encerra = (flag, msg) => { exitflag = flag; mensagem = msg; };

  for (;;) {
    if (history[iter] <= o.tolFun) { encerra(1, 'Raiz encontrada: ‖F‖∞ ≤ tolFun'); break; }
    if (iter >= o.maxIter) break;

    const xAnt = x.slice();
    const xn = x.slice();
    let flag = 0, msg = '';
    for (let i = 0; i < n && flag === 0; i++) {
      let novo;
      if (o.update) {
        novo = o.update(xn.slice(), i);
        if (typeof novo !== 'number') throw new TypeError('update deve devolver um número');
      } else {
        const fi = F(xn)[i];
        let d;
        if (o.jacobian) { d = jacobianoAnalitico(o.jacobian, xn, n)[i][i]; addJac(1); }
        else {
          const h = SQRT_EPS * Math.max(Math.abs(xn[i]), 1);
          const xp = xn.slice(); xp[i] = xn[i] + h;
          d = (F(xp)[i] - fi) / (xp[i] - xn[i]);
        }
        if (d === 0) { flag = -2; msg = `∂F${i}/∂x${i} = 0: Gauss–Seidel sem passo`; break; }
        novo = xn[i] - fi / d;
      }
      xn[i] = xn[i] + o.accel * (novo - xn[i]);
      if (!Number.isFinite(xn[i])) { flag = -3; msg = 'x deixou de ser finito (divergiu)'; }
    }
    if (flag !== 0) { encerra(flag, msg); break; }

    const fn = F(xn);
    if (!todosFinitos(fn)) { encerra(-3, 'F deixou de ser finita (divergiu)'); break; }
    stepNorm = normaInf(xn.map((v, i) => v - xAnt[i]));
    x = xn; f = fn; iter++;
    history.push(normaInf(f));
    if (history[iter] <= o.tolFun) { encerra(1, 'Raiz encontrada: ‖F‖∞ ≤ tolFun'); break; }
    if (stepNorm <= o.tolX * (1 + normaInf(x))) { encerra(2, 'Passo menor que tolX fora da tolerância de F'); break; }
  }

  return {
    x, fval: f, exitflag,
    output: {
      iterations: iter, funcCount: getFuncCount(), jacCount: getJacCount(),
      firstOrderOpt: normaInf(f), stepNorm, history, message: mensagem,
      algorithm: o.accel === 1 ? 'Gauss-Seidel' : `Gauss-Seidel com aceleração ${o.accel}`,
    },
  };
}

/**
 * Resolve F(x) = 0 por Newton–Raphson (padrão) ou Gauss–Seidel a partir de x0.
 * @param {(x:number[])=>number[]} fun F: ℝⁿ → ℝⁿ
 * @param {number[]} x0 estimativa inicial
 * @param {object} [options] ver cabeçalho do módulo
 * @returns {{x:number[], fval:number[], exitflag:number, output:object}}
 */
export function fsolve(fun, x0, options = {}) {
  if (typeof fun !== 'function') throw new TypeError('fun deve ser uma função');
  const o = opcoes(options);
  let x = vetor(x0, 'x0').slice();
  const n = x.length;
  let funcCount = 0, jacCount = 0;
  const F = (z) => { funcCount++; return avalia(fun, z, n); };

  let f = F(x);
  if (!todosFinitos(f)) throw new RangeError('fun(x0) deve ser finita');
  const history = [normaInf(f)];
  let iter = 0, exitflag = 0, mensagem = 'Número máximo de iterações atingido', stepNorm = 0;
  if (o.algorithm === 'gauss-seidel') return gaussSeidel(fun, x, f, o, F, () => funcCount, () => jacCount, (k) => { jacCount += k; });

  for (;;) {
    if (history[iter] <= o.tolFun) { exitflag = 1; mensagem = 'Raiz encontrada: ‖F‖∞ ≤ tolFun'; break; }
    if (iter >= o.maxIter) break;

    let J;
    if (o.jacobian) { J = jacobianoAnalitico(o.jacobian, x, n); jacCount++; }
    else {
      J = numjac(F, x, { f0: f, diffType: o.diffType });
      jacCount++;
    }

    let dx;
    try { dx = msolve(J, f.map((v) => [-v])).map((r) => r[0]); }
    catch (e) { exitflag = -2; mensagem = 'Jacobiano singular'; break; }
    if (!todosFinitos(dx)) { exitflag = -3; mensagem = 'Passo de Newton não finito (divergiu)'; break; }

    const phi0 = 0.5 * dot(f, f);
    let t = 1, xn = null, fn = null, aceito = false, naoFinito = false;
    const tentativas = o.lineSearch ? MAX_BACKTRACK : 0;
    for (let k = 0; k <= tentativas; k++) {
      xn = x.map((v, i) => v + t * dx[i]);
      fn = F(xn);
      const finito = todosFinitos(xn) && todosFinitos(fn);
      if (!finito) naoFinito = true;
      if (finito && (!o.lineSearch || 0.5 * dot(fn, fn) <= (1 - 2 * ARMIJO * t) * phi0)) { aceito = true; break; }
      if (!o.lineSearch) break;
      t *= 0.5;
    }
    if (!aceito) {
      if (!o.lineSearch) { exitflag = -3; mensagem = 'F ou x deixou de ser finito (divergiu)'; }
      else { exitflag = -2; mensagem = naoFinito ? 'Sem passo finito de descida' : 'Sem passo de descida (ponto não é raiz)'; }
      break;
    }

    stepNorm = normaInf(dx.map((v) => t * v));
    x = xn; f = fn; iter++;
    history.push(normaInf(f));
    if (history[iter] <= o.tolFun) { exitflag = 1; mensagem = 'Raiz encontrada: ‖F‖∞ ≤ tolFun'; break; }
    if (stepNorm <= o.tolX * (1 + normaInf(x))) { exitflag = 2; mensagem = 'Passo menor que tolX fora da tolerância de F'; break; }
  }

  return {
    x, fval: f, exitflag,
    output: {
      iterations: iter, funcCount, jacCount,
      firstOrderOpt: normaInf(f), stepNorm, history, message: mensagem,
      algorithm: o.lineSearch ? 'Newton-Raphson com backtracking' : 'Newton-Raphson',
    },
  };
}

/* ------------------------- fzero ------------------------- */

/**
 * Raiz de uma função escalar f(x) = 0 (≈ fzero do MATLAB): busca de intervalo com mudança de sinal
 * (se x0 for escalar) e método de Brent–Dekker (bisseção + secante + interpolação quadrática inversa).
 *
 *   fzero(f, x0, opts) → { x, fval, exitflag, output }     (≈ [x, fval, exitflag, output] do MATLAB)
 *
 *   f    função x → número (escalar)
 *   x0   número: procura um intervalo [a, b] em torno de x0 com f(a)·f(b) ≤ 0, expandindo
 *        simetricamente (passo inicial |x0|/50, ou 1/50 se x0 = 0, multiplicado por √2 a cada vez),
 *        como o MATLAB; ou [a, b]: intervalo dado, que deve ter f(a)·f(b) ≤ 0 (senão RangeError).
 *
 * Opções (todas opcionais):
 *   TolX         Number.EPSILON  tolerância em x: para quando o intervalo de incerteza ≤ 2·TolX·max(|x|, 1)
 *   MaxIter      1000            máximo de iterações de Brent (exitflag 0 ao atingir)
 *   MaxFunEvals  Infinity        máximo de avaliações de f, incluindo a busca de intervalo (exitflag 0)
 *
 * exitflag:   1 raiz localizada (intervalo ≤ tolerância, ou f(x) = 0 exato)
 *             0 MaxIter ou MaxFunEvals atingido (x é a melhor estimativa)
 *            −5 convergiu para um ponto onde |f| é maior que nos extremos do intervalo inicial: provável
 *               descontinuidade (polo) e não raiz; x é devolvido mesmo assim, como o MATLAB faz
 *
 * output: { iterations, funcCount, interval: [a, b] (intervalo inicial com mudança de sinal), message }.
 *
 * Descontinuidades: uma função descontínua que muda de sinal (p. ex. tan(x) em [1, 2], ou 1/x em [−1, 2])
 * faz o algoritmo convergir para o ponto de descontinuidade; fzero o devolve (exitflag −5 quando |f| ali é
 * maior que nos extremos), e não garante que seja uma raiz. Raízes sem mudança de sinal (p. ex. x² em x = 0,
 * multiplicidade par) não são encontradas por nenhuma forma desta função.
 *
 * Erros: TypeError para tipo inválido; RangeError para valor inválido (x0 ou intervalo não finito,
 * f não finita nos pontos iniciais, intervalo sem mudança de sinal, opção fora do domínio) ou se a
 * busca a partir de x0 escalar não achar mudança de sinal antes de x deixar de ser finito.
 *
 * @param {(x:number)=>number} f @param {number|number[]} x0
 * @param {{TolX?:number, MaxIter?:number, MaxFunEvals?:number}} [opts]
 */
export function fzero(f, x0, opts = {}) {
  if (typeof f !== 'function') throw new TypeError('f deve ser uma função');
  if (opts === null || typeof opts !== 'object') throw new TypeError('opts deve ser um objeto');
  const pos = (v, padrao, nome) => {
    if (v === undefined) return padrao;
    if (typeof v !== 'number' || Number.isNaN(v) || v <= 0) throw new RangeError(`${nome} deve ser um número > 0 (recebido ${v})`);
    return v;
  };
  const tol = pos(opts.TolX, Number.EPSILON, 'TolX');
  const maxIter = pos(opts.MaxIter, 1000, 'MaxIter');
  const maxEvals = pos(opts.MaxFunEvals, Infinity, 'MaxFunEvals');

  let funcCount = 0;
  const F = (x, rotulo) => {
    funcCount++;
    const v = f(x);
    if (typeof v !== 'number') throw new TypeError('f deve devolver um número');
    if (Number.isNaN(v)) throw new RangeError(`f(${rotulo ?? x}) é NaN`);
    return v;
  };
  const pos0 = (v) => v > 0;

  let a, b, fa, fb;
  if (typeof x0 === 'number') {
    if (!Number.isFinite(x0)) throw new RangeError('x0 deve ser finito');
    fa = F(x0);
    if (!Number.isFinite(fa)) throw new RangeError(`f(x0) = ${fa} não é finita`);
    if (fa === 0) {
      return { x: x0, fval: 0, exitflag: 1, output: { iterations: 0, funcCount, interval: [x0, x0], message: 'f(x0) = 0' } };
    }
    let dx = x0 !== 0 ? Math.abs(x0) / 50 : 1 / 50;
    const sinal0 = pos0(fa);   // f0 ≠ 0: o intervalo termina quando algum ponto tem sinal oposto
    a = x0; b = x0; fb = fa;
    let achou = false;
    while (!achou) {
      dx *= Math.SQRT2;
      const lo = x0 - dx, hi = x0 + dx;
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || funcCount >= maxEvals) break;
      const flo = F(lo);
      if (flo === 0 || pos0(flo) !== sinal0) { a = lo; fa = flo; achou = true; break; }   // b: ponto anterior (sinal de f0)
      if (funcCount >= maxEvals) break;
      const fhi = F(hi);
      a = lo; fa = flo; b = hi; fb = fhi;
      if (fhi === 0 || pos0(fhi) !== sinal0) achou = true;
    }
    if (!achou) {
      if (funcCount >= maxEvals) {
        return { x: x0, fval: F(x0), exitflag: 0, output: { iterations: 0, funcCount, interval: [a, b], message: 'MaxFunEvals atingido na busca de intervalo' } };
      }
      throw new RangeError(`fzero: não foi possível achar um intervalo com mudança de sinal em torno de x0 = ${x0}`);
    }
  } else if (Array.isArray(x0) && x0.length === 2) {
    [a, b] = x0;
    if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('x0 deve ser um número ou um intervalo [a, b] de números');
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError('os extremos do intervalo devem ser finitos');
    fa = F(a, 'a'); fb = F(b, 'b');
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) throw new RangeError(`f deve ser finita nos extremos do intervalo (f(a) = ${fa}, f(b) = ${fb})`);
    if (fa !== 0 && fb !== 0 && pos0(fa) === pos0(fb)) {
      throw new RangeError(`f(a) e f(b) devem ter sinais opostos (f(${a}) = ${fa}, f(${b}) = ${fb})`);
    }
  } else {
    throw new TypeError('x0 deve ser um número ou um intervalo [a, b] de números');
  }

  const fMax0 = Math.max(Math.abs(fa), Math.abs(fb));
  const intervalo = [Math.min(a, b), Math.max(a, b)];

  // Brent–Dekker (porte do algoritmo do fzero do MATLAB)
  let c = a, fc = fa, d = b - a, e = d;
  let iter = 0;
  let esgotou = false;
  while (fb !== 0 && a !== b) {
    if (pos0(fb) === pos0(fc) && fc !== 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    if (iter >= maxIter || funcCount >= maxEvals) { esgotou = true; break; }
    const m = 0.5 * (c - b);
    const toler = 2 * tol * Math.max(Math.abs(b), 1);
    if (Math.abs(m) <= toler || fb === 0) break;
    if (Math.abs(e) < toler || Math.abs(fa) <= Math.abs(fb)) { d = m; e = m; }
    else {
      const s = fb / fa;
      let p, q;
      if (a === c) { p = 2 * m * s; q = 1 - s; }
      else {
        q = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < 3 * m * q - Math.abs(toler * q) && p < Math.abs(0.5 * e * q)) { e = d; d = p / q; }
      else { d = m; e = m; }
    }
    a = b; fa = fb;
    if (Math.abs(d) > toler) b += d;
    else if (b > c) b -= toler;
    else b += toler;
    fb = F(b);
    iter++;
    if (Number.isNaN(fb)) throw new RangeError(`f(${b}) é NaN`);
  }

  let exitflag = 1;
  let message = 'Raiz localizada: intervalo de incerteza dentro de TolX';
  if (esgotou) {
    exitflag = 0;
    message = iter >= maxIter ? 'MaxIter atingido antes de convergir' : 'MaxFunEvals atingido antes de convergir';
  } else if (Math.abs(fb) > fMax0) {
    exitflag = -5;
    message = 'Convergiu para um ponto onde |f| é maior que nos extremos do intervalo inicial: provável descontinuidade (polo), não raiz';
  }
  return { x: b, fval: fb, exitflag, output: { iterations: iter, funcCount, interval: intervalo, message } };
}
