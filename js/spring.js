// A damped spring stepped with small fixed slices so it stays stable at any frame rate.
export class Spring {
  constructor(value = 0, { k = 200, d = 20 } = {}) {
    this.v = value; this.target = value; this.vel = 0; this.k = k; this.d = d;
  }
  set(value) { this.v = value; this.target = value; this.vel = 0; return this; }
  kick(amount) { this.vel += amount; return this; }
  step(dt) {
    let left = Math.min(dt, 0.064);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      this.vel += (-this.k * (this.v - this.target) - this.d * this.vel) * h;
      this.v += this.vel * h;
      left -= h;
    }
    return this.v;
  }
  get resting() { return Math.abs(this.vel) < 0.02 && Math.abs(this.v - this.target) < 0.002; }
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => Math.pow(clamp(t, 0, 1), 2);
