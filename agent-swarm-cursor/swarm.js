/*
 * Agent Swarm Build — 让一群彩色鼠标"把当前网页从零搭出来"的演示动画。
 * 用法：在任意页面的 DevTools Console 里粘贴本文件全部内容并回车；
 *      或在自己的页面里 <script src="swarm.js"></script>，再调用 AgentSwarm.start()。
 */
(function () {
  if (window.AgentSwarm && window.AgentSwarm.running) window.AgentSwarm.stop();

  const DEFAULTS = {
    startAgents: 6,
    maxAgents: 80,
    spawnEveryMs: 350,
    speed: 1,
    touring: true,
    autoStart: !document.currentScript || !document.currentScript.hasAttribute('data-manual'),
    colors: ['#ff4fd8', '#4fd1ff', '#ffe14f', '#7dff6b', '#ff8a4f', '#b48cff', '#4fffc4', '#ff5f6b', '#9ad0ff', '#ffffff'],
    names: ['设计', '布局', '文案', '配色', '组件', '动效', '审阅', '图像', '排版', '交互'],
  };

  const ROOT_ID = 'agent-swarm-root';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'HEAD', 'BR', 'IFRAME']);
  const MEDIA_TAGS = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'PICTURE', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'HR']);

  let cfg, root, hud, logBox, state;

  function css() {
    return `
[data-swarm="hidden"]{visibility:hidden!important}
[data-swarm="text"]{animation:swarm-type var(--swarm-dur,600ms) steps(var(--swarm-steps,12)) both}
[data-swarm="media"]{animation:swarm-wipe var(--swarm-dur,600ms) cubic-bezier(.2,.7,.2,1) both}
[data-swarm="block"]{animation:swarm-fade var(--swarm-dur,600ms) ease-out both}
@keyframes swarm-type{from{clip-path:inset(0 var(--swarm-from,100%) 0 0)}to{clip-path:inset(0 var(--swarm-to,0px) 0 0)}}
@keyframes swarm-wipe{from{clip-path:inset(0 0 100% 0);filter:blur(8px) saturate(0)}to{clip-path:inset(0 0 0 0);filter:none}}
@keyframes swarm-fade{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}
#${ROOT_ID}{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
#${ROOT_ID} .sw-cursor{position:absolute;left:0;top:0;width:18px;height:18px;will-change:transform;filter:drop-shadow(0 0 6px var(--c))}
#${ROOT_ID} .sw-box{position:absolute;border:1px solid var(--c);background:color-mix(in srgb,var(--c) 8%,transparent);box-shadow:0 0 0 1px rgba(0,0,0,.25)}
#${ROOT_ID} .sw-box::before,#${ROOT_ID} .sw-box::after{content:"";position:absolute;width:5px;height:5px;background:#fff;border:1px solid var(--c)}
#${ROOT_ID} .sw-box::before{left:-4px;top:-4px}#${ROOT_ID} .sw-box::after{right:-4px;bottom:-4px}
#${ROOT_ID} .sw-dim{position:absolute;left:50%;bottom:-20px;transform:translateX(-50%);padding:1px 5px;border-radius:3px;background:var(--c);color:#000;white-space:nowrap}
#${ROOT_ID} .sw-caret{position:absolute;width:2px;background:var(--c);animation:swarm-blink .5s steps(1) infinite}
#${ROOT_ID} .sw-plus{position:absolute;color:var(--c);font:14px monospace;animation:swarm-plus .9s ease-out forwards}
@keyframes swarm-blink{50%{opacity:0}}
@keyframes swarm-plus{from{opacity:1;transform:translate(0,0) scale(1)}to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}
#agent-swarm-hud{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;display:flex;gap:12px;align-items:center;padding:8px 14px;border-radius:999px;background:rgba(14,14,18,.88);backdrop-filter:blur(10px);color:#ddd;font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 8px 30px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08)}
#agent-swarm-hud b{color:#fff}
#agent-swarm-hud .sw-dots{display:flex}
#agent-swarm-hud .sw-dots i{width:8px;height:8px;border-radius:50%;margin-left:-2px;border:1px solid #111}
#agent-swarm-hud .sw-bar{width:90px;height:4px;border-radius:2px;background:#333;overflow:hidden}
#agent-swarm-hud .sw-bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#4fd1ff,#ff4fd8);transition:width .2s}
#agent-swarm-hud button{all:unset;cursor:pointer;padding:4px 8px;border-radius:6px;background:#26262e;color:#ddd}
#agent-swarm-hud button.on{background:#2b5cff;color:#fff}
#agent-swarm-log{position:fixed;right:18px;top:50%;transform:translateY(-50%);z-index:2147483647;display:flex;flex-direction:column;gap:6px;pointer-events:none;font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
#agent-swarm-log div{padding:4px 8px;border-radius:6px;background:rgba(14,14,18,.75);color:#ccc;border-left:2px solid var(--c);animation:swarm-fade .25s ease-out both;transition:opacity .4s}
`;
  }

  function cursorSVG(color) {
    return `<svg viewBox="0 0 18 18" width="18" height="18"><path d="M2 1.5 L2 15 L5.8 11.4 L8.3 16.6 L10.6 15.5 L8.2 10.4 L13.5 10.4 Z" fill="${color}" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>`;
  }

  function ownText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }

  function hasPaint(cs) {
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return true;
    return parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
  }

  function collectLayers() {
    const out = [];
    const walk = (el) => {
      if (el.id === ROOT_ID || el.id === 'agent-swarm-hud' || el.id === 'agent-swarm-log') return;
      if (SKIP_TAGS.has(el.tagName)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      const visible = r.width > 2 && r.height > 2;
      const tag = el.tagName.toUpperCase();
      let kind = null;
      if (MEDIA_TAGS.has(tag)) kind = 'media';
      else if (ownText(el)) kind = 'text';
      else if (visible && el !== document.body && el !== document.documentElement && hasPaint(cs)) kind = 'block';
      if (kind && visible) out.push({ el, kind, tag: tag.toLowerCase() });
      if (tag === 'SVG' || kind === 'media') return;
      for (const c of el.children) walk(c);
    };
    walk(document.body);
    return out;
  }

  function pageRect(el, kind) {
    let r = el.getBoundingClientRect();
    if (kind === 'text') {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tr = range.getBoundingClientRect();
      if (tr.width > 2 && tr.height > 2) r = tr;
    }
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  }

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms / cfg.speed));
  const rand = (a, b) => a + Math.random() * (b - a);

  function animateTo(agent, x, y) {
    const sx = agent.x, sy = agent.y;
    const dist = Math.hypot(x - sx, y - sy);
    const dur = Math.min(900, 180 + dist * 0.45) / cfg.speed;
    const bend = rand(-0.25, 0.25) * dist;
    const nx = -(y - sy) / (dist || 1), ny = (x - sx) / (dist || 1);
    const cx = (sx + x) / 2 + nx * bend, cy = (sy + y) / 2 + ny * bend;
    const t0 = performance.now();
    return new Promise((res) => {
      const step = (now) => {
        if (!state.running) return res();
        let t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const u = 1 - e;
        agent.x = u * u * sx + 2 * u * e * cx + e * e * x;
        agent.y = u * u * sy + 2 * u * e * cy + e * e * y;
        agent.node.style.transform = `translate(${agent.x}px,${agent.y}px)`;
        t < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }

  function burst(agent, x, y) {
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      p.className = 'sw-plus';
      p.textContent = '+';
      p.style.cssText = `left:${x}px;top:${y}px;--c:${agent.color};--dx:${rand(-30, 30)}px;--dy:${rand(-30, 30)}px`;
      root.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }

  function log(agent, text) {
    const d = document.createElement('div');
    d.style.setProperty('--c', agent.color);
    d.textContent = `${agent.name} · ${text}`;
    logBox.appendChild(d);
    while (logBox.children.length > 6) logBox.firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); }, 2200 / cfg.speed);
  }

  async function work(layer, agent) {
    const r = pageRect(layer.el, layer.kind);
    await animateTo(agent, r.x + Math.min(r.w, 12), r.y + Math.min(r.h, 10));
    if (!state.running) return;

    const box = document.createElement('div');
    box.className = 'sw-box';
    box.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;--c:${agent.color}`;
    box.innerHTML = `<span class="sw-dim">${Math.round(r.w)} × ${Math.round(r.h)}</span>`;
    root.appendChild(box);
    burst(agent, r.x, r.y);
    log(agent, layer.kind === 'text' ? `正在写 <${layer.tag}>` : layer.kind === 'media' ? `正在放置 <${layer.tag}>` : `正在搭建 <${layer.tag}>`);

    const chars = layer.kind === 'text' ? layer.el.textContent.trim().length : 0;
    const dur = layer.kind === 'text' ? Math.min(1400, 120 + chars * 28) : layer.kind === 'media' ? 700 : 450;
    layer.el.style.setProperty('--swarm-dur', dur / cfg.speed + 'ms');
    layer.el.style.setProperty('--swarm-steps', Math.max(4, Math.min(40, chars)));
    if (layer.kind === 'text') {
      const elRight = layer.el.getBoundingClientRect().right + scrollX;
      layer.el.style.setProperty('--swarm-from', Math.max(0, elRight - r.x) + 'px');
      layer.el.style.setProperty('--swarm-to', Math.max(0, elRight - r.x - r.w - 2) + 'px');
    }
    layer.el.setAttribute('data-swarm', layer.kind);

    if (layer.kind === 'text') {
      const caret = document.createElement('div');
      caret.className = 'sw-caret';
      const lh = Math.min(r.h, 28);
      caret.style.cssText = `top:${r.y + (r.h - lh) / 2}px;height:${lh}px;--c:${agent.color}`;
      root.appendChild(caret);
      const t0 = performance.now();
      const realDur = dur / cfg.speed;
      await new Promise((res) => {
        const step = (now) => {
          const t = Math.min(1, (now - t0) / realDur);
          const cx = r.x + r.w * t;
          caret.style.left = cx + 'px';
          agent.x = cx; agent.y = r.y + r.h * 0.6;
          agent.node.style.transform = `translate(${agent.x}px,${agent.y}px)`;
          t < 1 && state.running ? requestAnimationFrame(step) : res();
        };
        requestAnimationFrame(step);
      });
      caret.remove();
      layer.el.setAttribute('data-swarm', 'done');
    } else {
      await animateTo(agent, r.x + r.w - 4, r.y + r.h - 4);
      await sleep(Math.max(0, dur - 300));
    }

    state.done++;
    state.frontierY = Math.max(state.frontierY, r.y);
    renderHud();
    await sleep(rand(80, 260));
    box.remove();
  }

  async function agentLoop(agent) {
    while (state.running) {
      const layer = state.queue.shift();
      if (!layer) break;
      await work(layer, agent);
    }
    if (!state.queue.length && state.running) {
      agent.node.style.transition = 'opacity .6s';
      agent.node.style.opacity = '0';
    }
  }

  function spawnAgent() {
    const i = state.agents.length;
    const color = cfg.colors[i % cfg.colors.length];
    const node = document.createElement('div');
    node.className = 'sw-cursor';
    node.style.setProperty('--c', color);
    node.innerHTML = cursorSVG(color);
    const x = scrollX + rand(0, innerWidth), y = scrollY + innerHeight + 20;
    node.style.transform = `translate(${x}px,${y}px)`;
    root.appendChild(node);
    const agent = { node, color, x, y, name: `${cfg.names[i % cfg.names.length]}#${i + 1}` };
    state.agents.push(agent);
    renderHud();
    agentLoop(agent);
  }

  function renderHud() {
    if (!hud) return;
    const dots = state.agents.slice(-6).map((a) => `<i style="background:${a.color}"></i>`).join('');
    hud.querySelector('.sw-dots').innerHTML = dots;
    hud.querySelector('.sw-agents').textContent = state.agents.length;
    hud.querySelector('.sw-done').textContent = state.done;
    hud.querySelector('.sw-total').textContent = state.total;
    hud.querySelector('.sw-bar span').style.width = (100 * state.done) / Math.max(1, state.total) + '%';
    hud.querySelector('.sw-tour').classList.toggle('on', cfg.touring);
    hud.querySelector('.sw-speed').textContent = cfg.speed + 'x';
  }

  function buildHud() {
    hud = document.createElement('div');
    hud.id = 'agent-swarm-hud';
    hud.innerHTML = `<span class="sw-dots"></span><span><b class="sw-agents">0</b> agents</span>
<span><b class="sw-done">0</b> / <span class="sw-total">0</span> layers</span><span class="sw-bar"><span></span></span>
<button class="sw-tour">Touring</button><button class="sw-speed">1x</button><button class="sw-close">✕</button>`;
    hud.querySelector('.sw-tour').onclick = () => { cfg.touring = !cfg.touring; renderHud(); };
    hud.querySelector('.sw-speed').onclick = () => { cfg.speed = cfg.speed >= 4 ? 1 : cfg.speed * 2; renderHud(); };
    hud.querySelector('.sw-close').onclick = () => stop();
    document.body.appendChild(hud);
    logBox = document.createElement('div');
    logBox.id = 'agent-swarm-log';
    document.body.appendChild(logBox);
  }

  function tour() {
    if (!state.running) return;
    if (cfg.touring && !state.userScrolling) {
      const target = Math.max(0, state.frontierY - innerHeight * 0.45);
      if (Math.abs(target - scrollY) > 40) scrollTo({ top: target, behavior: 'smooth' });
    }
    state.tourTimer = setTimeout(tour, 900 / cfg.speed);
  }

  function start(options) {
    cfg = Object.assign({}, DEFAULTS, window.AGENT_SWARM_OPTIONS || {}, options || {});
    const style = document.createElement('style');
    style.id = 'agent-swarm-style';
    style.textContent = css();
    document.head.appendChild(style);

    const layers = collectLayers();
    layers.forEach((l) => l.el.setAttribute('data-swarm', 'hidden'));
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
    state = { running: true, queue: layers.slice(), total: layers.length, done: 0, agents: [], frontierY: 0, timers: [] };
    window.AgentSwarm.running = true;
    buildHud();
    scrollTo({ top: 0 });

    let wheelTimer;
    state.onWheel = () => {
      state.userScrolling = true;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => (state.userScrolling = false), 2500);
    };
    addEventListener('wheel', state.onWheel, { passive: true });
    addEventListener('touchmove', state.onWheel, { passive: true });

    for (let i = 0; i < cfg.startAgents; i++) spawnAgent();
    const grow = () => {
      if (!state.running || !state.queue.length) return;
      if (state.agents.length < cfg.maxAgents && state.queue.length > state.agents.length) spawnAgent();
      state.timers.push(setTimeout(grow, cfg.spawnEveryMs / cfg.speed));
    };
    grow();
    tour();
  }

  function stop() {
    if (!state) return;
    state.running = false;
    window.AgentSwarm.running = false;
    clearTimeout(state.tourTimer);
    state.timers.forEach(clearTimeout);
    removeEventListener('wheel', state.onWheel);
    removeEventListener('touchmove', state.onWheel);
    document.querySelectorAll('[data-swarm]').forEach((el) => {
      el.removeAttribute('data-swarm');
      el.style.removeProperty('--swarm-dur');
      el.style.removeProperty('--swarm-steps');
      el.style.removeProperty('--swarm-from');
      el.style.removeProperty('--swarm-to');
    });
    [root, hud, logBox, document.getElementById('agent-swarm-style')].forEach((n) => n && n.remove());
    hud = null;
  }

  window.AgentSwarm = { start, stop, running: false };
  if (DEFAULTS.autoStart) {
    document.readyState === 'loading' ? addEventListener('DOMContentLoaded', () => start()) : start();
  }
})();
