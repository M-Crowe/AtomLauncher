import React, { useEffect, useRef } from 'react';

interface PixelAvatarProps {
  skinUrl?: string;
  size?: number;
  className?: string;
}

export const PixelAvatar: React.FC<PixelAvatarProps> = ({ skinUrl, size = 36, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    if (skinUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.clearRect(0, 0, size, size);
        // Draw head base (8,8, 8,8)
        ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
        // Draw hat/helmet layer (40,8, 8,8)
        ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
      };
      img.onerror = () => {
        drawFallbackSteve(ctx, size);
      };
      img.src = skinUrl;
    } else {
      drawFallbackSteve(ctx, size);
    }
  }, [skinUrl, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      className={`shrink-0 border-2 border-border-hard bg-dirt-80 rounded-none shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] ${className}`}
    />
  );
};

// 8x8 Classic Steve Pixel Face Colors
function drawFallbackSteve(ctx: CanvasRenderingContext2D, size: number) {
  const pixelSize = size / 8;
  const H = '#49301e'; // Hair / Beard Dark Brown
  const S = '#b58362'; // Skin Tan
  const E = '#ffffff'; // Eye White
  const P = '#2c3588'; // Eye Pupil Indigo
  const M = '#6d3c26'; // Mouth / Nose Shade
  const L = '#996345'; // Skin Darker Shadow

  const steveGrid: string[][] = [
    [H, H, H, H, H, H, H, H],
    [H, H, H, H, H, H, H, H],
    [H, H, S, S, S, S, H, H],
    [S, S, S, S, S, S, S, S],
    [S, E, P, S, S, E, P, S],
    [S, S, S, L, L, S, S, S],
    [S, S, M, M, M, M, S, S],
    [H, H, M, M, M, M, H, H],
  ];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = steveGrid[r][c];
      ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
    }
  }
}
