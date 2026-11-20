import * as THREE from 'three';
import { createCosmos } from './cosmos.js';

const MINT = 0x6bf6ce;
const CONTEXT = [0x74cfff, 0xbaadff, 0xffd487, MINT];
const TAU = Math.PI * 2;
const { lerp, clamp, smoothstep } = THREE.MathUtils;
const ink = (color, opacity) => new THREE.LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false, toneMapped: false });
const signal = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const metal = (color, roughness = 0.73) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.24 });
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

function group(parent) {
  const node = new THREE.Group();
  parent.add(node);
  return node;
}

function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function plate(points, depth, bevel = 0, hole) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  if (hole) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1 });
}

function clipped(w, h, c) {
  const x = w / 2, y = h / 2;
  return [[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]];
}

function arc(r, start, span, steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => polar(r, start + span * i / steps));
}

function band(inner, outer, start, span, depth, steps = 24) {
  return plate([...arc(outer, start, span, steps), ...arc(inner, start + span, -span, steps)], depth);
}

function lines(parent, material, paths, z = 0) {
  const vertices = [];
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) vertices.push(...path[i - 1], z, ...path[i], z);
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const line = new THREE.LineSegments(geometry, material);
  parent.add(line);
  return line;
}

// Bake each rigid assembly by material; moving plates and orbit segments keep their pivots.
function bake(node) {
  const batches = new Map();
  for (const child of node.children) {
    if (!child.isMesh) continue;
    if (!batches.has(child.material)) batches.set(child.material, []);
    batches.get(child.material).push(child);
  }
  const p = new THREE.Vector3(), n = new THREE.Vector3(), transform = new THREE.Matrix3();
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const positions = [], normals = [], indices = [];
    for (const mesh of meshes) {
      mesh.updateMatrix();
      transform.getNormalMatrix(mesh.matrix);
      const { position, normal } = mesh.geometry.attributes;
      const index = mesh.geometry.index, base = positions.length / 3;
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
        n.fromBufferAttribute(normal, i).applyNormalMatrix(transform);
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
      }
      for (let i = 0; i < (index?.count ?? position.count); i++) indices.push(base + (index ? index.getX(i) : i));
      node.remove(mesh);
    }
    const geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      .setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    part(node, geometry, material);
  }
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(7, 5.4, 9);
  camera.lookAt(0, 0, 0);
  const layout = group(scene);
  layout.quaternion.copy(camera.quaternion);
  const cosmos = createCosmos(layout);
  scene.add(new THREE.HemisphereLight(0xd7efff, 0x35477a, 2.05));
  for (const [color, intensity, x, y, z] of [[0xe9f6ff, 2.55, -4, 7, 5], [0x69ddde, 2, 4, 2, -5], [0x7a92f0, 1.3, 4, -2, 4]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }

  const hull = metal(0x21364f), panel = metal(0x3c5873), dark = metal(0x0b1729);
  const alloy = metal(0x728ea0, 0.54), mint = signal(MINT), seam = signal(0x32676c);
  const unit = new THREE.BoxGeometry(), bolt = new THREE.CylinderGeometry(0.051, 0.051, 0.036, 6);
  const diamond = new THREE.OctahedronGeometry(1);
  function box(parent, mat, x, y, z, w, h, d) {
    const mesh = part(parent, unit, mat, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }
  function flat(parent, mat, w, h, c, depth, x, y, z, bevel = 0.016) {
    return part(parent, plate(clipped(w, h, c), depth, bevel), mat, x, y, z);
  }
  function gem(parent, mat, size) {
    const mesh = part(parent, diamond, mat);
    mesh.scale.setScalar(size);
    return mesh;
  }

  const shuttle = group(layout), craft = group(shuttle);
  const porcelain = metal(0x9dafbe, 0.45), glass = metal(0x18628a, 0.17);
  const wing = [[0.25, 0.71], [0.94, 0.29], [1.5, -0.79], [1.15, -0.94], [0.84, -0.54], [0.29, -0.67]];
  const vessel = [[0, 1.47], [-0.34, 0.88], [-0.45, 0.3], [-0.43, -0.68], [-0.29, -1.02], [0.29, -1.02], [0.43, -0.68], [0.45, 0.3], [0.34, 0.88]];
  part(craft, plate(vessel, 0.18, 0.065), porcelain, 0, 0, 0.03);
  const canopy = part(craft, new THREE.SphereGeometry(1, 24, 12), glass, 0, 0.64, 0.227);
  canopy.scale.set(0.234, 0.51, 0.22);
  box(craft, porcelain, 0, 0.35, 0.31, 0.38, 0.075, 0.12);
  box(craft, dark, 0, -0.34, 0.245, 0.44, 0.62, 0.08);
  const thruster = new THREE.CylinderGeometry(0.15, 0.22, 0.65, 10);
  const engineLight = new THREE.CylinderGeometry(0.17, 0.17, 0.055, 12);
  const plumeMat = new THREE.ShaderMaterial({
    uniforms: { power: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 tex; void main() { tex = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 tex; uniform float power; void main() { float w = 0.15 + tex.y * 0.65; float edge = 1. - smoothstep(0., w, abs(tex.x * 2. - 1.)); gl_FragColor = vec4(mix(vec3(.08,.32,.96), vec3(.48,1.,.87), tex.y), edge * pow(tex.y, 2.1) * (.42 + power * .5)); }',
  });
  const exhausts = group(craft);
  const plumeShape = new THREE.PlaneGeometry(0.56, 1);
  const plumes = [];
  for (const side of [-1, 1]) {
    part(craft, plate(wing.map(([x, y]) => [x * side, y]), 0.075, 0.026), panel, 0, 0, 0);
    part(craft, plate([[0.49, 0.40], [0.92, 0.13], [1.24, -0.54], [0.96, -0.46]].map(([x, y]) => [x * side, y]), 0.045, 0.012), porcelain, 0, 0, 0.09);
    part(craft, thruster, hull, side * 0.61, -0.62, 0.122);
    part(craft, engineLight, mint, side * 0.61, -0.946, 0.122);
    box(craft, mint, side * 1.21, -0.56, 0.065, 0.19, 0.055, 0.046).rotation.z = side * 1.12;
    box(craft, seam, side * 0.355, -0.18, 0.216, 0.052, 0.48, 0.036);
    box(craft, mint, side * 0.305, 0.40, 0.245, 0.05, 0.14, 0.029);
    for (let i = 0; i < 4; i++) box(craft, alloy, side * 0.14, -0.16 - 0.12 * i, 0.305, 0.13, 0.025, 0.02);
    plumes.push(part(exhausts, plumeShape, plumeMat, side * 0.61, -1.57, 0.08));
  }
  bake(craft);
  const reticle = group(layout);
  reticle.position.z = -2.4;
  const navLight = ink(MINT, 0.32);
  for (let i = 0; i < 2; i++) {
    const orbit = group(reticle);
    orbit.rotation.set(i ? 0.87 : 0.63, i ? -0.34 : 0.18, i ? -0.76 : 0.69);
    const arcs = Array.from({ length: 6 }, (_, j) => arc(2.73 + i * 0.38, j * TAU / 6 + 0.08, TAU / 6 - 0.17, 16));
    lines(orbit, navLight, arcs);
    for (let j = 0; j < 3; j++) {
      const beacon = gem(orbit, mint, 0.046);
      const [x, y] = polar(2.73 + i * 0.38, (j + i * 0.23) * TAU / 3);
      beacon.position.set(x, y, 0);
    }
  }

  const core = group(layout);
  const iso = group(core);
  iso.quaternion.copy(camera.quaternion).invert();
  const chassis = group(iso);
  const top = group(chassis), bottom = group(chassis);
  function collar(parent, w, opening, level, mat) {
    const mesh = part(parent, plate(clipped(w, w, w * 0.23), 0.14, 0.035, clipped(opening, opening, opening * 0.26).reverse()), mat, 0, level);
    mesh.rotation.x = -Math.PI / 2;
  }
  for (const deck of [top, bottom]) {
    collar(deck, 2.68, 1.12, -0.17, hull);
    collar(deck, 2.48, 1.46, 0, panel);
    collar(deck, 1.48, 1.29, 0.024, deck === top ? seam : dark);
    for (let side = 0; side < 4; side++) {
      const rim = group(deck);
      rim.rotation.y = side * TAU / 4;
      box(rim, dark, 0, 0.074, 1.30, 0.76, 0.20, 0.15);
      box(rim, alloy, -0.41, 0.18, 1.26, 0.24, 0.08, 0.20);
      box(rim, mint, 0.12, 0.175, 1.38, 0.38, 0.034, 0.025);
      for (let i = 0; i < 4; i++) box(rim, alloy, -0.27 + i * 0.105, 0.171, 1.16, 0.028, 0.019, 0.16);
      for (const x of [-0.57, 0.57]) part(rim, bolt, dark, x, 0.159, 1.08);
      bake(rim);
    }
    bake(deck);
  }

  const frame = group(chassis);
  for (const x of [-0.91, 0.91]) for (const z of [-0.91, 0.91]) {
    box(frame, hull, x, -0.03, z, 0.22, 1.88, 0.22);
    box(frame, alloy, x, -0.03, z * 1.13, 0.068, 1.56, 0.058);
    box(frame, panel, x, -0.47, z, 0.36, 0.27, 0.36);
    box(frame, seam, x, 0.16, z * 1.17, 0.084, 0.44, 0.04);
    for (const y of [-0.79, 0.74]) box(frame, dark, x, y, z, 0.32, 0.15, 0.32);
  }
  bake(frame);
  const spindle = group(chassis);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x298382, emissive: MINT, emissiveIntensity: 0.42, roughness: 0.38, metalness: 0.22, flatShading: true });
  part(spindle, new THREE.CylinderGeometry(0.43, 0.56, 0.51, 6), crystalMat, 0, 0.26);
  part(spindle, new THREE.CylinderGeometry(0.56, 0.25, 0.55, 6), crystalMat, 0, -0.26);
  part(spindle, new THREE.CylinderGeometry(0.37, 0.44, 0.22, 6), alloy, 0, 0.61);
  part(spindle, new THREE.CylinderGeometry(0.32, 0.18, 0.27, 6), mint, 0, 0.79);
  const iris = group(spindle);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const [x, z] = polar(0.67, a);
    box(iris, panel, x, -0.035, z, 0.105, 0.68, 0.22).rotation.y = -a;
    box(iris, mint, x * 1.11, 0.025, z * 1.11, 0.036, 0.38, 0.108).rotation.y = -a;
  }
  bake(iris);

  const upperTilt = group(iso), lowerTilt = group(iso);
  upperTilt.rotation.z = 0.20;
  lowerTilt.rotation.z = -0.24;
  upperTilt.position.y = 0.49;
  lowerTilt.position.y = -0.62;
  const upper = group(upperTilt), lower = group(lowerTilt);
  for (const [orbit, r, length, offset] of [[upper, 2.12, 1.43, 0], [lower, 1.89, 1.08, 0.45]]) {
    orbit.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + offset;
      part(orbit, band(r - 0.16, r, a, length, 0.075), hull);
      part(orbit, band(r - 0.135, r - 0.101, a + 0.12, length - 0.25, 0.016), alloy, 0, 0, 0.078);
      part(orbit, band(r + 0.035, r + 0.062, a - 0.12, length + 0.28, 0.024), i === 1 ? seam : mint, 0, 0, 0.046);
      for (const end of [a, a + length]) {
        const [x, y] = polar(r - 0.08, end);
        box(orbit, alloy, x, y, 0.06, 0.18, 0.23, 0.13).rotation.z = end;
      }
    }
    bake(orbit);
  }

  function makeModule(index) {
    const color = new THREE.Color(CONTEXT[index]);
    const accent = signal(color);
    const body = hull.clone(), face = panel.clone();
    const root = group(layout), tilted = group(root), insert = group(tilted);
    tilted.rotation.set(-0.22, index % 2 === 0 ? 0.29 : -0.29, index % 2 === 0 ? 0.065 : -0.065);
    const w = [1.83, 1.69, 1.99, 1.84][index], h = [1.48, 1.64, 1.32, 1.43][index];
    flat(tilted, body, w, h, 0.26, 0.20, 0, 0, -0.17, 0.045);
    flat(tilted, face, w - 0.14, h - 0.14, 0.22, 0.065, 0, 0, 0.045);
    flat(tilted, dark, w - 0.40, h - 0.38, 0.14, 0.033, 0, 0.022, 0.121);
    for (const x of [-w / 2 + 0.13, w / 2 - 0.13]) {
      for (const y of [-h / 2 + 0.27, h / 2 - 0.27]) part(tilted, bolt, face, x, y, 0.12).rotation.x = Math.PI / 2;
    }
    box(tilted, accent, -w / 2 + 0.37, -h / 2 + 0.12, 0.14, 0.26, 0.045, 0.032);
    for (let i = 0; i < 3; i++) box(tilted, face, w / 2 - 0.24 - i * 0.10, -h / 2 + 0.12, 0.14, 0.041, 0.057, 0.034);

    if (index === 0) {
      // Specs: stepped document stack with a clipped sheet and broken trace rows.
      flat(insert, face, 0.84, 0.89, 0.12, 0.075, 0.15, 0.092, 0.19);
      flat(insert, body, 0.84, 0.89, 0.12, 0.075, 0.038, 0.045, 0.28);
      const sheet = [[-0.64, -0.46], [0.20, -0.46], [0.20, 0.20], [-0.01, 0.43], [-0.64, 0.43]];
      part(insert, plate(sheet, 0.068, 0.02), face, 0.16, 0.02, 0.37);
      for (const [y, width] of [[0.24, 0.34], [0.02, 0.52], [-0.16, 0.42]]) {
        box(insert, accent, -0.38 + width / 2, y, 0.451, width, 0.044, 0.024);
      }
      box(insert, accent, -0.60, -0.14, 0.209, 0.034, 0.35, 0.024);
    } else if (index === 1) {
      // Steering: a suspended compass needle inside a segmented gimbal.
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + 0.13;
        part(insert, band(0.41, 0.56, a, TAU / 4 - 0.26, 0.14, 10), face, 0, 0, 0.19);
        part(insert, band(0.466, 0.508, a + 0.13, TAU / 4 - 0.52, 0.024, 8), accent, 0, 0, 0.331);
      }
      part(insert, plate([[0, 0.39], [0.115, -0.13], [0, -0.27], [-0.10, -0.13]], 0.078, 0.012), accent, 0, 0, 0.258).rotation.z = -0.56;
      part(insert, bolt, dark, 0, 0, 0.363).rotation.x = Math.PI / 2;
    } else if (index === 2) {
      // Skills: three keyed cartridges with stepped heights and brass contact pads.
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 0.42, height = [0.48, 0.83, 0.65][i];
        flat(insert, face, 0.33, height, 0.085, 0.16 + i * 0.024, x, -0.33 + height / 2, 0.178);
        box(insert, accent, x, height - 0.45, 0.357 + i * 0.024, 0.19, 0.108, 0.039);
        for (let j = 0; j < 2; j++) box(insert, body, x, -0.21 + j * 0.10, 0.36 + i * 0.024, 0.19, 0.033, 0.029);
      }
    } else {
      // Hooks: opposed locking jaws and the pin they close around.
      const jaw = [[-0.56, -0.34], [-0.35, -0.41], [0.07, -0.41], [0.20, -0.22], [0.14, -0.12], [-0.24, -0.19], [-0.32, -0.10], [-0.32, 0.13], [-0.18, 0.21], [0.06, 0.19], [0.06, 0.38], [-0.38, 0.40], [-0.56, 0.23]];
      for (const side of [-1, 1]) {
        part(insert, plate(jaw, 0.16, 0.021), face, side * 0.19, 0, 0.20).rotation.z = side === 1 ? Math.PI : 0;
        box(insert, accent, side * 0.45, side * 0.24, 0.386, 0.28, 0.056, 0.034);
      }
      gem(insert, accent, 0.18).position.z = 0.31;
    }
    bake(tilted);
    bake(insert);

    const sweep = ink(color, 0);
    const scan = lines(root, sweep, [[[-0.91, 0.11], [-0.91, 0], [0.91, 0], [0.91, -0.11]]], 0.59);
    const sparks = new THREE.InstancedMesh(diamond, accent, 12);
    sparks.frustumCulled = false;
    sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(sparks);
    return { root, tilted, insert, accent, body, face, color, scan, sweep, sparks };
  }
  const modules = CONTEXT.map((_, i) => makeModule(i));

  function makeTerminal(index) {
    const color = [CONTEXT[0], CONTEXT[1], MINT][index];
    const accent = signal(color);
    const root = group(layout), bezel = group(root), glyph = group(bezel);
    bezel.rotation.x = -0.16;
    flat(bezel, hull, 2.43, 1.52, 0.26, 0.20, 0, 0, -0.15, 0.04);
    flat(bezel, panel, 2.28, 1.38, 0.22, 0.052, 0, 0, 0.065);
    flat(bezel, dark, 1.98, 1.03, 0.11, 0.026, 0, 0.085, 0.137);
    box(bezel, accent, -0.79, -0.54, 0.155, 0.33, 0.046, 0.042);
    for (let i = 0; i < 4; i++) box(bezel, alloy, 0.49 + i * 0.108, -0.54, 0.155, 0.049, 0.052, 0.047);

    const traces = [];
    function node(x, y, w, h, angle = 0) {
      box(glyph, accent, x, y, 0.207, w, h, 0.035).rotation.z = angle;
      box(glyph, dark, x, y, 0.231, w - 0.087, h - 0.085, 0.019).rotation.z = angle;
    }
    if (index === 0) {
      node(-0.55, 0.20, 0.46, 0.26);
      node(0.55, 0.20, 0.44, 0.26);
      node(0, -0.21, 0.62, 0.22);
      traces.push([[-0.33, 0.20], [0.33, 0.20]], [[0.55, 0.08], [0.55, -0.21], [0.28, -0.21]], [[-0.55, 0.08], [-0.55, -0.21], [-0.28, -0.21]]);
    } else if (index === 1) {
      node(-0.55, 0, 0.30, 0.22);
      node(0, 0, 0.34, 0.34, Math.PI / 4);
      for (const y of [-0.25, 0.25]) {
        node(0.61, y, 0.32, 0.19);
        traces.push([[0.19, 0], [0.33, 0], [0.33, y], [0.45, y]]);
      }
      traces.push([[-0.41, 0], [-0.20, 0]]);
    } else {
      for (let i = 0; i < 3; i++) {
        const y = 0.30 - i * 0.28;
        node(-0.12 + i * 0.12, y, 1.28 - i * 0.22, 0.17);
        box(glyph, accent, -0.57 + i * 0.21, y, 0.252, 0.15, 0.035, 0.016);
      }
      traces.push([[0.40, 0.30], [0.73, 0.30], [0.73, 0.02], [0.51, 0.02]], [[-0.43, 0.02], [-0.73, 0.02], [-0.73, -0.26], [-0.29, -0.26]]);
    }
    const trace = ink(color, 0.22);
    lines(glyph, trace, traces, 0.218);
    bake(bezel);
    bake(glyph);
    return { root, glyph, accent, trace, color: new THREE.Color(color), level: 0 };
  }
  const terminals = [0, 1, 2].map(makeTerminal);

  // Separate jacket and signal tracks. Each packet follows the same elbows as its track.
  function conduit(color) {
    const material = ink(color, 0.2);
    const wire = lines(layout, material, [[[0, 0], [0, 0], [0, 0], [0, 0]]], -0.84);
    const jacket = lines(layout, ink(0x536f8b, 0.37), [[[0, 0], [0, 0], [0, 0], [0, 0]]], -0.86);
    wire.frustumCulled = jacket.frustumCulled = false;
    const packet = gem(layout, signal(color), 0.092);
    return (path, opacity, progress) => {
      wire.visible = jacket.visible = opacity > 0.01;
      packet.visible = wire.visible && progress > 0 && progress < 1;
      if (!wire.visible) return;
      material.opacity = opacity;
      jacket.material.opacity = 0.34 * Math.min(1, opacity * 5);
      const main = wire.geometry.attributes.position, edge = jacket.geometry.attributes.position;
      for (let i = 0; i < 6; i++) {
        const [x, y] = path[Math.floor((i + 1) / 2)];
        main.setXYZ(i, x, y, -0.84);
        edge.setXYZ(i, x, y - 0.074, -0.86);
      }
      main.needsUpdate = edge.needsUpdate = true;
      if (packet.visible) {
        const lengths = path.slice(1).map(([x, y], i) => Math.hypot(x - path[i][0], y - path[i][1]));
        let d = progress * (lengths[0] + lengths[1] + lengths[2]);
        for (let i = 0; i < 3; i++) {
          if (lengths[i] > 0 && d <= lengths[i]) {
            const t = d / lengths[i];
            packet.position.set(lerp(path[i][0], path[i + 1][0], t), lerp(path[i][1], path[i + 1][1], t), -0.64);
            break;
          }
          d -= lengths[i];
        }
      }
    };
  }
  const inputs = CONTEXT.map(conduit);
  const outputs = [CONTEXT[0], CONTEXT[1], MINT].map(conduit);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stageBox = canvas.closest('.stage') || canvas.parentElement || canvas;
  const dummy = new THREE.Object3D();
  const destination = new THREE.Color(MINT);
  let stage = 0, time = 0, arrivedAt = -Infinity, direction = 1;
  let deployed = 0, motionTime = 0, last = 0, frameId = 0;

  function draw(dt = 0, snap = false) {
    const reduced = reduce.matches;
    const move = snap || reduced ? 1 : 1 - Math.exp(-dt * 5.2);
    const focus = stage > 0 && stage < 5 ? stage - 1 : -1;
    const finale = stage === 5;
    const age = reduced ? Infinity : time - arrivedAt;
    const travel = Math.sin(Math.PI * smoothstep(age, 0, 0.9));
    const opening = finale ? smoothstep(age, 0.47, 1.2) : 0;
    const drift = reduced ? 0 : Math.sin(motionTime * 1.17) * 0.085;
    camera.zoom = 1 + 0.12 * travel;
    camera.updateProjectionMatrix();
    cosmos.update({ stage, time, motionTime, travel, move, reduced });

    shuttle.position.x = lerp(shuttle.position.x, stage === 0 ? -1.08 : stage === 5 ? -4.72 : -3.92, move);
    shuttle.position.y = lerp(shuttle.position.y, stage === 0 ? -0.09 : stage === 5 ? -3.44 : -2.47, move);
    shuttle.position.z = 2.0;
    shuttle.scale.setScalar(lerp(shuttle.scale.x, stage === 0 ? 1.40 : finale ? 0.30 : 0.44, move));
    craft.position.set(direction * 2.1 * travel, drift + 0.9 * travel, 0);
    craft.rotation.set(0.26 + 0.18 * travel, -0.42 - direction * 0.28 * travel, -0.95 - direction * 0.19 * travel + drift * 0.4);
    plumeMat.uniforms.power.value = travel;
    for (const plume of plumes) {
      const exhaust = 1.10 + 1.65 * travel + drift;
      plume.scale.y = exhaust;
      plume.position.y = -0.96 - exhaust / 2;
    }

    deployed = lerp(deployed, Number(finale), move);
    core.visible = deployed > 0.018;
    core.position.set(0, 0.78 + 0.54 * deployed, 0);
    core.scale.setScalar(Math.max(deployed, 0.01) * 0.83);
    iso.position.y = drift;
    reticle.position.x = lerp(reticle.position.x, stage === 0 ? -1.0 : finale ? 0 : -1.29, move);
    reticle.position.y = lerp(reticle.position.y, finale ? 1.05 : 0.02, move);
    reticle.rotation.z = reduced ? 0 : motionTime * 0.13 + travel * 0.46 * direction;
    reticle.scale.setScalar(lerp(reticle.scale.x, stage === 0 ? 1.24 : finale ? 1.08 : 0.91, move));
    destination.setHex(focus < 0 ? MINT : CONTEXT[focus]);
    navLight.color.lerp(destination, move);
    navLight.opacity = 0.29 + travel * 0.30;
    chassis.rotation.y = 0.18 + opening * 0.46 + drift;
    top.position.y = 0.90 + opening * 0.31;
    bottom.position.y = -1.06 - opening * 0.14;
    spindle.rotation.y = (reduced ? 0.26 : motionTime * 0.56) + opening * 1.22;
    crystalMat.emissiveIntensity = 0.48 + opening * 0.72;
    upper.rotation.z = 0.27 + motionTime * 0.28 + opening * 0.31;
    lower.rotation.z = -0.36 - motionTime * 0.23 - opening * 0.19;

    modules.forEach((module, index) => {
      const active = index === focus;
      const side = index % 2 === 0 ? -1 : 1, row = index < 2 ? 1 : -1;
      const p = clamp((age - 0.29) / 0.88, 0, 1);
      const hit = active ? Math.sin(Math.PI * smoothstep(p, 0, 0.84)) : 0;
      const { root, tilted, body, face, insert, accent, color, scan, sweep, sparks } = module;
      root.position.x = lerp(root.position.x, active ? -1.22 : side * (finale ? 3.77 : 6.85), move);
      root.position.y = lerp(root.position.y, active ? 0.12 : finale ? (row > 0 ? 2.64 : 0.49) : row * 2.12, move);
      root.position.z = active ? 0.85 : 0;
      root.scale.setScalar(lerp(root.scale.x, active ? 2.33 : finale ? 0.72 : 0.001, move));
      root.visible = root.scale.x > 0.018;
      if (!root.visible) {
        inputs[index]([], 0, 0);
        return;
      }
      tilted.rotation.y = (index % 2 === 0 ? 0.31 : -0.28) + drift * 1.4 + travel * 0.64 * direction;
      tilted.rotation.x = -0.31 + drift * 0.8;
      accent.color.copy(color).multiplyScalar(0.96 + hit * 0.6);
      body.color.copy(hull.color).lerp(color, active ? 0.065 : 0.01);
      face.color.copy(panel.color).lerp(color, (active ? 0.18 : 0.035) + hit * 0.16);
      insert.position.z = 0.1 + hit * 0.28;
      insert.rotation.z = hit * 0.11 - (index === 1 ? 0.18 : 0);
      scan.visible = sparks.visible = active && p > 0 && p < 1;
      if (scan.visible) {
        scan.position.y = lerp(-0.72, 0.72, p);
        sweep.opacity = 0.79 * (1 - p);
        for (let i = 0; i < sparks.count; i++) {
          const angle = i * TAU / sparks.count + index * 0.47;
          const radius = 0.54 + p * (0.79 + (i % 3) * 0.11);
          dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.79, 0.62 + p * 0.23);
          dummy.rotation.z = angle;
          dummy.scale.set(0.095 * (1 - p), 0.030 * (1 - p), 0.028 * (1 - p));
          dummy.updateMatrix();
          sparks.setMatrixAt(i, dummy.matrix);
        }
        sparks.instanceMatrix.needsUpdate = true;
      }
      const x = root.position.x, y = root.position.y;
      const cx = core.position.x + side * core.scale.x * 1.47;
      const cy = core.position.y + row * core.scale.x * 0.60;
      const elbow = lerp(cx, x, 0.47);
      inputs[index]([[x - side * 0.41, y], [elbow, y], [elbow - side * Math.min(0.4, Math.abs(y - cy)), cy], [cx, cy]],
        deployed * 0.66, (age - 0.32 - index * 0.06) / 0.7);
    });

    terminals.forEach((terminal, index) => {
      const { root, glyph, accent, trace, color } = terminal;
      const delay = 0.91 + index * 0.18;
      const arrival = delay + 0.42;
      const link = finale ? smoothstep(age, arrival - 0.05, arrival + 0.23) : 0;
      terminal.level = lerp(terminal.level, link, move);
      const level = terminal.level;
      root.visible = deployed > 0.015;
      root.position.set((index - 1) * lerp(2.75, 3.43, deployed), lerp(-1.84, -2.43, deployed), 0.44);
      root.scale.setScalar(lerp(0.1, 1, smoothstep(deployed, 0, 1)));
      glyph.position.z = level * 0.053;
      accent.color.copy(color).multiplyScalar(0.18 + level * 0.82);
      trace.opacity = 0.22 + level * 0.69;
      const x = root.position.x, end = root.position.y + 0.67 * root.scale.x;
      const y = core.position.y - core.scale.x * 1.50;
      const port = (index - 1) * 0.28;
      outputs[index]([[port, y], [port, y - 0.31], [x, end + 0.37], [x, end]],
        deployed * (0.26 + level * 0.59), reduced ? 1 : (age - delay) / 0.48);
    });
    renderer.render(scene, camera);
  }

  function animate(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    time += dt;
    motionTime += dt;
    draw(dt);
    frameId = window.requestAnimationFrame(animate);
  }

  function applyMotion() {
    window.cancelAnimationFrame(frameId);
    last = 0;
    if (reduce.matches) {
      draw(0, true);
    } else {
      frameId = window.requestAnimationFrame(animate);
    }
  }

  function resize() {
    if (!stageBox.clientWidth || !stageBox.clientHeight) return;
    const w = stageBox.clientWidth, h = stageBox.clientHeight;
    const aspect = w / h, height = Math.max(9.5, 12.25 / aspect);
    camera.left = -height * aspect / 2;
    camera.right = height * aspect / 2;
    camera.bottom = -height / 2;
    camera.top = height / 2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 600 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    draw();
  }

  draw(0, true);
  resize();
  reduce.addEventListener('change', applyMotion);
  applyMotion();
  return {
    setStage(index) {
      if (!Number.isInteger(index) || index < 0 || index > 5 || index === stage) return;
      direction = Math.sign(index - stage);
      stage = index;
      arrivedAt = time;
      if (reduce.matches) draw(0, true);
    },
    resize,
  };
}
