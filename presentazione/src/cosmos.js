import * as THREE from 'three';

const { lerp } = THREE.MathUtils;
const TAU = Math.PI * 2;

// Position/radius, surface palette, sky palette and tilt, then satellites in planet radii.
const CHAPTERS = [
  { name: 'Gas giant', frame: [3.25, 0.68, -8.8, 2.03], colors: [0x10374b, 0x83e9ca, 0x48aed0], sky: [0x2e8c80, 0x405da5, -0.34], ring: [1.29, 2.02, -1.14, -0.30], moons: [[-2.12, 0.78, -0.11, 0.14, 0x99d3cf]] },
  { name: 'Ice moon', frame: [2.88, 1.19, -9.0, 1.83], colors: [0x20365a, 0xb7e9f4, 0x64a5eb], sky: [0x377cc1, 0x445290, 0.40], moons: [[1.13, -1.42, -0.4, 0.22, 0x7abaff], [-1.52, 1.02, -0.1, 0.09, 0x91ceff]] },
  { name: 'Violet belts', frame: [3.40, -0.69, -9.3, 1.61], colors: [0x2f214d, 0xbba0fa, 0x8c64e6], sky: [0x7348bd, 0x365789, 0.50], ring: [1.31, 2.10, 0.99, 0.47], moons: [[-0.48, 1.61, -0.34, 0.22, 0xc6adfa]] },
  { name: 'Volcanic world', frame: [2.56, -1.65, -8.8, 2.19], colors: [0x492435, 0xd89b61, 0xff9b36], sky: [0x9f602e, 0x654279, -0.20], moons: [[1.15, 1.25, -0.49, 0.18, 0xe7a27e]] },
  { name: 'Magnetar', frame: [3.35, 0.42, -8.8, 1.33], colors: [0x113f49, 0x7ee2d7, 0x41e0c8], sky: [0x2a9b9d, 0x32529c, -0.56], moons: [[-0.70, -1.56, -0.4, 0.23, 0x7bafbe]] },
  { name: 'Convergence', frame: [3.00, 0.40, -9.1, 1.72], colors: [0x193d53, 0x99ead5, 0xe4a780], sky: [0x358f88, 0x654caa, 0.14], ring: [1.37, 1.82, -1.08, 0.23], moons: [[-1.56, 0.99, -0.50, 0.25, 0x8ac3f5], [1.24, 1.37, -0.42, 0.13, 0xc4a3f2], [1.53, -1.12, 0.24, 0.19, 0xe7ae72]] },
];

const color = (hex) => new THREE.Color(hex);
const output = '#include <colorspace_fragment>';

function shader(vertexShader, fragmentShader, values, options = {}) {
  const uniforms = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, toneMapped: false, ...options });
}

function add(parent, geometry, material, order = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = order;
  parent.add(mesh);
  return mesh;
}

const NOISE = /* glsl */`
  float hash(vec2 p) {
    vec3 q = fract(p.xyx * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f *= f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }
`;

const SKY_VERT = /* glsl */`
  varying vec2 vField;
  void main() {
    vField = position.xy / vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
    vec4 center = projectionMatrix * modelViewMatrix * vec4(0., 0., 0., 1.);
    gl_Position = vec4(position.xy, center.z / center.w, 1.);
  }
`;
const SKY_FRAG = /* glsl */`
  uniform vec3 uSky, uEcho;
  uniform float uTilt, uIdle, uWarp;
  varying vec2 vField;
  ${NOISE}
  float cloud(vec2 p) {
    mat2 turn = mat2(1.76, 1.20, -1.20, 1.76);
    return .54*n2(p) + .27*n2(turn*p+7.) + .13*n2(turn*turn*p+12.) + .06*n2(9.*p-3.);
  }
  void main() {
    float c = cos(uTilt), s = sin(uTilt);
    vec2 field = mat2(c, s, -s, c) * vField;
    vec2 q = field * (.50 - uWarp*.07) + vec2(.013, -.005)*uIdle;
    float bend = n2(q*.74+5.) - .5;
    float farCloud = cloud(q*1.1 + vec2(bend*1.6, 8.));
    float nearCloud = cloud(q*1.86 + vec2(9.+farCloud*2.3, bend*2.));
    float lane = field.y - .65 + .55*sin(field.x*.52) + 1.95*bend;
    float plumeX = field.x-3.2;
    float plume = exp(-.32*lane*lane - .032*plumeX*plumeX);
    vec2 echoPos = (field + vec2(3.1,2.7+bend)) * vec2(.164,.36);
    float echo = exp(-dot(echoPos,echoPos));
    float curtain = smoothstep(.33, .70, nearCloud);
    float dust = smoothstep(.10, .88, abs(lane+.23+(nearCloud-.5)*1.6));
    vec2 core = (vField - vec2(-1., .10)) * vec2(.34, .45);
    float mask = 1. - .53*exp(-dot(core,core));
    vec3 col = vec3(.0022, .0036, .008) + mask * (
      uEcho * (.013 + echo * (.033 + .23*farCloud*farCloud)) +
      uSky * plume * (.025 + .31*curtain*(.35 + .65*dust)));
    col += (hash(gl_FragCoord.xy) - .5)*.00115;
    gl_FragColor = vec4(col, 1.);
    ${output}
  }
`;

const BODY_VERT = /* glsl */`
  varying vec3 vRock, vNormalView;
  void main() {
    vRock = position;
    vNormalView = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const BODY_FRAG = /* glsl */`
  uniform vec3 uDeep, uLight, uAccent;
  uniform float uKind, uFade, uSeed;
  varying vec3 vRock, vNormalView;
  ${NOISE}
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec2 a = i.xy + i.z * vec2(37., 17.);
    return mix(n2(a + f.xy), n2(a + vec2(37., 17.) + f.xy), f.z*f.z*(3.-2.*f.z));
  }
  float terrain(vec3 p) { return .57*n3(p) + .28*n3(p*2.11+3.) + .15*n3(p*4.23-2.); }
  float crater(vec3 p, vec3 center, float size) {
    float d = length(p-normalize(center))/size;
    float wall = smoothstep(.65,.87,d)*(1.-smoothstep(.91,1.08,d));
    return -.24*(1.-smoothstep(.34,.86,d)) + wall*(.20+.17*clamp((p.y-center.y)/size,-1.,1.));
  }
  void main() {
    // Depth-writing surfaces keep the far half of the rings and stars behind the planet.
    if (uFade < .999 && hash(floor(gl_FragCoord.xy)) >= uFade) discard;
    vec3 p = normalize(vRock);
    vec3 n = normalize(vNormalView);
    vec3 sun = normalize(vec3(-.64, .71, .47));
    float grain = n3(p*39. + uSeed);
    float land = terrain(p*4.2+uSeed);
    float tone, accent = 0., emission = 0.;
    if (uKind < .5 || uKind > 4.5) {
      // Curving cloud belts and embedded cyclones, with no UV seam at the poles.
      vec2 eye = (p.xy-vec2(-.34,-.22))*vec2(1.2,2.55);
      float swirl = exp(-26.*dot(eye,eye))*smoothstep(.37,.77,p.z);
      float jet = p.y + (land-.5)*.16 + .024*sin(p.x*7.+p.z*3.);
      float stripe = sin(jet*35. + .45*sin(jet*31.)) + .36*sin(jet*96.);
      tone = .45 + .26*stripe + .32*(land-.5) + .11*(grain-.5);
      tone = mix(tone, .58 + .28*sin(length(eye)*34.-2.*atan(eye.y,eye.x+.0001)), swirl);
      accent = smoothstep(.52,.84,land + .19*sin(jet*18.)) * (uKind > 4.5 ? .62 : .37);
    } else if (uKind < 1.5) {
      float basins = crater(p,vec3(-.40,.29,.91),.21) + crater(p,vec3(.37,-.18,.91),.32)
        + crater(p,vec3(-.10,-.51,.88),.14) + crater(p,vec3(.52,.63,.57),.18);
      float fissures = 1.-smoothstep(.008,.047,abs(n3(p*12.+land*2.)-.50));
      tone = .37 + .56*smoothstep(.25,.68,land) + basins - .22*fissures + .15*(grain-.5);
      accent = .32*smoothstep(.49,.80,1.-land);
    } else if (uKind < 2.5) {
      float shear = p.y*.87 - p.x*.29 + (land-.5)*.19;
      float ribbons = .5 + .5*sin(38.*shear+2.*sin(11.*shear));
      tone = .28 + .38*land + .26*ribbons + .13*(grain-.5);
      accent = .39*smoothstep(.5,.79,ribbons*land*1.45);
    } else if (uKind < 3.5) {
      float rift = abs(n3(p*6.6 + vec3(land*1.9))-.5);
      float fissure = 1.-smoothstep(.009,.033,rift);
      float heat = smoothstep(.29,.58,land)*fissure;
      tone = .25 + .59*smoothstep(.35,.69,land) + .22*(grain-.5) - .14*fissure;
      accent = heat*.58;
      emission = heat*heat*.41;
    } else {
      float longitude = atan(p.z,p.x+.0001);
      float stream = .5+.5*cos(longitude*12. + 8.*p.y + 5.*land);
      float pole = pow(abs(p.y),2.4);
      float current = pow(stream,8.) * (.27 + .73*pole);
      tone = .21 + .36*land + .26*stream + .16*pole;
      accent = current*.61;
      emission = current*.23;
    }
    vec3 albedo = mix(uDeep,uLight,clamp(tone,0.,1.));
    albedo = mix(albedo,uAccent,accent);
    float day = smoothstep(-.27,.86,dot(n,sun));
    float rim = pow(1.-clamp(n.z,0.,1.),3.5) * (.28 + .72*day);
    vec3 col = albedo*(.23+.87*day) + uAccent*(.29*rim+emission);
    gl_FragColor = vec4(col, 1.);
    ${output}
  }
`;

const PLANE_VERT = /* glsl */`
  varying vec2 vPlane;
  varying vec3 vOffset;
  void main() {
    vPlane = position.xy;
    vOffset = mat3(modelViewMatrix) * position / length(modelViewMatrix[0].xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const HALO_FRAG = /* glsl */`
  uniform vec3 uTint;
  uniform float uFade, uFlare, uIdle;
  varying vec2 vPlane;
  void main() {
    float r = length(vPlane);
    float d = max(0., r-.99);
    float light = clamp(.53+dot(vPlane,vec2(-.24,.27)), .22, .94);
    float halo = (.36*exp(-d*24.)+.10*exp(-d*6.))*light;
    halo *= smoothstep(.94,1.02,r)*(1.-smoothstep(1.47,1.86,r));
    vec2 axis = vec2(.420,.907);
    float along = dot(vPlane,axis), side = dot(vPlane,vec2(axis.y,-axis.x));
    float sweep = side - .16*sin(along*3.+uIdle*.14);
    float jets = exp(-abs(sweep)*13.)*.33 + exp(-abs(sweep)*3.7)*.082;
    jets *= smoothstep(.79,1.01,abs(along)) * exp(-1.55*max(0.,abs(along)-1.)) * (1.-smoothstep(2.2,2.80,abs(along)));
    gl_FragColor = vec4(uTint, (halo+jets*uFlare)*uFade);
    ${output}
  }
`;
const RING_FRAG = /* glsl */`
  uniform vec3 uTint, uEcho;
  uniform float uFade, uInner, uOuter, uKind;
  varying vec2 vPlane;
  varying vec3 vOffset;
  ${NOISE}
  void main() {
    float r = length(vPlane);
    float t = clamp((r-uInner)/(uOuter-uInner),0.,1.);
    float bands = .41 + .30*sin(t*35. + 1.1*sin(t*17.)) + .13*sin(t*87.);
    float gap = smoothstep(.018,.047,abs(t-.68));
    if (uKind > .5) gap *= smoothstep(.05,.085,abs(t-.36));
    float edges = smoothstep(0.,.078,t)*(1.-smoothstep(.88,1.,t));
    vec3 sun = normalize(vec3(-.64,.71,.47));
    float behind = dot(vOffset,sun);
    float shadow = behind < 0. ? smoothstep(.87,1.13,length(vOffset-behind*sun)) : 1.;
    float dust = n2(vec2(t*108.,atan(vPlane.y,vPlane.x)*5.));
    vec3 tint = mix(uTint,uEcho, .18 + t*.39 - .12*bands);
    gl_FragColor = vec4(tint*(.38+.62*shadow), uFade*edges*gap*(.11+.54*bands+.15*dust)*(.26+.74*shadow));
    ${output}
  }
`;

const STAR_VERT = /* glsl */`
  uniform float uIdle, uWarp, uDpr;
  attribute vec4 aStar;
  varying vec4 vStar;
  void main() {
    float layer = aStar.w;
    vec2 p = position.xy;
    p = vec2(-.8,.2) + (p-vec2(-.8,.2))*(1. + uWarp*layer*.39);
    p += layer*vec2(.43*sin(uIdle*.12+layer), .31*cos(uIdle*.097+layer));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p,position.z,1.);
    vStar = aStar;
    vStar.y *= .94 + .06*cos(uIdle*.61+aStar.z*40.);
    gl_PointSize = aStar.x * uDpr * (1. + uWarp*layer*.48);
  }
`;
const STAR_FRAG = /* glsl */`
  uniform vec3 uTint;
  varying vec4 vStar;
  void main() {
    vec2 p = abs(gl_PointCoord-.5)*2.;
    float r = dot(p,p);
    float disc = exp(-5.4*r)*(1.-smoothstep(.60,1.,r));
    float rays = (exp(-p.x*24.-p.y*4.) + exp(-p.y*24.-p.x*4.))*(1.-smoothstep(.35,1.,max(p.x,p.y)));
    float a = disc + .66*rays*step(4.5,vStar.x);
    vec3 ice = vec3(.53,.72,1.);
    vec3 tint = mix(mix(ice,vec3(1.,.77,.53),vStar.z*vStar.z),uTint,.25);
    gl_FragColor = vec4(tint, a*vStar.y);
    ${output}
  }
`;

const WARP_VERT = /* glsl */`
  uniform float uClock, uWarp;
  attribute vec4 aRay;
  varying vec2 vTrail;
  varying float vGain;
  void main() {
    vec2 dir = vec2(cos(aRay.x),sin(aRay.x));
    float loop = fract(aRay.y+uClock*(.16+.22*aRay.z));
    float radius = .95+loop*11.2;
    float trail = uWarp*(.4+aRay.z*1.65)*(.35+loop);
    vec2 p = vec2(-.75,.05) + (radius-trail*position.x)*dir;
    p += vec2(-dir.y,dir.x)*position.y*(.010+.017*aRay.w)*mix(1.,.18,position.x);
    vGain = uWarp*uWarp * smoothstep(.03,.22,loop)*(1.-smoothstep(.76,1.,loop))*(.29+.58*aRay.w);
    vTrail = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, -14.-aRay.z*4., 1.);
  }
`;
const WARP_FRAG = /* glsl */`
  uniform vec3 uTint;
  varying vec2 vTrail;
  varying float vGain;
  void main() {
    float light = pow(1.-vTrail.x,1.5)*(1.-smoothstep(.12,1.,abs(vTrail.y)));
    gl_FragColor = vec4(mix(uTint,vec3(.66,.85,1.),.34), light*vGain);
    ${output}
  }
`;

function starfield(parent) {
  let seed = 0x5a17c0de;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const scatter = () => random() + random() + random() - 1.5;
  const positions = [], stars = [], strips = [], rays = [];
  for (let i = 0; i < 2100; i++) {
    let x = (random() - .5) * 32, y = (random() - .5) * 27;
    if (i < 710) {
      x = (random() - .5) * 22;
      y = .34 * x + 1.02 + Math.sin(x * .45) * .8 + scatter() * 3.5;
    } else if (i < 930) {
      x = -4.55 + scatter() * 4.9;
      y = -2.15 - .42 * (x + 4.55) + scatter() * 2.8;
    }
    const depth = .23 + random() * .77;
    const bright = i % 71 === 0;
    const mask = 1 - .58 * Math.exp(-((x + 1) ** 2 * .18 + (y - .10) ** 2 * .40));
    positions.push(x, y, -29 + depth * 14);
    stars.push(bright ? 4.8 + 5.8 * random() : 1.35 + 1.72 * depth * random(),
      (bright ? .72 : .16 + random() ** 2 * .44) * mask, random(), depth);
  }
  for (let i = 0; i < 135; i++) {
    const ray = [random() * TAU, random(), random(), random()];
    strips.push(0, -1, 0, 1, -1, 0, 0, 1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0);
    for (let j = 0; j < 6; j++) rays.push(...ray);
  }
  const geometry = (points, name, data) => new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    .setAttribute(name, new THREE.Float32BufferAttribute(data, 4));
  const blend = { transparent: true, depthWrite: false };
  const starsMat = shader(STAR_VERT, STAR_FRAG, { uIdle: 0, uWarp: 0, uDpr: 1, uTint: color(0xffffff) }, blend);
  const points = new THREE.Points(geometry(positions, 'aStar', stars), starsMat);
  points.renderOrder = -30;
  points.frustumCulled = false;
  points.onBeforeRender = (renderer) => { starsMat.uniforms.uDpr.value = renderer.getPixelRatio(); };
  parent.add(points);
  const warp = add(parent, geometry(strips, 'aRay', rays), shader(WARP_VERT, WARP_FRAG,
    { uClock: 0, uWarp: 0, uTint: color(0xffffff) }, { ...blend, side: THREE.DoubleSide, forceSinglePass: true }), -29);
  warp.frustumCulled = false;
  return [starsMat.uniforms, warp];
}

function makePlanet(parent, chapter, kind, sphere, moonSphere, haloPlane) {
  const { name, frame: [x, y, z, radius], colors, ring, moons } = chapter;
  const node = new THREE.Group();
  node.name = name;
  parent.add(node);
  const fades = [];
  function layer(geometry, vertex, fragment, values, options, order) {
    const mesh = add(node, geometry, shader(vertex, fragment, { ...values, uFade: 0 }, options), order);
    fades.push(mesh.material.uniforms.uFade);
    return mesh;
  }
  function globe(geometry, palette, type, seed) {
    const [uDeep, uLight, uAccent] = palette.map(color);
    return layer(geometry, BODY_VERT, BODY_FRAG, { uDeep, uLight, uAccent, uKind: type, uSeed: seed });
  }
  const globeMesh = globe(sphere, colors, kind, kind * 3.17);
  const flatten = kind === 0 ? .92 : kind === 2 || kind === 5 ? .96 : 1;
  globeMesh.scale.y = flatten;
  const blend = { transparent: true, depthWrite: false };
  const halo = layer(haloPlane, PLANE_VERT, HALO_FRAG,
    { uTint: color(colors[2]), uFlare: kind === 4 ? 1 : 0, uIdle: 0 }, blend, -20);
  halo.position.z = -.06;
  halo.scale.y = flatten;
  if (ring) {
    const [uInner, uOuter, tilt, angle] = ring;
    const band = layer(new THREE.RingGeometry(uInner, uOuter, 120), PLANE_VERT, RING_FRAG,
      { uTint: color(colors[1]), uEcho: color(colors[2]), uInner, uOuter, uKind: kind },
      { ...blend, side: THREE.DoubleSide, forceSinglePass: true }, -18);
    band.rotation.set(tilt, 0, angle, 'ZXY');
  }
  const satellites = moons.map(([mx, my, mz, size, tint], i) => {
    const moon = globe(moonSphere, [0x233143, tint, tint], 1, 11.4 + i * 2.5 + kind);
    moon.scale.setScalar(size);
    return { moon, mx, my, mz };
  });
  let weight = 0;
  return (target, ease, idle, warp) => {
    weight = lerp(weight, target, ease);
    if (weight < .009) weight = 0;
    if (weight > .997) weight = 1;
    node.visible = weight > 0;
    if (!node.visible) return;
    const drift = Math.sin(idle * .22 + kind * .67) - Math.sin(kind * .67);
    node.position.set(x + .09 * drift + warp * .51 + (1 - weight) * .42, y + .07 * drift, z - warp * .92);
    node.scale.setScalar(radius * (1 - warp * .10));
    globeMesh.rotation.set(-.12, -.14 + .16 * kind + idle * (.025 + kind * .003), kind === 4 ? -.433 : kind % 2 ? .12 : -.19);
    halo.material.uniforms.uIdle.value = idle;
    for (const fade of fades) fade.value = weight;
    satellites.forEach(({ moon, mx, my, mz }, i) => {
      const arc = idle * (.072 + i * .016);
      moon.position.set(mx + .19 * Math.sin(arc), my + .11 * (Math.cos(arc) - 1), mz);
      moon.rotation.y = i * .70 + idle * .063;
    });
  };
}

export function createCosmos(layout) {
  const root = new THREE.Group();
  root.name = 'Cosmos';
  layout.add(root);
  const sky = add(root, new THREE.PlaneGeometry(2, 2), shader(SKY_VERT, SKY_FRAG,
    { uSky: color(CHAPTERS[0].sky[0]), uEcho: color(CHAPTERS[0].sky[1]), uTilt: CHAPTERS[0].sky[2], uIdle: 0, uWarp: 0 },
    { depthWrite: false, depthTest: false }), -100);
  sky.position.z = -32;
  sky.frustumCulled = false;
  const [stars, streaks] = starfield(root);
  const sphere = new THREE.SphereGeometry(1, 72, 48);
  const moonSphere = new THREE.SphereGeometry(1, 24, 16);
  const haloPlane = new THREE.PlaneGeometry(5.8, 5.8);
  const planets = CHAPTERS.map((chapter, kind) => makePlanet(root, chapter, kind, sphere, moonSphere, haloPlane));
  const palettes = CHAPTERS.map(({ sky: [primary, echo, tilt] }) => [color(primary), color(echo), tilt]);
  const field = sky.material.uniforms;
  const warpUniforms = streaks.material.uniforms;

  function update({ stage, time, motionTime, travel, move, reduced }) {
    const ease = reduced ? 1 : move;
    const idle = reduced ? 0 : motionTime;
    const warp = reduced ? 0 : travel;
    const [primary, echo, tilt] = palettes[stage];
    field.uSky.value.lerp(primary, ease);
    field.uEcho.value.lerp(echo, ease);
    field.uTilt.value = lerp(field.uTilt.value, tilt, ease);
    field.uIdle.value = stars.uIdle.value = idle;
    field.uWarp.value = stars.uWarp.value = warpUniforms.uWarp.value = warp;
    stars.uTint.value.copy(field.uSky.value);
    warpUniforms.uTint.value.copy(field.uEcho.value);
    warpUniforms.uClock.value = reduced ? 0 : time;
    streaks.visible = warp > .018;
    planets.forEach((planet, i) => planet(Number(i === stage), ease, idle, warp));
  }

  update({ stage: 0, time: 0, motionTime: 0, travel: 0, move: 1, reduced: false });
  return { update };
}
