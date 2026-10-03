/**
 * WheelStage — сцена с 3D-колесом на чистом WebGL (без библиотек).
 * Состояние задаётся «целями» (target), сцена плавно догоняет их.
 * Координаты экрана: x,y ∈ [-1, 1] (центр экрана — 0,0), s — диаметр в долях высоты окна.
 */
import { VERT, FRAG } from './shaders.js';
import { lathe, tireProfile, rimProfile, discProfile, caliperProfile, bikeTireProfile, bikeRimProfile, bikeHubProfile, bikeSpokes } from './geometry.js';
import { perspective, translate, scale, rotX, rotY, rotZ, chain, mat3From, mul, transformPoint } from './math.js';

const DEG = Math.PI / 180;
const FOV = 30 * DEG;
const CAM_Z = 8;

export const DEFAULT_STATE = {
  x: 0.42, y: -0.02, s: 0.9, yaw: -16, pitch: 4, alpha: 1,
  mode: 0, rimR: 0.64, studs: 0, nail: 0, bulge: 0, cut: 0, dent: 0, weight: 0, wobble: 0,
  hiTread: 0, hiSide: 0, hiRim: 0, hiStud: 0, idle: 0.12, mouseK: 1, tilt: 1,
};
// скорость догоняния (1/с) для разных параметров
const RATE = { x: 4.2, y: 4.2, s: 3.6, yaw: 3.6, pitch: 3.6, alpha: 4, mode: 2.4, rimR: 3, dent: 1.6, wobble: 1.4, idle: 2.5 };

function toWebGL2(src, isVert) {
  let s = '#version 300 es\n' + src;
  if (isVert) {
    s = s.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
  } else {
    s = s.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/gl_FragColor/g, 'fragColor');
    s = s.replace('precision highp float;', 'precision highp float;\nout vec4 fragColor;');
  }
  return s;
}

export class WheelStage {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.ok = false;
    this.state = { ...DEFAULT_STATE, ...(opts.state || {}) };
    this.target = { ...this.state };
    this.spin = 0;
    this.spinVel = 0;          // рад/с
    this.extraSpin = 0;        // импульсы (селектор, drag)
    this.pointer = { x: 0, y: 0, nx: 0, ny: 0, moved: 0 };
    this.tiltCur = { x: 0, y: 0 };
    this.time = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75);
    this.frameTimes = [];
    this.lastXw = null;
    this.dragging = false;
    this.listeners = [];
    this.screen = { x: 0, y: 0, r: 0 };
    this.builtRim = null;
    this.steel = 0;
    try {
      this.init();
      this.ok = true;
    } catch (e) {
      if (window.console) console.warn('[wheel] WebGL недоступен:', e.message);
      this.ok = false;
    }
  }

  init() {
    const attrs = { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    let gl = this.canvas.getContext('webgl2', attrs);
    this.gl2 = !!gl;
    if (!gl) {
      gl = this.canvas.getContext('webgl', attrs) || this.canvas.getContext('experimental-webgl', attrs);
      if (!gl) throw new Error('no context');
      if (!gl.getExtension('OES_standard_derivatives')) throw new Error('no derivatives');
      this.uint = !!gl.getExtension('OES_element_index_uint');
    } else this.uint = true;
    this.gl = gl;

    const vs = this.gl2 ? toWebGL2(VERT, true) : VERT;
    const fs = this.gl2 ? toWebGL2(FRAG, false) : '#extension GL_OES_standard_derivatives : enable\n' + FRAG;
    this.prog = this.program(vs, fs);
    gl.useProgram(this.prog);
    this.loc = {
      aPos: gl.getAttribLocation(this.prog, 'aPos'),
      aNor: gl.getAttribLocation(this.prog, 'aNor'),
      aUV: gl.getAttribLocation(this.prog, 'aUV'),
    };
    this.u = {};
    const names = ['uModel', 'uVP', 'uNM', 'uMat', 'uRimR', 'uDent', 'uDentA', 'uBulge', 'uBulgeA', 'uCam', 'uKey', 'uMouse', 'uMouseK', 'uBlur', 'uSteel', 'uStuds', 'uNail', 'uNailA', 'uWeight', 'uWeightA', 'uCut', 'uHi', 'uTime', 'uAcc', 'uSide', 'uAlpha', 'uScale'];
    names.forEach((n) => (this.u[n] = gl.getUniformLocation(this.prog, n)));

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const lowRes = this.opts.lowRes;
    this.segs = lowRes ? 160 : 240;
    this.meshes = {
      disc: this.mesh(lathe(discProfile(), this.segs)),
      caliper: this.mesh(lathe(caliperProfile(), 24, 0.42, 1.12)),
      bTire: this.mesh(lathe(bikeTireProfile(), this.segs)),
      bRim: this.mesh(lathe(bikeRimProfile(), this.segs)),
      bHub: this.mesh(lathe(bikeHubProfile(), 48)),
      bSpokes: this.mesh(bikeSpokes(32)),
    };
    this.buildRim(this.state.rimR);
    this.sideTex = gl.createTexture();
    this.drawSidewall();
    this.resize();
  }

  program(vsSrc, fsSrc) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  mesh(g, old) {
    const gl = this.gl;
    const m = old || { vbo: gl.createBuffer(), nbo: gl.createBuffer(), tbo: gl.createBuffer(), ibo: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, g.nor, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.tbo);
    gl.bufferData(gl.ARRAY_BUFFER, g.uv, gl.DYNAMIC_DRAW);
    const small = g.pos.length / 3 < 65536;
    const idx = small ? new Uint16Array(g.idx) : g.idx;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
    m.count = g.idx.length;
    m.type = small ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    return m;
  }

  buildRim(R) {
    this.meshes.tire = this.mesh(lathe(tireProfile(R), this.segs), this.meshes.tire);
    this.meshes.rim = this.mesh(lathe(rimProfile(R), this.segs), this.meshes.rim);
    this.builtRim = R;
  }

  /** Надписи на боковине — канвас-текстура (карта высот) */
  drawSidewall() {
    const gl = this.gl;
    const W = this.opts.lowRes ? 2048 : 4096;
    const H = W / 16;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff';
    x.textBaseline = 'alphabetic';
    const brand = this.opts.brand || 'ШИНОМОНТАЖ У ДЕНИСА';
    const spec = this.opts.spec || 'САРАПУЛ · ЛЕНИНГРАДСКАЯ 2/1';
    const spec2 = this.opts.spec2 || 'ПН–СБ 9:00–18:00';
    const big = (txt, cx, size) => {
      x.font = `900 ${size}px "YD Display", "Inter", Arial, sans-serif`;
      if ('letterSpacing' in x) x.letterSpacing = `${size * 0.12}px`;
      const w = x.measureText(txt).width;
      x.fillText(txt, cx - w / 2, H * 0.62);
    };
    const small = (txt, cx, size, y) => {
      x.font = `700 ${size}px "YD Mono", monospace`;
      if ('letterSpacing' in x) x.letterSpacing = `${size * 0.3}px`;
      const w = x.measureText(txt).width;
      x.fillText(txt, cx - w / 2, y);
    };
    big(brand, W * 0.5, H * 0.46);
    big(brand, W * 0.0, H * 0.46);
    big(brand, W * 1.0, H * 0.46);
    small(spec, W * 0.25, H * 0.15, H * 0.86);
    small(spec2, W * 0.75, H * 0.15, H * 0.86);
    small('R13–R19+  ·  TUBELESS  ·  M+S', W * 0.5, H * 0.12, H * 0.86);
    // кольцевые риски
    x.fillRect(0, H * 0.94, W, H * 0.015);
    gl.bindTexture(gl.TEXTURE_2D, this.sideTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  }

  resize() {
    if (!this.gl) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.vw = w;
    this.vh = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspect = w / h;
    this.proj = perspective(FOV, this.aspect, 0.1, 60);
    this.view = translate(0, 0, -CAM_Z);
    this.vp = mul(this.proj, this.view);
    this.halfH = CAM_Z * Math.tan(FOV / 2);
    this.halfW = this.halfH * this.aspect;
    this.dirty = true;
  }

  set(partial) {
    Object.assign(this.target, partial);
  }
  jump(partial) {
    Object.assign(this.target, partial);
    Object.assign(this.state, partial);
  }

  /** Модельная матрица (spin=true — с вращением колеса) */
  model(withSpin = true) {
    const st = this.state;
    const sc = st.s * this.halfH;
    const flip = Math.sin(st.mode * Math.PI) * (Math.PI / 2 - st.yaw * DEG);
    const yaw = st.yaw * DEG + flip + this.tiltCur.x;
    const pitch = st.pitch * DEG + this.tiltCur.y;
    const wob = st.wobble * 0.11;
    const parts = [translate(st.x * this.halfW, st.y * this.halfH, 0), scale(sc), rotY(yaw), rotX(pitch)];
    if (wob > 0.0005) parts.push(rotX(Math.sin(this.spin) * wob), rotY(Math.cos(this.spin) * wob));
    if (withSpin) parts.push(rotZ(-this.spin));
    return { m: chain(...parts), rot: chain(rotY(yaw), rotX(pitch), withSpin ? rotZ(-this.spin) : rotZ(0)), sc };
  }

  /** Экранные координаты точки в системе колеса */
  project(p, withSpin = true) {
    const { m } = this.model(withSpin);
    const c = transformPoint(mul(this.vp, m), p);
    return { x: (c[0] * 0.5 + 0.5) * this.vw, y: (0.5 - c[1] * 0.5) * this.vh, z: c[2] };
  }

  update(dt) {
    const st = this.state;
    const tg = this.target;
    let moving = false;
    for (const k in tg) {
      if (typeof tg[k] !== 'number') continue;
      const d = tg[k] - st[k];
      if (Math.abs(d) < 1e-4) { st[k] = tg[k]; continue; }
      const rate = RATE[k] || 4;
      st[k] += d * (1 - Math.exp(-dt * rate * (this.reduced ? 50 : 1)));
      moving = true;
    }
    // смена посадочного диаметра → перестроить шину/диск
    if (Math.abs(st.rimR - this.builtRim) > 0.0015) this.buildRim(st.rimR);
    // мышь: наклон и свет
    const p = this.pointer;
    const tx = st.tilt * p.nx * 0.16;
    const ty = st.tilt * -p.ny * 0.1;
    this.tiltCur.x += (tx - this.tiltCur.x) * (1 - Math.exp(-dt * 3));
    this.tiltCur.y += (ty - this.tiltCur.y) * (1 - Math.exp(-dt * 3));
    if (Math.abs(tx - this.tiltCur.x) > 1e-4 || Math.abs(ty - this.tiltCur.y) > 1e-4) moving = true;

    // вращение: холостой ход + качение + инерция рывка
    const xw = st.x * this.halfW;
    const R = st.s * this.halfH;
    let roll = 0;
    if (this.lastXw != null && R > 0.01 && !this.reduced) roll = (xw - this.lastXw) / R;
    this.lastXw = xw;
    if (!this.dragging) {
      this.spinVel *= Math.exp(-dt * 1.6);
      if (Math.abs(this.spinVel) < 0.002) this.spinVel = 0;
    }
    const idle = this.reduced ? 0 : st.idle;
    const dSpin = (idle + this.spinVel) * dt + roll + this.extraSpin;
    this.extraSpin = 0;
    this.spin += dSpin;
    this.angVel = dt > 0 ? dSpin / dt : 0;
    if (Math.abs(dSpin) > 1e-5) moving = true;
    this.time += dt;
    return moving;
  }

  render() {
    const gl = this.gl;
    const st = this.state;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (st.alpha < 0.003) return;
    gl.useProgram(this.prog);
    const u = this.u;
    const { m, rot, sc } = this.model(true);
    const cal = this.model(false);
    this.screen = { x: (st.x * 0.5 + 0.5) * this.vw, y: (0.5 - st.y * 0.5) * this.vh, r: (st.s * this.vh) / 2 };

    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform3f(u.uCam, 0, 0, CAM_Z);
    gl.uniform3f(u.uKey, -0.45, 0.75, 0.6);
    gl.uniform3f(u.uMouse, this.pointer.nx * this.halfW * 1.2, this.pointer.ny * this.halfH * 1.2, 3.2);
    gl.uniform1f(u.uMouseK, st.mouseK * (this.pointer.active ? 1 : 0.35));
    const blur = Math.min(0.7, Math.abs(this.angVel || 0) * 0.028);
    gl.uniform1f(u.uBlur, this.reduced ? 0 : blur);
    gl.uniform1f(u.uSteel, this.steel);
    gl.uniform1f(u.uStuds, st.studs);
    gl.uniform1f(u.uNail, st.nail);
    gl.uniform1f(u.uNailA, 0.0 - this.spin);
    gl.uniform1f(u.uWeight, st.weight);
    gl.uniform1f(u.uWeightA, 2.6);
    gl.uniform1f(u.uBulge, st.bulge);
    gl.uniform1f(u.uBulgeA, 1.15 - this.spin);
    gl.uniform1f(u.uCut, st.cut);
    gl.uniform1f(u.uDent, st.dent);
    gl.uniform1f(u.uDentA, 2.2 - this.spin);
    gl.uniform4f(u.uHi, st.hiTread, st.hiSide, st.hiRim, st.hiStud);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform3f(u.uAcc, 1.0, 0.31, 0.07);
    gl.uniform1f(u.uRimR, this.builtRim);
    gl.uniform1f(u.uAlpha, st.alpha);
    gl.uniform1f(u.uScale, sc);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sideTex);
    gl.uniform1i(u.uSide, 0);

    const draw = (mesh, mat, model, rotm) => {
      gl.uniform1f(u.uMat, mat);
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniformMatrix3fv(u.uNM, false, mat3From(rotm));
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      gl.enableVertexAttribArray(this.loc.aPos);
      gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo);
      gl.enableVertexAttribArray(this.loc.aNor);
      gl.vertexAttribPointer(this.loc.aNor, 3, gl.FLOAT, false, 0, 0);
      if (this.loc.aUV >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.tbo);
        gl.enableVertexAttribArray(this.loc.aUV);
        gl.vertexAttribPointer(this.loc.aUV, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
    };
    const M = this.meshes;
    if (st.mode < 0.5) {
      draw(M.disc, 2, m, rot);
      draw(M.caliper, 3, cal.m, cal.rot);
      draw(M.rim, 1, m, rot);
      draw(M.tire, 0, m, rot);
    } else {
      draw(M.bHub, 5, m, rot);
      draw(M.bSpokes, 5, m, rot);
      draw(M.bRim, 5, m, rot);
      draw(M.bTire, 4, m, rot);
    }
  }

  /** Один кадр: обновить и (если надо) нарисовать */
  frame(dt) {
    if (!this.ok) return;
    const t0 = performance.now();
    const moving = this.update(dt);
    if (moving || this.dirty || this.pointer.moved) {
      this.render();
      this.dirty = false;
      this.pointer.moved = 0;
      // адаптивное качество
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 40) {
        const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.frameTimes.length = 0;
        if (avg > 0.028 && this.dpr > 1) {
          this.dpr = Math.max(1, this.dpr - 0.25);
          this.resize();
        }
      }
    }
    this.cost = performance.now() - t0;
  }

  // ---------- взаимодействие ----------
  setPointer(clientX, clientY) {
    this.pointer.nx = (clientX / this.vw) * 2 - 1;
    this.pointer.ny = 1 - (clientY / this.vh) * 2;
    this.pointer.moved = 1;
    this.pointer.active = true;
  }
  dragBy(dAngle) {
    this.extraSpin += dAngle;
  }
  fling(vel) {
    this.spinVel = Math.max(-30, Math.min(30, vel));
  }
  setSteel(on) {
    this.steel = on ? 1 : 0;
    this.dirty = true;
  }
}
