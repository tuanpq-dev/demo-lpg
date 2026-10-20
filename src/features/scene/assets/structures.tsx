import { Instance, Instances } from '@react-three/drei';
import type { AssetComponentProps } from './registry';
import { useAssetMaterials } from './materials';
import { Ladder, Nozzle, postsAlong, Railing, segmentsOf } from './parts';
import { CANOPY_RISE } from './specs';

const HALF_PI = Math.PI / 2;

/** Vị trí chia đều trên đoạn [a, b], mỗi ô ~`step`, bỏ các điểm quá gần `skip`. */
function spread(a: number, b: number, step: number, skip?: { at: number; gap: number }) {
  const n = Math.max(1, Math.floor((b - a) / step));
  return Array.from({ length: n }, (_, i) => a + ((i + 0.5) * (b - a)) / n).filter(
    (x) => !skip || Math.abs(x - skip.at) > skip.gap,
  );
}

/**
 * Nhà xưởng: khối chính + tường chắn mái + mái + dải cửa sổ theo tầng (kính + bậu, instanced) + cửa cuốn có mái hắt
 * + ống thoát nước mái + thiết bị mái (máy lạnh, quạt hút, bồn, ống khói).
 * Tham số: width, depth, height, floors – cửa sổ/thiết bị mái co theo kích thước.
 */
export function Building({ params }: AssetComponentProps) {
  const m = useAssetMaterials();
  const W = params.width!;
  const D = params.depth!;
  const H = params.height!;
  const floors = params.floors!;
  const rows = Array.from({ length: floors }, (_, i) => (H / floors) * (i + 0.55));
  const doorX = W * 0.09;
  const frontWindows = spread(-W / 2 + 0.6, W / 2 - 0.6, 2.6, { at: doorX, gap: 2.2 }).flatMap((x) =>
    rows.map((y) => [x, y, D / 2 + 0.03] as const),
  );
  const sideWindows = spread(-D / 2 + 0.6, D / 2 - 0.6, 2.4).flatMap((z) => rows.map((y) => [W / 2 + 0.03, y, z] as const));
  const winH = Math.min(0.9, (H / floors) * 0.35);
  const doorH = Math.min(3.2, H * 0.45);
  const parapet = 0.6;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={m.concrete}>
        <boxGeometry args={[W + 0.6, 0.4, D + 0.6]} />
      </mesh>
      <mesh position={[0, H / 2, 0]} material={m.body}>
        <boxGeometry args={[W, H, D]} />
      </mesh>
      {/* Tường chắn mái (4 cạnh) + mái */}
      {[
        [0, D / 2 - 0.1, W, 0.2],
        [0, -D / 2 + 0.1, W, 0.2],
        [W / 2 - 0.1, 0, 0.2, D],
        [-W / 2 + 0.1, 0, 0.2, D],
      ].map(([x, z, w, d]) => (
        <mesh key={`${x}:${z}`} position={[x!, H + parapet / 2, z!]} material={m.body}>
          <boxGeometry args={[w!, parapet, d!]} />
        </mesh>
      ))}
      <mesh position={[0, H + 0.05, 0]} material={m.concrete}>
        <boxGeometry args={[W - 0.4, 0.1, D - 0.4]} />
      </mesh>
      {/* Cửa sổ (kính) + bậu cửa */}
      <Instances limit={Math.max(1, frontWindows.length)} material={m.glass}>
        <boxGeometry args={[1.8, winH, 0.06]} />
        {frontWindows.map((p) => (
          <Instance key={p.join()} position={[...p]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, frontWindows.length)} material={m.metal}>
        <boxGeometry args={[2, 0.08, 0.18]} />
        {frontWindows.map(([x, y, z]) => (
          <Instance key={`${x}:${y}`} position={[x, y - winH / 2 - 0.04, z + 0.06]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, sideWindows.length)} material={m.glass}>
        <boxGeometry args={[0.06, winH, 1.8]} />
        {sideWindows.map((p) => (
          <Instance key={p.join()} position={[...p]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, sideWindows.length)} material={m.metal}>
        <boxGeometry args={[0.18, 0.08, 2]} />
        {sideWindows.map(([x, y, z]) => (
          <Instance key={`${y}:${z}`} position={[x + 0.06, y - winH / 2 - 0.04, z]} />
        ))}
      </Instances>
      {/* Cửa cuốn + khung + mái hắt + bậc */}
      <mesh position={[doorX, doorH / 2, D / 2 + 0.04]} material={m.dark}>
        <boxGeometry args={[2.6, doorH, 0.06]} />
      </mesh>
      <mesh position={[doorX, doorH / 2 + 0.05, D / 2 + 0.06]} material={m.metal}>
        <boxGeometry args={[2.9, doorH + 0.1, 0.04]} />
      </mesh>
      <mesh position={[doorX, doorH + 0.25, D / 2 + 0.45]} material={m.concrete}>
        <boxGeometry args={[3.4, 0.15, 0.9]} />
      </mesh>
      <mesh position={[doorX, 0.08, D / 2 + 0.9]} material={m.concrete}>
        <boxGeometry args={[3.4, 0.16, 1.2]} />
      </mesh>
      {/* Ống thoát nước mái ở các góc trước */}
      {[-W / 2 + 0.25, W / 2 - 0.25].map((x) => (
        <mesh key={x} position={[x, H / 2, D / 2 + 0.12]} material={m.metal}>
          <cylinderGeometry args={[0.08, 0.08, H, 8]} />
        </mesh>
      ))}
      {/* Thiết bị mái – vị trí theo tỉ lệ mặt bằng */}
      <group position={[W * 0.11, H, -D * 0.1]}>
        <mesh position={[0, 0.9, 0]} material={m.body}>
          <boxGeometry args={[Math.min(4, W * 0.22), 1.6, Math.min(2.6, D * 0.26)]} />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x * Math.min(1.4, W * 0.07), 1.72, 0]} material={m.dark}>
            <cylinderGeometry args={[0.45, 0.45, 0.06, 20]} />
          </mesh>
        ))}
      </group>
      <mesh position={[W * 0.36, H + 0.6, D * 0.22]} material={m.body}>
        <boxGeometry args={[Math.min(2.4, W * 0.13), 1, Math.min(1.8, D * 0.18)]} />
      </mesh>
      <mesh position={[-W * 0.3, H + 1.3, -D * 0.2]} material={m.body}>
        <cylinderGeometry args={[Math.min(1.1, W * 0.06), Math.min(1.1, W * 0.06), 2.4, 24]} />
      </mesh>
      <mesh position={[-W * 0.3, H + 2.5, -D * 0.2]} scale={[1, 0.4, 1]} material={m.body}>
        <sphereGeometry args={[Math.min(1.1, W * 0.06), 24, 8, 0, Math.PI * 2, 0, HALF_PI]} />
      </mesh>
      {[
        [W * 0.4, -D * 0.3, 5],
        [W * 0.31, -D * 0.34, 4],
        [-W * 0.4, -D * 0.36, 3],
      ].map(([x, z, h]) => (
        <group key={x} position={[x!, H, z!]}>
          <mesh position={[0, h! / 2, 0]} material={m.body}>
            <cylinderGeometry args={[0.32, 0.36, h, 16]} />
          </mesh>
          <mesh position={[0, h! + 0.05, 0]} material={m.metal}>
            <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
          </mesh>
        </group>
      ))}
      {/* Ống công nghệ chạy trên mái */}
      <mesh position={[W * 0.05, H + 0.5, D * 0.3]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.12, 0.12, W * 0.6, 10]} />
      </mesh>
    </group>
  );
}

/** Figma vẽ thiết bị dưới mái vẫn sáng → mái không đổ bóng (vẫn nhận bóng). */
const NO_CAST = { noCastShadow: true };

/**
 * Mái che: sàn bê tông có gờ + cột thép có bản đế + dầm mép/dầm ngang + mái hai dốc trơn (sống mái theo X)
 * có úp nóc và máng xối. Mái không đổ bóng (như Figma).
 * Tham số: length, depth, height (mép mái), bays.
 */
export function Canopy({ params }: AssetComponentProps) {
  const m = useAssetMaterials();
  const W = params.length!;
  const D = params.depth!;
  const eave = params.height!;
  const bays = params.bays!;
  const rise = CANOPY_RISE;
  const slope = Math.atan2(rise, D / 2);
  const slab = Math.hypot(rise, D / 2) + 0.4;
  const colX = Array.from({ length: bays + 1 }, (_, i) => -W / 2 + 0.4 + (i * (W - 0.8)) / bays);
  const colZ = [-D / 2 + 0.4, D / 2 - 0.4];
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={m.concrete}>
        <boxGeometry args={[W, 0.3, D]} />
      </mesh>
      <mesh position={[0, 0.33, 0]} material={m.concrete}>
        <boxGeometry args={[W - 0.3, 0.06, D - 0.3]} />
      </mesh>
      {colX.flatMap((x) =>
        colZ.map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, eave / 2, 0]} material={m.body}>
              <boxGeometry args={[0.32, eave, 0.32]} />
            </mesh>
            <mesh position={[0, 0.36, 0]} material={m.metal}>
              <boxGeometry args={[0.55, 0.06, 0.55]} />
            </mesh>
          </group>
        )),
      )}
      {colZ.map((z) => (
        <mesh key={z} position={[0, eave - 0.2, z]} material={m.body}>
          <boxGeometry args={[W, 0.4, 0.3]} />
        </mesh>
      ))}
      {colX.map((x) => (
        <mesh key={x} position={[x, eave - 0.15, 0]} material={m.metal}>
          <boxGeometry args={[0.2, 0.3, D - 0.6]} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0, eave + rise / 2, (s * D) / 4]} rotation={[s * slope, 0, 0]} material={m.body} userData={NO_CAST}>
            <boxGeometry args={[W + 0.8, 0.18, slab]} />
          </mesh>
          {/* Máng xối dọc mép mái */}
          <mesh position={[0, eave - 0.05, s * (D / 2 + 0.15)]} rotation={[0, 0, HALF_PI]} material={m.metal} userData={NO_CAST}>
            <cylinderGeometry args={[0.1, 0.1, W + 0.8, 10, 1, false]} />
          </mesh>
        </group>
      ))}
      {/* Úp nóc */}
      <mesh position={[0, eave + rise + 0.1, 0]} rotation={[0, 0, HALF_PI]} material={m.metal} userData={NO_CAST}>
        <cylinderGeometry args={[0.14, 0.14, W + 0.85, 8]} />
      </mesh>
    </group>
  );
}

/**
 * Hàng rào khung mảnh dựng theo đoạn từ `path` (polyline cục bộ, khép kín nếu điểm cuối = điểm đầu):
 * cọc (cách đều ≤ postSpacing + mỗi đỉnh), 3 thanh ngang (trên/giữa/chân) và song đứng mảnh – đều instanced (3 draw call).
 * Tham số: height, postSpacing.
 */
export function Fence({ params, path = [] }: AssetComponentProps) {
  const m = useAssetMaterials();
  const h = params.height!;
  const step = params.postSpacing!;
  const pts = path.map((p) => [p[0], p[2]] as const);
  const posts = postsAlong(pts, step);
  const segs = segmentsOf(pts);
  const rails = segs.flatMap((sg) => [h - 0.03, h * 0.55, 0.12].map((y) => ({ ...sg, y })));
  const pickets = postsAlong(pts, 0.42).filter((p) => !posts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.15));

  return (
    <group>
      <Instances limit={Math.max(1, posts.length)} material={m.metal}>
        <cylinderGeometry args={[0.04, 0.04, h + 0.05, 6]} />
        {posts.map(([x, z]) => (
          <Instance key={`${x}:${z}`} position={[x, (h + 0.05) / 2, z]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, rails.length)} material={m.metal}>
        <boxGeometry args={[1, 0.04, 0.04]} />
        {rails.map((r) => (
          <Instance key={`${r.cx}:${r.cz}:${r.y}`} position={[r.cx, r.y, r.cz]} rotation={[0, r.angle, 0]} scale={[r.len, 1, 1]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, pickets.length)} material={m.metal}>
        <boxGeometry args={[0.022, h - 0.15, 0.022]} />
        {pickets.map(([x, z]) => (
          <Instance key={`${x}:${z}`} position={[x, 0.12 + (h - 0.15) / 2, z]} />
        ))}
      </Instances>
    </group>
  );
}

/** Trạm nạp: bệ + tủ điều khiển có màn hình, bàn phím, đèn báo + biển báo trên cột. */
export function LoadingStation() {
  const m = useAssetMaterials();
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={m.concrete}>
        <boxGeometry args={[1.6, 0.2, 1.2]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={m.body}>
        <boxGeometry args={[1.2, 2, 0.8]} />
      </mesh>
      <mesh position={[0, 2.25, 0.05]} material={m.cab}>
        <boxGeometry args={[1.35, 0.1, 0.95]} />
      </mesh>
      <mesh position={[0, 1.7, 0.41]} material={m.cab}>
        <boxGeometry args={[0.95, 0.68, 0.02]} />
      </mesh>
      <mesh position={[0, 1.7, 0.425]} material={m.glass}>
        <boxGeometry args={[0.8, 0.52, 0.02]} />
      </mesh>
      <mesh position={[0, 1.05, 0.5]} rotation={[-0.5, 0, 0]} material={m.body}>
        <boxGeometry args={[1.1, 0.1, 0.4]} />
      </mesh>
      <mesh position={[0.4, 2.36, 0]} material={m.glow} userData={{ noEdges: true }}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
      </mesh>
      <group position={[-2, 0, 0.3]}>
        <mesh position={[0, 1.2, 0]} material={m.metal}>
          <cylinderGeometry args={[0.06, 0.06, 2.4, 8]} />
        </mesh>
        <mesh position={[0, 2.35, 0.05]} material={m.body}>
          <boxGeometry args={[1.1, 0.9, 0.06]} />
        </mesh>
        <mesh position={[0, 2.35, 0.09]} material={m.cab}>
          <boxGeometry args={[0.9, 0.7, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Xe bồn: cabin đầu kéo sơn tối hơn (kính chắn gió, lưới tản nhiệt, cản, gương, bậc lên, bình dầu)
 * + khung sắt-xi + bánh (lốp + mâm, instanced) + chắn bùn + bồn kim loại sáng 2 đáy elip có đai,
 * lối đi + lan can trên nóc, thang sau, hộp van xả. Trục dọc theo X, đầu xe ở −X.
 */
export function TankerTruck() {
  const m = useAssetMaterials();
  const axles = [-6.1, -4.6, 3.4, 4.6, 5.8];
  const wheels = axles.flatMap((x) => [-1.05, 1.05].map((z) => [x, 0.55, z] as const));
  const R = 1.6;
  const L = 9;
  const cx = 1.3;
  const cy = 2.9;
  const tankTop = cy + R;
  return (
    <group>
      {/* Khung sắt-xi */}
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} position={[0, 0.95, z]} material={m.dark}>
          <boxGeometry args={[14.4, 0.32, 0.18]} />
        </mesh>
      ))}
      <mesh position={[-1.3, 1.15, 0]} material={m.dark}>
        <boxGeometry args={[2.4, 0.12, 1.8]} />
      </mesh>
      {/* Bánh: lốp + mâm */}
      <Instances limit={wheels.length} material={m.rubber}>
        <cylinderGeometry args={[0.55, 0.55, 0.42, 24]} />
        {wheels.map((p) => (
          <Instance key={p.join()} position={[...p]} rotation={[HALF_PI, 0, 0]} />
        ))}
      </Instances>
      <Instances limit={wheels.length} material={m.metal}>
        <cylinderGeometry args={[0.3, 0.3, 0.44, 16]} />
        {wheels.map((p) => (
          <Instance key={p.join()} position={[...p]} rotation={[HALF_PI, 0, 0]} />
        ))}
      </Instances>
      {/* Chắn bùn cụm bánh sau */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[4.6, 1.22, s * 1.05]} material={m.cab}>
          <boxGeometry args={[3.7, 0.06, 0.5]} />
        </mesh>
      ))}

      {/* Đầu kéo */}
      <group position={[-6.2, 0, 0]}>
        <mesh position={[0.1, 2.5, 0]} material={m.cab}>
          <boxGeometry args={[2.3, 2.5, 2.45]} />
        </mesh>
        {/* Mui gió */}
        <mesh position={[0.25, 4.05, 0]} material={m.cab}>
          <boxGeometry args={[1.9, 0.6, 2.3]} />
        </mesh>
        {/* Kính chắn gió + kính hông */}
        <mesh position={[-1.07, 3.1, 0]} rotation={[0, 0, -0.08]} material={m.glass}>
          <boxGeometry args={[0.05, 1.05, 2.2]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-0.45, 3.15, s * 1.235]} material={m.glass}>
            <boxGeometry args={[0.9, 0.85, 0.03]} />
          </mesh>
        ))}
        {/* Lưới tản nhiệt, đèn, cản */}
        <mesh position={[-1.07, 2.0, 0]} material={m.dark}>
          <boxGeometry args={[0.05, 0.9, 1.6]} />
        </mesh>
        {[-0.95, 0.95].map((z) => (
          <mesh key={z} position={[-1.08, 1.45, z]} material={m.glass}>
            <boxGeometry args={[0.04, 0.22, 0.4]} />
          </mesh>
        ))}
        <mesh position={[-1.12, 1.1, 0]} material={m.metal}>
          <boxGeometry args={[0.25, 0.4, 2.45]} />
        </mesh>
        {/* Gương */}
        {[-1, 1].map((s) => (
          <group key={s} position={[-0.95, 3.25, s * 1.4]}>
            <mesh material={m.dark}>
              <boxGeometry args={[0.1, 0.55, 0.12]} />
            </mesh>
            <mesh position={[0.2, 0.15, -s * 0.12]} rotation={[0, 0, HALF_PI]} material={m.metal}>
              <cylinderGeometry args={[0.025, 0.025, 0.4, 6]} />
            </mesh>
          </group>
        ))}
        {/* Bậc lên + bình dầu */}
        {[-1, 1].map((s) => (
          <group key={s}>
            {[0.75, 1.2].map((y) => (
              <mesh key={y} position={[0.55, y, s * 1.15]} material={m.metal}>
                <boxGeometry args={[0.55, 0.05, 0.25]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[2.0, 1.05, 0.95]} rotation={[0, 0, HALF_PI]} material={m.shiny}>
          <cylinderGeometry args={[0.32, 0.32, 1.1, 18]} />
        </mesh>
      </group>

      {/* Bồn: thân kim loại sáng + đáy elip + đai + yên đỡ */}
      <mesh position={[cx, cy, 0]} rotation={[0, 0, HALF_PI]} material={m.shiny}>
        <cylinderGeometry args={[R, R, L, 48, 1, true]} />
      </mesh>
      {[1, -1].map((dir) => (
        <mesh
          key={dir}
          position={[cx + (dir * L) / 2, cy, 0]}
          rotation={[0, 0, -dir * HALF_PI]}
          scale={[1, 0.45, 1]}
          material={m.shiny}
        >
          <sphereGeometry args={[R, 48, 12, 0, Math.PI * 2, 0, HALF_PI]} />
        </mesh>
      ))}
      {[-L / 2 + 0.05, -L / 4, 0, L / 4, L / 2 - 0.05].map((x) => (
        <mesh key={x} position={[cx + x, cy, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
          <cylinderGeometry args={[R + 0.025, R + 0.025, 0.1, 48, 1, true]} />
        </mesh>
      ))}
      {[-2.8, 3.2].map((x) => (
        <mesh key={x} position={[cx + x, 1.45, 0]} material={m.dark}>
          <boxGeometry args={[0.5, 0.5, 1.6]} />
        </mesh>
      ))}
      {/* Lối đi + lan can gập + họng nạp trên nóc */}
      <mesh position={[cx, tankTop + 0.06, 0]} material={m.metal}>
        <boxGeometry args={[L * 0.8, 0.06, 0.6]} />
      </mesh>
      {[-1, 1].map((s) => (
        <Railing
          key={s}
          y={tankTop + 0.09}
          height={0.55}
          step={1.8}
          points={[
            [cx - L * 0.4, s * 0.3],
            [cx + L * 0.4, s * 0.3],
          ]}
        />
      ))}
      {[-2.6, 0, 2.6].map((x) => (
        <Nozzle key={x} position={[cx + x, tankTop + 0.08, 0]} r={0.26} h={0.12} />
      ))}
      <Ladder height={tankTop - 1.4} width={0.4} position={[cx + L / 2 + R * 0.45 + 0.1, 1.4, 0.8]} rotationY={-HALF_PI} />
      {/* Cản sau + hộp van xả + họng xả → cổng "outlet" */}
      <mesh position={[7.1, 0.85, 0]} material={m.cab}>
        <boxGeometry args={[0.2, 0.2, 2.3]} />
      </mesh>
      <mesh position={[6.3, 1.1, 0]} material={m.cab}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
      </mesh>
      <mesh position={[7, 1.1, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.18, 0.18, 0.8, 12]} />
      </mesh>
    </group>
  );
}
