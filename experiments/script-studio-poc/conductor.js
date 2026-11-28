/**
 * EEVL Script Studio · fase 0 · Condutor do modo de depuração.
 *
 * Consome um gerador (o código "gerado" do modo de depuração, `function* main(env, rt)`) que
 * dá `yield <linha>` antes de cada instrução. Módulo puro (sem DOM, sem Worker): roda no Worker
 * e também em Node, o que permite testar a lógica fora do navegador.
 *
 * Protocolo de saída (via opts.emit): { type: 'lines', seq, lines, out? }, { type: 'paused', line },
 * { type: 'done', yields, ms, result }, { type: 'error', name, message, line }.
 * Entrada (método handle): 'pause' | 'step' | 'continue'.
 */
export class Conductor {
  /**
   * @param {Generator} gen gerador já criado (main(env, rt))
   * @param {object} opts
   * @param {(m:object)=>void} opts.emit envia mensagem à página
   * @param {()=>number} [opts.now] relógio em ms (padrão performance.now)
   * @param {(ms:number)=>Promise} [opts.sleep] devolve o controle ao laço de eventos
   * @param {number} [opts.delayMs] atraso por yield (demonstração lenta); 0 = máxima velocidade
   * @param {number} [opts.sliceMs] fatia de consumo entre devoluções de controle
   * @param {number} [opts.flushMs] intervalo máximo entre lotes
   * @param {number} [opts.maxBatch] itens por lote antes de enviar
   * @param {boolean} [opts.quiet] só conta os yields, não envia as linhas (medição)
   * @param {number} [opts.deadlineMs] prazo total; excedido, termina com erro e a linha
   * @param {()=>any} [opts.takeOut] devolve (e limpa) a saída de console acumulada
   */
  constructor(gen, opts) {
    this.gen = gen;
    this.emit = opts.emit;
    this.now = opts.now || (() => performance.now());
    this.sleep = opts.sleep || (ms => new Promise(r => setTimeout(r, ms)));
    this.delayMs = opts.delayMs || 0;
    this.sliceMs = opts.sliceMs ?? 25;
    this.flushMs = opts.flushMs ?? 50;
    this.maxBatch = opts.maxBatch ?? 200;
    this.quiet = !!opts.quiet;
    this.deadlineMs = opts.deadlineMs || 0;
    this.takeOut = opts.takeOut || null;
    this.buf = [];
    this.seq = 0;
    this.yields = 0;
    this.last = null;
    this.state = 'running'; // 'running' | 'paused'
    this.pauseReq = false;
    this.stepReq = false;
    this.wake = null;
    this.lastFlush = 0;
    this.result = undefined;
  }

  /** Mensagens vindas da página. */
  handle(type) {
    if (type === 'pause') {
      if (this.state === 'running') this.pauseReq = true;
    } else if (type === 'step') {
      if (this.state === 'paused') { this.stepReq = true; this.#wakeUp(); } else this.pauseReq = true;
    } else if (type === 'continue') {
      this.pauseReq = false;
      if (this.state === 'paused') { this.state = 'running'; this.#wakeUp(); }
    }
  }

  #wakeUp() { const w = this.wake; this.wake = null; if (w) w(); }

  flush() {
    const out = this.takeOut ? this.takeOut() : null;
    const hasOut = out && out.length;
    if (this.buf.length || hasOut) {
      const m = { type: 'lines', seq: ++this.seq, lines: this.buf };
      if (hasOut) m.out = out;
      this.buf = [];
      this.emit(m);
    }
    this.lastFlush = this.now();
  }

  #advance() {
    const r = this.gen.next();
    if (r.done) { this.result = r.value; return r; }
    this.last = r.value;
    this.yields++;
    if (!this.quiet) this.buf.push(r.value);
    return r;
  }

  async #pausedLoop() {
    this.flush();
    this.state = 'paused';
    this.emit({ type: 'paused', line: this.last });
    while (this.state === 'paused') {
      if (!this.stepReq) await new Promise(r => { this.wake = r; });
      if (this.stepReq) {
        this.stepReq = false;
        if (this.#advance().done) return 'done';
        this.flush();
        this.emit({ type: 'paused', line: this.last });
      }
    }
    return 'run';
  }

  /** Executa até o fim (ou erro). Nunca rejeita: erros viram mensagem 'error'. */
  async run() {
    const t0 = this.now();
    this.lastFlush = t0;
    try {
      let finished = false;
      while (!finished) {
        if (this.pauseReq) {
          this.pauseReq = false;
          if (await this.#pausedLoop() === 'done') break;
        }
        const s0 = this.now();
        let n = 0;
        do {
          if (this.#advance().done) { finished = true; break; }
          n++;
          if (this.delayMs) break;
          if (this.buf.length >= this.maxBatch) this.flush();
          if (this.pauseReq) break;
        } while ((n & 1023) !== 0 || this.now() - s0 < this.sliceMs);
        if (finished) break;
        if (this.deadlineMs && this.now() - t0 > this.deadlineMs) {
          const e = new Error('prazo de execução excedido');
          e.name = 'LimitError';
          e.line = this.last;
          throw e;
        }
        if (this.delayMs || this.now() - this.lastFlush >= this.flushMs) this.flush();
        await this.sleep(this.delayMs);
      }
      this.flush();
      this.emit({ type: 'done', yields: this.yields, ms: this.now() - t0, result: this.result });
    } catch (e) {
      this.flush();
      this.emit({ type: 'error', name: e && e.name, message: String(e && e.message), line: e && e.line != null ? e.line : this.last });
    }
  }
}
