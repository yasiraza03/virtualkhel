/** GLSL for the three batched point layers: background stars, nebula sprites and game nodes. */

export const STAR_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute vec2 aTwinkle; // x: phase, y: speed
  uniform float uTime;
  uniform float uDpr;
  uniform float uTwinkle;
  uniform vec3 uTint;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float depthBoost = clamp(140.0 / max(-mv.z, 1.0), 0.65, 2.4);
    gl_PointSize = aSize * uDpr * depthBoost;
    float tw = 0.78 + 0.22 * sin(uTime * aTwinkle.y + aTwinkle.x) * uTwinkle;
    vColor = aColor * mix(vec3(1.0), uTint, 0.35);
    vAlpha = tw;
  }
`;

export const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * (0.6 + core), core * core * vAlpha);
  }
`;

export const NEBULA_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPx;
  uniform float uDpr;
  uniform vec3 uTint;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uPx / max(-mv.z, 1.0), 420.0 * uDpr);
    vColor = aColor * mix(vec3(1.0), uTint, 0.4);
    vAlpha = aAlpha;
  }
`;

export const NEBULA_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float fall = exp(-d * d * 3.2) * (1.0 - smoothstep(0.85, 1.0, d));
    gl_FragColor = vec4(vColor, fall * vAlpha);
  }
`;

export const NODE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aState; // 0 idle, 1 hovered, 2 selected / favourite, 3 recommended / on path
  uniform float uPx;
  uniform float uSizeMul;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vState;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = aSize * uSizeMul * 3.1 * uPx / max(-mv.z, 1.0);
    gl_PointSize = clamp(s, 5.0 * uDpr, 150.0 * uDpr);
    vColor = aColor;
    vAlpha = aAlpha;
    vState = aState;
  }
`;

export const NODE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vState;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0; // 0 centre .. 1 edge of sprite
    float core = 1.0 - smoothstep(0.17, 0.23, d);
    float halo = exp(-pow(d / 0.55, 2.0)) * 0.55;
    float ring = 0.0;
    if (vState > 1.5) {
      float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
      float rr = 0.5 + 0.03 * pulse;
      ring = smoothstep(0.035, 0.0, abs(d - rr)) * (vState > 2.5 ? 0.7 : 1.0);
    }
    if (vState > 0.5 && vState < 1.5) {
      ring = smoothstep(0.03, 0.0, abs(d - 0.44)) * 0.8;
    }
    float edge = 1.0 - smoothstep(0.92, 1.0, d);
    vec3 col = vColor * (halo + core * 1.5) + vec3(1.0) * core * 0.55 + vec3(1.0) * ring;
    float a = (core + halo + ring) * vAlpha * edge;
    gl_FragColor = vec4(col, a);
  }
`;
