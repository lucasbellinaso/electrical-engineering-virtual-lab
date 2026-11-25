# Integração do SISO / SISO integration

## Português
O arquivo fornecido `Control Systems/SisoApp - projeto de controladores.html` permanece intacto.
O programa se identifica como SISO Design App, baseado no PythonSisoDesignApp,
Prof. Lucas V. Bellinaso, UFSM. A atribuição foi preservada, sem usar marcas institucionais.

`simulators/control-systems/siso/app.html` é uma cópia com **uma única substituição**:
Plotly 2.35.2 via CDN → `../../../assets/vendor/plotly-2.35.2.min.js`.
Os métodos numéricos, equações, parâmetros, hipóteses, estilos e interface do
programa fornecido não foram alterados. A página `index.html` ao lado é uma
apresentação bilíngue independente, com um iframe e abertura em página inteira.
O aplicativo original continua em português; isso está identificado no catálogo.

O fonte contém representação em espaço de estados, discretização ZOH por
exponencial matricial (Padé), busca de raízes, Bode, lugar das raízes e respostas
temporais. Essa descrição foi obtida por inspeção, não é validação dos algoritmos.
As hipóteses, controles e resultados devem ser consultados no aplicativo original.
Não foram fornecidas comparações analíticas, numéricas independentes ou medições
experimentais. Classificação atual: **experimental**. Não usar os testes de
preservação ou testes RC como evidência de validação do SISO.

Recrie a cópia com `python scripts/integrate-simulators.py`. Os hashes e a alteração
exata estão registrados em `docs/provenance.json`. A verificação automática desfaz
a substituição em memória e compara todos os bytes com o original.

Plotly é uma dependência herdada necessária aos gráficos existentes; sua licença
MIT está em `assets/vendor/plotly-LICENSE`. Não é carregada no catálogo. Uma visita
ao SISO com Service Worker ativo armazena a página e Plotly para acesso offline.
Na primeira visita ao site, aguarde a instalação do Service Worker e recarregue
antes de abrir o simulador. O armazenamento depende da quota e política do navegador.

## English
The supplied source is preserved byte for byte. The integrated `app.html` changes
only the Plotly 2.35.2 script URL from CDN to the local copy of the same version.
No mathematical model, algorithm, parameter or interface was changed. The bilingual
wrapper is independent; the original application is Portuguese only.

Source inspection identifies state-space models, ZOH discretization with a matrix
exponential (Padé), root finding, Bode, root locus and time responses. This is a
description of the source, not validation. Independent scientific evidence has not
been provided; the laboratory remains **experimental**. Source-preservation and RC
tests do not validate SISO. Author attribution is preserved from the supplied source.

See the provenance JSON for original, integrated and dependency SHA-256 hashes.
Plotly is vendored with its MIT license. Open the simulator online with the Service
Worker active to cache its resources; offline availability depends on browser storage.
