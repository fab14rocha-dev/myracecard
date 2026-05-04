import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';

// ── Scene boundaries (frames @ 30fps) ────────────────────────
const S1 = 0;    // Intro      0s–3s   (90f)
const S2 = 90;   // Brief      3s–9s   (180f)
const S3 = 270;  // Steps      9s–23s  (420f)
const S4 = 690;  // Card       23s–29s (180f)
const S5 = 870;  // End        29s–32s (90f)

// ── Project 100 colours ───────────────────────────────────────
const P = {
  bg:     '#0a0a0a',
  text:   '#F0F0F0',
  muted:  '#888888',
  accent: '#4F85F6',
};

// ── MyRaceCard Arctic colours ─────────────────────────────────
const A = {
  bg:     '#eff6ff',
  card:   '#ffffff',
  border: '#bfdbfe',
  text:   '#1e3a5f',
  body:   '#334155',
  muted:  '#64748b',
  faint:  '#93c5fd',
  accent: '#2563eb',
  red:    '#ef4444',
};

const FONT = 'Inter, Arial, sans-serif';

// ── Helpers ───────────────────────────────────────────────────
const fadeIn  = (frame, start, dur = 20) =>
  interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const fadeOut = (frame, start, dur = 20) =>
  interpolate(frame, [start, start + dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const pop = (frame, start, fps) =>
  spring({ frame: Math.max(frame - start, 0), fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });

// ── Scene 1 — Intro ───────────────────────────────────────────
function Intro({ frame, fps }) {
  const exit = fadeOut(frame, S2 - 20);
  const o1   = fadeIn(frame, 5);
  const o2   = fadeIn(frame, 30);
  const s1   = pop(frame, 5, fps);
  const s2   = pop(frame, 30, fps);

  return (
    <AbsoluteFill style={{ background: P.bg, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20, opacity: exit, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,133,246,0.35), transparent 70%)', top: -200, left: -100 }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,133,246,0.2), transparent 70%)', bottom: -150, right: -50 }} />
      <p style={{ color: P.accent, fontSize: 28, fontFamily: FONT, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0, opacity: o1, transform: `translateY(${interpolate(s1,[0,1],[20,0])}px)` }}>
        Project #100
      </p>
      <p style={{ color: P.text, fontSize: 80, fontFamily: FONT, fontWeight: 700, margin: 0, lineHeight: 1.05, opacity: o2, transform: `translateY(${interpolate(s2,[0,1],[24,0])}px)` }}>
        #3 — MyRaceCard
      </p>
      <p style={{ color: P.muted, fontSize: 36, fontFamily: FONT, fontWeight: 300, margin: 0, opacity: o2 }}>
        myracecard.co.uk
      </p>
    </AbsoluteFill>
  );
}

// ── Scene 2 — Brief ───────────────────────────────────────────
function Brief({ frame, fps }) {
  const rel   = frame - S2;
  const enter = fadeIn(rel, 0);
  const exit  = fadeOut(frame, S3 - 20);
  const s1    = pop(rel, 10, fps);
  const s2    = pop(rel, 80, fps);
  const o2    = fadeIn(rel, 80);

  return (
    <AbsoluteFill style={{ background: A.bg, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 48, padding: '0 80px', opacity: enter * exit }}>
      <p style={{ color: A.text, fontSize: 52, fontFamily: FONT, fontWeight: 600, margin: 0, textAlign: 'center', lineHeight: 1.35, transform: `translateY(${interpolate(s1,[0,1],[30,0])}px)` }}>
        Runners need a quick way to see their checkpoints, target times and cutoffs during a race.
      </p>
      <p style={{ color: A.accent, fontSize: 52, fontFamily: FONT, fontWeight: 700, margin: 0, textAlign: 'center', opacity: o2, transform: `translateY(${interpolate(s2,[0,1],[20,0])}px)` }}>
        So I built MyRaceCard.
      </p>
    </AbsoluteFill>
  );
}

// ── Scene 3 — Steps ───────────────────────────────────────────
function AppShell({ children }) {
  return (
    <div style={{ background: A.card, width: 640, borderRadius: 20, boxShadow: '0 20px 60px rgba(30,58,95,0.12)', border: `1px solid ${A.border}`, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function UploadScreen() {
  return (
    <div style={{ background: A.bg, width: 640, borderRadius: 20, boxShadow: '0 20px 60px rgba(30,58,95,0.12)', border: `1px solid ${A.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '24px 36px 8px', textAlign: 'center' }}>
        <span style={{ fontSize: 32, fontFamily: FONT, fontWeight: 700, color: A.text }}>My<span style={{ color: A.accent }}>Race</span>Card</span>
        <p style={{ color: A.muted, fontSize: 18, fontFamily: FONT, margin: '4px 0 0' }}>Turn your GPX file into a visual race plan card</p>
      </div>
      <div style={{ padding: '16px 28px 28px' }}>
        <div style={{ border: `2px dashed ${A.faint}`, borderRadius: 16, padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: A.card }}>
          <span style={{ fontSize: 52 }}>📂</span>
          <p style={{ color: A.text, fontSize: 28, fontFamily: FONT, fontWeight: 700, margin: 0 }}>Drop your GPX file here</p>
          <p style={{ color: A.muted, fontSize: 20, fontFamily: FONT, margin: 0 }}>or <span style={{ color: A.accent, textDecoration: 'underline' }}>click to browse</span></p>
        </div>
      </div>
    </div>
  );
}

function TimeScreen() {
  return (
    <AppShell>
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Start time */}
        <div>
          <p style={{ color: A.muted, fontSize: 18, fontFamily: FONT, margin: '0 0 8px' }}>What time does the race start?</p>
          <div style={{ borderBottom: `2px solid ${A.accent}`, paddingBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: A.text, fontSize: 42, fontFamily: FONT, fontWeight: 700 }}>06:00</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <span style={{ background: A.accent, color: '#fff', fontSize: 18, fontFamily: FONT, fontWeight: 600, padding: '10px 22px', borderRadius: 8 }}>OK ✓</span>
          </div>
        </div>
        {/* Divider */}
        <div style={{ borderTop: `1px solid ${A.border}` }} />
        {/* Target time */}
        <div>
          <p style={{ color: A.muted, fontSize: 18, fontFamily: FONT, margin: '0 0 8px' }}>Do you have a target finish time?</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: A.text, fontSize: 42, fontFamily: FONT, fontWeight: 700, borderBottom: `2px solid ${A.accent}`, paddingBottom: 4 }}>12</span>
            <span style={{ color: A.muted, fontSize: 26, fontFamily: FONT }}>h</span>
            <span style={{ color: A.text, fontSize: 42, fontFamily: FONT, fontWeight: 700, borderBottom: `2px solid ${A.accent}`, paddingBottom: 4 }}>00</span>
            <span style={{ color: A.muted, fontSize: 26, fontFamily: FONT }}>m</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <span style={{ background: A.accent, color: '#fff', fontSize: 18, fontFamily: FONT, fontWeight: 600, padding: '10px 22px', borderRadius: 8 }}>OK ✓</span>
            <span style={{ background: 'transparent', color: A.muted, fontSize: 18, fontFamily: FONT, fontWeight: 500, padding: '10px 22px', borderRadius: 8, border: `1px solid ${A.border}` }}>Skip</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CutoffScreen() {
  return (
    <AppShell>
      <div style={{ padding: '28px 32px' }}>
        <p style={{ color: A.text, fontSize: 22, fontFamily: FONT, fontWeight: 600, margin: '0 0 18px' }}>Cutoff times <span style={{ color: A.muted, fontWeight: 400, fontSize: 18 }}>(optional)</span></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['CP 1', 'Silverdale Road', '10:19'], ['CP 2', 'Ribblehead Viaduct', '13:33'], ['CP 3', 'Philpin Farm Campsite', ''], ['Finish', 'Horton-in-Ribblesdale', '18:00']].map(([cp, name, time]) => (
            <div key={cp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: A.bg, border: `1px solid ${A.border}`, borderRadius: 10, padding: '12px 18px' }}>
              <div>
                <p style={{ color: A.accent, fontSize: 16, fontFamily: FONT, fontWeight: 700, margin: 0 }}>{cp}</p>
                <p style={{ color: A.text, fontSize: 20, fontFamily: FONT, fontWeight: 600, margin: 0 }}>{name}</p>
              </div>
              <span style={{ color: time ? A.red : A.border, fontSize: time ? 26 : 20, fontFamily: FONT, fontWeight: 700 }}>{time || '--:--'}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ThemeScreen() {
  const themes = ['Default', 'Arctic', 'Forest', 'Mono', 'Neon', 'Sunrise'];
  const fields = ['Total distance', 'Distance to next', 'Leg time', 'Leg climb'];
  const btnBase = { fontSize: 18, fontFamily: FONT, fontWeight: 500, padding: '10px 20px', borderRadius: 8, border: `1px solid ${A.border}`, cursor: 'pointer' };

  return (
    <AppShell>
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Theme */}
        <div>
          <p style={{ color: A.muted, fontSize: 16, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Theme</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {themes.map(t => (
              <span key={t} style={{ ...btnBase, background: t === 'Arctic' ? A.accent : A.card, color: t === 'Arctic' ? '#fff' : A.text, border: t === 'Arctic' ? 'none' : `1px solid ${A.border}` }}>{t}</span>
            ))}
          </div>
        </div>
        {/* Show fields */}
        <div>
          <p style={{ color: A.muted, fontSize: 16, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Show fields</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {fields.map(f => (
              <span key={f} style={{ ...btnBase, background: A.accent, color: '#fff', border: 'none' }}>{f}</span>
            ))}
          </div>
        </div>
        {/* Units */}
        <div>
          <p style={{ color: A.muted, fontSize: 16, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Units</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['km', 'miles'].map(u => (
              <span key={u} style={{ ...btnBase, background: u === 'km' ? A.accent : A.card, color: u === 'km' ? '#fff' : A.text, border: u === 'km' ? 'none' : `1px solid ${A.border}` }}>{u}</span>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const STEPS = [
  { label: 'Runners simply upload the GPX file for their next race',                    Screen: UploadScreen },
  { label: 'They set their start and target finish time',                                Screen: TimeScreen },
  { label: 'They can also include the cutoff times for each Check Point',               Screen: CutoffScreen },
  { label: 'They choose their theme and what they want to see in their card',           Screen: ThemeScreen },
];

function HowItWorks({ frame, fps }) {
  const rel       = frame - S3;
  const enter     = fadeIn(rel, 0);
  const exit      = fadeOut(frame, S4 - 20);
  const stepDur   = 105;
  const stepIndex = Math.min(Math.floor(Math.max(rel, 0) / stepDur), STEPS.length - 1);
  const stepRel   = Math.max(rel - stepIndex * stepDur, 0);
  const stepEnter = fadeIn(stepRel, 0, 15);
  const stepSlide = pop(stepRel, 0, fps);
  const { label, Screen } = STEPS[stepIndex];

  return (
    <AbsoluteFill style={{ background: A.bg, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 32, opacity: enter * exit }}>
      <p style={{ color: A.accent, fontSize: 28, fontFamily: FONT, fontWeight: 600, margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: fadeIn(rel, 0) }}>
        How it works
      </p>
      <div style={{ opacity: stepEnter, transform: `translateY(${interpolate(stepSlide,[0,1],[40,0])}px)` }}>
        <Screen />
      </div>
      <p style={{ color: A.body, fontSize: 26, fontFamily: FONT, fontWeight: 500, margin: 0, textAlign: 'center', maxWidth: 640, opacity: stepEnter, lineHeight: 1.4 }}>
        {label}
      </p>
    </AbsoluteFill>
  );
}

// ── Scene 4 — Real photo ──────────────────────────────────────
function TheCard({ frame, fps }) {
  const rel   = frame - S4;
  const enter = fadeIn(rel, 0);
  const exit  = fadeOut(frame, S5 - 15);
  const s     = pop(rel, 0, fps);
  const textO = fadeIn(rel, 0);

  const scale = interpolate(s, [0, 1], [1.08, 1]);

  return (
    <AbsoluteFill style={{ opacity: enter * exit, overflow: 'hidden' }}>
      {/* Full bleed photo with subtle zoom-in */}
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={staticFile('phone-in-use.jpeg')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 80%' }}
        />
      </AbsoluteFill>

      {/* Caption strip — fades in from the sides, arctic colour, dark text */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 0 80px' }}>
        <div style={{
          opacity: textO,
          width: '100%',
          background: 'linear-gradient(to right, transparent, rgba(239,246,255,0.93) 18%, rgba(239,246,255,0.93) 82%, transparent)',
          padding: '22px 120px',
          textAlign: 'center',
        }}>
          <p style={{ color: A.text, fontSize: 34, fontFamily: FONT, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
            Runners can then download their card to use on their phone.
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ── Scene 5 — End ─────────────────────────────────────────────
function End({ frame, fps }) {
  const rel   = frame - S5;
  const enter = fadeIn(rel, 0);
  const s     = pop(rel, 5, fps);

  return (
    <AbsoluteFill style={{ background: A.bg, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 16, opacity: enter }}>
      <p style={{ color: A.text, fontSize: 64, fontFamily: FONT, fontWeight: 700, margin: 0, transform: `translateY(${interpolate(s,[0,1],[20,0])}px)` }}>
        myracecard.co.uk
      </p>
      <p style={{ color: A.muted, fontSize: 32, fontFamily: FONT, fontWeight: 400, margin: 0, opacity: fadeIn(rel, 20) }}>
        Free to use.
      </p>
    </AbsoluteFill>
  );
}

// ── Main ──────────────────────────────────────────────────────
export const Explainer = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg = frame < S2 ? P.bg : A.bg;

  return (
    <AbsoluteFill style={{ background: bg }}>
      {frame < S2 + 20                     && <Intro      frame={frame} fps={fps} />}
      {frame >= S2 - 10 && frame < S3 + 20 && <Brief      frame={frame} fps={fps} />}
      {frame >= S3 - 10 && frame < S4 + 20 && <HowItWorks frame={frame} fps={fps} />}
      {frame >= S4 - 10 && frame < S5 + 20 && <TheCard    frame={frame} fps={fps} />}
      {frame >= S5 - 10                     && <End        frame={frame} fps={fps} />}
    </AbsoluteFill>
  );
};
