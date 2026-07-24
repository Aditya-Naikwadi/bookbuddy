import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

export function useLenis(containerRef?: React.RefObject<HTMLElement>) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Scope Lenis to a container div, NOT window, if ref provided.
    // This is the key change — dashboard scroll areas are completely unaffected.
    const lenis = new Lenis({
      // We rely on default window/document scroll
      lerp: 0.1,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      // CRITICAL: destroy on unmount — prevents dashboard scroll poisoning
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [containerRef]);

  // Return ref so Navbar / sections can call lenisRef.current?.scrollTo()
  return lenisRef;
}
