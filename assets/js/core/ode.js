/*
 * Solvers de EDO com passo adaptativo — módulo puro (ESM, sem DOM, sem dependências).
 * Nomes, opções e retorno no estilo do MATLAB (ode45, ode23, odeset).
 *
 *   ode45(f, tspan, y0, opts) → { t, y, stats }    Dormand–Prince 5(4), 7 estágios, FSAL
 *   ode23(f, tspan, y0, opts) → { t, y, stats }    Bogacki–Shampine 3(2), 4 estágios, FSAL
 *
 * Problema: y′ = f(t, y), y(t0) = y0.
 *   f(t, y)  recebe t (número) e y (number[], cópia que a função pode alterar) e devolve number[] do
 *            mesmo tamanho. Para y0 escalar, f pode devolver um número ou um array de 1 elemento.
 *   tspan    [t0, tf] (tf < t0 integra para trás) ou vetor estritamente monótono com ≥ 3 instantes.
 *   y0       número (sistema escalar) ou number[] não vazio.
 *
 * Retorno: t (number[]) e y (number[][]), com y[k] o estado em t[k] (linhas = instantes, como o
 * [t, y] do MATLAB), mais stats = { nsteps, nfailed, nfevals } (passos aceitos, rejeitados e avaliações de f).
 *   - tspan de 2 elementos: devolve t0, os pontos de cada passo aceito e, entre eles, Refine − 1 pontos
 *     por passo obtidos com a interpolação contínua do método (Refine padrão: 4 no ode45, 1 no ode23).
 *   - tspan com ≥ 3 elementos: devolve exatamente nesses instantes (interpolação densa dentro do passo;
 *     Refine é ignorado). Não limita o passo além de MaxStep.
 *
 * Opções (estilo odeset; todas opcionais):
 *   RelTol 1e-3        tolerância relativa (escalar > 0)
 *   AbsTol 1e-6        tolerância absoluta, escalar ou vetor (uma por componente), > 0
 *   InitialStep        passo inicial (> 0; no sentido de integração). Padrão: estimativa automática do MATLAB
 *   MaxStep            passo máximo (> 0). Padrão |tf − t0|/10
 *   Refine             inteiro ≥ 1, só para tspan de 2 elementos
 *   MaxSteps 1e6       limite de passos (aceitos + rejeitados); excedido → Error (proteção contra laços longos)
 *
 * Controle de erro (como no MATLAB): err = h·‖(F·E) ./ max(max(|y|, |y_novo|), AbsTol/RelTol)‖∞; o passo
 * é aceito se err ≤ RelTol e o próximo passo é h·min(5, 0,8·(RelTol/err)^(1/(p+1))) (limitado inferiormente
 * por 0,1·h; p = ordem do método de menor ordem do par: 4 no ode45, 2 no ode23). O erro local
 * estimado é o do método de ordem menor, mas a solução propagada é a de ordem maior (extrapolação local).
 *
 * Interpolação contínua: ode45 usa a extensão de 4ª ordem de Dormand–Prince (a mesma do ntrp45 do MATLAB);
 * ode23 usa Hermite cúbica com y e f nas duas extremidades do passo (3ª ordem).
 *
 * Erros: TypeError para tipo inválido; RangeError para valor inválido (tspan, y0, opções, dimensão de f,
 * f(t0, y0) não finita); Error se o passo cair abaixo do mínimo representável (16·eps(t)) — a mensagem
 * informa o instante — ou se f deixar de ser finita sem possibilidade de reduzir o passo.
 *
 * Limitações: não há `Events`, `Mass`, `Jacobian`, `NonNegative`, `OutputFcn` nem `Stats`: opções
 * desconhecidas são ignoradas, exceto Events, que lança RangeError. Métodos explícitos: problemas
 * rígidos (stiff) terminam, mas com passos limitados pela estabilidade (não há ode15s/ode23s).
 * Equações com atraso ou algébrico-diferenciais não são suportadas.
 */

const MIN_SUBNORMAL = Number.MIN_VALUE;

/** eps(t): distância de |t| ao próximo double (como eps(t) do MATLAB). */
function spacing(t) {
  const a = Math.abs(t);
  if (a === 0) return MIN_SUBNORMAL;
  return Math.max(2 ** (Math.floor(Math.log2(a)) - 52), MIN_SUBNORMAL);
}

/* ---------------- tabelas dos métodos ---------------- */

const DP = {
  nome: 'ode45', pow: 1 / 5, refine: 4,
  c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
  // linha i−1 = coeficientes a[i][0..i−1] do estágio i (a última linha é b: FSAL)
  A: [
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ],
  E: [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40],
  // extensão contínua de 4ª ordem: BI[j] · [σ, σ², σ³, σ⁴] multiplica h·f_j
  BI: [
    [1, -183 / 64, 37 / 12, -145 / 128],
    [0, 0, 0, 0],
    [0, 1500 / 371, -1000 / 159, 1000 / 371],
    [0, -125 / 32, 125 / 12, -375 / 64],
    [0, 9477 / 3392, -729 / 106, 25515 / 6784],
    [0, -11 / 7, 11 / 3, -55 / 28],
    [0, 3 / 2, -4, 5 / 2],
  ],
  interp(told, h, yold, fs, tq) {
    const s = (tq - told) / h, s2 = s * s, s3 = s2 * s, s4 = s3 * s;
    const y = yold.slice();
    for (let j = 0; j < 7; j++) {
      const b = this.BI[j];
      const w = h * (b[0] * s + b[1] * s2 + b[2] * s3 + b[3] * s4);
      if (w !== 0) for (let i = 0; i < y.length; i++) y[i] += w * fs[j][i];
    }
    return y;
  },
};

const BS = {
  nome: 'ode23', pow: 1 / 3, refine: 1,
  c: [0, 1 / 2, 3 / 4, 1],
  A: [
    [1 / 2],
    [0, 3 / 4],
    [2 / 9, 1 / 3, 4 / 9],
  ],
  E: [-5 / 72, 1 / 12, 1 / 9, -1 / 8],
  interp(told, h, yold, fs, tq, ynew) {
    // Hermite cúbica com (y, f) em ambas as extremidades (f[3] = f(t_novo, y_novo), FSAL)
    const s = (tq - told) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return yold.map((v, i) => h00 * v + h * h10 * fs[0][i] + h01 * ynew[i] + h * h11 * fs[3][i]);
  },
};

/* ---------------- validação ---------------- */

function validaEntradas(nome, f, tspan, y0, opts) {
  if (typeof f !== 'function') throw new TypeError(`${nome}: f deve ser uma função`);
  if (!Array.isArray(tspan) && !(tspan instanceof Float64Array)) throw new TypeError(`${nome}: tspan deve ser um array de números`);
  if (tspan.length < 2) throw new RangeError(`${nome}: tspan deve ter ao menos 2 elementos`);
  for (let i = 0; i < tspan.length; i++) {
    if (typeof tspan[i] !== 'number') throw new TypeError(`${nome}: tspan[${i}] deve ser um número`);
    if (!Number.isFinite(tspan[i])) throw new RangeError(`${nome}: tspan[${i}] deve ser finito`);
  }
  const dir = Math.sign(tspan[1] - tspan[0]);
  if (dir === 0) throw new RangeError(`${nome}: tspan deve ser estritamente monótono (t0 ≠ tf)`);
  for (let i = 1; i < tspan.length; i++) {
    if (Math.sign(tspan[i] - tspan[i - 1]) !== dir) throw new RangeError(`${nome}: tspan deve ser estritamente monótono`);
  }
  let escalar = false;
  let y;
  if (typeof y0 === 'number') { escalar = true; y = [y0]; }
  else if (Array.isArray(y0) || y0 instanceof Float64Array) y = Array.from(y0);
  else throw new TypeError(`${nome}: y0 deve ser um número ou um array de números`);
  if (y.length === 0) throw new RangeError(`${nome}: y0 não pode ser vazio`);
  y.forEach((v, i) => {
    if (typeof v !== 'number') throw new TypeError(`${nome}: y0[${i}] deve ser um número`);
    if (!Number.isFinite(v)) throw new RangeError(`${nome}: y0[${i}] deve ser finito`);
  });
  if (opts === null || typeof opts !== 'object') throw new TypeError(`${nome}: opts deve ser um objeto`);
  if (opts.Events !== undefined) throw new RangeError(`${nome}: a opção Events não é suportada nesta versão`);

  const n = y.length;
  const pos = (v, padrao, rot) => {
    if (v === undefined) return padrao;
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new RangeError(`${nome}: ${rot} deve ser um número finito > 0 (recebido ${v})`);
    return v;
  };
  const rtol = pos(opts.RelTol, 1e-3, 'RelTol');
  let atol;
  if (Array.isArray(opts.AbsTol) || opts.AbsTol instanceof Float64Array) {
    if (opts.AbsTol.length !== n) throw new RangeError(`${nome}: AbsTol vetorial deve ter ${n} elementos (recebido ${opts.AbsTol.length})`);
    atol = Array.from(opts.AbsTol, (v, i) => pos(v, undefined, `AbsTol[${i}]`));
  } else {
    atol = new Array(n).fill(pos(opts.AbsTol, 1e-6, 'AbsTol'));
  }
  const total = Math.abs(tspan[tspan.length - 1] - tspan[0]);
  const hmax = pos(opts.MaxStep, total / 10, 'MaxStep');
  const h0 = opts.InitialStep === undefined ? undefined : pos(opts.InitialStep, undefined, 'InitialStep');
  let refine = opts.Refine === undefined ? undefined : opts.Refine;
  if (refine !== undefined && (!Number.isInteger(refine) || refine < 1)) throw new RangeError(`${nome}: Refine deve ser inteiro ≥ 1 (recebido ${refine})`);
  const maxSteps = pos(opts.MaxSteps, 1e6, 'MaxSteps');
  return { escalar, y, n, rtol, atol, hmax, h0, refine, maxSteps, dir };
}

/* ---------------- integrador genérico ---------------- */

function integra(M, f, tspan, y0, opts = {}) {
  const v = validaEntradas(M.nome, f, tspan, y0, opts);
  const { n, rtol, atol, hmax, maxSteps } = v;
  const thr = atol.map((a) => a / rtol);
  const tdir = v.dir;
  const t0 = tspan[0], tfinal = tspan[tspan.length - 1];
  const densa = tspan.length > 2;
  const refine = v.refine === undefined ? M.refine : v.refine;
  const pow = M.pow;
  const ns = M.c.length;

  let nfevals = 0;
  const F = (t, y) => {
    nfevals++;
    let r = f(t, y.slice());
    if (typeof r === 'number' && n === 1) r = [r];
    if (!Array.isArray(r) && !(r instanceof Float64Array)) throw new TypeError(`${M.nome}: f deve devolver um array de números`);
    if (r.length !== n) throw new RangeError(`${M.nome}: f deve devolver ${n} componentes, devolveu ${r.length}`);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      if (typeof r[i] !== 'number') throw new TypeError(`${M.nome}: f(t, y)[${i}] deve ser um número`);
      out[i] = r[i];
    }
    return out;
  };

  let t = t0;
  let y = v.y.slice();
  let f1 = F(t, y);
  if (!f1.every(Number.isFinite)) throw new RangeError(`${M.nome}: f(t0, y0) não é finita`);

  const tout = [t0];
  const yout = [y.slice()];
  let kk = 1;   // próximo índice de tspan a devolver (modo denso)

  // passo inicial (algoritmo do MATLAB)
  let hmin = 16 * spacing(t);
  let absh = Math.min(hmax, Math.abs(tfinal - t0));
  if (v.h0 !== undefined) {
    absh = Math.min(hmax, Math.max(hmin, v.h0));
  } else {
    let nrm = 0;
    for (let i = 0; i < n; i++) nrm = Math.max(nrm, Math.abs(f1[i]) / Math.max(Math.abs(y[i]), thr[i]));
    const rh = nrm / (0.8 * rtol ** pow);
    if (absh * rh > 1) absh = 1 / rh;
    absh = Math.max(absh, hmin);
  }

  let nsteps = 0, nfailed = 0;
  let done = false;
  while (!done) {
    hmin = 16 * spacing(t);
    absh = Math.min(hmax, Math.max(hmin, absh));
    let h = tdir * absh;
    if (1.1 * absh >= Math.abs(tfinal - t)) { h = tfinal - t; absh = Math.abs(h); done = true; }

    let nofailed = true;
    let tnew, ynew, fs, err;
    for (;;) {
      if (nsteps + nfailed >= maxSteps) throw new Error(`${M.nome}: número máximo de passos (MaxSteps = ${maxSteps}) atingido em t = ${t}`);
      tnew = done ? tfinal : t + h;
      h = tnew - t;
      fs = [f1];
      for (let i = 1; i < ns; i++) {
        const a = M.A[i - 1];
        const yi = y.slice();
        for (let j = 0; j < i; j++) {
          const w = h * a[j];
          if (w !== 0) for (let k = 0; k < n; k++) yi[k] += w * fs[j][k];
        }
        if (i === ns - 1) ynew = yi;
        fs.push(F(i === ns - 1 ? tnew : t + M.c[i] * h, yi));
      }
      // estimativa de erro
      err = 0;
      for (let k = 0; k < n; k++) {
        let s = 0;
        for (let j = 0; j < ns; j++) s += fs[j][k] * M.E[j];
        const wt = Math.max(Math.max(Math.abs(y[k]), Math.abs(ynew[k])), thr[k]);
        err = Math.max(err, Math.abs(s) / wt);
      }
      err *= absh;
      if (err <= rtol) break;   // aceito (NaN cai em rejeição)

      nfailed++;
      if (absh <= hmin) {
        throw new Error(`${M.nome}: falha de integração em t = ${t}: o passo ficou menor que o mínimo representável (${hmin}); `
          + 'a solução pode ter singularidade ou f deixou de ser finita');
      }
      if (nofailed) {
        nofailed = false;
        const fator = Number.isFinite(err) ? Math.max(0.1, 0.8 * (rtol / err) ** pow) : 0.1;
        absh = Math.max(hmin, absh * fator);
      } else {
        absh = Math.max(hmin, 0.5 * absh);
      }
      h = tdir * absh;
      done = false;
    }
    nsteps++;

    // saída
    if (!densa) {
      for (let i = 1; i < refine; i++) {
        const tq = t + (tnew - t) * i / refine;
        tout.push(tq); yout.push(M.interp(t, h, y, fs, tq, ynew));
      }
      tout.push(tnew); yout.push(ynew.slice());
    } else {
      while (kk < tspan.length && tdir * (tspan[kk] - tnew) <= 0) {
        const tq = tspan[kk];
        tout.push(tq);
        yout.push(tq === tnew ? ynew.slice() : M.interp(t, h, y, fs, tq, ynew));
        kk++;
      }
    }

    // próximo passo
    if (nofailed) {
      const temp = 1.25 * (err / rtol) ** pow;
      absh = temp > 0.2 ? absh / temp : 5 * absh;
    }
    t = tnew; y = ynew; f1 = fs[ns - 1];
  }

  return { t: tout, y: yout, stats: { nsteps, nfailed, nfevals } };
}

/**
 * Dormand–Prince 5(4) com passo adaptativo (≈ ode45 do MATLAB).
 * @param {(t:number, y:number[])=>number[]} f
 * @param {number[]} tspan  [t0, tf] ou instantes estritamente monótonos
 * @param {number|number[]} y0
 * @param {{RelTol?:number, AbsTol?:number|number[], InitialStep?:number, MaxStep?:number, Refine?:number, MaxSteps?:number}} [opts]
 * @returns {{t:number[], y:number[][], stats:{nsteps:number, nfailed:number, nfevals:number}}}
 */
export function ode45(f, tspan, y0, opts = {}) { return integra(DP, f, tspan, y0, opts); }

/**
 * Bogacki–Shampine 3(2) com passo adaptativo (≈ ode23 do MATLAB); mesmo contrato de ode45.
 * Mais eficiente com tolerâncias frouxas e problemas levemente rígidos.
 */
export function ode23(f, tspan, y0, opts = {}) { return integra(BS, f, tspan, y0, opts); }
