# Linha de transmissão como quadripolo / Transmission-line two-port / Cuadripolo de LT

Aplicativo v1.0.0 em [Sistemas Elétricos de Potência](../simulators/power-systems/transmission-line/index.html).
Interface, explicações, erros e deduções disponíveis em PT-BR, EN e ES.
Modelo puro: [model.js](../simulators/power-systems/transmission-line/model.js).
Contratos em [API.md](API.md); evidências em [validation/transmission-line.md](validation/transmission-line.md).

## Objetivo e experiências

Relacionar parâmetros distribuídos, quadripolo ABCD, π equivalente exato e π nominal.
O aluno pode reproduzir o exemplo da aula, investigar o efeito Ferranti, comparar
cargas indutivas/capacitivas e aumentar o comprimento. Perguntas de previsão,
contribuições selecionáveis AV_R/BI_R/CV_R/DI_R, fasores, perfil espacial, sonda e
tabela apoiam a interpretação. O perfil sempre corresponde ao modelo distribuído.

## Hipóteses, unidades e sinais

Linha uniforme, transposta, trifásica equilibrada, sequência positiva, regime
permanente senoidal. Parâmetros independentes da frequência e G′ = 0. Não inclui
transitórios, efeito pelicular, corona, retorno pelo solo, desequilíbrio, compensação
ou limites térmicos. Não é um dimensionador de linha nem um fluxo de potência genérico.
Não há estado inicial temporal: as condições são fasores nos terminais.

Todos os fasores calculados são **RMS por fase**. Entradas: comprimento em km,
frequência em Hz, R′ em Ω/km, L′ em mH/km, C′ em nF/km, tensão de linha em kV,
potência aparente trifásica em MVA. Conversões explícitas para H/km, F/km, V e VA;
o comprimento interno permanece em km, coerente com z′, y′ e γ.

x = 0 na origem e x = ℓ na recepção. I_S entra na linha e I_R sai dela em direção
à carga. Potência positiva na recepção significa absorção; Q > 0 é indutivo,
Q < 0 capacitivo. Não se usa a convenção de ambas as correntes entrando no quadripolo.
A tensão fixada é a referência de fase. As magnitudes de linha são √3 vezes as de
fase; os ângulos exibidos são dos fasores **de fase**, sem confundi-los com V_AB.

## Equações e dedução

Das relações de Kirchhoff em um segmento diferencial:

$$\frac{dV}{dx}=-z'I,\quad\frac{dI}{dx}=-y'V,\quad
z'=R'+j\omega L',\quad y'=j\omega C',\quad\omega=2\pi f.$$

Derivando novamente, V″ = z′y′V e I″ = z′y′I. Com parâmetros passivos e
frequências positivas do domínio do aplicativo, usamos a raiz principal:

$$\gamma=\sqrt{z'y'}=\alpha+j\beta,\quad Z_c=z'/\gamma.$$

α em Np/km, β em rad/km e Z_c em Ω. A escolha Z_c = z′/γ mantém os ramos coerentes.
Aplicando os fasores da recepção à solução hiperbólica:

$$\begin{bmatrix}V_S\\I_S\end{bmatrix}=
\mathbf T(\ell)\begin{bmatrix}V_R\\I_R\end{bmatrix},\quad
\mathbf T(d)=\begin{bmatrix}\cosh(\gamma d)&Z_c\sinh(\gamma d)\\
\sinh(\gamma d)/Z_c&\cosh(\gamma d)\end{bmatrix}.$$

A = D por simetria; AD − BC = 1 por reciprocidade. A e D são adimensionais,
B é uma impedância em Ω, C uma admitância em S.

**Carga com V_R fixo:** V_R = V_LL/√3 é real positivo; S_R = |S_R|(FP ± j√(1−FP²)),
com sinal positivo para carga indutiva. I_R = conj(S_R/(3V_R)). O quadripolo fornece
V_S e I_S. Isso não resolve uma carga de potência constante com V_S fixo.

**Em vazio com V_S fixo:** I_R = 0, V_R = V_S/A e I_S = CV_R. A potência de carga
é obrigatoriamente zero. O modo desativa seus controles para explicitar essa condição.

**π exato:** Z_e = B e Y_e/2 = (A−1)/B = tanh(γℓ/2)/Z_c quando os quocientes
estão definidos. Cada ramo transversal tem admitância Y_e/2. No código:

$$B=z'\ell\operatorname{sinhc}(\gamma\ell),\quad
C=y'\ell\operatorname{sinhc}(\gamma\ell),\quad
\frac{Y_e}{2}=\frac{y'\ell}{2}
\frac{\operatorname{sinhc}(\gamma\ell/2)}{\cosh(\gamma\ell/2)},\quad
\operatorname{sinhc}(u)=\frac{\sinh u}{u},\quad\operatorname{sinhc}(0)=1.$$

Essas formas evitam cancelamento em A−1 e preservam ℓ = 0: T = identidade,
Z_e = 0, Y_e/2 = 0. O modelo importa `sinhc` do núcleo: sua API ainda é auxiliar
instável, e testes locais protegem o comportamento exigido pelo consumidor.

**π nominal:** Z = z′ℓ, Y = y′ℓ; A = D = 1 + ZY/2, B = Z, C = Y(1 + ZY/4).
É comparado sob as mesmas condições terminais. O erro mostrado é
100|V_nom − V_exato|/|V_exato|, em V_S no modo com carga e V_R no modo em vazio;
é erro do **fasor complexo**, não apenas de sua magnitude.

**Perfil e potência:** [V(x); I(x)] = T(ℓ−x)[V_R; I_R]. S_S = 3V_S conj(I_S),
S_R = 3V_R conj(I_R), P_loss = Re(S_S−S_R). Uma avaliação independente por
trapézios em 401 pontos calcula 3∫R′|I(x)|² dx. Potência e perdas são trifásicas.
São usados números IEEE-754 de dupla precisão; não há integração temporal.
Os painéis fasoriais têm escalas independentes e eixos cartesianos nas unidades indicadas.

## Domínio, condicionamento e limitações numéricas

Faixas aceitas: 0–1000 km, 40–70 Hz, R′ = 0–1 Ω/km, L′ = 0,1–5 mH/km,
C′ = 1–50 nF/km, V_LL = 1–1000 kV, |S_R| = 0–3000 MVA, FP = 0,1–1.
Entradas não finitas, strings e opções desconhecidas são rejeitadas, sem correção silenciosa.
Essas faixas são didáticas; combinações extremas não são necessariamente físicas.

Em vazio, |A| < 10⁻¹⁰ em qualquer modelo interrompe a comparação: o problema
é singular ou mal condicionado. Valores próximos, mas fora desse limiar, ainda
podem amplificar fortemente a tensão; não se promete condicionamento uniforme.
O π exato retorna `null` quando |cosh(γℓ/2)| < 10⁻¹⁰, pois não há representação
transversal finita estável. O quadripolo permanece utilizável. Os limiares são
numéricos, não limites físicos. Não se ocultam ou substituem singularidades por zeros.

## Origem do exemplo

Material fornecido pelo usuário: **ESP-1056, Sistema de Transmissão, Tensões e
Correntes em uma LT — Quadripolo e Modelo PI Equivalente**, identificação visual
Engenharia Elétrica / UFSM; autoria individual e data não informadas no arquivo.
Parâmetros do exemplo: 500 kV, z′ = 25,6 + j302,7 mΩ/km, C′ = 14,25 nF/km,
ℓ = 400 km, carga de 600 MVA com FP 0,9 indutivo. Adota-se explicitamente f = 60 Hz
e L′ = 0,3027/(2π60) H/km. Não se altera o exemplo silenciosamente.
O PDF pessoal não foi copiado para o repositório; não se presume licença de redistribuição.
Resultados são recalculados com precisão completa, podendo diferir do arredondamento dos slides.

## English

The app and its complete in-app derivation/help support English. It models a uniform,
balanced three-phase line in sinusoidal steady state with per-phase RMS phasors,
G′ = 0, x from sending to receiving end and both currents toward the load. It solves
either fixed receiving voltage with a specified load, or fixed sending voltage at
open circuit. The exact distributed model and terminal-equivalent π are distinct
from the approximate nominal π. SI conversions, zero-length limits, resonance
thresholds and numerical tolerances are documented above and in the linked evidence.
No transient or generic constant-power load-flow solver is provided.

## Español

La aplicación y sus deducciones/ayuda completas están disponibles en español.
Modela una línea trifásica uniforme y equilibrada en régimen sinusoidal con fasores
RMS por fase, G′ = 0, x desde el origen y ambas corrientes hacia la carga. Resuelve
la carga con tensión de recepción fija o el circuito abierto con tensión de origen
fija. El modelo distribuido y su π equivalente exacto se distinguen del π nominal
aproximado. Las conversiones, límites de longitud cero, umbrales de resonancia y
tolerancias constan arriba y en las evidencias enlazadas. No incluye transitorios
ni flujo de potencia genérico con carga de potencia constante.
