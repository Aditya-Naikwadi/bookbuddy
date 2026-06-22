const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Helper to replace content
function replaceInFile(filePath, searchRegex, replaceWith) {
  const fullPath = path.join(srcDir, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(searchRegex, replaceWith);
  fs.writeFileSync(fullPath, content);
}

// -----------------------------------------------------
// FIX 1 & 2: Landing.jsx (LenisContext & Global Canvas)
// -----------------------------------------------------
const landingPath = path.join(srcDir, 'pages', 'public', 'Landing.jsx');
let landingCode = fs.readFileSync(landingPath, 'utf8');

// Replace imports and wrap with Context + Canvas
landingCode = landingCode.replace(
  /import Lenis from '@studio-freight\/lenis';\nimport \{ gsap, ScrollTrigger \} from '\.\.\/\.\.\/utils\/gsap';/,
  `import { useRef } from 'react';\nimport { Canvas } from '@react-three/fiber';\nimport { View, Preload } from '@react-three/drei';\nimport { useLenis } from '../../hooks/useLenis';\nimport { LenisContext } from '../../context/LenisContext';\nimport { gsap, ScrollTrigger } from '../../utils/gsap';`
);

// Replace component body
const landingNewBody = `const Landing = () => {
  const containerRef = useRef(null);
  const lenisRef = useLenis(containerRef);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <LenisContext.Provider value={lenisRef}>
      <main ref={containerRef} className="bg-void text-ink font-sans selection:bg-ember/30 selection:text-ember-100 relative" style={{ overflowY: 'auto', height: '100dvh' }}>
        <ScrollProgress />
        <Navbar />
        <Hero />
        <TrustBar />
        <Features />
        <EResources />
        <StreakShowcase />
        <HowItWorks />
        <PatronCardSection />
        <Testimonials />
        <CTA />
        <Footer />

        <Canvas
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
          dpr={[1, 2]}
          frameloop="demand"
          gl={{ antialias: true, alpha: true }}
        >
          <View.Port />
          <Preload all />
        </Canvas>
      </main>
    </LenisContext.Provider>
  );
};`;

landingCode = landingCode.replace(/const Landing = \(\) => \{[\s\S]*?\};\n/g, landingNewBody + '\n');
fs.writeFileSync(landingPath, landingCode);


// -----------------------------------------------------
// FIX 2: Hero.tsx (View) & FIX 3: GSAP Leak
// -----------------------------------------------------
replaceInFile('sections/Hero.tsx', 
  /import \{ Scene \} from '\.\.\/components\/three\/Scene';/g,
  "import { Scene } from '../components/three/Scene';\nimport { View } from '@react-three/drei';"
);
replaceInFile('sections/Hero.tsx',
  /<div className="absolute inset-0 z-0">\n\s*<Scene scrollProgress=\{scrollProgress\} \/>\n\s*<\/div>/g,
  `<div className="absolute inset-0 z-0 pointer-events-none" id="hero-view-track"></div>
        <View track={document.getElementById('hero-view-track') || useRef(null)}>
          <Scene scrollProgress={scrollProgress} />
        </View>`
);

// -----------------------------------------------------
// FIX 2: EResources.tsx (View)
// -----------------------------------------------------
replaceInFile('sections/EResources.tsx',
  /import \{ Canvas \} from '@react-three\/fiber';/g,
  "import { View } from '@react-three/drei';\nimport { PerspectiveCamera } from '@react-three/drei';"
);
// EResources no longer needs IntersectionObserver for canvas since View handles it efficiently,
// but let's just replace Canvas with View and add a Viewport tracker.
replaceInFile('sections/EResources.tsx',
  /\{inView && \([\s\S]*?<\/Canvas>\n\s*\)\}/g,
  `<div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <View track={containerRef}>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[2, 5, 2]} intensity={1} />
            <group rotation={[Math.PI / 8, -Math.PI / 6, 0]}>
              {[0, 1, 2, 3, 4].map(i => <FeatureBook key={i} index={i} />)}
            </group>
          </View>`
);


// -----------------------------------------------------
// FIX 4: On-Demand Invalidation
// -----------------------------------------------------
const invalidateHook = `import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useLenisContext } from '../context/LenisContext';

export function useInvalidateOnScroll() {
  const { invalidate } = useThree();
  const lenisRef = useLenisContext();

  useEffect(() => {
    const lenis = lenisRef?.current;
    if (!lenis) return;

    const handler = () => invalidate();
    lenis.on('scroll', handler);
    return () => {
      lenis.off('scroll', handler);
    };
  }, [invalidate, lenisRef]);
}
`;
fs.writeFileSync(path.join(srcDir, 'hooks', 'useInvalidateOnScroll.ts'), invalidateHook);

// Add to Scene.tsx
replaceInFile('components/three/Scene.tsx',
  /export const Scene = \(\{ scrollProgress \} \: \{ scrollProgress: number \}\) => \{/g,
  `import { useInvalidateOnScroll } from '../../hooks/useInvalidateOnScroll';\n\nexport const Scene = ({ scrollProgress } : { scrollProgress: number }) => {\n  useInvalidateOnScroll();`
);

// -----------------------------------------------------
// FIX 5: Features Layout Thrashing
// -----------------------------------------------------
const activeFeatureHook = `import { useEffect, useRef, useState, useCallback } from 'react';

export function useActiveFeature(count: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>(Array(count).fill(null));

  const setRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    refs.current[index] = el;
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = refs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) setActiveIndex(index);
          }
        });
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 }
    );

    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return { activeIndex, setRef };
}
`;
fs.writeFileSync(path.join(srcDir, 'hooks', 'useActiveFeature.ts'), activeFeatureHook);

replaceInFile('sections/Features.tsx',
  /import \{ AnimatePresence, motion \} from 'framer-motion';/g,
  `import { AnimatePresence, motion } from 'framer-motion';\nimport { useActiveFeature } from '../hooks/useActiveFeature';`
);

replaceInFile('sections/Features.tsx',
  /const \[activeIndex, setActiveIndex\] = useState\(0\);\n[\s\S]*?return \(\) => observer\.disconnect\(\);\n  \}, \[\]\);/g,
  `const { activeIndex, setRef } = useActiveFeature(featuresList.length);`
);

replaceInFile('sections/Features.tsx',
  /<div key=\{i\} className="feature-card-item" data-index=\{i\}>/g,
  `<div key={i} ref={setRef(i)} className={\`feature-card-item \${i === activeIndex ? 'active' : ''}\`}>`
);

// -----------------------------------------------------
// FIX 7: CTA Font Load & No SplitText
// -----------------------------------------------------
replaceInFile('sections/CTA.tsx',
  /import \{ useGSAP \} from '@gsap\/react';/,
  `import { useGSAP } from '@gsap/react';\nimport { motion } from 'framer-motion';`
);
replaceInFile('sections/CTA.tsx',
  /<h2 className="font-serif text-5xl md:text-7xl text-white mb-6">/g,
  `<h2 className="font-serif text-5xl md:text-7xl text-white mb-6 flex flex-wrap justify-center gap-x-4">`
);
// Replace content of CTA.tsx entirely to use standard motion for splitting
const ctaPath = path.join(srcDir, 'sections', 'CTA.tsx');
let ctaCode = `import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '../utils/gsap';
import { Button } from '../components/ui/Button';

export const CTA = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useGSAP(async () => {
    await document.fonts.ready;
    if (!sectionRef.current) return;
    
    // Instead of premium SplitText, we do a simple manual word split via spans
    // and animate them.
    const words = document.querySelectorAll('.cta-word');
    gsap.from(words, {
      opacity: 0,
      y: 40,
      stagger: 0.05,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 80%',
      }
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="bg-ember relative overflow-hidden py-32 md:py-48">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        <h2 ref={headingRef} className="font-serif text-5xl md:text-7xl text-white mb-6 flex flex-wrap justify-center gap-x-4">
          {"Your library. Upgraded.".split(' ').map((word, i) => (
            <span key={i} className="cta-word inline-block">{word}</span>
          ))}
        </h2>
        <p className="text-white/90 text-xl md:text-2xl mb-12 font-medium">
          Join thousands of students managing their resources smarter.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="secondary" size="lg" className="w-full sm:w-auto bg-white text-ember hover:bg-white/90">
            Create Free Account
          </Button>
          <Button variant="ghost" size="lg" className="w-full sm:w-auto text-white hover:bg-white/10 border border-white/20">
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  );
};`;
fs.writeFileSync(ctaPath, ctaCode);

// -----------------------------------------------------
// FIX 8: Mobile Camera FOV
// -----------------------------------------------------
const cameraHookPath = path.join(srcDir, 'hooks', 'useScrollCamera.ts');
let cameraHookCode = fs.readFileSync(cameraHookPath, 'utf8');
cameraHookCode = cameraHookCode.replace(
  /export const useScrollCamera = \(scrollProgress: number\) => \{/,
  `import { MathUtils } from 'three';\n\nexport const useScrollCamera = (scrollProgress: number) => {`
);
cameraHookCode = cameraHookCode.replace(
  /useFrame\(\(state\) => \{/,
  `// Derive FOV
  useEffect(() => {
    const fov = MathUtils.mapLinear(Math.min(size.width, 1280), 375, 1280, 68, 45);
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width]);\n\n  useFrame((state) => {`
);
fs.writeFileSync(cameraHookPath, cameraHookCode);

replaceInFile('components/three/Book.tsx',
  /export const Book = \(\) => \{/g,
  `import { MathUtils } from 'three';\nimport { useThree } from '@react-three/fiber';\n\nexport const Book = () => {\n  const { size } = useThree();\n  const scale = MathUtils.mapLinear(Math.min(size.width, 768), 375, 768, 0.65, 1.0);\n`
);
replaceInFile('components/three/Book.tsx',
  /<group ref=\{groupRef\}>/g,
  `<group ref={groupRef} scale={[scale, scale, scale]}>`
);

// -----------------------------------------------------
// FIX 9: Navbar Lenis Scroll
// -----------------------------------------------------
replaceInFile('components/layout/Navbar.tsx',
  /import \{ Button \} from '\.\.\/ui\/Button';/g,
  `import { Button } from '../ui/Button';\nimport { useLenisContext } from '../../context/LenisContext';`
);
replaceInFile('components/layout/Navbar.tsx',
  /const Navbar = \(\) => \{/g,
  `const Navbar = () => {\n  const lenisRef = useLenisContext();\n\n  const scrollTo = (target: string) => {\n    lenisRef?.current?.scrollTo(target, {\n      offset: -80,\n      duration: 1.2,\n      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),\n    });\n  };\n`
);
replaceInFile('components/layout/Navbar.tsx',
  /onClick=\{\(e\) => \{ e\.preventDefault\(\); const target = document\.querySelector\(\`#\$\{link\.toLowerCase\(\)\.replace\(\/ \/g, '-'\)\}\`\); if\(target\) \{ target\.scrollIntoView\(\{ behavior: 'smooth' \}\); \} \}\}/g,
  `onClick={(e) => { e.preventDefault(); scrollTo(\`#\${link.toLowerCase().replace(/ /g, '-')}\`); }}`
);
replaceInFile('components/layout/Navbar.tsx',
  /onClick=\{\(e\) => \{ e\.preventDefault\(\); setMobileOpen\(false\); const target = document\.querySelector\(\`#\$\{link\.toLowerCase\(\)\.replace\(\/ \/g, '-'\)\}\`\); if\(target\) \{ target\.scrollIntoView\(\{ behavior: 'smooth' \}\); \} \}\}/g,
  `onClick={(e) => { e.preventDefault(); setMobileOpen(false); scrollTo(\`#\${link.toLowerCase().replace(/ /g, '-')}\`); }}`
);

console.log("Successfully patched 9 files!");
