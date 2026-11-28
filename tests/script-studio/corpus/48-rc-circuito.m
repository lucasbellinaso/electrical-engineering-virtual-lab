% Circuito RC série: resposta ao degrau
R = 10e3;          % ohms
C = 100e-6;        % farads
tau = R * C;
fprintf('Constante de tempo: %g s\n', tau);

s = tf('s');
G = 1 / (tau*s + 1);
[y, t] = step(G, 5*tau);

Vc = zeros(size(t));
for k = 1:numel(t)
    Vc(k) = 1 - exp(-t(k) / tau);
end
erro = max(abs(y - Vc'));
if erro > 1e-6
    disp('divergência');
else
    disp('ok');
end
