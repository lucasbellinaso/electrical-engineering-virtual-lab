---
name: eevl-simulator
description: Orienta a criação ou alteração de aplicativos e modelos do EEVL, incluindo a reutilização e a extensão da biblioteca matemática compartilhada.
---

# Aplicativos EEVL


## Proposta e planejamento


No início da conversa, pergunte se a pessoa tem conta no GitHub e deseja contribuir por pull request ou se prefere entregar o aplicativo por e-mail. Não repita a pergunta se a preferência já estiver clara. Adapte o plano à escolha:

- **Pull request:** siga o fluxo do repositório e reutilize a biblioteca compartilhada por imports.
- **E-mail:** prepare um arquivo HTML monolítico e autônomo, incorporando as funções necessárias da biblioteca matemática existente com as atribuições aplicáveis. Inclua instruções e referências necessárias para revisão e oriente a pessoa a enviar o arquivo para `lucas@gepoc.ufsm.br`. Não envie e-mail sem autorização explícita.


Antes de implementar um aplicativo novo ou uma mudança ampla, examine o pedido, os materiais fornecidos e os aplicativos existentes. Apresente uma proposta inicial e um plano de implementação que expliquem o objetivo didático, público, entradas e saídas, modelo e equações, visualizações, limites e validação, conforme relevantes. Identifique recursos compartilhados que possam ser usados ou propostos.

Use a proposta para formular perguntas objetivas sobre decisões ainda abertas, oferecendo opções quando ajudarem. Não pergunte novamente o que já foi informado; explicite suposições e atualize o plano conforme as respostas. Esclareça as decisões necessárias antes de executar o trabalho que dependa delas e avance no que puder ser feito independentemente. Respeite a preferência do usuário quando ele já tiver aprovado o plano ou pedido uma implementação direta.

## Implementação

Ao criar ou alterar um aplicativo neste repositório:

1. Leia `AGENTS.md` e `CONTRIBUTING.md` na raiz; consulte `ARCHITECTURE.md`, `docs/UI-CONVENTIONS.md` e a documentação relevante ao trabalho. Essas fontes definem as convenções e o fluxo do projeto.
2. Antes de implementar cálculos, consulte `docs/API.md` e os módulos de `assets/js/core/`. Verifique entradas, saídas, unidades e limites; reutilize as funções existentes quando forem adequadas.
3. Se faltar uma função geral, proponha na PR sua inclusão na biblioteca compartilhada, com contrato, limites e evidências. Quando possível, implemente, documente e valide a função no núcleo e faça o aplicativo chamá-la. Mantenha regras próprias do experimento no aplicativo.
4. Separe modelo e interface; documente as hipóteses e valide os resultados conforme o guia. Siga as convenções de LaTeX, gráficos e idiomas do projeto.
5. Leia e grave arquivos textuais em UTF-8. Confira os caracteres após usar shells ou ferramentas com outra codificação.
6. No fluxo por pull request, prepare a contribuição em uma branch, revise as alterações e execute as verificações aplicáveis. Prepare uma PR descrevendo comportamento, hipóteses, mudanças, testes e evidências, conforme `CONTRIBUTING.md`; inclua a proposta para funções gerais ausentes quando pertinente. Faça commit, push e abra a PR quando houver autorização para essas ações. O merge depende de autorização para o merge.

As instruções do usuário e as regras aplicáveis da sessão prevalecem sobre esta skill.
