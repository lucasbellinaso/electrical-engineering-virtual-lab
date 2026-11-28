f = @(x) x.^2 + 1;
g = @(x, y) x + y;
h = @() 42;
k = @(~, y) y;
r = f(3) + g(1, 2);
c = integral_demo(@(t) sin(t), 0, 1);
m = @(x) [x, x'];
