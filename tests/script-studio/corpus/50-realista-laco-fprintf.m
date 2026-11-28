real soma = 0;
int N = 100;
varsize real hist = [];
for k = 1:N
    soma = soma + 1/k^2;
    if mod(k, 25) == 0
        hist(end+1) = soma;
        fprintf('k = %d, soma = %.6f\n', k, soma);
    end
end
erro = abs(soma - pi^2/6);
fprintf("Erro final: %e\n", erro);
