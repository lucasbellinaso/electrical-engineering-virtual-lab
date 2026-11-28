% Letras gregas em nomes e a constante π
f = 60;
ω = 2*π*f;          % frequência angular
ωn = 10; ζ = 0.7;
Δt = 1e-3;
θ_1 = π/4;
µ0 = 4*pi*1e-7;     % sinal de micro (AltGr+M) = μ
μr = 1000;
μ = μ0*μr;
real Ω = 50
H = [ωn^2, 2*ζ*ωn; -ω 1/Δt];
for k = 1:3
    φ(k) = θ_1*k;
end
