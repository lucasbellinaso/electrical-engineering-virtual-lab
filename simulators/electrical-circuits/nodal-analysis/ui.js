import { initialize } from '../../../assets/js/common.js';
import { language } from '../../../assets/js/i18n.js';
import katex from '../../../assets/vendor/katex/katex.mjs';
import { LIMITS, PRESETS, defaults, solveNodalCircuit, symbolicTerms } from './model.js';

const TEXT = {
  en: {
    docTitle: 'Nodal Analysis · EEVL',
    mnaOr: 'or',
    nodeWord: 'Node',
    eyebrow: 'EEVL / ELECTRICAL CIRCUITS / NODAL ANALYSIS · v1.0.0',
    title: 'Nodal Analysis of Resistive Circuits',
    desc: 'Build linear DC circuits with resistors, current sources and voltage sources. Compute node voltages, branch currents, power balance and the exact nodal / MNA matrix.',
    badge: 'Analytically verified · KCL & MNA',
    configHeading: 'Circuit editor',
    presetsLabel: 'Examples',
    presets: {
      'two-node-current': '2 nodes · Current sources',
      'wheatstone-bridge': '3 nodes · Wheatstone bridge',
      'supernode-dc': '3 nodes · Supernode (V + I)',
      'ladder-4node': '4 nodes · Resistive ladder',
      'voltage-divider': '2 nodes · Voltage divider',
      'current-divider': '2 nodes · Current divider',
      'mixed-sources': '2 nodes · V and I sources',
      'ring-5node': '5 nodes · Meshed network'
    },
    presetDescriptions: {
      'two-node-current': 'Two current sources feeding a resistive T network.',
      'wheatstone-bridge': 'Balanced bridge: the middle resistor carries no current.',
      'supernode-dc': 'A floating voltage source joins nodes 1 and 2 (supernode, MNA).',
      'ladder-4node': 'Resistive ladder: each stage divides the voltage.',
      'voltage-divider': 'Two series resistors: V2 = V1·R2/(R1+R2) = 7.5 V.',
      'current-divider': 'The source current splits between parallel resistors and a series branch: V1 = 60/11 V, V2 = V1/2.',
      'mixed-sources': 'A voltage source and a current source acting together.',
      'ring-5node': 'Five nodes with a bridging resistor, to test the schematic and matrix.'
    },
    nodeCountLabel: 'Non-reference nodes (excluding GND = 0)',
    nodeOptions: [
      { value: 2, label: '2 (Nodes 1, 2)' },
      { value: 3, label: '3 (Nodes 1, 2, 3)' },
      { value: 4, label: '4 (Nodes 1, 2, 3, 4)' },
      { value: 5, label: '5 (Nodes 1 … 5)' }
    ],
    componentsLabel: 'Components',
    typeLabel: 'Type',
    compCount: '{n} / {max}',
    conventionHint: 'For I: current flows From → To. For V: (+) at From, (−) at To. Node 0 is Ground (GND).',
    fromNode: 'From',
    toNode: 'To',
    gndOption: '0 (GND)',
    nodeOption: 'Node {n}',
    valueLabel: 'Value',
    removeTitle: 'Remove component',
    solveBtn: 'Solve circuit',
    resetBtn: 'Reset',
    resultsHeading: 'Schematic & nodal solution',
    exportCsv: 'Export CSV',
    exportSvg: 'Export SVG',
    exportPng: 'Export PNG',
    shareBtn: 'Copy configuration link',
    shareUrlLabel: 'Configuration URL',
    copied: 'Configuration link copied.',
    copyFallback: 'Copy the URL shown below.',
    exportError: 'Export failed. Try exporting SVG instead.',
    queryError: 'URL configuration is invalid. Default circuit restored.',
    solvedStatus: 'Solved {nodes} node(s), {branches} branch(es) · Max KCL residual: {kcl} A · Power balance diff: {pdiff} W.',
    schTitle: 'Resistive circuit schematic with computed node voltages',
    schDesc: 'Interactive SVG diagram showing nodes 0 to N, components, node voltages and branch currents.',
    totalDissipated: 'Resistor power',
    totalSupplied: 'Source power',
    maxKcl: 'Max KCL residual',
    matrixHeading: 'System of nodal equations',
    matrixPure: 'Pure nodal formulation G·v = i (conductances in S, currents in A, voltages in V):',
    matrixMna: 'Modified Nodal Analysis (MNA) system with voltage source(s) (G in S, B dimensionless):',
    matrixLegend: 'Top: the same system written with your circuit elements — each row is KCL at a node: 1/R of the resistors on the diagonal (all resistors touching the node), −1/R off the diagonal (resistors between two nodes), ±1 for the terminals of voltage sources (+ at From, − at To), source currents I (entering the node +, leaving −) and source voltages V on the right. Bottom: the same equations with numbers.',
    kclSummary: 'Node-by-node KCL equations (leaving current = 0)',
    branchSummary: 'Branch currents, voltages and powers',
    branchHeaders: ['ID', 'Type', 'From → To', 'Value', 'V_from − V_to (V)', 'Current (A)', 'Power (W)'],
    typeNames: { R: 'Resistor (Ω)', I: 'Current src (A)', V: 'Voltage src (V)' },
    powerDissipatedTag: 'dissipated',
    powerSuppliedTag: 'supplied',
    powerAbsorbedTag: 'absorbed',
    docEqTitle: 'Equations & conventions',
    docEqText: 'At every non-reference node k ∈ {1,…,N}, Kirchhoff’s Current Law (KCL) requires the algebraic sum of currents leaving the node to be zero. Each resistor R between nodes a and b contributes conductance g = 1/R to G. Independent current sources enter vector i. Independent voltage sources introduce auxiliary branch-current variables i_V via incidence matrix B (Modified Nodal Analysis, MNA), handling grounded and floating sources (supernodes) uniformly.',
    docMethodTitle: 'Numerical method',
    docMethodText: 'The linear system is assembled in double-precision IEEE-754 floating point (SI units internally: Ω, S, A, V, W) and solved by Gaussian elimination with partial pivoting. Singular or ill-conditioned topologies (e.g., voltage source loops or floating subcircuits) are detected when the pivot magnitude falls below 10⁻¹².',
    docLimitsTitle: 'Assumptions & limitations',
    docLimitsText: 'Steady-state DC linear regime with ideal lumped elements. Dependent sources, non-linear components, reactive elements (L, C) and component tolerances are not modeled. Maximum of 5 non-reference nodes and 24 components.',
    docRefTitle: 'References & validation',
    docRefText: 'Formulation based on Ho, Ruehli & Brennan (1975), "The Modified Nodal Approach to Network Analysis", IEEE Trans. Circuits and Systems, and standard circuit analysis texts (Sadiku, Nilsson & Riedel). Analytical verification tests and evidence:',
    validationLink: 'docs/validation/nodal-analysis.md ↗',
    errors: {
      INVALID_CIRCUIT: 'Invalid circuit configuration.',
      INVALID_NODE_COUNT: 'Node count must be between 2 and 5.',
      INVALID_COMPONENT_COUNT: 'Add between 1 and 24 components.',
      INVALID_COMPONENT: 'Invalid component entry.',
      INVALID_TYPE: 'Unsupported component type.',
      INVALID_NODE: 'Component references an invalid node.',
      SELF_LOOP: 'A component cannot connect a node to itself.',
      NON_FINITE_VALUE: 'All component values must be finite numbers.',
      RESISTANCE_RANGE: 'Resistance must be between 0.001 Ω and 10⁹ Ω.',
      CURRENT_RANGE: 'Current source must be between −10⁴ A and 10⁴ A.',
      VOLTAGE_RANGE: 'Voltage source must be between −10⁴ V and 10⁴ V.',
      DISCONNECTED_NODE: 'Every node must have a path to ground (node 0).',
      SINGULAR_SYSTEM: 'Singular circuit matrix: check for voltage-source loops or nodes without a DC path to ground.'
    }
  },
  'pt-BR': {
    docTitle: 'Análise Nodal · EEVL',
    mnaOr: 'ou',
    nodeWord: 'Nó',
    typeLabel: 'Tipo',
    eyebrow: 'EEVL / CIRCUITOS ELÉTRICOS / ANÁLISE NODAL · v1.0.0',
    title: 'Análise Nodal de Circuitos Resistivos',
    desc: 'Monte circuitos CC lineares com resistores, fontes de corrente e fontes de tensão. Calcule tensões nodais, correntes de ramo, balanço de potência e o sistema matricial nodal / MNA.',
    badge: 'Verificado analiticamente · LKC & MNA',
    configHeading: 'Editor de circuito',
    presetsLabel: 'Exemplos',
    presets: {
      'two-node-current': '2 nós · Fontes de corrente',
      'wheatstone-bridge': '3 nós · Ponte de Wheatstone',
      'supernode-dc': '3 nós · Supernó (V + I)',
      'ladder-4node': '4 nós · Rede em escada',
      'voltage-divider': '2 nós · Divisor de tensão',
      'current-divider': '2 nós · Divisor de corrente',
      'mixed-sources': '2 nós · Fontes V e I',
      'ring-5node': '5 nós · Rede malhada'
    },
    presetDescriptions: {
      'two-node-current': 'Duas fontes de corrente alimentando uma rede resistiva em T.',
      'wheatstone-bridge': 'Ponte equilibrada: o resistor central não conduz corrente.',
      'supernode-dc': 'Uma fonte de tensão flutuante liga os nós 1 e 2 (supernó, MNA).',
      'ladder-4node': 'Rede em escada: cada estágio divide a tensão.',
      'voltage-divider': 'Dois resistores em série: V2 = V1·R2/(R1+R2) = 7,5 V.',
      'current-divider': 'A corrente da fonte se divide entre resistores em paralelo e um ramo série: V1 = 60/11 V, V2 = V1/2.',
      'mixed-sources': 'Uma fonte de tensão e uma de corrente atuando juntas.',
      'ring-5node': 'Cinco nós com um resistor de ligação, para testar o esquemático e a matriz.'
    },
    nodeCountLabel: 'Nós não-referência (excluindo GND = 0)',
    nodeOptions: [
      { value: 2, label: '2 (Nós 1, 2)' },
      { value: 3, label: '3 (Nós 1, 2, 3)' },
      { value: 4, label: '4 (Nós 1, 2, 3, 4)' },
      { value: 5, label: '5 (Nós 1 … 5)' }
    ],
    componentsLabel: 'Componentes',
    compCount: '{n} / {max}',
    conventionHint: 'Para I: corrente vai de De → Para. Para V: (+) em De, (−) em Para. Nó 0 é o Terra (GND).',
    fromNode: 'De',
    toNode: 'Para',
    gndOption: '0 (GND)',
    nodeOption: 'Nó {n}',
    valueLabel: 'Valor',
    removeTitle: 'Remover componente',
    solveBtn: 'Resolver circuito',
    resetBtn: 'Restaurar',
    resultsHeading: 'Esquemático e solução nodal',
    exportCsv: 'Exportar CSV',
    exportSvg: 'Exportar SVG',
    exportPng: 'Exportar PNG',
    shareBtn: 'Copiar link da configuração',
    shareUrlLabel: 'URL da configuração do circuito',
    copied: 'Link da configuração copiado.',
    copyFallback: 'Copie o link exibido abaixo.',
    exportError: 'Falha na exportação. Tente exportar SVG.',
    queryError: 'A URL de configuração é inválida. Circuito padrão restaurado.',
    solvedStatus: 'Resolvido: {nodes} nó(s), {branches} ramo(s) · Resíduo máx. LKC: {kcl} A · Diferença de potência: {pdiff} W.',
    schTitle: 'Esquemático do circuito resistivo com tensões nodais calculadas',
    schDesc: 'Diagrama SVG interativo exibindo nós 0 a N, componentes, tensões nodais e correntes de ramo.',
    totalDissipated: 'Potência nos resistores',
    totalSupplied: 'Potência das fontes',
    maxKcl: 'Resíduo máx. LKC',
    matrixHeading: 'Sistema de equações nodais',
    matrixPure: 'Formulação nodal pura G·v = i (condutâncias em S, correntes em A, tensões em V):',
    matrixMna: 'Sistema de Análise Nodal Modificada (MNA) com fonte(s) de tensão (G em S, B adimensional):',
    matrixLegend: 'Em cima: o mesmo sistema escrito com os elementos do seu circuito — cada linha é a LKC em um nó: 1/R dos resistores na diagonal (todos os que tocam o nó), −1/R fora da diagonal (resistores entre dois nós), ±1 para os terminais das fontes de tensão (+ em De, − em Para), correntes de fonte I (entrando no nó +, saindo −) e tensões de fonte V à direita. Embaixo: as mesmas equações com números.',
    kclSummary: 'Equações da LKC nó a nó (corrente saindo = 0)',
    branchSummary: 'Correntes, tensões e potências nos ramos',
    branchHeaders: ['ID', 'Tipo', 'De → Para', 'Valor', 'V_de − V_para (V)', 'Corrente (A)', 'Potência (W)'],
    typeNames: { R: 'Resistor (Ω)', I: 'Fonte I (A)', V: 'Fonte V (V)' },
    powerDissipatedTag: 'dissipada',
    powerSuppliedTag: 'fornecida',
    powerAbsorbedTag: 'absorvida',
    docEqTitle: 'Equações e convenções',
    docEqText: 'Em cada nó não-referência k ∈ {1,…,N}, a Lei das Correntes de Kirchhoff (LKC) exige que a soma algébrica das correntes que deixam o nó seja nula. Cada resistor R entre os nós a e b contribui com a condutância g = 1/R em G. Fontes de corrente independentes compõem o vetor i. Fontes de tensão independentes adicionam variáveis auxiliares de corrente i_V via matriz de incidência B (Análise Nodal Modificada, MNA), tratando uniformemente fontes aterradas e flutuantes (supernós).',
    docMethodTitle: 'Método numérico',
    docMethodText: 'O sistema linear é montado em ponto flutuante de precisão dupla IEEE-754 (unidades SI internas: Ω, S, A, V, W) e resolvido por eliminação gaussiana com pivoteamento parcial. Topologias singulares ou mal-condicionadas (como malhas de fontes de tensão ou subcircuitos sem caminho CC ao terra) são detectadas quando o pivô fica abaixo de 10⁻¹².',
    docLimitsTitle: 'Hipóteses e limitações',
    docLimitsText: 'Regime permanente CC linear com elementos concentrados ideais. Fontes dependentes, elementos não-lineares, elementos reativos (L, C) e tolerâncias não são modelados nesta versão. Limite de 5 nós não-referência e 24 componentes.',
    docRefTitle: 'Referências e validação',
    docRefText: 'Formulação baseada em Ho, Ruehli & Brennan (1975), "The Modified Nodal Approach to Network Analysis", IEEE Trans. Circuits and Systems, e textos clássicos de análise de circuitos (Sadiku, Nilsson & Riedel). Testes e evidência de verificação analítica:',
    validationLink: 'docs/validation/nodal-analysis.md ↗',
    errors: {
      INVALID_CIRCUIT: 'Configuração de circuito inválida.',
      INVALID_NODE_COUNT: 'O número de nós deve estar entre 2 e 5.',
      INVALID_COMPONENT_COUNT: 'Adicione entre 1 e 24 componentes.',
      INVALID_COMPONENT: 'Entrada de componente inválida.',
      INVALID_TYPE: 'Tipo de componente não suportado.',
      INVALID_NODE: 'O componente referencia um nó inválido.',
      SELF_LOOP: 'Um componente não pode ligar um nó a ele mesmo.',
      NON_FINITE_VALUE: 'Todos os valores devem ser números finitos.',
      RESISTANCE_RANGE: 'A resistência deve estar entre 0,001 Ω e 10⁹ Ω.',
      CURRENT_RANGE: 'A fonte de corrente deve estar entre −10⁴ A e 10⁴ A.',
      VOLTAGE_RANGE: 'A fonte de tensão deve estar entre −10⁴ V e 10⁴ V.',
      DISCONNECTED_NODE: 'Todos os nós precisam ter caminho até o terra (nó 0).',
      SINGULAR_SYSTEM: 'Matriz singular: verifique se há malha de fontes de tensão ou nós sem caminho CC ao terra.'
    }
  },
  es: {
    docTitle: 'Análisis nodal · EEVL',
    mnaOr: 'o',
    nodeWord: 'Nodo',
    typeLabel: 'Tipo',
    eyebrow: 'EEVL / CIRCUITOS ELÉCTRICOS / ANÁLISIS NODAL · v1.0.0',
    title: 'Análisis nodal de circuitos resistivos',
    desc: 'Construya circuitos lineales de CC con resistencias y fuentes de corriente y tensión. Calcule tensiones nodales, corrientes de rama, balance de potencia y la matriz nodal / MNA.',
    badge: 'Verificado analíticamente · LCK y MNA',
    configHeading: 'Editor de circuitos', presetsLabel: 'Ejemplos',
    presets: {
      'two-node-current': '2 nodos · Fuentes de corriente', 'wheatstone-bridge': '3 nodos · Puente de Wheatstone',
      'supernode-dc': '3 nodos · Supernodo (V + I)', 'ladder-4node': '4 nodos · Red en escalera',
      'voltage-divider': '2 nodos · Divisor de tensión', 'current-divider': '2 nodos · Divisor de corriente',
      'mixed-sources': '2 nodos · Fuentes V e I', 'ring-5node': '5 nodos · Red mallada'
    },
    presetDescriptions: {
      'two-node-current': 'Dos fuentes de corriente alimentan una red resistiva en T.',
      'wheatstone-bridge': 'Puente equilibrado: no circula corriente por la resistencia central.',
      'supernode-dc': 'Una fuente de tensión flotante conecta los nodos 1 y 2 (supernodo, MNA).',
      'ladder-4node': 'Red en escalera: cada etapa divide la tensión.',
      'voltage-divider': 'Dos resistencias en serie: V2 = V1·R2/(R1+R2) = 7,5 V.',
      'current-divider': 'La corriente se divide entre resistencias en paralelo y una rama en serie: V1 = 60/11 V, V2 = V1/2.',
      'mixed-sources': 'Una fuente de tensión y otra de corriente actúan juntas.',
      'ring-5node': 'Cinco nodos con una resistencia de puente para comprobar el esquema y la matriz.'
    },
    nodeCountLabel: 'Nodos no de referencia (sin contar GND = 0)',
    nodeOptions: [{value:2,label:'2 (nodos 1, 2)'},{value:3,label:'3 (nodos 1, 2, 3)'},{value:4,label:'4 (nodos 1, 2, 3, 4)'},{value:5,label:'5 (nodos 1 … 5)'}],
    componentsLabel: 'Componentes', compCount: '{n} / {max}',
    conventionHint: 'Para I: la corriente va de Desde → Hacia. Para V: (+) en Desde, (−) en Hacia. El nodo 0 es tierra (GND).',
    fromNode: 'Desde', toNode: 'Hacia', gndOption: '0 (GND)', nodeOption: 'Nodo {n}', valueLabel: 'Valor',
    removeTitle: 'Eliminar componente', solveBtn: 'Resolver circuito', resetBtn: 'Restablecer',
    resultsHeading: 'Esquema y solución nodal', exportCsv: 'Exportar CSV', exportSvg: 'Exportar SVG', exportPng: 'Exportar PNG',
    shareBtn: 'Copiar enlace de configuración', copied: 'Enlace de configuración copiado.', copyFallback: 'Copie la URL que aparece abajo.',
    shareUrlLabel: 'URL de configuración del circuito',
    exportError: 'Error al exportar. Pruebe a exportar como SVG.', queryError: 'La configuración de la URL no es válida. Se restauró el circuito predeterminado.',
    solvedStatus: 'Resueltos {nodes} nodo(s), {branches} rama(s) · Residuo máximo de LCK: {kcl} A · Diferencia de balance de potencia: {pdiff} W.',
    schTitle: 'Esquema del circuito resistivo con tensiones nodales calculadas', schDesc: 'Diagrama SVG interactivo con nodos 0 a N, componentes, tensiones nodales y corrientes de rama.',
    totalDissipated: 'Potencia disipada en resistencias', totalSupplied: 'Potencia suministrada por fuentes', maxKcl: 'Residuo máximo de LCK',
    matrixHeading: 'Sistema de ecuaciones nodales',
    matrixPure: 'Formulación nodal pura G·v = i (conductancias en S, corrientes en A, tensiones en V):',
    matrixMna: 'Sistema de análisis nodal modificado (MNA) con fuente(s) de tensión (G en S, B adimensional):',
    matrixLegend: 'Arriba: el sistema escrito con los elementos del circuito; cada fila es la LCK de un nodo: 1/R de las resistencias en la diagonal, −1/R fuera de ella, ±1 para los terminales de fuentes de tensión (+ en Desde, − en Hacia), corrientes I (entran +, salen −) y tensiones V a la derecha. Abajo: las mismas ecuaciones con valores numéricos.',
    kclSummary: 'Ecuaciones de LCK nodo por nodo (corriente saliente = 0)', branchSummary: 'Corrientes, tensiones y potencias de rama',
    branchHeaders: ['ID','Tipo','Desde → Hacia','Valor','V_desde − V_hacia (V)','Corriente (A)','Potencia (W)'],
    typeNames: {R:'Resistencia (Ω)',I:'Fuente de corriente (A)',V:'Fuente de tensión (V)'},
    powerDissipatedTag: 'disipada', powerSuppliedTag: 'suministrada', powerAbsorbedTag: 'absorbida',
    docEqTitle: 'Ecuaciones y convenciones',
    docEqText: 'En cada nodo no de referencia k ∈ {1,…,N}, la ley de corrientes de Kirchhoff (LCK) exige que la suma algebraica de las corrientes salientes sea cero. Cada resistencia R entre los nodos a y b aporta una conductancia g = 1/R a G. Las fuentes independientes de corriente forman el vector i. Las fuentes independientes de tensión añaden incógnitas auxiliares de corriente i_V mediante la matriz de incidencia B (análisis nodal modificado, MNA), que trata de forma uniforme las fuentes conectadas a tierra y flotantes (supernodos).',
    docMethodTitle: 'Método numérico',
    docMethodText: 'El sistema lineal se ensambla en coma flotante IEEE-754 de doble precisión (unidades SI internas: Ω, S, A, V, W) y se resuelve mediante eliminación gaussiana con pivoteo parcial. Se detectan topologías singulares o mal condicionadas cuando el pivote es menor que 10⁻¹².',
    docLimitsTitle: 'Hipótesis y limitaciones', docLimitsText: 'Régimen permanente lineal de CC con componentes ideales concentrados. No se modelan fuentes dependientes, componentes no lineales, elementos reactivos (L, C) ni tolerancias. Máximo de 5 nodos no de referencia y 24 componentes.',
    docRefTitle: 'Referencias y verificación', docRefText: 'Formulación basada en Ho, Ruehli y Brennan (1975), «The Modified Nodal Approach to Network Analysis», IEEE Trans. Circuits and Systems, y textos clásicos de análisis de circuitos (Sadiku, Nilsson y Riedel). Pruebas y evidencia de verificación analítica:',
    validationLink: 'docs/validation/nodal-analysis.md ↗',
    errors: {
      INVALID_CIRCUIT:'Configuración de circuito no válida.', INVALID_NODE_COUNT:'El número de nodos debe estar entre 2 y 5.',
      INVALID_COMPONENT_COUNT:'Añada entre 1 y 24 componentes.', INVALID_COMPONENT:'Entrada de componente no válida.',
      INVALID_TYPE:'Tipo de componente no compatible.', INVALID_NODE:'El componente hace referencia a un nodo no válido.',
      SELF_LOOP:'Un componente no puede conectar un nodo consigo mismo.', NON_FINITE_VALUE:'Todos los valores deben ser números finitos.',
      RESISTANCE_RANGE:'La resistencia debe estar entre 0,001 Ω y 10⁹ Ω.', CURRENT_RANGE:'La fuente de corriente debe estar entre −10⁴ A y 10⁴ A.',
      VOLTAGE_RANGE:'La fuente de tensión debe estar entre −10⁴ V y 10⁴ V.', DISCONNECTED_NODE:'Todos los nodos deben tener un camino a tierra (nodo 0).',
      SINGULAR_SYSTEM:'Matriz singular: compruebe si hay lazos de fuentes de tensión o nodos sin camino de CC a tierra.'
    }
  }
};

const $ = selector => document.querySelector(selector);
const SVG_NS = 'http://www.w3.org/2000/svg';

let state = {
  presetId: PRESETS[0].id,
  nodeCount: defaults.nodeCount,
  components: structuredClone(defaults.components)
};
let lastSolution = null;

function tr() {
  return TEXT[language] || TEXT.en;
}

function fmt(num, digits = 4) {
  if (!Number.isFinite(num)) return '—';
  const abs = Math.abs(num);
  if (abs === 0) return '0';
  if (abs >= 1e4 || abs < 1e-3) return num.toExponential(3);
  return Number(num.toFixed(digits)).toString();
}

function fmtUnit(value, type) {
  const unit = type === 'R' ? 'Ω' : type === 'I' ? 'A' : 'V';
  if (type === 'R' && value >= 1000) {
    if (value >= 1e6) return `${fmt(value / 1e6, 3)} MΩ`;
    return `${fmt(value / 1e3, 3)} kΩ`;
  }
  return `${fmt(value, 3)} ${unit}`;
}

function nextId(type) {
  const used = new Set(state.components.map(c => c.id));
  let idx = 1;
  while (used.has(`${type}${idx}`)) idx++;
  return `${type}${idx}`;
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
      state = {
        presetId: preset.id,
        nodeCount: preset.nodeCount,
        components: structuredClone(preset.components)
      };
      renderAll();
      solveAndRender();
    });
    container.appendChild(btn);
  }
  const desc = $('#preset-desc');
  if (desc) desc.textContent = (dict.presetDescriptions && dict.presetDescriptions[state.presetId]) || '';
}

function renderNodeSelect() {
  const dict = tr();
  const select = $('#node-count');
  select.replaceChildren();
  for (const opt of dict.nodeOptions) {
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

let solveTimer = 0;
function scheduleSolve() {
  clearTimeout(solveTimer);
  solveTimer = setTimeout(solveAndRender, 200);
}

function renderComponentList() {
  const dict = tr();
  $('#comp-count').textContent = dict.compCount
    .replace('{n}', String(state.components.length))
    .replace('{max}', String(LIMITS.maxComponents));

  const list = $('#component-list');
  list.replaceChildren();

  state.components.forEach((comp, idx) => {
    const row = document.createElement('div');
    row.className = 'comp-row';

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
    typeSel.setAttribute('aria-label', tr().typeLabel);
    for (const tCode of ['R', 'I', 'V']) {
      const o = document.createElement('option');
      o.value = tCode;
      o.textContent = tCode === 'R' ? 'R (Ω)' : tCode === 'I' ? 'I (A)' : 'V (V)';
      typeSel.appendChild(o);
    }
    typeSel.value = comp.type;
    typeSel.addEventListener('change', () => {
      comp.type = typeSel.value;
      if (comp.type === 'R' && !(comp.value > 0)) comp.value = 100;
      state.presetId = '';
      renderAll();
      solveAndRender();
    });

    const fromSel = buildNodeSelect(comp.from, dict.fromNode);
    fromSel.addEventListener('change', () => {
      comp.from = Number(fromSel.value);
      state.presetId = '';
      renderPresets();
      solveAndRender();
    });

    const toSel = buildNodeSelect(comp.to, dict.toNode);
    toSel.addEventListener('change', () => {
      comp.to = Number(toSel.value);
      state.presetId = '';
      renderPresets();
      solveAndRender();
    });

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

    row.dataset.type = comp.type;
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
    list.appendChild(row);
  });

  const atMax = state.components.length >= LIMITS.maxComponents;
  $('#add-r').disabled = atMax;
  $('#add-i').disabled = atMax;
  $('#add-v').disabled = atMax;
}

function renderStaticTexts() {
  const dict = tr();
  document.title = dict.docTitle;
  $('#eyebrow').textContent = dict.eyebrow;
  $('#page-title').textContent = dict.title;
  $('#page-desc').textContent = dict.desc;
  $('#verified-badge').textContent = dict.badge;
  $('#config-heading').textContent = dict.configHeading;
  $('#presets-label').textContent = dict.presetsLabel;
  $('#node-count-label').textContent = dict.nodeCountLabel;
  $('#components-label').textContent = dict.componentsLabel;
  $('#convention-hint').textContent = dict.conventionHint;
  $('#solve-btn').textContent = dict.solveBtn;
  $('#reset-btn').textContent = dict.resetBtn;
  $('#results-heading').textContent = dict.resultsHeading;
  $('#export-csv').textContent = dict.exportCsv;
  $('#export-svg').textContent = dict.exportSvg;
  $('#export-png').textContent = dict.exportPng;
  $('#share-btn').textContent = dict.shareBtn;
  $('#share-url').setAttribute('aria-label', dict.shareUrlLabel);
  $('#sch-title').textContent = dict.schTitle;
  $('#sch-desc').textContent = dict.schDesc;
  $('#matrix-heading').textContent = dict.matrixHeading;
  $('#kcl-summary').textContent = dict.kclSummary;
  $('#branch-summary').textContent = dict.branchSummary;

  const thead = $('#branch-thead');
  thead.replaceChildren();
  for (const h of dict.branchHeaders) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    thead.appendChild(th);
  }

  $('#doc-eq-title').textContent = dict.docEqTitle;
  $('#doc-eq-text').textContent = dict.docEqText;
  $('#doc-method-title').textContent = dict.docMethodTitle;
  $('#doc-method-text').textContent = dict.docMethodText;
  $('#doc-limits-title').textContent = dict.docLimitsTitle;
  $('#doc-limits-text').textContent = dict.docLimitsText;
  $('#doc-ref-title').textContent = dict.docRefTitle;
  $('#doc-ref-text').textContent = dict.docRefText;
  $('#validation-link').textContent = dict.validationLink;

  katex.render(
    String.raw`\mathbf{G}\mathbf{v} = \mathbf{i} \quad\text{${dict.mnaOr} (MNA)}\quad \begin{bmatrix}\mathbf{G} & \mathbf{B}\\\mathbf{B}^T & \mathbf{0}\end{bmatrix}\begin{bmatrix}\mathbf{v}\\\mathbf{i}_V\end{bmatrix} = \begin{bmatrix}\mathbf{i}\\\mathbf{e}\end{bmatrix}`,
    $('#doc-katex'),
    { displayMode: true, throwOnError: false }
  );
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function drawComponentSymbol(g, comp, mx, my, angleDeg, branchInfo, inkColor, blueColor, bgColor, vertical = false) {
  const grp = svgEl('g', { transform: `translate(${mx},${my})` });

  if (comp.type === 'R') {
    const sym = svgEl('g', { transform: `rotate(${angleDeg})` });
    sym.appendChild(svgEl('rect', {
      x: -20, y: -8, width: 40, height: 16, rx: 2,
      fill: bgColor, stroke: 'none'
    }));
    sym.appendChild(svgEl('path', {
      d: 'M-20 0 L-15 -6 L-9 6 L-3 -6 L3 6 L9 -6 L15 6 L20 0',
      fill: 'none', stroke: inkColor, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));
    grp.appendChild(sym);
  } else {
    grp.appendChild(svgEl('circle', {
      cx: 0, cy: 0, r: 16,
      fill: bgColor, stroke: blueColor, 'stroke-width': 1.8
    }));
    if (comp.type === 'I') {
      const sym = svgEl('g', { transform: `rotate(${angleDeg})` });
      sym.appendChild(svgEl('path', {
        d: 'M-10 0 L8 0 M3 -5 L9 0 L3 5',
        fill: 'none', stroke: blueColor, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      grp.appendChild(sym);
    } else {
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * 7;
      const dy = Math.sin(rad) * 7;
      // `+` near `from` (behind the direction angle), `−` near `to`.
      const plus = svgEl('text', {
        x: (-dx).toFixed(1), y: (-dy + 4).toFixed(1),
        'text-anchor': 'middle', fill: blueColor, 'font-size': '12', 'font-weight': '700'
      });
      plus.textContent = '+';
      const minus = svgEl('text', {
        x: dx.toFixed(1), y: (dy + 4).toFixed(1),
        'text-anchor': 'middle', fill: blueColor, 'font-size': '12', 'font-weight': '700'
      });
      minus.textContent = '−';
      grp.append(plus, minus);
    }
  }

  // Horizontal branches: name, current value and, right below it, an arrow along the wire.
  // Vertical branches: arrow along the wire (x = 22) with the labels to its right.
  const tx = vertical ? 34 : 0;
  const anchor = vertical ? 'start' : 'middle';
  const label = svgEl('text', {
    x: tx, y: vertical ? -4 : -47, 'text-anchor': anchor,
    fill: inkColor, 'font-size': '11', 'font-weight': '600',
    'font-family': '"Segoe UI", Arial, sans-serif'
  });
  label.textContent = `${comp.id}: ${fmtUnit(comp.value, comp.type)}`;
  grp.appendChild(label);

  if (branchInfo) {
    // branchInfo.current is the current through the element in the From → To direction.
    const flow = branchInfo.current;
    const curLabel = svgEl('text', {
      x: tx, y: vertical ? 10 : -34, 'text-anchor': anchor,
      fill: blueColor, 'font-size': '10',
      'font-family': 'Consolas, monospace'
    });
    curLabel.textContent = `${fmt(Math.abs(flow), 3)} A`;
    grp.appendChild(curLabel);
    if (Math.abs(flow) > 1e-12) {
      const theta = angleDeg + (flow >= 0 ? 0 : 180);
      const half = vertical ? 12 : 14;
      const arrow = svgEl('g', {
        transform: vertical ? `translate(22,3) rotate(${theta})` : `translate(0,-24) rotate(${theta})`
      });
      arrow.appendChild(svgEl('path', {
        d: `M${-half} 0 H${half} M${half - 5} -3.5 L${half} 0 L${half - 5} 3.5`,
        fill: 'none', stroke: blueColor, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      grp.appendChild(arrow);
    }
  }

  g.appendChild(grp);
}

/**
 * Layout (classic ladder drawing, everything on one bus so connectivity reads at a glance):
 *  - nodes 1…N are dots on a single horizontal bus at y = nodeY, left to right;
 *  - the first branch between neighbouring nodes is drawn inline on the bus;
 *  - branches to GND drop vertically from the bus (the first one exactly under the node dot,
 *    extra ones every 110 px to the right), with labels beside the wire;
 *  - any other branch between two nodes (parallel or non-adjacent) is a rectangular arc above the
 *    bus, one level per overlapping span, attached to the same vertical line over each node;
 *  - the node tag (name + voltage) sits below-left of the dot.
 * Width and height adapt to the number of legs and levels.
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
  const LEG = 110;
  const GAP = 180;      // distance from the last leg of a node to the next node dot
  const MARGIN = 70;

  // Classify branches (invalid entries are skipped here; the solver reports them).
  const ground = Array.from({ length: N + 1 }, () => []);
  const inline = Array(N + 1).fill(null); // inline[k] joins node k and k + 1
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

  // Horizontal positions. The first ground leg is under the dot.
  const nodeX = [0];
  const lastLeg = [0];
  let cursor = MARGIN + 80;
  for (let k = 1; k <= N; k++) {
    nodeX[k] = cursor;
    lastLeg[k] = cursor + (Math.max(1, ground[k].length) - 1) * LEG;
    cursor = lastLeg[k] + GAP;
  }
  const W = Math.max(720, lastLeg[N] + 130);

  // Arc levels (interval colouring; arcs that only touch at a node may share a level).
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

  // Ground rail and symbol.
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
  const gndText = svgEl('text', {
    x: gx, y: gndY + 46, 'text-anchor': 'middle',
    fill: muted, 'font-size': '11', 'font-weight': '600', 'font-family': '"Segoe UI", Arial, sans-serif'
  });
  gndText.textContent = 'GND (0 V)';
  content.appendChild(gndText);

  const wireLayer = svgEl('g');
  const compLayer = svgEl('g');
  const nodeLayer = svgEl('g');
  content.append(wireLayer, compLayer, nodeLayer);
  const wire = d => wireLayer.appendChild(svgEl('path', {
    d, fill: 'none', stroke: muted, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
  }));
  const info = idx => (solution ? solution.branches[idx] : null);

  // Bus: from each node's dot through its legs, and inline components between neighbours.
  for (let k = 1; k <= N; k++) {
    wire(`M${nodeX[k]} ${nodeY} H${lastLeg[k]}`);
    if (k < N) {
      const a = lastLeg[k];
      const b = nodeX[k + 1];
      if (inline[k]) {
        const entry = inline[k];
        wire(`M${a} ${nodeY} H${b}`);
        drawComponentSymbol(compLayer, entry.comp, (a + b) / 2, nodeY, entry.comp.from < entry.comp.to ? 0 : 180,
          info(entry.idx), ink, blue, bg, false);
      }
    }
  }

  // Arcs rise from the node dot (the same vertical line for every arc at that node).
  for (const arc of arcs) {
    const xa = nodeX[arc.lo];
    const xb = nodeX[arc.hi];
    const y = arcY(arc.level);
    wire(`M${xa} ${nodeY} V${y} H${xb} V${nodeY}`);
    drawComponentSymbol(compLayer, arc.comp, (xa + xb) / 2, y, arc.comp.from < arc.comp.to ? 0 : 180,
      info(arc.idx), ink, blue, bg, false);
    for (const x of [xa, xb]) {
      nodeLayer.appendChild(svgEl('circle', { cx: x, cy: nodeY, r: 3, fill: muted }));
    }
  }

  // Ground legs.
  for (let k = 1; k <= N; k++) {
    ground[k].forEach((entry, r) => {
      const x = nodeX[k] + r * LEG;
      wire(`M${x} ${nodeY} V${gndY}`);
      if (r > 0) nodeLayer.appendChild(svgEl('circle', { cx: x, cy: nodeY, r: 3, fill: muted }));
      drawComponentSymbol(compLayer, entry.comp, x, (nodeY + gndY) / 2, entry.comp.from === k ? 90 : -90,
        info(entry.idx), ink, blue, bg, true);
    });
  }

  // Node dots and voltage tags (below-left of the dot so wires never cross them).
  for (let k = 1; k <= N; k++) {
    nodeLayer.appendChild(svgEl('circle', { cx: nodeX[k], cy: nodeY, r: 6, fill: blue, stroke: paper, 'stroke-width': 2 }));
    const tx = nodeX[k] - 14;
    nodeLayer.appendChild(svgEl('rect', {
      x: tx - 66, y: nodeY + 14, width: 66, height: 36, rx: 5, fill: paper, stroke: lineCol, 'stroke-width': 1
    }));
    const name = svgEl('text', {
      x: tx - 33, y: nodeY + 29, 'text-anchor': 'middle', fill: muted, 'font-size': '10', 'font-weight': '600',
      'font-family': '"Segoe UI", Arial, sans-serif'
    });
    name.textContent = tr().nodeOption.replace('{n}', k);
    const volt = svgEl('text', {
      x: tx - 33, y: nodeY + 44, 'text-anchor': 'middle', fill: ink, 'font-size': '11', 'font-weight': '700',
      'font-family': 'Consolas, monospace'
    });
    volt.textContent = solution ? `${fmt(solution.nodeVoltages[k], 3)} V` : '—';
    nodeLayer.append(name, volt);
  }

  svg.dataset.ready = '1';
}

function latexNum(n) {
  if (Math.abs(n) < 1e-12) return '0';
  return fmt(n, 4);
}

function renderMatrixMath(solution) {
  const dict = tr();
  const m = solution.matrix;
  $('#matrix-subtitle').textContent = m.pureNodal ? dict.matrixPure : dict.matrixMna;

  const matToTex = mat =>
    `\\begin{bmatrix}${mat.map(row => row.map(latexNum).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
  const vecToTex = vec =>
    `\\begin{bmatrix}${vec.map(latexNum).join(' \\\\ ')}\\end{bmatrix}`;

  const unknownVars = [];
  for (let k = 1; k <= solution.nodeCount; k++) unknownVars.push(`v_${k}`);
  for (let k = 1; k <= m.e.length; k++) unknownVars.push(`i_{V${k}}`);

  const varVec = `\\begin{bmatrix}${unknownVars.join(' \\\\ ')}\\end{bmatrix}`;
  const eqLatex = `${matToTex(m.A)} ${varVec} = ${vecToTex(m.b)} \\implies ${varVec} = ${vecToTex(m.solution)}`;

  // Symbolic system written with the circuit's own elements, then the numeric system below it.
  const sc = symbolicTerms({ nodeCount: solution.nodeCount, components: state.components });
  const name = id => {
    const parts = /^([A-Za-z]+)(\d+)$/.exec(id);
    return parts ? `${parts[1]}_{${parts[2]}}` : `\\mathrm{${id.replace(/[^A-Za-z0-9]/g, '')}}`;
  };
  const termTex = t => (t.kind === 'invR' ? `\\frac{1}{${name(t.id)}}` : t.kind === 'unit' ? '1' : name(t.id));
  const sumTex = list => {
    if (!list.length) return '0';
    return list.map((t, i) => `${t.sign < 0 ? '-' : i ? '+' : ''}${termTex(t)}`).join('');
  };
  const symUnknowns = [];
  for (let k = 1; k <= solution.nodeCount; k++) symUnknowns.push(`v_{${k}}`);
  for (const id of sc.voltageSourceIds) symUnknowns.push(`i_{${name(id)}}`);
  const symVec = `\\begin{bmatrix}${symUnknowns.join(' \\\\ ')}\\end{bmatrix}`;
  const symMat = `\\begin{bmatrix}${sc.A.map(row => row.map(sumTex).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
  const symRhs = `\\begin{bmatrix}${sc.b.map(sumTex).join(' \\\\ ')}\\end{bmatrix}`;
  const symLatex = `{\\small ${symMat} ${symVec} = ${symRhs}}`;
  const target = $('#matrix-katex');
  target.replaceChildren();
  for (const tex of [symLatex, eqLatex]) {
    const block = document.createElement('div');
    block.className = 'matrix-block';
    target.appendChild(block);
    katex.render(tex, block, { displayMode: true, throwOnError: false });
  }
  const note = document.createElement('p');
  note.className = 'matrix-legend';
  note.textContent = dict.matrixLegend;
  target.appendChild(note);

  // Node-by-node KCL equations
  const kclContainer = $('#kcl-list');
  kclContainer.replaceChildren();
  for (let r = 0; r < solution.nodeCount; r++) {
    const terms = [];
    for (let c = 0; c < solution.nodeCount; c++) {
      const coeff = m.A[r][c];
      if (Math.abs(coeff) < 1e-12) continue;
      const absC = latexNum(Math.abs(coeff));
      const sign = coeff < 0 ? '-' : terms.length > 0 ? '+' : '';
      terms.push(`${sign}${absC}\\,v_${c + 1}`);
    }
    for (let k = 0; k < m.e.length; k++) {
      const coeff = m.A[r][solution.nodeCount + k];
      if (Math.abs(coeff) < 1e-12) continue;
      const sign = coeff < 0 ? '-' : terms.length > 0 ? '+' : '';
      terms.push(`${sign}i_{V${k + 1}}`);
    }
    const lhs = terms.length ? terms.join(' ') : '0';
    const rhs = latexNum(m.b[r]);
    const div = document.createElement('div');
    div.className = 'kcl-item';
    katex.render(`\\text{${dict.nodeWord} } ${r + 1}:\\quad ${lhs} = ${rhs}`, div, { displayMode: false, throwOnError: false });
    kclContainer.appendChild(div);
  }
}

function renderResults(solution) {
  const dict = tr();
  const metrics = $('#node-metrics');
  metrics.replaceChildren();

  for (let k = 1; k <= solution.nodeCount; k++) {
    const card = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.textContent = `V${k}`;
    const val = document.createElement('strong');
    val.textContent = `${fmt(solution.nodeVoltages[k], 4)} V`;
    card.append(lbl, val);
    metrics.appendChild(card);
  }

  const summaryCards = [
    { label: dict.totalDissipated, value: `${fmt(solution.totalDissipated, 4)} W` },
    { label: dict.totalSupplied, value: `${fmt(solution.totalSupplied, 4)} W` },
    { label: dict.maxKcl, value: `${solution.maxKclResidual.toExponential(2)} A` }
  ];
  for (const item of summaryCards) {
    const card = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.textContent = item.label;
    const val = document.createElement('strong');
    val.textContent = item.value;
    card.append(lbl, val);
    metrics.appendChild(card);
  }

  const tbody = $('#branch-tbody');
  tbody.replaceChildren();
  for (const b of solution.branches) {
    const row = document.createElement('tr');
    const pText = b.type === 'R'
      ? `${fmt(b.powerDissipated, 4)} (${dict.powerDissipatedTag})`
      : `${fmt(Math.abs(b.powerSupplied), 4)} (${b.powerSupplied >= 0 ? dict.powerSuppliedTag : dict.powerAbsorbedTag})`;

    const cells = [
      b.id,
      dict.typeNames[b.type],
      `${b.from} → ${b.to}`,
      fmtUnit(b.value, b.type),
      fmt(b.voltageDrop, 4),
      fmt(b.type === 'V' ? -b.current : b.current, 4),
      pText
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }

  renderMatrixMath(solution);

  $('#status-msg').textContent = dict.solvedStatus
    .replace('{nodes}', String(solution.nodeCount))
    .replace('{branches}', String(solution.branches.length))
    .replace('{kcl}', solution.maxKclResidual.toExponential(2))
    .replace('{pdiff}', solution.powerBalanceError.toExponential(2));
}

function solveAndRender() {
  const dict = tr();
  const errEl = $('#error');
  try {
    const solution = solveNodalCircuit(state);
    lastSolution = solution;
    errEl.hidden = true;
    errEl.textContent = '';
    renderSchematic(solution);
    renderResults(solution);
  } catch (err) {
    lastSolution = null;
    errEl.hidden = false;
    errEl.textContent = dict.errors[err.code] || err.message;
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
}

function encodeShareUrl() {
  const payload = { n: state.nodeCount, c: state.components.map(c => [c.id, c.type, c.from, c.to, c.value]) };
  const params = new URLSearchParams();
  params.set('circuit', JSON.stringify(payload));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function loadFromUrl() {
  const params = new URLSearchParams(location.search);
  const raw = params.get('circuit');
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isInteger(parsed.n) || !Array.isArray(parsed.c)) throw new Error('bad');
    const comps = parsed.c.map(item => ({
      id: String(item[0]),
      type: String(item[1]),
      from: Number(item[2]),
      to: Number(item[3]),
      value: Number(item[4])
    }));
    const candidate = { nodeCount: parsed.n, components: comps };
    solveNodalCircuit(candidate);
    state = { presetId: '', ...candidate };
    return true;
  } catch {
    return false;
  }
}

function exportCsv() {
  if (!lastSolution) return;
  const lines = ['Section,ID/Node,Type,From,To,Value,Voltage_V,Current_A,Power_W'];
  for (let k = 1; k <= lastSolution.nodeCount; k++) {
    lines.push(`Node,V${k},Node,${k},0,,${lastSolution.nodeVoltages[k]},,`);
  }
  for (const b of lastSolution.branches) {
    const iVal = b.type === 'V' ? -b.current : b.current;
    const pVal = b.type === 'R' ? b.powerDissipated : b.powerSupplied;
    lines.push(`Branch,${b.id},${b.type},${b.from},${b.to},${b.value},${b.voltageDrop},${iVal},${pVal}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nodal-analysis.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportSvg() {
  const svg = $('#schematic');
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nodal-circuit.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPng() {
  const svg = $('#schematic');
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const img = new Image();
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const box = svg.viewBox.baseVal;
    canvas.width = 2 * box.width;
    canvas.height = Math.round(2 * box.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      if (!pngBlob) {
        $('#status-msg').textContent = tr().exportError;
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pngBlob);
      a.download = 'nodal-circuit.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    $('#status-msg').textContent = tr().exportError;
  };
  img.src = url;
}

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

  const addComponent = (type, defaultVal) => {
    if (state.components.length >= LIMITS.maxComponents) return;
    state.components.push({
      id: nextId(type),
      type,
      from: 1,
      to: 0,
      value: defaultVal
    });
    state.presetId = '';
    renderAll();
    solveAndRender();
  };

  $('#add-r').addEventListener('click', () => addComponent('R', 100));
  $('#add-i').addEventListener('click', () => addComponent('I', 1));
  $('#add-v').addEventListener('click', () => addComponent('V', 5));

  $('#solve-btn').addEventListener('click', solveAndRender);
  $('#reset-btn').addEventListener('click', () => {
    state = {
      presetId: PRESETS[0].id,
      nodeCount: defaults.nodeCount,
      components: structuredClone(defaults.components)
    };
    renderAll();
    solveAndRender();
  });

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

  document.addEventListener('languagechange', () => {
    renderAll();
    if (lastSolution) renderResults(lastSolution);
  });

  // Re-render schematic on theme change
  const observer = new MutationObserver(() => {
    renderSchematic(lastSolution);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

async function boot() {
  await initialize();
  const urlOk = loadFromUrl();
  renderAll();
  bindEvents();
  solveAndRender();
  if (!urlOk) {
    $('#status-msg').textContent = tr().queryError;
  }
}

boot();
