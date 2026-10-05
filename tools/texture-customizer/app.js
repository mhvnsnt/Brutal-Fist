// Texture Customizer PWA - touch-first texture editor for GLB models
'use strict';

// ============ State ============
const S = {
  glb: null,          // {json, bin, name}
  textures: [],       // [{index, imageIndex, canvas, threeTex, name}]
  activeTex: -1,
  layers: [],         // active overlays on current texture: [{img, x,y, scale, rot, flipH, flipV, id}]
  selLayer: -1,
  three: null,
};

// ============ GLB parsing ============
function parseGLB(buf) {
  const dv = new DataView(buf);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546C67) throw new Error('Not a GLB');
  const jlen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jlen)));
  const boff = 20 + jlen;
  const blen = dv.getUint32(boff, true);
  const bin = buf.slice(boff + 8, boff + 8 + blen);
  return { json, bin };
}
function getBV(glb, i) {
  const bv = glb.json.bufferViews[i];
  return glb.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
}
function getImageBlob(glb, imgIdx) {
  const img = glb.json.images[imgIdx];
  const bytes = getBV(glb, img.bufferView);
  return new Blob([bytes], { type: img.mimeType || 'image/png' });
}

// ============ Three.js preview ============
function initThree() {
  const canvas = document.getElementById('gl3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  cam.position.set(0, 1.5, 4);
  const ctl = new THREE.OrbitControls(cam, canvas);
  ctl.enableDamping = true;
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2);
  dl.position.set(5, 10, 7);
  scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dl2.position.set(-5, 5, -5);
  scene.add(dl2);
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  (function loop() {
    requestAnimationFrame(loop);
    ctl.update();
    renderer.render(scene, cam);
  })();
  S.three = { renderer, scene, cam, ctl, model: null };
}
function loadModelToThree(glb) {
  const { scene } = S.three;
  if (S.three.model) {
    scene.remove(S.three.model);
    S.three.model = null;
  }
  const blob = new Blob([rebuildGLB(glb)], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  new THREE.GLTFLoader().load(url, (g) => {
    S.three.model = g.scene;
    scene.add(g.scene);
    const box = new THREE.Box3().setFromObject(g.scene);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3()).length();
    S.three.ctl.target.copy(c);
    S.three.cam.position.set(c.x + s * 0.6, c.y + s * 0.3, c.z + s * 0.9);
    URL.revokeObjectURL(url);
    document.getElementById('preview-hint').style.display = 'none';
  });
}
function refreshThreeTexture(texEntry) {
  // Update the three.js material map from our edited canvas
  if (!S.three.model || !texEntry.threeTex) return;
  texEntry.threeTex.needsUpdate = true;
}

// ============ Texture extraction ============
async function extractTextures(glb) {
  S.textures = [];
  const json = glb.json;
  if (!json.textures) return;
  const listEl = document.getElementById('tex-list');
  listEl.innerHTML = '';
  for (let ti = 0; ti < json.textures.length; ti++) {
    const src = json.textures[ti].source;
    const blob = getImageBlob(glb, src);
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    // Find material(s) using this texture for a name
    let name = 'Texture ' + ti;
    for (let mi = 0; mi < (json.materials || []).length; mi++) {
      const m = json.materials[mi];
      const t = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
      if (t && t.index === ti) { name = m.name || ('Material ' + mi); break; }
    }
    const entry = { index: ti, src, canvas: cv, name, threeTex: null };
    // three.js texture for live preview
    const tt = new THREE.CanvasTexture(cv);
    tt.flipY = false;
    entry.threeTex = tt;
    S.textures.push(entry);
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.className = 'tex-thumb';
    img.title = name;
    img.onclick = () => selectTexture(ti);
    listEl.appendChild(img);
    entry.thumb = img;
  }
  // Hook three.js materials to our canvas textures
  if (S.three.model) {
    S.three.model.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (m.map && m.map.image) {
            // Match by texture index if possible; fallback: leave as-is
          }
        });
      }
    });
  }
}
function selectTexture(ti) {
  S.activeTex = ti;
  S.layers = [];
  S.selLayer = -1;
  document.querySelectorAll('.tex-thumb').forEach((el, i) => {
    el.classList.toggle('sel', S.textures[i] && S.textures[i].index === ti);
  });
  drawEditor();
  updateLayerList();
  document.getElementById('btn-addimg').disabled = false;
  document.getElementById('editor-hint').style.display = 'none';
  refreshTools();
}

// ============ 2D Editor with touch ============
const ed = {
  canvas: null, ctx: null,
  view: { scale: 1, ox: 0, oy: 0 }, // pan/zoom of the canvas view
};
function drawEditor() {
  const cv = document.getElementById('tex2d');
  const ctx = cv.getContext('2d');
  ed.canvas = cv; ed.ctx = ctx;
  const t = S.textures.find((x) => x.index === S.activeTex);
  if (!t) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
  // Fit texture to canvas
  cv.width = t.canvas.width;
  cv.height = t.canvas.height;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(t.canvas, 0, 0);
  // Draw layers
  S.layers.forEach((L, i) => {
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate(L.rot);
    ctx.scale(L.scale * (L.flipH ? -1 : 1), L.scale * (L.flipV ? -1 : 1));
    ctx.globalAlpha = 0.95;
    ctx.drawImage(L.img, -L.img.width / 2, -L.img.height / 2);
    ctx.restore();
    if (i === S.selLayer) {
      // selection box
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(L.rot);
      const w = L.img.width * L.scale, h = L.img.height * L.scale;
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // handles
      ctx.fillStyle = '#2563eb';
      [[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]].forEach(([hx,hy])=>{
        ctx.beginPath(); ctx.arc(hx, hy, 10, 0, 7); ctx.fill();
      });
      ctx.restore();
    }
  });
  fitCanvasView();
}
function fitCanvasView() {
  const wrap = document.getElementById('canvas-wrap');
  const cv = ed.canvas;
  if (!cv || !wrap.clientWidth) return;
  const s = Math.min(wrap.clientWidth / cv.width, wrap.clientHeight / cv.height) * 0.95;
  cv.style.width = (cv.width * s) + 'px';
  cv.style.height = (cv.height * s) + 'px';
}
function canvasPos(ev) {
  const r = ed.canvas.getBoundingClientRect();
  const cx = (ev.clientX - r.left) / r.width * ed.canvas.width;
  const cy = (ev.clientY - r.top) / r.height * ed.canvas.height;
  return { x: cx, y: cy };
}
// Touch gestures: 1-finger drag = move, 2-finger pinch = UNIFORM scale, twist = rotate
let gesture = null;
function setupGestures() {
  const cv = document.getElementById('tex2d');
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    if (!gesture) gesture = { pts: new Map(), startDist: 0, startAngle: 0, layerStart: null };
    gesture.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.pts.size === 1) {
      const p = canvasPos(e);
      // hit test layers (topmost first)
      let hit = -1;
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        const dx = p.x - L.x, dy = p.y - L.y;
        const c = Math.cos(-L.rot), s = Math.sin(-L.rot);
        const lx = (dx * c - dy * s) / L.scale, ly = (dx * s + dy * c) / L.scale;
        if (Math.abs(lx) < L.img.width / 2 && Math.abs(ly) < L.img.height / 2) { hit = i; break; }
      }
      S.selLayer = hit;
      if (hit >= 0) {
        const L = S.layers[hit];
        gesture.layerStart = { x: L.x, y: L.y, scale: L.scale, rot: L.rot, px: p.x, py: p.y };
      }
      drawEditor(); updateLayerList(); refreshTools();
    } else if (gesture.pts.size === 2 && S.selLayer >= 0) {
      const [a, b] = [...gesture.pts.values()];
      gesture.startDist = Math.hypot(b.x - a.x, b.y - a.y);
      gesture.startAngle = Math.atan2(b.y - a.y, b.x - a.x);
      const L = S.layers[S.selLayer];
      gesture.layerStart = { scale: L.scale, rot: L.rot };
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!gesture || !gesture.pts.has(e.pointerId)) return;
    gesture.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (S.selLayer < 0) return;
    const L = S.layers[S.selLayer];
    if (gesture.pts.size === 1 && gesture.layerStart) {
      const p = canvasPos(e);
      L.x = gesture.layerStart.x + (p.x - gesture.layerStart.px);
      L.y = gesture.layerStart.y + (p.y - gesture.layerStart.py);
      drawEditor();
    } else if (gesture.pts.size === 2 && gesture.layerStart) {
      const [a, b] = [...gesture.pts.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      // UNIFORM scale — same factor for X and Y, aspect preserved
      L.scale = Math.max(0.05, gesture.layerStart.scale * (dist / gesture.startDist));
      L.rot = gesture.layerStart.rot + (angle - gesture.startAngle);
      drawEditor();
    }
  });
  const end = (e) => {
    if (gesture) {
      gesture.pts.delete(e.pointerId);
      if (gesture.pts.size === 0) gesture = null;
      else if (gesture.pts.size === 1 && S.selLayer >= 0) {
        const L = S.layers[S.selLayer];
        gesture.layerStart = { x: L.x, y: L.y, scale: L.scale, rot: L.rot, px: L.x, py: L.y };
      }
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  window.addEventListener('resize', fitCanvasView);
}

// ============ Layers ============
function updateLayerList() {
  const el = document.getElementById('layer-list');
  el.innerHTML = '';
  S.layers.forEach((L, i) => {
    const d = document.createElement('div');
    d.className = 'layer-item' + (i === S.selLayer ? ' sel' : '');
    d.innerHTML = `<span>Image ${i + 1} — ${Math.round(L.scale * 100)}%</span><span>tap canvas to move</span>`;
    d.onclick = () => { S.selLayer = i; drawEditor(); updateLayerList(); refreshTools(); };
    el.appendChild(d);
  });
}
function refreshTools() {
  const has = S.selLayer >= 0;
  document.getElementById('btn-flip-h').disabled = !has;
  document.getElementById('btn-flip-v').disabled = !has;
  document.getElementById('btn-delete').disabled = !has;
  document.getElementById('btn-apply').disabled = S.layers.length === 0 || S.activeTex < 0;
}
function applyToTexture() {
  const t = S.textures.find((x) => x.index === S.activeTex);
  if (!t) return;
  const ctx = t.canvas.getContext('2d');
  S.layers.forEach((L) => {
    ctx.save();
    ctx.translate(L.x, L.y);
    ctx.rotate(L.rot);
    ctx.scale(L.scale * (L.flipH ? -1 : 1), L.scale * (L.flipV ? -1 : 1));
    ctx.drawImage(L.img, -L.img.width / 2, -L.img.height / 2);
    ctx.restore();
  });
  S.layers = [];
  S.selLayer = -1;
  // push to three.js live
  if (t.threeTex) t.threeTex.needsUpdate = true;
  // also swap material maps in the 3D view to our canvas texture
  hookThreeMaps();
  drawEditor(); updateLayerList(); refreshTools();
}
function hookThreeMaps() {
  // Replace material maps in the 3D scene with our live canvas textures
  if (!S.three.model || !S.glb) return;
  const json = S.glb.json;
  S.three.model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // We can't reliably map three.js material -> glb texture index without extra bookkeeping,
    // so we match by image dimensions as a heuristic.
    mats.forEach((m) => {
      if (m.map && m.map.image) {
        const w = m.map.image.width, h = m.map.image.height;
        const found = S.textures.find((t) => t.canvas.width === w && t.canvas.height === h);
        if (found) {
          m.map = found.threeTex;
          m.needsUpdate = true;
        }
      }
    });
  });
}

// ============ GLB rebuild & export ============
function rebuildGLB(glb) {
  const json = JSON.parse(JSON.stringify(glb.json));
  const chunks = [];
  const bvIndex = [];
  // existing buffer views
  json.bufferViews.forEach((bv, i) => {
    bvIndex[i] = chunks.length;
    chunks.push(glb.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength));
  });
  // replaced images
  S.textures.forEach((t) => {
    const imgIdx = t.src;
    const blob = dataURLToBytes(t.canvas.toDataURL('image/png'));
    const bvi = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: 0, byteLength: blob.length });
    chunks.push(blob);
    bvIndex.push(bvi);
    json.images[imgIdx].bufferView = bvi;
    json.images[imgIdx].mimeType = 'image/png';
  });
  // rebuild binary
  let total = 0;
  const offsets = chunks.map((c) => {
    const off = total;
    total += c.length + ((4 - c.length % 4) % 4);
    return off;
  });
  json.bufferViews.forEach((bv, i) => { bv.byteOffset = offsets[i]; });
  const bin = new Uint8Array(total);
  chunks.forEach((c, i) => bin.set(c, offsets[i]));
  json.buffers[0].byteLength = total;
  const jstr = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - jstr.length % 4) % 4;
  const out = new Uint8Array(12 + 8 + jstr.length + jpad + 8 + total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, jstr.length + jpad, true);
  dv.setUint32(16, 0x4E4F534A, true);
  out.set(jstr, 20);
  dv.setUint32(20 + jstr.length + jpad, total, true);
  dv.setUint32(24 + jstr.length + jpad, 0x004E4942, true);
  out.set(bin, 28 + jstr.length + jpad);
  return out.buffer;
}
function dataURLToBytes(url) {
  const b = atob(url.split(',')[1]);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

// ============ Wire up ============
async function loadModelFromURL(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = await res.arrayBuffer();
    S.glb = parseGLB(buf);
    S.glb.name = url.split('/').pop() || 'model.glb';
    await extractTextures(S.glb);
    loadModelToThree(S.glb);
    document.getElementById('btn-export').disabled = false;
    if (S.textures.length) selectTexture(S.textures[0].index);
  } catch (e) {
    alert('Failed to load from URL: ' + e.message);
  }
}
async function loadBrowseList() {
  const el = document.getElementById('browse-list');
  el.innerHTML = '<div style="color:#6b7280">Loading…</div>';
  // Try to fetch a model manifest from the repo
  // Supports: ?models=<url> query param, or local models.json
  const params = new URLSearchParams(location.search);
  const manifestURL = params.get('models') || 'models.json';
  try {
    const res = await fetch(manifestURL);
    if (!res.ok) throw new Error('no manifest');
    const list = await res.json();
    el.innerHTML = '';
    list.forEach((m) => {
      const d = document.createElement('div');
      d.className = 'browse-item';
      d.textContent = m.name || m.url;
      d.onclick = async () => {
        await loadModelFromURL(m.url);
        document.getElementById('modal-browse').hidden = true;
      };
      el.appendChild(d);
    });
    if (!list.length) el.innerHTML = '<div style="color:#6b7280">No models listed. Paste a URL above.</div>';
  } catch (e) {
    el.innerHTML = '<div style="color:#6b7280">No model list found. Paste a GLB URL above.<br><br>Tip: host your <b>models.json</b> next to this app:<br><code>[{\"name\":\"Sombra\",\"url\":\"https://…/SOMBRA.glb\"}]</code></div>';
  }
}
window.addEventListener('DOMContentLoaded', () => {
  initThree();
  setupGestures();
  const fm = document.getElementById('file-model');
  const fi = document.getElementById('file-image');
  document.getElementById('btn-load').onclick = () => fm.click();
  document.getElementById('btn-browse').onclick = () => {
    document.getElementById('modal-browse').hidden = false;
    loadBrowseList();
  };
  document.getElementById('btn-browse-close').onclick = () => {
    document.getElementById('modal-browse').hidden = true;
  };
  document.getElementById('btn-load-url').onclick = async () => {
    const url = document.getElementById('browse-url').value.trim();
    if (!url) return;
    await loadModelFromURL(url);
    document.getElementById('modal-browse').hidden = true;
  };
  fm.onchange = async () => {
    const f = fm.files[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    try {
      S.glb = parseGLB(buf);
      S.glb.name = f.name;
      await extractTextures(S.glb);
      loadModelToThree(S.glb);
      document.getElementById('btn-export').disabled = false;
      if (S.textures.length) selectTexture(S.textures[0].index);
    } catch (e) {
      alert('Failed to load GLB: ' + e.message);
    }
    fm.value = '';
  };
  document.getElementById('btn-addimg').onclick = () => fi.click();
  fi.onchange = async () => {
    const f = fi.files[0];
    if (!f) return;
    const bmp = await createImageBitmap(f);
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    const t = S.textures.find((x) => x.index === S.activeTex);
    const startScale = t ? Math.min(1, (t.canvas.width * 0.5) / cv.width) : 0.5;
    S.layers.push({
      img: cv, x: t.canvas.width / 2, y: t.canvas.height / 2,
      scale: startScale, rot: 0, flipH: false, flipV: false,
    });
    S.selLayer = S.layers.length - 1;
    drawEditor(); updateLayerList(); refreshTools();
    fi.value = '';
  };
  document.getElementById('btn-flip-h').onclick = () => {
    if (S.selLayer < 0) return;
    S.layers[S.selLayer].flipH = !S.layers[S.selLayer].flipH;
    drawEditor();
  };
  document.getElementById('btn-flip-v').onclick = () => {
    if (S.selLayer < 0) return;
    S.layers[S.selLayer].flipV = !S.layers[S.selLayer].flipV;
    drawEditor();
  };
  document.getElementById('btn-delete').onclick = () => {
    if (S.selLayer < 0) return;
    S.layers.splice(S.selLayer, 1);
    S.selLayer = -1;
    drawEditor(); updateLayerList(); refreshTools();
  };
  document.getElementById('btn-apply').onclick = applyToTexture;
  document.getElementById('btn-export').onclick = () => {
    if (!S.glb) return;
    // apply any pending layers first
    if (S.layers.length) applyToTexture();
    const out = rebuildGLB(S.glb);
    const blob = new Blob([out], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.glb.name || 'model').replace(/\.glb$/i, '') + '_custom.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  window.addEventListener('resize', fitCanvasView);
});
