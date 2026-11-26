// UI-only overlay for supplied legacy apps. The protected app.html files stay intact.
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

const protectedNode = node => node.parentElement?.isContentEditable ||
  node.parentElement?.closest('script,style,svg,canvas,math,code,pre,textarea,input,option:not([value]),[contenteditable="true"],[data-legacy-no-translate],.katex') ||
  /prof\.|author|autor|lucas v\./i.test(node.parentElement?.getAttribute('aria-label') || '') ||
  /Prof\. Lucas V\. Bellinaso|PythonSisoDesignApp/i.test(node.nodeValue || '');
const originalAttributes = new WeakMap();

export function translateFrame(frame, language) {
  let doc;
  try { doc = frame.contentDocument; } catch { return; }
  if (!doc?.body) return;
  const ix = language === 'es' ? 1 : 0;
  const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    if (protectedNode(n)) continue;
    const current = n.nodeValue.trim();
    let original = n.__eevlOriginal ?? current;
    if (n.__eevlOriginal && ![original, ...(legacyTranslations[original] || [])].includes(current)) {
      original = current;
      n.__eevlOriginal = current;
    }
    const translated = translateExact(current, original, language, legacyTranslations);
    n.__eevlOriginal = original;
    if (translated !== current) n.nodeValue = n.nodeValue.replace(current, translated);
  }
  for (const el of doc.querySelectorAll('[title],[aria-label],[placeholder]')) {
    let saved = originalAttributes.get(el);
    if (!saved) { saved = new Map(); originalAttributes.set(el, saved); }
    for (const attr of ['title','aria-label','placeholder']) {
      if (!el.hasAttribute(attr)) continue;
      const original = saved.has(attr) ? saved.get(attr) : el.getAttribute(attr);
      saved.set(attr, original);
      if (language === 'pt-BR') el.setAttribute(attr, original);
      else if (legacyTranslations[original]) el.setAttribute(attr, legacyTranslations[original][ix]);
    }
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
    ? 'Traducción parcial al inglés y al español: algunos controles y gráficos siguen en portugués. El original no se modifica; la vista a pantalla completa abre el original en portugués.'
    : language === 'pt-BR'
      ? 'Tradução parcial para inglês e espanhol: alguns controles e gráficos permanecem em português. O original não foi alterado; a tela cheia abre o original em português.'
      : 'Partial English and Spanish translation: some controls and plots remain in Portuguese. The original is unchanged; full-page view opens the Portuguese original.';
}
if (frame) {
  let selected = document.querySelector('#language')?.value || 'en';
  const update = () => { translateFrame(frame, selected); renderCoverage(selected); };
  frame.addEventListener('load', () => {
    update();
    try { new MutationObserver(update).observe(frame.contentDocument.body, {subtree:true, childList:true, characterData:true}); } catch {}
  });
  document.addEventListener('languagechange', () => { selected = document.querySelector('#language')?.value || 'en'; update(); });
  document.querySelector('#language')?.addEventListener('change', event => { selected = event.target.value; update(); });
  if (frame.contentDocument?.readyState === 'complete') update();
}
}
