# Roadmap do EEVL

Planejamento incremental em 27/11/2026. Para contratos implementados consulte
[ARCHITECTURE.md](ARCHITECTURE.md) e [docs/API.md](docs/API.md). Propostas não são
funcionalidades prontas. Não criar módulos vazios nem implementar infraestrutura sem
consumidor ou testes. A [PR #27](https://github.com/lucasbellinaso/electrical-engineering-virtual-lab/pull/27)
é uma proposta de linguagem em rascunho, ainda não integrada e que precisa ser
harmonizada com [docs/LANGUAGE.md](docs/LANGUAGE.md).

## Estado verificado

| Área | Disponível ou parcial | Pendente |
|---|---|---|
| Aplicativos e PWA | 17 aplicativos; cache sob demanda e botão offline por aplicativo | Validar caminhos dinâmicos e limites de armazenamento por aplicativo |
| Matemática | Matrizes, complexos, FFT/Bluestein, filtros, interpolação 1D/2D, quantização, solvers, otimização BFGS e ajuste de curvas; veja a API | Integração de ODE com eventos, sistemas híbridos e demais funções quando houver caso concreto |
| Cálculo em segundo plano | Workers próprios em circuitos e magnetostática | Gerenciador comum, fila, cancelamento, progresso e limites |
| Arquivos | JSON e recuperação local por IndexedDB na busca de mínimo e no aplicativo fotovoltaico; Novo no fotovoltaico | Recentes, pasta opcional, permissões e múltiplos arquivos; adoção seletiva por aplicativo |
| Interface | Idiomas, temas, KaTeX, gráficos e componentes pontualmente compartilhados | Extrair controles repetidos de maneira gradual |
| Modelos e linguagem | Modelos puros em vários apps; parsers pontuais no SISO | Contrato comum, interpretador e motor genérico; proposta não executável |

## Ordem e divisão em pequenas PRs

1. **Arquivos e projetos:** JSON e recuperação explícita nos aplicativos de busca de mínimo e fotovoltaico; depois recentes e permissões; em seguida pasta opcional e
   múltiplos arquivos/ZIP, com migrações e testes. Evitar perda de dados e documentar
   que downloads não confirmam gravação. Não exigir pasta nem enviar dados ao GitHub.
2. **Workers:** inventariar protocolos existentes; extrair primeiro fila e cancelamento
   com um consumidor real; depois pool limitado, progresso e transferência de buffers.
   Cálculo sequencial não se torna automaticamente paralelo. Separar tempo virtual e real.
3. **Interface:** extrair controles de arquivos e progresso após validação do piloto;
   gradualmente campos numéricos, tabelas e gráficos comuns, com idiomas e temas.
4. **Benchmarks:** medições reproduzíveis de matrizes, integração, sistemas lineares,
   FFT e simulação; comparar precisão e desempenho com NumPy/SciPy e Numba quando
   possível. TypedArrays, reutilização de memória e workers conforme evidência;
   WebAssembly e WebGPU apenas para gargalos demonstrados e precisão adequada.
5. **Matemática:** avaliar ODE fixo/adaptativo, eventos, lookup tables, Jacobianas,
   transformações de coordenadas, quatérnions, Clarke/Park/Fortescue, por unidade e
   matrizes esparsas conforme aplicações reais. Documentar convenções e usar referências
   independentes; comparar contratos antes de extrair funções legadas do SISO.
6. **Modelos:** propor contrato independente do DOM para portas direcionais e físicas
   acausais, parâmetros, estados, unidades, dimensões, referenciais, eventos, versões e
   testes; validar com modelos existentes antes de criar registro ou motor universal.
7. **Diagramas:** especificar layout interno, símbolo externo e layout de instância;
   distinguir conexões de sinais e físicas, tipos, sistemas trifásicos, junções e temas.
   Protótipos pequenos primeiro, sem editor universal imediato.
8. **Visualização 3D:** infraestrutura independente do modelo e da linguagem; avaliar
   GLB/glTF, referenciais, quatérnions e sincronização. CesiumJS apenas quando houver
   uso georreferenciado concreto.
9. **Linguagem:** validar sintaxe proposta, parser/AST e representação intermediária
   tipada; sem `eval` ou `new Function`. A execução segue a proposta em
   [docs/SCRIPT-STUDIO.md](docs/SCRIPT-STUDIO.md): tradutor a partir de AST validada,
   JavaScript carregado num Worker por Blob URL, sob CSP. Já existem o lexer, o parser,
   a AST e o formatador de indentação (fase 1), as funções do core da seção 7.1 e a
   prova de conceito da fase 0; o tradutor, o runtime e a interface ainda não existem.
10. **Motor e editor:** somente após contratos e consumidores comprovados; não prometer
    DAE universal a partir de solvers específicos.
11. **IA:** documentação, skills, APIs e validação determinística primeiro. Integrações
    futuras não podem exigir IA nem expor credenciais no repositório.

## Dependências e riscos

- IndexedDB e permissões podem ser negados ou apagados pelo navegador; usar recuperação
  e exportação explícitas, sem assumir persistência. Testar versões e arquivos inválidos.
- O inventário offline cobre referências estáticas e as declaradas, não garante todas
  as dependências dinâmicas; testar o aplicativo completo sem rede.
- Pool, cancelamento, limites de memória e segurança de execução dependem dos protocolos
  dos workers e de um contrato de tarefas; não confundir cancelamento com interrupção
  segura do estado matemático.
- Interfaces de modelos e convenções numéricas precisam ser acordadas antes de sintaxe,
  netlist, símbolos ou persistência genéricos. Definir versões e migrações antes de
  compartilhar arquivos; layouts gráficos não alteram a matemática.
- PR #27 e a documentação conceitual atual divergem da proposta mais recente; rever antes
  de incorporar. Nada disso autoriza executar código arbitrário do usuário.
