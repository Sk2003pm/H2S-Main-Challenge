import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import { BrainCircuit, Sparkles, Activity, ShieldCheck, Zap } from 'lucide-react';

/**
 * DimensionalAnalysisVisualizer
 * 
 * Specialized 3D Particle Visualizer for AI Analysis states in MindAlign.
 * Renders a dimensional particle matrix that dynamically pulses, calculates
 * sentiment vectors, and visualizes emotional harmony in true 3D space.
 */
export default function DimensionalAnalysisVisualizer({
  isAnalyzing = false,
  analysisResult = null,
  compact = false
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const [telemetryStep, setTelemetryStep] = useState(0);

  const telemetryMessages = [
    'Vectorizing cognitive reflection...',
    'Deconstructing emotional frequency...',
    'Cross-referencing exam pressure indicators...',
    'Calculating neural sentiment matrix...',
    'Synthesizing personalized coping algorithms...'
  ];

  // Rotate telemetry text while analyzing
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setTelemetryStep(prev => (prev + 1) % telemetryMessages.length);
    }, 1100);
    return () => clearInterval(interval);
  }, [isAnalyzing, telemetryMessages.length]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 400;
    const height = compact ? 180 : 260;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 240;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.borderRadius = '12px';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Circular glow texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(20, 184, 166, 0.85)');
    grad.addColorStop(0.7, 'rgba(139, 92, 246, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const particleTexture = new THREE.CanvasTexture(canvas);

    // 4. Dimensional Geometries (Torus / Sphere Cloud)
    const PARTICLE_COUNT = compact ? 450 : 800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const origins = new Float32Array(PARTICLE_COUNT * 3);
    const frequencies = new Float32Array(PARTICLE_COUNT);

    const moodScore = analysisResult?.mood_score ?? 60;
    let baseColorA = new THREE.Color(moodScore >= 70 ? '#14b8a6' : moodScore >= 45 ? '#f59e0b' : '#ef4444');
    let baseColorB = new THREE.Color(moodScore >= 70 ? '#06b6d4' : moodScore >= 45 ? '#8b5cf6' : '#ec4899');

    // Distribute particles in 3D Torus Knot
    const p = 2;
    const q = 3;
    const R = compact ? 55 : 75;
    const r = compact ? 22 : 32;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const u = (i / PARTICLE_COUNT) * Math.PI * 2 * p;
      const v = Math.random() * Math.PI * 2;

      // Torus knot formula with radial fuzz
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const quOverP = (q / p) * u;
      const r_mod = R + r * Math.cos(quOverP) + (Math.random() - 0.5) * 12;

      const x = r_mod * cu;
      const y = r_mod * su;
      const z = -r * Math.sin(quOverP) + (Math.random() - 0.5) * 12;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      origins[i3] = x;
      origins[i3 + 1] = y;
      origins[i3 + 2] = z;

      frequencies[i] = 1.0 + Math.random() * 2.5;

      const colorMix = (Math.sin(u * 2) + 1) * 0.5;
      const c = new THREE.Color().lerpColors(baseColorA, baseColorB, colorMix);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: compact ? 12 : 16,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);

    // Inner glowing core orb
    const coreGeo = new THREE.SphereGeometry(compact ? 14 : 22, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: moodScore >= 70 ? 0x14b8a6 : 0x8b5cf6,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Interactive mouse rotation tracking
    let targetRotY = 0;
    let targetRotX = 0;
    const handleMove = (e) => {
      const rect = mount.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = nx * 0.8;
      targetRotX = ny * 0.8;
    };
    mount.addEventListener('mousemove', handleMove, { passive: true });

    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      if (document.hidden) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth rotation
      particleSystem.rotation.y += (targetRotY + 0.35 * elapsed - particleSystem.rotation.y) * 0.05;
      particleSystem.rotation.x += (targetRotX + Math.sin(elapsed * 0.5) * 0.2 - particleSystem.rotation.x) * 0.05;

      coreMesh.rotation.y -= 0.02;
      coreMesh.rotation.z += 0.015;

      const pArr = geometry.attributes.position.array;
      const analyzingFactor = isAnalyzing ? 3.0 : 1.0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const ox = origins[i3];
        const oy = origins[i3 + 1];
        const oz = origins[i3 + 2];
        const freq = frequencies[i];

        if (isAnalyzing) {
          // Rapid quantum pulse during analysis
          const pulse = Math.sin(elapsed * 6 * freq) * 16;
          pArr[i3] = ox + (ox / R) * pulse;
          pArr[i3 + 1] = oy + (oy / R) * pulse;
          pArr[i3 + 2] = oz + (oz / r) * pulse;
        } else {
          // Harmonious breathing undulation
          const breathe = Math.sin(elapsed * 1.5 + freq) * 4;
          pArr[i3] = ox + breathe;
          pArr[i3 + 1] = oy + breathe;
          pArr[i3 + 2] = oz + breathe;
        }
      }
      geometry.attributes.position.needsUpdate = true;

      // Scale pulse for core
      const coreScale = 1.0 + Math.sin(elapsed * (isAnalyzing ? 8 : 2)) * 0.12;
      coreMesh.scale.set(coreScale, coreScale, coreScale);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const newW = mountRef.current.clientWidth || 400;
      const newH = compact ? 180 : 260;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      mount.removeEventListener('mousemove', handleMove);
      window.removeEventListener('resize', handleResize);

      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [isAnalyzing, analysisResult, compact]);

  return (
    <div 
      className="dimensional-visualizer-card glass-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: compact ? '0.75rem' : '1.25rem',
        border: isAnalyzing ? '1px solid var(--accent-teal)' : '1px solid rgba(255, 255, 255, 0.1)',
        background: 'linear-gradient(145deg, rgba(19, 26, 48, 0.85) 0%, rgba(10, 15, 29, 0.95) 100%)',
        boxShadow: isAnalyzing 
          ? '0 0 30px rgba(20, 184, 166, 0.25), inset 0 0 20px rgba(20, 184, 166, 0.1)' 
          : '0 8px 32px rgba(0, 0, 0, 0.35)',
        transition: 'all 0.4s ease'
      }}
      aria-label="3D Dimensional Analysis Engine"
    >
      {/* Header bar */}
      <div className="flex-between" style={{ alignItems: 'center', marginBottom: '0.5rem', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BrainCircuit size={18} className={isAnalyzing ? 'text-teal animate-spin' : 'text-violet'} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-title)', letterSpacing: '0.02em' }}>
            {isAnalyzing ? 'Dimensional Particle Analyzer' : 'Quantum Emotion Matrix (3D)'}
          </span>
        </div>
        <span 
          className="badge" 
          style={{
            fontSize: '0.68rem',
            padding: '0.2rem 0.6rem',
            background: isAnalyzing ? 'rgba(20, 184, 166, 0.2)' : 'rgba(139, 92, 246, 0.2)',
            color: isAnalyzing ? 'var(--accent-teal)' : '#a78bfa',
            border: isAnalyzing ? '1px solid var(--accent-teal)' : '1px solid rgba(139, 92, 246, 0.4)'
          }}
        >
          {isAnalyzing ? 'Processing 3D Vectors...' : analysisResult ? `Aura Score: ${analysisResult.mood_score}/100` : 'Interactive 3D'}
        </span>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div 
        ref={mountRef} 
        style={{
          width: '100%',
          height: compact ? '180px' : '260px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      />

      {/* Live Telemetry Overlay during AI Analysis */}
      {isAnalyzing && (
        <div 
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            right: '1rem',
            background: 'rgba(10, 15, 29, 0.85)',
            backdropFilter: 'blur(10px)',
            borderRadius: '8px',
            padding: '0.6rem 0.85rem',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 3,
            animation: 'fade-in 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span 
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-teal)',
                boxShadow: '0 0 6px var(--accent-teal)',
                animation: 'pulse-glow 1s infinite'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {telemetryMessages[telemetryStep]}
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', fontWeight: 600 }}>
            AI Sentiment Analysis
          </span>
        </div>
      )}

      {/* Interactive Helper Hint */}
      {!isAnalyzing && (
        <div style={{ textAlign: 'center', marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          ✨ Drag or hover mouse over 3D particle torus to inspect emotional coordinates
        </div>
      )}
    </div>
  );
}

DimensionalAnalysisVisualizer.propTypes = {
  isAnalyzing: PropTypes.bool,
  analysisResult: PropTypes.shape({
    mood_score: PropTypes.number,
    primary_emotions: PropTypes.arrayOf(PropTypes.string),
    triggers: PropTypes.arrayOf(PropTypes.string)
  }),
  compact: PropTypes.bool
};
