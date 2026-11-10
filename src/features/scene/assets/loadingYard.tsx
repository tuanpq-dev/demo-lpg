/** Khu nạp: trạm chiết nạp + xe bồn LPG (dựng bằng khối cơ bản). Tách từ structures.tsx. */
import { Instance, Instances } from '@react-three/drei';
import { useAssetMaterials } from './materials';
import { Flange, Ladder, Nozzle, Railing } from './parts';
import { HALF_PI } from './structures';

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
      {/* Họng ra (cần nạp) → cổng "out" */}
      <mesh position={[0.75, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 12]} />
      </mesh>
      <Flange position={[0.92, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} r={0.17} t={0.05} />
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
        <mesh key={dir} position={[cx + (dir * L) / 2, cy, 0]} rotation={[0, 0, -dir * HALF_PI]} scale={[1, 0.45, 1]} material={m.shiny}>
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
