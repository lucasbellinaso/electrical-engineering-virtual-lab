t = linspace(0, 1, 1000);
x = sin(2*pi*5*t) + 0.5*randn(size(t));
y = x(1:2:end);
n = numel(y);
m = mean(y);
s = std(y);
