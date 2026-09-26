import React, { useEffect, useRef } from 'react';
import { prepareWithSegments, layoutWithLines, clearCache } from '@chenglou/pretext';

// 像素单元格颜色调色板 (Minecraft 经典苦力怕迷彩)
const CREEPER_COLORS = {
  G0: '#72d846', // 高光嫩绿
  G1: '#52b336', // 经典苦力怕主绿
  G2: '#3c9622', // 暗调丛林绿
  G3: '#2a7217', // 阴影深绿
  K0: '#111e10', // 眼睛与面部纯黑
  K1: '#1c2e19', // 面部阴影色
  F0: '#1b2c17', // 爪足深色
};

// 8x8 经典苦力怕面部像素点阵 (0=G0, 1=G1, 2=G2, 3=G3, 9=K0)
const FACE_PIXELS: number[][] = [
  [0, 1, 2, 1, 0, 2, 1, 0],
  [1, 2, 1, 0, 1, 1, 2, 1],
  [2, 9, 9, 1, 0, 9, 9, 2], // 眼睛 Row 2
  [0, 9, 9, 2, 1, 9, 9, 0], // 眼睛 Row 3
  [1, 2, 1, 9, 9, 1, 0, 1], // 鼻梁 Row 4
  [0, 1, 9, 9, 9, 9, 2, 0], // 上嘴唇 Row 5
  [2, 9, 9, 9, 9, 9, 9, 1], // 中嘴部 Row 6
  [1, 9, 9, 1, 2, 9, 9, 2], // 下嘴角 Row 7 (中间镂空)
];

// 8x12 躯干迷彩纹理
const TORSO_PIXELS: number[][] = [
  [1, 2, 0, 1, 2, 0, 1, 2],
  [2, 3, 1, 2, 0, 1, 3, 1],
  [0, 1, 2, 3, 1, 2, 0, 2],
  [1, 0, 3, 1, 2, 3, 1, 0],
  [2, 1, 0, 2, 3, 0, 2, 1],
  [3, 2, 1, 0, 1, 2, 3, 2],
  [1, 3, 2, 1, 0, 3, 1, 0],
  [0, 1, 3, 2, 1, 0, 2, 3],
  [2, 0, 1, 3, 2, 1, 0, 1],
  [1, 2, 0, 1, 3, 2, 1, 2],
  [3, 1, 2, 0, 1, 3, 0, 1],
  [2, 3, 1, 2, 0, 1, 2, 0],
];

// 4x6 腿部迷彩 (前5行迷彩，最后一行深色爪足)
const LEG_PIXELS: number[][] = [
  [1, 2, 0, 1],
  [2, 3, 1, 2],
  [0, 1, 2, 3],
  [1, 0, 3, 1],
  [2, 1, 0, 2],
  [9, 9, 9, 9], // 脚爪
];

const SPLASHES = [
  "★ 千万不要向下直挖！ (Never dig straight down!)",
  "★ 由 WebAssembly 与 Tauri 2.0 强力驱动",
  "★ Pretext 高性能极速排版引擎就绪，零 DOM 回流",
  "★ 苦力怕今天心情平静，暂时没有爆炸倾向",
  "★ 经典 8-bit 像素美学，纯原生 Canvas 绘制",
  "★ 悬停注视，点击苦力怕触发趣味彩蛋！",
  "★ 模块化插件架构，探索无限可能",
  "★ 钻石就在下一个拐角处...",
  "★ 准备好开启你的下一次 Minecraft 冒险了吗？",
  "★ 100% 纯代码像素渲染，冷启动秒开"
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'pixel' | 'smoke' | 'heart' | 'spark';
  char?: string;
}

export default function CreeperCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const splashIndexRef = useRef(0);

  // 内部动画与物理状态
  const stateRef = useRef({
    width: 600,
    height: 400,
    dpr: 1,

    // 苦力怕位置与漫步状态
    creeperX: 180,
    dir: 1 as 1 | -1, // 1: 向右, -1: 向左
    speed: 1.1,
    walkPhase: 0,
    isWalking: true,
    isWatching: false,
    headTilt: 0,
    lookOffsetX: 0,
    lookOffsetY: 0,

    // 惊吓/受击彩蛋状态
    startledTimer: 0,
    isPanicked: false,
    panicTimer: 0,
    scale: 1,

    // 交互与悬停
    mouseX: -9999,
    mouseY: -9999,
    isHoveringCreeper: false,
    isHoveringSplash: false,

    // 粒子与气泡
    particles: [] as Particle[],
    hissBubble: null as { text: string; x: number; y: number; alpha: number; width: number } | null,

    // 云朵与星空
    clouds: [
      { x: 50, y: 35, speed: 0.25, width: 85, height: 22 },
      { x: 260, y: 55, speed: 0.18, width: 110, height: 26 },
      { x: 480, y: 25, speed: 0.32, width: 70, height: 18 },
    ],
    stars: Array.from({ length: 22 }, (_, i) => ({
      x: (i * 37 + 19) % 600,
      y: (i * 19 + 11) % 150,
      phase: i * 0.7,
      size: (i % 3 === 0) ? 2 : 1.5,
    })),

    // Splash 卡片区域 (用于鼠标悬停与点击命中检测)
    splashBounds: { x: 0, y: 0, w: 0, h: 0 },
    creeperBounds: { x: 0, y: 0, w: 0, h: 0 },
  });

  // Pretext 准备段落句柄缓存 (避免每帧重复分词测量，纯利用 layoutWithLines 快速纯算术排版)
  const titlePreparedRef = useRef<ReturnType<typeof prepareWithSegments> | null>(null);
  const splashPreparedCacheRef = useRef<Map<number, ReturnType<typeof prepareWithSegments>>>(new Map());

  const getTitlePrepared = () => {
    if (!titlePreparedRef.current) {
      titlePreparedRef.current = prepareWithSegments("ATOM LAUNCHER", 'bold 30px "FusionPixelFont", sans-serif');
    }
    return titlePreparedRef.current;
  };

  const getSplashPrepared = (index: number) => {
    let prep = splashPreparedCacheRef.current.get(index);
    if (!prep) {
      prep = prepareWithSegments(SPLASHES[index], '13px "FusionPixelFont", sans-serif');
      splashPreparedCacheRef.current.set(index, prep);
    }
    return prep;
  };

  // 触发苦力怕受惊彩蛋
  const triggerStartled = () => {
    const s = stateRef.current;
    s.startledTimer = 65; // ~1.1 秒
    s.isPanicked = true;
    s.panicTimer = 180; // 吓跑持续时间
    s.headTilt = 0; // 惊吓与逃跑时复位头部倾斜
    s.lookOffsetX = 0; // 复位眼神焦距
    s.lookOffsetY = 0;

    // 受到惊吓时反向背离光标逃窜
    if (s.mouseX >= 0) {
      s.dir = s.mouseX >= s.creeperX ? -1 : 1;
    }

    // 利用 Pretext 计算气泡文本排版宽度，完全避免在 hot renderLoop 中每帧调用 measureText
    let bubbleW = 145;
    try {
      const bubbleFont = 'bold 15px "FusionPixelFont", sans-serif';
      const bubblePrep = prepareWithSegments("💥 Sssssssss! 💨", bubbleFont);
      const bubbleLayout = layoutWithLines(bubblePrep, 320, 26);
      if (bubbleLayout.lines.length > 0) {
        bubbleW = Math.round(bubbleLayout.lines[0].width);
      }
    } catch {}

    s.hissBubble = {
      text: "💥 Sssssssss! 💨",
      x: s.creeperX,
      y: (s.height - 50) - 125, // 苦力怕头顶上方，悬浮不遮挡面部
      alpha: 1,
      width: bubbleW,
    };

    // 产生大量爆炸像素碎片与烟雾粒子
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 5.5;
      const isSmoke = Math.random() > 0.55;
      const isSpark = !isSmoke && Math.random() > 0.5;

      s.particles.push({
        x: s.creeperX + (Math.random() - 0.5) * 20,
        y: s.height - 80 + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        size: isSmoke ? 6 + Math.random() * 6 : 3 + Math.random() * 3,
        color: isSmoke
          ? 'rgba(230, 230, 230, 0.8)'
          : isSpark
          ? (Math.random() > 0.5 ? '#ffaa00' : '#ff4422')
          : (Math.random() > 0.5 ? '#6dd343' : '#3c9622'),
        alpha: 1,
        decay: isSmoke ? 0.02 + Math.random() * 0.015 : 0.025 + Math.random() * 0.02,
        type: isSmoke ? 'smoke' : isSpark ? 'spark' : 'pixel',
      });
    }

    // 粒子上限防御，防止连续点击导致数组过度膨胀
    if (s.particles.length > 128) {
      s.particles.splice(0, s.particles.length - 128);
    }
  };

  // 生成点击爱心或火花粒子
  const spawnClickParticles = (cx: number, cy: number) => {
    const s = stateRef.current;
    const isHeart = Math.random() > 0.35;
    for (let i = 0; i < 9; i++) {
      const angle = (Math.PI * 2 * i) / 9 + (Math.random() - 0.5) * 0.4;
      const speed = 1.2 + Math.random() * 2.5;
      s.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: isHeart ? 14 : 4,
        color: isHeart ? '#ff3b5c' : '#72d846',
        alpha: 1,
        decay: 0.025,
        type: isHeart ? 'heart' : 'spark',
        char: isHeart ? '❤' : '✦',
      });
    }

    if (s.particles.length > 128) {
      s.particles.splice(0, s.particles.length - 128);
    }
  };

  useEffect(() => {
    // 字体加载就绪后刷新 Pretext 测量缓存与本地段落句柄
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        try {
          clearCache();
          titlePreparedRef.current = null;
          splashPreparedCacheRef.current.clear();
        } catch {}
      });
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animId = 0;

    const updateSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = dpr;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // 容器尺寸收缩时及时将苦力怕位置约束在合法巡逻区间内，防止静止状态下停留在视口之外
      const leftBound = Math.min(36, Math.max(12, w * 0.15));
      const rightBound = Math.max(leftBound + 16, w - leftBound);
      if (stateRef.current.creeperX < leftBound) {
        stateRef.current.creeperX = leftBound;
        stateRef.current.dir = 1;
      } else if (stateRef.current.creeperX > rightBound) {
        stateRef.current.creeperX = rightBound;
        stateRef.current.dir = -1;
      }

      // 重新分配星空位置以填满新尺寸
      stateRef.current.stars.forEach((star, i) => {
        star.x = (i * 41 + 17) % w;
        star.y = (i * 23 + 9) % Math.max(120, h - 90);
      });
    };

    // 挂载时立即同步读取并设置尺寸，避免 1 帧的 300x150 默认未缩放闪烁
    const initialRect = container.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      updateSize(initialRect.width, initialRect.height);
    }

    // 自适应尺寸监听
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });

    resizeObserver.observe(container);

    // 主渲染与物理动画循环
    let lastTime = performance.now();

    const renderLoop = (now: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = stateRef.current;
      const { width, height, dpr } = s;
      if (width <= 0 || height <= 0) return;

      const groundY = height - 50;
      const P = 4; // 苦力怕 1 像素 = 4px

      // ==========================================
      // 1. 物理更新与行为状态机
      // ==========================================

      // 苦力怕包围盒更新 (用于点击与注视检测，支持受惊膨胀 scale 动态放大)
      const creeperHalfW = 16 * s.scale;
      const creeperH = 26 * P * s.scale; // 104px * scale
      s.creeperBounds = {
        x: s.creeperX - creeperHalfW - 8,
        y: groundY - creeperH - 6,
        w: creeperHalfW * 2 + 16,
        h: creeperH + 12,
      };

      // 鼠标距离检测
      const distToMouse = Math.hypot(s.mouseX - s.creeperX, s.mouseY - (groundY - 50));
      s.isHoveringCreeper =
        s.mouseX >= s.creeperBounds.x &&
        s.mouseX <= s.creeperBounds.x + s.creeperBounds.w &&
        s.mouseY >= s.creeperBounds.y &&
        s.mouseY <= s.creeperBounds.y + s.creeperBounds.h;

      // 归一化时间步长 (基准 60fps)，防止高刷新率 (144Hz/240Hz) 下苦力怕移速过快与惊吓计时失真
      const timeScale = Math.min(Math.max(dt * 60, 0.2), 3);

      // 受惊状态计时
      if (s.startledTimer > 0) {
        s.startledTimer = Math.max(0, s.startledTimer - timeScale);
        s.isWalking = false;
        s.headTilt = 0;
        s.lookOffsetX = 0;
        s.lookOffsetY = 0;
        // 受惊膨胀与微颤
        const progress = 1 - s.startledTimer / 65;
        s.scale = 1 + Math.sin(progress * Math.PI) * 0.28 + (Math.random() - 0.5) * 0.05;
      } else {
        s.scale = 1;
        if (s.panicTimer > 0) {
          s.panicTimer = Math.max(0, s.panicTimer - timeScale);
          // 惊吓逃窜：2.4倍速逃跑
          s.speed = 2.4;
          s.isWalking = true;
          s.isWatching = false;
          s.headTilt = 0;
          s.lookOffsetX = 0;
          s.lookOffsetY = 0;
        } else {
          s.isPanicked = false;
          s.speed = 1.1;
          // 当鼠标靠近 (< 150px) 且未惊吓时，停步并注视光标
          if (distToMouse < 150 && s.mouseX >= 0) {
            s.isWalking = false;
            s.isWatching = true;
            // 苦力怕掉头面朝光标
            s.dir = s.mouseX >= s.creeperX ? 1 : -1;
            // 头部根据鼠标高度上下倾斜
            const dy = s.mouseY - (groundY - 80);
            s.headTilt = Math.max(-0.25, Math.min(0.25, dy / 200));
            // 苦力怕已朝向光标，在其局部坐标系下眼睛焦点向前看 (lookX=1 即朝光标前向)
            s.lookOffsetX = Math.abs(s.mouseX - s.creeperX) > 10 ? 1 : 0;
            s.lookOffsetY = Math.abs(dy) > 15 ? (dy > 0 ? 1 : -1) : 0;
          } else {
            s.isWalking = true;
            s.isWatching = false;
            s.headTilt = 0;
            s.lookOffsetX = 0;
            s.lookOffsetY = 0;
          }
        }
      }

      // 漫步巡逻与碰撞掉头逻辑 (窄容器极限下保证 leftBound < rightBound，防止震荡死循环)
      if (s.isWalking) {
        s.creeperX += s.dir * s.speed * timeScale;
        s.walkPhase += dt * (s.speed * 4.5);

        // 碰边界掉头 (留出安全边界，自适应极窄窗口)
        const leftBound = Math.min(36, Math.max(12, width * 0.15));
        const rightBound = Math.max(leftBound + 16, width - leftBound);
        if (s.creeperX <= leftBound) {
          s.creeperX = leftBound;
          s.dir = 1;
        } else if (s.creeperX >= rightBound) {
          s.creeperX = rightBound;
          s.dir = -1;
        }
      }

      // 云朵平移更新 (时间步长归一化)
      s.clouds.forEach((cloud) => {
        cloud.x += cloud.speed * timeScale;
        if (cloud.x > width + 40) {
          cloud.x = -cloud.width - 20;
        }
      });

      // 粒子物理更新 (时间步长归一化)
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        if (p.type === 'smoke') {
          p.vy -= 0.04 * timeScale; // 烟雾向上升腾
          p.size += 0.08 * timeScale;
        } else if (p.type === 'heart') {
          p.vy -= 0.05 * timeScale; // 爱心向上漂浮
        } else {
          p.vy += 0.16 * timeScale; // 像素碎片重力
        }
        p.alpha -= p.decay * timeScale;
        if (p.alpha <= 0) {
          s.particles.splice(i, 1);
        }
      }

      // Sssss 气泡淡出浮动 (时间步长归一化)
      if (s.hissBubble) {
        s.hissBubble.y -= 0.6 * timeScale;
        s.hissBubble.alpha -= 0.012 * timeScale;
        if (s.hissBubble.alpha <= 0) {
          s.hissBubble = null;
        }
      }

      // ==========================================
      // 2. Canvas 渲染阶段
      // ==========================================
      // 清空物理像素缓冲区，防止 DPR 缩放下边缘残留未清除脏像素
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false; // 保证像素风锐利清晰

      // 2.1 像素天空背景 (暮色深蓝渐变)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#152132');
      skyGrad.addColorStop(0.65, '#22344c');
      skyGrad.addColorStop(1, '#344c66');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

      // 2.2 闪烁的像素星空
      const timeSec = now / 1000;
      s.stars.forEach((star) => {
        const twinkle = Math.sin(timeSec * 2.5 + star.phase) * 0.4 + 0.6;
        ctx.fillStyle = `rgba(240, 245, 255, ${twinkle})`;
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      });

      // 2.3 像素多层云朵
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      s.clouds.forEach((cloud) => {
        const cx = Math.floor(cloud.x);
        const cy = Math.floor(cloud.y);
        const cw = cloud.width;
        const ch = cloud.height;

        // 像素分块云朵
        ctx.fillRect(cx + 8, cy, cw - 16, ch);
        ctx.fillRect(cx, cy + 4, cw, ch - 8);
        ctx.fillRect(cx + 12, cy - 4, cw - 28, 4);

        // 云朵底部阴影
        ctx.fillStyle = 'rgba(180, 195, 215, 0.45)';
        ctx.fillRect(cx + 4, cy + ch - 4, cw - 8, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      });

      // 2.4 草方块地表与泥土层
      // 泥土底层
      ctx.fillStyle = '#6f4c2c';
      ctx.fillRect(0, groundY + 12, width, height - (groundY + 12));

      // 泥土颗粒杂质
      ctx.fillStyle = '#55391d';
      for (let x = 6; x < width; x += 18) {
        ctx.fillRect(x, groundY + 18, 4, 4);
        ctx.fillRect(x + 8, groundY + 28, 4, 3);
      }
      ctx.fillStyle = '#8a623c';
      for (let x = 12; x < width; x += 22) {
        ctx.fillRect(x, groundY + 22, 3, 3);
        ctx.fillRect(x + 9, groundY + 36, 4, 3);
      }

      // 草地主层
      ctx.fillStyle = '#448c24';
      ctx.fillRect(0, groundY, width, 12);

      // 草方块顶部高光细线
      ctx.fillStyle = '#72d846';
      ctx.fillRect(0, groundY, width, 2);

      // 下垂的像素草须
      ctx.fillStyle = '#448c24';
      for (let x = 0; x < width; x += 8) {
        const fringeH = ((x * 7) % 5) + 3;
        ctx.fillRect(x, groundY + 12, 4, fringeH);
      }
      ctx.fillStyle = '#326c19';
      for (let x = 4; x < width; x += 16) {
        ctx.fillRect(x, groundY + 12, 3, 4);
      }

      // 地表装饰：经典红罂粟花与黄蒲公英 (自适应宽度边界，防止负坐标与拥挤堆叠)
      drawPixelFlower(ctx, 45, groundY, 'red');
      if (width >= 160) {
        drawPixelFlower(ctx, width - 58, groundY, 'yellow');
      }
      if (width >= 240) {
        drawPixelGrassTuft(ctx, 110, groundY);
        drawPixelGrassTuft(ctx, width - 130, groundY);
      }

      // 2.5 苦力怕足底投影
      ctx.fillStyle = 'rgba(15, 30, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(s.creeperX, groundY + 1, 16 * s.scale, 5 * s.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // 2.6 绘制 8-bit 苦力怕 (四腿交替摆动、躯干微动、头部注视)
      // ==========================================
      const isStartledFlashing = s.startledTimer > 0 && Math.floor(s.startledTimer / 5) % 2 === 0;

      ctx.save();
      ctx.translate(s.creeperX, groundY);
      // 水平镜像以对应朝向，并叠加受惊膨胀缩放
      ctx.scale(s.dir * s.scale, s.scale);

      // 四腿交替摆动角度计算
      const swing = s.isWalking ? Math.sin(s.walkPhase) * 0.42 : 0;
      const legAngleFL = swing; // 前左腿
      const legAngleFR = -swing; // 前右腿
      const legAngleBL = -swing * 0.85; // 后左腿 (反相)
      const legAngleBR = swing * 0.85; // 后右腿

      // 躯干垂直微动
      const bodyBobY = s.isWalking ? Math.abs(Math.sin(s.walkPhase * 2)) * 3 : 0;
      const hipY = -6 * P - bodyBobY;
      const torsoTopY = hipY - 12 * P;

      // (A) 后侧两条腿 (偏暗深色以表现景深遮挡)
      drawCreeperLeg(ctx, -3 * P, hipY, legAngleBL, P, true, isStartledFlashing);
      drawCreeperLeg(ctx, -1 * P, hipY, legAngleBR, P, true, isStartledFlashing);

      // (B) 躯干
      drawPixelMatrix(ctx, TORSO_PIXELS, -4 * P, torsoTopY, P, isStartledFlashing);

      // (C) 前侧两条腿
      drawCreeperLeg(ctx, -4 * P, hipY, legAngleFL, P, false, isStartledFlashing);
      drawCreeperLeg(ctx, 0 * P, hipY, legAngleFR, P, false, isStartledFlashing);

      // (D) 头部 (支持注视偏转角度与眼睛焦点偏移)
      ctx.save();
      ctx.translate(0, torsoTopY);
      ctx.rotate(s.headTilt);
      drawCreeperHead(ctx, -4 * P, -8 * P, P, isStartledFlashing, s.lookOffsetX, s.lookOffsetY);
      ctx.restore();

      ctx.restore(); // 结束苦力怕局部坐标系

      // 2.7 受惊 hiss 气泡提示 (基于 Pretext 预先测算宽度，零 hot loop measureText)
      if (s.hissBubble) {
        ctx.save();
        ctx.font = 'bold 15px "FusionPixelFont", sans-serif';
        const txt = s.hissBubble.text;
        const tw = s.hissBubble.width;
        const cardW = tw + 16;
        const bx = Math.max(8, Math.min(width - cardW - 8, s.hissBubble.x - cardW / 2));
        const by = s.hissBubble.y - 12;

        ctx.fillStyle = `rgba(20, 20, 20, ${s.hissBubble.alpha * 0.85})`;
        ctx.fillRect(bx, by, cardW, 26);
        ctx.strokeStyle = `rgba(255, 80, 50, ${s.hissBubble.alpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, cardW, 26);

        // 气泡指向苦力怕的小像素尾巴
        const tailX = Math.max(bx + 12, Math.min(bx + cardW - 16, s.hissBubble.x - 2));
        ctx.fillStyle = `rgba(20, 20, 20, ${s.hissBubble.alpha * 0.85})`;
        ctx.fillRect(tailX, by + 26, 6, 3);
        ctx.fillRect(tailX + 1, by + 29, 4, 3);
        ctx.fillRect(tailX + 2, by + 32, 2, 2);

        ctx.fillStyle = `rgba(255, 230, 100, ${s.hissBubble.alpha})`;
        ctx.fillText(txt, bx + 8, by + 18);
        ctx.restore();
      }

      // 2.8 绘制所有粒子 (烟雾、火花、爱心)
      s.particles.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.type === 'pixel') {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
        } else if (p.type === 'smoke') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'spark') {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.floor(p.x - p.size / 2), Math.floor(p.y - p.size / 2), p.size, p.size);
        } else if (p.type === 'heart') {
          ctx.font = '16px "FusionPixelFont", sans-serif';
          ctx.fillStyle = p.color;
          ctx.fillText(p.char || '❤', p.x, p.y);
        }
        ctx.restore();
      });

      // ==========================================
      // 3. Pretext 动态文字排版引擎渲染 (艺术标题 + 标语)
      // ==========================================

      // 3.1 艺术标题 "ATOM LAUNCHER" (基于 Pretext 测量与布局，零 DOM 回流与 Canvas measureText 轮询)
      const titleFont = 'bold 30px "FusionPixelFont", sans-serif';
      ctx.font = titleFont;
      const titleY = 38;
      let titleBottomY = titleY;

      try {
        const titlePrepared = getTitlePrepared();
        const maxTitleW = Math.max(60, width - 40);
        const titleLayout = layoutWithLines(titlePrepared, maxTitleW, 34);

        if (titleLayout.lines.length === 1) {
          // 单行自适应排版
          const firstLine = titleLayout.lines[0];
          const titleX = Math.round((width - firstLine.width) / 2);

          // 利用 Pretext 已准备好的段落分词段宽进行分词上色 ("ATOM" 绿色, "LAUNCHER" 暖金色)，无需在热循环中每帧调 measureText
          const atomW = titlePrepared.widths[0] || 0;
          const spaceW = titlePrepared.widths[1] || 0;

          // 像素阴影 (沉底深色块)
          ctx.fillStyle = '#101c0c';
          ctx.fillText("ATOM", titleX + 3, titleY + 3);
          ctx.fillText("LAUNCHER", titleX + atomW + spaceW + 3, titleY + 3);

          // 字体主体
          ctx.fillStyle = '#52b336';
          ctx.fillText("ATOM", titleX, titleY);
          ctx.fillStyle = '#f5d061';
          ctx.fillText("LAUNCHER", titleX + atomW + spaceW, titleY);

          titleBottomY = titleY;
        } else if (titleLayout.lines.length > 1) {
          // 窄容器多行换行排版
          titleLayout.lines.forEach((line, idx) => {
            const lineX = Math.round((width - line.width) / 2);
            const lineY = titleY + idx * 34;

            ctx.fillStyle = '#101c0c';
            ctx.fillText(line.text, lineX + 2, lineY + 2);

            ctx.fillStyle = idx === 0 ? '#52b336' : '#f5d061';
            ctx.fillText(line.text, lineX, lineY);
          });
          titleBottomY = titleY + (titleLayout.lines.length - 1) * 34;
        }
      } catch (e) {
        // Fallback 防御
        ctx.fillStyle = '#52b336';
        ctx.fillText("ATOM LAUNCHER", 40, titleY);
      }

      // 3.2 动态标语卡片 (基于 Pretext 动态自适应折行排版，始终紧随标题下方，避免遮挡)
      const splashFont = '13px "FusionPixelFont", sans-serif';
      ctx.font = splashFont;

      try {
        const splashPrepared = getSplashPrepared(splashIndexRef.current);
        const maxSplashW = Math.max(80, Math.min(width - 48, 460));
        const splashLayout = layoutWithLines(splashPrepared, maxSplashW, 20);

        if (splashLayout.lines.length > 0) {
          const maxLineWidth = Math.max(...splashLayout.lines.map((l) => l.width), 80);
          const cardW = Math.min(width - 24, maxLineWidth + 28);
          const cardH = splashLayout.lines.length * 20 + 14;
          const cardX = Math.max(12, Math.round((width - cardW) / 2));
          const cardY = titleBottomY + 18;

          // 保存命中检测区域
          s.splashBounds = { x: cardX, y: cardY, w: cardW, h: cardH };
          s.isHoveringSplash =
            s.mouseX >= cardX &&
            s.mouseX <= cardX + cardW &&
            s.mouseY >= cardY &&
            s.mouseY <= cardY + cardH;

          // 标语卡片背景 (像素羊皮纸/深色石板风)
          ctx.fillStyle = s.isHoveringSplash ? 'rgba(38, 28, 18, 0.94)' : 'rgba(28, 20, 14, 0.88)';
          ctx.fillRect(cardX, cardY, cardW, cardH);

          // 卡片边框
          ctx.strokeStyle = s.isHoveringSplash ? '#f5d061' : '#6f4c2c';
          ctx.lineWidth = 2;
          ctx.strokeRect(cardX, cardY, cardW, cardH);

          // 四角像素点缀
          ctx.fillStyle = '#f5d061';
          ctx.fillRect(cardX, cardY, 2, 2);
          ctx.fillRect(cardX + cardW - 2, cardY, 2, 2);
          ctx.fillRect(cardX, cardY + cardH - 2, 2, 2);
          ctx.fillRect(cardX + cardW - 2, cardY + cardH - 2, 2, 2);

          // 逐行渲染 Pretext 排版出的文本行
          splashLayout.lines.forEach((line, idx) => {
            const lineX = Math.max(cardX + 10, Math.round((width - line.width) / 2));
            const lineY = cardY + 16 + idx * 20;

            // 文本深色阴影
            ctx.fillStyle = '#221508';
            ctx.fillText(line.text, lineX + 1, lineY + 1);

            // 经典 Minecraft 黄色标语高亮
            ctx.fillStyle = s.isHoveringSplash ? '#fff385' : '#ffd54f';
            ctx.fillText(line.text, lineX, lineY);
          });
        } else {
          s.splashBounds = { x: 0, y: 0, w: 0, h: 0 };
        }
      } catch (e) {
        s.splashBounds = { x: 0, y: 0, w: 0, h: 0 };
      }

      // 3.3 交互提示小标签 (窄屏自适应简短文案)
      if (width >= 180) {
        ctx.font = '11px "FusionPixelFont", sans-serif';
        ctx.fillStyle = 'rgba(230, 240, 255, 0.65)';
        const hint = width < 380 ? "💡 点击苦力怕或标语探索彩蛋" : "💡 提示：点击苦力怕触发彩蛋，点击上方卡片切换标语";
        ctx.fillText(hint, 14, height - 14);
      }

      // 同步光标交互样式（即使鼠标静止，苦力怕漫步进出光标下方也能即时获得指针反馈）
      const isOverInteractive = s.isHoveringCreeper || s.isHoveringSplash;
      const desiredCursor = isOverInteractive ? 'pointer' : 'default';
      if (canvas.style.cursor !== desiredCursor && s.mouseX >= 0) {
        canvas.style.cursor = desiredCursor;
      }

      ctx.restore(); // 结束整帧渲染
    };

    animId = requestAnimationFrame(renderLoop);

    const handleWindowBlur = () => {
      handleMouseLeave();
    };
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // 鼠标交互事件
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? stateRef.current.width / rect.width : 1;
    const scaleY = rect.height > 0 ? stateRef.current.height / rect.height : 1;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    stateRef.current.mouseX = x;
    stateRef.current.mouseY = y;

    // 悬停光标样式反馈
    const isOverCreeper =
      x >= stateRef.current.creeperBounds.x &&
      x <= stateRef.current.creeperBounds.x + stateRef.current.creeperBounds.w &&
      y >= stateRef.current.creeperBounds.y &&
      y <= stateRef.current.creeperBounds.y + stateRef.current.creeperBounds.h;

    const isOverSplash =
      x >= stateRef.current.splashBounds.x &&
      x <= stateRef.current.splashBounds.x + stateRef.current.splashBounds.w &&
      y >= stateRef.current.splashBounds.y &&
      y <= stateRef.current.splashBounds.y + stateRef.current.splashBounds.h;

    canvas.style.cursor = isOverCreeper || isOverSplash ? 'pointer' : 'default';
  };

  const handleMouseLeave = () => {
    stateRef.current.mouseX = -9999;
    stateRef.current.mouseY = -9999;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? stateRef.current.width / rect.width : 1;
    const scaleY = rect.height > 0 ? stateRef.current.height / rect.height : 1;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // 检查是否点击了苦力怕
    const cb = stateRef.current.creeperBounds;
    if (x >= cb.x && x <= cb.x + cb.w && y >= cb.y && y <= cb.y + cb.h) {
      triggerStartled();
      return;
    }

    // 检查是否点击了标语卡片 (切换下一条，并立即同步更新 ref，避免全组件无谓重渲染)
    const sb = stateRef.current.splashBounds;
    if (sb.w > 0 && sb.h > 0 && x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      splashIndexRef.current = (splashIndexRef.current + 1) % SPLASHES.length;
      return;
    }

    // 点击其他空白区域生成爱心火花
    spawnClickParticles(x, y);
  };

  // 键盘无障碍交互
  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      triggerStartled();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      splashIndexRef.current = (splashIndexRef.current + 1) % SPLASHES.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      splashIndexRef.current = (splashIndexRef.current - 1 + SPLASHES.length) % SPLASHES.length;
    }
  };

  // 触控交互适配 (针对 Surface 及触屏 Windows 笔记本)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? stateRef.current.width / rect.width : 1;
    const scaleY = rect.height > 0 ? stateRef.current.height / rect.height : 1;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    stateRef.current.mouseX = x;
    stateRef.current.mouseY = y;

    // 检查是否点击了苦力怕
    const cb = stateRef.current.creeperBounds;
    if (x >= cb.x && x <= cb.x + cb.w && y >= cb.y && y <= cb.y + cb.h) {
      triggerStartled();
      return;
    }

    // 检查是否点击了标语卡片
    const sb = stateRef.current.splashBounds;
    if (sb.w > 0 && sb.h > 0 && x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      splashIndexRef.current = (splashIndexRef.current + 1) % SPLASHES.length;
      return;
    }

    // 点击其他空白区域生成爱心火花
    spawnClickParticles(x, y);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-stone-900"
      title="Atom Launcher 动态像素展台"
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="region"
        aria-label="Atom Launcher 动态像素展台（支持空格/回车互动，方向键切换标语）"
        className="block w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-grass-60 focus-visible:ring-inset"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
}

// ==========================================
// 像素绘制辅助函数
// ==========================================

function drawCreeperLeg(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  angle: number,
  P: number,
  isDark: boolean,
  isFlashing: boolean
) {
  ctx.save();
  ctx.translate(pivotX + 2 * P, pivotY);
  ctx.rotate(angle);
  ctx.translate(-2 * P, 0);

  for (let r = 0; r < LEG_PIXELS.length; r++) {
    for (let c = 0; c < LEG_PIXELS[r].length; c++) {
      const code = LEG_PIXELS[r][c];
      let color = code === 9 ? CREEPER_COLORS.F0 : getColorByCode(code);
      if (isDark && code !== 9) {
        color = '#255e16'; // 景深阴影绿
      }
      if (isFlashing) {
        color = '#ffffff';
      }
      ctx.fillStyle = color;
      ctx.fillRect(c * P, r * P, P, P);
    }
  }
  ctx.restore();
}

function drawCreeperHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  P: number,
  isFlashing: boolean,
  lookX: number,
  lookY: number
) {
  // 先打底一层苦力怕经典主绿底色，避免眼睛微调焦距时产生 1px 透明接缝或露底
  ctx.fillStyle = isFlashing ? '#ffffff' : CREEPER_COLORS.G1;
  ctx.fillRect(x, y, 8 * P, 8 * P);

  for (let r = 0; r < FACE_PIXELS.length; r++) {
    for (let c = 0; c < FACE_PIXELS[r].length; c++) {
      let code = FACE_PIXELS[r][c];

      // 眼睛像素根据注视方向产生 1px 微调焦距
      let px = x + c * P;
      let py = y + r * P;
      if (code === 9 && (r === 2 || r === 3)) {
        px += lookX * 1;
        py += lookY * 1;
      }

      let color = code === 9 ? CREEPER_COLORS.K0 : getColorByCode(code);
      if (isFlashing) {
        color = '#ffffff';
      }
      ctx.fillStyle = color;
      ctx.fillRect(px, py, P, P);
    }
  }
}

function drawPixelMatrix(
  ctx: CanvasRenderingContext2D,
  matrix: number[][],
  x: number,
  y: number,
  P: number,
  isFlashing: boolean
) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      let color = isFlashing ? '#ffffff' : getColorByCode(matrix[r][c]);
      ctx.fillStyle = color;
      ctx.fillRect(x + c * P, y + r * P, P, P);
    }
  }
}

function getColorByCode(code: number): string {
  switch (code) {
    case 0:
      return CREEPER_COLORS.G0;
    case 1:
      return CREEPER_COLORS.G1;
    case 2:
      return CREEPER_COLORS.G2;
    case 3:
      return CREEPER_COLORS.G3;
    case 9:
      return CREEPER_COLORS.K0;
    default:
      return CREEPER_COLORS.G1;
  }
}

function drawPixelFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  type: 'red' | 'yellow'
) {
  const P = 3;
  const baseY = groundY - 14;

  // 茎叶
  ctx.fillStyle = '#3c8c22';
  ctx.fillRect(x + P, baseY + 2 * P, P, 3 * P);
  ctx.fillRect(x, baseY + 3 * P, P, P);

  // 花瓣
  const petalColor = type === 'red' ? '#e53935' : '#fdd835';
  const centerColor = type === 'red' ? '#ffeb3b' : '#ff9800';

  ctx.fillStyle = petalColor;
  ctx.fillRect(x, baseY, 3 * P, 2 * P);
  ctx.fillRect(x + P, baseY - P, P, 4 * P);

  ctx.fillStyle = centerColor;
  ctx.fillRect(x + P, baseY, P, P);
}

function drawPixelGrassTuft(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  const P = 3;
  ctx.fillStyle = '#55a828';
  ctx.fillRect(x, groundY - 3 * P, P, 3 * P);
  ctx.fillRect(x + P, groundY - 4 * P, P, 4 * P);
  ctx.fillRect(x + 2 * P, groundY - 2 * P, P, 2 * P);
}
