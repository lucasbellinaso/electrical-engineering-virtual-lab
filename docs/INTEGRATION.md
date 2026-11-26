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
| Control Systems/Buck com PID.html | simulators/control-systems/buck-pid/app.html | Remoção dos dois links de fontes externas Google |

| Power Electronics/buck_degrau.html | simulators/power-electronics/buck-step/app.html | Nenhuma; cópia idêntica |

**Nenhum script numérico inline foi modificado.** O teste de preservação compara
todos esses scripts e as transformações exatas. Os wrappers agora carregam
`assets/js/legacy-i18n.js`, uma prévia EN/ES por correspondência exata de
textos e padrões ancorados no iframe de mesma origem. A seleção PT-BR restaura
os textos originais mapeados. Fórmulas, scripts, valores de entrada e autoria são
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

Six supplied HTML files were integrated. Four execution copies are byte-identical.
SISO changes only the Plotly script URL to a vendored copy of the same version;
Buck PID removes only two Google Fonts link tags. **All inline numerical scripts
remain identical.** The provenance and preservation test document these changes.

The independent wrappers preview EN/ES controls, help, dynamic messages and
SVG/canvas plots inside the same-origin iframe. Exported code remains original.
Direct `app.html` access preserves the Portuguese original. The six catalog entries
still list PT-BR pending preview review. Original appearance,
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
conserva; abrir `app.html` directamente muestra el original. Los metadatos siguen
declarando PT-BR durante la revisión de la vista previa.
La clasificación experimental y las limitaciones científicas no cambian.
