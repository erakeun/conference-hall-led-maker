'use client';

import './upgrade.css';
import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import pptxgen from 'pptxgenjs';
import { AlertTriangle, Check, ChevronDown, FileImage, FileText, Lock, LockOpen, Redo2, RotateCcw, Save, Undo2, Upload } from 'lucide-react';
import { contrastRatio, TEMPLATE_IDS, TEMPLATES, templateDefaults, titlePlan, validateTemplate } from '@/lib/template-config.js';

const LED = { width: 2560, height: 256 };
const PPT = { width: 9215438 / 914400, height: 2592388 / 914400, ledHeight: (9215438 / 914400) / 10 };
type TemplateId = (typeof TEMPLATE_IDS)[number];
type ElementKey = 'title' | 'subtitle' | 'meta' | 'host';
type Position = { x: number; y: number; lock?: boolean };
type Positions = Record<ElementKey, Position>;
type PaletteOverride = { title?: string; subtitle?: string; meta?: string };
type Draft = {
  title: string; subtitle: string; date: string; start: string; end: string; venue: string; host: string; organizer: string;
  template: TemplateId; font: string; size?: number; background: string | null; fit: 'cover' | 'contain'; logos: string[];
  customPositions: Partial<Record<TemplateId, Positions>>; paletteOverride: PaletteOverride; keepSettings: boolean; locked: boolean; name: string;
};

const defaults = (): Draft => ({
  title: '2026 ERICA INNOVATION FORUM', subtitle: '', date: '2026-09-09', start: '14:00', end: '', venue: '컨퍼런스홀 중강당',
  host: 'HANYANG UNIVERSITY ERICA', organizer: '', template: 'standard', font: 'Arial', background: null, fit: 'cover', logos: [],
  customPositions: {}, paletteOverride: {}, keepSettings: false, locked: false, name: '',
});
const clean = (value: string) => value.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_').slice(0, 42) || 'LED_현수막';
const dateLine = (d: Draft) => {
  if (!d.date) return '';
  const [year, month, day] = d.date.split('-');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${d.date}T12:00`).getDay()];
  return `${year}. ${Number(month)}. ${Number(day)}.(${weekday}) ${[d.start, d.end].filter(Boolean).join('~')}`.trim();
};
const positionsFor = (d: Draft): Positions => (d.customPositions[d.template] || templateDefaults(d.template).positions) as Positions;
const paletteFor = (d: Draft) => ({ ...TEMPLATES[d.template].palette, ...d.paletteOverride });

function paintBackground(ctx: CanvasRenderingContext2D, d: Draft) {
  const cfg = TEMPLATES[d.template], palette = paletteFor(d), { width: w, height: h } = LED;
  ctx.fillStyle = palette.background; ctx.fillRect(0, 0, w, h);
  if (d.template === 'blue') {
    const gradient = ctx.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, '#0a3565'); gradient.addColorStop(1, '#071e3b');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  }
  if (d.template === 'photo') {
    if (d.background) {
      const image = new Image(); image.src = d.background;
      if (image.complete && image.naturalWidth) {
        const sourceRatio = image.naturalWidth / image.naturalHeight, targetRatio = w / h;
        let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
        if (d.fit === 'cover') { if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; } else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; } }
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
      }
    }
    ctx.fillStyle = `${palette.overlay}${Math.round((palette.overlayOpacity || .58) * 255).toString(16).padStart(2, '0')}`; ctx.fillRect(0, 0, w, h);
  }
  for (const shape of cfg.decorations) {
    if (shape.type === 'gradient') continue;
    ctx.fillStyle = palette[shape.color] || shape.color || palette.line;
    ctx.fillRect(shape.x / 100 * w, shape.y / 100 * h, shape.w / 100 * w, Math.max(1, shape.h / 100 * h));
  }
}

function draw(canvas: HTMLCanvasElement, d: Draft) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  canvas.width = LED.width; canvas.height = LED.height; paintBackground(ctx, d);
  const cfg = TEMPLATES[d.template], palette = paletteFor(d), positions = positionsFor(d), plan = titlePlan(d.title, d.template, d.size);
  const point = (key: ElementKey) => [positions[key].x / 100 * LED.width, positions[key].y / 100 * LED.height] as const;
  const width = cfg.layout.titleWidth / 100 * LED.width;
  ctx.textBaseline = 'top'; ctx.textAlign = cfg.layout.align; ctx.fillStyle = palette.title;
  ctx.font = `800 ${plan.size}px ${d.font}, Arial, sans-serif`;
  const [titleX, titleY] = point('title');
  plan.lines.forEach((text: string, index: number) => ctx.fillText(text, titleX, titleY + index * plan.lineHeight, width));
  if (d.subtitle) { const [x, y] = point('subtitle'); ctx.fillStyle = palette.subtitle; ctx.font = `600 17px ${d.font}, Arial`; ctx.fillText(d.subtitle, x, y, width); }
  const [metaX, metaY] = point('meta'); ctx.fillStyle = palette.meta; ctx.font = `600 20px ${d.font}, Arial`; ctx.fillText([dateLine(d), d.venue].filter(Boolean).join('  ·  '), metaX, metaY, width);
  const [hostX, hostY] = point('host'); ctx.textAlign = 'right'; ctx.font = `700 14px ${d.font}, Arial`; ctx.fillText([d.host, d.organizer].filter(Boolean).join('  |  '), hostX, hostY, 620);
  if (!d.template.startsWith('legacy')) { ctx.fillStyle = palette.accent; ctx.font = '800 15px Arial'; ctx.fillText('HANYANG UNIVERSITY ERICA', LED.width - 80, 24); }
  d.logos.forEach((src, index) => { const image = new Image(); image.src = src; if (image.complete && image.naturalWidth) { const h = 44, w = Math.min(160, h * image.naturalWidth / image.naturalHeight); ctx.drawImage(image, LED.width - 270 - index * 175, 45, w, h); } });
}

function Preview({ draft, onMove }: { draft: Draft; onMove: (key: ElementKey, x: number, y: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), [dragging, setDragging] = useState<ElementKey | null>(null), positions = positionsFor(draft);
  useEffect(() => { if (canvas.current) draw(canvas.current, draft); }, [draft]);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || draft.locked || positions[dragging].lock) return;
    const rect = event.currentTarget.getBoundingClientRect(), cfg = TEMPLATES[draft.template], margin = cfg.layout.safeMargin;
    onMove(dragging, Math.max(margin, Math.min(100 - margin, (event.clientX - rect.left) / rect.width * 100)), Math.max(margin, Math.min(94, (event.clientY - rect.top) / rect.height * 100)));
  };
  return <div className="canvas-wrap led-stage" onPointerMove={move} onPointerUp={() => setDragging(null)}>
    <canvas ref={canvas} className="led-canvas" aria-label="LED 현수막 미리보기" />
    {(Object.keys(positions) as ElementKey[]).map(key => <button key={key} className="drag-dot" title={`${key} 위치 이동`} style={{ left: `${positions[key].x}%`, top: `${positions[key].y}%` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(key); }} />)}
  </div>;
}

export default function Home() {
  const [draft, setDraft] = useState<Draft>(defaults), [pasted, setPasted] = useState(''), [advanced, setAdvanced] = useState(false), [safe, setSafe] = useState(false);
  const [history, setHistory] = useState<Draft[]>([]), [future, setFuture] = useState<Draft[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const workFile = useRef<HTMLInputElement>(null), cfg = TEMPLATES[draft.template], positions = positionsFor(draft), palette = paletteFor(draft);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('erica-led-v3') || localStorage.getItem('erica-led-v2');
      const old = raw ? JSON.parse(raw) : {}, migrated = { ...defaults(), ...old };
      if (old.positions) migrated.customPositions = { [old.template || 'standard']: old.positions };
      const requested = new URLSearchParams(window.location.search).get('template');
      if (requested && TEMPLATE_IDS.includes(requested)) migrated.template = requested;
      const requestedTitle = new URLSearchParams(window.location.search).get('title');
      if (requestedTitle) migrated.title = requestedTitle;
      setDraft(migrated);
    } catch {}
  }, []);
  useEffect(() => localStorage.setItem('erica-led-v3', JSON.stringify(draft)), [draft]);
  const save = (next: Draft) => { setHistory(items => [draft, ...items].slice(0, 12)); setFuture([]); setDraft(next); };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => save({ ...draft, [key]: value });
  const validation = validateTemplate(draft.title, draft.template, positions);
  const checks = useMemo(() => [
    { name: '출력 규격', ok: true, value: '2560 × 256 px' },
    { name: '제목 클리핑', ok: !validation.clipping, value: validation.clipping ? '안전영역 밖으로 나감' : '없음' },
    { name: '선·제목 충돌', ok: !validation.collision, value: validation.collision ? '배치 초기화 필요' : '없음' },
    { name: '제목 대비', ok: contrastRatio(palette.title, palette.background) >= 3, value: contrastRatio(palette.title, palette.background) < 3 ? '사용자 지정 색상 대비가 낮음' : '정상' },
    { name: '최소 글자크기', ok: !validation.overflow, value: validation.overflow ? '제목을 줄여주세요' : `${validation.plan.size}px` },
  ], [draft, positions, validation]);
  const canExport = checks.every(item => item.ok);
  const switchTemplate = (template: TemplateId) => save({ ...draft, template, size: draft.keepSettings ? draft.size : undefined, paletteOverride: draft.keepSettings ? draft.paletteOverride : {} });
  const move = (key: ElementKey, x: number, y: number) => save({ ...draft, customPositions: { ...draft.customPositions, [draft.template]: { ...positions, [key]: { ...positions[key], x, y } } } });
  const resetPosition = () => { const next = { ...draft.customPositions }; delete next[draft.template]; save({ ...draft, customPositions: next }); };
  const parse = () => {
    const lines = pasted.split(/\n+/).map(value => value.trim()).filter(Boolean), next = { ...draft };
    const date = lines.find(value => /20\d{2}[.\-/년]/.test(value)), venue = lines.find(value => /중강당|강당|컨퍼런스홀|홀/.test(value)), title = lines.find(value => value !== date && value !== venue && !/^주[최관]/.test(value));
    if (title) next.title = title.replace(/^행사명\s*[:：]?/, ''); if (venue) next.venue = venue.replace(/^장소\s*[:：]?/, '');
    if (date) { const match = date.replace(/[년월]/g, '.').match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/), times = date.match(/\d{1,2}:\d{2}/g); if (match) next.date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; if (times?.[0]) next.start = times[0]; if (times?.[1]) next.end = times[1]; }
    save(next);
  };
  const image = (event: ChangeEvent<HTMLInputElement>, background: boolean) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => save(background ? { ...draft, background: String(reader.result) } : { ...draft, logos: [...draft.logos.slice(0, 3), String(reader.result)] }); reader.readAsDataURL(file); };
  const downloadPng = () => { if (!canExport || busy) return; setBusy(true); const canvas = document.createElement('canvas'); draw(canvas, draft); canvas.toBlob(blob => { if (blob) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${clean(draft.name || draft.title)}.png`; anchor.click(); URL.revokeObjectURL(anchor.href); } setBusy(false); }, 'image/png'); };
  const downloadPptx = async () => {
    if (!canExport || busy) return; setBusy(true);
    try {
      const file = new pptxgen(); file.defineLayout({ name: 'OFFICIAL_LED', width: PPT.width, height: PPT.height }); file.layout = 'OFFICIAL_LED'; const slide = file.addSlide(); slide.background = { color: palette.background.slice(1) };
      for (const shape of cfg.decorations) if (shape.type !== 'gradient') slide.addShape(file.ShapeType.rect, { x: shape.x / 100 * PPT.width, y: shape.y / 100 * PPT.ledHeight, w: shape.w / 100 * PPT.width, h: Math.max(.01, shape.h / 100 * PPT.ledHeight), fill: { color: (palette[shape.color] || shape.color || palette.line).slice(1) }, line: { transparency: 100 } });
      const plan = titlePlan(draft.title, draft.template, draft.size), x = (key: ElementKey, width: number) => Math.max(0, Math.min(PPT.width - width, positions[key].x / 100 * PPT.width - (cfg.layout.align === 'center' ? width / 2 : 0))), y = (key: ElementKey, height: number) => Math.max(0, Math.min(PPT.ledHeight - height, positions[key].y / 100 * PPT.ledHeight));
      slide.addText(plan.lines.join('\n'), { x: x('title', cfg.layout.titleWidth / 100 * PPT.width), y: y('title', plan.height / 256 * PPT.ledHeight), w: cfg.layout.titleWidth / 100 * PPT.width, h: plan.height / 256 * PPT.ledHeight, fontFace: draft.font, fontSize: Math.max(18, plan.size * .38), bold: true, color: palette.title.slice(1), margin: 0, fit: 'shrink', align: cfg.layout.align, breakLine: false });
      if (draft.subtitle) slide.addText(draft.subtitle, { x: x('subtitle', 7), y: y('subtitle', .12), w: 7, h: .12, fontFace: draft.font, fontSize: 7.5, bold: true, color: palette.subtitle.slice(1), margin: 0, fit: 'shrink', align: cfg.layout.align });
      slide.addText([dateLine(draft), draft.venue].filter(Boolean).join('  ·  '), { x: x('meta', 7.3), y: y('meta', .12), w: 7.3, h: .12, fontFace: draft.font, fontSize: 8, color: palette.meta.slice(1), margin: 0, fit: 'shrink', align: cfg.layout.align });
      slide.addText([draft.host, draft.organizer].filter(Boolean).join('  |  '), { x: 6.8, y: y('host', .12), w: 2.9, h: .12, fontFace: draft.font, fontSize: 6.4, bold: true, color: palette.meta.slice(1), margin: 0, fit: 'shrink', align: 'right' });
      await file.writeFile({ fileName: `${clean(draft.name || draft.title)}_수정용.pptx` }); setNotice('PPTX 생성 완료');
    } finally { setBusy(false); }
  };
  const saveJson = () => { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 3, draft }, null, 2)], { type: 'application/json' })); anchor.download = `${clean(draft.name || draft.title)}.json`; anchor.click(); };
  const loadJson = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const value = JSON.parse(String(reader.result)); save({ ...defaults(), ...(value.draft || value) }); } catch { setNotice('작업 JSON을 읽지 못했습니다'); } }; reader.readAsText(file); };
  const undo = () => { if (!history.length) return; setFuture(items => [draft, ...items]); setDraft(history[0]); setHistory(items => items.slice(1)); }, redo = () => { if (!future.length) return; setHistory(items => [draft, ...items]); setDraft(future[0]); setFuture(items => items.slice(1)); };
  const cards = (group: string) => TEMPLATE_IDS.filter(id => TEMPLATES[id].group === group);
  return <main className="app-shell">
    <header className="app-header"><div className="brand-mark"><span className="h">H</span><span>HANYANG UNIVERSITY<br /><b>ERICA</b></span></div><div><p className="eyebrow">FACILITY OPERATIONS TOOL · v2.1</p><h1>컨퍼런스홀 LED 현수막 제작기</h1></div><div className="header-status">2560 × 256 · 공식 PPTX 규격</div></header>
    <div className="workspace"><aside className="editor-panel">
      <section className="paste-panel"><div className="section-title"><b>QUICK START</b><span>행사명 · 일시 · 장소</span></div><textarea value={pasted} onChange={event => setPasted(event.target.value)} placeholder={'행사명\n2026. 9. 15. 14:00~17:00\n컨퍼런스홀 중강당'} /><button className="ghost-button" onClick={parse}>정보 자동 분리</button><label>행사명<input value={draft.title} onChange={event => update('title', event.target.value)} /></label><div className="field-row"><label>날짜<input type="date" value={draft.date} onChange={event => update('date', event.target.value)} /></label><label>시작<input type="time" value={draft.start} onChange={event => update('start', event.target.value)} /></label></div><label>장소<input value={draft.venue} onChange={event => update('venue', event.target.value)} /></label></section>
      {['ERICA MODERN', '시설팀 기존 양식'].map(group => <section className="input-section" key={group}><div className="section-heading"><b>{group}</b><em>{cards(group).length}종</em></div><div className="template-grid">{cards(group).map(id => <button className={`template-card ${id} ${draft.template === id ? 'active' : ''}`} onClick={() => switchTemplate(id)} key={id}><i style={{ background: `linear-gradient(90deg,${TEMPLATES[id].palette.background} 64%,${TEMPLATES[id].palette.accent} 64%)` }} /><strong>{TEMPLATES[id].name}</strong><small>{TEMPLATES[id].use}</small></button>)}</div></section>)}
      <section className="accordion"><button onClick={() => setAdvanced(!advanced)}><span>고급 편집</span><ChevronDown size={17} /></button>{advanced && <div className="accordion-content"><label>부제<input value={draft.subtitle} onChange={event => update('subtitle', event.target.value)} /></label><label>종료 시간<input type="time" value={draft.end} onChange={event => update('end', event.target.value)} /></label><label>주최<input value={draft.host} onChange={event => update('host', event.target.value)} /></label><label>주관<input value={draft.organizer} onChange={event => update('organizer', event.target.value)} /></label><div className="field-row"><label>글꼴<select value={draft.font} onChange={event => update('font', event.target.value)}><option>Arial</option><option>Malgun Gothic</option><option>Georgia</option></select></label><label>제목 크기<input type="range" min="34" max="100" value={draft.size || cfg.layout.fontSize} onChange={event => update('size', Number(event.target.value))} /></label></div><div className="field-row"><label>제목색<input type="color" value={palette.title} onChange={event => update('paletteOverride', { ...draft.paletteOverride, title: event.target.value })} /></label><label>정보색<input type="color" value={palette.meta} onChange={event => update('paletteOverride', { ...draft.paletteOverride, meta: event.target.value })} /></label></div><label className="keep"><input type="checkbox" checked={draft.keepSettings} onChange={event => update('keepSettings', event.target.checked)} /> 템플릿 변경 시 내 설정 유지</label><label>배경 사진<input type="file" accept="image/*" onChange={event => image(event, true)} /></label><label>외부기관 로고<input type="file" accept="image/*" onChange={event => image(event, false)} /></label><div className="lock-row"><button onClick={() => update('locked', !draft.locked)}>{draft.locked ? <Lock size={15} /> : <LockOpen size={15} />}{draft.locked ? '잠금 해제' : '전체 잠금'}</button><button onClick={resetPosition}>현재 템플릿 위치 초기화</button></div></div>}</section>
      <section className="work-tools"><input ref={workFile} type="file" hidden accept=".json,application/json" onChange={loadJson} /><button onClick={saveJson}><Save size={14} /> JSON 저장</button><button onClick={() => workFile.current?.click()}><Upload size={14} /> 불러오기</button><button onClick={undo} disabled={!history.length}><Undo2 size={14} /> Undo</button><button onClick={redo} disabled={!future.length}><Redo2 size={14} /> Redo</button></section>
    </aside><section className="preview-panel"><div className="preview-toolbar"><div><p className="eyebrow">LIVE PREVIEW</p><h2>실제 송출 영역</h2></div><label className="safe-toggle"><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> 안전영역 보기</label></div><Preview draft={draft} onMove={move} />{safe && <div className="safe-guide">공식 PPTX 상단 LED 송출영역 · 10:1</div>}<div className="preview-caption"><b>{cfg.name}</b><span>템플릿별 위치·색상·장식 독립 적용</span></div><details className="check-panel" open={!canExport}><summary>{canExport ? '✓ 출력 준비 완료' : '! 출력 전 확인 필요'}</summary>{checks.map(item => <div className={`check-item ${item.ok ? '' : 'warning'}`} key={item.name}>{item.ok ? <Check size={16} /> : <AlertTriangle size={16} />}<b>{item.name}</b><span>{item.value}</span></div>)}</details></section></div>
    <footer className="action-bar"><input placeholder="출력 파일명 (선택)" value={draft.name} onChange={event => update('name', event.target.value)} /><button className="reset" onClick={() => { if (confirm('전체 초기화할까요?')) { setDraft(defaults()); setHistory([]); setFuture([]); } }}><RotateCcw size={17} /> 전체 초기화</button><button className="download secondary" disabled={!canExport || busy} onClick={downloadPptx}><FileText size={18} /> 수정 가능한 PPTX</button><button className="download" disabled={!canExport || busy} onClick={downloadPng}><FileImage size={18} /> PNG 다운로드</button></footer>
    {notice && <p className="notice">{notice}</p>}<p className="facility-note">공식 LED: 6400 × 640mm · 2560 × 256px · PPTX 원본 슬라이드 크기 변경 금지 · 현장지원 4446</p>
  </main>;
}
