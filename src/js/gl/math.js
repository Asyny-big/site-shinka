// Минимальная линейная алгебра для WebGL (column-major, как в OpenGL)
export function m4() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
export function mul(a, b, out) {
  const o = out || new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
export function translate(x, y, z) {
  const m = m4();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
export function scale(s) {
  const m = m4();
  m[0] = m[5] = m[10] = s;
  return m;
}
export function rotX(a) {
  const m = m4(), c = Math.cos(a), s = Math.sin(a);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}
export function rotY(a) {
  const m = m4(), c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}
export function rotZ(a) {
  const m = m4(), c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}
/** Перемножить цепочку матриц слева направо: chain(A,B,C) = A*B*C */
export function chain(...ms) {
  let r = ms[0];
  for (let i = 1; i < ms.length; i++) r = mul(r, ms[i]);
  return r;
}
/** Верхняя-левая 3×3 (для нормалей при равномерном масштабе) */
export function mat3From(m) {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}
export function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
}
