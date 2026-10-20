import type { ReactNode } from 'react';
import { BusinessSection } from './BusinessSection';
import { FormsSection } from './FormsSection';
import { ChartsTableSection } from './ChartsTableSection';
import { LayoutSection } from './LayoutSection';
import { NavigationSection } from './NavigationSection';
import { PrimitivesSection } from './PrimitivesSection';
import { SceneSection } from './SceneSection';
import { TokensSection } from './TokensSection';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h2 className="border-b border-line/30 pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PlaygroundPage() {
  return (
    <div className="mx-auto flex max-w-[1565px] flex-col gap-12 px-page py-8">
      <header>
        <h1 className="text-3xl font-bold">Component Playground</h1>
        <p className="text-base text-fg-secondary">Digital Twin 2026 – đối chiếu với Figma</p>
      </header>

      <Section id="scene" title="8. Cảnh 3D (3D-1 Viewer)">
        <SceneSection />
      </Section>

      <Section id="forms" title="7. Form, Modal, Drawer & Bảo trì">
        <FormsSection />
      </Section>

      <Section id="charts" title="6. Chart & bảng">
        <ChartsTableSection />
      </Section>

      <Section id="business" title="5. Nghiệp vụ (đợt 1)">
        <BusinessSection />
      </Section>

      <Section id="layout" title="4. Layout">
        <LayoutSection />
      </Section>

      <Section id="navigation" title="3. Form & điều hướng">
        <NavigationSection />
      </Section>

      <Section id="primitives" title="2. Primitives">
        <PrimitivesSection />
      </Section>

      <Section id="tokens" title="1. Design tokens">
        <TokensSection />
      </Section>
    </div>
  );
}
