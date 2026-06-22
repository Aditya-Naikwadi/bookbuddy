const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// 1. Remove Lenis from main.jsx
const mainPath = path.join(srcDir, 'main.jsx');
let mainCode = fs.readFileSync(mainPath, 'utf8');
mainCode = mainCode.replace(/import Lenis from '@studio-freight\/lenis'\n/g, '');
mainCode = mainCode.replace(/const lenis = new Lenis\(\{ lerp: 0\.1, smoothWheel: true \}\);\nlenis\.on\('scroll', ScrollTrigger\.update\);\ngsap\.ticker\.add\(\(time\) => lenis\.raf\(time \* 1000\)\);\ngsap\.ticker\.lagSmoothing\(0\);\n/g, '');
fs.writeFileSync(mainPath, mainCode);

// 2. Add Lenis to Landing.jsx
const landingPath = path.join(srcDir, 'pages', 'public', 'Landing.jsx');
let landingCode = fs.readFileSync(landingPath, 'utf8');
const lenisHookCode = `import Lenis from '@studio-freight/lenis';
import { gsap, ScrollTrigger } from '../../utils/gsap';

const Landing = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Initialize Lenis locally for Landing page only
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
    };
  }, []);`;
landingCode = landingCode.replace(/const Landing = \(\) => \{\n  useEffect\(\(\) => \{\n    window\.scrollTo\(0, 0\);\n  \}, \[\]\);/g, lenisHookCode);
fs.writeFileSync(landingPath, landingCode);

// 3. Fix Features.tsx scroll listener
const featuresPath = path.join(srcDir, 'sections', 'Features.tsx');
let featuresCode = fs.readFileSync(featuresPath, 'utf8');
featuresCode = featuresCode.replace(
  /const handleScroll = \(\) => \{[\s\S]*?window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\);\n    return \(\) => window\.removeEventListener\('scroll', handleScroll\);\n  \}, \[activeIndex\]\);/g,
  `// Use Intersection Observer for scroll tracking
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
          setActiveIndex(index);
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px' });

    const cards = document.querySelectorAll('.feature-card-item');
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);`
);
featuresCode = featuresCode.replace(/<div key=\{i\} className="feature-card-item">/g, '<div key={i} className="feature-card-item" data-index={i}>');
fs.writeFileSync(featuresPath, featuresCode);

// 4. Memory Management in BookPages.tsx and Book.tsx
const bookPagesPath = path.join(srcDir, 'components', 'three', 'BookPages.tsx');
let bookPagesCode = fs.readFileSync(bookPagesPath, 'utf8');
bookPagesCode = bookPagesCode.replace(/<mesh/g, '<mesh dispose={null}');
bookPagesCode = bookPagesCode.replace(/<planeGeometry/g, '<planeGeometry dispose={null}');
bookPagesCode = bookPagesCode.replace(/<meshStandardMaterial/g, '<meshStandardMaterial dispose={null}');
fs.writeFileSync(bookPagesPath, bookPagesCode);

const bookPath = path.join(srcDir, 'components', 'three', 'Book.tsx');
let bookCode = fs.readFileSync(bookPath, 'utf8');
bookCode = bookCode.replace(/<mesh/g, '<mesh dispose={null}');
bookCode = bookCode.replace(/<boxGeometry/g, '<boxGeometry dispose={null}');
bookCode = bookCode.replace(/<meshStandardMaterial/g, '<meshStandardMaterial dispose={null}');
fs.writeFileSync(bookPath, bookCode);

// 5. Fix EResources Canvas Memory
const eResourcesPath = path.join(srcDir, 'sections', 'EResources.tsx');
const eResourcesReplacement = `import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { FeatureBook } from '../components/three/FeatureBook';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';

export const EResources = () => {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { threshold: 0.1 });
    
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="e-books" className="bg-deep py-24 md:py-32 xl:py-40 border-y border-edge" ref={containerRef}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 xl:px-24 flex flex-col md:flex-row items-center gap-12">
        <div className="w-full md:w-1/2">
          <SectionLabel>70,000+ FREE BOOKS</SectionLabel>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-6">
            Read anything. Anywhere.<br/>No subscription needed.
          </h2>
          <p className="text-muted leading-relaxed text-lg mb-8">
            Powered by Project Gutenberg's public-domain catalog, filtered, searched, and read entirely inside BookBuddy — with your reading progress always saved.
          </p>
          <ul className="space-y-4 mb-8 text-ink font-medium">
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Full in-app PDF & EPUB reader</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Pick up where you left off</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Download for offline reading</li>
            <li className="flex items-center gap-3"><span className="text-success">✓</span> Search by language, genre, author</li>
          </ul>
          <Button variant="secondary" size="lg">Browse the Library →</Button>
        </div>
        <div className="w-full md:w-1/2 h-[500px]">
          {inView && (
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }} frameloop="demand">
              <ambientLight intensity={0.5} />
              <directionalLight position={[2, 5, 2]} intensity={1} />
              <group rotation={[Math.PI / 8, -Math.PI / 6, 0]}>
                {[0, 1, 2, 3, 4].map(i => <FeatureBook key={i} index={i} />)}
              </group>
            </Canvas>
          )}
        </div>
      </div>
    </section>
  );
}`;
fs.writeFileSync(eResourcesPath, eResourcesReplacement);

// 6. Navbar Smooth Scrolling
const navbarPath = path.join(srcDir, 'components', 'layout', 'Navbar.tsx');
let navbarCode = fs.readFileSync(navbarPath, 'utf8');
navbarCode = navbarCode.replace(/href=\{\`#\$\{(.*?)\}\`\} className/g, `href={\`#\${$1}\`} onClick={(e) => { e.preventDefault(); const target = document.querySelector(\`#\${$1}\`); if(target) { target.scrollIntoView({ behavior: 'smooth' }); } }} className`);
navbarCode = navbarCode.replace(/onClick=\{\(\) => setMobileOpen\(false\)\} className="text-ink hover:text-ember"/g, `onClick={(e) => { e.preventDefault(); setMobileOpen(false); const target = document.querySelector(\`#\${link.toLowerCase().replace(/ /g, '-')}\`); if(target) { target.scrollIntoView({ behavior: 'smooth' }); } }} className="text-ink hover:text-ember"`);
fs.writeFileSync(navbarPath, navbarCode);

console.log("Fixes applied successfully.");
