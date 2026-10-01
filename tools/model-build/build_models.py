#!/usr/bin/env python3
"""
把 CC BY 4.0 的 amvlab GLB 模型转换为游戏可直接 <script> 加载的离线 JS 资源。

处理步骤 (全部记录在 ASSETS_LICENSES.md 的 "修改" 一栏):
  1. 坐标系转换到游戏机体系: +X 右翼, +Y 上, 机头 -Z, 单位米
  2. 按游戏机型数据缩放 (长度 / 翼展 / 机身半径), 机头对齐 plan.zN
  3. (派生机型) 在机翼前/后机身插入等截面"加长段", 模拟同系列加长型
  4. 修正少量法线反向的三角面, 以便单面渲染 (驾驶舱视角从机身内部向外看)
  5. 拆出发动机风扇/整流锥三角面为独立网格, 以便按 N1 旋转
  6. 重绘涂装: 去除原有配色 (原模型已是无标志版本), 生成白色底图 + 遮罩,
     运行时按游戏涂装颜色合成 (机身/机腹/腰线/垂尾)
  7. 输出 base64 的几何与 data-URI 贴图 (file:// 下可直接加载, 不需要 fetch)
"""
import json, os, sys, base64, io, math
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
import glb

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# 源模型目录 (amvlab/aircraft-models 仓库的 models/) 与 plans.json 路径, 可用环境变量覆盖
SRC = os.environ.get('AMVLAB_MODELS', os.path.join(ROOT, 'assets_src', 'amvlab', 'models'))
PLANS = json.load(open(os.environ.get('PLANS_JSON', os.path.join(ROOT, 'tools', 'plans.json'))))
SOURCE_COMMIT = '91d835e8e851b2317fe79af291c9fed6153fd525'

SOURCES = {
    'A320': dict(file='A320_nologo.glb', baseLen=37.57, name='A320',
                 fans=[(292, 890, 64), (418, 890, 64)], spinners=[], paintTol=34),
    'A350': dict(file='A350_nologo.glb', baseLen=66.80, name='A350',
                 fans=[(888, 72, 60)], spinners=[(812, 128, 24)], paintTol=30),
    'B737': dict(file='B737_nologo.glb', baseLen=39.47, name='B737',
                 fans=[(760, 62, 62)], spinners=[(757, 135, 22)], paintTol=30),
    'B787': dict(file='B787_nologo.glb', baseLen=56.72, name='B787',
                 fans=[(157, 170, 62)], spinners=[(40, 155, 32)], paintTol=30),
}

# 游戏机型 -> 源模型. plug = 加长段 (前, 后) 米, 仅用于同系列"加长型"
TYPES = {
    'A350-900':  dict(src='A350', plug=None, derived=False),
    'A350-1000': dict(src='A350', plug=(3.85, 3.14), derived=True),
    'A320neo':   dict(src='A320', plug=None, derived=False),
    'A321neo':   dict(src='A320', plug=(4.27, 2.67), derived=True),
    'B737-800':  dict(src='B737', plug=None, derived=False),
    'B787-9':    dict(src='B787', plug=(3.05, 3.04), derived=True),
}

def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode('ascii')

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def load_source(key):
    s = SOURCES[key]
    d = glb.mesh_world(os.path.join(SRC, s['file']))
    P = d['pos']; N = d['nrm']
    # 源: 机头 +X, 右翼 +Z (由垂尾位置判定, 见下), 上 +Y  ->  游戏: x=Pz, y=Py, z=-Px
    fin = P[P[:, 1] > P[:, 1].max() - 1.5].mean(0)
    assert fin[0] < P[:, 0].mean(), 'unexpected orientation'
    G = np.stack([P[:, 2], P[:, 1], -P[:, 0]], 1)
    GN = np.stack([N[:, 2], N[:, 1], -N[:, 0]], 1)
    I = d['idx'].copy()
    a, b, c = G[I[:, 0]], G[I[:, 1]], G[I[:, 2]]
    fn = np.cross(b - a, c - a)
    bad = (fn * GN[I].sum(1)).sum(1) < 0
    I[bad] = I[bad][:, [0, 2, 1]]
    d.update(G=G, GN=GN, I=I, flipped=int(bad.sum()))
    img = Image.open(io.BytesIO(d['image'])).convert('RGB')
    d['img'] = np.asarray(img).astype(np.float32)
    return d

def measure(G):
    zmin, zmax = G[:, 2].min(), G[:, 2].max(); L = zmax - zmin
    secs = []
    for f in np.linspace(0.13, 0.22, 7):
        s = (G[:, 2] > zmin + L * (f - 0.012)) & (G[:, 2] < zmin + L * (f + 0.012)) & (np.abs(G[:, 0]) < 4.5)
        q = G[s]
        if len(q) < 4: continue
        secs.append((np.abs(q[:, 0]).max(), q[:, 1].min(), q[:, 1].max()))
    secs.sort()
    Rm, y0, y1 = secs[len(secs) // 2]
    span = G[:, 0].max() - G[:, 0].min()
    return dict(zmin=zmin, L=L, Rm=Rm, yc=(y0 + y1) / 2, hm=(y1 - y0) / 2, span=span)

def rasterize(uv, X, I, W, H):
    """UV 空间光栅化: 返回每个像素对应的三维位置 (W,H,3) 与覆盖掩码"""
    pos = np.full((H, W, 3), np.nan, np.float32)
    px = uv * np.array([W, H])
    for t in I:
        p = px[t]; q = X[t]
        x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
        x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, W - 1); y1 = min(y1, H - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        e = -0.6 / max(1.0, abs(den) ** 0.5)  # 轻微外扩, 覆盖接缝
        m = (l1 >= e) & (l2 >= e) & (l3 >= e)
        if not m.any(): continue
        P3 = l1[..., None] * q[0] + l2[..., None] * q[1] + l3[..., None] * q[2]
        sub = pos[y0:y1 + 1, x0:x1 + 1]
        fill = m & np.isnan(sub[..., 0])
        sub[fill] = P3[fill]
    return pos

def paint_mask(img, tol):
    """大块平涂颜色 = 涂装; 小块 (舷窗/舱门/细节) = 保留"""
    H, W, _ = img.shape
    # 原图为 8 位调色板 PNG (有抖动), 先中值滤波再判断"平涂"
    img = np.stack([ndimage.median_filter(img[..., c], size=5) for c in range(3)], 2)
    # 局部颜色方差
    std = np.zeros((H, W), np.float32)
    for ch in range(3):
        m = ndimage.uniform_filter(img[..., ch], 3); m2 = ndimage.uniform_filter(img[..., ch] ** 2, 3)
        std += np.sqrt(np.maximum(0, m2 - m * m))
    flat = std < 12
    q = (img // tol).astype(np.int32)
    code = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
    paint = np.zeros((H, W), bool)
    for c in np.unique(code[flat]):
        mk = flat & (code == c)
        if mk.sum() < 600: continue
        lab, n = ndimage.label(mk)
        sizes = ndimage.sum(mk, lab, range(1, n + 1))
        big = np.isin(lab, np.nonzero(sizes >= 600)[0] + 1)
        paint |= big
    # 吃掉涂装色块之间 1~2 像素的抗锯齿过渡
    small_detail = flat & ~paint
    grown = ndimage.binary_dilation(paint, iterations=2) & ~small_detail
    return grown

def build_source(key, debug_dir=None):
    s = SOURCES[key]
    d = load_source(key)
    d['meas'] = measure(d['G'])
    img = d['img']; H, W, _ = img.shape
    uv = d['uv']; I = d['I']; G = d['G']
    # ---- 风扇三角面 (按 UV 圆判定) ----
    cen = uv[I].mean(1) * np.array([W, H])
    def in_circles(circles):
        m = np.zeros(len(I), bool)
        for (cx, cy, r) in circles:
            m |= ((cen[:, 0] - cx) ** 2 + (cen[:, 1] - cy) ** 2) < r * r
        return m
    fan = in_circles(s['fans'])
    spin = in_circles(s['spinners']) if s['spinners'] else np.zeros(len(I), bool)
    d['fanTri'] = fan; d['spinTri'] = spin
    d['paint'] = paint_mask(img, s['paintTol'])
    return d

def transform(d, ac, plan, plug):
    """源几何 -> 某游戏机型的几何 (返回新顶点/法线)"""
    m = d['meas']; G = d['G']; s = SOURCES_KEY[id(d)]
    R = plan['R']; span = ac['wingspan']
    kf = R / m['Rm']
    kw = (span / 2 - kf * m['Rm']) / (m['span'] / 2 - m['Rm'])
    sz = s['baseLen'] / m['L']
    x, y, z = G[:, 0], G[:, 1], G[:, 2]
    ax = np.abs(x)
    nx = np.where(ax <= m['Rm'], ax * kf, kf * m['Rm'] + (ax - m['Rm']) * kw) * np.sign(x)
    ny = (y - m['yc']) * kf
    nz = (z - m['zmin']) * sz            # 0 = 机头
    jx = np.where(ax <= m['Rm'], kf, kw)
    info = {}
    if plug:
        # 机翼根部前缘/后缘与平尾根部前缘 (缩放后坐标)
        root = (np.abs(nx) > R * 1.05) & (np.abs(nx) < R * 3.0) & (ny > -0.75 * R)
        wingLE = nz[root & (nz > s['baseLen'] * 0.25) & (nz < s['baseLen'] * 0.65)].min()
        # 翼根后缘: 紧贴机身外侧的机翼顶点的最大 z
        wroot = (np.abs(nx) > R * 1.02) & (np.abs(nx) < R * 2.2) & (ny > -0.75 * R) & (nz > wingLE) & (nz < s['baseLen'] * 0.72)
        wingTE = nz[wroot].max()
        # 平尾根部前缘: 平尾顶点沿后掠线投影到根部
        tanS = math.tan(math.radians(ac.get('tailSweep', 30)))
        near = (np.abs(nx) > R * 1.3) & (np.abs(nx) < ac['tailSpan'] * 0.55) & (nz > wingTE + 1.0) & (ny > -0.3 * R)
        stabLE = (nz[near] - (np.abs(nx[near]) - R * 0.5) * tanS).min()
        stabHalf = ac['tailSpan'] * 0.5 * 1.15
        noseEnd = s['baseLen'] * 0.17
        zs = np.sort(np.unique(np.round(nz, 3)))
        def gap_cut(a, b):
            # 在 (a,b) 范围内找最大的顶点空隙中点 (切口不能穿过顶点环)
            cand = zs[(zs > a) & (zs < b)]
            pts = np.concatenate([[a], cand, [b]])
            gi = np.argmax(np.diff(pts))
            return (pts[gi] + pts[gi + 1]) / 2, np.diff(pts)[gi]
        cutF, gF = gap_cut(noseEnd, wingLE - 0.3)
        cutA, gA = gap_cut(wingTE + 0.3, stabLE - 0.3)
        fwd, aft = plug
        nz = nz.copy()
        shiftA = (nz > cutA) & ((np.abs(nx) < R * 1.25) | ((nz > stabLE - 0.6) & (np.abs(nx) < stabHalf)))
        nz[shiftA] += aft
        nz[nz < cutF] -= fwd
        nz += fwd
        info = dict(cutF=round(float(cutF), 2), gapF=round(float(gF), 2), cutA=round(float(cutA), 2), gapA=round(float(gA), 2),
                    wingLE=round(float(wingLE), 2), wingTE=round(float(wingTE), 2), stabLE=round(float(stabLE), 2))
    nz = nz + plan['zN']
    X = np.stack([nx, ny, nz], 1)
    Nn = d['GN'] / np.stack([jx, np.full_like(jx, kf), np.full_like(jx, sz)], 1)
    Nn /= np.maximum(1e-9, np.linalg.norm(Nn, axis=1, keepdims=True))
    info.update(kf=round(kf, 4), kw=round(kw, 4), sz=round(sz, 4))
    return X, Nn, info

SOURCES_KEY = {}

def classify(pos, plan, L, fans):
    """按三维位置给贴图像素分类: 0=无 1=机身 2=垂尾 3=机翼/平尾 4=发动机短舱"""
    R = plan['R']; zN = plan['zN']
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    valid = ~np.isnan(x)
    x = np.nan_to_num(x); y = np.nan_to_num(y); z = np.nan_to_num(z)
    cls = np.zeros(x.shape, np.uint8)
    cls[valid] = 1
    wing = valid & (np.abs(x) > R * 1.12)
    cls[wing] = 3
    fin = valid & (z > zN + 0.62 * L) & (y > R * 1.02) & (np.abs(x) < 1.0)
    cls[fin] = 2
    for f in fans:
        c = np.array(f['pivot']); r = f['radius']
        rr = np.sqrt((x - c[0]) ** 2 + (y - c[1]) ** 2)
        eng = valid & (rr < r * 1.45) & (z > c[2] - r * 0.6) & (z < c[2] + r * 4.2)
        cls[eng] = 4
    return cls

def livery_textures(d, pos, cls, plan, L, outW=1024, maskW=512):
    img = d['img']; paint = d['paint']
    R = plan['R']; zN = plan['zN']
    y = np.nan_to_num(pos[..., 1]); z = np.nan_to_num(pos[..., 2])
    lum = img.mean(2, keepdims=True)
    gray = np.repeat(lum, 3, 2)
    base = img.copy()
    body = paint & (cls == 1); finp = paint & (cls == 2)
    wingp = cls == 3; engp = paint & (cls == 4)
    base[body | finp] = 255.0
    unm = cls == 0
    nearUnm = ndimage.binary_dilation(unm, iterations=4)
    nearPaint = ndimage.binary_dilation(paint, iterations=3)
    sat = img.max(2) - img.min(2); lumv = img.mean(2)
    bf = (cls == 1) | (cls == 2)
    # UV 岛边缘的配色残边 (涂装色与背景之间的过渡像素) -> 白
    fringe = bf & ~paint & nearPaint & nearUnm
    # 机身上残留的高饱和/高亮彩色像素 (原配色抗锯齿) -> 白; 舷窗等暗色细节保留
    resid = bf & ~paint & ((sat > 45) | (lumv > 150))
    base[fringe | resid] = 255.0
    # 机翼/平尾: 涂装区统一为中性浅灰, 细节去色
    wp = wingp & paint
    base[wp] = gray[wp] * 0.12 + 0.88 * 222.0
    detail_w = wingp & ~paint
    base[detail_w] = gray[detail_w] * 0.6 + 0.4 * 222.0
    base[engp] = np.array([226, 229, 233], np.float32)
    # 非机身区域里的其余颜色一律去色
    other = (cls != 1) & ~(body | finp | engp | fringe | resid | wingp)
    base[other] = base[other] * 0.3 + gray[other] * 0.7
    finp = finp | (cls == 2) & (fringe | resid)
    body = body | (cls == 1) & (fringe | resid)
    # 遮罩: R=垂尾 G=腰线 B=机腹 (只作用于涂装像素)
    belly = smoothstep(-0.42 * R, -0.70 * R, y)
    zf = (z - zN) / L
    stripe_y = smoothstep(-0.36 * R, -0.33 * R, y) * (1 - smoothstep(-0.20 * R, -0.17 * R, y))
    stripe_z = smoothstep(0.10, 0.14, zf) * (1 - smoothstep(0.80, 0.86, zf))
    stripe = stripe_y * stripe_z
    mask = np.zeros(img.shape, np.float32)
    mask[..., 0] = finp * 1.0
    mask[..., 1] = body * stripe
    mask[..., 2] = body * belly * (1 - stripe)
    return base, mask

def enc_img(arr, fmt, size=None, q=88):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if size: im = im.resize((size, size), Image.LANCZOS)
    bio = io.BytesIO()
    if fmt == 'jpeg': im.save(bio, 'JPEG', quality=q, optimize=True, progressive=False)
    else: im.save(bio, 'PNG', optimize=True)
    return 'data:image/%s;base64,' % fmt + base64.b64encode(bio.getvalue()).decode('ascii'), im

def main():
    out_dir = sys.argv[1]
    dbg = sys.argv[2] if len(sys.argv) > 2 else None
    os.makedirs(out_dir, exist_ok=True)
    report = {}
    src_cache = {}
    for tkey, t in TYPES.items():
        plan = PLANS[tkey]; ac = plan['dims']
        if t['src'] not in src_cache:
            src_cache[t['src']] = build_source(t['src'])
            SOURCES_KEY[id(src_cache[t['src']])] = SOURCES[t['src']]
        d = src_cache[t['src']]
        X, Nn, info = transform(d, ac, plan, t['plug'])
        L = X[:, 2].max() - X[:, 2].min()
        I = d['I']
        # ---- 风扇组 ----
        fans = []
        fanAll = d['fanTri'] | d['spinTri']
        for side in (-1, 1):
            sel = d['fanTri'] & (np.sign(X[I].mean(1)[:, 0]) == side)
            if not sel.any(): continue
            V = X[np.unique(I[sel])]
            pivot = (V.min(0) + V.max(0)) / 2
            radius = float(max(V[:, 0].max() - V[:, 0].min(), V[:, 1].max() - V[:, 1].min()) / 2)
            ssel = d['spinTri'] & (np.sign(X[I].mean(1)[:, 0]) == side)
            if ssel.any():
                cs = X[I[ssel]].mean(1)
                ok = np.sqrt(((cs[:, :2] - pivot[:2]) ** 2).sum(1)) < radius * 0.6
                tmp = np.zeros(len(I), bool); tmp[np.nonzero(ssel)[0][ok]] = True
                sel = sel | tmp
            fans.append(dict(side=side, tris=np.nonzero(sel)[0], pivot=pivot.tolist(), radius=radius))
        used = np.zeros(len(I), bool)
        for f in fans: used[f['tris']] = True
        # ---- 贴图 ----
        img = d['img']; H, W, _ = img.shape
        pos = rasterize(d['uv'], X, I, W, H)
        cls = classify(pos, plan, L, fans)
        base, mask = livery_textures(d, pos, cls, plan, L)
        texURI, texIm = enc_img(base, 'jpeg', None, 86)
        maskURI, maskIm = enc_img(mask * 255, 'png', 512)
        if dbg:
            os.makedirs(dbg, exist_ok=True)
            pal = np.array([[0, 0, 0], [240, 240, 240], [220, 60, 60], [80, 140, 230], [240, 200, 40]], np.uint8)
            Image.fromarray(pal[cls]).save(os.path.join(dbg, tkey + '_cls.png'))
            Image.fromarray((d['paint'] * 255).astype(np.uint8)).save(os.path.join(dbg, tkey + '_paint.png'))
            texIm.save(os.path.join(dbg, tkey + '_base.jpg')); maskIm.save(os.path.join(dbg, tkey + '_mask.png'))
        # ---- 锚点 (灯光/离地检查) ----
        R = plan['R']
        tipIdx = np.argmax(X[:, 0]); tip = X[tipIdx]
        aftIdx = np.argmax(np.where(np.abs(X[:, 0]) < 0.8, X[:, 2], -1e9)); tail = X[aftIdx]
        nac = np.zeros(len(X), bool)
        for f in fans:
            c = np.array(f['pivot']); r = f['radius']
            rr = np.sqrt((X[:, 0] - c[0]) ** 2 + (X[:, 1] - c[1]) ** 2)
            nac |= (rr < r * 1.45) & (X[:, 2] > c[2] - r * 0.6) & (X[:, 2] < c[2] + r * 4.2)
        nacBottom = float(X[nac, 1].min()) if nac.any() else None
        body = np.abs(X[:, 0]) < R * 1.05
        wroot = (np.abs(X[:, 0]) > R * 1.05) & (np.abs(X[:, 0]) < R * 3.0) & (X[:, 1] > -0.75 * R)
        wingRootLE = float(X[wroot & (X[:, 2] > plan['zN'] + L * 0.25) & (X[:, 2] < plan['zN'] + L * 0.7), 2].min())
        wsel = wroot & (X[:, 2] > plan['zN'] + L * 0.25) & (X[:, 2] < plan['zN'] + L * 0.7)
        wi = np.nonzero(wsel)[0][np.argmin(X[wsel, 2])]
        zw = wingRootLE
        ring = (np.abs(X[:, 2] - zw) < L * 0.15) & (np.abs(X[:, 0]) < 1.0)
        bodyTopAtWing = float(X[ring, 1].max()) if ring.any() else R
        bodyBotAtWing = float(X[ring, 1].min()) if ring.any() else -R
        anchors = dict(tipR=tip.tolist(), wingRootLEPt=X[wi].tolist(), bodyTopAtWing=bodyTopAtWing, bodyBotAtWing=bodyBotAtWing, tail=tail.tolist(), nacelleBottom=nacBottom,
                       bodyBottom=float(X[body, 1].min()), finTop=float(X[:, 1].max()),
                       wingRootLE=wingRootLE, length=float(L), span=float(X[:, 0].max() - X[:, 0].min()))
        # ---- 输出几何 ----
        def pack(tris, pivot=None):
            vi, inv = np.unique(I[tris].ravel(), return_inverse=True)
            P = X[vi] - (np.array(pivot) if pivot is not None else 0)
            return dict(pos=b64(P.astype(np.float32)), nrm=b64(np.round(Nn[vi] * 127).astype(np.int8)),
                        uv=b64(d['uv'][vi].astype(np.float32)), idx=b64(inv.astype(np.uint16)),
                        vcount=int(len(vi)), icount=int(len(inv)))
        bodyTris = np.nonzero(~used)[0]
        asset = dict(
            key=tkey, source=t['src'], derived=t['derived'], plug=t['plug'],
            credit=dict(title='amvlab 3D Aircraft Models — ' + SOURCES[t['src']]['name'],
                        author='amvlab (Andres Morfin Veytia)', license='CC BY 4.0',
                        licenseUrl='https://creativecommons.org/licenses/by/4.0/',
                        url='https://github.com/amvlab/aircraft-models/blob/%s/models/%s' % (SOURCE_COMMIT, SOURCES[t['src']]['file'])),
            body=pack(bodyTris),
            fans=[dict(side=f['side'], pivot=f['pivot'], radius=f['radius'], mesh=pack(f['tris'], f['pivot'])) for f in fans],
            texId=t['src'], anchors=anchors, triangles=int(len(I)))
        js = '/* 自动生成 (tools/build/build_models.py) — 请勿手改\n' \
             '   模型: %s, 作者 %s, 许可 %s\n   来源: %s\n   修改: 见 ASSETS_LICENSES.md */\n' % (
                 asset['credit']['title'], asset['credit']['author'], asset['credit']['license'], asset['credit']['url'])
        js += '(function (g) { var FS = g.FS = g.FS || {}; FS.ModelAssets = FS.ModelAssets || {};\nFS.ModelAssets[%s] = %s;\n})(typeof window !== "undefined" ? window : globalThis);\n' % (
            json.dumps(tkey), json.dumps(asset, separators=(',', ':')))
        fn = 'ac_%s.js' % tkey.replace('-', '_').lower()
        open(os.path.join(out_dir, fn), 'w').write(js)
        tfn = 'tex_%s.js' % t['src'].lower()
        tex_js = '/* 自动生成 — %s 贴图 (已去除原配色, 白色底图 + 涂装遮罩), CC BY 4.0, amvlab */\n' % t['src']
        tex_js += '(function (g) { var FS = g.FS = g.FS || {}; FS.ModelTextures = FS.ModelTextures || {};\nFS.ModelTextures[%s] = { base: %s, mask: %s };\n})(typeof window !== "undefined" ? window : globalThis);\n' % (
            json.dumps(t['src']), json.dumps(texURI), json.dumps(maskURI))
        # 贴图按源模型共享: 只有第一个使用该源的机型写出
        if not os.path.exists(os.path.join(out_dir, tfn)) or t['src'] not in report.get('_tex', []):
            open(os.path.join(out_dir, tfn), 'w').write(tex_js)
            report.setdefault('_tex', []).append(t['src'])
        report[tkey] = dict(file=fn, tex=tfn, info=info, anchors=anchors, tris=int(len(I)), flipped=d['flipped'],
                            fans=[(f['side'], [round(v, 2) for v in f['pivot']], round(f['radius'], 2), len(f['tris'])) for f in fans],
                            planGroundY=plan['groundY'], bytes=len(js))
        print(tkey, json.dumps(report[tkey]))
    json.dump(report, open(os.path.join(out_dir, '..', 'tools_build_report.json') if False else os.path.join(ROOT, 'tools', 'build_report.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
