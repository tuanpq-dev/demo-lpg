import { Instance, Instances } from '@react-three/drei';
import type { AssetComponentProps } from './registry';
import { useAssetMaterials } from './materials';
import { Flange, GlowRing, Ladder, Railing } from './parts';
import { ASSET_SPECS, VAPORIZER_PLATE_SPAN } from './specs';

const HALF_PI = Math.PI / 2;

/** Bơm ly tâm trên bệ: buồng xoắn (−X, hút ngang, đẩy đứng) + khớp nối + động cơ (+X). */
export function Pump() {
  const m = useAssetMaterials();
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={m.concrete}>
        <boxGeometry args={[2.8, 0.3, 1.3]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={m.metal}>
        <boxGeometry args={[2.6, 0.12, 1]} />
      </mesh>
      {/* Buồng xoắn */}
      <mesh position={[-0.55, 0.95, 0]} rotation={[0, 0, HALF_PI]} material={m.body}>
        <cylinderGeometry args={[0.55, 0.55, 0.5, 28]} />
      </mesh>
      <mesh position={[-0.55, 0.62, 0]} material={m.body}>
        <boxGeometry args={[0.6, 0.4, 0.7]} />
      </mesh>
      {/* Họng hút / đẩy */}
      <mesh position={[-1, 0.8, 0]} rotation={[0, 0, HALF_PI]} material={m.body}>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 16]} />
      </mesh>
      <mesh position={[-0.55, 1.55, 0]} material={m.body}>
        <cylinderGeometry args={[0.16, 0.16, 0.4, 16]} />
      </mesh>
      <Flange position={[-0.55, 1.75, 0]} r={0.26} t={0.07} />
      <Flange position={[-1.22, 0.8, 0]} rotation={[0, 0, HALF_PI]} r={0.28} t={0.07} />
      {/* Chụp bảo vệ khớp nối (nửa trụ) */}
      <mesh position={[0.05, 0.95, 0]} rotation={[0, 0, HALF_PI]} material={m.cab}>
        <cylinderGeometry args={[0.3, 0.3, 0.55, 18, 1, false, -HALF_PI, Math.PI]} />
      </mesh>
      <mesh position={[0.05, 0.95, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
      </mesh>
      {/* Động cơ: thân + gân tản nhiệt + nắp quạt + hộp đấu dây */}
      <mesh position={[0.85, 0.95, 0]} rotation={[0, 0, HALF_PI]} material={m.body}>
        <cylinderGeometry args={[0.46, 0.46, 1.2, 28]} />
      </mesh>
      <Instances limit={6} material={m.body}>
        <cylinderGeometry args={[0.5, 0.5, 0.05, 28]} />
        {[0.4, 0.58, 0.76, 0.94, 1.12, 1.3].map((x) => (
          <Instance key={x} position={[x, 0.95, 0]} rotation={[0, 0, HALF_PI]} />
        ))}
      </Instances>
      <mesh position={[1.52, 0.95, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.4, 0.46, 0.14, 28]} />
      </mesh>
      <mesh position={[0.85, 1.48, 0]} material={m.cab}>
        <boxGeometry args={[0.4, 0.16, 0.36]} />
      </mesh>
      {/* Chân động cơ */}
      {[0.5, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.52, 0]} material={m.metal}>
          <boxGeometry args={[0.12, 0.2, 0.8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Van tay: thân cầu + 2 mặt bích + ty + tay quay. Gốc ở tâm đáy; trục ống theo X, cao `inline.axisY`. */
export function Valve() {
  const m = useAssetMaterials();
  return (
    <group position-y={ASSET_SPECS.valve.inline!.axisY}>
      <mesh material={m.body}>
        <sphereGeometry args={[0.24, 20, 14]} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
          <cylinderGeometry args={[0.24, 0.24, 0.08, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 0.32, 0]} material={m.metal}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} rotation={[HALF_PI, 0, 0]} material={m.dark}>
        <torusGeometry args={[0.2, 0.03, 8, 24]} />
      </mesh>
      <mesh position={[0, 0.52, 0]} material={m.metal}>
        <cylinderGeometry args={[0.04, 0.04, 0.42, 6]} />
      </mesh>
      {/* Vòng sáng ở 2 mặt bích (bloom) */}
      {[-0.36, 0.36].map((x) => (
        <GlowRing key={x} position={[x, 0, 0]} r={0.25} />
      ))}
    </group>
  );
}

/** Bình lọc đứng trên 4 chân: thân trụ + 2 đáy cầu + nắp bích + họng vào (−X, cao) / ra (+X, thấp). */
export function Filter() {
  const m = useAssetMaterials();
  const r = 0.55;
  return (
    <group>
      {(
        [
          [-0.35, -0.35],
          [0.35, -0.35],
          [-0.35, 0.35],
          [0.35, 0.35],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.3, z]} material={m.metal}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, 0]} rotation={[Math.PI, 0, 0]} scale={[1, 0.5, 1]} material={m.body}>
        <sphereGeometry args={[r, 24, 10, 0, Math.PI * 2, 0, HALF_PI]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} material={m.body}>
        <cylinderGeometry args={[r, r, 1.8, 28]} />
      </mesh>
      <mesh position={[0, 2.4, 0]} material={m.metal}>
        <cylinderGeometry args={[r + 0.1, r + 0.1, 0.1, 28]} />
      </mesh>
      <mesh position={[0, 2.45, 0]} scale={[1, 0.4, 1]} material={m.body}>
        <sphereGeometry args={[r, 24, 10, 0, Math.PI * 2, 0, HALF_PI]} />
      </mesh>
      <mesh position={[-0.7, 1.9, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.15, 0.15, 0.35, 14]} />
      </mesh>
      <mesh position={[0.7, 0.9, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.15, 0.15, 0.35, 14]} />
      </mesh>
      <Flange position={[-0.88, 1.9, 0]} rotation={[0, 0, HALF_PI]} r={0.24} t={0.06} />
      <Flange position={[0.88, 0.9, 0]} rotation={[0, 0, HALF_PI]} r={0.24} t={0.06} />
      {/* Tay đòn nâng nắp */}
      <mesh position={[0.66, 2.55, 0]} material={m.metal}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 8]} />
      </mesh>
      <mesh position={[0.4, 2.88, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.03, 0.03, 0.55, 8]} />
      </mesh>
      {/* Đồng hồ chênh áp */}
      <mesh position={[0, 1.9, r + 0.08]} rotation={[HALF_PI, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
      </mesh>
    </group>
  );
}

/** Đồng hồ lưu lượng (FT): thân trụ nằm trên ống + 2 bích + đầu transmitter. Gốc ở tâm đáy; trục ống cao `inline.axisY`. */
export function FlowMeter() {
  const m = useAssetMaterials();
  return (
    <group position-y={ASSET_SPECS['flow-meter'].inline!.axisY}>
      <mesh rotation={[0, 0, HALF_PI]} material={m.body}>
        <cylinderGeometry args={[0.3, 0.3, 0.7, 20]} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 20]} />
        </mesh>
      ))}
      <mesh position={[0, 0.45, 0]} material={m.metal}>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 10]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} material={m.body}>
        <boxGeometry args={[0.42, 0.34, 0.34]} />
      </mesh>
      <mesh position={[0, 0.72, 0.18]} material={m.glass}>
        <boxGeometry args={[0.26, 0.2, 0.02]} />
      </mesh>
      {/* Vòng sáng ở 2 mặt bích (bloom) */}
      {[-0.47, 0.47].map((x) => (
        <GlowRing key={x} position={[x, 0, 0]} r={0.37} />
      ))}
    </group>
  );
}

/** Cụm hóa hơi & điều áp (E-101A): bệ bê tông + bộ trao đổi nhiệt dạng tấm (lá instanced) + bình phụ + đường ống nội bộ. */
export function Vaporizer({ params }: AssetComponentProps) {
  const m = useAssetMaterials();
  const n = params.plates!;
  // Tấm chia đều trong khoảng giữa 2 khung đầu.
  const plates = Array.from({ length: n }, (_, i) => -2.6 + (i * (VAPORIZER_PLATE_SPAN - 0.2)) / Math.max(1, n - 1));
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={m.concrete}>
        <boxGeometry args={[9, 0.4, 5.5]} />
      </mesh>
      {/* Bộ trao đổi nhiệt dạng tấm */}
      <group position={[-1.2, 0.4, 0.3]}>
        {[-2.85, 0.35].map((x) => (
          <mesh key={x} position={[x, 1.25, 0]} material={m.body}>
            <boxGeometry args={[0.3, 2.5, 1.7]} />
          </mesh>
        ))}
        <Instances limit={plates.length} material={m.body}>
          <boxGeometry args={[0.07, 2.2, 1.5]} />
          {plates.map((x) => (
            <Instance key={x} position={[x, 1.2, 0]} />
          ))}
        </Instances>
        {[0.4, 2.1].map((y) => (
          <mesh key={y} position={[-1.25, y, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
            <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
          </mesh>
        ))}
      </group>
      {/* Bình tách lỏng */}
      <group position={[2.4, 0.4, -1.2]}>
        <mesh position={[0, 1.2, 0]} material={m.body}>
          <cylinderGeometry args={[0.55, 0.55, 2.2, 24]} />
        </mesh>
        <mesh position={[0, 2.3, 0]} scale={[1, 0.5, 1]} material={m.body}>
          <sphereGeometry args={[0.55, 24, 10, 0, Math.PI * 2, 0, HALF_PI]} />
        </mesh>
      </group>
      {/* Tủ điều khiển */}
      <mesh position={[2.6, 1.3, 1.6]} material={m.body}>
        <boxGeometry args={[1.4, 1.8, 0.6]} />
      </mesh>
      <mesh position={[2.6, 1.5, 1.92]} material={m.glass}>
        <boxGeometry args={[0.9, 0.6, 0.04]} />
      </mesh>
      {/* Thanh dẫn hướng trên đỉnh khung trao đổi nhiệt */}
      <mesh position={[-2.45, 2.95, 0.3]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <boxGeometry args={[0.12, 3.5, 0.2]} />
      </mesh>
      {/* Đầu nối vào/ra có bích */}
      <Flange position={[-4.1, 1.2, 1.5]} rotation={[0, 0, HALF_PI]} r={0.3} />
      <Flange position={[4.35, 1.2, -1.5]} rotation={[0, 0, HALF_PI]} r={0.28} />
      {/* Lan can mép bệ phía sau + thang lên bình tách */}
      <Railing
        y={0.4}
        points={[
          [-4.3, -2.6],
          [4.3, -2.6],
          [4.3, -0.4],
        ]}
      />
      <Ladder height={2.5} width={0.4} position={[3.05, 0.4, -1.2]} rotationY={HALF_PI} />
      {/* Ống nội bộ */}
      <mesh position={[1.7, 1.2, -1.5]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.14, 0.14, 5.6, 12]} />
      </mesh>
      <mesh position={[-3.9, 1.2, 1.5]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.16, 0.16, 0.8, 12]} />
      </mesh>
    </group>
  );
}
