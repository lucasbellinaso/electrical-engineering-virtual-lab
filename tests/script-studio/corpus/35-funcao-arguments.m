y = filtro([1 2 3], 2);

function y = filtro(x, a, n)
    arguments
        x (1,:) double
        a (1,1) double {mustBeReal}
        n (1,1) double {mustBeInteger, mustBePositive} = 10
    end
    y = a * x + n;
end

function r = outra(v, opts)
    arguments
        v
        opts.nome char = 'padrao'
        opts.fator (1,1) = 1
    end
    r = v * opts.fator;
end
