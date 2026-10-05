// 读取 GLB -> 世界坐标三角形汤 (按图元), 供 build_models_v04.mjs 使用
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
export async function loadGLB(file) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(file);
  const root = doc.getRoot();
  const prims = [];
  for (const scene of root.listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh(); if (!mesh) return;
      const M = node.getWorldMatrix();
      const det = M[0]*(M[5]*M[10]-M[6]*M[9]) - M[4]*(M[1]*M[10]-M[2]*M[9]) + M[8]*(M[1]*M[6]-M[2]*M[5]);
      for (const p of mesh.listPrimitives()) {
        if (p.getMode() !== 4) continue;
        const pa = p.getAttribute('POSITION'); if (!pa) continue;
        const n = pa.getCount(); const pos = new Float32Array(n * 3); const v = [0, 0, 0];
        for (let i = 0; i < n; i++) { pa.getElement(i, v); const x = v[0], y = v[1], z = v[2];
          pos[i * 3] = M[0] * x + M[4] * y + M[8] * z + M[12];
          pos[i * 3 + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
          pos[i * 3 + 2] = M[2] * x + M[6] * y + M[10] * z + M[14]; }
        const ia = p.getIndices(); let idx;
        if (ia) idx = Uint32Array.from(ia.getArray()); else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
        if (det < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        const mat = p.getMaterial();
        prims.push({ node: node.getName() || '', mesh: mesh.getName() || '', mat: mat ? mat.getName() : '',
          color: mat ? mat.getBaseColorFactor() : [1, 1, 1, 1], hasTex: !!(mat && mat.getBaseColorTexture()), pos, idx });
      }
    });
  }
  return prims;
}
