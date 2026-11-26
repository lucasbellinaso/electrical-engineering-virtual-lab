# Laboratório de magnetostática / Magnetostatics laboratory

Implementação original EEVL, versão 1.0.0, 26/11/2026. Execução estática no navegador;
interface PT-BR/EN/ES, modelo puro, cálculo do mapa em Web Worker, sem nova dependência.

## Escopo / Scope

- Fio infinito ao longo de z, corte xy: um fio ou dois fios com correntes iguais/opostas.
  Raio finito e densidade de corrente uniforme; solução interna e externa de Ampère.
- Espira circular de raio a, plano xy, vista meridional xz: integração de Biot–Savart.
- Solenoide finito: soma de N espiras coaxiais com centros igualmente espaçados
  nos pontos médios do comprimento l. Corrente positiva é anti-horária vista de +z.
- Meio inteiro homogêneo, isotrópico e linear, μ=μ0 μr. Não representa núcleo com
  fronteira, histerese, saturação, correntes induzidas, força ou energia de montagem.

All coordinates are metres, currents amperes, B tesla, H A/m. μ0 is the CODATA 2022
value 1.25663706127×10⁻⁶ H/m (a measured constant, not an exact 4π×10⁻⁷).
The loop/coil model excludes a tube around each ideal filament. No interior field
or artificial softening is supplied there. The infinite-wire interior is instead
an explicitly defined uniform-current-density model.

## Equações e cálculo / Equations and computation

Fio centrado em (xc,yc), r²=(x−xc)²+(y−yc)², raio b:

`B = μ I/(2π max(r²,b²)) · [−(y−yc), x−xc, 0]`.

No interior, Ienc=I r²/b². No exterior, Ienc=I. Em r=0, B=0 por simetria.
Superposição é válida no meio linear; as correntes são prescritas.

Espira: `r'(φ)=[a cosφ,a sinφ,zc]`, `dl=a[−sinφ,cosφ,0]dφ`.
`B(r)=μI/(4π) ∫ dl×(r−r')/|r−r'|³`, integrado por pontos médios periódicos.
No corte y=0, By=0 por simetria; a visualização mostra Bx e Bz. Solenoide soma
os campos de N espiras discretas. A aproximação de enrolamento contínuo é somente
uma referência de convergência, não a geometria discreta simulada.

Mapas e linhas usam avaliações do mesmo modelo. Linhas: passo espacial de ponto
médio no campo normalizado, interrompidas na borda, região excluída, campo nulo,
fechamento aproximado ou limite de passos. Não são trajetórias de partículas;
número/espaçamento não representa densidade física. Vetores têm comprimento
normalizado. Escala de cor relativa ao máximo amostrado da janela, linear/log opcional.

## Verificação / Verification

Testes reproduzíveis em `tests/magnetostatics.test.mjs` cobrem Ampère, continuidade
na superfície do fio, sentido da mão direita, superposição, corrente nula/negativa,
linearidade em μr/I, solução analítica no eixo da espira, simetria, refinamento de
quadratura, soma no eixo do solenoide e limite de enrolamento contínuo. Ver também
[validation/magnetostatics.md](validation/magnetostatics.md).

No SPICE, FEM or experimental measurements are used. Analytical comparison evidence
applies only to the documented cases and does not certify a general-purpose field solver.
Original files and other applications are not modified by this laboratory.

## Referências / References

- [NIST, CODATA 2022](https://physics.nist.gov/cuu/pdf/all.pdf), μ0.
- [OpenStax, Biot–Savart](https://openstax.org/books/university-physics-volume-2/pages/12-1-the-biot-savart-law).
- [OpenStax, campo de espira](https://openstax.org/books/university-physics-volume-2/pages/12-4-magnetic-field-of-a-current-loop).
- [OpenStax, solenoides](https://openstax.org/books/university-physics-volume-2/pages/12-6-solenoids-and-toroids).

Equations and implementation here are original applications of standard physical laws;
references are theoretical background, not endorsement or validation of this code.
