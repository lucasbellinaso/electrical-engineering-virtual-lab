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
