%% Planta
s = tf('s');
G = 10 / (s^2 + 2*s + 10)
C = 2 + 1/s;
H = tf(1, [1 5]);
T = feedback(C*G, H)

%% Resposta
[y, t] = step(T);
overshoot = (max(y) - y(end)) / y(end) * 100;
fprintf('Sobressinal: %.2f %%\n', overshoot);
p = pole(T);
