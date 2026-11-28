s = tf('s');
sys G = 10 / (s^2 + 2*s + 10)
sys P = ss(1, 2, 3, 4);
T = G.num;
d = G.den;
sys H
