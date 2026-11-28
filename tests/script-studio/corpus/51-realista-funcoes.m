Vin = 12; D = 0.5; L = 100e-6; fs = 50e3;
[Vo, iL] = buck(Vin, D, L, fs);
printf_removido = 1;
disp(Vo)

function [Vo, iL] = buck(Vin, D, L, fs)
    arguments
        Vin (1,1) double {mustBePositive}
        D (1,1) double {mustBeNonnegative}
        L (1,1) double
        fs (1,1) double = 50e3
    end
    Vo = D * Vin;
    iL = Vo / (L * fs);
end
