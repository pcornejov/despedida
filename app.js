/* ====== Config ====== */
const SHEET_ID = '1QsCMokPw_Kpv9nr3WQBInBhid-O3YT-yo61S1rlbFpw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const CUOTA = 30000;
const REFRESH_MS = 60000;
// Fecha exacta aún no confirmada; solo se sabe el mes.
const DESPEDIDA_TARGET = new Date(2026, 10, 1);

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MILESTONE_MSGS = [
  [100, '🎉 ¡SE ARMÓ! La vaca está completa, nos vemos en la despedida'],
  [75, '🍾 ¡Hay pisco asegurado! Falta el último empujón'],
  [50, '🥩 ¡Hay asado! Vamos por la mitad, no aflojen'],
  [25, '🏠 ¡Aseguramos la cabaña! Sigan transfiriendo'],
  [0, '🐣 Recién empezando… ya po cabros, transfieran, no sean patúos'],
];

const AVATAR_COLORS = ['#FF0A3C', '#FF2FA0', '#FFD700', '#39FF14', '#FF6B35', '#C41E3A', '#FF4D8D', '#B0083F'];

let sortState = { key: 'progress', dir: 'desc' };

const $ = (id) => document.getElementById(id);
const clp = (n) => '$' + n.toLocaleString('es-CL');
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ====== CSV ====== */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

/* ====== Stats ====== */
function buildStats(rows) {
  const header = rows[0];
  const months = header.slice(1).filter((m) => m.trim() !== '');
  const now = new Date();
  const currentMonthNum = now.getMonth() + 1;
  // Cuotas ya exigibles: meses cuyo número es <= al mes actual
  const dueMonths = months.filter((m) => (MESES[m.trim().toLowerCase()] || 99) <= currentMonthNum);

  const people = rows.slice(1).map((r) => {
    const name = r[0].trim();
    const pays = months.map((m, i) => ({ month: m, paid: (r[i + 1] || '').trim().toUpperCase() === 'TRUE' }));
    const paidCount = pays.filter((p) => p.paid).length;
    const due = dueMonths.length;
    const debt = Math.max(0, due - paidCount);
    let status;
    if (paidCount === months.length && months.length > 0) status = 'full';
    else if (debt === 0) status = 'aldia';
    else if (debt === 1) status = 'atrasado';
    else status = 'dicom';
    const duePays = pays.filter((p) => dueMonths.includes(p.month));
    let streak = 0;
    for (let i = duePays.length - 1; i >= 0; i--) {
      if (duePays[i].paid) streak++;
      else break;
    }
    return { name, pays, paidCount, debt, status, streak };
  }).filter((p) => p.name !== '');

  const totalPaid = people.reduce((s, p) => s + p.paidCount, 0);
  const goal = people.length * months.length * CUOTA;
  const collected = totalPaid * CUOTA;
  const pct = goal > 0 ? (collected / goal) * 100 : 0;
  const maxPaid = Math.max(0, ...people.map((p) => p.paidCount));
  const currentMonthName = months.find((m) => MESES[m.trim().toLowerCase()] === currentMonthNum);
  const alDia = currentMonthName
    ? people.filter((p) => p.pays.find((x) => x.month === currentMonthName)?.paid).length
    : people.filter((p) => p.debt === 0).length;

  return { months, people, totalPaid, goal, collected, pct, maxPaid, alDia, totalCuotas: people.length * months.length, currentMonthName };
}

function badgeFor(p, stats) {
  if (p.paidCount === stats.months.length && stats.months.length > 0) return '💸 Full pagado';
  if (p.streak >= 3) return `🔥 Racha de ${p.streak} meses`;
  if (p.paidCount === stats.maxPaid && stats.maxPaid > 0) return '🥇 El seco';
  if (p.paidCount === 0) return '👻 El perdido';
  if (p.status === 'dicom') return '🧾 En DICOM';
  return '';
}

const STATUS_LABEL = {
  full: '💸 Full pagado',
  aldia: '✅ Al día',
  atrasado: '⚠️ Debe 1 cuota',
  dicom: '🚨 Moroso',
};

/* ====== Render ====== */
function render(stats) {
  // Progreso global
  animateCount($('total-amount'), stats.collected);
  $('goal-amount').textContent = clp(stats.goal);
  $('cuota-label').textContent = clp(CUOTA);
  requestAnimationFrame(() => {
    $('global-bar').style.width = stats.pct + '%';
    $('groom').style.left = Math.min(stats.pct, 100) + '%';
  });
  document.querySelectorAll('.milestone').forEach((el) => {
    const at = parseFloat(el.style.left);
    el.classList.toggle('unlocked', stats.pct >= at);
  });
  $('milestone-msg').textContent = MILESTONE_MSGS.find(([at]) => stats.pct >= at)[1];

  // Stat cards
  $('stat-cuotas').textContent = `${stats.totalPaid}/${stats.totalCuotas}`;
  $('stat-aldia').textContent = `${stats.alDia}/${stats.people.length}`;
  const leaders = stats.people.filter((p) => p.paidCount === stats.maxPaid && stats.maxPaid > 0);
  $('stat-lider').textContent = leaders.length ? leaders.map((p) => p.name).join(', ') : 'Nadie 💀';

  // Le toca a...
  const turnoEl = $('turno-msg');
  if (stats.currentMonthName) {
    const pendientes = stats.people.filter((p) => !p.pays.find((x) => x.month === stats.currentMonthName)?.paid);
    turnoEl.textContent = pendientes.length
      ? `👉 Este mes falta: ${pendientes.map((p) => p.name).join(', ')}`
      : '✅ Este mes ya pagaron todos, qué milagro';
  } else {
    turnoEl.textContent = '';
  }

  // Tabla
  const sortArrow = (key) => (sortState.key === key ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : '');
  $('table-head').innerHTML =
    `<th id="th-name" class="sortable">Socio${sortArrow('name')}</th>` +
    stats.months.map((m) => `<th class="${m === stats.currentMonthName ? 'col-current' : ''}">${esc(m.slice(0, 3))}</th>`).join('') +
    `<th id="th-progress" class="sortable">Progreso${sortArrow('progress')}</th><th>Estado</th>`;

  const sorted = [...stats.people].sort((a, b) => {
    const cmp = sortState.key === 'name'
      ? a.name.localeCompare(b.name)
      : a.paidCount - b.paidCount || a.name.localeCompare(b.name);
    return sortState.dir === 'asc' ? cmp : -cmp;
  });
  $('table-body').innerHTML = sorted.map((p, i) => {
    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const badge = badgeFor(p, stats);
    const pctP = stats.months.length ? Math.round((p.paidCount / stats.months.length) * 100) : 0;
    const fillColor = p.status === 'full' ? 'var(--gold)' : p.status === 'aldia' ? 'var(--green)' : p.status === 'atrasado' ? 'var(--yellow)' : 'var(--red)';
    return `<tr>
      <td><div class="player">
        <span class="avatar" style="background:${color}">${esc(p.name.slice(0, 2).toUpperCase())}</span>
        <span>${esc(p.name)}${badge ? `<span class="badge-tag">${badge}</span>` : ''}</span>
      </div></td>
      ${p.pays.map((x) => `<td class="${x.month === stats.currentMonthName ? 'col-current' : ''}"><span class="chip ${x.paid ? 'paid' : 'unpaid'}">${x.paid ? '✔' : '✘'}</span></td>`).join('')}
      <td><div class="mini-progress">
        <div class="mini-track"><div class="mini-fill" style="width:${pctP}%;background:${fillColor};box-shadow:0 0 8px ${fillColor}"></div></div>
        <span class="mini-label">${p.paidCount}/${stats.months.length} · ${clp(p.paidCount * CUOTA)}</span>
      </div></td>
      <td><span class="status-pill status-${p.status}">${STATUS_LABEL[p.status]}</span></td>
    </tr>`;
  }).join('');

  // Podio
  const medals = ['🥇', '🥈', '🥉'];
  const podium = sorted.filter((p) => p.paidCount > 0).slice(0, 3);
  const order = podium.length === 3 ? [1, 0, 2] : podium.map((_, i) => i);
  $('podium').innerHTML = podium.length
    ? order.map((idx) => {
        const p = podium[idx];
        return `<div class="podium-spot ${idx === 0 ? 'first' : ''}">
          <div class="medal">${medals[idx]}</div>
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-count">${p.paidCount} cuota${p.paidCount === 1 ? '' : 's'} · ${clp(p.paidCount * CUOTA)}</div>
        </div>`;
      }).join('')
    : '<p class="panel-sub">Todavía nadie paga… qué vergüenza 💀</p>';

  // DICOM
  const morosos = sorted.filter((p) => p.debt > 0).sort((a, b) => b.debt - a.debt);
  $('dicom-list').innerHTML = morosos.length
    ? morosos.map((p) =>
        `<span class="dicom-chip">${p.paidCount === 0 ? '👻' : '🐢'} ${esc(p.name)} · debe <span class="debt">${p.debt} cuota${p.debt === 1 ? '' : 's'} (${clp(p.debt * CUOTA)})</span>
          <button class="funar-btn" data-name="${esc(p.name)}" data-debt="${p.debt}" data-amount="${p.debt * CUOTA}" title="Copiar mensaje para funarlo">📤</button>
        </span>`
      ).join('')
    : '<p class="dicom-empty">✨ ¡Nadie en DICOM! Todos al día, eri grandes cabros ✨</p>';
}

/* ====== Count-up ====== */
function animateCount(el, target) {
  const dur = 1400, start = performance.now();
  const tick = (t) => {
    const k = Math.min((t - start) / dur, 1);
    const ease = 1 - Math.pow(1 - k, 3);
    el.textContent = clp(Math.round(target * ease));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ====== Confetti (sin dependencias) ====== */
function fireConfetti(count = 180, duration = 9000) {
  const canvas = $('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colors = ['#FF0A3C', '#FF2FA0', '#FFD700', '#39FF14', '#ffffff'];
  const parts = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.5,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vy: 2 + Math.random() * 3.5,
    vx: -1.5 + Math.random() * 3,
    rot: Math.random() * Math.PI,
    vr: -0.1 + Math.random() * 0.2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  (function loop(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (t - t0 < duration) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })(t0);
}

/* ====== Sonido de moneda (Web Audio, sin assets) ====== */
let audioCtx = null;
function unlockAudio() {
  if (audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) audioCtx = new AudioCtx();
}
document.addEventListener('click', unlockAudio, { once: true });

function playCoinSound() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  [880, 1318.5].forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.08);
    gain.gain.setValueAtTime(0.0001, now + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.08 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.4);
  });
}

/* ====== Copiar datos ====== */
const BANK_TEXT = [
  'Pablo Patricio Cornejo Villarroel',
  'RUT: 16.611.650-3',
  'Banco: Mercado Pago',
  'Cuenta Vista N° 1042672758',
  'Correo: pablo.cornejo.v@gmail.com',
  `Monto: ${clp(CUOTA)}`,
].join('\n');

$('copy-btn').addEventListener('click', async () => {
  const btn = $('copy-btn');
  try {
    await navigator.clipboard.writeText(BANK_TEXT);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = BANK_TEXT;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  btn.textContent = '✅ ¡Copiado! Ahora no hay excusa';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = '📋 Copiar todos los datos';
    btn.classList.remove('copied');
  }, 2500);
});

$('table-head').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th || !th.classList.contains('sortable')) return;
  const key = th.id === 'th-name' ? 'name' : 'progress';
  if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.key = key; sortState.dir = key === 'name' ? 'asc' : 'desc'; }
  if (lastStats) render(lastStats);
});

$('dicom-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.funar-btn');
  if (!btn) return;
  const { name, debt, amount } = btn.dataset;
  const msg = `Oye ${name}, te faltan ${debt} cuota${debt === '1' ? '' : 's'} (${clp(Number(amount))}) pa' la despedida, no seai patúo 💸\n\n${BANK_TEXT}`;
  try {
    await navigator.clipboard.writeText(msg);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = msg;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const original = btn.textContent;
  btn.textContent = '✅';
  setTimeout(() => { btn.textContent = original; }, 1800);
});

/* ====== Cuenta regresiva ====== */
function renderCountdown() {
  const el = $('countdown-msg');
  const diffMs = DESPEDIDA_TARGET - new Date();
  if (diffMs <= 0) {
    el.textContent = '🎉 ¡Ya llegó noviembre, nos vemos pronto!';
    return;
  }
  const days = Math.ceil(diffMs / 86400000);
  el.textContent = `📅 Faltan ~${days} días para noviembre · día exacto por confirmar`;
}

/* ====== Última actualización ====== */
function renderUpdatedAt() {
  const el = $('updated-at');
  if (!lastUpdated) return;
  const secs = Math.floor((Date.now() - lastUpdated) / 1000);
  let txt;
  if (secs < 60) txt = 'Actualizado hace unos segundos';
  else if (secs < 3600) txt = `Actualizado hace ${Math.floor(secs / 60)} min`;
  else txt = `Actualizado hace ${Math.floor(secs / 3600)} h`;
  el.textContent = `🔄 ${txt}`;
}

/* ====== Init ====== */
let lastStats = null;
let lastUpdated = null;
let prevPeopleMap = null;
let celebratedFull = false;

function checkNewPayments(stats) {
  if (prevPeopleMap) {
    const hasNew = stats.people.some((p) => p.paidCount > (prevPeopleMap.get(p.name) ?? 0));
    if (hasNew) {
      playCoinSound();
      fireConfetti(60, 2500);
    }
  }
  if (stats.pct >= 100 && !celebratedFull) {
    celebratedFull = true;
    fireConfetti(180, 9000);
  } else if (stats.pct < 100) {
    celebratedFull = false;
  }
  prevPeopleMap = new Map(stats.people.map((p) => [p.name, p.paidCount]));
}

async function load(isAutoRefresh = false) {
  if (!isAutoRefresh) {
    $('loading').hidden = false;
    $('error').hidden = true;
    $('app').hidden = true;
  }
  try {
    const res = await fetch(`${SHEET_URL}&t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseCSV(await res.text());
    if (rows.length < 2) throw new Error('Sheet vacío');
    const stats = buildStats(rows);
    checkNewPayments(stats);
    lastStats = stats;
    lastUpdated = Date.now();
    $('loading').hidden = true;
    $('app').hidden = false;
    render(stats);
    renderUpdatedAt();
  } catch (e) {
    console.error('Error cargando el Sheet:', e);
    if (!isAutoRefresh) {
      $('loading').hidden = true;
      $('error').hidden = false;
    }
  }
}

$('retry-btn').addEventListener('click', () => load());
renderCountdown();
load();
setInterval(() => load(true), REFRESH_MS);
setInterval(renderUpdatedAt, 15000);
setInterval(renderCountdown, 3600000);
