/**
 * Процедурная геометрия колеса: всё строится вращением 2D-профилей (lathe).
 * Ось колеса — Z (на зрителя). Угол θ = 0 — «12 часов», по часовой стрелке.
 * Радиус шины = 1.
 */
const TAU = Math.PI * 2;

/** Нормали к ломаной профиля (r,z), «наружу» = влево от направления обхода, если outward=1 */
function profileNormals(pts, outward = 1) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tr = b.r - a.r, tz = b.z - a.z;
    const l = Math.hypot(tr, tz) || 1;
    tr /= l; tz /= l;
    // поворот касательной на -90°: (tz, -tr)
    return { r: p.r, z: p.z, nr: tz * outward, nz: -tr * outward };
  });
}

/**
 * Вращение профиля. profile: [{r,z,nr,nz}], segs — сегменты по кругу.
 * a0/a1 — частичный оборот (для суппорта). Возвращает массивы для буферов.
 */
export function lathe(profile, segs, a0 = 0, a1 = TAU) {
  const P = profile.length;
  const pos = new Float32Array((segs + 1) * P * 3);
  const nor = new Float32Array((segs + 1) * P * 3);
  const uv = new Float32Array((segs + 1) * P * 2);
  let k = 0, q = 0;
  for (let i = 0; i <= segs; i++) {
    const th = a0 + ((a1 - a0) * i) / segs;
    const s = Math.sin(th), c = Math.cos(th);
    for (let j = 0; j < P; j++) {
      const p = profile[j];
      pos[k] = p.r * s; pos[k + 1] = p.r * c; pos[k + 2] = p.z;
      nor[k] = p.nr * s; nor[k + 1] = p.nr * c; nor[k + 2] = p.nz;
      k += 3;
      uv[q] = i / segs; uv[q + 1] = j / (P - 1);
      q += 2;
    }
  }
  const idx = new Uint32Array(segs * (P - 1) * 6);
  let t = 0;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j, b = (i + 1) * P + j;
      idx[t++] = a; idx[t++] = b; idx[t++] = a + 1;
      idx[t++] = a + 1; idx[t++] = b; idx[t++] = b + 1;
    }
  }
  return { pos, nor, uv, idx };
}

/** Профиль шины для радиуса посадки rim (0.55…0.76) */
export function tireProfile(rim) {
  const W = 0.3;     // половина ширины по протектору
  const c = 0.075;   // радиус плечевой зоны
  const Wb = 0.235;  // половина ширины у борта
  const pts = [];
  // передняя боковина: от борта к плечу (выпуклая)
  const n1 = 22;
  for (let i = 0; i <= n1; i++) {
    const t = i / n1;
    const r = rim + (1 - c - rim) * t;
    const bulge = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5);
    const z = Wb + (W + 0.012 - Wb) * bulge - 0.012 * t * t;
    pts.push({ r, z });
  }
  // переднее плечо
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 0.5;
    pts.push({ r: 1 - c + c * Math.sin(a), z: W - c + c * Math.cos(a) });
  }
  // протектор
  const n2 = 16;
  for (let i = 1; i < n2; i++) pts.push({ r: 1, z: (W - c) * (1 - (2 * i) / n2) });
  // заднее плечо и боковина — зеркально
  const front = pts.slice(0, n1 + 1 + 8);
  for (let i = front.length - 1; i >= 0; i--) pts.push({ r: front[i].r, z: -front[i].z });
  // наружу: обход от передней боковины к задней идёт «по часовой» в (r,z) → outward = -1
  return profileNormals(pts, -1);
}

/** Профиль лицевой части диска + обод + внутренняя полка */
export function rimProfile(R) {
  const pts = [
    { r: 0.0, z: 0.215 },
    { r: 0.035, z: 0.214 },
    { r: 0.06, z: 0.205 },
    { r: 0.072, z: 0.185 },
    { r: 0.1, z: 0.178 },
    { r: 0.14, z: 0.17 },
    { r: 0.175, z: 0.158 },
  ];
  const n = 18;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const r = 0.175 + (R - 0.07 - 0.175) * t;
    const z = 0.158 - 0.085 * Math.pow(t, 0.8); // вогнутая «спица»
    pts.push({ r, z });
  }
  pts.push({ r: R - 0.045, z: 0.07 });
  pts.push({ r: R - 0.02, z: 0.08 });
  pts.push({ r: R - 0.004, z: 0.1 });
  pts.push({ r: R + 0.012, z: 0.098 });
  pts.push({ r: R + 0.02, z: 0.08 });
  pts.push({ r: R + 0.018, z: 0.055 });
  pts.push({ r: R - 0.005, z: 0.04 });
  pts.push({ r: R - 0.02, z: 0.0 });
  pts.push({ r: R - 0.025, z: -0.12 });
  pts.push({ r: R - 0.028, z: -0.25 });
  return profileNormals(pts, 1);
}

/** Тормозной диск (кольцо) */
export function discProfile() {
  return profileNormals(
    [
      { r: 0.16, z: -0.02 },
      { r: 0.2, z: -0.055 },
      { r: 0.3, z: -0.06 },
      { r: 0.4, z: -0.06 },
      { r: 0.47, z: -0.06 },
    ],
    1
  );
}

/** Суппорт — закрытый прямоугольный профиль (для частичного lathe) */
export function caliperProfile() {
  const r0 = 0.39, r1 = 0.535, z0 = -0.12, z1 = 0.02, b = 0.012;
  const raw = [
    { r: r0 + b, z: z1 }, { r: r1 - b, z: z1 },
    { r: r1, z: z1 - b }, { r: r1, z: z0 + b },
    { r: r1 - b, z: z0 }, { r: r0 + b, z: z0 },
    { r: r0, z: z0 + b }, { r: r0, z: z1 - b },
    { r: r0 + b, z: z1 },
  ];
  return profileNormals(raw, -1);
}

/** Вело: тонкая шина — окружность сечения */
export function bikeTireProfile() {
  const pts = [];
  const n = 20, rc = 0.955, rad = 0.045;
  for (let i = 0; i <= n; i++) {
    const a = -0.82 * Math.PI + (i / n) * 1.64 * Math.PI; // a=0 — наружу; открыт к центру
    pts.push({ r: rc + rad * Math.cos(a), z: rad * Math.sin(a) });
  }
  return profileNormals(pts, -1);
}
export function bikeRimProfile() {
  return profileNormals(
    [
      { r: 0.915, z: 0.022 }, { r: 0.875, z: 0.016 }, { r: 0.86, z: 0.0 },
      { r: 0.875, z: -0.016 }, { r: 0.915, z: -0.022 },
    ],
    -1
  );
}
export function bikeHubProfile() {
  return profileNormals(
    [
      { r: 0.0, z: 0.12 }, { r: 0.03, z: 0.12 }, { r: 0.035, z: 0.09 }, { r: 0.085, z: 0.085 }, { r: 0.085, z: 0.07 },
      { r: 0.04, z: 0.065 }, { r: 0.036, z: -0.065 }, { r: 0.085, z: -0.07 }, { r: 0.085, z: -0.085 },
      { r: 0.035, z: -0.09 }, { r: 0.03, z: -0.12 }, { r: 0.0, z: -0.12 },
    ],
    -1
  );
}

/** Спицы: тонкие брусья от фланца втулки к ободу, с перекрёстом */
export function bikeSpokes(count = 32) {
  const pos = [], nor = [], uv = [], idx = [];
  const w = 0.0055;
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    const aRim = (i / count) * TAU;
    const aHub = aRim + side * 0.42;
    const A = [0.08 * Math.sin(aHub), 0.08 * Math.cos(aHub), side * 0.075];
    const B = [0.865 * Math.sin(aRim), 0.865 * Math.cos(aRim), side * 0.006];
    // локальный базис
    const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const L = Math.hypot(...d);
    const t = d.map((x) => x / L);
    let u = [-t[1], t[0], 0];
    const ul = Math.hypot(...u) || 1;
    u = u.map((x) => (x / ul) * w);
    const v = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]].map((x) => (x / w) * w);
    const corners = [
      [u, v], [u.map((x) => -x), v], [u.map((x) => -x), v.map((x) => -x)], [u, v.map((x) => -x)],
    ];
    const base = pos.length / 3;
    for (const P of [A, B]) {
      for (const [cu, cv] of corners) {
        pos.push(P[0] + cu[0] + cv[0], P[1] + cu[1] + cv[1], P[2] + cu[2] + cv[2]);
        const n = [cu[0] + cv[0], cu[1] + cv[1], cu[2] + cv[2]];
        const nl = Math.hypot(...n) || 1;
        nor.push(n[0] / nl, n[1] / nl, n[2] / nl);
        uv.push(i / count, P === A ? 0 : 1);
      }
    }
    for (let s = 0; s < 4; s++) {
      const a = base + s, b = base + ((s + 1) % 4), c = base + 4 + s, e = base + 4 + ((s + 1) % 4);
      idx.push(a, c, b, b, c, e);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint32Array(idx) };
}
