# Instruções permanentes para agentes

- Leia `docs/SPECIFICATION.md`, `CONTRIBUTING.md` e a documentação do simulador
  antes de editar. Inspecione os arquivos atuais; o usuário pode adicionar modelos.
- Preserve a identidade azul, tipografia de sistema, tokens de tema e componentes
  existentes. Mantenha responsividade, foco visível, teclado e contraste.
- Todo código novo de interface e documentação de simulador deve ser EN/PT-BR.
  Declare idiomas reais de legados sem suporte bilíngue; não os traduza alterando
  silenciosamente algoritmos. Preserve nomes e atribuições originais.
- Separe modelo de UI, documente equações, unidades, hipóteses, método numérico,
  padrões, limites e decisões. Crie testes numéricos adequados, incluindo casos
  analíticos, convergência e entradas inválidas quando aplicáveis.
- Não invente resultados, validação, referências, autoria ou certificações.
  Níveis de validação exigem evidência reproduzível versionada.
- Não modifique modelo, parâmetros ou método existentes sem justificativa
  documentada. Arquivos fornecidos ficam preservados; integrações têm hashes em
  `docs/provenance.json`. Nunca regenere hashes para encobrir uma alteração.
- Não adicione dependências externas desnecessárias, backend, API keys ou serviços
  pagos. Toda simulação é local. Preserve GitHub Pages e caminhos relativos.
- Atualize catálogo JSON, traduções, documentação e cache VERSION quando necessário.
  Adicionar categorias e simuladores não deve exigir editar a lógica da home.
- Execute `npm test` (Windows: `npm.cmd test`) e verifique os fluxos afetados.
  Identifique claramente limitações e testes não executados.
- Não realize push, publicação externa ou alterações destrutivas sem autorização
  do usuário. Não sobrescreva trabalho concorrente do usuário.
