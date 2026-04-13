// ============================================================
// MyRaceCard — app.js
// ============================================================

// ---- State ----
let gpxParsed        = null;  // { waypoints, trackPoints, filename }
let checkpoints      = null;  // processed checkpoint data array
let currentTheme     = 'default';
let raceName         = '';
let startMins        = 0;
let targetFinishMins = null;
let currentUnit      = 'km';  // 'km' or 'mi'
let cutoffTimes      = {};    // { cpIndex: timeString } e.g. { 1: '10:30' }

function toUnit(km) {
  return currentUnit === 'mi' ? km * 0.621371 : km;
}
function unitLabel() {
  return currentUnit === 'mi' ? 'mi' : 'km';
}

// ---- DOM References ----
const appEl         = document.getElementById('app');
const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const stepUpload    = document.getElementById('step-upload');
const stepSettings  = document.getElementById('step-settings');
const stepPreview   = document.getElementById('step-preview');
const gpxFilename   = document.getElementById('gpx-filename');
const gpxChange     = document.getElementById('gpx-change');
const raceNameInput = document.getElementById('race-name');
const startTimeIn   = document.getElementById('start-time');
const targetHoursIn = document.getElementById('target-hours');
const targetMinsIn  = document.getElementById('target-mins');
const downloadBtn   = document.getElementById('download-btn');
const editBtn       = document.getElementById('edit-btn');
const cardOutput    = document.getElementById('card-output');
const errorMsg      = document.getElementById('upload-error');
const progressFill    = document.getElementById('q-progress-fill');
const qCounter        = document.getElementById('q-counter');
const qBack           = document.getElementById('q-back');
const stepAnalysis    = document.getElementById('step-analysis');
const stepCheckpoints = document.getElementById('step-checkpoints');
const analysisBtn     = document.getElementById('analysis-btn');

// Checkpoint selector state
const MAX_FIT    = 7;   // comfortable max for iPhone screen
let gpxWaypoints = [];  // processed waypoints with leg data
let selectedCPs  = new Set(); // indices of selected waypoints

// Question flow state
let currentQ = 0;
const TOTAL_Q = 3;

// ============================================================
// GPX Parsing
// ============================================================

function parseGPX(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Could not read this GPX file. Make sure it is a valid GPX.');

  // Extract waypoints (checkpoints)
  const wpts = [...doc.querySelectorAll('wpt')].map(wpt => ({
    lat:  parseFloat(wpt.getAttribute('lat')),
    lon:  parseFloat(wpt.getAttribute('lon')),
    ele:  parseFloat(wpt.querySelector('ele')?.textContent || 0),
    name: wpt.querySelector('name')?.textContent?.trim() || 'Checkpoint'
  }));

  // Extract track points (route)
  const trkpts = [...doc.querySelectorAll('trkpt')].map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon')),
    ele: parseFloat(pt.querySelector('ele')?.textContent || 0)
  }));

  // Try to get a race name from the GPX metadata
  const gpxName = doc.querySelector('metadata > name, trk > name')?.textContent?.trim() || '';

  if (wpts.length < 2) {
    throw new Error('No checkpoints found. Your GPX file must include waypoints (at least a start and finish).');
  }

  if (trkpts.length < 2) {
    throw new Error('No track data found. Your GPX file must include a track for distance and elevation calculations.');
  }

  return { waypoints: wpts, trackPoints: trkpts, suggestedName: gpxName };
}

// ============================================================
// Name Cleaning
// ============================================================

function cleanRaceName(raw) {
  let name = raw.trim();
  // Remove 4-digit years
  name = name.replace(/\b(19|20)\d{2}\b/g, '');
  // Remove common noise words/suffixes
  name = name.replace(/\b(route|track|gpx|original|race route|my route|activity|recording)\b/gi, '');
  // Clean up leftover separators and extra spaces
  name = name.replace(/[-–—|,]+\s*$/g, '').replace(/^\s*[-–—|,]+/g, '');
  name = name.replace(/\s{2,}/g, ' ').trim();
  return name || raw.trim();
}

// ============================================================
// Distance & Elevation Calculations
// ============================================================

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

// Build track with cumulative distances at each point
function buildTrack(trkpts) {
  const track = [{ ...trkpts[0], cumDist: 0 }];
  for (let i = 1; i < trkpts.length; i++) {
    const d = haversine(trkpts[i - 1], trkpts[i]);
    track.push({ ...trkpts[i], cumDist: track[i - 1].cumDist + d });
  }
  return track;
}

// Find the index of the track point closest to a given waypoint
function snapWaypoint(wpt, track) {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < track.length; i++) {
    const d = haversine(wpt, track[i]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

// Snap all waypoints to track points, handling same-location CPs (e.g. out-and-back).
// When two waypoints snap to the same track point, the second is re-snapped to the
// closest track point AFTER the first — finding the return pass through that location.
function snapWaypointsOrdered(waypoints, track) {
  const initial = waypoints.map(wpt => {
    const idx = snapWaypoint(wpt, track);
    return { ...wpt, trackIdx: idx, cumDist: track[idx].cumDist };
  });
  // Sort by cumDist. For ties, put waypoints with "return/back" in the name last
  // so they correctly land on the return pass of an out-and-back section.
  initial.sort((a, b) => {
    if (a.cumDist !== b.cumDist) return a.cumDist - b.cumDist;
    const aReturn = /return|back|\bleg\s*2\b/i.test(a.name);
    const bReturn = /return|back|\bleg\s*2\b/i.test(b.name);
    if (aReturn !== bReturn) return aReturn ? 1 : -1;
    return 0;
  });

  const result = [];
  for (const wpt of initial) {
    if (result.length === 0 || wpt.cumDist !== result[result.length - 1].cumDist) {
      result.push(wpt);
    } else {
      // Re-snap: search for closest track point strictly after the previous snap
      const afterIdx = result[result.length - 1].trackIdx + 1;
      let bestIdx = afterIdx, bestDist = Infinity;
      for (let i = afterIdx; i < track.length; i++) {
        const d = haversine(wpt, track[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      result.push({ ...wpt, trackIdx: bestIdx, cumDist: track[bestIdx].cumDist });
    }
  }
  // Re-sort after re-snapping — re-snapped waypoints may have moved in the order
  result.sort((a, b) => a.cumDist - b.cumDist);
  return result;
}

// Total elevation gain (ascent only) between two track indices
function elevGain(track, fromIdx, toIdx) {
  let gain = 0;
  for (let i = fromIdx + 1; i <= toIdx; i++) {
    const diff = track[i].ele - track[i - 1].ele;
    if (diff > 0) gain += diff;
  }
  return Math.round(gain);
}

// ============================================================
// Time Calculations (Naismith's Rule)
// ============================================================

function naismithHours(distKm, ascentM) {
  return distKm / 5 + ascentM / 600;
}

function processCheckpoints(gpxData, startM, targetFinM) {
  const { waypoints, trackPoints } = gpxData;

  // Build track with cumulative distances
  const track = buildTrack(trackPoints);

  // Snap waypoints to track, re-snapping same-location CPs to their return pass
  const deduped = snapWaypointsOrdered(waypoints, track);

  if (deduped.length < 2) throw new Error('Not enough distinct checkpoints. Check your GPX file.');

  // Build legs between consecutive waypoints
  const legs = [];
  for (let i = 0; i < deduped.length - 1; i++) {
    const distKm  = deduped[i + 1].cumDist - deduped[i].cumDist;
    const ascentM = elevGain(track, deduped[i].trackIdx, deduped[i + 1].trackIdx);
    legs.push({ distKm, ascentM });
  }

  // Naismith time (hours) per leg
  const naismiths = legs.map(l => naismithHours(l.distKm, l.ascentM));
  const totalNaismith = naismiths.reduce((a, b) => a + b, 0);

  if (totalNaismith === 0) throw new Error('Could not calculate route distance. Check your GPX file.');

  const scale = targetFinM != null ? (targetFinM - startM) / 60 / totalNaismith : null;

  // Build checkpoint objects
  return deduped.map((wpt, i) => {
    const isStart  = i === 0;
    const isFinish = i === deduped.length - 1;
    const type     = isStart ? 'start' : isFinish ? 'finish' : 'cp';
    const cpNum    = !isStart && !isFinish ? i : null;

    let arrivalMins = scale != null ? startM : null;
    for (let j = 0; j < i; j++) {
      if (scale != null) arrivalMins += naismiths[j] * scale * 60;
    }

    const leg         = i < legs.length ? legs[i] : null;
    const legTimeMins = leg && scale != null ? naismiths[i] * scale * 60 : null;

    const totalAscentM = isFinish
      ? legs.reduce((sum, l) => sum + l.ascentM, 0)
      : null;

    return {
      name:       wpt.name,
      type,
      cpNum,
      totalKm:    wpt.cumDist,
      toNextKm:   leg ? leg.distKm : null,
      legTimeMins,
      legAscentM: leg ? leg.ascentM : null,
      arrivalMins: isStart ? startM : arrivalMins,
      totalAscentM,
    };
  });
}

// ============================================================
// Time Formatting
// ============================================================

function timeToMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(mins) {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ============================================================
// Card Rendering
// ============================================================

function getFields() {
  const btn = f => document.querySelector(`.field-btn[data-field="${f}"]`);
  return {
    total:   btn('total')?.classList.contains('active')   ?? true,
    next:    btn('next')?.classList.contains('active')    ?? true,
    legtime: btn('legtime')?.classList.contains('active') ?? true,
    climb:   btn('climb')?.classList.contains('active')   ?? true,
  };
}

function renderRow(cp, isBeforeFinish, fields) {
  const label      = cp.type === 'start' ? 'Start' : cp.type === 'finish' ? 'Finish' : `CP ${cp.cpNum}`;
  const labelClass = `cp-label-${cp.type}`;

  // Times block
  const cutoff = cutoffTimes[cp.cpNum ?? 'finish'] || null;
  let timesHtml = '';
  if (cp.type === 'start') {
    timesHtml = `
      <div class="time-block">
        <div class="time-lbl">Start time</div>
        <div class="time-val time-start">${formatTime(cp.arrivalMins)}</div>
      </div>`;
  } else {
    const targetClass = cp.type === 'finish' ? 'time-finish' : 'time-target';
    const hasTarget   = cp.arrivalMins != null;
    const targetHtml  = hasTarget ? `
      <div class="time-block">
        <div class="time-lbl">Target</div>
        <div class="time-val ${targetClass}">${formatTime(cp.arrivalMins)}</div>
      </div>` : '';
    const cutoffHtml  = cutoff ? `
      <div class="time-block">
        <div class="time-lbl">Cutoff</div>
        <div class="time-val time-cutoff">${cutoff}</div>
      </div>` : '';
    timesHtml = targetHtml + cutoffHtml;
  }

  // Stats block
  const ul = unitLabel();
  const stats = [];

  if (cp.type === 'finish') {
    stats.push(`
      <div class="stat">
        <div class="stat-lbl">Total</div>
        <div class="stat-val">${toUnit(cp.totalKm).toFixed(1)} <span class="stat-unit">${ul}</span></div>
      </div>`);
    if (cp.totalAscentM != null) {
      stats.push(`
        <div class="stat">
          <div class="stat-lbl">Total Climb</div>
          <div class="stat-val climb">+${Math.round(cp.totalAscentM)} <span class="stat-unit">m</span></div>
        </div>`);
    }
    if (cp.arrivalMins != null) {
      stats.push(`
        <div class="stat">
          <div class="stat-lbl">Total Time</div>
          <div class="stat-val accent">${formatDuration(cp.arrivalMins - startMins)}</div>
        </div>`);
    }
  } else {
    if (fields.total) {
      stats.push(`
        <div class="stat">
          <div class="stat-lbl">Total</div>
          <div class="stat-val">${toUnit(cp.totalKm).toFixed(1)} <span class="stat-unit">${ul}</span></div>
        </div>`);
    }
    if (cp.toNextKm != null) {
      if (fields.next) {
        stats.push(`
          <div class="stat">
            <div class="stat-lbl">${isBeforeFinish ? 'To Finish' : 'To Next CP'}</div>
            <div class="stat-val accent">${toUnit(cp.toNextKm).toFixed(1)} <span class="stat-unit">${ul}</span></div>
          </div>`);
      }
      if (fields.legtime && cp.legTimeMins != null) {
        stats.push(`
          <div class="stat">
            <div class="stat-lbl">Leg Time</div>
            <div class="stat-val accent">${formatDuration(cp.legTimeMins)}</div>
          </div>`);
      }
      if (fields.climb && cp.legAscentM != null) {
        stats.push(`
          <div class="stat">
            <div class="stat-lbl">Leg Climb</div>
            <div class="stat-val climb">+${cp.legAscentM} <span class="stat-unit">m</span></div>
          </div>`);
      }
    }
  }

  const statsHtml = stats.length > 0
    ? `<div class="card-stats">${stats.join('')}</div>`
    : '';

  return `
    <div class="row">
      <div class="card card-${cp.type}">
        <div class="card-top">
          <div>
            <div class="cp-label ${labelClass}">${label}</div>
            <div class="cp-name">${cp.name.replace(/^checkpoint\s*\d*\s*[-–—:,]?\s*/i, '').trim() || cp.name}</div>
          </div>
          <div class="times">${timesHtml}</div>
        </div>
        ${statsHtml}
      </div>
    </div>`;
}

function renderCard() {
  if (!checkpoints) return;
  const fields = getFields();

  const rows = checkpoints.map((cp, i) =>
    renderRow(cp, i === checkpoints.length - 2, fields)
  ).join('');

  const totalKm = checkpoints[checkpoints.length - 1].totalKm.toFixed(1);
  let durationStr = '';
  if (targetFinishMins != null) {
    const dH = Math.floor((targetFinishMins - startMins) / 60);
    const dM = (targetFinishMins - startMins) % 60;
    durationStr = `&nbsp;·&nbsp; ${dM > 0 ? `${dH}h ${dM}m` : `${dH}h`} target`;
  }

  cardOutput.innerHTML = `
    <div class="race-card" data-theme="${currentTheme}">
      <div class="checkpoints">${rows}</div>
      <div class="rc-footer">Good luck &nbsp;·&nbsp; myracecard.co.uk</div>
    </div>`;

  // Populate preview-only lockscreen overlay
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const lsDate = document.getElementById('phone-ls-date');
  const lsTime = document.getElementById('phone-ls-time');
  const lsSub  = document.getElementById('phone-ls-sub');
  if (lsDate) lsDate.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
  if (lsTime) lsTime.textContent = formatTime(startMins);
  if (lsSub)  lsSub.textContent  = `${totalKm} km${durationStr ? ' · ' + durationStr.replace(/&nbsp;·&nbsp;/g, '').trim() : ''}`;

  // Scale card to fit phone screen without scrolling (preview only)
  requestAnimationFrame(() => {
    const card = cardOutput.querySelector('.race-card');
    const phoneScreen = document.querySelector('.phone-screen');
    const phoneContent = document.querySelector('.phone-content');
    if (!card || !phoneScreen) return;

    // Match phone-content background to card so scaled-down gaps are invisible
    if (phoneContent) {
      const bg = getComputedStyle(card).backgroundColor;
      phoneContent.style.background = bg;
    }

    card.style.transform = '';
    card.style.transformOrigin = '';
    const cardH = card.scrollHeight;
    const screenH = phoneScreen.clientHeight;
    if (cardH > screenH) {
      const scale = screenH / cardH;
      card.style.transform = `scale(${scale})`;
      card.style.transformOrigin = 'top center';
    }
  });
}

// ============================================================
// Image Download
// ============================================================

function downloadCard() {
  if (!checkpoints || !checkpoints.length) return;

  downloadBtn.textContent = 'Generating…';
  downloadBtn.disabled = true;

  // Read theme colours from CSS variables on the rendered card
  const cardEl = cardOutput.querySelector('.race-card');
  const cs = cardEl ? getComputedStyle(cardEl) : document.documentElement;
  const v  = n => cs.getPropertyValue(n).trim();
  const C  = {
    bg:           v('--bg'),
    cardBg:       v('--card-bg'),
    border:       v('--card-border'),
    startBorder:  v('--start-border'),
    finishBorder: v('--finish-border'),
    textName:     v('--text-name'),
    textMuted:    v('--text-muted'),
    accentStart:  v('--accent-start'),
    accentCp:     v('--accent-cp'),
    accentFinish: v('--accent-finish'),
    statVal:      v('--stat-val'),
    statAccent:   v('--stat-accent'),
    statClimb:    v('--stat-climb'),
    labelStart:   v('--label-start'),
    labelCp:      v('--label-cp'),
    labelFinish:  v('--label-finish'),
    footer:       v('--footer'),
  };

  const fields     = getFields();
  const SCALE      = 3;
  const W          = 393;   // matches .race-card width in CSS
  const TOP_PAD    = 320;   // matches CSS padding-top — clears iOS lock screen clock
  const SIDE_PAD   = 14;    // matches CSS padding left/right
  const BOT_PAD    = 16;    // matches CSS padding-bottom
  const CX         = SIDE_PAD;
  const IW         = W - SIDE_PAD * 2;
  const CPX        = 10;    // card inner padding horizontal (matches CSS padding: 7px 10px)
  const CPY        = 7;     // card inner padding vertical
  const RADIUS     = 11;
  const GAP        = 10;    // gap between cards

  // ── helpers ──────────────────────────────────────────────────
  function cpName(cp) {
    return cp.name.replace(/^checkpoint\s*\d*\s*[-–—:,]?\s*/i, '').trim() || cp.name;
  }

  function buildStats(cp, isBeforeFinish) {
    // returns [{label, value, unit, color}]
    const ul = unitLabel();
    if (cp.type === 'finish') {
      const s = [{ label: 'Total', value: toUnit(cp.totalKm).toFixed(1), unit: ul, color: C.statVal }];
      if (cp.totalAscentM != null)
        s.push({ label: 'Total Climb', value: `+${Math.round(cp.totalAscentM)}`, unit: 'm', color: C.statClimb });
      if (cp.arrivalMins != null)
        s.push({ label: 'Total Time', value: formatDuration(cp.arrivalMins - startMins), unit: '', color: C.statAccent });
      return s;
    }
    const s = [];
    if (fields.total)
      s.push({ label: 'Total', value: toUnit(cp.totalKm).toFixed(1), unit: ul, color: C.statVal });
    if (fields.next && cp.toNextKm != null)
      s.push({ label: isBeforeFinish ? 'To Finish' : 'To Next CP', value: toUnit(cp.toNextKm).toFixed(1), unit: ul, color: C.statAccent });
    if (fields.legtime && cp.legTimeMins != null)
      s.push({ label: 'Leg Time', value: formatDuration(cp.legTimeMins), unit: '', color: C.statAccent });
    if (fields.climb && cp.legAscentM != null)
      s.push({ label: 'Leg Climb', value: `+${cp.legAscentM}`, unit: 'm', color: C.statClimb });
    return s;
  }

  // ── measure card heights ──────────────────────────────────────
  // We need a temporary canvas to measureText for name wrapping
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx    = tmpCanvas.getContext('2d');

  function measureCardHeight(cp, isBeforeFinish) {
    const hasTime  = cp.arrivalMins != null;
    const nameMaxW = hasTime ? IW - CPX * 2 - 72 : IW - CPX * 2;
    tmpCtx.font = '700 12px Inter, Arial, sans-serif';
    const nameLines = tmpCtx.measureText(cpName(cp)).width > nameMaxW ? 2 : 1;
    // Left side: label(9px) + 2px gap + name lines
    const leftH  = 10 + 2 + 14.4 * nameLines;
    // Right side when time shown: time-lbl + time-val (+ cutoff lbl + cutoff-val if set)
    const hasCutoff = !!(cutoffTimes[cp.cpNum ?? 'finish']);
    const rightH = hasTime ? (9 + 2 + 17 + (hasCutoff ? 20 : 0)) : 0;
    const topH   = CPY + Math.max(leftH, rightH) + 4;
    const stats  = buildStats(cp, isBeforeFinish);
    const statH  = stats.length > 0 ? (6 + 9 + 13) : 0; // divider + lbl + val
    return Math.ceil(topH + statH + CPY);
  }

  // Total canvas height
  let totalH = TOP_PAD;
  checkpoints.forEach((cp, i) => {
    totalH += measureCardHeight(cp, i === checkpoints.length - 2);
    if (i < checkpoints.length - 1) totalH += GAP;
  });
  totalH += 26 + BOT_PAD; // footer + bottom padding
  totalH = Math.max(totalH, 855);  // never smaller than the phone screen

  // ── create canvas ─────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = C.bg || '#080d24';
  ctx.fillRect(0, 0, W, totalH);

  // ── drawing helpers ───────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawText(str, x, y, font, color, align) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign  = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Distance + target time — sits in the gap between the iOS clock and the first card
  const totalKmHeader = toUnit(checkpoints[checkpoints.length - 1].totalKm).toFixed(1);
  let headerSub = `${totalKmHeader} ${unitLabel()}`;
  if (targetFinishMins != null) {
    headerSub += `  ·  ${formatDuration(targetFinishMins - startMins)} target`;
  }
  drawText(headerSub, W / 2, TOP_PAD - 40, '400 13px Inter, Arial, sans-serif', C.textMuted || '#4a5a8a', 'center');

  // ── draw each card ────────────────────────────────────────────
  let curY = TOP_PAD;

  checkpoints.forEach((cp, i) => {
    const isBeforeFinish = i === checkpoints.length - 2;
    const stats  = buildStats(cp, isBeforeFinish);
    const cardH  = measureCardHeight(cp, isBeforeFinish);
    const border = cp.type === 'start' ? C.startBorder :
                   cp.type === 'finish' ? C.finishBorder : C.border;

    // Card background + border
    ctx.fillStyle = C.cardBg;
    roundRect(CX, curY, IW, cardH, RADIUS);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    roundRect(CX, curY, IW, cardH, RADIUS);
    ctx.stroke();

    const labelColor = cp.type === 'start' ? C.labelStart :
                       cp.type === 'finish' ? C.labelFinish : C.labelCp;
    const timeColor  = cp.type === 'start' ? C.accentStart :
                       cp.type === 'finish' ? C.accentFinish : C.accentCp;
    const label = cp.type === 'start' ? 'Start' :
                  cp.type === 'finish' ? 'Finish' : `CP ${cp.cpNum}`;

    let iy = curY + CPY;
    const ix = CX + CPX;
    const rx = CX + IW - CPX; // right edge for right-aligned text

    // Label (e.g. "CP 1", "Start", "Finish")
    drawText(label.toUpperCase(), ix, iy, '700 9px Inter, Arial, sans-serif', labelColor);

    // Time block (right-aligned) — only draw when a time exists
    const hasTime  = cp.arrivalMins != null;
    const cpCutoff = cutoffTimes[cp.cpNum ?? 'finish'] || null;
    if (hasTime) {
      const timeLbl = cp.type === 'start' ? 'Start Time' : 'Target';
      drawText(timeLbl.toUpperCase(), rx, iy, '400 8px Inter, Arial, sans-serif', C.textMuted, 'right');
    }
    iy += 11;

    // CP name (left side, may wrap)
    const name = cpName(cp);
    const nameMaxW = hasTime ? IW - CPX * 2 - 72 : IW - CPX * 2;
    ctx.font = '700 12px Inter, Arial, sans-serif';
    const nameW = ctx.measureText(name).width;
    if (nameW > nameMaxW) {
      // simple word-wrap: split at last space before overflow
      const words = name.split(' ');
      let line1 = '', line2 = '';
      for (const word of words) {
        const test = line1 ? line1 + ' ' + word : word;
        if (ctx.measureText(test).width <= nameMaxW) { line1 = test; }
        else { line2 = line2 ? line2 + ' ' + word : word; }
      }
      drawText(line1, ix, iy, '700 12px Inter, Arial, sans-serif', C.textName);
      iy += 14;
      drawText(line2, ix, iy, '700 12px Inter, Arial, sans-serif', C.textName);
      iy += 14;
    } else {
      drawText(name, ix, iy, '700 12px Inter, Arial, sans-serif', C.textName);
      iy += 14;
    }

    // Time value (right-aligned, below time label)
    if (hasTime) {
      drawText(formatTime(cp.arrivalMins), rx, curY + CPY + 11, '700 15px Inter, Arial, sans-serif', timeColor, 'right');
    }

    // Cutoff time (right-aligned, below target)
    if (cpCutoff) {
      const cutoffLblY = curY + CPY + 11 + 16;
      drawText('CUTOFF', rx, cutoffLblY, '400 7.5px Inter, Arial, sans-serif', C.textMuted, 'right');
      drawText(cpCutoff, rx, cutoffLblY + 10, '700 11px Inter, Arial, sans-serif', '#ef4444', 'right');
    }

    iy += 4; // gap before stats

    // Stats section
    if (stats.length > 0) {
      // Divider
      ctx.beginPath();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 0.75;
      ctx.moveTo(ix, iy);
      ctx.lineTo(CX + IW - CPX, iy);
      ctx.stroke();
      iy += 6;

      const statW = IW / stats.length;
      stats.forEach((stat, si) => {
        const sc = CX + si * statW + statW / 2;

        // Vertical separator
        if (si > 0) {
          ctx.beginPath();
          ctx.strokeStyle = C.border;
          ctx.lineWidth = 0.75;
          ctx.moveTo(CX + si * statW, iy - 2);
          ctx.lineTo(CX + si * statW, iy + 9 + 13);
          ctx.stroke();
        }

        // Stat label
        drawText(stat.label.toUpperCase(), sc, iy, '400 7.5px Inter, Arial, sans-serif', C.textMuted, 'center');

        // Stat value + unit
        const val     = stat.unit ? `${stat.value}${stat.unit}` : stat.value;
        drawText(val, sc, iy + 9, '700 11px Inter, Arial, sans-serif', stat.color, 'center');
      });
    }

    curY += cardH + GAP;
  });

  // Footer
  drawText('Good luck · myracecard.uk', W / 2, curY + 6, '400 10px Inter, Arial, sans-serif', C.footer || C.textMuted, 'center');

  // Download
  const filename = `racecard-${(raceName || 'myrace').toLowerCase().replace(/\s+/g, '-')}.png`;
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();

  downloadBtn.textContent = '⬇ Download Image';
  downloadBtn.disabled = false;
}

// ============================================================
// UI Flow
// ============================================================

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
}

function hideError() {
  errorMsg.style.display = 'none';
}

// ============================================================
// Question Flow
// ============================================================

function showQuestion(index) {
  const all = document.querySelectorAll('.question');
  const current = document.querySelector('.question.active');

  if (current) {
    current.classList.add('exiting');
    current.classList.remove('active');
    setTimeout(() => current.classList.remove('exiting'), 280);
  }

  all[index].classList.add('active');

  // Focus the input in this question
  const input = all[index].querySelector('input');
  if (input) setTimeout(() => input.focus(), 320);

  // Update progress bar and counter
  const pct = ((index + 1) / TOTAL_Q) * 100;
  progressFill.style.width = `${pct}%`;
  qCounter.textContent = `${index + 1} of ${TOTAL_Q}`;

  // Show/hide back button
  index > 0 ? qBack.classList.remove('hidden') : qBack.classList.add('hidden');

  currentQ = index;
}

function showQError(index, msg) {
  const el = document.getElementById(`q-${index}-error`);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideQError(index) {
  const el = document.getElementById(`q-${index}-error`);
  if (el) el.style.display = 'none';
}

function advanceQuestion(index, skipped = false) {
  hideQError(index);

  // When skipping, clear the relevant inputs so generateCard doesn't use old values
  if (skipped) {
    if (index === 2) {
      targetHoursIn.value = '';
      targetMinsIn.value  = '';
    }
    if (index === 3) {
    }
  }

  // Validate each question before moving forward
  if (!skipped) {
    if (index === 0) {
      if (!raceNameInput.value.trim()) { showQError(0, 'Please enter a race name.'); return; }
    }
    if (index === 1) {
      if (!startTimeIn.value) { showQError(1, 'Please enter a start time.'); return; }
    }
    if (index === 2) {
      const h = parseInt(targetHoursIn.value, 10);
      const m = parseInt(targetMinsIn.value, 10);
      const hasAny = !isNaN(h) || !isNaN(m);
      if (hasAny) {
        const dur = (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
        if (dur <= 0) { showQError(2, 'Duration must be greater than zero.'); return; }
        // Sanity check: minimum pace of 4.5 min/km
        const totalKm = gpxWaypoints.length > 0 ? gpxWaypoints[gpxWaypoints.length - 1].cumDist : 0;
        if (totalKm > 0 && dur < totalKm * 4.5) {
          const minMins = totalKm * 4.5;
          const minH = Math.floor(minMins / 60);
          const minM = Math.round(minMins % 60);
          showQError(2, `That's too fast for ${totalKm.toFixed(0)} km. Minimum realistic time is around ${minH}h ${minM > 0 ? minM + 'm' : ''}.`);
          return;
        }
      }
    }
  }

  // Last question — generate the card
  // Blur any focused input first to prevent browser time-input validation blocking
  if (index === TOTAL_Q - 1) {
    document.activeElement?.blur();
    generateCard();
    return;
  }

  showQuestion(index + 1);
}

function generateCard() {
  startMins = timeToMins(startTimeIn.value);

  const targetH = parseInt(targetHoursIn.value, 10);
  const targetM = parseInt(targetMinsIn.value, 10);
  const hasTarget = !isNaN(targetH) || !isNaN(targetM);

  if (hasTarget) {
    const dur = (isNaN(targetH) ? 0 : targetH) * 60 + (isNaN(targetM) ? 0 : targetM);
    targetFinishMins = startMins + dur;
  } else {
    targetFinishMins = null;
  }

  raceName = raceNameInput.value.trim();

  // Filter waypoints by selection (gpxWaypoints is already sorted by track position)
  const filteredWaypoints = gpxWaypoints.filter((_, i) => selectedCPs.has(i));
  const filteredGPX = { ...gpxParsed, waypoints: filteredWaypoints };

  try {
    checkpoints = processCheckpoints(filteredGPX, startMins, targetFinishMins);
  } catch (err) {
    alert(err.message);
    return;
  }

  renderCard();
  buildCutoffList();
  stepSettings.classList.add('hidden');
  stepPreview.classList.remove('hidden');
}

// ============================================================
// Checkpoint Selector
// ============================================================

function processWaypoints(gpxData) {
  const track   = buildTrack(gpxData.trackPoints);
  const snapped = snapWaypointsOrdered(gpxData.waypoints, track);

  return snapped.map((wpt, i) => {
    const prev      = i > 0 ? snapped[i - 1] : null;
    const legDistKm = prev ? wpt.cumDist - prev.cumDist : 0;
    const legAscM   = prev ? elevGain(track, prev.trackIdx, wpt.trackIdx) : 0;
    // Keep full raw waypoint data so we can re-pass to processCheckpoints
    return { name: wpt.name, lat: wpt.lat, lon: wpt.lon, ele: wpt.ele, cumDist: wpt.cumDist, trackIdx: wpt.trackIdx, legDistKm, legAscM };
  });
}

function suggestedSkips(waypoints) {
  // Never skip start (0) or finish (last)
  const skips = new Set();
  const n = waypoints.length;
  if (n <= MAX_FIT) return skips;

  const middle = waypoints
    .slice(1, n - 1)
    .map((wpt, i) => ({ idx: i + 1, legDistKm: wpt.legDistKm }))
    .sort((a, b) => a.legDistKm - b.legDistKm);

  const toRemove = n - MAX_FIT;
  middle.slice(0, toRemove).forEach(m => skips.add(m.idx));
  return skips;
}

function updateFitIndicator() {
  const count     = selectedCPs.size;
  const indicator = document.getElementById('cp-fit-indicator');
  const text      = document.getElementById('cp-fit-text');

  indicator.className = 'cp-fit-indicator';
  if (count <= MAX_FIT) {
    indicator.classList.add('fit');
    text.textContent = `${count} selected — fits on screen ✓`;
  } else if (count <= MAX_FIT + 2) {
    indicator.classList.add('tight');
    text.textContent = `${count} selected — might be tight on smaller phones`;
  } else {
    indicator.classList.add('over');
    text.textContent = `${count} selected — too many for one screen`;
  }
}

function showCheckpointSelector(waypoints) {
  const skips  = suggestedSkips(waypoints);
  const n      = waypoints.length;

  // Default selection: all except suggested skips
  selectedCPs.clear();
  waypoints.forEach((_, i) => { if (!skips.has(i)) selectedCPs.add(i); });

  const heading = document.getElementById('cp-selector-heading');
  heading.textContent = `Your race has ${n} checkpoints`;

  const list = document.getElementById('cp-list');
  list.innerHTML = '';

  waypoints.forEach((wpt, i) => {
    const isStart  = i === 0;
    const isFinish = i === n - 1;
    const locked   = isStart || isFinish;
    const isSuggested = skips.has(i);
    const selected = selectedCPs.has(i);

    const item = document.createElement('div');
    item.className = 'cp-item' + (locked ? '' : selected ? '' : ' deselected');
    item.dataset.idx = i;

    const label = isStart ? 'Start' : isFinish ? 'Finish' : `CP ${i}`;
    const distText = i > 0 ? `${wpt.legDistKm.toFixed(1)} km from previous &nbsp;·&nbsp; ${wpt.cumDist.toFixed(1)} km total` : `Start of race`;

    item.innerHTML = `
      <button class="cp-item-toggle ${locked ? 'locked' : selected ? 'on' : ''}" data-idx="${i}" ${locked ? 'disabled' : ''}></button>
      <div class="cp-item-info">
        <div class="cp-item-name">${label} — ${wpt.name}</div>
        <div class="cp-item-meta">${distText}</div>
      </div>
      ${locked ? `<span class="cp-lock-badge">${isStart ? 'Start' : 'Finish'}</span>` : isSuggested ? '<span class="cp-skip-badge">Close to neighbour</span>' : ''}
    `;

    if (!locked) {
      item.querySelector('.cp-item-toggle').addEventListener('click', () => {
        if (selectedCPs.has(i)) {
          selectedCPs.delete(i);
        } else {
          selectedCPs.add(i);
        }
        const toggle = item.querySelector('.cp-item-toggle');
        toggle.classList.toggle('on', selectedCPs.has(i));
        item.classList.toggle('deselected', !selectedCPs.has(i));
        updateFitIndicator();
      });
    }

    list.appendChild(item);
  });

  updateFitIndicator();
  stepAnalysis.classList.add('hidden');
  stepCheckpoints.classList.remove('hidden');
}

// Continue from checkpoint selector
document.getElementById('cp-continue-btn').addEventListener('click', () => {
  stepCheckpoints.classList.add('hidden');
  stepSettings.classList.remove('hidden');
  currentQ = 0;
  document.querySelectorAll('.question').forEach(q => q.classList.remove('active', 'exiting'));
  showQuestion(0);
});

// ============================================================
// GPX Analysis Animation
// ============================================================

function analyseGPX(parsed) {
  const hasTrack     = parsed.trackPoints.length > 0;
  const hasElevation = parsed.trackPoints.some(p => p.ele && p.ele !== 0);
  const hasWaypoints = parsed.waypoints.length > 0;
  const hasName      = !!parsed.suggestedName;

  return [
    {
      label: 'Route track',
      sub: hasTrack ? `${parsed.trackPoints.length.toLocaleString()} points loaded` : 'No track found — distances unavailable',
      found: hasTrack,
    },
    {
      label: 'Elevation data',
      sub: hasElevation ? 'Climb data will appear on your card' : 'Not available — climb stats will be hidden',
      found: hasElevation,
    },
    {
      label: 'Checkpoints',
      sub: hasWaypoints ? `${parsed.waypoints.length} checkpoints found` : 'No waypoints — checkpoints unavailable',
      found: hasWaypoints,
    },
    {
      label: 'Race name',
      sub: hasName ? `"${parsed.suggestedName}"` : 'Not found — you can enter it manually',
      found: hasName,
    },
  ];
}

function showAnalysis(parsed) {
  const items    = analyseGPX(parsed);
  const listEl   = document.getElementById('analysis-items');
  const continueEl = document.getElementById('analysis-continue');
  const fileEl   = document.getElementById('analysis-filename');

  fileEl.textContent = parsed.filename;
  listEl.innerHTML = '';
  continueEl.classList.remove('visible');

  // Build item elements (hidden initially)
  const els = items.map(item => {
    const div = document.createElement('div');
    div.className = 'analysis-item';
    div.innerHTML = `
      <div class="analysis-icon ${item.found ? 'check' : 'warn'}">
        <span class="icon-symbol">${item.found ? '✓' : '!'}</span>
      </div>
      <div class="analysis-label">
        <div class="analysis-label-main">${item.label}</div>
        <div class="analysis-label-sub">${item.sub}</div>
      </div>
      <span class="analysis-badge ${item.found ? 'found' : 'missing'}">${item.found ? 'Found' : 'Missing'}</span>
    `;
    listEl.appendChild(div);
    return div;
  });

  // Animate each item in with staggered delay
  els.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('visible');
    }, 400 + i * 500);
  });

  // Show continue button after all items
  setTimeout(() => {
    continueEl.classList.add('visible');
  }, 400 + items.length * 500 + 200);
}

// ============================================================
// GPX Loading
// ============================================================

function loadGPXFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      gpxParsed = parseGPX(e.target.result);
      gpxParsed.filename = file.name;

      gpxFilename.textContent = file.name;

      if (gpxParsed.suggestedName && !raceNameInput.value) {
        raceNameInput.value = cleanRaceName(gpxParsed.suggestedName);
      }

      // Show analysis screen
      stepUpload.classList.add('hidden');
      stepAnalysis.classList.remove('hidden');
      window.scrollTo(0, 0);
      showAnalysis(gpxParsed);
    } catch (err) {
      alert(err.message);
    }
  };
  reader.readAsText(file);
}

// Move from analysis → checkpoint selector (if needed) → questions
analysisBtn.addEventListener('click', () => {
  gpxWaypoints = processWaypoints(gpxParsed);

  if (gpxWaypoints.length > MAX_FIT) {
    showCheckpointSelector(gpxWaypoints);
  } else {
    // All checkpoints selected by default
    selectedCPs.clear();
    gpxWaypoints.forEach((_, i) => selectedCPs.add(i));

    stepAnalysis.classList.add('hidden');
    stepSettings.classList.remove('hidden');
    currentQ = 0;
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active', 'exiting'));
    showQuestion(0);
  }
});

// ============================================================
// Event Listeners
// ============================================================

// File upload
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadGPXFile(e.target.files[0]);
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.gpx')) {
    loadGPXFile(file);
  } else {
    alert('Please drop a .gpx file.');
  }
});

// Change GPX
gpxChange.addEventListener('click', goHome);

// OK buttons
document.querySelectorAll('.btn-ok').forEach(btn => {
  btn.addEventListener('click', () => advanceQuestion(parseInt(btn.dataset.q)));
});

// Skip buttons
document.querySelectorAll('.btn-skip').forEach(btn => {
  btn.addEventListener('click', () => advanceQuestion(parseInt(btn.dataset.q), true));
});

// Back button
qBack.addEventListener('click', () => {
  if (currentQ > 0) showQuestion(currentQ - 1);
});

// Enter key advances question
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !stepSettings.classList.contains('hidden')) {
    e.preventDefault();
    advanceQuestion(currentQ);
  }
});

// Theme buttons
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTheme = btn.dataset.theme;
    renderCard();
  });
});

// Field buttons
document.querySelectorAll('.field-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    renderCard();
  });
});

// Limit target duration inputs to 2 digits
targetHoursIn.addEventListener('input', () => {
  if (targetHoursIn.value.length > 2) targetHoursIn.value = targetHoursIn.value.slice(0, 2);
});
targetMinsIn.addEventListener('input', () => {
  if (targetMinsIn.value.length > 2) targetMinsIn.value = targetMinsIn.value.slice(0, 2);
  if (parseInt(targetMinsIn.value, 10) > 59) targetMinsIn.value = '59';
});

// Cutoff toggle (collapsed by default)
document.getElementById('cutoff-toggle').addEventListener('click', () => {
  const toggle = document.getElementById('cutoff-toggle');
  const list   = document.getElementById('cutoff-list');
  toggle.classList.toggle('open');
  list.classList.toggle('open');
});

// Unit toggle
document.querySelectorAll('.unit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentUnit = btn.dataset.unit;
    renderCard();
  });
});

// Build cutoff time inputs in the preview panel
function buildCutoffList() {
  const list = document.getElementById('cutoff-list');
  if (!list || !checkpoints) return;
  list.innerHTML = '';
  checkpoints.forEach((cp, i) => {
    if (cp.type === 'start') return;
    const label = cp.type === 'finish' ? 'Finish' : `CP ${cp.cpNum}`;
    const name  = cp.name.replace(/^checkpoint\s*\d*\s*[-–—:,]?\s*/i, '').trim() || cp.name;
    const row   = document.createElement('div');
    row.className = 'cutoff-row';
    row.innerHTML = `
      <span class="cutoff-row-label">${label} — ${name}</span>
      <input class="cutoff-input" type="time" data-cp="${cp.cpNum ?? 'finish'}" value="${cutoffTimes[cp.cpNum ?? 'finish'] || ''}">
    `;
    row.querySelector('input').addEventListener('change', e => {
      const key = e.target.dataset.cp;
      cutoffTimes[key] = e.target.value;
      renderCard();
    });
    list.appendChild(row);
  });
}

// Phone model selector
document.querySelectorAll('.phone-model-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.phone-model-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const frame = document.getElementById('phone-frame');
    if (btn.dataset.model === 'samsung') {
      frame.classList.add('phone-samsung');
    } else {
      frame.classList.remove('phone-samsung');
    }
  });
});

// Download
downloadBtn.addEventListener('click', downloadCard);

// Edit — go back to question 1
editBtn.addEventListener('click', () => {
  stepPreview.classList.add('hidden');
  stepSettings.classList.remove('hidden');
  showQuestion(0);
});

document.getElementById('new-card-btn').addEventListener('click', goHome);

// Home button — logo click resets to upload screen
function goHome() {
  gpxParsed        = null;
  checkpoints      = null;
  gpxWaypoints     = [];
  raceName         = '';
  startMins        = 0;
  targetFinishMins = null;
  cutoffTimes      = {};
  selectedCPs.clear();
  fileInput.value       = '';
  raceNameInput.value   = '';
  startTimeIn.value     = '';
  targetHoursIn.value   = '';
  targetMinsIn.value    = '';
  cardOutput.innerHTML  = '';
  stepAnalysis.classList.add('hidden');
  stepCheckpoints.classList.add('hidden');
  stepSettings.classList.add('hidden');
  stepPreview.classList.add('hidden');
  stepUpload.classList.remove('hidden');
}

document.getElementById('home-btn').addEventListener('click', goHome);

