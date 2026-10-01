"""最小 GLB 读取器 (glTF 2.0, 单 buffer). 返回已应用节点变换的三角网格."""
import json, struct
import numpy as np

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def load(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', b[off:off + 4])[0]
    binc = b[off + 8:off + 8 + bl]
    return j, binc

def accessor(j, binc, i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    cnt = a['count']; stride = bv.get('byteStride') or n * dt.itemsize
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (cnt - 1) + n * dt.itemsize, offset=o)
    out = np.lib.stride_tricks.as_strided(raw, shape=(cnt, n * dt.itemsize), strides=(stride, 1)).copy()
    arr = out.view(dt).reshape(cnt, n).astype(np.float64 if dt.kind == 'f' else np.int64)
    if a.get('normalized'):
        arr = arr / float(np.iinfo(dt).max)
    return arr

def trs(n):
    if 'matrix' in n:
        return np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * np.array(s)[None, :]; M[:3, 3] = t
    return M

def mesh_world(path):
    """返回 dict: pos(N,3) nrm(N,3) uv(N,2) idx(M,3) image(bytes) mime"""
    j, binc = load(path)
    parent = {}
    for i, n in enumerate(j['nodes']):
        for c in n.get('children', []): parent[c] = i
    def world(i):
        M = trs(j['nodes'][i])
        while i in parent:
            i = parent[i]; M = trs(j['nodes'][i]) @ M
        return M
    P, N, UV, IDX = [], [], [], []
    base = 0; mats = set()
    for i, n in enumerate(j['nodes']):
        if 'mesh' not in n: continue
        M = world(i); L = M[:3, :3]; NM = np.linalg.inv(L).T
        for pr in j['meshes'][n['mesh']]['primitives']:
            at = pr['attributes']
            p = accessor(j, binc, at['POSITION'])
            nr = accessor(j, binc, at['NORMAL']) if 'NORMAL' in at else np.zeros_like(p)
            uv = accessor(j, binc, at['TEXCOORD_0'])
            ix = accessor(j, binc, pr['indices']).reshape(-1, 3) if 'indices' in pr else np.arange(len(p)).reshape(-1, 3)
            p = p @ L.T + M[:3, 3]
            nr = nr @ NM.T; nr /= np.maximum(1e-12, np.linalg.norm(nr, axis=1, keepdims=True))
            if np.linalg.det(L) < 0: ix = ix[:, [0, 2, 1]]
            P.append(p); N.append(nr); UV.append(uv); IDX.append(ix + base); base += len(p)
            mats.add(pr.get('material'))
    assert len(mats) == 1, 'expect single material, got %r' % mats
    mat = j['materials'][list(mats)[0]]
    ti = mat['pbrMetallicRoughness']['baseColorTexture']['index']
    img = j['images'][j['textures'][ti]['source']]
    bv = j['bufferViews'][img['bufferView']]; o = bv.get('byteOffset', 0)
    return dict(pos=np.concatenate(P), nrm=np.concatenate(N), uv=np.concatenate(UV), idx=np.concatenate(IDX),
                image=binc[o:o + bv['byteLength']], mime=img['mimeType'], material=mat, asset=j.get('asset'))
