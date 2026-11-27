# Curvas de módulos e arranjos fotovoltaicos

O aplicativo calcula curvas I-V e P-V de módulos idênticos, todos com a mesma irradiância efetiva e temperatura de célula. Não modela sombreamento parcial, diferenças entre módulos, diodos de bypass, perdas ou inversores. A associação multiplica tensão pelo número de módulos em série e corrente pelo número de ramos em paralelo.

Os valores iniciais são um exemplo ilustrativo, não dados de um produto. As condições STC usadas são 1000 W/m² e temperatura da célula de 25 °C. Os coeficientes de curto-circuito e tensão são informados em %/°C. A temperatura não é a temperatura ambiente.

## Exemplos comerciais

As opções pré-preenchidas reproduzem valores STC e coeficientes de fichas técnicas: [Trina Solar TSM-440 NEG9R.28](https://static.trinasolar.com/sites/default/files/Datasheet_Vertex%20S%2B_NEG9R.28_EN_2024_A_S1_web.pdf), [Jinko Solar JKM620N-78HL4](https://www.jinkosolar.com/uploads/JKM610-630N-78HL4-%28V%29-F3-EN.pdf) e [Canadian Solar CS6R-400MS](https://static.csisolar.com/wp-content/uploads/2024/04/03105558/CS-Datasheet-HiKu6All-Black_CS6R-MS_v2.31C25_EN-25y.pdf). A potência calculada como produto de tensão e corrente pode diferir ligeiramente da nominal devido ao arredondamento da ficha.

Nos exemplos com meias-células, para o ajuste de um diodo supõem-se duas cadeias equivalentes em paralelo; o número usado no modelo é metade da quantidade física de células indicada na ficha. A topologia elétrica deve ser confirmada na documentação do fabricante. A escolha é editável e os dados originais são vinculados à ficha; ao alterar os valores, a interface passa a indicar dados personalizados.

## Um diodo e De Soto

Os cinco parâmetros são ajustados a partir dos quatro pontos de catálogo e do coeficiente de tensão, usando `fsolve` compartilhado. As correções de irradiância e temperatura seguem o modelo de De Soto de `pvlib.pvsystem.calcparams_desoto`; a curva resolve a equação de um diodo por bisseção e o ponto de máxima potência por busca em intervalo. O ajuste é não linear e pode falhar para dados inconsistentes ou mal condicionados; o aplicativo informa a falha. A interface apresenta os parâmetros ajustados em STC com 10 algarismos significativos, o coeficiente de corrente em A/°C e as constantes de silício usadas, para facilitar a reprodução.

## Equações fornecidas para IEC 62891

O segundo modelo usa as expressões fornecidas pelo usuário para corrente, tensão, irradiância e temperatura, com os fatores de forma derivados da ficha de catálogo. Os coeficientes de temperatura podem ser alterados; seus valores iniciais correspondem aos do trecho fornecido. O ajuste empírico não garante reproduzir exatamente os valores STC informados. `R_d` atua somente fora do quadrante gerador. O gráfico exibe apenas o quadrante gerador. A seção de equações apresenta as razões de tensão e corrente em STC, os parâmetros calculados para as condições atuais e as constantes fornecidas, com até 10 algarismos significativos. O parâmetro de tensão da equação não necessariamente é igual à tensão de circuito aberto da curva. IEC 62891:2020 trata de ensaios da eficiência de MPPT; a identificação desta opção não declara conformidade com a norma.

## Evidências

`scripts/reference/gen_photovoltaic.py` gera `tests/fixtures/photovoltaic-pvlib.json` com pvlib 0.16.1. O ajuste de referência usa estimativas iniciais explícitas para o solucionador SciPy; casos em várias irradiâncias e temperaturas comparam corrente de curto-circuito, tensão de circuito aberto, ponto de máxima potência e pontos da curva. Os testes também cobrem as equações IEC fornecidas, sua inversa, zero irradiância, escala do arranjo e entradas inválidas. Isso é validação numérica de exemplos, não validação por ensaio.

Referências: [pvlib: modelos de um diodo](https://pvlib-python.readthedocs.io/en/stable/user_guide/modeling_topics/singlediode.html), [pvlib: ajuste De Soto](https://pvlib-python.readthedocs.io/en/stable/reference/generated/pvlib.ivtools.sdm.fit_desoto.html), [IEC 62891:2020](https://webstore.iec.ch/en/publication/28105).
