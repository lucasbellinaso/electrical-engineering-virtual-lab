import { initialize } from '../../../assets/js/common.js';
import { language } from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import { LIMITS, PRESETS, polar, omegaOf, solvePhasorCircuit, symbolicTerms } from './model.js';
import { symbolicSystemLatex, numericSystemLatex, kclRowsLatex } from './latex.js';

const TEXT = {
  en: {
    docTitle: 'Phasor Nodal Analysis · EEVL',
    typeLabel: 'Type',
    eyebrow: 'EEVL / ELECTRICAL CIRCUITS / PHASOR NODAL ANALYSIS · v1.0.0',
    title: 'Nodal Analysis in Sinusoidal Steady State',
    desc: 'Build linear AC circuits with R, L, C and sinusoidal sources at one frequency. Compute node-voltage and branch-current phasors, complex power and the complex nodal / MNA system.',
    badge: 'Analytically verified · phasors & MNA',
    configHeading: 'Circuit editor',
    presetsLabel: 'Examples',
    presets: {
      'rc-lowpass': '2 nodes · RC low-pass',
      'rl-highpass': '2 nodes · RL high-pass',
      'series-resonance': '3 nodes · Series RLC resonance',
      'parallel-resonance': '2 nodes · Parallel RLC resonance',
      'rc-two-stage': '3 nodes · Two-stage RC filter',
      'two-sources-phase': '3 nodes · Two sources with phase'
    },
    presetDescriptions: {
      'rc-lowpass': 'At the corner frequency the output is V/√2 ∠ −45°.',
      'rl-highpass': 'At the corner frequency the resistor voltage is V/√2 ∠ −45°.',
      'series-resonance': 'At f₀ the current is V/R in phase; V_C and V_L reach Q·V.',
      'parallel-resonance': 'At f₀ the L and C currents cancel: the tank behaves as an open circuit.',
      'rc-two-stage': 'Cascaded sections: the second stage loads the first.',
      'two-sources-phase': 'Two 120 V sources 30° apart feeding an inductor through resistors.'
    },
    frequencyLabel: 'Frequency f (Hz)',
    omegaReadout: 'ω = 2πf = {omega} rad/s',
    nodeCountLabel: 'Non-reference nodes (excluding GND = 0)',
    nodeOptions: [
      { value: 2, label: '2 (Nodes 1, 2)' },
      { value: 3, label: '3 (Nodes 1, 2, 3)' },
      { value: 4, label: '4 (Nodes 1 … 4)' },
      { value: 5, label: '5 (Nodes 1 … 5)' }
    ],
    componentsLabel: 'Components',
    compCount: '{n} / {max}',
    conventionHint: 'Amplitudes are peak values. I: reference current From → To. V: (+) at From, (−) at To; phase in degrees. Node 0 is GND.',
    fromNode: 'From',
    toNode: 'To',
    gndOption: '0 (GND)',
    nodeOption: 'Node {n}',
    valueLabel: 'Value',
    phaseLabel: 'Phase (°)',
    removeTitle: 'Remove component',
    typeOptions: { R: 'R (Ω)', L: 'L (mH)', C: 'C (µF)', I: 'I (A)', V: 'V (V)' },
    solveBtn: 'Solve circuit',
    resetBtn: 'Reset',
    resultsHeading: 'Schematic & phasor solution',
    exportCsv: 'Export CSV',
    exportSvg: 'Export SVG',
    exportPng: 'Export PNG',
    shareBtn: 'Copy configuration link',
    shareUrlLabel: 'Configuration URL',
    copied: 'Configuration link copied.',
    copyFallback: 'Copy the URL shown below.',
    exportError: 'Export failed. Try exporting SVG instead.',
    queryError: 'URL configuration is invalid. Default circuit restored.',
    solvedStatus: 'Solved {nodes} node(s), {branches} branch(es) at ω = {omega} rad/s · Max KCL residual: {kcl} A · Power balance diff: {pdiff} VA.',
    schTitle: 'AC circuit schematic with node-voltage and branch-current phasors',
    schDesc: 'SVG diagram showing nodes 0 to N, components, node-voltage phasors and branch-current phasors with their reference direction.',
    totalActive: 'Active power in resistors',
    totalInductive: 'Reactive power in inductors',
    totalCapacitive: 'Reactive power in capacitors',
    totalSupplied: 'Complex power from sources',
    maxKcl: 'Max KCL residual',
    matrixHeading: 'System of nodal equations (complex)',
    matrixSubtitle: 'Complex nodal / MNA system. Top: written with the circuit elements. Bottom: with numbers (j = √−1, phasors in rectangular form, peak values).',
    matrixLegend: 'Each row is KCL at a node: the diagonal sums the admittances of the elements touching the node (1/R, 1/(jωL), jωC), the off-diagonal entries are minus the admittance between two nodes, ±1 marks the terminals of voltage sources (+ at From, − at To), and the right side holds source current phasors (entering the node +, leaving −) and source voltage phasors.',
    kclSummary: 'Node-by-node KCL equations (leaving current = 0)',
    branchSummary: 'Branch phasors and complex power',
    branchHeaders: ['ID', 'Type', 'From → To', 'Value', 'V_from − V_to  (V, ∠°)', 'Current From → To  (A, ∠°)', 'P (W)', 'Q (var)'],
    typeNames: { R: 'Resistor', L: 'Inductor', C: 'Capacitor', I: 'Current src', V: 'Voltage src' },
    docEqTitle: 'Equations & conventions',
    docEqText: 'In sinusoidal steady state every voltage and current is x(t) = |X| cos(ωt + φ) and is represented by the peak phasor X = |X|∠φ. Elements become admittances: Y_R = 1/R, Y_L = 1/(jωL), Y_C = jωC. KCL at each non-reference node gives the complex linear system below; voltage sources add auxiliary branch-current unknowns (modified nodal analysis). For an element with voltage drop ΔV (From − To) and current I (From → To), the absorbed complex power is S = ½·ΔV·I*, with P = Re S (W) and Q = Im S (var). Tellegen\'s theorem gives ΣS = 0 over all elements.',
    docMethodTitle: 'Numerical method',
    docMethodText: 'The complex system is assembled in IEEE-754 double precision and solved by Gaussian elimination with partial pivoting. A pivot smaller than 10⁻¹² of the largest matrix entry is reported as a singular circuit (voltage-source loops, nodes with only current sources). Public units: Ω, mH, µF, V, A (peak), degrees, Hz; internal calculations are in SI.',
    docLimitsTitle: 'Assumptions & limitations',
    docLimitsText: 'Linear time-invariant circuit with ideal lumped elements, all sources at the same single frequency (f from 0.001 Hz to 1 GHz). DC is not covered (use the resistive nodal-analysis lab). No transients, mutual inductance, dependent sources, nonlinear devices, component losses or tolerances. At most 5 non-reference nodes and 24 components.',
    docRefTitle: 'References & validation',
    docRefText: 'Formulation based on Ho, Ruehli & Brennan (1975), "The Modified Nodal Approach to Network Analysis", IEEE Trans. Circuits and Systems, and standard circuit-analysis texts. Analytical verification evidence (corner frequency, resonance, Tellegen balance, scaling, reduction to the resistive case):',
    validationLink: 'docs/validation/nodal-analysis-ac.md ↗',
    errors: {
      INVALID_CIRCUIT: 'Invalid circuit configuration.',
      INVALID_NODE_COUNT: 'Node count must be between 2 and 5.',
      INVALID_FREQUENCY: 'Frequency must be between 0.001 Hz and 10⁹ Hz.',
      INVALID_COMPONENT_COUNT: 'Add between 1 and 24 components.',
      INVALID_COMPONENT: 'Invalid component entry.',
      INVALID_TYPE: 'Unsupported component type.',
      INVALID_NODE: 'Component references an invalid node.',
      SELF_LOOP: 'A component cannot connect a node to itself.',
      NON_FINITE_VALUE: 'All component values must be finite numbers.',
      RESISTANCE_RANGE: 'Resistance must be between 0.001 Ω and 10⁹ Ω.',
      INDUCTANCE_RANGE: 'Inductance must be between 0.001 mH and 10⁶ mH.',
      CAPACITANCE_RANGE: 'Capacitance must be between 0.001 µF and 10⁶ µF.',
      CURRENT_RANGE: 'Current source must be between −10⁴ A and 10⁴ A.',
      VOLTAGE_RANGE: 'Voltage source must be between −10⁴ V and 10⁴ V.',
      INVALID_PHASE: 'Source phase must be between −360° and 360°.',
      DISCONNECTED_NODE: 'Every node needs a path to ground through R, L, C or voltage sources (not only current sources).',
      SINGULAR_SYSTEM: 'Singular circuit matrix: check for voltage-source loops or nodes without a path to ground.'
    }
  },
  'pt-BR': {
    docTitle: 'Análise Nodal Fasorial · EEVL',
    typeLabel: 'Tipo',
    eyebrow: 'EEVL / CIRCUITOS ELÉTRICOS / ANÁLISE NODAL FASORIAL · v1.0.0',
    title: 'Análise Nodal em Regime Permanente Senoidal',
    desc: 'Monte circuitos CA lineares com R, L, C e fontes senoidais em uma frequência. Calcule fasores de tensão nodal e corrente de ramo, potência complexa e o sistema nodal / MNA complexo.',
    badge: 'Analiticamente verificado · fasores e MNA',
    configHeading: 'Editor de circuito',
    presetsLabel: 'Exemplos',
    presets: {
      'rc-lowpass': '2 nós · Passa-baixas RC',
      'rl-highpass': '2 nós · Passa-altas RL',
      'series-resonance': '3 nós · Ressonância RLC série',
      'parallel-resonance': '2 nós · Ressonância RLC paralelo',
      'rc-two-stage': '3 nós · Filtro RC de dois estágios',
      'two-sources-phase': '3 nós · Duas fontes com fase'
    },
    presetDescriptions: {
      'rc-lowpass': 'Na frequência de corte a saída é V/√2 ∠ −45°.',
      'rl-highpass': 'Na frequência de corte a tensão no resistor é V/√2 ∠ −45°.',
      'series-resonance': 'Em f₀ a corrente é V/R em fase; V_C e V_L chegam a Q·V.',
      'parallel-resonance': 'Em f₀ as correntes de L e C se cancelam: o tanque se comporta como circuito aberto.',
      'rc-two-stage': 'Seções em cascata: o segundo estágio carrega o primeiro.',
      'two-sources-phase': 'Duas fontes de 120 V defasadas de 30° alimentando um indutor por resistores.'
    },
    frequencyLabel: 'Frequência f (Hz)',
    omegaReadout: 'ω = 2πf = {omega} rad/s',
    nodeCountLabel: 'Nós não-referência (excluindo GND = 0)',
    nodeOptions: [
      { value: 2, label: '2 (Nós 1, 2)' },
      { value: 3, label: '3 (Nós 1, 2, 3)' },
      { value: 4, label: '4 (Nós 1 … 4)' },
      { value: 5, label: '5 (Nós 1 … 5)' }
    ],
    componentsLabel: 'Componentes',
    compCount: '{n} / {max}',
    conventionHint: 'As amplitudes são valores de pico. I: corrente de referência De → Para. V: (+) em De, (−) em Para; fase em graus. O nó 0 é o GND.',
    fromNode: 'De',
    toNode: 'Para',
    gndOption: '0 (GND)',
    nodeOption: 'Nó {n}',
    valueLabel: 'Valor',
    phaseLabel: 'Fase (°)',
    removeTitle: 'Remover componente',
    typeOptions: { R: 'R (Ω)', L: 'L (mH)', C: 'C (µF)', I: 'I (A)', V: 'V (V)' },
    solveBtn: 'Resolver circuito',
    resetBtn: 'Redefinir',
    resultsHeading: 'Esquemático e solução fasorial',
    exportCsv: 'Exportar CSV',
    exportSvg: 'Exportar SVG',
    exportPng: 'Exportar PNG',
    shareBtn: 'Copiar link da configuração',
    shareUrlLabel: 'URL da configuração do circuito',
    copied: 'Link da configuração copiado.',
    copyFallback: 'Copie a URL exibida abaixo.',
    exportError: 'Falha na exportação. Tente exportar SVG.',
    queryError: 'A configuração da URL é inválida. O circuito padrão foi restaurado.',
    solvedStatus: 'Resolvidos {nodes} nó(s), {branches} ramo(s) em ω = {omega} rad/s · Resíduo máx. LKC: {kcl} A · Diferença de potência: {pdiff} VA.',
    schTitle: 'Esquemático do circuito CA com fasores de tensão nodal e corrente de ramo',
    schDesc: 'Diagrama SVG com nós 0 a N, componentes, fasores de tensão nodal e fasores de corrente de ramo com o sentido de referência.',
    totalActive: 'Potência ativa nos resistores',
    totalInductive: 'Potência reativa nos indutores',
    totalCapacitive: 'Potência reativa nos capacitores',
    totalSupplied: 'Potência complexa das fontes',
    maxKcl: 'Resíduo máx. LKC',
    matrixHeading: 'Sistema de equações nodais (complexo)',
    matrixSubtitle: 'Sistema nodal / MNA complexo. Em cima: escrito com os elementos do circuito. Embaixo: com números (j = √−1, fasores na forma retangular, valores de pico).',
    matrixLegend: 'Cada linha é a LKC em um nó: a diagonal soma as admitâncias dos elementos que tocam o nó (1/R, 1/(jωL), jωC), os termos fora da diagonal são menos a admitância entre dois nós, ±1 marca os terminais das fontes de tensão (+ em De, − em Para), e o lado direito traz os fasores de corrente das fontes (entrando no nó +, saindo −) e os fasores de tensão das fontes.',
    kclSummary: 'Equações da LKC nó a nó (corrente saindo = 0)',
    branchSummary: 'Fasores dos ramos e potência complexa',
    branchHeaders: ['ID', 'Tipo', 'De → Para', 'Valor', 'V_de − V_para  (V, ∠°)', 'Corrente De → Para  (A, ∠°)', 'P (W)', 'Q (var)'],
    typeNames: { R: 'Resistor', L: 'Indutor', C: 'Capacitor', I: 'Fonte de corrente', V: 'Fonte de tensão' },
    docEqTitle: 'Equações e convenções',
    docEqText: 'Em regime permanente senoidal toda tensão e corrente é x(t) = |X| cos(ωt + φ) e é representada pelo fasor de pico X = |X|∠φ. Os elementos viram admitâncias: Y_R = 1/R, Y_L = 1/(jωL), Y_C = jωC. A LKC em cada nó não-referência fornece o sistema linear complexo abaixo; fontes de tensão acrescentam incógnitas auxiliares de corrente de ramo (análise nodal modificada). Para um elemento com queda de tensão ΔV (De − Para) e corrente I (De → Para), a potência complexa absorvida é S = ½·ΔV·I*, com P = Re S (W) e Q = Im S (var). O teorema de Tellegen dá ΣS = 0 em todos os elementos.',
    docMethodTitle: 'Método numérico',
    docMethodText: 'O sistema complexo é montado em ponto flutuante IEEE-754 de precisão dupla e resolvido por eliminação gaussiana com pivotamento parcial. Um pivô menor que 10⁻¹² do maior elemento da matriz é informado como circuito singular (laços de fontes de tensão, nós só com fontes de corrente). Unidades públicas: Ω, mH, µF, V, A (pico), graus, Hz; os cálculos internos são em SI.',
    docLimitsTitle: 'Hipóteses e limitações',
    docLimitsText: 'Circuito linear invariante no tempo com elementos ideais concentrados, todas as fontes na mesma frequência única (f de 0,001 Hz a 1 GHz). CC não é coberta (use o laboratório de análise nodal resistiva). Sem transitórios, indutância mútua, fontes dependentes, dispositivos não lineares, perdas ou tolerâncias dos componentes. No máximo 5 nós não-referência e 24 componentes.',
    docRefTitle: 'Referências e validação',
    docRefText: 'Formulação baseada em Ho, Ruehli & Brennan (1975), "The Modified Nodal Approach to Network Analysis", IEEE Trans. Circuits and Systems, e em textos usuais de análise de circuitos. Evidência de verificação analítica (frequência de corte, ressonância, balanço de Tellegen, escala, redução ao caso resistivo):',
    validationLink: 'docs/validation/nodal-analysis-ac.md ↗',
    errors: {
      INVALID_CIRCUIT: 'Configuração de circuito inválida.',
      INVALID_NODE_COUNT: 'O número de nós deve estar entre 2 e 5.',
      INVALID_FREQUENCY: 'A frequência deve estar entre 0,001 Hz e 10⁹ Hz.',
      INVALID_COMPONENT_COUNT: 'Adicione de 1 a 24 componentes.',
      INVALID_COMPONENT: 'Entrada de componente inválida.',
      INVALID_TYPE: 'Tipo de componente não suportado.',
      INVALID_NODE: 'O componente referencia um nó inválido.',
      SELF_LOOP: 'Um componente não pode ligar um nó a ele mesmo.',
      NON_FINITE_VALUE: 'Todos os valores dos componentes devem ser números finitos.',
      RESISTANCE_RANGE: 'A resistência deve estar entre 0,001 Ω e 10⁹ Ω.',
      INDUCTANCE_RANGE: 'A indutância deve estar entre 0,001 mH e 10⁶ mH.',
      CAPACITANCE_RANGE: 'A capacitância deve estar entre 0,001 µF e 10⁶ µF.',
      CURRENT_RANGE: 'A fonte de corrente deve estar entre −10⁴ A e 10⁴ A.',
      VOLTAGE_RANGE: 'A fonte de tensão deve estar entre −10⁴ V e 10⁴ V.',
      INVALID_PHASE: 'A fase da fonte deve estar entre −360° e 360°.',
      DISCONNECTED_NODE: 'Todo nó precisa de caminho até o terra por R, L, C ou fontes de tensão (não apenas fontes de corrente).',
      SINGULAR_SYSTEM: 'Matriz do circuito singular: verifique laços de fontes de tensão ou nós sem caminho até o terra.'
    }
  },
  es: {
    docTitle: 'Análisis nodal fasorial · EEVL', eyebrow: 'EEVL / CIRCUITOS ELÉCTRICOS / ANÁLISIS NODAL FASORIAL · v1.0.0',
    typeLabel: 'Tipo',
    title: 'Análisis nodal en régimen sinusoidal permanente',
    desc: 'Construya circuitos lineales de CA con R, L, C y fuentes sinusoidales a una frecuencia. Calcule fasores de tensión nodal y corriente de rama, potencia compleja y el sistema nodal / MNA complejo.',
    badge: 'Verificado analíticamente · fasores y MNA', configHeading: 'Editor de circuitos', presetsLabel: 'Ejemplos',
    presets: {'rc-lowpass':'2 nodos · Filtro RC paso bajo','rl-highpass':'2 nodos · Filtro RL paso alto','series-resonance':'3 nodos · Resonancia RLC serie','parallel-resonance':'2 nodos · Resonancia RLC paralelo','rc-two-stage':'3 nodos · Filtro RC de dos etapas','two-sources-phase':'3 nodos · Dos fuentes desfasadas'},
    presetDescriptions: {'rc-lowpass':'En la frecuencia de corte, la salida es V/√2 ∠ −45°.','rl-highpass':'En la frecuencia de corte, la tensión de la resistencia es V/√2 ∠ −45°.','series-resonance':'En f₀, la corriente está en fase y vale V/R; V_C y V_L alcanzan Q·V.','parallel-resonance':'En f₀, las corrientes de L y C se cancelan: el tanque se comporta como circuito abierto.','rc-two-stage':'Etapas en cascada: la segunda carga a la primera.','two-sources-phase':'Dos fuentes de 120 V con 30° de desfase alimentan un inductor a través de resistencias.'},
    frequencyLabel: 'Frecuencia f (Hz)', omegaReadout: 'ω = 2πf = {omega} rad/s', nodeCountLabel: 'Nodos no de referencia (sin contar GND = 0)',
    nodeOptions: [{value:2,label:'2 (nodos 1, 2)'},{value:3,label:'3 (nodos 1, 2, 3)'},{value:4,label:'4 (nodos 1 … 4)'},{value:5,label:'5 (nodos 1 … 5)'}],
    componentsLabel: 'Componentes', compCount: '{n} / {max}', conventionHint: 'Las amplitudes son valores pico. I: corriente de referencia Desde → Hacia. V: (+) en Desde, (−) en Hacia; fase en grados. El nodo 0 es GND.',
    fromNode: 'Desde', toNode: 'Hacia', gndOption: '0 (GND)', nodeOption: 'Nodo {n}', valueLabel: 'Valor', phaseLabel: 'Fase (°)', removeTitle: 'Eliminar componente',
    typeOptions: {R:'R (Ω)',L:'L (mH)',C:'C (µF)',I:'I (A)',V:'V (V)'}, solveBtn: 'Resolver circuito', resetBtn: 'Restablecer',
    resultsHeading: 'Esquema y solución fasorial', exportCsv: 'Exportar CSV', exportSvg: 'Exportar SVG', exportPng: 'Exportar PNG', shareBtn: 'Copiar enlace de configuración',
    shareUrlLabel: 'URL de configuración del circuito',
    copied: 'Enlace de configuración copiado.', copyFallback: 'Copie la URL que aparece abajo.', exportError: 'Error al exportar. Pruebe a exportar como SVG.', queryError: 'La configuración de la URL no es válida. Se restauró el circuito predeterminado.',
    solvedStatus: 'Resueltos {nodes} nodo(s), {branches} rama(s) a ω = {omega} rad/s · Residuo máximo de LCK: {kcl} A · Diferencia de balance de potencia: {pdiff} VA.',
    schTitle: 'Esquema del circuito de CA con fasores de tensión nodal y corriente de rama', schDesc: 'Diagrama SVG con nodos 0 a N, componentes, fasores de tensión nodal y fasores de corriente de rama con sus sentidos de referencia.',
    totalActive: 'Potencia activa en resistencias', totalInductive: 'Potencia reactiva en inductores', totalCapacitive: 'Potencia reactiva en condensadores', totalSupplied: 'Potencia compleja de las fuentes', maxKcl: 'Residuo máximo de LCK',
    matrixHeading: 'Sistema de ecuaciones nodales (complejo)', matrixSubtitle: 'Sistema nodal / MNA complejo. Arriba: expresado con los elementos del circuito. Abajo: con valores numéricos (j = √−1, fasores en forma rectangular, valores pico).',
    matrixLegend: 'Cada fila es la LCK de un nodo: la diagonal suma las admitancias conectadas al nodo (1/R, 1/(jωL), jωC); los términos fuera de la diagonal son la admitancia negativa entre nodos; ±1 marca los terminales de fuentes de tensión (+ en Desde, − en Hacia). El lado derecho contiene los fasores de corriente (entran +, salen −) y de tensión de las fuentes.',
    kclSummary: 'Ecuaciones de LCK nodo por nodo (corriente saliente = 0)', branchSummary: 'Fasores de rama y potencia compleja',
    branchHeaders: ['ID','Tipo','Desde → Hacia','Valor','V_desde − V_hacia (V, ∠°)','Corriente Desde → Hacia (A, ∠°)','P (W)','Q (var)'],
    typeNames: {R:'Resistencia',L:'Inductor',C:'Condensador',I:'Fuente de corriente',V:'Fuente de tensión'},
    docEqTitle: 'Ecuaciones y convenciones',
    docEqText: 'En régimen sinusoidal permanente, cada tensión y corriente es x(t) = |X| cos(ωt + φ) y se representa mediante el fasor de pico X = |X|∠φ. Los elementos se expresan como admitancias: Y_R = 1/R, Y_L = 1/(jωL), Y_C = jωC. La LCK en cada nodo no de referencia produce el sistema lineal complejo; las fuentes de tensión añaden incógnitas auxiliares de corriente de rama (análisis nodal modificado). Para una caída ΔV (Desde − Hacia) y corriente I (Desde → Hacia), la potencia compleja absorbida es S = ½·ΔV·I*, con P = Re S (W) y Q = Im S (var). El teorema de Tellegen establece ΣS = 0 para todos los elementos.',
    docMethodTitle: 'Método numérico', docMethodText: 'El sistema complejo se ensambla en coma flotante IEEE-754 de doble precisión y se resuelve mediante eliminación gaussiana con pivoteo parcial. Si un pivote es menor que 10⁻¹² del mayor elemento de la matriz, el circuito se considera singular. Unidades públicas: Ω, mH, µF, V y A (pico), grados y Hz; los cálculos internos usan SI.',
    docLimitsTitle: 'Hipótesis y limitaciones', docLimitsText: 'Circuito lineal e invariante en el tiempo con componentes ideales concentrados; todas las fuentes comparten una sola frecuencia (f de 0,001 Hz a 1 GHz). No incluye CC (use el laboratorio de análisis nodal resistivo), transitorios, inductancia mutua, fuentes dependientes, dispositivos no lineales, pérdidas ni tolerancias. Máximo de 5 nodos no de referencia y 24 componentes.',
    docRefTitle: 'Referencias y verificación', docRefText: 'Formulación basada en Ho, Ruehli y Brennan (1975), «The Modified Nodal Approach to Network Analysis», IEEE Trans. Circuits and Systems, y textos habituales de análisis de circuitos. Evidencia de verificación analítica (frecuencia de corte, resonancia, balance de Tellegen, escalado y reducción al caso resistivo):',
    validationLink: 'docs/validation/nodal-analysis-ac.md ↗',
    errors: {
      INVALID_CIRCUIT:'Configuración de circuito no válida.', INVALID_NODE_COUNT:'El número de nodos debe estar entre 2 y 5.', INVALID_FREQUENCY:'La frecuencia debe estar entre 0,001 Hz y 10⁹ Hz.',
      INVALID_COMPONENT_COUNT:'Añada entre 1 y 24 componentes.', INVALID_COMPONENT:'Entrada de componente no válida.', INVALID_TYPE:'Tipo de componente no compatible.', INVALID_NODE:'El componente hace referencia a un nodo no válido.', SELF_LOOP:'Un componente no puede conectar un nodo consigo mismo.', NON_FINITE_VALUE:'Todos los valores deben ser números finitos.',
      RESISTANCE_RANGE:'La resistencia debe estar entre 0,001 Ω y 10⁹ Ω.', INDUCTANCE_RANGE:'La inductancia debe estar entre 0,001 mH y 10⁶ mH.', CAPACITANCE_RANGE:'La capacitancia debe estar entre 0,001 µF y 10⁶ µF.', CURRENT_RANGE:'La fuente de corriente debe estar entre −10⁴ A y 10⁴ A.', VOLTAGE_RANGE:'La fuente de tensión debe estar entre −10⁴ V y 10⁴ V.', INVALID_PHASE:'La fase de la fuente debe estar entre −360° y 360°.',
      DISCONNECTED_NODE:'Cada nodo debe tener un camino a tierra mediante R, L, C o fuentes de tensión (no solo fuentes de corriente).', SINGULAR_SYSTEM:'Matriz singular: compruebe si hay lazos de fuentes de tensión o nodos sin camino a tierra.'
    }
  }
};

const $ = selector => document.querySelector(selector);
const SVG_NS = 'http://www.w3.org/2000/svg';

let state = freshState(PRESETS[0]);
let lastSolution = null;
let solveTimer = 0;

function freshState(preset) {
  return { presetId: preset.id, nodeCount: preset.nodeCount, frequency: preset.frequency, components: structuredClone(preset.components) };
}
function tr() { return TEXT[language] || TEXT.en; }

/* ------------------------------------------------------------------ number formatting */
function fmt(num, digits = 4) {
  if (!Number.isFinite(num)) return '—';
  const abs = Math.abs(num);
  if (abs === 0) return '0';
  if (abs >= 1e5 || abs < 1e-3) return num.toExponential(3);
  return Number(num.toFixed(digits)).toString();
}
/** Magnitude ∠ phase in degrees. */
function fmtPhasor(z, digits = 4) {
  const { mag, phase } = polar(z);
  if (mag < 1e-12) return '0';
  return `${fmt(mag, digits)} ∠ ${fmt(phase, 2)}°`;
}
function fmtUnit(comp) {
  const v = comp.value;
  switch (comp.type) {
    case 'R':
      if (v >= 1e6) return `${fmt(v / 1e6, 3)} MΩ`;
      return v >= 1000 ? `${fmt(v / 1e3, 3)} kΩ` : `${fmt(v, 3)} Ω`;
    case 'L': return v >= 1000 ? `${fmt(v / 1e3, 3)} H` : `${fmt(v, 3)} mH`;
    case 'C':
      if (v >= 1000) return `${fmt(v / 1e3, 3)} mF`;
      return v < 1 ? `${fmt(v * 1e3, 3)} nF` : `${fmt(v, 3)} µF`;
    case 'I': return `${fmt(v, 3)} A ∠ ${fmt(comp.phase || 0, 2)}°`;
    default: return `${fmt(v, 3)} V ∠ ${fmt(comp.phase || 0, 2)}°`;
  }
}
function nextId(type) {
  const used = new Set(state.components.map(c => c.id));
  let idx = 1;
  while (used.has(`${type}${idx}`)) idx++;
  return `${type}${idx}`;
}
const isSource = type => type === 'I' || type === 'V';

/* ------------------------------------------------------------------ editor */
function scheduleSolve() {
  clearTimeout(solveTimer);
  solveTimer = setTimeout(solveAndRender, 200);
}

function renderPresets() {
  const dict = tr();
  const container = $('#presets');
  container.replaceChildren();
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = dict.presets[preset.id] || preset.id;
    btn.setAttribute('aria-pressed', String(state.presetId === preset.id));
    btn.addEventListener('click', () => {
      state = freshState(preset);
      renderAll();
      solveAndRender();
    });
    container.appendChild(btn);
  }
  const desc = $('#preset-desc');
  if (desc) desc.textContent = (dict.presetDescriptions && dict.presetDescriptions[state.presetId]) || '';
}

function renderNodeSelect() {
  const select = $('#node-count');
  select.replaceChildren();
  for (const opt of tr().nodeOptions) {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = opt.label;
    select.appendChild(o);
  }
  select.value = String(state.nodeCount);
}

function buildNodeSelect(selected, ariaLabel) {
  const dict = tr();
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', ariaLabel);
  for (let n = 0; n <= state.nodeCount; n++) {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = n === 0 ? dict.gndOption : dict.nodeOption.replace('{n}', n);
    sel.appendChild(opt);
  }
  sel.value = String(Math.min(selected, state.nodeCount));
  return sel;
}

function defaultValue(type) {
  return { R: 100, L: 10, C: 1, I: 1, V: 10 }[type];
}

function renderComponentList() {
  const dict = tr();
  $('#comp-count').textContent = dict.compCount.replace('{n}', String(state.components.length)).replace('{max}', String(LIMITS.maxComponents));
  const list = $('#component-list');
  list.replaceChildren();

  state.components.forEach((comp, idx) => {
    const row = document.createElement('div');
    row.className = 'comp-row';
    row.dataset.type = comp.type;

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.className = 'comp-id';
    idInput.value = comp.id;
    idInput.maxLength = 6;
    idInput.setAttribute('aria-label', 'ID');
    idInput.addEventListener('input', () => {
      comp.id = idInput.value.trim() || `${comp.type}${idx + 1}`;
      state.presetId = '';
      scheduleSolve();
    });
    idInput.addEventListener('change', renderPresets);

    const typeSel = document.createElement('select');
    typeSel.setAttribute('aria-label', dict.typeLabel);
    for (const code of ['R', 'L', 'C', 'I', 'V']) {
      const o = document.createElement('option');
      o.value = code;
      o.textContent = dict.typeOptions[code];
      typeSel.appendChild(o);
    }
    typeSel.value = comp.type;
    typeSel.addEventListener('change', () => {
      comp.type = typeSel.value;
      if (!(comp.value > 0) && !isSource(comp.type)) comp.value = defaultValue(comp.type);
      if (!isSource(comp.type)) comp.phase = 0;
      state.presetId = '';
      renderAll();
      solveAndRender();
    });

    const fromSel = buildNodeSelect(comp.from, dict.fromNode);
    fromSel.addEventListener('change', () => { comp.from = Number(fromSel.value); state.presetId = ''; renderPresets(); solveAndRender(); });
    const toSel = buildNodeSelect(comp.to, dict.toNode);
    toSel.addEventListener('change', () => { comp.to = Number(toSel.value); state.presetId = ''; renderPresets(); solveAndRender(); });

    const valInput = document.createElement('input');
    valInput.type = 'number';
    valInput.step = 'any';
    valInput.value = String(comp.value);
    valInput.setAttribute('aria-label', dict.valueLabel);
    valInput.addEventListener('input', () => {
      comp.value = valInput.value === '' ? NaN : Number(valInput.value);
      state.presetId = '';
      scheduleSolve();
    });
    valInput.addEventListener('change', renderPresets);

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'remove-btn';
    rmBtn.textContent = '×';
    rmBtn.title = dict.removeTitle;
    rmBtn.setAttribute('aria-label', `${dict.removeTitle} ${comp.id}`);
    rmBtn.disabled = state.components.length <= 1;
    rmBtn.addEventListener('click', () => {
      state.components.splice(idx, 1);
      state.presetId = '';
      renderAll();
      solveAndRender();
    });

    const nodes = document.createElement('div');
    nodes.className = 'comp-nodes';
    const wrapNode = (text, select) => {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = text;
      label.append(caption, select);
      return label;
    };
    const arrow = document.createElement('span');
    arrow.className = 'comp-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    nodes.append(wrapNode(dict.fromNode, fromSel), arrow, wrapNode(dict.toNode, toSel));

    row.append(idInput, typeSel, valInput, rmBtn, nodes);

    if (isSource(comp.type)) {
      const phaseWrap = document.createElement('label');
      phaseWrap.className = 'comp-phase';
      const caption = document.createElement('span');
      caption.textContent = dict.phaseLabel;
      const phaseInput = document.createElement('input');
      phaseInput.type = 'number';
      phaseInput.step = 'any';
      phaseInput.value = String(comp.phase ?? 0);
      phaseInput.setAttribute('aria-label', dict.phaseLabel);
      phaseInput.addEventListener('input', () => {
        comp.phase = phaseInput.value === '' ? NaN : Number(phaseInput.value);
        state.presetId = '';
        scheduleSolve();
      });
      phaseInput.addEventListener('change', renderPresets);
      phaseWrap.append(caption, phaseInput);
      row.appendChild(phaseWrap);
    }
    list.appendChild(row);
  });

  const atMax = state.components.length >= LIMITS.maxComponents;
  for (const id of ['add-r', 'add-l', 'add-c', 'add-i', 'add-v']) $('#' + id).disabled = atMax;
}

function renderStaticTexts() {
  const dict = tr();
  document.title = dict.docTitle;
  const set = (selector, text) => { const el = $(selector); if (el) el.textContent = text; };
  set('#eyebrow', dict.eyebrow); set('#page-title', dict.title); set('#page-desc', dict.desc); set('#verified-badge', dict.badge);
  set('#config-heading', dict.configHeading); set('#presets-label', dict.presetsLabel); set('#frequency-label', dict.frequencyLabel);
  set('#node-count-label', dict.nodeCountLabel); set('#components-label', dict.componentsLabel); set('#convention-hint', dict.conventionHint);
  set('#solve-btn', dict.solveBtn); set('#reset-btn', dict.resetBtn); set('#results-heading', dict.resultsHeading);
  set('#export-csv', dict.exportCsv); set('#export-svg', dict.exportSvg); set('#export-png', dict.exportPng); set('#share-btn', dict.shareBtn);
  $('#share-url').setAttribute('aria-label', dict.shareUrlLabel);
  set('#sch-title', dict.schTitle); set('#sch-desc', dict.schDesc);
  set('#matrix-heading', dict.matrixHeading); set('#matrix-subtitle', dict.matrixSubtitle);
  set('#kcl-summary', dict.kclSummary); set('#branch-summary', dict.branchSummary);
  set('#doc-eq-title', dict.docEqTitle); set('#doc-eq-text', dict.docEqText);
  set('#doc-method-title', dict.docMethodTitle); set('#doc-method-text', dict.docMethodText);
  set('#doc-limits-title', dict.docLimitsTitle); set('#doc-limits-text', dict.docLimitsText);
  set('#doc-ref-title', dict.docRefTitle); set('#doc-ref-text', dict.docRefText); set('#validation-link', dict.validationLink);
  const thead = $('#branch-thead');
  thead.replaceChildren();
  for (const h of dict.branchHeaders) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    thead.appendChild(th);
  }
  katex.render(
    String.raw`Y_R=\frac1R,\;\; Y_L=\frac{1}{j\omega L},\;\; Y_C=j\omega C \qquad \begin{bmatrix}\mathbf{Y} & \mathbf{B}\\\mathbf{B}^T & \mathbf{0}\end{bmatrix}\begin{bmatrix}\mathbf{V}\\\mathbf{I}_V\end{bmatrix} = \begin{bmatrix}\mathbf{I}\\\mathbf{E}\end{bmatrix} \qquad S=\tfrac12\,\Delta V\,I^{*}=P+jQ`,
    $('#doc-katex'),
    { displayMode: true, throwOnError: false }
  );
  updateOmega();
}

function updateOmega() {
  const f = state.frequency;
  const omega = Number.isFinite(f) ? omegaOf(f) : NaN;
  $('#omega-readout').textContent = tr().omegaReadout.replace('{omega}', fmt(omega, 6));
}

/* ------------------------------------------------------------------ schematic */
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function drawComponentSymbol(g, comp, mx, my, angleDeg, branchInfo, inkColor, blueColor, bgColor, vertical = false) {
  const grp = svgEl('g', { transform: `translate(${mx},${my})` });
  const sym = svgEl('g', { transform: `rotate(${angleDeg})` });
  const stroke = { fill: 'none', stroke: inkColor, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };

  if (comp.type === 'R') {
    sym.appendChild(svgEl('rect', { x: -20, y: -8, width: 40, height: 16, fill: bgColor, stroke: 'none' }));
    sym.appendChild(svgEl('path', { d: 'M-20 0 L-15 -6 L-9 6 L-3 -6 L3 6 L9 -6 L15 6 L20 0', ...stroke }));
    grp.appendChild(sym);
  } else if (comp.type === 'L') {
    sym.appendChild(svgEl('rect', { x: -20, y: -9, width: 40, height: 18, fill: bgColor, stroke: 'none' }));
    sym.appendChild(svgEl('path', { d: 'M-20 0 h5 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 h5', ...stroke }));
    grp.appendChild(sym);
  } else if (comp.type === 'C') {
    sym.appendChild(svgEl('rect', { x: -20, y: -11, width: 40, height: 22, fill: bgColor, stroke: 'none' }));
    sym.appendChild(svgEl('path', { d: 'M-20 0 H-3 M-3 -10 V10 M3 -10 V10 M3 0 H20', ...stroke }));
    grp.appendChild(sym);
  } else {
    grp.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 16, fill: bgColor, stroke: blueColor, 'stroke-width': 1.8 }));
    if (comp.type === 'I') {
      sym.appendChild(svgEl('path', {
        d: 'M-10 0 L8 0 M3 -5 L9 0 L3 5',
        fill: 'none', stroke: blueColor, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      grp.appendChild(sym);
    } else {
      // Sinusoid inside the circle and +/− markers near the terminals.
      sym.appendChild(svgEl('path', {
        d: 'M-8 0 C-5 -8 -3 -8 0 0 C3 8 5 8 8 0',
        fill: 'none', stroke: blueColor, 'stroke-width': 1.6, 'stroke-linecap': 'round'
      }));
      grp.appendChild(sym);
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * 22;
      const dy = Math.sin(rad) * 22;
      for (const [sign, sx, sy] of [['+', -dx, -dy], ['−', dx, dy]]) {
        const mark = svgEl('text', { x: sx.toFixed(1), y: (sy + 4).toFixed(1), 'text-anchor': 'middle', fill: blueColor, 'font-size': '12', 'font-weight': '700' });
        mark.textContent = sign;
        grp.appendChild(mark);
      }
    }
  }

  const tx = vertical ? 34 : 0;
  const anchor = vertical ? 'start' : 'middle';
  const label = svgEl('text', {
    x: tx, y: vertical ? -4 : -47, 'text-anchor': anchor,
    fill: inkColor, 'font-size': '11', 'font-weight': '600', 'font-family': '"Segoe UI", Arial, sans-serif'
  });
  label.textContent = `${comp.id}: ${fmtUnit(comp)}`;
  grp.appendChild(label);

  if (branchInfo) {
    // Phasor current in the From → To reference direction; the arrow marks that reference.
    const curLabel = svgEl('text', {
      x: tx, y: vertical ? 10 : -34, 'text-anchor': anchor,
      fill: blueColor, 'font-size': '10', 'font-family': 'Consolas, monospace'
    });
    curLabel.textContent = fmtPhasor(branchInfo.current, 3).replace(/ /g, ' ') + ' A';
    grp.appendChild(curLabel);
    const half = vertical ? 12 : 14;
    const arrow = svgEl('g', { transform: vertical ? `translate(22,3) rotate(${angleDeg})` : `translate(0,-24) rotate(${angleDeg})` });
    arrow.appendChild(svgEl('path', {
      d: `M${-half} 0 H${half} M${half - 5} -3.5 L${half} 0 L${half - 5} 3.5`,
      fill: 'none', stroke: blueColor, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));
    grp.appendChild(arrow);
  }
  g.appendChild(grp);
}

/**
 * Ladder-style drawing on one bus (see the resistive lab): nodes are dots on a horizontal bus, the
 * first branch between neighbouring nodes is inline, branches to GND are vertical legs, and every
 * other branch is an arc above the bus. Node tags show |V|∠φ.
 */
function renderSchematic(solution) {
  const svg = $('#schematic');
  const content = $('#schematic-content');
  content.replaceChildren();

  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue('--ink').trim() || '#172f43';
  const muted = styles.getPropertyValue('--muted').trim() || '#5b6d79';
  const blue = styles.getPropertyValue('--blue').trim() || '#1264a2';
  const bg = styles.getPropertyValue('--bg').trim() || '#fafbf9';
  const paper = styles.getPropertyValue('--paper').trim() || '#ffffff';
  const lineCol = styles.getPropertyValue('--line').trim() || '#dce4e7';

  const N = state.nodeCount;
  const LEG = 120;
  const GAP = 190;
  const MARGIN = 70;
  const TAG_W = 96;

  const ground = Array.from({ length: N + 1 }, () => []);
  const inline = Array(N + 1).fill(null);
  const arcs = [];
  state.components.forEach((comp, idx) => {
    const lo = Math.min(comp.from, comp.to);
    const hi = Math.max(comp.from, comp.to);
    if (lo === 0 && hi >= 1 && hi <= N) ground[hi].push({ comp, idx });
    else if (lo >= 1 && hi <= N && lo !== hi) {
      if (hi === lo + 1 && !inline[lo]) inline[lo] = { comp, idx, lo, hi };
      else arcs.push({ comp, idx, lo, hi });
    }
  });

  const nodeX = [0];
  const lastLeg = [0];
  let cursor = MARGIN + TAG_W + 20;
  for (let k = 1; k <= N; k++) {
    nodeX[k] = cursor;
    lastLeg[k] = cursor + (Math.max(1, ground[k].length) - 1) * LEG;
    cursor = lastLeg[k] + GAP;
  }
  const W = Math.max(720, lastLeg[N] + 150);

  arcs.sort((p, q) => (p.hi - p.lo) - (q.hi - q.lo) || p.idx - q.idx);
  const levels = [];
  for (const arc of arcs) {
    let level = 0;
    while (levels[level] && levels[level].some(o => !(arc.hi <= o.lo || arc.lo >= o.hi))) level++;
    (levels[level] = levels[level] || []).push(arc);
    arc.level = level;
  }
  const LEVEL_STEP = 70;
  const L = levels.length;
  const nodeY = Math.max(75, L ? 135 + (L - 1) * LEVEL_STEP : 0);
  const arcY = level => nodeY - 75 - level * LEVEL_STEP;
  const gndY = nodeY + 200;
  const H = gndY + 70;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  content.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: bg }));

  const legXs = [];
  ground.forEach((list, k) => list.forEach((_, r) => legXs.push(nodeX[k] + r * LEG)));
  const railLeft = Math.min(...legXs, nodeX[1]);
  const railRight = Math.max(...legXs, nodeX[1]);
  content.appendChild(svgEl('line', { x1: railLeft, y1: gndY, x2: railRight, y2: gndY, stroke: ink, 'stroke-width': 2.2 }));
  const gx = (railLeft + railRight) / 2;
  content.appendChild(svgEl('path', {
    d: `M${gx} ${gndY} v14 M${gx - 16} ${gndY + 14} h32 M${gx - 10} ${gndY + 20} h20 M${gx - 5} ${gndY + 26} h10`,
    fill: 'none', stroke: ink, 'stroke-width': 2, 'stroke-linecap': 'round'
  }));
  const gndText = svgEl('text', { x: gx, y: gndY + 46, 'text-anchor': 'middle', fill: muted, 'font-size': '11', 'font-weight': '600', 'font-family': '"Segoe UI", Arial, sans-serif' });
  gndText.textContent = 'GND (0 V)';
  content.appendChild(gndText);

  const wireLayer = svgEl('g');
  const compLayer = svgEl('g');
  const nodeLayer = svgEl('g');
  content.append(wireLayer, compLayer, nodeLayer);
  const wire = d => wireLayer.appendChild(svgEl('path', { d, fill: 'none', stroke: muted, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const info = idx => (solution ? solution.branches[idx] : null);

  for (let k = 1; k <= N; k++) {
    wire(`M${nodeX[k]} ${nodeY} H${lastLeg[k]}`);
    if (k < N && inline[k]) {
      const a = lastLeg[k];
      const b = nodeX[k + 1];
      wire(`M${a} ${nodeY} H${b}`);
      const entry = inline[k];
      drawComponentSymbol(compLayer, entry.comp, (a + b) / 2, nodeY, entry.comp.from < entry.comp.to ? 0 : 180, info(entry.idx), ink, blue, bg, false);
    }
  }
  for (const arc of arcs) {
    const xa = nodeX[arc.lo];
    const xb = nodeX[arc.hi];
    const y = arcY(arc.level);
    wire(`M${xa} ${nodeY} V${y} H${xb} V${nodeY}`);
    drawComponentSymbol(compLayer, arc.comp, (xa + xb) / 2, y, arc.comp.from < arc.comp.to ? 0 : 180, info(arc.idx), ink, blue, bg, false);
    for (const x of [xa, xb]) nodeLayer.appendChild(svgEl('circle', { cx: x, cy: nodeY, r: 3, fill: muted }));
  }
  for (let k = 1; k <= N; k++) {
    ground[k].forEach((entry, r) => {
      const x = nodeX[k] + r * LEG;
      wire(`M${x} ${nodeY} V${gndY}`);
      if (r > 0) nodeLayer.appendChild(svgEl('circle', { cx: x, cy: nodeY, r: 3, fill: muted }));
      drawComponentSymbol(compLayer, entry.comp, x, (nodeY + gndY) / 2, entry.comp.from === k ? 90 : -90, info(entry.idx), ink, blue, bg, true);
    });
  }
  for (let k = 1; k <= N; k++) {
    nodeLayer.appendChild(svgEl('circle', { cx: nodeX[k], cy: nodeY, r: 6, fill: blue, stroke: paper, 'stroke-width': 2 }));
    const tx = nodeX[k] - 14;
    nodeLayer.appendChild(svgEl('rect', { x: tx - TAG_W, y: nodeY + 14, width: TAG_W, height: 36, rx: 5, fill: paper, stroke: lineCol, 'stroke-width': 1 }));
    const name = svgEl('text', { x: tx - TAG_W / 2, y: nodeY + 29, 'text-anchor': 'middle', fill: muted, 'font-size': '10', 'font-weight': '600', 'font-family': '"Segoe UI", Arial, sans-serif' });
    name.textContent = tr().nodeOption.replace('{n}', k);
    const volt = svgEl('text', { x: tx - TAG_W / 2, y: nodeY + 44, 'text-anchor': 'middle', fill: ink, 'font-size': '10.5', 'font-weight': '700', 'font-family': 'Consolas, monospace' });
    volt.textContent = solution ? `${fmtPhasor(solution.nodeVoltages[k], 3)} V` : '—';
    nodeLayer.append(name, volt);
  }
  svg.dataset.ready = '1';
}

/* ------------------------------------------------------------------ matrix & results */
function renderMatrixMath(solution) {
  const n = solution.nodeCount;
  const sc = symbolicTerms({ nodeCount: n, frequency: state.frequency, components: state.components });
  const target = $('#matrix-katex');
  target.replaceChildren();
  for (const tex of [symbolicSystemLatex(sc), numericSystemLatex(solution, sc.voltageSourceIds)]) {
    const block = document.createElement('div');
    block.className = 'matrix-block';
    target.appendChild(block);
    katex.render(tex, block, { displayMode: true, throwOnError: false });
  }
  const note = document.createElement('p');
  note.className = 'matrix-legend';
  note.textContent = tr().matrixLegend;
  target.appendChild(note);

  const kclContainer = $('#kcl-list');
  kclContainer.replaceChildren();
  for (const tex of kclRowsLatex(solution, sc.voltageSourceIds)) {
    const div = document.createElement('div');
    div.className = 'kcl-item';
    katex.render(tex, div, { displayMode: false, throwOnError: false });
    kclContainer.appendChild(div);
  }
}

function renderResults(solution) {
  const dict = tr();
  const metrics = $('#node-metrics');
  metrics.replaceChildren();
  const card = (label, value) => {
    const div = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.textContent = label;
    const val = document.createElement('strong');
    val.textContent = value;
    div.append(lbl, val);
    metrics.appendChild(div);
  };
  for (let k = 1; k <= solution.nodeCount; k++) card(`V${k}`, `${fmtPhasor(solution.nodeVoltages[k])} V`);
  card(dict.totalActive, `${fmt(solution.activePowerLoads)} W`);
  card(dict.totalInductive, `${fmt(solution.reactiveInductors)} var`);
  card(dict.totalCapacitive, `${fmt(solution.reactiveCapacitors)} var`);
  card(dict.totalSupplied, `${fmt(solution.suppliedPower.re)} W + j${fmt(solution.suppliedPower.im)} var`);
  card(dict.maxKcl, `${solution.maxKclResidual.toExponential(2)} A`);

  const tbody = $('#branch-tbody');
  tbody.replaceChildren();
  for (const b of solution.branches) {
    const row = document.createElement('tr');
    for (const cell of [b.id, dict.typeNames[b.type], `${b.from} → ${b.to}`, fmtUnit(b), fmtPhasor(b.voltageDrop), fmtPhasor(b.current), fmt(b.power.re), fmt(b.power.im)]) {
      const td = document.createElement('td');
      td.textContent = cell;
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }
  renderMatrixMath(solution);
  $('#status-msg').textContent = dict.solvedStatus
    .replace('{nodes}', String(solution.nodeCount))
    .replace('{branches}', String(solution.branches.length))
    .replace('{omega}', fmt(solution.omega, 6))
    .replace('{kcl}', solution.maxKclResidual.toExponential(2))
    .replace('{pdiff}', solution.powerBalanceError.toExponential(2));
}

function solveAndRender() {
  clearTimeout(solveTimer);
  const errEl = $('#error');
  try {
    const solution = solvePhasorCircuit(state);
    lastSolution = solution;
    errEl.hidden = true;
    errEl.textContent = '';
    renderSchematic(solution);
    renderResults(solution);
  } catch (err) {
    lastSolution = null;
    errEl.hidden = false;
    errEl.textContent = tr().errors[err.code] || err.message;
    renderSchematic(null);
    $('#node-metrics').replaceChildren();
    $('#branch-tbody').replaceChildren();
    $('#matrix-katex').textContent = '';
    $('#kcl-list').replaceChildren();
    $('#status-msg').textContent = '';
  }
}

function renderAll() {
  renderStaticTexts();
  renderPresets();
  renderNodeSelect();
  renderComponentList();
  $('#frequency').value = String(state.frequency);
  updateOmega();
}

/* ------------------------------------------------------------------ share / export */
function encodeShareUrl() {
  const payload = { n: state.nodeCount, f: state.frequency, c: state.components.map(c => [c.id, c.type, c.from, c.to, c.value, c.phase ?? 0]) };
  const params = new URLSearchParams();
  params.set('circuit', JSON.stringify(payload));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function loadFromUrl() {
  const raw = new URLSearchParams(location.search).get('circuit');
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isInteger(parsed.n) || !Array.isArray(parsed.c)) throw new Error('bad');
    const candidate = {
      nodeCount: parsed.n,
      frequency: Number(parsed.f),
      components: parsed.c.map(item => ({ id: String(item[0]), type: String(item[1]), from: Number(item[2]), to: Number(item[3]), value: Number(item[4]), phase: Number(item[5] ?? 0) }))
    };
    solvePhasorCircuit(candidate);
    state = { presetId: '', ...candidate };
    return true;
  } catch {
    return false;
  }
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function exportCsv() {
  if (!lastSolution) return;
  const lines = ['Section,ID/Node,Type,From,To,Value,Phase_deg,V_re,V_im,V_mag,V_phase_deg,I_re,I_im,I_mag,I_phase_deg,P_W,Q_var'];
  for (let k = 1; k <= lastSolution.nodeCount; k++) {
    const v = lastSolution.nodeVoltages[k], p = polar(v);
    lines.push(`Node,V${k},Node,${k},0,,,${v.re},${v.im},${p.mag},${p.phase},,,,,,`);
  }
  for (const b of lastSolution.branches) {
    const v = polar(b.voltageDrop), i = polar(b.current);
    lines.push(`Branch,${b.id},${b.type},${b.from},${b.to},${b.value},${b.phase},${b.voltageDrop.re},${b.voltageDrop.im},${v.mag},${v.phase},${b.current.re},${b.current.im},${i.mag},${i.phase},${b.power.re},${b.power.im}`);
  }
  lines.push(`Meta,frequency_Hz,${lastSolution.frequency},omega_rad_s,${lastSolution.omega},,,,,,,,,,,,`);
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'nodal-analysis-ac.csv');
}

function exportSvg() {
  download(new Blob([new XMLSerializer().serializeToString($('#schematic'))], { type: 'image/svg+xml;charset=utf-8' }), 'nodal-analysis-ac.svg');
}

function exportPng() {
  const svg = $('#schematic');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const box = svg.viewBox.baseVal;
    const canvas = document.createElement('canvas');
    canvas.width = 2 * box.width;
    canvas.height = Math.round(2 * box.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => (blob ? download(blob, 'nodal-analysis-ac.png') : ($('#status-msg').textContent = tr().exportError)), 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); $('#status-msg').textContent = tr().exportError; };
  img.src = url;
}

/* ------------------------------------------------------------------ events */
function bindEvents() {
  $('#node-count').addEventListener('change', e => {
    const nextN = Number(e.target.value);
    state.nodeCount = nextN;
    state.presetId = '';
    for (const c of state.components) {
      if (c.from > nextN) c.from = nextN;
      if (c.to > nextN) c.to = 0;
      if (c.from === c.to) c.to = c.from === 0 ? 1 : 0;
    }
    renderAll();
    solveAndRender();
  });

  $('#frequency').addEventListener('input', e => {
    state.frequency = e.target.value === '' ? NaN : Number(e.target.value);
    state.presetId = '';
    updateOmega();
    scheduleSolve();
  });
  $('#frequency').addEventListener('change', renderPresets);

  const addComponent = type => {
    if (state.components.length >= LIMITS.maxComponents) return;
    state.components.push({ id: nextId(type), type, from: 1, to: 0, value: defaultValue(type), phase: 0 });
    state.presetId = '';
    renderAll();
    solveAndRender();
  };
  for (const type of ['R', 'L', 'C', 'I', 'V']) $('#add-' + type.toLowerCase()).addEventListener('click', () => addComponent(type));

  $('#solve-btn').addEventListener('click', solveAndRender);
  $('#reset-btn').addEventListener('click', () => { state = freshState(PRESETS[0]); renderAll(); solveAndRender(); });
  $('#export-csv').addEventListener('click', exportCsv);
  $('#export-svg').addEventListener('click', exportSvg);
  $('#export-png').addEventListener('click', exportPng);
  $('#share-btn').addEventListener('click', async () => {
    const url = encodeShareUrl();
    const field = $('#share-url');
    try {
      await navigator.clipboard.writeText(url);
      $('#status-msg').textContent = tr().copied;
      field.hidden = true;
    } catch {
      field.value = url;
      field.hidden = false;
      field.select();
      $('#status-msg').textContent = tr().copyFallback;
    }
  });
  document.addEventListener('languagechange', () => { renderAll(); if (lastSolution) renderResults(lastSolution); });
  new MutationObserver(() => renderSchematic(lastSolution)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

async function boot() {
  await initialize();
  const urlOk = loadFromUrl();
  renderAll();
  bindEvents();
  solveAndRender();
  if (!urlOk) $('#status-msg').textContent = tr().queryError;
}

boot();
