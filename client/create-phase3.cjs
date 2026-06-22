const fs = require('fs');
const path = require('path');

const threeDir = path.join(__dirname, 'src', 'components', 'three');
fs.mkdirSync(threeDir, { recursive: true });

fs.writeFileSync(path.join(threeDir, 'useScrollCamera.ts'), `
import { useThree, useFrame } from '@react-three/fiber';
import { useScrollProgress } from '../../hooks/useScrollProgress';
import * as THREE from 'three';

export function useScrollCamera(isMobile: boolean) {
  const { camera } = useThree();
  const progress = useScrollProgress();
  
  const baseFov = isMobile ? 65 : 45;
  useFrame(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = baseFov;
      const heroProgress = Math.min(progress / 0.2, 1);
      camera.position.z = THREE.MathUtils.lerp(10, 9.5, heroProgress);
      camera.updateProjectionMatrix();
    }
  });
}
`);

fs.writeFileSync(path.join(threeDir, 'EmberParticles.tsx'), `
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const EmberParticles: React.FC<{ count: number }> = ({ count }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const reducedMotion = useReducedMotion();

  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 5;
      pos[i * 3] = r * Math.cos(theta);
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = r * Math.sin(theta);
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, ph];
  }, [count]);

  useFrame((state) => {
    if (reducedMotion || !pointsRef.current) return;
    const time = state.clock.elapsedTime * 0.5;
    pointsRef.current.rotation.y = time;
  });

  if (reducedMotion) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#D97706"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};
`);

fs.writeFileSync(path.join(threeDir, 'FloatingOrbs.tsx'), `
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const FloatingOrbs = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 6;
  const reducedMotion = useReducedMotion();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, -10 - Math.random() * 10);
      dummy.scale.setScalar(2 + Math.random() * 3);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, new THREE.Color(i % 2 === 0 ? '#4F46E5' : '#D97706'));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [count, dummy]);

  useFrame((state) => {
    if (reducedMotion || !meshRef.current) return;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.2) * 1;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial transparent opacity={0.05} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  );
};
`);

fs.writeFileSync(path.join(threeDir, 'BookPages.tsx'), `
import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createCurvedPlane } from '../../utils/three-utils';

export const BookPages = ({ isLeft, progress }: { isLeft: boolean; progress: number }) => {
  const canvasRef = useRef(document.createElement('canvas'));
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  const geometry = useMemo(() => {
    return createCurvedPlane(2.2, 3.0, 20, 20, isLeft ? -0.2 : 0.2);
  }, [isLeft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#F5EDD8';
    ctx.fillRect(0, 0, 512, 1024);
    
    ctx.fillStyle = '#1E2640';
    ctx.font = 'bold 36px "Plus Jakarta Sans"';
    
    if (isLeft) {
      ctx.fillText("Currently Borrowing", 40, 80);
      const linesCount = Math.floor(progress * 5); 
      for(let i=0; i<linesCount; i++) {
        ctx.fillRect(40, 140 + i*60, 200, 20);
      }
    } else {
      ctx.fillText("Your Streak", 40, 80);
      const cardsCount = Math.floor(progress * 4);
      for(let i=0; i<cardsCount; i++) {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(40 + (i%2)*200, 140 + Math.floor(i/2)*200, 160, 160, 16);
        ctx.fill();
      }
    }
    
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }, [progress, isLeft]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
    return tex;
  }, []);

  return (
    <mesh geometry={geometry} position={[isLeft ? -1.12 : 1.12, 0, 0.08]}>
      <meshStandardMaterial map={texture} roughness={0.8} />
    </mesh>
  );
}
`);

fs.writeFileSync(path.join(threeDir, 'Book.tsx'), `
import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { BookPages } from './BookPages';

export const Book = ({ scrollProgress }: { scrollProgress: number }) => {
  const groupRef = useRef<THREE.Group>(null);

  const coverTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#141929'; 
      ctx.fillRect(0, 0, 512, 1024);
      ctx.fillStyle = '#4F46E5'; 
      ctx.fillRect(20, 20, 472, 984);
      ctx.fillStyle = '#D97706'; 
      ctx.font = 'bold 120px "DM Serif Display"';
      ctx.fillText('BB', 180, 500);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  const materials = useMemo(() => {
    const coverMat = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.6 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#F5EDD8', roughness: 0.9 });
    return [edgeMat, edgeMat, edgeMat, edgeMat, coverMat, coverMat];
  }, [coverTexture]);

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.05]} material={materials}>
        <boxGeometry args={[4.8, 3.2, 0.18]} />
      </mesh>
      
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[4.4, 3.0, 0.14]} />
        <meshStandardMaterial color="#F5EDD8" roughness={0.9} />
      </mesh>

      <BookPages isLeft={true} progress={scrollProgress} />
      <BookPages isLeft={false} progress={scrollProgress} />

      <mesh position={[0, 0, -0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 3.2, 16]} />
        <meshStandardMaterial color="#4F46E5" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}
`);

fs.writeFileSync(path.join(threeDir, 'FeatureBook.tsx'), `
import React, { useRef, useState } from 'react';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export const FeatureBook = ({ index }: { index: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();

  const { rotationY } = useSpring({
    rotationY: hovered && !reducedMotion ? -Math.PI / 6 : 0,
    config: { mass: 1, tension: 170, friction: 26 }
  });

  const color = index % 2 === 0 ? '#4F46E5' : '#141929';
  
  return (
    <animated.group 
      position={[0, index * 0.15, 0]} 
      rotation-y={rotationY}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={meshRef}>
        <boxGeometry args={[2.4, 3.2, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </animated.group>
  );
}
`);

fs.writeFileSync(path.join(threeDir, 'Scene.tsx'), `
import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Book } from './Book';
import { EmberParticles } from './EmberParticles';
import { FloatingOrbs } from './FloatingOrbs';
import { useScrollCamera } from './useScrollCamera';

const SceneContent = ({ isMobile, scrollProgress }: { isMobile: boolean, scrollProgress: number }) => {
  useScrollCamera(isMobile);
  const reducedMotion = useReducedMotion();

  return (
    <>
      <ambientLight intensity={0.4} color="#4F46E5" />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <pointLight position={[-3, 2, 2]} intensity={0.8} color="#D97706" />

      <Book scrollProgress={scrollProgress} />
      <EmberParticles count={isMobile ? 80 : 200} />
      <FloatingOrbs />

      <OrbitControls 
        enableZoom={false} 
        enablePan={false} 
        autoRotate={!reducedMotion} 
        autoRotateSpeed={0.4} 
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} height={300} opacity={0.4} />
      </EffectComposer>
    </>
  );
};

export const Scene = ({ scrollProgress }: { scrollProgress: number }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Canvas 
      dpr={isMobile ? [1, 1.5] : [1, 2]} 
      camera={{ position: [0, 0, 10], fov: isMobile ? 65 : 45 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <SceneContent isMobile={isMobile} scrollProgress={scrollProgress} />
      </Suspense>
    </Canvas>
  );
}
`);

console.log('Phase 3 files generated successfully.');
