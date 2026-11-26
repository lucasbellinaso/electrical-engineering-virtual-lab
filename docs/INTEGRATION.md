# Integração dos arquivos fornecidos / Supplied-file integration

## Português

Durante a implementação foram recebidos seis arquivos em três pastas do usuário.
Todos foram preservados; veja hashes SHA-256 em `provenance.json`.

| Original | Cópia de execução | Alterações |
|---|---|---|
| Control Systems/SisoApp - projeto de controladores.html | simulators/control-systems/siso/app.html | URL Plotly CDN → biblioteca local 2.35.2; `renderRows()` retorna cedo enquanto `P` é `null` (correção de um `TypeError`, aprovada pelo autor) |
| Power Electronics/simulador_buck.html | simulators/power-electronics/buck/app.html | Nenhuma; cópia idêntica |
| Power Electronics/dab_dinamico.html | simulators/power-electronics/dab/app.html | Nenhuma; cópia idêntica |
| Fundamental Eletronics and Electrical Circuits/laboratorio_ampop.html | simulators/analog-electronics/opamp/app.html | Nenhuma; cópia idêntica |
| Control Systems/Buck com PID.html | simulators/control-systems/buck-pid/app.html | Remoção dos dois links Google Fonts; auxiliar local para escala Y acumulada, observando amostras já armazenadas e reinicializações, sem mudar funções numéricas |

| Power Electronics/buck_degrau.html | simulators/power-electronics/buck-step/app.html | Nenhuma; cópia idêntica |

**Os originais e seus hashes permanecem intactos.** O teste de preservação compara
os arquivos integrados com transformações exatas e explícitas sobre essas fontes.
No Buck PID, o script integrado inclui observação para apresentação acumulada dos
limites Y; corpos de PID, integração, `period`, `push`, `resetSim` e `resetBuf`
permanecem idênticos ao original. Os wrappers carregam
`assets/js/legacy-i18n.js`, uma prévia EN/ES por correspondência exata de
textos e padrões ancorados no iframe de mesma origem. A seleção PT-BR restaura
os textos originais mapeados. Fórmulas, cálculos numéricos, valores de entrada e autoria são
preservados. A camada inclui textos SVG/Plotly, rótulos canvas e mensagens de
diálogos; o código exportado continua original. O aviso identifica a prévia e os
seis registros continuam declarando PT-BR no catálogo até a revisão. O mecanismo
e seus limites estão em [I18N.md](I18N.md). A aparência herdada não acompanha o tema.
Cada `index.html` fornece apresentação no portal, retorno,
metadados, aviso de validação e iframe; abrir página inteira mantém as funções de
URL e exportação que cada original já oferece. Não foram adicionadas funções de
exportação ausentes aos modelos legados. O template exemplifica essas funções.

## Modelos: descrição por inspeção, sem certificação

- **SISO**: consulte `SISO.md`. Espaço de estados, Bode, lugar das raízes e
  respostas. Atribuição no próprio arquivo preservada.
- **Buck**: modelo chaveado ideal, CCM/DCM, RK4 e localização de cruzamento por
  zero; regime permanente e partida. Não contém a resposta a degrau de razão cíclica,
  que está no arquivo seguinte.
- **Buck · degrau de razão cíclica** (`buck-step`, `Power Electronics/buck_degrau.html`):
  chaveado ideal (CCM/DCM, RK4 com bloqueio aproximado de corrente negativa; condição
  inicial em regime permanente por iteração de ciclos) e modelo médio linear CCM
  (L di/dt = d·Vin − v; C dv/dt = i − v/R; G_vd(s) = Vin/(LC s² + Ls/R + 1)). Malha
  aberta, carga resistiva, componentes ideais. O degrau reinicia a fase do PWM e a
  decimação de pontos pode ocultar ondulação nos gráficos. Arquivo integrado sem
  alterações (hashes em `provenance.json`); o hash registrado é o do arquivo recebido
  como texto na conversa.
- **DAB**: pontes chaveadas, resistência ôhmica e capacitor com bateria; integração
  RK4 por intervalos de comutação e determinação de condição inicial periódica.
- **Amp-ops**: modelos ideais, topologias selecionáveis, resposta temporal e
  frequência de pequenos sinais; saturação aplicada à saída, sem modelo de
  recuperação interna. Consulte as limitações expressas no original.
- **Buck PID**: chaveamento, diodo, condução descontínua e controlador digital;
  o fonte declara RK2, 100 passos por período e anti-windup. Consulte o original
  para sua convenção de amostragem e atraso; ela não foi reinterpretada aqui.

Todos estão classificados como **experimentais**, sem evidência independente
fornecida. A integração não é uma revisão científica dos algoritmos. Modelos
pesados herdados podem bloquear a interface durante seus cálculos; por preservação,
não foram migrados silenciosamente a Workers. A exportação e o compartilhamento
dependem das funções do original; SISO mantém sua URL por fragmento.

Não foi atribuída autoria aos arquivos sem atribuição explícita. A licença MIT
do repositório cobre o código original do portal; esclarecer a procedência de
eventuais contribuições externas antes de redistribuí-las sob outra licença.

## English

## Escala acumulada do Buck PID (26/11/2026)

O auxiliar local [buck-pid-scale.js](../assets/js/buck-pid-scale.js) registra extremos
dos sinais armazenados após cada período de chaveamento, incluindo a referência
no painel de tensão. A faixa nunca contrai porque pontos antigos saíram do buffer.
Reiniciar ou a reinicialização automática por estado inválido limpa os acumuladores;
pausa, idioma, tamanho de tela e mudanças da janela/frequência mantêm as faixas.
A margem de 12% e a faixa fixa da razão cíclica são as do desenho original.

As alterações de apresentação estão limitadas por uma transformação exata e
revisável do original em [buck-pid-reference.mjs](../tests/helpers/buck-pid-reference.mjs),
além dos hashes de fonte e cópia integrada. O arquivo fonte, o PID, o RK2 e os corpos
das funções de integração/armazenamento não mudaram. A mudança do hash integrado
registra a edição; o hash original continua identificando o arquivo recebido.

Cinco testes específicos em [buck-pid-scale.test.mjs](../tests/buck-pid-scale.test.mjs)
cobrem expansão, retenção de extremos, sinais negativos/constantes, valores não
finitos, reinicialização e pontos de integração. A suíte completa em Node.js
v26.13.1 passou com 797 testes aprovados, nenhuma falha e um teste preexistente pulado.
No Edge 158.0.4370.45 headless, foram exercitados quadros que avançam mais tempo
que a janela móvel, pausa/continuação, mudança de janela/frequência, perturbação de
referência, idiomas, redimensionamento, reinicialização e recarga offline em `/EEVL/`.
Os avanços de quadro foram controlados pelo teste, mantendo o callback original da
simulação. Não se declara nova validação científica ou ensaio em dispositivo físico.

Após relato de contração na prévia local, uma sessão nova do Edge manteve os limites
durante execução normal e após uma perturbação de referência seguida do retorno ao
valor original. A contração relatada não foi reproduzida nessa sessão. Para tornar a
versão ativa identificável e reduzir o risco de código antigo em abas/cache, o wrapper
usa `app.html?scale=accumulated-2`, há um aviso traduzido junto ao gráfico e os recursos
de laboratórios revalidam o cache HTTP online. A suíte de regressão foi ampliada para
essa revalidação e o uso offline de URLs versionadas: 798 aprovados, nenhuma falha,
um teste preexistente pulado. Essa prevenção de cache não é evidência de que cache
tenha sido a causa do relato do usuário.
Na conferência posterior, o usuário confirmou que o aviso aparece e a escala
permanece após o transiente na prévia atualizada.

## English

Six supplied HTML files were integrated. Four execution copies are byte-identical.
SISO uses the same-version local Plotly and an initialization guard. Buck PID removes
two Google Fonts links and adds cumulative voltage/current Y limits through a local
presentation helper. Its numerical function bodies and immutable original source
remain unchanged. Exact source-to-integrated transformations and original/integrated
hashes are checked by the preservation test; integrated hashes record the edits.

The independent wrappers preview EN/ES controls, help, dynamic messages and
SVG/canvas plots inside the same-origin iframe. Exported code remains original.
Direct `app.html` access uses Portuguese, with the documented integration edits.
The catalog lists EN/PT-BR/ES for the reviewed partial translation wrappers. Original appearance,
model assumptions and numerical methods are preserved.
Scientific validation is experimental for all six; no independent evidence was
provided. The duty-cycle step laboratory (`buck-step`) was supplied later and is
integrated unchanged (Portuguese only). Exports and shared URLs depend on original
capabilities.
The RC contributor template demonstrates the complete standard without altering
legacy numerical models. Large inherited calculations may still block their own UI.

## Español

Los seis archivos originales y sus copias protegidas conservan los hashes registrados.
Los marcos cargan una vista previa EN/ES, reversible a PT-BR, sin editar algoritmos.
Incluye controles, ayuda, mensajes y gráficos SVG/canvas. El código exportado se
conserva; abrir `app.html` directamente usa portugués con los cambios de integración
documentados. El catálogo declara EN/PT-BR/ES para las traducciones parciales revisadas.
En Buck PID, los límites acumulados de tensión y corriente se expanden con nuevos
extremos sin contraerse al salir los datos de la ventana. Reiniciar borra la escala;
los cuerpos de las funciones numéricas y el archivo fuente original se conservan.
La clasificación experimental y las limitaciones científicas no cambian.
