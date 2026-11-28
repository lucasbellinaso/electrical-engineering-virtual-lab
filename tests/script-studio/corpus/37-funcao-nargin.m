a = soma(1);
b = soma(1, 2);

function s = soma(x, y, ~)
    if nargin < 2
        y = 0;
    end
    s = x + y;
end
