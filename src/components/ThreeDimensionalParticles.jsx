import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';

/**
 * ThreeDimensionalParticles
 * 
 * High-performance 3D Neural Synapse Particle Network.
 * Strictly locked to neural topology with connected axon filaments,
 * rich multi-chromatic colors, and responsive cursor depth parallax.
 */
export default function ThreeDimensionalParticles({
  isAnalyzing = false,
  stressLevel = 50
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const particlesRef = useRef(null);
  const linesMeshRef = useRef(null);
  const reqIdRef = useRef(null);

  const stateRef = useRef({
    isAnalyzing,
    stressLevel,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
    shockwaveRadius: 0,
    shockwaveCenter: new THREE.Vector3(),
    shockwaveActive: false
  });

  useEffect(() => {
    stateRef.current.isAnalyzing = isAnalyzing;
    stateRef.current.stressLevel = stressLevel;
  }, [isAnalyzing, stressLevel]);

  // Generate glowing circular sprite texture using offscreen canvas
  const createParticleTexture = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(0, 245, 212, 0.95)');
    gradient.addColorStop(0.5, 'rgba(247, 37, 133, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera with 3D perspective
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
    camera.position.z = 850;
    cameraRef.current = camera;

    // 3. WebGL Renderer with alpha transparency and antialiasing
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Neural Particle Distribution
    const PARTICLE_COUNT = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const originPositions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);

    // Rich colourful palette: Cyan, Magenta, Purple, Gold, Emerald
    const colorCyan = new THREE.Color('#00f5d4');
    const colorMagenta = new THREE.Color('#f72585');
    const colorPurple = new THREE.Color('#7209b7');
    const colorGold = new THREE.Color('#ffb703');
    const colorBlue = new THREE.Color('#4361ee');

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // 3D Neural Web Distribution across depth
      const radius = 180 + Math.pow(Math.random(), 1.4) * 900;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2.0 * Math.random() - 1.0);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta) * 0.75;
      const z = radius * Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      originPositions[i3] = x;
      originPositions[i3 + 1] = y;
      originPositions[i3 + 2] = z;

      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 10 + Math.random() * 20;

      // Multi-chromatic neural distribution
      const pColor = new THREE.Color();
      const rand = Math.random();
      if (rand < 0.35) {
        pColor.lerpColors(colorCyan, colorBlue, Math.random());
      } else if (rand < 0.7) {
        pColor.lerpColors(colorMagenta, colorPurple, Math.random());
      } else if (rand < 0.88) {
        pColor.lerpColors(colorPurple, colorCyan, Math.random());
      } else {
        pColor.lerpColors(colorGold, colorMagenta, Math.random());
      }

      colors[i3] = pColor.r;
      colors[i3 + 1] = pColor.g;
      colors[i3 + 2] = pColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const texture = createParticleTexture();
    const material = new THREE.PointsMaterial({
      size: 20,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // 5. Dynamic Neural Synaptic Axon Lines
    const MAX_LINE_SEGMENTS = 450;
    const linePositions = new Float32Array(MAX_LINE_SEGMENTS * 2 * 3);
    const lineColors = new Float32Array(MAX_LINE_SEGMENTS * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);
    linesMeshRef.current = linesMesh;

    // 6. Interactive Cursor Tracking (smooth 3D parallax)
    const handleMouseMove = (event) => {
      const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
      const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;
      stateRef.current.targetMouseX = ndcX * 130;
      stateRef.current.targetMouseY = ndcY * 100;
    };

    const handleClick = (event) => {
      const mouseVector = new THREE.Vector3(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
        0.5
      );
      mouseVector.unproject(camera);
      const dir = mouseVector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const hitPoint = camera.position.clone().add(dir.multiplyScalar(distance));

      stateRef.current.shockwaveCenter.copy(hitPoint);
      stateRef.current.shockwaveRadius = 10;
      stateRef.current.shockwaveActive = true;
    };

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = containerRef.current.clientWidth || window.innerWidth;
      const newHeight = containerRef.current.clientHeight || window.innerHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop strictly running the Neural Network
    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      if (document.hidden) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();
      const {
        isAnalyzing: analyzing,
        targetMouseX,
        targetMouseY,
        shockwaveActive
      } = stateRef.current;

      // Mouse parallax lerp
      stateRef.current.mouseX += (targetMouseX - stateRef.current.mouseX) * 0.04;
      stateRef.current.mouseY += (targetMouseY - stateRef.current.mouseY) * 0.04;

      camera.position.x = stateRef.current.mouseX;
      camera.position.y = stateRef.current.mouseY;
      camera.lookAt(0, 0, 0);

      const activeSpeed = analyzing ? 2.8 : 1.0;
      const rotSpeed = 0.0006 * activeSpeed;

      particles.rotation.y += rotSpeed;
      particles.rotation.x = Math.sin(elapsedTime * 0.2) * 0.04;
      linesMesh.rotation.copy(particles.rotation);

      if (shockwaveActive) {
        stateRef.current.shockwaveRadius += 400 * delta;
        if (stateRef.current.shockwaveRadius > 900) {
          stateRef.current.shockwaveActive = false;
        }
      }

      const pArr = geometry.attributes.position.array;
      const cArr = geometry.attributes.color.array;
      const linePosArr = linesMesh.geometry.attributes.position.array;
      const lineColArr = linesMesh.geometry.attributes.color.array;

      let lineCount = 0;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const ox = originPositions[i3];
        const oy = originPositions[i3 + 1];
        const oz = originPositions[i3 + 2];
        const phase = phases[i];

        // 3D Neural Node Drift
        pArr[i3] = ox + Math.sin(elapsedTime * 0.5 * activeSpeed + phase) * 35;
        pArr[i3 + 1] = oy + Math.cos(elapsedTime * 0.6 * activeSpeed + phase) * 35;
        pArr[i3 + 2] = oz + Math.sin(elapsedTime * 0.4 * activeSpeed + phase) * 35;

        // Connect nearby nodes with synaptic filaments
        if (lineCount < MAX_LINE_SEGMENTS && i < 160) {
          for (let j = i + 1; j < 160; j++) {
            if (lineCount >= MAX_LINE_SEGMENTS) break;
            const j3 = j * 3;
            const dx = pArr[i3] - pArr[j3];
            const dy = pArr[i3 + 1] - pArr[j3 + 1];
            const dz = pArr[i3 + 2] - pArr[j3 + 2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < 18000) {
              const lIdx = lineCount * 6;
              linePosArr[lIdx] = pArr[i3];
              linePosArr[lIdx + 1] = pArr[i3 + 1];
              linePosArr[lIdx + 2] = pArr[i3 + 2];
              linePosArr[lIdx + 3] = pArr[j3];
              linePosArr[lIdx + 4] = pArr[j3 + 1];
              linePosArr[lIdx + 5] = pArr[j3 + 2];

              const alpha = 1.0 - Math.sqrt(distSq) / 134;
              lineColArr[lIdx] = 0.0 * alpha;
              lineColArr[lIdx + 1] = 0.96 * alpha;
              lineColArr[lIdx + 2] = 0.83 * alpha;
              lineColArr[lIdx + 3] = 0.97 * alpha;
              lineColArr[lIdx + 4] = 0.15 * alpha;
              lineColArr[lIdx + 5] = 0.52 * alpha;

              lineCount++;
            }
          }
        }

        // Active analyzing resonance
        if (analyzing) {
          cArr[i3] = 0.1 + Math.sin(elapsedTime * 4 + phase) * 0.2;
          cArr[i3 + 1] = 0.9;
          cArr[i3 + 2] = 0.8;
        }

        // Shockwave deflection
        if (shockwaveActive) {
          const swDx = pArr[i3] - stateRef.current.shockwaveCenter.x;
          const swDy = pArr[i3 + 1] - stateRef.current.shockwaveCenter.y;
          const swDz = pArr[i3 + 2] - stateRef.current.shockwaveCenter.z;
          const swDist = Math.sqrt(swDx * swDx + swDy * swDy + swDz * swDz);
          const diff = Math.abs(swDist - stateRef.current.shockwaveRadius);

          if (diff < 80) {
            const push = (1 - diff / 80) * 25;
            pArr[i3] += (swDx / (swDist || 1)) * push;
            pArr[i3 + 1] += (swDy / (swDist || 1)) * push;
            pArr[i3 + 2] += (swDz / (swDist || 1)) * push;
          }
        }
      }

      geometry.attributes.position.needsUpdate = true;
      if (analyzing) geometry.attributes.color.needsUpdate = true;

      linesMesh.geometry.setDrawRange(0, lineCount * 2);
      linesMesh.geometry.attributes.position.needsUpdate = true;
      linesMesh.geometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [createParticleTexture]);

  return (
    <div 
      ref={containerRef} 
      className="particles-3d-canvas-wrapper"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
      aria-hidden="true"
    />
  );
}

ThreeDimensionalParticles.propTypes = {
  isAnalyzing: PropTypes.bool,
  stressLevel: PropTypes.number
};
