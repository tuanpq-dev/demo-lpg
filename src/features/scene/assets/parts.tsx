import { Instance, Instances } from '@react-three/drei';
import type { Vec3 } from '../types';
import { useAssetMaterials, type MaterialKind } from './materials';

/**
 * Chi tiết nhỏ dùng chung cho asset (thang, lan can, mặt bích, van an toàn…) – geometry đơn giản,
 * phần lặp (bậc thang, vòng lồng, cọc lan can) là instance để giữ số draw call thấp.
 */

const HALF_PI = Math.PI / 2;

type XZ = readonly [number, number];

/** Đoạn thẳng giữa các điểm liên tiếp (mặt phẳng XZ): tâm, độ dài, góc quay quanh Y. */
export function segmentsOf(points: readonly XZ[]) {
  return points.slice(1).map((to, i) => {
    const from = points[i]!;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    return { from, to, len: Math.hypot(dx, dz), angle: -Math.atan2(dz, dx), cx: (from[0] + to[0]) / 2, cz: (from[1] + to[1]) / 2 };
  });
}

/** Điểm chia đều trên polyline, cách nhau ≤ `step` (gồm mọi đỉnh). */
export function postsAlong(points: readonly XZ[], step: number): XZ[] {
  const out: XZ[] = [];
  for (const s of segmentsOf(points)) {
    const n = Math.max(1, Math.round(s.len / step));
    for (let i = 0; i < n; i++) out.push([s.from[0] + ((s.to[0] - s.from[0]) * i) / n, s.from[1] + ((s.to[1] - s.from[1]) * i) / n]);
  }
  const last = points.at(-1);
  const first = points[0];
  if (last && !(first && first[0] === last[0] && first[1] === last[1])) out.push(last);
  return out;
}

/**
 * Lan can: cọc + tay vịn trên + thanh giữa + gờ chân, chạy theo polyline (x, z) ở độ cao `y`.
 * 2 draw call (cọc, thanh).
 */
export function Railing({
  points,
  y = 0,
  height = 1.05,
  step = 1.4,
  material = 'metal',
}: {
  points: readonly XZ[];
  y?: number;
  height?: number;
  step?: number;
  material?: MaterialKind;
}) {
  const m = useAssetMaterials()[material];
  const posts = postsAlong(points, step);
  const bars = segmentsOf(points).flatMap((s) =>
    [
      { h: height, t: 0.05 },
      { h: height * 0.5, t: 0.035 },
      { h: 0.08, t: 0.03 },
    ].map((b) => ({ ...s, ...b })),
  );
  return (
    <group position-y={y}>
      <Instances limit={Math.max(1, posts.length)} material={m}>
        <cylinderGeometry args={[0.03, 0.03, height, 6]} />
        {posts.map(([x, z]) => (
          <Instance key={`${x}:${z}`} position={[x, height / 2, z]} />
        ))}
      </Instances>
      <Instances limit={Math.max(1, bars.length)} material={m}>
        <boxGeometry args={[1, 1, 1]} />
        {bars.map((b) => (
          <Instance
            key={`${b.cx}:${b.cz}:${b.h}`}
            position={[b.cx, b.h, b.cz]}
            rotation={[0, b.angle, 0]}
            scale={[b.len + 0.03, b.t, b.t]}
          />
        ))}
      </Instances>
    </group>
  );
}

/**
 * Thang đứng (dọc theo Y, bậc theo X): 2 tay vịn + bậc; `cage` → vòng lồng bảo vệ từ 2.2 m (mở về +Z).
 * Gốc ở chân thang.
 */
export function Ladder({
  height,
  width = 0.46,
  cage = false,
  position,
  rotationY = 0,
}: {
  height: number;
  width?: number;
  cage?: boolean;
  position: Vec3;
  rotationY?: number;
}) {
  const m = useAssetMaterials();
  const rungs = Array.from({ length: Math.max(1, Math.floor((height - 0.2) / 0.3)) }, (_, i) => 0.3 + i * 0.3);
  const hoops = cage ? Array.from({ length: Math.max(0, Math.floor((height - 2.2) / 0.8)) + 1 }, (_, i) => 2.2 + i * 0.8) : [];
  const cageR = width * 0.85;
  return (
    <group position={position} rotation-y={rotationY}>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, height / 2, 0]} material={m.metal}>
          <boxGeometry args={[0.05, height + 0.9, 0.05]} />
        </mesh>
      ))}
      <Instances limit={rungs.length} material={m.metal}>
        <cylinderGeometry args={[0.018, 0.018, width, 6]} />
        {rungs.map((y) => (
          <Instance key={y} position={[0, y, 0]} rotation={[0, 0, HALF_PI]} />
        ))}
      </Instances>
      {hoops.length > 0 && (
        <>
          <Instances limit={hoops.length} material={m.metal}>
            <torusGeometry args={[cageR, 0.025, 4, 20, Math.PI * 1.25]} />
            {hoops.map((y) => (
              <Instance key={y} position={[0, y, cageR * 0.8]} rotation={[HALF_PI, 0, -Math.PI * 0.125]} />
            ))}
          </Instances>
          {[-1, 0, 1].map((k) => (
            <mesh
              key={k}
              position={[Math.sin(k * 1.1) * cageR, (2.2 + height + 0.9) / 2, cageR * 0.8 + Math.cos(k * 1.1) * cageR]}
              material={m.metal}
            >
              <boxGeometry args={[0.035, height + 0.9 - 2.2, 0.035]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/** Mặt bích: đĩa trên trục Y (gốc ở tâm). Dùng `rotation` để xoay theo hướng ống. */
export function Flange({
  position,
  rotation,
  r,
  t = 0.08,
  material = 'metal',
}: {
  position: Vec3;
  rotation?: Vec3;
  r: number;
  t?: number;
  material?: MaterialKind;
}) {
  const m = useAssetMaterials()[material];
  return (
    <mesh position={position} rotation={rotation} material={m}>
      <cylinderGeometry args={[r, r, t, 20]} />
    </mesh>
  );
}

/** Họng đứng trên đỉnh bồn: cổ + bích + (tuỳ chọn) nắp mù có bích đôi. Gốc ở chân họng. */
export function Nozzle({ position, r = 0.25, h = 0.5, blind = true }: { position: Vec3; r?: number; h?: number; blind?: boolean }) {
  const m = useAssetMaterials();
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={m.body}>
        <cylinderGeometry args={[r, r, h, 18]} />
      </mesh>
      <Flange position={[0, h, 0]} r={r * 1.55} t={0.09} />
      {blind && <Flange position={[0, h + 0.1, 0]} r={r * 1.5} t={0.08} />}
    </group>
  );
}

/** Van an toàn (PSV) trên đỉnh: bích + thân côn + nắp chụp + ống xả ngắn. Gốc ở chân. */
export function ReliefValve({ position }: { position: Vec3 }) {
  const m = useAssetMaterials();
  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} material={m.metal}>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 12]} />
      </mesh>
      <Flange position={[0, 0.3, 0]} r={0.18} t={0.06} />
      <mesh position={[0, 0.55, 0]} material={m.body}>
        <cylinderGeometry args={[0.07, 0.13, 0.45, 14]} />
      </mesh>
      <mesh position={[0, 0.85, 0]} material={m.metal}>
        <cylinderGeometry args={[0.05, 0.08, 0.2, 10]} />
      </mesh>
      <mesh position={[0.16, 0.5, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.05, 0.05, 0.25, 8]} />
      </mesh>
    </group>
  );
}

/** Vòng sáng nhỏ quanh ống/khớp (emissive màu dòng chảy → bloom). Trục theo X. */
export function GlowRing({ position, r, rotation }: { position?: Vec3; r: number; rotation?: Vec3 }) {
  const m = useAssetMaterials();
  return (
    <mesh position={position} rotation={rotation ?? [0, HALF_PI, 0]} material={m.glow} userData={{ noEdges: true }}>
      <torusGeometry args={[r, Math.max(0.02, r * 0.09), 6, 28]} />
    </mesh>
  );
}
