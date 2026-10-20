import type { AssetComponentProps } from './registry';
import { useAssetMaterials } from './materials';
import { Flange, Ladder, Nozzle, Railing, ReliefValve } from './parts';
import { TANK_DRAIN_Y, TANK_SADDLE_H, tankHorizontalPlatform } from './specs';

const HALF_PI = Math.PI / 2;

/** Đáy elip (nửa cầu dẹt) hướng theo ±X. */
function Head({ x, y, r, dir, depth = 0.5, material = 'body' }: { x: number; y: number; r: number; dir: 1 | -1; depth?: number; material?: 'body' | 'shiny' }) {
  const m = useAssetMaterials();
  return (
    <mesh position={[x, y, 0]} rotation={[0, 0, -dir * HALF_PI]} scale={[1, depth, 1]} material={m[material]}>
      <sphereGeometry args={[r, 48, 16, 0, Math.PI * 2, 0, HALF_PI]} />
    </mesh>
  );
}

/** Vành mỏng quanh thân trụ trục X (mối hàn / đai). `arc` < 2π → chỉ phần dưới (tấm đệm yên đỡ). */
function Band({ x, y, r, w, arc = Math.PI * 2, material = 'metal' }: { x: number; y: number; r: number; w: number; arc?: number; material?: 'metal' | 'body' }) {
  const m = useAssetMaterials();
  // Trục trụ (Y cục bộ) → X; thetaStart đặt cung đối xứng quanh đáy (−Y thế giới).
  return (
    <mesh position={[x, y, 0]} rotation={[0, 0, HALF_PI]} material={m[material]}>
      <cylinderGeometry args={[r, r, w, 56, 1, true, Math.PI / 2 - arc / 2 + Math.PI, arc]} />
    </mesh>
  );
}

/** Yên đỡ thép (bản bụng + bản đế + 2 sườn) trên bệ bê tông. Gốc ở mặt đất, tâm yên. */
function Saddle({ x, R, cy }: { x: number; R: number; cy: number }) {
  const m = useAssetMaterials();
  const pier = 0.35;
  const webTop = cy - R * 0.62;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, pier / 2, 0]} material={m.concrete}>
        <boxGeometry args={[1.5, pier, R * 1.85]} />
      </mesh>
      <mesh position={[0, pier + 0.04, 0]} material={m.metal}>
        <boxGeometry args={[1.0, 0.08, R * 1.65]} />
      </mesh>
      <mesh position={[0, (pier + webTop) / 2, 0]} material={m.metal}>
        <boxGeometry args={[0.1, webTop - pier, R * 1.5]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, (pier + webTop) / 2, s * R * 0.55]} material={m.metal}>
          <boxGeometry args={[0.8, webTop - pier, 0.07]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Bồn nằm ngang (V-101): thân trụ + 2 đáy elip + mối hàn vòng + tấm đệm & yên đỡ thép trên bệ bê tông,
 * cửa người chui (bích + tay đòn), 2 van an toàn, họng đo, ống đo mức bên hông, thang có lồng lên sàn thao tác có lan can.
 * Trục dọc theo X. Tham số: length (thân), diameter.
 */
export function TankHorizontal({ params }: AssetComponentProps) {
  const m = useAssetMaterials();
  const L = params.length!;
  const R = params.diameter! / 2;
  const cy = R + TANK_SADDLE_H;
  const top = cy + R;
  const deck = tankHorizontalPlatform(L, R);
  const saddles = [-L * 0.3, L * 0.3];
  return (
    <group>
      <mesh position={[0, cy, 0]} rotation={[0, 0, HALF_PI]} material={m.body}>
        <cylinderGeometry args={[R, R, L, 64, 1, true]} />
      </mesh>
      <Head x={L / 2} y={cy} r={R} dir={1} />
      <Head x={-L / 2} y={cy} r={R} dir={-1} />
      {/* Mối hàn vòng ở 2 đầu + giữa thân */}
      {[-L / 2 + 0.02, -L / 6, L / 6, L / 2 - 0.02].map((x) => (
        <Band key={x} x={x} y={cy} r={R + 0.012} w={0.05} />
      ))}
      {/* Tấm đệm + yên đỡ */}
      {saddles.map((x) => (
        <group key={x}>
          <Band x={x} y={cy} r={R + 0.03} w={0.9} arc={Math.PI * 0.75} />
          <Saddle x={x} R={R} cy={cy} />
        </group>
      ))}

      {/* Cửa người chui: cổ + bích đôi + tay đòn */}
      <Nozzle position={[-L * 0.27, top - 0.06, 0]} r={0.38} h={0.42} />
      <mesh position={[-L * 0.27 + 0.48, top + 0.75, 0]} material={m.metal}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 8]} />
      </mesh>
      <mesh position={[-L * 0.27 + 0.3, top + 1.08, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.03, 0.03, 0.38, 8]} />
      </mesh>
      {/* Van an toàn, họng đo, đầu đo mức trên đỉnh */}
      <ReliefValve position={[L * 0.06, top - 0.04, -0.3]} />
      <ReliefValve position={[L * 0.06, top - 0.04, 0.3]} />
      <Nozzle position={[L * 0.22, top - 0.05, 0]} r={0.16} h={0.45} />
      <group position={[L * 0.36, top - 0.05, 0]}>
        <Nozzle position={[0, 0, 0]} r={0.12} h={0.3} blind={false} />
        <mesh position={[0, 0.55, 0]} material={m.cab}>
          <boxGeometry args={[0.26, 0.3, 0.22]} />
        </mesh>
      </group>

      {/* Ống đo mức (từ tính) bên hông +Z */}
      <group position={[L * 0.12, 0, R + 0.3]}>
        <mesh position={[0, cy, 0]} material={m.metal}>
          <cylinderGeometry args={[0.07, 0.07, R * 1.4, 10]} />
        </mesh>
        {[cy - R * 0.55, cy + R * 0.55].map((y) => (
          <mesh key={y} position={[0, y, -0.2]} rotation={[HALF_PI, 0, 0]} material={m.metal}>
            <cylinderGeometry args={[0.045, 0.045, 0.45, 8]} />
          </mesh>
        ))}
        <mesh position={[0.11, cy, 0]} material={m.glass}>
          <boxGeometry args={[0.05, R * 1.1, 0.1]} />
        </mesh>
      </group>
      {/* Biển tên */}
      <mesh position={[-L * 0.05, cy - R * 0.15, R * 0.99]} rotation={[-0.15, 0, 0]} material={m.cab}>
        <boxGeometry args={[0.9, 0.5, 0.03]} />
      </mesh>

      {/* Sàn thao tác trên đỉnh + chiếu nghỉ ra mép +Z, thang có lồng từ mặt đất */}
      <mesh position={[deck.x, deck.y - 0.04, (deck.z0 + deck.z1) / 2]} material={m.metal}>
        <boxGeometry args={[deck.w, 0.08, deck.z1 - deck.z0]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[deck.x + (s * deck.w) / 2 - s * 0.1, (deck.y + cy + R * 0.7) / 2, deck.z1 - 0.15]} material={m.metal}>
          <boxGeometry args={[0.07, deck.y - cy - R * 0.7, 0.07]} />
        </mesh>
      ))}
      <Railing
        y={deck.y}
        points={[
          [deck.x - deck.w / 2, deck.z1 - 0.7],
          [deck.x - deck.w / 2, deck.z0],
          [deck.x + deck.w / 2, deck.z0],
          [deck.x + deck.w / 2, deck.z1],
          [deck.x + 0.35, deck.z1],
        ]}
      />
      <Ladder height={deck.y} cage position={[deck.x - 0.2, 0, deck.z1 + 0.05]} />

      {/* Họng ra ở đáy phải → cổng "out" */}
      <mesh position={[L / 2 + R * 0.5 + 0.2, cy, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.24, 0.24, 0.6, 16]} />
      </mesh>
      <Flange position={[L / 2 + R * 0.5 + 0.48, cy, 0]} rotation={[0, 0, HALF_PI]} r={0.38} t={0.08} />
      {/* Họng vào ở đầu trái → cổng "in" (đối xứng họng ra) */}
      <mesh position={[-L / 2 - R * 0.5 - 0.2, cy, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.24, 0.24, 0.6, 16]} />
      </mesh>
      <Flange position={[-L / 2 - R * 0.5 - 0.48, cy, 0]} rotation={[0, 0, HALF_PI]} r={0.38} t={0.08} />
      {/* Họng xả đáy → cổng "drain" */}
      <mesh position={[0, (TANK_SADDLE_H + TANK_DRAIN_Y) / 2 + 0.05, 0]} material={m.metal}>
        <cylinderGeometry args={[0.15, 0.15, TANK_SADDLE_H - TANK_DRAIN_Y, 12]} />
      </mesh>
      <Flange position={[0, TANK_DRAIN_Y + 0.04, 0]} r={0.24} t={0.06} />
    </group>
  );
}

/**
 * Tháp/bồn đứng: chân váy bê tông + thân trụ + đỉnh bán cầu + đai, thang có lồng lên sàn tròn có lan can,
 * họng vào/ra có bích. Tham số: height (thân), diameter.
 */
export function TankVertical({ params }: AssetComponentProps) {
  const m = useAssetMaterials();
  const r = params.diameter! / 2;
  const h = params.height!;
  const deckY = 1 + h;
  const ring = Array.from({ length: 17 }, (_, i) => {
    // Lan can quanh đỉnh, chừa lối vào ở phía thang (+X).
    const a = 0.45 + (i / 16) * (Math.PI * 2 - 0.9);
    return [Math.cos(a) * (r + 0.55), Math.sin(a) * (r + 0.55)] as const;
  });
  return (
    <group>
      <mesh position={[0, 0.5, 0]} material={m.concrete}>
        <cylinderGeometry args={[r * 1.25, r * 1.35, 1, 32]} />
      </mesh>
      <mesh position={[0, 1 + h / 2, 0]} material={m.body}>
        <cylinderGeometry args={[r, r, h, 40]} />
      </mesh>
      <mesh position={[0, 1 + h, 0]} scale={[1, 0.5, 1]} material={m.body}>
        <sphereGeometry args={[r, 40, 12, 0, Math.PI * 2, 0, HALF_PI]} />
      </mesh>
      {[0.3, 0.6, 0.85].map((f) => (
        <mesh key={f} position={[0, 1 + h * f, 0]} material={m.metal}>
          <cylinderGeometry args={[r + 0.04, r + 0.04, 0.08, 40, 1, true]} />
        </mesh>
      ))}
      <Nozzle position={[0, 1 + h + r * 0.45, 0]} r={0.16} h={0.45} />
      {/* Sàn vành khăn quanh đỉnh + lan can */}
      <mesh position={[0, deckY - 0.04, 0]} material={m.metal}>
        <cylinderGeometry args={[r + 0.6, r + 0.6, 0.08, 32]} />
      </mesh>
      <Railing y={deckY} points={ring} step={1.1} />
      <Ladder height={deckY} cage position={[r + 0.3, 0, 0]} rotationY={HALF_PI} />
      {/* Họng vào/ra + bích */}
      <mesh position={[-r - 0.15, 1.2, 0]} rotation={[0, 0, HALF_PI]} material={m.metal}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
      </mesh>
      <Flange position={[-r - 0.28, 1.2, 0]} rotation={[0, 0, HALF_PI]} r={0.32} />
      <mesh position={[0, 1.2, -r - 0.15]} rotation={[HALF_PI, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
      </mesh>
      <Flange position={[0, 1.2, -r - 0.28]} rotation={[HALF_PI, 0, 0]} r={0.32} />
      {/* Họng xả phía +Z → cổng "drain" */}
      <mesh position={[0, 1.2, r + 0.15]} rotation={[HALF_PI, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 16]} />
      </mesh>
      <Flange position={[0, 1.2, r + 0.28]} rotation={[HALF_PI, 0, 0]} r={0.26} />
    </group>
  );
}
