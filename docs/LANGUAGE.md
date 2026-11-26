# Linguagem matemática — especificação proposta

**Estado: planejamento.** Não existe interpretador genérico MATLAB/Octave no EEVL.
Os exemplos deste documento não podem ser executados como programas no portal atual.
A lista de funções futuras está em [ROADMAP.md](../ROADMAP.md); as APIs importáveis
de hoje estão em [API.md](API.md).

## O que já existe

O SISO possui parsers internos `parsePoly`, `parseExpr`, `parseComplex` e `parseList`
para campos específicos. Aceita coeficientes ou expressões polinomiais em s/z;
isso não suporta scripts, matrizes genéricas, controle de fluxo, funções ou LQR.
Outros modelos recebem objetos JavaScript numéricos, não código MATLAB/Octave.
Não há runtime genérico programável de controladores.

## Subconjunto pretendido

Priorizar nomenclatura e comportamento MATLAB/GNU Octave com diferenças documentadas,
sem alegar compatibilidade completa. Parser próprio ou biblioteca avaliada deve produzir
AST e avaliar apenas construções permitidas. **Não usar eval nem Function**, nem
traduzir programas arbitrários para JavaScript executável.

| Construção planejada | Convenção |
|---|---|
| Matrizes | `[1, 2; 3, 4]`, linhas de mesmo comprimento |
| Indexação | começa em 1; `A(1,2)` e `A(:,2)`; validar limites |
| Produto | `A*B` matricial; dimensões compatíveis |
| Elemento a elemento | `.*`, `./`, `.^`; documentar regras de dimensões antes de implementar |
| Transposição | `'` conjugada; `.'` simples |
| Resolução linear | `A\b`, com verificação de dimensões, singularidade e condicionamento |
| Sequências | `0:0.01:10`, passo não nulo; regras de arredondamento e tamanho explícitas |
| Complexos | literais e operações definidos, unidades imaginárias compatíveis com o subconjunto |
| Fluxo | `if`, `elseif`, `else`, `for`, `while`, `end`, com orçamento de iterações |
| Separadores | múltiplas instruções por `;`; supressão de saída definida no contrato |
| Comentários | exclusivamente de linha com `%`, inclusive após `;` |

Não implementar comentários multilinha (`%{ ... %}` ou equivalentes). O lexer precisa
distinguir transposta de eventual literal textual antes de suportar strings; strings
genéricas não fazem parte da primeira versão proposta. Não traduzir nomes de funções,
identificadores, operadores, unidades ou comandos LaTeX conforme o idioma da UI.

Tipos iniciais propostos: escalar real/complexo, vetor e matriz densa, booleano para
condições. Precisão numérica equivalente a Number; nenhuma precisão arbitrária implícita.
Dimensões, forma de vetor coluna/linha, igualdade, tolerâncias e promoção real→complexo
precisam de testes explícitos. Objetos TF/SS/ZPK virão por contratos tipados posteriores,
sem expor objetos do DOM ou protótipos JavaScript ao programa.

Exemplo **proposto** de programa (LQR não está implementado na infraestrutura atual):

```matlab
A = [0, 1; -10, -2]; % Planta
B = [0; 1];
C = [1, 0]; D = 0; % várias instruções e comentário após ponto e vírgula
Q = diag([100, 1]);
R = 0.1;
K = lqr(A, B, Q, R);
u = -K*x;
```

## Controlador PI proposto

Campos didáticos separados, definidos pelo runtime futuro:

| Campo | Conteúdo |
|---|---|
| Entradas | r, y, fornecidas pela planta/blocos |
| Saída | u, mantida entre execuções |
| Parâmetros | Kp = 2; Ki = 50; constantes na execução normal |
| Memória declarada | integral |
| Inicialização | integral = 0; |
| Período | Ts = 0.001; em segundos virtuais |

Código periódico **proposto**:

```matlab
e = r - y;
u = Kp*e + Ki*integral;
integral = integral + Ts*e;
```

`e` é local e não persiste; `integral` persiste por declaração explícita; `u` é
saída com retenção. Múltiplas tarefas e ordem de eventos simultâneos precisam ser
determinísticas, conforme [arquitetura](../ARCHITECTURE.md). O exemplo não implementa
saturação nem anti-windup, que devem ser especificados quando pertinentes.

## Limites e diferenças em relação a MATLAB/Octave

Antes do primeiro runtime, definir limites configuráveis e testados para tokens/AST,
profundidade, dimensões/memória de matrizes, iterações, operações, tempo virtual,
avaliações e volume de resultados. Usar Worker cancelável e contagem de operações;
um timeout de parede isolado não garante reprodução de resultados.

Rejeitar funções desconhecidas, formas não suportadas, acesso a propriedades arbitrárias,
rede, sistema de arquivos, DOM, módulos externos e execução de comandos do sistema.
Sem toolboxes automáticas, scripts .m arbitrários, pacotes, eval, Function ou comentários
multilinha. Erros devem trazer posição e mensagem localizada sem mudar a matemática.
Não escolher números de orçamento sem ensaio; nenhum desses limites é um recurso já pronto.

Operações mal condicionadas, divergência, NaN/Inf e laços sem convergência exigem
política explícita de erro/aviso. Não substituir inversa por solução linear sem explicar
o contrato; privilegiar solução de sistemas sobre inversa explícita quando apropriado.

Uma versão futura deste documento deverá separar rigorosamente construções efetivamente
suportadas, versões, testes e desvios conhecidos. Até lá, toda a sintaxe desta seção
permanece planejamento; os parsers legados continuam restritos aos seus campos.
