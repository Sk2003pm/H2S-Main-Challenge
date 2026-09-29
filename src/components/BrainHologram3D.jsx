import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';

/**
 * BrainHologram3D
 * 
 * An interactive, multi-chromatic 3D Holographic Brain built with Three.js.
 * Features dual cerebral hemispheres, cortical sulci/gyri undulations,
 * pulsing neural synapses, axon connection filaments, and electrical action potentials.
 */
export default function BrainHologram3D({
  activeFocus = 'general', // 'username' | 'password' | 'signup' | 'general'
  isSubmitting = false,
  width = 440,
  height = 420
}) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const reqIdRef = useRef(null);
  const stateRef = useRef({
    activeFocus,
    isSubmitting,
    targetMouseX: 0,
    targetMouseY: 0,
    mouseX: 0,
    mouseY: 0
  });

  useEffect(() => {
    stateRef.current.activeFocus = activeFocus;
    stateRef.current.isSubmitting = isSubmitting;
  }, [activeFocus, isSubmitting]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const actualWidth = mount.clientWidth || width;
    const actualHeight = mount.clientHeight || height;

    // 1. Three.js Scene & Perspective Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, actualWidth / actualHeight, 0.1, 1500);
    camera.position.set(0, 15, 270);

    // 2. WebGL Renderer with antialiasing and alpha
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(actualWidth, actualHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'grab';
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Brain Group that holds both hemispheres, synapses, and glow core
    const brainGroup = new THREE.Group();
    scene.add(brainGroup);

    // 3. Generate Realistic 3D Dual-Hemisphere Brain Point Cloud
    const BRAIN_PARTICLE_COUNT = 1850;
    const positions = new Float32Array(BRAIN_PARTICLE_COUNT * 3);
    const origins = new Float32Array(BRAIN_PARTICLE_COUNT * 3);
    const colors = new Float32Array(BRAIN_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(BRAIN_PARTICLE_COUNT);
    const phases = new Float32Array(BRAIN_PARTICLE_COUNT);

    // Multi-chromatic Colorful Neural Palettes
    const colorCyan = new THREE.Color('#00f5d4');    // Frontal (logic & focus)
    const colorMagenta = new THREE.Color('#f72585'); // Parietal / Limbic (emotion)
    const colorPurple = new THREE.Color('#7209b7');  // Cortex
    const colorGold = new THREE.Color('#ffb703');    // Temporal (memory)
    const colorEmerald = new THREE.Color('#10b981'); // Cerebellum (balance)
    const colorBlue = new THREE.Color('#4361ee');

    let pIdx = 0;
    while (pIdx < BRAIN_PARTICLE_COUNT) {
      // Hemisphere: -1 for Left, +1 for Right
      const hemi = Math.random() > 0.5 ? 1 : -1;

      // Parametric coordinates over hemisphere
      const u = Math.random() * Math.PI; // longitude
      const v = (Math.random() - 0.5) * Math.PI; // latitude

      // Base dimensions of human brain (proportional mm scaled to 3D scene)
      const rx = 52;
      const ry = 48;
      const rz = 68;

      // Base ellipsoid point
      let x = rx * Math.cos(v) * Math.sin(u) * hemi;
      let y = ry * Math.sin(v);
      let z = rz * Math.cos(v) * Math.cos(u);

      // Sulcal folds & cortical gyri mathematical undulations
      const gyrus1 = Math.sin(x * 0.16) * Math.cos(y * 0.18 + z * 0.12) * 5.5;
      const gyrus2 = Math.sin(y * 0.22 + x * 0.14) * Math.cos(z * 0.18) * 3.5;
      const radialMod = 1.0 + (gyrus1 + gyrus2) / 45.0;

      x *= radialMod;
      y *= radialMod;
      z *= radialMod;

      // Longitudinal fissure: gap between hemispheres
      const fissureGap = 4.5;
      x += hemi * fissureGap;

      // Ventral flattening (bottom of the brain is flatter)
      if (y < -15) {
        y *= 0.85;
      }

      // Temporal lobe lateral bulge
      if (y > -25 && y < 5 && z > -15 && z < 25) {
        x *= 1.12;
      }

      // Cerebellum posterior inferior lobes
      if (Math.random() < 0.18) {
        // Spawn inside cerebellum region
        const cu = Math.random() * Math.PI * 2;
        const cv = Math.random() * Math.PI;
        const crad = 18 + Math.random() * 8;
        x = hemi * (18 + crad * Math.sin(cv) * Math.cos(cu) * 0.7);
        y = -28 + crad * Math.cos(cv) * 0.6;
        z = -36 + crad * Math.sin(cv) * Math.sin(cu) * 0.7;
      }

      const i3 = pIdx * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      origins[i3] = x;
      origins[i3 + 1] = y;
      origins[i3 + 2] = z;

      phases[pIdx] = Math.random() * Math.PI * 2;
      sizes[pIdx] = 6.0 + Math.random() * 8.0;

      // Colorful Functional Lobe Mapping
      const pColor = new THREE.Color();
      if (y < -20 && z < -20) {
        // Cerebellum: Emerald to Cyan
        pColor.lerpColors(colorEmerald, colorCyan, Math.random());
      } else if (z > 25) {
        // Frontal Lobe: Vibrant Cyan & Electric Blue
        pColor.lerpColors(colorCyan, colorBlue, Math.random());
      } else if (z < -20) {
        // Occipital Lobe: Sunset Magenta & Pink
        pColor.lerpColors(colorMagenta, colorPurple, Math.random());
      } else if (y < 0 && Math.abs(x) > 28) {
        // Temporal Lobe: Solar Gold & Amber
        pColor.lerpColors(colorGold, colorMagenta, Math.random());
      } else {
        // Parietal Cortex & Central Sulcus: Neon Violet & Lavender
        pColor.lerpColors(colorPurple, colorMagenta, Math.random());
      }

      colors[i3] = pColor.r;
      colors[i3 + 1] = pColor.g;
      colors[i3 + 2] = pColor.b;

      pIdx++;
    }

    const brainGeometry = new THREE.BufferGeometry();
    brainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    brainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Glow dot sprite
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 32;
    dotCanvas.height = 32;
    const dotCtx = dotCanvas.getContext('2d');
    const grad = dotCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(0, 245, 212, 0.9)');
    grad.addColorStop(0.7, 'rgba(181, 23, 158, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    dotCtx.fillStyle = grad;
    dotCtx.fillRect(0, 0, 32, 32);
    const brainDotTexture = new THREE.CanvasTexture(dotCanvas);

    const brainMaterial = new THREE.PointsMaterial({
      size: 7.5,
      map: brainDotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const brainPoints = new THREE.Points(brainGeometry, brainMaterial);
    brainGroup.add(brainPoints);

    // 4. Neural Synaptic Axon Filaments (Lines connecting adjacent brain nodes)
    const MAX_SYNAPSES = 520;
    const linePositions = new Float32Array(MAX_SYNAPSES * 2 * 3);
    const lineColors = new Float32Array(MAX_SYNAPSES * 2 * 3);
    let synapseCount = 0;

    for (let i = 0; i < 450; i++) {
      if (synapseCount >= MAX_SYNAPSES) break;
      const i3 = i * 3;
      for (let j = i + 1; j < i + 25 && j < 450; j++) {
        if (synapseCount >= MAX_SYNAPSES) break;
        const j3 = j * 3;
        const dx = positions[i3] - positions[j3];
        const dy = positions[i3 + 1] - positions[j3 + 1];
        const dz = positions[i3 + 2] - positions[j3 + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 220) { // close neighbors
          const sIdx = synapseCount * 6;
          linePositions[sIdx] = positions[i3];
          linePositions[sIdx + 1] = positions[i3 + 1];
          linePositions[sIdx + 2] = positions[i3 + 2];
          linePositions[sIdx + 3] = positions[j3];
          linePositions[sIdx + 4] = positions[j3 + 1];
          linePositions[sIdx + 5] = positions[j3 + 2];

          // Filament color gradient
          lineColors[sIdx] = colors[i3];
          lineColors[sIdx + 1] = colors[i3 + 1];
          lineColors[sIdx + 2] = colors[i3 + 2];
          lineColors[sIdx + 3] = colors[j3];
          lineColors[sIdx + 4] = colors[j3 + 1];
          lineColors[sIdx + 5] = colors[j3 + 2];

          synapseCount++;
        }
      }
    }

    const synapseGeometry = new THREE.BufferGeometry();
    synapseGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions.slice(0, synapseCount * 6), 3));
    synapseGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors.slice(0, synapseCount * 6), 3));

    const synapseMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const synapseLines = new THREE.LineSegments(synapseGeometry, synapseMaterial);
    brainGroup.add(synapseLines);

    // 5. Corpus Callosum & Inner Limbic Core Orb
    const coreGeo = new THREE.SphereGeometry(14, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, -2, -5);
    brainGroup.add(coreMesh);

    // 6. Holographic Orbital Quantum Rings
    const ring1Geo = new THREE.TorusGeometry(85, 1.0, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.45
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 4;
    scene.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(100, 0.9, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xf72585,
      transparent: true,
      opacity: 0.38
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 3;
    ring2.rotation.z = Math.PI / 6;
    scene.add(ring2);

    // 7. Interactive Mouse / Pointer Drag
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const handleMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.targetMouseX = ndcX * 45;
      stateRef.current.targetMouseY = ndcY * 30;

      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        brainGroup.rotation.y += dx * 0.015;
        brainGroup.rotation.x += dy * 0.015;
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const el = renderer.domElement;
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Touch support
    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const handleTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - prevMouse.x;
        const dy = e.touches[0].clientY - prevMouse.y;
        brainGroup.rotation.y += dx * 0.02;
        brainGroup.rotation.x += dy * 0.02;
        prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    const handleTouchEnd = () => { isDragging = false; };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // 8. Render Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      if (document.hidden) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const { isSubmitting: submitting, activeFocus: focus } = stateRef.current;

      // Mouse camera parallax
      stateRef.current.mouseX += (stateRef.current.targetMouseX - stateRef.current.mouseX) * 0.05;
      stateRef.current.mouseY += (stateRef.current.targetMouseY - stateRef.current.mouseY) * 0.05;
      camera.position.x = stateRef.current.mouseX;
      camera.position.y = 15 + stateRef.current.mouseY;
      camera.lookAt(0, 0, 0);

      // Auto-rotation of holographic brain
      const spinSpeed = submitting ? 4.5 : focus === 'password' ? 0.3 : 0.8;
      brainGroup.rotation.y += 0.007 * spinSpeed;

      // Orbital rings counter-rotation
      ring1.rotation.z += 0.01 * spinSpeed;
      ring1.rotation.y += 0.005 * spinSpeed;
      ring2.rotation.z -= 0.012 * spinSpeed;
      ring2.rotation.x += 0.007 * spinSpeed;

      // Pulsing Action Potential Synapses
      const pArr = brainGeometry.attributes.position.array;
      const cArr = brainGeometry.attributes.color.array;

      for (let i = 0; i < BRAIN_PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const ox = origins[i3];
        const oy = origins[i3 + 1];
        const oz = origins[i3 + 2];
        const phase = phases[i];

        // Synaptic firing wave
        const wave = Math.sin(elapsed * 3.5 + phase + (ox + oz) * 0.08);
        const pulse = (wave > 0.8) ? 2.5 : 0;

        pArr[i3] = ox + (ox / 60) * pulse;
        pArr[i3 + 1] = oy + (oy / 50) * pulse;
        pArr[i3 + 2] = oz + (oz / 70) * pulse;

        // Bright flash when neural firing
        if (wave > 0.85) {
          cArr[i3] = Math.min(1.0, colors[i3] + 0.4);
          cArr[i3 + 1] = Math.min(1.0, colors[i3 + 1] + 0.4);
          cArr[i3 + 2] = Math.min(1.0, colors[i3 + 2] + 0.4);
        } else {
          cArr[i3] = colors[i3];
          cArr[i3 + 1] = colors[i3 + 1];
          cArr[i3 + 2] = colors[i3 + 2];
        }
      }

      brainGeometry.attributes.position.needsUpdate = true;
      brainGeometry.attributes.color.needsUpdate = true;

      // Core breath
      const corePulse = 1.0 + Math.sin(elapsed * 2.5) * 0.15;
      coreMesh.scale.set(corePulse, corePulse, corePulse);

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const newW = mountRef.current.clientWidth || width;
      const newH = mountRef.current.clientHeight || height;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);

      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      brainGeometry.dispose();
      brainMaterial.dispose();
      synapseGeometry.dispose();
      synapseMaterial.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      brainDotTexture.dispose();
      renderer.dispose();
    };
  }, [width, height]);

  return (
    <div 
      ref={mountRef} 
      style={{
        width: '100%',
        height: '100%',
        minHeight: '340px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}
      aria-label="3D Interactive Brain Hologram"
    />
  );
}

BrainHologram3D.propTypes = {
  activeFocus: PropTypes.string,
  isSubmitting: PropTypes.bool,
  width: PropTypes.number,
  height: PropTypes.number
};
