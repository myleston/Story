// 第一级动态：不拆人物，只靠镜头、光和粒子让一张静态插画"活"起来。
// 所有坐标都以原图（1536×1024）为准，放在镜头层里，跟着推镜一起缩放。

import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const IMG_W = 1536;
const IMG_H = 1024;
// 1920 宽铺满，原图等比放大后高 1280，上下各裁一点
const BASE = 1920 / IMG_W;
// 推镜：从顶部对齐的全景，推到手里的那片橘皮和嘴
const START = { x: IMG_W / 2, y: 432 };
const FOCUS = { x: 800, y: 360 };

// 灯：位置、大小、颜色、闪烁速度
const LIGHTS = [
  { x: 28, y: 40, r: 70, color: '255,120,90', speed: 0.9 },
  { x: 205, y: 92, r: 80, color: '255,120,90', speed: 1.1 },
  { x: 380, y: 112, r: 80, color: '255,120,90', speed: 0.8 },
  { x: 545, y: 95, r: 80, color: '255,120,90', speed: 1.3 },
  { x: 702, y: 40, r: 70, color: '255,120,90', speed: 1.0 },
  { x: 1490, y: 100, r: 150, color: '255,140,100', speed: 0.7 },
  { x: 115, y: 650, r: 260, color: '255,200,130', speed: 0.5 },
];

// 平滑的伪随机闪烁：几个不同频率的正弦叠加
const flicker = (frame: number, seed: number, speed: number) => {
  const t = frame / 30;
  const p = random(`flicker-${seed}`) * 100;
  return 0.5 * Math.sin(t * 2.1 * speed + p) + 0.3 * Math.sin(t * 5.3 * speed + p * 1.7) + 0.2 * Math.sin(t * 11.7 * speed + p * 2.3);
};

const Glow: React.FC<{ light: (typeof LIGHTS)[number]; index: number }> = ({ light, index }) => {
  const frame = useCurrentFrame();
  const f = flicker(frame, index, light.speed);
  const r = light.r * (1 + 0.06 * f);
  return (
    <div
      style={{
        position: 'absolute',
        left: light.x - r,
        top: light.y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${light.color},${0.55 + 0.2 * f}) 0%, rgba(${light.color},0.18) 40%, rgba(${light.color},0) 70%)`,
        mixBlendMode: 'screen',
      }}
    />
  );
};

// 灯旁边一闪一闪的金色网点
const Sparkles: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = [];
  for (let i = 0; i < 90; i++) {
    const light = LIGHTS[i % LIGHTS.length];
    const a = random(`sa-${i}`) * Math.PI * 2;
    const d = light.r * (0.4 + random(`sd-${i}`) * 1.1);
    const phase = random(`sp-${i}`) * Math.PI * 2;
    const on = Math.max(0, Math.sin(frame / 9 + phase));
    dots.push(
      <circle key={i} cx={light.x + Math.cos(a) * d} cy={light.y + Math.sin(a) * d} r={1.2 + 1.8 * on} fill="#ffd98a" opacity={on * 0.9} />,
    );
  }
  return (
    <svg width={IMG_W} height={IMG_H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
      {dots}
    </svg>
  );
};

// 樱花瓣：三层景深，近的大、快、虚
const Petals: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layers = [
    { n: 26, size: 10, speed: 1.2, blur: 0, opacity: 0.75 },
    { n: 16, size: 18, speed: 2.0, blur: 0.6, opacity: 0.9 },
    { n: 7, size: 38, speed: 3.6, blur: 3.5, opacity: 0.85 },
  ];
  return (
    <AbsoluteFill>
      {layers.map((layer, li) =>
        Array.from({ length: layer.n }, (_, i) => {
          const key = `${li}-${i}`;
          const x0 = random(`px-${key}`) * (width + 400) - 100;
          const y0 = random(`py-${key}`) * height;
          const drift = -0.8 * layer.speed; // 风从右往左
          const y = ((y0 + frame * layer.speed * (0.7 + random(`ps-${key}`) * 0.6)) % (height + 120)) - 60;
          const x = x0 + frame * drift + Math.sin(frame / 22 + random(`pw-${key}`) * 6) * 30;
          const rot = frame * (1 + random(`pr-${key}`) * 3) + random(`pa-${key}`) * 360;
          const flip = Math.cos(frame / 14 + random(`pf-${key}`) * 6);
          return (
            <svg
              key={key}
              width={layer.size * 2}
              height={layer.size * 2}
              viewBox="-10 -10 20 20"
              style={{
                position: 'absolute',
                left: ((x % (width + 200)) + width + 200) % (width + 200) - 100,
                top: y,
                transform: `rotate(${rot}deg) scaleX(${flip})`,
                filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
                opacity: layer.opacity,
              }}
            >
              <path d="M 0,-8 C 6,-6 7,2 0,8 C -7,2 -6,-6 0,-8 Z M 0,-8 L -1.5,-5 L 1.5,-5 Z" fill="#f4b3c2" stroke="#e07f97" strokeWidth={0.8} />
            </svg>
          );
        }),
      )}
    </AbsoluteFill>
  );
};

// 胶片颗粒：每两帧换一次噪声种子
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ mixBlendMode: 'overlay', opacity: 0.22 }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(frame / 2)} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const PeelScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 推镜：从全景慢慢推到手和嘴
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.22], { easing: Easing.inOut(Easing.cubic) });
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.cubic) });
  const focusX = interpolate(progress, [0, 1], [START.x, FOCUS.x]);
  const focusY = interpolate(progress, [0, 1], [START.y, FOCUS.y]);
  const scale = BASE * zoom;
  const tx = 960 - focusX * scale;
  const ty = 540 - focusY * scale;
  // 镜头轻微的手持感
  const shakeX = Math.sin(frame / 37) * 2 + Math.sin(frame / 13) * 0.8;
  const shakeY = Math.cos(frame / 41) * 1.6;

  const fadeIn = interpolate(frame, [0, 20], [1, 0], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [0, 1], { extrapolateLeft: 'clamp' });
  const leak = interpolate(Math.sin(frame / 50), [-1, 1], [0.05, 0.22]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          width: IMG_W,
          height: IMG_H,
          transformOrigin: '0 0',
          transform: `translate(${tx + shakeX}px, ${ty + shakeY}px) scale(${scale})`,
        }}
      >
        <Img src={staticFile('peel.webp')} style={{ width: IMG_W, height: IMG_H, display: 'block' }} />
        {LIGHTS.map((light, i) => (
          <Glow key={i} light={light} index={i} />
        ))}
        <Sparkles />
      </div>

      {/* 暖色漏光，从左边的台灯方向缓缓起伏 */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 0% 70%, rgba(255,170,90,1) 0%, rgba(255,120,60,0.35) 30%, rgba(0,0,0,0) 60%)',
          mixBlendMode: 'screen',
          opacity: leak,
        }}
      />
      <Petals />
      <Grain />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
      <AbsoluteFill style={{ backgroundColor: '#000', opacity: Math.max(fadeIn, fadeOut) }} />
    </AbsoluteFill>
  );
};
