// UI-only overlay for supplied legacy apps. The protected app.html files stay intact.
import {messages as sisoMessages, patterns as sisoPatterns} from './legacy-locales/siso.js';
import {messages as powerMessages, patterns as powerPatterns} from './legacy-locales/power.js';
import {messages as opampMessages, patterns as opampPatterns} from './legacy-locales/opamp-pid.js';
import {installPresentationHooks, redrawPresentation} from './legacy-runtime.js';
export function translateExact(value, original, language, translations) {
  const variants = translations[original];
  if (!variants || ![original, ...variants].includes(value)) return value;
  return language === 'pt-BR' ? original : variants[language === 'es' ? 1 : 0];
}
export const legacyTranslations = {
  'Restaurar valores': ['Restore values', 'Restaurar valores'],
  'Restaurar padrões': ['Restore defaults', 'Restaurar valores predeterminados'],
  'Restaurar parâmetros': ['Restore parameters', 'Restaurar parámetros'],
  'Simular': ['Simulate', 'Simular'],
  'Reiniciar': ['Restart', 'Reiniciar'],
  'Pausar': ['Pause', 'Pausar'],
  'Exportar CSV': ['Export CSV', 'Exportar CSV'],
  'Resultados médios por período': ['Period-averaged results', 'Resultados medios por período'],
  'Resposta dinâmica': ['Dynamic response', 'Respuesta dinámica'],
  'Visualização': ['View', 'Vista'],
  'Médias por período': ['Period averages', 'Promedios por período'],
  'Modelo e hipóteses': ['Model and assumptions', 'Modelo e hipótesis'],
  'Parâmetros elétricos': ['Electrical parameters', 'Parámetros eléctricos'],
  'Modulação antes e depois do degrau': ['Modulation before and after the step', 'Modulación antes y después del escalón'],
  'Modelo matemático': ['Mathematical model', 'Modelo matemático'],
  'Modelo chaveado ideal (CCM/DCM) e modelo médio (CCM). Condição inicial em regime permanente.': ['Ideal switched model (CCM/DCM) and averaged model (CCM). Initial condition at steady state.', 'Modelo conmutado ideal (CCM/DCM) y modelo promediado (CCM). Condición inicial en régimen permanente.'],
  'Simulador chaveado interativo • CCM e DCM • Componentes ideais': ['Interactive switched simulator • CCM and DCM • Ideal components', 'Simulador conmutado interactivo • CCM y DCM • Componentes ideales'],
  'Conversor Buck': ['Buck converter', 'Convertidor Buck'],
  'Simulador Buck': ['Buck simulator', 'Simulador Buck'],
  'Buck — Degrau de razão cíclica': ['Buck — Duty-cycle step', 'Buck — Escalón del ciclo de trabajo'],
  'DAB dinâmico': ['Dynamic DAB', 'DAB dinámico'],
  'DAB · interface bidirecional com bateria': ['DAB · bidirectional battery interface', 'DAB · interfaz bidireccional con batería'],
  'Modelo chaveado com perdas ôhmicas e dinâmica do capacitor de saída.': ['Switched model with ohmic losses and output-capacitor dynamics.', 'Modelo conmutado con pérdidas óhmicas y dinámica del condensador de salida.'],
  'Laboratório de amplificadores operacionais': ['Operational amplifier laboratory', 'Laboratorio de amplificadores operacionales'],
  'Laboratório virtual de amp-ops': ['Virtual op-amp laboratory', 'Laboratorio virtual de amplificadores operacionales'],
  'Modelos ideais • análise temporal e em frequência': ['Ideal models • time and frequency analysis', 'Modelos ideales • análisis temporal y en frecuencia'],
  'Topologia': ['Topology', 'Topología'],
  'Sinais e alimentação': ['Signals and power supplies', 'Señales y alimentación'],
  'Resposta temporal': ['Time response', 'Respuesta temporal'],
  'Entrada 1': ['Input 1', 'Entrada 1'],
  '• Saída': ['• Output', '• Salida'],
  '• Entrada 2 (quando aplicável)': ['• Input 2 (when applicable)', '• Entrada 2 (cuando corresponda)'],
  'Diagrama de Bode — pequeno sinal': ['Bode plot — small signal', 'Diagrama de Bode — pequeña señal'],
  'Resposta linear da entrada 1, sem saturação; entrada 2 nula.': ['Linear response to input 1, without saturation; input 2 is zero.', 'Respuesta lineal de la entrada 1, sin saturación; entrada 2 nula.'],
  'Conversor Buck com controle PID': ['Buck converter with PID control', 'Convertidor Buck con control PID'],
  'Buck com PID': ['Buck with PID', 'Buck con PID'],
  'Simulação chaveada em tempo real: PWM, diodo, modo descontínuo e PID digital amostrado a cada período.': ['Real-time switched simulation: PWM, diode, discontinuous mode and digital PID sampled once per period.', 'Simulación conmutada en tiempo real: PWM, diodo, modo discontinuo y PID digital muestreado cada período.'],
  'Vout média': ['Average Vout', 'Vout promedio'],
  'Ripple Vout': ['Vout ripple', 'Rizado de Vout'],
  'iL média': ['Average iL', 'iL promedio'],
  'Razão cíclica': ['Duty cycle', 'Ciclo de trabajo'],
  'Modo': ['Mode', 'Modo'],
  'Velocidade': ['Speed', 'Velocidad'],
  'Janela': ['Window', 'Ventana'],
  'Perturbações': ['Disturbances', 'Perturbaciones'],
  'Carga': ['Load', 'Carga'],
  'Referência': ['Reference', 'Referencia'],
  'Entrada': ['Input', 'Entrada'],
  'Toque de novo para voltar ao valor original.': ['Select again to restore the original value.', 'Pulsa de nuevo para volver al valor original.'],
  'Controlador': ['Controller', 'Controlador'],
  'Malha aberta (razão cíclica fixa)': ['Open loop (fixed duty cycle)', 'Lazo abierto (ciclo de trabajo fijo)'],
  'Padrão': ['Default', 'Predeterminado'],
  'Agressivo': ['Aggressive', 'Agresivo'],
  'Lento': ['Slow', 'Lento'],
  'Só PI': ['PI only', 'Solo PI'],
  'Modelo': ['Model', 'Modelo'],
  'Chaveado': ['Switched', 'Conmutado'],
  'Médio CCM': ['CCM averaged', 'Promediado CCM'],
  'Simulador chaveado interativo • CCM e DCM • Componentes ideais': ['Interactive switched simulator • CCM and DCM • Ideal components', 'Simulador conmutado interactivo • CCM y DCM • Componentes ideales'],
  'SISO Design App': ['SISO Design App', 'SISO Design App'],
  'Projeto de controladores SISO': ['SISO controller design', 'Diseño de controladores SISO'],
  'Frequência em': ['Frequency in', 'Frecuencia en'],
  'Copiar link da configuração': ['Copy configuration link', 'Copiar enlace de configuración'],
  'Planta': ['Plant', 'Planta'],
  'Requisitos': ['Requirements', 'Requisitos'],
  'Distúrbios': ['Disturbances', 'Perturbaciones'],
  'Resultados': ['Results', 'Resultados'],
  'Exemplo': ['Example', 'Ejemplo'],
  '— escolher um exemplo —': ['— choose an example —', '— elegir un ejemplo —'],
  'Domínio': ['Domain', 'Dominio'],
  'Contínuo, G(s)': ['Continuous, G(s)', 'Continuo, G(s)'],
  'Discreto, G(z) direto': ['Discrete, direct G(z)', 'Discreto, G(z) directo'],
  'Amostragem T': ['Sampling T', 'Muestreo T'],
  'Numerador': ['Numerator', 'Numerador'],
  'Denominador': ['Denominator', 'Denominador'],
  'Atraso (s)': ['Delay (s)', 'Retardo (s)'],
  'Ordem de Padé': ['Padé order', 'Orden de Padé'],
  'Ganho K': ['Gain K', 'Ganancia K'],
  'Limpar controlador': ['Clear controller', 'Borrar controlador'],
  'Sobressinal máx. (%)': ['Maximum overshoot (%)', 'Sobreimpulso máximo (%)'],
  'Tempo de subida máx. (s)': ['Maximum rise time (s)', 'Tiempo de subida máximo (s)'],
  'Tempo de acomodação máx. (s)': ['Maximum settling time (s)', 'Tiempo de establecimiento máximo (s)'],
  'Tempo final do degrau (s)': ['Step end time (s)', 'Tiempo final del escalón (s)'],
  'Tempo total (s)': ['Total time (s)', 'Tiempo total (s)'],
  'Passo (s)': ['Step size (s)', 'Paso (s)'],
  'Ajustar tempo ao sistema': ['Fit time to system', 'Ajustar tiempo al sistema'],
  'Sinal': ['Signal', 'Señal'],
  'Freq (Hz)': ['Freq (Hz)', 'Frec. (Hz)'],
  'Tempos (s)': ['Times (s)', 'Tiempos (s)'],
  'Amplitudes': ['Amplitudes', 'Amplitudes'],
  'Máx dA/dt': ['Max dA/dt', 'Máx. dA/dt'],
  'Polos de malha fechada': ['Closed-loop poles', 'Polos de lazo cerrado'],
  'Código MATLAB': ['MATLAB code', 'Código MATLAB'],
  'Código Python (python-control)': ['Python code (python-control)', 'Código Python (python-control)'],
  'Copiar MATLAB': ['Copy MATLAB', 'Copiar MATLAB'],
  'Copiar Python': ['Copy Python', 'Copiar Python'],
  '1 ms/s': ['1 ms/s', '1 ms/s'], '5 ms/s': ['5 ms/s', '5 ms/s'], '20 ms/s': ['20 ms/s', '20 ms/s'], '50 ms/s': ['50 ms/s', '50 ms/s'], '100 ms/s': ['100 ms/s', '100 ms/s'],
  '0,5 ms': ['0.5 ms', '0,5 ms'], '2 ms': ['2 ms', '2 ms'], '10 ms': ['10 ms', '10 ms'], '20 ms': ['20 ms', '20 ms'], '50 ms': ['50 ms', '50 ms'],
  'Ponte 1': ['Bridge 1', 'Puente 1'], 'Ponte 2': ['Bridge 2', 'Puente 2'], 'Centro da janela (ms)': ['Window center (ms)', 'Centro de la ventana (ms)'], 'Períodos na janela': ['Periods in window', 'Períodos en la ventana'],
  'Malha aberta T = G': ['Open-loop T = G', 'Lazo abierto T = G']
  ,'Tensão de entrada': ['Input voltage', 'Tensión de entrada']
  ,'Indutância': ['Inductance', 'Inductancia']
  ,'Capacitância': ['Capacitance', 'Capacitancia']
  ,'Frequência': ['Frequency', 'Frecuencia']
  ,'Frequência de comutação': ['Switching frequency', 'Frecuencia de conmutación']
  ,'Resistência de carga': ['Load resistance', 'Resistencia de carga']
  ,'Comando do interruptor': ['Switch command', 'Comando del interruptor']
  ,'Tensão no nó de comutação': ['Switch-node voltage', 'Tensión en el nodo de conmutación']
  ,'Corrente no indutor': ['Inductor current', 'Corriente del inductor']
  ,'Tensão de saída': ['Output voltage', 'Tensión de salida']
  ,'Modo de condução': ['Conduction mode', 'Modo de conducción']
  ,'Tensão média': ['Average voltage', 'Tensión media']
  ,'Corrente média': ['Average current', 'Corriente media']
  ,'Ondulação de corrente': ['Current ripple', 'Rizado de corriente']
  ,'Ondulação de tensão': ['Voltage ripple', 'Rizado de tensión']
  ,'Potência na carga': ['Load power', 'Potencia de carga']
  ,'Indutância crítica': ['Critical inductance', 'Inductancia crítica']
  ,'Regime permanente': ['Steady state', 'Régimen permanente']
  ,'Convergido': ['Converged', 'Convergido']
  ,'Não confirmado': ['Unconfirmed', 'No confirmado']
  ,'Ver transitório': ['Show transient response', 'Ver respuesta transitoria']
  ,'Ver regime permanente': ['Show steady state', 'Ver régimen permanente']
  ,'Limpar': ['Clear', 'Limpiar']
  ,'Fase': ['Phase', 'Fase']
  ,'Ganho': ['Gain', 'Ganancia']
  ,'Potência': ['Power', 'Potencia']
  ,'Tensão': ['Voltage', 'Tensión']
  ,'Corrente': ['Current', 'Corriente']
  ,'Amplitude': ['Amplitude', 'Amplitud']
  ,'Frequência (Hz)': ['Frequency (Hz)', 'Frecuencia (Hz)']
  ,'Restaurar': ['Restore', 'Restaurar']
  ,'Restaurar configurações': ['Restore settings', 'Restaurar configuración']
  ,'Componentes ideais': ['Ideal components', 'Componentes ideales']
  ,'Carga resistiva': ['Resistive load', 'Carga resistiva']
  ,'Malha aberta': ['Open loop', 'Lazo abierto']
  ,'Erro': ['Error', 'Error']
  ,'Link copiado!': ['Link copied!', '¡Enlace copiado!']
  ,'Copiado!': ['Copied!', '¡Copiado!']
};

Object.assign(legacyTranslations, sisoMessages, powerMessages, opampMessages);
const exactMessages = Object.fromEntries(Object.entries(legacyTranslations).map(([key, values]) => [key.trim(), values.map(value => value.trim())]));
const attributionText = new Set(Object.entries(exactMessages)
  .filter(([key]) => /Prof\. Lucas V\. Bellinaso|PythonSisoDesignApp/i.test(key))
  .flatMap(([key, values]) => [key, ...values]));
const patterns = [...sisoPatterns, ...powerPatterns, ...opampPatterns].map(item => ({...item, regex:new RegExp(item.source)}));

export function translateText(value, language, depth = 0) {
  if (typeof value !== 'string' || language === 'pt-BR') return value;
  const text = value.trim(), index = language === 'es' ? 1 : 0;
  let translated = exactMessages[text]?.[index];
  if (translated === undefined) {
    for (const item of patterns) {
      if (!item.regex.test(text)) continue;
      const replacement = item[language === 'es' ? 'es' : 'en'];
      // Only known error wrappers contain another translatable message. Parser
      // excerpts and numeric/formula captures in other patterns stay verbatim.
      if (item.source.startsWith('^Erro ') && depth < 3) {
        const match = item.regex.exec(text);
        translated = replacement.replace(/\$(\d+)/g, (_, number) => translateText(match[Number(number)] ?? '', language, depth + 1));
      } else translated = text.replace(item.regex, replacement);
      break;
    }
  }
  if (translated !== undefined) return value.replace(text, () => translated);
  // Appended status lines are independent messages; preserve line boundaries.
  if (value.includes('\n')) return value.split('\n').map(line => translateText(line, language)).join('\n');
  return value;
}

const protectedNode = node => node.parentElement?.isContentEditable ||
  node.parentElement?.closest('script,style,canvas,math,code,pre,textarea,input,option:not([value]),[contenteditable="true"],[data-legacy-no-translate],.katex') ||
  /prof\.|author|autor|lucas v\./i.test(node.parentElement?.getAttribute('aria-label') || '') ||
  (/Prof\. Lucas V\. Bellinaso|PythonSisoDesignApp/i.test(node.nodeValue || '') && !attributionText.has(node.nodeValue?.trim()));
const originalAttributes = new WeakMap();
const originalText = new WeakMap();

function sourceText(saved, current, translate = translateText) {
  if (!saved || !['pt-BR','en','es'].some(code => translate(saved, code) === current)) return current;
  return saved;
}

export function translateFrame(frame, language) {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc?.body) return;
  const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (protectedNode(n)) continue;
    const current = n.nodeValue;
    // This single Portuguese range separator is prose, not the variable a.
    const localTranslate = (value, code) => value.trim() === 'a' && n.parentElement?.closest('.gainbox')
      ? value.replace('a', code === 'en' ? 'to' : 'a') : translateText(value, code);
    const original = sourceText(originalText.get(n), current, localTranslate);
    originalText.set(n, original);
    const translated = localTranslate(original, language);
    if (translated !== current) n.nodeValue = translated;
  }
  for (const el of doc.querySelectorAll('[title],[aria-label],[placeholder],[alt],[data-title]')) {
    let saved = originalAttributes.get(el);
    if (!saved) { saved = new Map(); originalAttributes.set(el, saved); }
    for (const attr of ['title','aria-label','placeholder','alt','data-title']) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      const original = sourceText(saved.get(attr), current);
      saved.set(attr, original);
      const translated = translateText(original, language);
      if (translated !== current) el.setAttribute(attr, translated);
    }
  }
  if (doc.title) {
    const original = sourceText(originalText.get(doc), doc.title);
    originalText.set(doc, original);
    doc.title = translateText(original, language);
  }
  if (doc.documentElement) doc.documentElement.lang = language;
  for (const code of doc.querySelectorAll('pre,code')) {
    if (code.getAttribute('lang') !== 'pt-BR') code.setAttribute('lang','pt-BR');
  }
}

if (typeof document !== 'undefined') {
const frame = document.querySelector('iframe.legacy-frame');
function renderCoverage(language) {
  const sourceNotice = document.querySelector('.notice');
  if (!sourceNotice) return;
  let notice = document.querySelector('[data-legacy-coverage]');
  if (!notice) {
    notice = document.createElement('p');
    notice.className = 'notice';
    notice.dataset.legacyCoverage = '';
    sourceNotice.insertAdjacentElement('afterend', notice);
  }
  notice.textContent = language === 'es'
    ? 'Vista previa EN/ES: controles, ayuda, gráficos y mensajes traducidos mediante una capa independiente. El archivo original y el código exportado se conservan. La página completa abre el original en portugués.'
    : language === 'pt-BR'
      ? 'Prévia EN/ES: controles, ajuda, gráficos e mensagens traduzidos por uma camada independente. O arquivo original e o código exportado são preservados. A página inteira abre o original em português.'
      : 'EN/ES preview: controls, help, plots and messages are translated by an independent layer. The original file and exported code are preserved. Full-page view opens the Portuguese original.';
}
if (frame) {
  let selected = document.querySelector('#language')?.value || 'en';
  const update = () => {
    translateFrame(frame, selected);
    frame.title = {'pt-BR':'Simulador legado · Português',en:'Legacy simulator · English',es:'Simulador legado · Español'}[selected];
    renderCoverage(selected);
  };
  let observedDocument, observer;
  const setup = () => {
    const doc = frame.contentDocument, win = frame.contentWindow;
    if (!doc?.body || !win) return;
    installPresentationHooks(win, text => translateText(text, selected));
    update();
    if (observedDocument !== doc) {
      observer?.disconnect();
      let queued = false;
      observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
      });
      observer.observe(doc.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt','data-title']});
      observedDocument = doc;
    }
    redrawPresentation(win);
  };
  frame.addEventListener('load', setup);
  document.addEventListener('languagechange', () => {
    selected = document.querySelector('#language')?.value || 'en';
    setup();
  });
  if (frame.contentDocument?.readyState === 'complete') setup();
}
}
