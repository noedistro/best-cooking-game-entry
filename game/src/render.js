// render.js — every pixel of Nadia's Ember Kitchen, drawn on one canvas:
// the kitchen, the order board, the food, the chef, the HUD. Pure drawing
// from a view object; the same renderer draws live play and staged shots.
import { CANVAS_W, CANVAS_H, COLORS } from './config.js';
import { STATIONS } from './kitchen.js';

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, weight = '700', align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

// --- food sprites -----------------------------------------------------------
// Each ingredient is a chunky flat shape with a dark outline, drawn to look
// worth serving at thumbnail size. All art is original to this game.

export function drawFood(ctx, ingredient, cx, cy, size) {
  const s = size / 2;
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineJoin = 'round';
  switch (ingredient) {
    case 'rice': {
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.3, s, s * 0.55, 0, Math.PI, 0);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8d9b0';
      for (const [dx, dy] of [[-0.4, -0.1], [0, -0.35], [0.4, -0.1], [-0.15, 0.05], [0.2, 0.1]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, s * 0.12, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'noodles': {
      ctx.strokeStyle = '#e8a91c';
      ctx.lineWidth = Math.max(2, size * 0.09);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = cy - s * 0.4 + i * s * 0.45;
        ctx.moveTo(cx - s * 0.8, y);
        ctx.bezierCurveTo(cx - s * 0.3, y - s * 0.35, cx + s * 0.3, y + s * 0.35, cx + s * 0.8, y);
      }
      ctx.stroke();
      break;
    }
    case 'flatbread': {
      ctx.fillStyle = '#e0aa6a';
      ctx.beginPath(); ctx.ellipse(cx, cy, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a86a2e';
      for (const [dx, dy] of [[-0.4, -0.2], [0.1, 0.1], [0.45, -0.25]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, s * 0.13, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'chicken': {
      ctx.fillStyle = '#c97b2e';
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.9, s * 0.65, -0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8a54b';
      ctx.beginPath(); ctx.ellipse(cx - s * 0.15, cy - s * 0.15, s * 0.45, s * 0.3, -0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fish': {
      ctx.fillStyle = '#7fa8b8';
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.9, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.8, cy);
      ctx.lineTo(cx + s * 1.25, cy - s * 0.55);
      ctx.lineTo(cx + s * 1.25, cy + s * 0.55);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath(); ctx.arc(cx - s * 0.45, cy - s * 0.08, s * 0.09, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'tofu': {
      ctx.fillStyle = '#fdf8ec';
      ctx.beginPath(); ctx.rect(cx - s * 0.7, cy - s * 0.55, s * 1.4, s * 1.1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath(); ctx.rect(cx - s * 0.7, cy + s * 0.2, s * 1.4, s * 0.35); ctx.fill();
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#8a5a34';
      ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.15, s * 0.85, s * 0.55, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2e3c8';
      ctx.beginPath(); ctx.rect(cx - s * 0.22, cy - s * 0.1, s * 0.44, s * 0.7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'greens': {
      ctx.fillStyle = '#4d9e4d';
      for (const [dx, dy, rot] of [[-0.4, 0.1, -0.5], [0, -0.3, 0], [0.4, 0.15, 0.5]]) {
        ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, s * 0.42, s * 0.22, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'chilli': {
      ctx.fillStyle = '#d93a2b';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.7, cy - s * 0.5);
      ctx.quadraticCurveTo(cx + s * 0.9, cy - s * 0.7, cx + s * 0.7, cy + s * 0.5);
      ctx.quadraticCurveTo(cx + s * 0.2, cy + s * 0.75, cx - s * 0.7, cy + s * 0.2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3f7a34';
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy - s * 0.5); ctx.quadraticCurveTo(cx - s * 1, cy - s * 0.8, cx - s * 0.7, cy - s * 0.9); ctx.stroke();
      break;
    }
    case 'sauce': {
      ctx.fillStyle = '#e8632c';
      for (const [dx, dy, r] of [[-0.35, 0.1, 0.32], [0.1, -0.25, 0.38], [0.45, 0.2, 0.28]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#ffb08a';
      ctx.beginPath(); ctx.arc(cx - s * 0.1, cy - s * 0.35, s * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = '#cccccc';
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
}

// A plate with its layers stacked: base at the bottom, topping on top.
export function drawPlate(ctx, cx, cy, layers, scale = 1) {
  const w = 92 * scale;
  const h = 30 * scale;
  ctx.fillStyle = '#fff8e7';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8d9b0';
  ctx.beginPath(); ctx.ellipse(cx, cy, w / 2 - 8 * scale, h / 2 - 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
  const n = layers.length;
  layers.forEach((ingredient, i) => {
    const ly = cy - 8 * scale - i * 10 * scale;
    drawFood(ctx, ingredient, cx, ly, 44 * scale);
  });
  if (n === 0) {
    text(ctx, 'empty plate', cx, cy + 4 * scale, 13 * scale, '#a97e4f', '700', 'center');
  }
}

// Nadia: a chunky cook in an ember-orange apron and headscarf.
export function drawChef(ctx, chef, held, t = 0) {
  const { x, y } = chef;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x, y + 34, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.ink;
  // Apron body.
  ctx.fillStyle = COLORS.ember;
  roundRect(ctx, x - 20, y - 6, 40, 40, 10);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f7ead2';
  roundRect(ctx, x - 13, y + 8, 26, 22, 6);
  ctx.fill(); ctx.stroke();
  // Head + headscarf.
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(x, y - 20, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.emberDeep;
  ctx.beginPath(); ctx.arc(x, y - 23, 15, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  const look = chef.facing >= 0 ? 4 : -4;
  ctx.beginPath(); ctx.arc(x - 5 + look, y - 20, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 5 + look, y - 20, 1.8, 0, Math.PI * 2); ctx.fill();
  // The held item rides above her head.
  if (held) {
    const bob = Math.sin(t * 3) * 2;
    if (held.kind === 'plate') {
      drawPlate(ctx, x, y - 58 + bob, held.plate.layers, 0.62);
    } else {
      drawFood(ctx, held.ingredient, x, y - 52 + bob, 34);
      if (held.state === 'chopped') {
        text(ctx, 'chopped', x, y - 74 + bob, 11, COLORS.cream, '700', 'center');
      } else if (held.state === 'cooked') {
        text(ctx, 'cooked', x, y - 74 + bob, 11, COLORS.gold, '700', 'center');
      } else if (held.state === 'burnt') {
        text(ctx, 'burnt!', x, y - 74 + bob, 11, COLORS.red, '700', 'center');
      }
    }
  }
}

function drawStationBase(ctx, station, label) {
  ctx.fillStyle = COLORS.counter;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, station.x, station.y, station.w, station.h, 12);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.counterEdge;
  roundRect(ctx, station.x, station.y, station.w, 14, 7);
  ctx.fill();
  text(ctx, label, station.x + station.w / 2, station.y + station.h + 20, 15, COLORS.cream, '700', 'center');
}

function drawRing(ctx, cx, cy, radius, fraction, color) {
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, fraction))); ctx.stroke();
}

function drawSteam(ctx, x, y, t) {
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 12;
    const phase = (t * 0.9 + i * 0.33) % 1;
    const sy = y - phase * 26;
    ctx.globalAlpha = 0.75 * (1 - phase);
    ctx.beginPath();
    ctx.moveTo(x + ox, y);
    ctx.quadraticCurveTo(x + ox + 6, y - 13, x + ox - 3, sy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- stations ----------------------------------------------------------------

function drawPantry(ctx, station) {
  drawStationBase(ctx, station, 'PANTRY');
  const crates = ['rice', 'noodles', 'flatbread', 'chicken', 'fish', 'tofu', 'mushroom', 'greens', 'chilli', 'sauce'];
  // Ingredient crates in a grid; chilli and sauce sit on the bottom row.
  crates.forEach((ingredient, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = station.x + 34 + col * 56;
    const cy = station.y + 40 + row * 58;
    ctx.fillStyle = '#d9b98a';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    roundRect(ctx, cx - 24, cy - 24, 48, 48, 8);
    ctx.fill(); ctx.stroke();
    drawFood(ctx, ingredient, cx, cy - 2, 30);
  });
}

function drawChopping(ctx, station, chop) {
  drawStationBase(ctx, station, 'CHOPPING BOARD');
  ctx.fillStyle = '#c98f4e';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, station.x + 30, station.y + 30, station.w - 60, 56, 10);
  ctx.fill(); ctx.stroke();
  if (chop) {
    drawFood(ctx, chop.ingredient, station.x + station.w / 2, station.y + 58, 40);
    if (!chop.done) drawRing(ctx, station.x + station.w / 2, station.y + 58, 30, chop.progress, COLORS.gold);
    else text(ctx, 'ready', station.x + station.w / 2, station.y + 100, 13, COLORS.green, '700', 'center');
  } else {
    text(ctx, 'chop here', station.x + station.w / 2, station.y + 62, 14, '#8a6a42', '700', 'center');
  }
}

function drawGrill(ctx, station, job, t) {
  drawStationBase(ctx, station, 'CHARCOAL GRILL');
  // Glowing coals under the grate.
  ctx.fillStyle = '#3a1c10';
  roundRect(ctx, station.x + 24, station.y + 34, station.w - 48, 52, 10);
  ctx.fill();
  const glow = 0.55 + 0.35 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(232,99,44,${glow.toFixed(2)})`;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(station.x + 44 + i * 30, station.y + 60, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (job) {
    drawFood(ctx, job.ingredient, station.x + station.w / 2, station.y + 60, 40);
    const fraction = job.state === 'burnt' ? 1 : job.elapsed / job.readyAt;
    const color = job.state === 'burnt' ? COLORS.red : job.state === 'ready' ? COLORS.green : COLORS.gold;
    drawRing(ctx, station.x + station.w / 2, station.y + 60, 32, fraction, color);
    if (job.state === 'burnt') text(ctx, 'BURNT', station.x + station.w / 2, station.y + 104, 14, COLORS.red, '800', 'center');
    else if (job.state === 'ready') text(ctx, 'READY', station.x + station.w / 2, station.y + 104, 14, COLORS.green, '800', 'center');
  }
}

function drawPot(ctx, station, job, t) {
  drawStationBase(ctx, station, 'STOVE POT');
  ctx.fillStyle = '#5a5f6a';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(station.x + station.w / 2, station.y + 62, 62, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3c4048';
  ctx.beginPath(); ctx.ellipse(station.x + station.w / 2, station.y + 56, 52, 20, 0, 0, Math.PI * 2); ctx.fill();
  if (job) {
    drawSteam(ctx, station.x + station.w / 2, station.y + 36, t);
    drawFood(ctx, job.ingredient, station.x + station.w / 2, station.y + 58, 34);
    const fraction = job.state === 'burnt' ? 1 : job.elapsed / job.readyAt;
    const color = job.state === 'burnt' ? COLORS.red : job.state === 'ready' ? COLORS.green : COLORS.gold;
    drawRing(ctx, station.x + station.w / 2, station.y + 58, 30, fraction, color);
    if (job.state === 'burnt') text(ctx, 'BURNT', station.x + station.w / 2, station.y + 104, 14, COLORS.red, '800', 'center');
    else if (job.state === 'ready') text(ctx, 'READY', station.x + station.w / 2, station.y + 104, 14, COLORS.green, '800', 'center');
  } else {
    drawSteam(ctx, station.x + station.w / 2, station.y + 36, t);
  }
}

function drawPlating(ctx, station, plate, counterIngredients) {
  drawStationBase(ctx, station, 'PLATING COUNTER');
  // Bowls of ingredients laid out ON the counter surface.
  (counterIngredients ?? []).slice(0, 4).forEach((ingredient, i) => {
    const cx = station.x + 52 + i * 62;
    const cy = station.y + 38;
    ctx.fillStyle = '#fff8e7';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawFood(ctx, ingredient, cx, cy, 28);
  });
  // The plate being assembled, mid-counter.
  if (plate && plate.layers.length > 0) {
    drawPlate(ctx, station.x + station.w / 2 + 60, station.y + 72, plate.layers, 0.9);
    text(ctx, `${plate.layers.length}/3 layers`, station.x + station.w / 2 + 60, station.y + 108, 12, COLORS.ink, '700', 'center');
  } else {
    drawPlate(ctx, station.x + station.w / 2 + 60, station.y + 72, [], 0.9);
  }
  // The bin: a small disposal slot at the counter's right end.
  ctx.fillStyle = '#3c4048';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  roundRect(ctx, 700, station.y + 8, 52, 40, 6);
  ctx.fill(); ctx.stroke();
  text(ctx, 'BIN', 726, station.y + 32, 12, '#cfd4da', '800', 'center');
}

function drawWindow(ctx, station, windowDish, tipPopup, t) {
  drawStationBase(ctx, station, 'SERVING WINDOW');
  // Nadia's sign above the window.
  ctx.fillStyle = '#7a4a22';
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  roundRect(ctx, station.x - 8, station.y - 34, station.w + 16, 26, 8);
  ctx.fill(); ctx.stroke();
  text(ctx, "NADIA'S EMBER KITCHEN", station.x + station.w / 2, station.y - 15, 12, COLORS.cream, '800', 'center');
  // The bell.
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath(); ctx.arc(station.x + 24, station.y + 26, 10, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COLORS.ink;
  ctx.beginPath(); ctx.arc(station.x + 24, station.y + 38, 2.5, 0, Math.PI * 2); ctx.fill();
  if (windowDish) {
    drawPlate(ctx, station.x + station.w / 2 + 10, station.y + 66, windowDish.layers ?? ['rice', 'chicken', 'greens'], 0.85);
    text(ctx, 'READY TO SERVE', station.x + station.w / 2, station.y + 96, 12, COLORS.green, '800', 'center');
    if (tipPopup) {
      const bob = Math.sin(t * 4) * 3;
      text(ctx, tipPopup, station.x + station.w / 2, station.y + 20 + bob, 22, COLORS.gold, '800', 'center');
    }
  } else {
    text(ctx, 'serve here', station.x + station.w / 2, station.y + 62, 14, '#8a6a42', '700', 'center');
  }
}

// --- order board + HUD -------------------------------------------------------

function drawTicket(ctx, ticket, x, y, w, h) {
  const urgent = ticket.patience <= 10;
  ctx.fillStyle = ticket.state === 'expired' ? '#d8cbb2' : COLORS.board;
  ctx.strokeStyle = urgent ? COLORS.red : COLORS.ink;
  ctx.lineWidth = urgent ? 3 : 2;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill(); ctx.stroke();
  const alpha = ticket.state === 'expired' ? 0.45 : 1;
  ctx.globalAlpha = alpha;
  text(ctx, ticket.recipeName, x + 10, y + 20, 14, COLORS.ink, '800');
  drawFood(ctx, ticket.base, x + 16, y + 44, 26);
  drawFood(ctx, ticket.main, x + 48, y + 44, 26);
  drawFood(ctx, ticket.topping, x + 80, y + 44, 26);
  text(ctx, `TIP ${ticket.tip ?? ''}`, x + w - 10, y + 20, 13, '#8a6a42', '700', 'right');
  // Patience bar.
  const fraction = ticket.maxPatience > 0 ? ticket.patience / ticket.maxPatience : 0;
  const barColor = fraction > 0.5 ? COLORS.green : fraction > 0.2 ? COLORS.gold : COLORS.red;
  ctx.fillStyle = '#e0d3b8';
  roundRect(ctx, x + 10, y + h - 18, w - 20, 9, 4);
  ctx.fill();
  ctx.fillStyle = barColor;
  roundRect(ctx, x + 10, y + h - 18, Math.max(0, (w - 20) * fraction), 9, 4);
  ctx.fill();
  if (urgent && ticket.state !== 'expired') {
    text(ctx, `${Math.ceil(ticket.patience)}s`, x + w - 10, y + h - 24, 12, COLORS.red, '800', 'right');
  }
  ctx.globalAlpha = 1;
}

function drawBoard(ctx, view) {
  ctx.fillStyle = COLORS.tealDeep;
  roundRect(ctx, 12, 8, CANVAS_W - 24, 100, 14);
  ctx.fill();
  ctx.strokeStyle = view.rush ? COLORS.red : COLORS.ink;
  ctx.lineWidth = view.rush ? 3 : 2;
  ctx.stroke();
  text(ctx, view.rush ? 'ORDERS — RUSH!' : 'ORDERS', 28, 32, 15, view.rush ? COLORS.red : COLORS.cream, '800');
  text(ctx, `served ${view.served}  ·  live ${view.tickets.length}`, 28, 52, 13, '#9fc4bd', '700');
  text(ctx, `SCORE ${view.score}`, 28, 74, 14, COLORS.cream, '800');
  text(ctx, `COINS ${view.coins}`, 28, 94, 13, COLORS.gold, '700');
  const tickets = view.tickets.slice(0, 4);
  tickets.forEach((ticket, i) => {
    drawTicket(ctx, ticket, 210 + i * 258, 16, 246, 84);
  });
}

function drawHud(ctx, view) {
  // Shift timer, big and top-centre.
  const remaining = view.remaining;
  const color = remaining > 60 ? COLORS.green : remaining > 30 ? COLORS.gold : COLORS.red;
  const pulse = remaining <= 30 ? 1 + 0.08 * Math.sin(view.t * 6) : 1;
  ctx.save();
  ctx.translate(CANVAS_W / 2, 152);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(13,54,52,0.9)';
  roundRect(ctx, -78, -30, 156, 44, 12);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, formatTime(remaining), 0, 2, 30, color, '800', 'center');
  ctx.restore();
  // Streak flame, top-right, clear of the board.
  if (view.streak >= 2) {
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.moveTo(1240, 138);
    ctx.quadraticCurveTo(1252, 152, 1248, 166);
    ctx.quadraticCurveTo(1240, 172, 1232, 166);
    ctx.quadraticCurveTo(1228, 152, 1240, 138);
    ctx.fill();
    text(ctx, `STREAK x${Math.min(3, view.streak)}`, 1224, 150, 16, COLORS.gold, '800', 'right');
  }
  text(ctx, 'WASD move · E interact · M mute · R restart', CANVAS_W / 2, 700, 13, 'rgba(247,234,210,0.75)', '700', 'center');
}

function drawParticles(ctx, particles) {
  for (const p of particles ?? []) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color ?? COLORS.cream;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size ?? 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, popups) {
  for (const p of popups ?? []) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    text(ctx, p.label, p.x, p.y, 22, COLORS.gold, '800', 'center');
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(ctx, lines, title) {
  ctx.fillStyle = 'rgba(13, 30, 28, 0.82)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = COLORS.board;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 3;
  roundRect(ctx, CANVAS_W / 2 - 330, 150, 660, 380, 18);
  ctx.fill(); ctx.stroke();
  text(ctx, title, CANVAS_W / 2, 220, 40, COLORS.emberDeep, '800', 'center');
  lines.forEach((line, i) => {
    text(ctx, line, CANVAS_W / 2, 280 + i * 34, 19, COLORS.ink, '700', 'center');
  });
}

// --- the whole frame ---------------------------------------------------------

export function drawGame(ctx, view) {
  const t = view.t ?? 0;
  // Wall + floor.
  const wall = ctx.createLinearGradient(0, 0, 0, 200);
  wall.addColorStop(0, '#1d4f4c');
  wall.addColorStop(1, '#14524f');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // String lights along the top.
  for (let i = 0; i < 16; i++) {
    const x = 50 + i * 78;
    const y = 116 + Math.sin(i * 1.7) * 6;
    ctx.fillStyle = i % 2 === 0 ? COLORS.gold : COLORS.ember;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Tiled floor.
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#2a6a63' : '#245c56';
      ctx.fillRect(col * 128, 200 + row * 104, 128, 104);
    }
  }
  drawBoard(ctx, view);
  const byId = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  drawPantry(ctx, byId.pantry);
  drawChopping(ctx, byId.chopping, view.chop);
  drawGrill(ctx, byId.grill, view.grill, t);
  drawPot(ctx, byId.pot, view.pot, t);
  drawPlating(ctx, byId.plating, view.plate, view.counterIngredients);
  drawWindow(ctx, byId.window, view.windowDish, view.tipPopup, t);
  drawChef(ctx, view.chef, view.chef.held, t);
  drawParticles(ctx, view.particles);
  drawPopups(ctx, view.popups);
  drawHud(ctx, view);
  if (view.mode === 'title') {
    drawOverlay(ctx, [
      'The dinner rush is on at the rooftop night market in Teluk Arang.',
      'Walk the loop: pantry, chopping board, grill and pot, then plate',
      'and serve before patience runs out. Three rushes. One 180-second shift.',
      '',
      'Press Enter or click to start',
    ], "NADIA'S EMBER KITCHEN");
  } else if (view.mode === 'results' && view.results) {
    const r = view.results;
    drawOverlay(ctx, [
      `Dishes served: ${r.served}`,
      `Best streak: ${r.bestStreak}  ·  Coins earned: ${r.coins}`,
      `Score: ${r.score}  ·  Grade: ${r.grade}`,
      '',
      'Press R to play again',
    ], 'SHIFT COMPLETE');
  }
}
