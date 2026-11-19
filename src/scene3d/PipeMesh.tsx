import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Matrix4, Quaternion, RepeatWrapping, Vector3, type CatmullRomCurve3, type InstancedMesh } from 'three';
import type { ScenePalette } from './colors';

/** Lưu lượng tham chiếu: tại giá trị này vệt sáng chạy `BASE_SPEED` m/s. */
const FLOW_REF = 200;
const BASE_SPEED = 1.6;
/** Khoảng cách giữa 2 vệt sáng (m). */
const STRIPE = 1.8;
/** Bán kính lõi sáng so với vỏ. */
const CORE = 0.6;

/**
 * Mặt nạ độ sáng cho vệt dòng chảy (không phải màu – màu lấy từ token qua material).
 * Nền tối vừa + một vệt sáng mềm theo chiều u (dọc ống); đỉnh vệt vượt ngưỡng bloom.
 */
/** Mức xám của vệt sáng dọc ống (mặt nạ độ sáng nhân với màu token, không phải màu giao diện). */
const STRIPE_STOPS: readonly [offset: number, gray: number][] = [
  [0, 70], // nền tối
  [0.55, 85],
  [0.82, 255], // đỉnh vệt – vượt ngưỡng bloom
  [1, 70],
];

function createStripeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 2;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, c.width, 0);
  for (const [offset, gray] of STRIPE_STOPS) grad.addColorStop(offset, `rgb(${gray} ${gray} ${gray})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const tex = new CanvasTexture(c);
  tex.wrapS = RepeatWrapping;
  return tex;
}

type Joint = { pos: Vector3; dir: Vector3 };

/**
 * Khớp nối = 2 đầu mỗi cung bo (điểm `sharpenCorners` chèn quanh góc) + 2 đầu ống.
 * curve.points = [đầu, (vào, góc, ra) × số góc, cuối].
 */
function pipeJoints(curve: CatmullRomCurve3): Joint[] {
  const p = curve.points;
  if (p.length < 2) return [];
  const dir = (a: Vector3, b: Vector3) => b.clone().sub(a).normalize();
  const out: Joint[] = [{ pos: p[0]!, dir: dir(p[0]!, p[1]!) }];
  for (let i = 1; i + 2 < p.length; i += 3) {
    out.push({ pos: p[i]!, dir: dir(p[i]!, p[i + 1]!) }, { pos: p[i + 2]!, dir: dir(p[i + 1]!, p[i + 2]!) });
  }
  out.push({ pos: p.at(-1)!, dir: dir(p.at(-2)!, p.at(-1)!) });
  return out;
}

type PipeMeshProps = {
  /** Đường cong tâm ống (`pipeCurve`) – cùng đường cong dùng để đặt object gắn ống. */
  curve: CatmullRomCurve3;
  radius: number;
  palette: ScenePalette;
  /** Lưu lượng hiện tại; undefined/0 → không chạy hiệu ứng. */
  flow?: number;
  /** Có bloom (postprocessing) → bỏ quầng additive giả lập. */
  bloom?: boolean;
  /** Ống đang chọn (Editor) → vỏ đổi sang màu `primary`, đậm hơn. */
  selected?: boolean;
  /** prefers-reduced-motion: vệt sáng đứng yên (vẫn sáng hơn khi có lưu lượng). */
  still?: boolean;
};

const Z = new Vector3(0, 0, 1);
const ONE = new Vector3(1, 1, 1);

/**
 * Ống phát sáng: lõi emissive màu `scene-flow` có vệt sáng chạy theo lưu lượng (TubeGeometry theo Catmull-Rom)
 * + vỏ ngoài trong mờ + vòng sáng ở khớp nối (instanced, emissive → bloom). Không bloom → thêm quầng additive.
 */
export function PipeMesh({ curve, radius, palette, flow, bloom, selected, still }: PipeMeshProps) {
  const length = useMemo(() => curve.getLength(), [curve]);
  const segments = Math.min(1200, Math.ceil(length * 8));

  const texture = useMemo(() => {
    const t = createStripeTexture();
    t.repeat.set(length / STRIPE, 1);
    return t;
  }, [length]);
  useEffect(() => () => texture.dispose(), [texture]);

  const speed = flow && flow > 0 ? (flow / FLOW_REF) * BASE_SPEED : 0;
  useFrame((_, dt) => {
    if (speed && !still) texture.offset.x -= (speed * dt) / STRIPE;
  });

  const joints = useMemo(() => pipeJoints(curve), [curve]);
  const rings = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = rings.current;
    if (!m) return;
    const q = new Quaternion();
    const mat = new Matrix4();
    joints.forEach((j, i) => m.setMatrixAt(i, mat.compose(j.pos, q.setFromUnitVectors(Z, j.dir), ONE)));
    m.count = joints.length;
    m.instanceMatrix.needsUpdate = true;
  }, [joints]);

  return (
    <group>
      {/* Lõi sáng */}
      <mesh castShadow>
        <tubeGeometry args={[curve, segments, radius * CORE, 10, false]} />
        <meshStandardMaterial
          color={palette.flow}
          emissive={palette.flow}
          emissiveMap={texture}
          emissiveIntensity={speed ? 1.35 : 0.7}
          roughness={0.4}
          metalness={0}
        />
      </mesh>
      {/* Vỏ ngoài trong mờ */}
      <mesh renderOrder={1}>
        <tubeGeometry args={[curve, segments, radius, 14, false]} />
        <meshStandardMaterial
          color={selected ? palette.primary : palette.flow}
          emissive={selected ? palette.primary : palette.flow}
          emissiveIntensity={selected ? 0.6 : 0.18}
          transparent
          opacity={selected ? 0.8 : 0.55}
          roughness={0.18}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
      {/* Vòng sáng ở khớp nối */}
      <instancedMesh ref={rings} args={[undefined, undefined, Math.max(1, joints.length)]} frustumCulled={false}>
        <torusGeometry args={[radius * 1.04, radius * 0.11, 6, 24]} />
        <meshStandardMaterial color={palette.flow} emissive={palette.flow} emissiveIntensity={1.1} roughness={0.4} />
      </instancedMesh>
      {!bloom && (
        <mesh>
          <tubeGeometry args={[curve, segments, radius * 2, 10, false]} />
          <meshBasicMaterial color={palette.flow} transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
