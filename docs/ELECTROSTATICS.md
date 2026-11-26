# Laboratório de eletrostática / Electrostatics laboratory

Aplicativo EEVL, versão 1.0.0, 26/11/2026. Execução estática no navegador;
interface PT-BR/EN/ES, modelo puro, sem nova dependência. Integrado a partir de um
esboço de laboratório conceitual em arquivo HTML único (PT/EN), reorganizado nos módulos
`model.js`, `equations.js`, `ui.js`, `locales.json` e `style.css`.

## Escopo / Scope

O mapa mostra o plano z=0 de campos **tridimensionais** analíticos, no vácuo:

- Até 8 cargas pontuais (|q| ≤ 20 nC) com superposição; exemplos: dipolo, carga isolada,
  duas cargas positivas e quadrupolo.
- Esfera de raio R com carga total Q, condutora (carga na superfície) ou isolante
  (carga volumétrica uniforme).
- Fio retilíneo infinito com densidade linear λ ao longo de z, com referência de potencial ρ₀.
- Duas placas planas infinitas paralelas a yz, em x=∓d/2, com densidades +σ e −σ.

All coordinates are metres, E in V/m, V in volts. The charge input uses nC, nC/m or nC/m²,
as labelled in the interface. ε₀ is the CODATA 2022 value 8.8541878188×10⁻¹² F/m.
Sources are fixed: there is no particle dynamics, charge redistribution, dielectric
polarization, fringe field or plate thickness.

## Equações / Equations

- Cargas: `E = k Σ qᵢ (r−rᵢ)/|r−rᵢ|³`, `V = k Σ qᵢ/|r−rᵢ|`, `k = 1/(4πε₀)`, V(∞)=0.
- Esfera condutora: E=0 e V=kQ/R em r<R; E=kQ/r² e V=kQ/r em r>R. A componente normal
  de E salta σ/ε₀ em r=R (a sonda mostra o limite externo).
- Esfera isolante: E=kQr/R³ e V=kQ(3R²−r²)/(2R³) em r≤R; exterior igual ao condutor.
- Fio: `E = λ/(2πε₀ρ) ρ̂`, `V = −λ/(2πε₀) ln(ρ/ρ₀)`. Alterar ρ₀ só desloca V.
- Placas: `Ex = σ/(2ε₀)[sgn(x+d/2) − sgn(x−d/2)]`, `V = σ/(2ε₀)(|x−d/2| − |x+d/2|)`;
  entre as placas E=σ/ε₀ e a queda de potencial é σd/ε₀. Sobre uma folha, sgn(0)=0
  exibe a média dos dois limites.

As expressões, as deduções por lei de Gauss e as convenções de coordenadas (cartesianas,
cilíndricas e esféricas, com ρ, φ e θ) aparecem no próprio aplicativo, em LaTeX renderizado
localmente com KaTeX nos três idiomas.

## Visualização / Visualization

Mapa de cores de |E| em escala logarítmica (percentis 10 % e 97 % da janela atual), vetores
de comprimento normalizado, linhas de campo por ponto médio com passo espacial fixo e
equipotenciais por malha 64× com interpolação linear (marching squares). Linhas de campo
são curvas geométricas tangentes a E, não trajetórias de partículas; seu espaçamento não
mede fluxo. Equipotenciais podem omitir detalhes próximos às fontes. As leituras da sonda
usam diretamente as expressões analíticas, sem interpolação. Singularidades ideais
(cargas pontuais e eixo do fio) retornam campo e potencial não definidos, nunca um valor
suavizado.

## Verificação / Verification

Testes reproduzíveis em `tests/electrostatics.test.mjs`; ver
[validation/electrostatics.md](validation/electrostatics.md). Não há SPICE, elementos
finitos nem medições. A evidência cobre apenas os casos ideais documentados.

## Referências / References

- [NIST, CODATA 2022](https://physics.nist.gov/cuu/pdf/all.pdf), ε₀.
- [OpenStax, Electric Charges and Fields](https://openstax.org/books/university-physics-volume-2/pages/5-introduction).

As equações são aplicações originais de leis físicas padrão; as referências são fundamento
teórico, não endosso nem validação deste código.
