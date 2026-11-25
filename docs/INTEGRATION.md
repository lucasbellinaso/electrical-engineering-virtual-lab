# Integração dos arquivos fornecidos / Supplied-file integration

## Português

Durante a implementação surgiram cinco arquivos em três pastas do usuário.
Todos foram preservados; veja hashes SHA-256 em `provenance.json`.

| Original | Cópia de execução | Alterações |
|---|---|---|
| Control Systems/SisoApp - projeto de controladores.html | simulators/control-systems/siso/app.html | URL Plotly CDN → biblioteca local 2.35.2 |
| Power Electronics/simulador_buck.html | simulators/power-electronics/buck/app.html | Nenhuma; cópia idêntica |
| Power Electronics/dab_dinamico.html | simulators/power-electronics/dab/app.html | Nenhuma; cópia idêntica |
| Fundamental Eletronics and Electrical Circuits/laboratorio_ampop.html | simulators/analog-electronics/opamp/app.html | Nenhuma; cópia idêntica |
| Control Systems/Buck com PID.html | simulators/control-systems/buck-pid/app.html | Remoção dos dois links de fontes externas Google |

**Nenhum script numérico inline foi modificado.** O teste de preservação compara
todos esses scripts e as transformações exatas. A interface herdada não acompanha
o tema/idioma do portal. Cada `index.html` fornece apresentação bilíngue, retorno,
metadados, aviso de validação e iframe; abrir página inteira mantém as funções de
URL e exportação que cada original já oferece. Não foram adicionadas funções de
exportação ausentes aos modelos legados. O template exemplifica essas funções.

## Modelos: descrição por inspeção, sem certificação

- **SISO**: consulte `SISO.md`. Espaço de estados, Bode, lugar das raízes e
  respostas. Atribuição no próprio arquivo preservada.
- **Buck**: modelo chaveado ideal, CCM/DCM, RK4 e localização de cruzamento por
  zero; regime permanente e partida. Não contém um laboratório dedicado à resposta
  a degrau de razão cíclica. Este item permanece planejado no catálogo.
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

Five supplied HTML files were integrated. Three execution copies are byte-identical.
SISO changes only the Plotly script URL to a vendored copy of the same version;
Buck PID removes only two Google Fonts link tags. **All inline numerical scripts
remain identical.** The provenance and preservation test document these changes.

The independent wrappers are bilingual; inherited applications remain Portuguese-only
and retain their original appearance, model assumptions and numerical methods.
Scientific validation is experimental for all five; no independent evidence was
provided. Startup response in the Buck lab is not advertised as the missing dedicated
duty-cycle step laboratory. Exports and shared URLs depend on original capabilities.
The RC contributor template demonstrates the complete standard without altering
legacy numerical models. Large inherited calculations may still block their own UI.
