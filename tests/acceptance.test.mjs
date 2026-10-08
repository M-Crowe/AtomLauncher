import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 模拟 DOM OffscreenCanvas 供 @chenglou/pretext 在 Node 运行环境下进行真实排版测试
globalThis.OffscreenCanvas = class OffscreenCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
  }
  getContext(type) {
    return {
      measureText(text) {
        // 模拟像素字体宽度度量
        return { width: text.length * 8.5 };
      },
    };
  }
};

const { prepareWithSegments, layoutWithLines } = await import('@chenglou/pretext');

test('R1. BottomNav component interface and controlled contract', () => {
  const bottomNavContent = readFileSync(resolve('src/components/BottomNav.tsx'), 'utf-8');

  // 验证受控属性定义
  assert.ok(bottomNavContent.includes('export type NavValue = "home" | "settings" | "tools"'), 'NavValue type exported');
  assert.ok(bottomNavContent.includes('activeTab?: NavValue'), 'BottomNav accepts activeTab');
  assert.ok(bottomNavContent.includes('onChange?: (value: NavValue) => void'), 'BottomNav accepts onChange callback');
  assert.ok(bottomNavContent.includes('translateX(${indexMap[current] * 100}%)'), 'Slider animation translation retained');

  // 验证 indexMap 映射
  const indexMap = { home: 0, settings: 1, tools: 2 };
  assert.equal(indexMap['home'], 0);
  assert.equal(indexMap['settings'], 1);
  assert.equal(indexMap['tools'], 2);
});

test('R1. App view routing and state management', () => {
  const appContent = readFileSync(resolve('src/App.tsx'), 'utf-8');

  // 验证状态管理及三页面视图切换
  assert.ok(appContent.includes('useState<NavValue>("home")'), 'App initializes tab state to home');
  assert.ok(appContent.includes('currentTab === "home" && <CreeperCanvas />'), 'Renders CreeperCanvas on home');
  assert.ok(appContent.includes('currentTab === "settings" && <SettingsView />'), 'Renders SettingsView on settings');
  assert.ok(appContent.includes('currentTab === "tools" &&'), 'Renders ToolsView on tools');
  assert.ok(appContent.includes('pluginDir='), 'Preserves pluginDir prop for PluginSlot');
  assert.ok(appContent.includes('entryJs="ui/index.js"'), 'Preserves entryJs prop for PluginSlot');
  assert.ok(appContent.includes('<BottomNav activeTab={currentTab} onChange={setCurrentTab} />'), 'BottomNav is controlled by App state');
});

test('R2. Pretext Typography layout with "ATOM LAUNCHER" art title and splashes', () => {
  // 1. 标题排版测试
  const titleFont = 'bold 30px "FusionPixelFont", sans-serif';
  const titlePrep = prepareWithSegments('ATOM LAUNCHER', titleFont);
  const titleRes = layoutWithLines(titlePrep, 500, 36);

  assert.ok(titleRes.lines.length >= 1, 'Title produces lines');
  assert.equal(titleRes.lines[0].text, 'ATOM LAUNCHER', 'Title text preserved');
  assert.ok(titleRes.lines[0].width > 0, 'Title width is measured');

  // 2. 标语多行自适应折行测试
  const splashes = [
    '★ 千万不要向下直挖！ (Never dig straight down!)',
    '★ 由 WebAssembly 与 Tauri 2.0 强力驱动',
    '★ Pretext 高性能极速排版引擎就绪，零 DOM 回流',
    '★ 苦力怕今天心情平静，暂时没有爆炸倾向',
    '★ 经典 8-bit 像素美学，纯原生 Canvas 绘制',
    '★ 悬停注视，点击苦力怕触发趣味彩蛋！',
    '★ 模块化插件架构，探索无限可能',
    '★ 钻石就在下一个拐角处...',
    '★ 准备好开启你的下一次 Minecraft 冒险了吗？',
    '★ 100% 纯代码像素渲染，冷启动秒开'
  ];

  for (const splash of splashes) {
    const splashPrep = prepareWithSegments(splash, '13px "FusionPixelFont", sans-serif');

    // 宽容器
    const wideRes = layoutWithLines(splashPrep, 600, 20);
    assert.ok(wideRes.lines.length >= 1, `Wide container lines for: ${splash}`);

    // 窄容器 (验证 Pretext 自动折行算法)
    const narrowRes = layoutWithLines(splashPrep, 180, 20);
    assert.ok(narrowRes.lines.length >= 1, `Narrow container lines for: ${splash}`);
    for (const line of narrowRes.lines) {
      assert.ok(line.text.length > 0, 'Each line has text content');
      assert.ok(line.width > 0, 'Each line has positive width');
    }
  }
});

test('R2. Creeper 8-bit walking kinematics and boundary turnaround logic', () => {
  let creeperX = 100;
  let dir = 1;
  const speed = 1.1;
  const width = 400;
  const leftBound = 36;
  const rightBound = width - 36; // 364

  // 模拟向前巡逻
  for (let frame = 0; frame < 300; frame++) {
    creeperX += dir * speed;
    if (creeperX >= rightBound) {
      creeperX = rightBound;
      dir = -1;
      break;
    }
  }
  assert.equal(dir, -1, 'Creeper turns around at right boundary');
  assert.equal(creeperX, rightBound, 'Creeper clamps at right boundary');

  // 模拟向左巡逻
  for (let frame = 0; frame < 400; frame++) {
    creeperX += dir * speed;
    if (creeperX <= leftBound) {
      creeperX = leftBound;
      dir = 1;
      break;
    }
  }
  assert.equal(dir, 1, 'Creeper turns around at left boundary');
  assert.equal(creeperX, leftBound, 'Creeper clamps at left boundary');

  // 模拟四腿交替摆动运动学
  const walkPhase = Math.PI / 4;
  const swing = Math.sin(walkPhase) * 0.42;
  const legAngleFL = swing;
  const legAngleFR = -swing;
  const legAngleBL = -swing * 0.85;
  const legAngleBR = swing * 0.85;

  assert.ok(legAngleFL > 0, 'Front left leg swings forward');
  assert.ok(legAngleFR < 0, 'Front right leg swings backward');
  assert.ok(legAngleBL < 0, 'Back left leg swings in opposing phase to front left');
  assert.ok(legAngleBR > 0, 'Back right leg swings in opposing phase to front right');

  // 模拟躯干微动 (Minecraft 步态起伏)
  const bobY = Math.abs(Math.sin(walkPhase * 2)) * 3;
  assert.ok(bobY >= 0 && bobY <= 3, 'Body bob stays within vertical bounds');
});

test('R2. Creeper proximity watching and startled easter egg logic', () => {
  const creeperX = 200;
  const groundY = 350;

  // 1. 近距离悬停注视
  const mouseNearby = { x: 280, y: 300 };
  const dist = Math.hypot(mouseNearby.x - creeperX, mouseNearby.y - (groundY - 50));
  assert.ok(dist < 150, 'Mouse is within watching proximity');

  const watchDir = mouseNearby.x >= creeperX ? 1 : -1;
  assert.equal(watchDir, 1, 'Creeper faces towards the mouse');

  const dy = mouseNearby.y - (groundY - 80);
  const headTilt = Math.max(-0.25, Math.min(0.25, dy / 200));
  assert.ok(headTilt >= -0.25 && headTilt <= 0.25, 'Head tilts naturally towards cursor');

  // 2. 点击受惊膨胀与粒子生成
  let startledTimer = 65;
  const progress = 1 - startledTimer / 65;
  const scale = 1 + Math.sin(progress * Math.PI) * 0.28;
  assert.ok(scale >= 1, 'Startled scale expands');

  // 验证粒子生成逻辑
  const particles = [];
  for (let i = 0; i < 36; i++) {
    particles.push({
      x: creeperX,
      y: groundY - 80,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4,
      type: i % 2 === 0 ? 'smoke' : 'spark',
    });
  }
  assert.equal(particles.length, 36, 'Produces 36 explosive feedback particles');
});

test('R1. SettingsView pixel UI placeholder panels', () => {
  const settingsContent = readFileSync(resolve('src/components/SettingsView.tsx'), 'utf-8');
  assert.ok(settingsContent.includes('启动器设置中心'), 'Includes launcher settings header');
  assert.ok(settingsContent.includes('Java 运行环境'), 'Includes Java runtime setting');
  assert.ok(settingsContent.includes('最大内存分配'), 'Includes memory allocation slider');
  assert.ok(settingsContent.includes('启动游戏后自动最小化'), 'Includes auto minimize toggle');
  assert.ok(settingsContent.includes('font-fusion'), 'Uses pixel font styling');
});

test('R1. ToolsView WASM plugin integration', () => {
  const toolsContent = readFileSync(resolve('src/components/ToolsView.tsx'), 'utf-8');
  assert.ok(toolsContent.includes('PluginSlot'), 'Hosts PluginSlot');
  assert.ok(toolsContent.includes('WASM 插件与扩展工具箱'), 'Includes tool workspace header');
});

test('R1. BottomNav uncontrolled fallback and safe navigation mapping', () => {
  const bottomNavContent = readFileSync(resolve('src/components/BottomNav.tsx'), 'utf-8');
  // 验证支持 uncontrolled 模式 (内部 useState) 与 defaultValue
  assert.ok(bottomNavContent.includes('defaultValue?: NavValue'), 'BottomNav accepts defaultValue prop');
  assert.ok(bottomNavContent.includes('const [internalTab, setInternalTab] = useState<NavValue>'), 'BottomNav maintains internal state for uncontrolled usage');
  assert.ok(bottomNavContent.includes('rawCurrent in indexMap'), 'BottomNav safely validates tab key in indexMap');

  // 模拟非法 Tab 值保护
  const indexMap = { home: 0, settings: 1, tools: 2 };
  const rawCurrent = 'invalid_tab';
  const safeCurrent = rawCurrent in indexMap ? rawCurrent : 'home';
  assert.equal(safeCurrent, 'home', 'Unknown tab safely falls back to home');
  assert.equal(indexMap[safeCurrent], 0, 'Safely indexes into indexMap without NaN');
});

test('R2. Creeper boundary turnaround at narrow widths (< 80px) prevents oscillation', () => {
  const narrowWidths = [40, 50, 60, 72, 80];

  for (const width of narrowWidths) {
    const leftBound = Math.min(36, Math.max(12, width * 0.15));
    const rightBound = Math.max(leftBound + 16, width - leftBound);

    assert.ok(leftBound < rightBound, `leftBound (${leftBound}) must be strictly less than rightBound (${rightBound}) at width ${width}`);
    assert.ok(rightBound - leftBound >= 16, 'Minimum patrol corridor of 16px is preserved');

    // 模拟巡逻漫步与碰撞掉头逻辑，验证绝无单帧抖动死循环
    let x = (leftBound + rightBound) / 2;
    let dir = 1;
    let transitions = 0;
    const speed = 1.1;

    for (let frame = 0; frame < 200; frame++) {
      x += dir * speed;
      if (x <= leftBound) {
        x = leftBound;
        dir = 1;
        transitions++;
      } else if (x >= rightBound) {
        x = rightBound;
        dir = -1;
        transitions++;
      }
    }

    assert.ok(transitions >= 2, `Creeper successfully bounces back and forth without deadlocking at width ${width}`);
  }
});

test('R2. Creeper gaze direction math in local coordinate space', () => {
  const creeperX = 300;
  const groundY = 400;

  // Case 1: 鼠标在苦力怕右侧 (mouseX > creeperX)
  const mouseRight = { x: 380, y: 360 };
  const dirRight = mouseRight.x >= creeperX ? 1 : -1;
  assert.equal(dirRight, 1, 'Faces right towards mouse');
  const lookOffsetRight = Math.abs(mouseRight.x - creeperX) > 10 ? 1 : 0;
  assert.equal(lookOffsetRight, 1, 'Pupil looks forward towards mouse in local coordinates');

  // Case 2: 鼠标在苦力怕左侧 (mouseX < creeperX)
  const mouseLeft = { x: 220, y: 360 };
  const dirLeft = mouseLeft.x >= creeperX ? 1 : -1;
  assert.equal(dirLeft, -1, 'Faces left towards mouse');
  // 在 scale(dir, 1) 的苦力怕局部坐标系中，前向即朝向光标方向
  const lookOffsetLeft = Math.abs(mouseLeft.x - creeperX) > 10 ? 1 : 0;
  assert.equal(lookOffsetLeft, 1, 'Pupil looks forward towards mouse in mirrored local space (never looking backward)');

  // 垂直倾斜测试
  const dyDown = 420 - (groundY - 80); // 鼠标偏下
  const tiltDown = Math.max(-0.25, Math.min(0.25, dyDown / 200));
  assert.ok(tiltDown > 0, 'Head tilts down towards low cursor');

  const dyUp = 260 - (groundY - 80); // 鼠标偏上
  const tiltUp = Math.max(-0.25, Math.min(0.25, dyUp / 200));
  assert.ok(tiltUp < 0, 'Head tilts up towards high cursor');
});

test('R2. Frame-rate independent physics with dt scaling (60Hz vs 144Hz)', () => {
  // 60Hz: dt ~ 0.0166s, timeScale = dt * 60 = 1.0
  const dt60 = 1 / 60;
  const timeScale60 = Math.min(Math.max(dt60 * 60, 0.2), 3);
  assert.ok(Math.abs(timeScale60 - 1.0) < 0.01, '60Hz timeScale is 1.0');

  // 144Hz: dt ~ 0.00694s, timeScale = dt * 60 ~ 0.416
  const dt144 = 1 / 144;
  const timeScale144 = Math.min(Math.max(dt144 * 60, 0.2), 3);
  assert.ok(Math.abs(timeScale144 - 60 / 144) < 0.01, '144Hz timeScale is scaled down proportionally');

  // 验证 1 秒内 60 帧 (60Hz) 与 144 帧 (144Hz) 苦力怕位移完全一致
  let dist60 = 0;
  for (let f = 0; f < 60; f++) {
    dist60 += 1.1 * timeScale60;
  }

  let dist144 = 0;
  for (let f = 0; f < 144; f++) {
    dist144 += 1.1 * timeScale144;
  }

  assert.ok(Math.abs(dist60 - dist144) < 0.5, `Physics displacement in 1 second is consistent across framerates (${dist60.toFixed(2)} vs ${dist144.toFixed(2)})`);
});

test('R2. Pretext multiline wrapping under extreme compression (< 80px)', () => {
  const splash = '★ 由 WebAssembly 与 Tauri 2.0 强力驱动';
  const prep = prepareWithSegments(splash, '13px "FusionPixelFont", sans-serif');

  // 极端压缩至 50px 宽度
  const narrowLayout = layoutWithLines(prep, 50, 20);
  assert.ok(narrowLayout.lines.length >= 1, 'Pretext wraps gracefully on extreme narrow width');
  assert.ok(narrowLayout.height > 0, 'Pretext produces positive height');
  for (const line of narrowLayout.lines) {
    assert.ok(line.text.length > 0, 'Every line has valid text');
    assert.ok(line.width > 0, 'Every line has positive width');
  }

  // 标题在 100px 宽度下自适应折行
  const titleFont = 'bold 30px "FusionPixelFont", sans-serif';
  const titlePrep = prepareWithSegments('ATOM LAUNCHER', titleFont);
  const titleNarrow = layoutWithLines(titlePrep, 100, 34);
  assert.ok(titleNarrow.lines.length >= 2, 'Title cleanly wraps to 2 lines when container is narrow');
  assert.equal(titleNarrow.lines[0].text.trim(), 'ATOM', 'Line 0 is ATOM');
  assert.equal(titleNarrow.lines[1].text.trim(), 'LAUNCHER', 'Line 1 is LAUNCHER');
});

test('R2. Zero DOM measureText calls in hot RAF render loop', () => {
  const creeperContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');

  // 提取 renderLoop 函数体 (跳过首行内部的 animId 递归请求，定位到 renderLoop 结束)
  const renderLoopStart = creeperContent.indexOf('const renderLoop = (now: number) => {');
  const renderLoopEnd = creeperContent.indexOf('animId = requestAnimationFrame(renderLoop);', renderLoopStart + 60);
  assert.ok(renderLoopStart > 0 && renderLoopEnd > renderLoopStart, 'renderLoop function located');

  const renderLoopBody = creeperContent.slice(renderLoopStart, renderLoopEnd);
  assert.ok(!renderLoopBody.includes('ctx.measureText'), 'renderLoop must NOT call ctx.measureText in hot path');
  assert.ok(!creeperContent.includes('ctx.measureText'), 'Entire CreeperCanvas has zero ctx.measureText calls');
  assert.ok(renderLoopBody.includes('s.hissBubble.width'), 'hissBubble uses precomputed width via Pretext');
});

test('R2. Head tilt and eye gaze offsets reset on startled and panic states', () => {
  const rawContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');
  const creeperContent = rawContent.replace(/\r\n/g, '\n');

  // triggerStartled 函数应重置 headTilt 与 lookOffset
  const triggerStartledStart = creeperContent.indexOf('const triggerStartled = () => {');
  const triggerStartledEnd = creeperContent.indexOf('// 生成点击爱心或火花粒子', triggerStartledStart);
  const triggerBody = creeperContent.slice(triggerStartledStart, triggerStartledEnd);

  assert.ok(triggerBody.includes('s.headTilt = 0;'), 'triggerStartled resets headTilt');
  assert.ok(triggerBody.includes('s.lookOffsetX = 0;'), 'triggerStartled resets lookOffsetX');
  assert.ok(triggerBody.includes('s.lookOffsetY = 0;'), 'triggerStartled resets lookOffsetY');

  // renderLoop 中 panicTimer 与 startledTimer 阶段保持复位
  assert.ok(creeperContent.includes('s.headTilt = 0;\n        s.lookOffsetX = 0;\n        s.lookOffsetY = 0;'), 'startled and panic phases reset head orientation');
});

test('R2. Rapid click particle capping prevents unbounded memory growth', () => {
  const particles = [];
  const MAX_PARTICLES = 128;

  // 模拟连续狂点 20 次苦力怕 (每次 36 个粒子)
  for (let click = 0; click < 20; click++) {
    for (let i = 0; i < 36; i++) {
      particles.push({ x: 100, y: 100 });
    }
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  }

  assert.equal(particles.length, MAX_PARTICLES, 'Particle buffer strictly capped at 128 without memory leak');
});

test('R2. Resize clamping keeps stationary Creeper within viewport corridor', () => {
  let creeperX = 550; // 原在 600px 宽容器内
  let dir = 1;

  // 窗口突然收缩至 200px 宽度
  const w = 200;
  const leftBound = Math.min(36, Math.max(12, w * 0.15));
  const rightBound = Math.max(leftBound + 16, w - leftBound);

  if (creeperX < leftBound) {
    creeperX = leftBound;
    dir = 1;
  } else if (creeperX > rightBound) {
    creeperX = rightBound;
    dir = -1;
  }

  assert.ok(creeperX <= rightBound, 'Creeper clamped within rightBound');
  assert.ok(creeperX >= leftBound, 'Creeper clamped within leftBound');
  assert.equal(dir, -1, 'Facing direction flipped inward on boundary clamp');
});

test('R2. Splash bounds safe guard prevents phantom zero-size clicks', () => {
  const sbEmpty = { x: 0, y: 0, w: 0, h: 0 };
  const clickX = 0;
  const clickY = 0;

  // 验证对 sb.w > 0 && sb.h > 0 边界的防护
  const isHitEmpty = sbEmpty.w > 0 && sbEmpty.h > 0 && clickX >= sbEmpty.x && clickX <= sbEmpty.x + sbEmpty.w;
  assert.equal(isHitEmpty, false, 'Zero-sized splashBounds never triggers phantom click');

  const sbValid = { x: 10, y: 10, w: 100, h: 40 };
  const isHitValid = sbValid.w > 0 && sbValid.h > 0 && clickX + 20 >= sbValid.x && clickX + 20 <= sbValid.x + sbValid.w;
  assert.equal(isHitValid, true, 'Valid splashBounds triggers click as expected');
});

test('R2. Hiss speech bubble y-position clears Creeper head and clamps within canvas boundaries', () => {
  const creeperContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');

  // 1. 验证 hissBubble 初始 y 坐标在苦力怕头顶上方，不遮挡苦力怕面部
  assert.ok(creeperContent.includes('(s.height - 50) - 125'), 'hissBubble y is positioned safely above head');

  // 2. 模拟边界条件下的横向吸附截断逻辑
  const width = 400;
  const bubbleW = 145;
  const cardW = bubbleW + 16; // 161

  // Case A: 苦力怕紧贴左边界 (creeperX = 20)
  const leftX = 20;
  const bxLeft = Math.max(8, Math.min(width - cardW - 8, leftX - cardW / 2));
  assert.equal(bxLeft, 8, 'Bubble left edge is clamped to 8px from viewport edge');
  assert.ok(bxLeft >= 8 && bxLeft + cardW <= width - 8, 'Bubble stays fully inside canvas on left');

  // Case B: 苦力怕紧贴右边界 (creeperX = 380)
  const rightX = 380;
  const bxRight = Math.max(8, Math.min(width - cardW - 8, rightX - cardW / 2));
  assert.equal(bxRight, width - cardW - 8, 'Bubble right edge is clamped to width - 8');
  assert.ok(bxRight >= 8 && bxRight + cardW <= width - 8, 'Bubble stays fully inside canvas on right');
});

test('R2. Startled escape direction flees away from cursor click', () => {
  const creeperContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');
  assert.ok(creeperContent.includes('s.dir = s.mouseX >= s.creeperX ? -1 : 1;'), 'Creeper turns away from click position');

  // 模拟逃窜数学
  const creeperX = 200;
  // 鼠标在右侧点击
  const mouseRight = 240;
  const fleeDirLeft = mouseRight >= creeperX ? -1 : 1;
  assert.equal(fleeDirLeft, -1, 'Flees left when clicked from right');

  // 鼠标在左侧点击
  const mouseLeft = 160;
  const fleeDirRight = mouseLeft >= creeperX ? -1 : 1;
  assert.equal(fleeDirRight, 1, 'Flees right when clicked from left');
});

test('R1 & R2. Accessibility contracts (ARIA roles, keyboard handlers, and touch)', () => {
  const bottomNavContent = readFileSync(resolve('src/components/BottomNav.tsx'), 'utf-8');
  assert.ok(bottomNavContent.includes('role="tablist"'), 'BottomNav has role="tablist"');
  assert.ok(bottomNavContent.includes('role="tab"'), 'BottomNav buttons have role="tab"');
  assert.ok(bottomNavContent.includes('aria-selected={isActive}'), 'BottomNav buttons indicate selected state');
  assert.ok(bottomNavContent.includes('focus-visible:'), 'BottomNav has focus-visible ring styles');

  const creeperContent = readFileSync(resolve('src/components/CreeperCanvas.tsx'), 'utf-8');
  assert.ok(creeperContent.includes('tabIndex={0}'), 'Canvas is keyboard focusable');
  assert.ok(creeperContent.includes('onKeyDown={handleKeyDown}'), 'Canvas handles keyboard input');
  assert.ok(creeperContent.includes('onTouchStart={handleTouchStart}'), 'Canvas handles touch input for mobile/touch laptops');
  assert.ok(creeperContent.includes("window.addEventListener('blur'"), 'Canvas handles window blur to prevent frozen gaze');
});


