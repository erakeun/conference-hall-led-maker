'use client';

import './upgrade.css';
import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import pptxgen from 'pptxgenjs';
import { AlertTriangle, AlignCenter, AlignLeft, AlignRight, Bold, Check, ChevronDown, Copy, FileImage, FileText, Lock, LockOpen, Minus, Move, Plus, Redo2, RotateCcw, Save, Trash2, Undo2, Upload } from 'lucide-react';
import { contrastRatio, TEMPLATE_IDS, TEMPLATES, titlePlan, validateTemplate } from '@/lib/template-config.js';
import { EDITABLE_KINDS, FONT_LIMITS, LED, REQUIRED_KINDS, TEXT_KINDS, clampElement, elementDefaults, isInsideSafeMargin, layerValue, materializeElements, nudgeElement, resizeElement, snapPosition } from '@/lib/editor-model.js';
import { CONTENT_PRESETS } from '@/lib/content-presets.js';

const PPT = { width: 9215438 / 914400, height: 2592388 / 914400, ledHeight: (9215438 / 914400) / 10 };
const COLORS = [
  { name: 'White', value: '#ffffff' }, { name: 'ERICA Blue', value: '#0e4a84' }, { name: 'Dark Navy', value: '#132033' },
  { name: 'Black', value: '#000000' }, { name: 'Gray', value: '#667788' },
];
const LABELS: Record<string, string> = { title: '행사명', subtitle: '부제', date: '일시', venue: '장소', host: '주최', organizer: '주관', extra: '추가 문구', logo: '로고', image: '업로드 이미지' };

type TemplateId = 'standard' | 'blue' | 'minimal' | 'split' | 'photo' | 'ceremony' | 'legacy' | 'legacyWhite' | 'legacyCenter' | 'legacyRight' | 'legacyTwoBlue' | 'legacyTwoWhite';
type ElementKind = 'title' | 'subtitle' | 'date' | 'venue' | 'host' | 'organizer' | 'extra' | 'logo' | 'image';
type Align = 'left' | 'center' | 'right';
type Shape = { type: string; x: number; y: number; w: number; h: number; color: string };
type ElementState = { id: string; kind: ElementKind; x: number; y: number; width: number; height: number; zIndex: number; hidden: boolean; fontSize?: number; fontWeight?: number; textAlign?: Align; color?: string; content?: string; asset?: string };
type ElementOverride = Partial<Omit<ElementState, 'id' | 'kind'>>;
type Draft = {
  title: string; subtitle: string; date: string; start: string; end: string; venue: string; host: string; organizer: string; extra: string;
  template: TemplateId; font: string; background: string | null; backgroundSource: 'upload' | 'preset' | null; cleanBackground: boolean; presetLayout: Record<string, ElementOverride>; fit: 'cover' | 'contain'; logos: string[]; mode: 'simple' | 'edit';
  templateEdits: Partial<Record<TemplateId, Record<string, ElementOverride>>>; templateCopies: Partial<Record<TemplateId, ElementState[]>>;
  locked: boolean; name: string;
};
type ContentPreset = { id: string; name: string; eyebrow: string; collection?: 'reference'; template: TemplateId; accent: string; theme?: 'light' | 'dark'; asset?: string; layout?: Record<string, ElementOverride>; fields: Pick<Draft, 'title' | 'subtitle' | 'date' | 'start' | 'end' | 'venue' | 'host' | 'organizer' | 'extra'> };
type Guide = { axis: 'x' | 'y'; value: number };
type Gesture = { type: 'move' | 'resize'; id: string; offsetX: number; offsetY: number; startX: number; startWidth: number; original: Draft };
const templateIds = TEMPLATE_IDS as TemplateId[];
const contentPresets = CONTENT_PRESETS as ContentPreset[];

const defaults = (): Draft => ({
  title: '2026 ERICA INNOVATION FORUM', subtitle: '', date: '2026-09-09', start: '14:00', end: '', venue: '컨퍼런스홀 중강당',
  host: 'HANYANG UNIVERSITY ERICA', organizer: '', extra: '', template: 'standard', font: 'Arial', background: null, backgroundSource: null, cleanBackground: false, presetLayout: {}, fit: 'cover', logos: [],
  mode: 'simple', templateEdits: {}, templateCopies: {}, locked: false, name: '',
});
const clean = (value: string) => value.replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_').slice(0, 42) || 'LED_현수막';
const dateLine = (d: Draft) => {
  if (!d.date) return '';
  const [year, month, day] = d.date.split('-');
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(`${d.date}T12:00`).getDay()];
  return `${year}. ${Number(month)}. ${Number(day)}.(${weekday}) ${[d.start, d.end].filter(Boolean).join('~')}`.trim();
};
const paletteFor = (d: Draft) => TEMPLATES[d.template].palette;
const contentFor = (d: Draft, element: ElementState) => {
  if (element.content !== undefined) return element.content;
  if (element.kind === 'date') return dateLine(d);
  if (element.kind === 'venue') return d.venue ? `·  ${d.venue}` : '';
  if (element.kind === 'organizer') return d.organizer ? `|  ${d.organizer}` : '';
  if (element.kind === 'logo' || element.kind === 'image') return '';
  if (element.kind === 'title') return d.title;
  if (element.kind === 'subtitle') return d.subtitle;
  if (element.kind === 'host') return d.host;
  if (element.kind === 'extra') return d.extra;
  return '';
};
const assetFor = (d: Draft, element: ElementState) => element.asset || (element.kind === 'logo' ? d.logos[0] : element.kind === 'image' ? d.background || '' : '');
const colorForKind = (kind: ElementKind, palette: Record<string, string>) => kind === 'title' ? palette.title : ['date', 'venue', 'host', 'organizer'].includes(kind) ? palette.meta : palette.subtitle;

function resolvedElements(d: Draft) {
  const manualEdits = d.mode === 'edit' ? d.templateEdits[d.template] || {} : {};
  const editIds = new Set([...Object.keys(d.presetLayout || {}), ...Object.keys(manualEdits)]);
  const edits = Object.fromEntries([...editIds].map(id => [id, { ...d.presetLayout?.[id], ...manualEdits[id] }]));
  const copies = d.mode === 'edit' ? d.templateCopies[d.template] || [] : [];
  const palette = paletteFor(d);
  return materializeElements(d.template, edits, copies).map((element: ElementState) => {
    const manualSize = Boolean(edits[element.id]?.fontSize) || element.id.includes('-copy-');
    const fontSize = element.kind === 'title' && !manualSize ? titlePlan(d.title, d.template).size : element.fontSize;
    const manualColor = Boolean(edits[element.id]?.color) || element.id.includes('-copy-');
    const hostWidth = element.kind === 'host' && d.organizer && !edits.host?.width ? element.width * .53 : element.width;
    return { ...element, width: hostWidth, fontSize, color: manualColor ? element.color : colorForKind(element.kind, palette) };
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
    if (image.complete && image.naturalWidth) resolve(image);
  });
}

function textLines(ctx: CanvasRenderingContext2D, text: string, element: ElementState, font: string) {
  const size = element.fontSize || 20, weight = element.fontWeight || 400;
  ctx.font = `${weight} ${size}px ${font}, Arial, sans-serif`;
  const words = text.trim().split(/\s+/).filter(Boolean), lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > element.width) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawImageBox(ctx: CanvasRenderingContext2D, image: HTMLImageElement, element: ElementState, fit: 'cover' | 'contain') {
  const sourceRatio = image.naturalWidth / image.naturalHeight, targetRatio = element.width / element.height;
  if (fit === 'contain') {
    let width = element.width, height = width / sourceRatio;
    if (height > element.height) { height = element.height; width = height * sourceRatio; }
    ctx.drawImage(image, element.x + (element.width - width) / 2, element.y + (element.height - height) / 2, width, height); return;
  }
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if (sourceRatio > targetRatio) { sw = image.naturalHeight * targetRatio; sx = (image.naturalWidth - sw) / 2; }
  else { sh = image.naturalWidth / targetRatio; sy = (image.naturalHeight - sh) / 2; }
  ctx.drawImage(image, sx, sy, sw, sh, element.x, element.y, element.width, element.height);
}

function paintBase(ctx: CanvasRenderingContext2D, d: Draft) {
  const palette = paletteFor(d);
  ctx.fillStyle = palette.background; ctx.fillRect(0, 0, LED.width, LED.height);
  if (d.template === 'blue') {
    const gradient = ctx.createLinearGradient(0, 0, LED.width, LED.height); gradient.addColorStop(0, '#0a3565'); gradient.addColorStop(1, '#071e3b');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, LED.width, LED.height);
  }
}

async function draw(canvas: HTMLCanvasElement, d: Draft) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  canvas.width = LED.width; canvas.height = LED.height; paintBase(ctx, d);
  const cfg = TEMPLATES[d.template], palette = paletteFor(d), elements = resolvedElements(d);
  const layers: Array<{ zIndex: number; type: string; element?: ElementState; shape?: Shape }> = elements.map((element: ElementState) => ({ zIndex: element.zIndex, type: 'element', element }));
  if (!d.cleanBackground) {
    if (d.template === 'photo') layers.push({ zIndex: 8, type: 'overlay' });
    cfg.decorations.forEach((shape: Shape) => { if (shape.type !== 'gradient') layers.push({ zIndex: 10, type: 'shape', shape }); });
    if (!d.template.startsWith('legacy')) layers.push({ zIndex: 15, type: 'brand' });
  }
  layers.sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of layers) {
    if (layer.type === 'overlay') { ctx.fillStyle = `${palette.overlay}${Math.round((palette.overlayOpacity || .58) * 255).toString(16).padStart(2, '0')}`; ctx.fillRect(0, 0, LED.width, LED.height); continue; }
    if (layer.type === 'shape') { const shape = layer.shape!; ctx.fillStyle = palette[shape.color] || shape.color || palette.line; ctx.fillRect(shape.x / 100 * LED.width, shape.y / 100 * LED.height, shape.w / 100 * LED.width, Math.max(1, shape.h / 100 * LED.height)); continue; }
    if (layer.type === 'brand') { ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillStyle = palette.accent; ctx.font = '800 15px Arial'; ctx.fillText('HANYANG UNIVERSITY ERICA', LED.width - 80, 24); continue; }
    const element = layer.element!; if (element.hidden) continue;
    if (element.kind === 'logo' || element.kind === 'image') {
      const src = assetFor(d, element); if (!src) continue;
      try { drawImageBox(ctx, await loadImage(src), element, element.kind === 'image' ? d.fit : 'contain'); } catch {} continue;
    }
    const text = contentFor(d, element); if (!text) continue;
    const lines = textLines(ctx, text, element, d.font), size = element.fontSize || 20, lineHeight = size * (element.kind === 'title' ? cfg.layout.lineHeight : 1.12);
    ctx.textBaseline = 'top'; ctx.textAlign = element.textAlign || 'left'; ctx.fillStyle = element.color || '#000000';
    ctx.font = `${element.fontWeight || 400} ${size}px ${d.font}, Arial, sans-serif`;
    const x = element.x + (element.textAlign === 'center' ? element.width / 2 : element.textAlign === 'right' ? element.width : 0);
    lines.forEach((line, index) => ctx.fillText(line, x, element.y + index * lineHeight, element.width));
  }
}

function elementWarnings(d: Draft, elements: ElementState[]) {
  const safeMarginX = TEMPLATES[d.template].layout.safeMargin / 100 * LED.width, safeMarginY = TEMPLATES[d.template].layout.safeMargin / 100 * LED.height;
  let overflow = false, safe = false, contrast = false;
  for (const element of elements) {
    if (element.hidden || (!contentFor(d, element) && !assetFor(d, element))) continue;
    if (element.kind !== 'image' && !isInsideSafeMargin(element, safeMarginX, safeMarginY)) safe = true;
    if (TEXT_KINDS.includes(element.kind)) {
      const size = element.fontSize || 20, charactersPerLine = Math.max(1, Math.floor(element.width / (size * .56))), lineCount = Math.max(1, Math.ceil(contentFor(d, element).length / charactersPerLine));
      const height = lineCount * size * (element.kind === 'title' ? TEMPLATES[d.template].layout.lineHeight : 1.12);
      if (height > element.height + 1) overflow = true;
      if (contrastRatio(element.color || '#000000', paletteFor(d).background) < 3) contrast = true;
    }
  }
  return { overflow, safe, contrast };
}

function Preview({ draft, selected, setSelected, onPatch, beginGesture, endGesture, guides, setGuides, safe }: {
  draft: Draft; selected: string | null; setSelected: (id: string | null) => void; onPatch: (id: string, patch: ElementOverride, transient?: boolean) => void;
  beginGesture: (gesture: Gesture) => void; endGesture: () => void; guides: Guide[]; setGuides: (guides: Guide[]) => void; safe: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), gesture = useRef<Gesture | null>(null), elements = resolvedElements(draft), direct = draft.mode === 'edit';
  useEffect(() => { if (canvas.current) void draw(canvas.current, draft); }, [draft]);
  const start = (event: ReactPointerEvent<HTMLElement>, element: ElementState, type: 'move' | 'resize') => {
    if (!direct || draft.locked || element.hidden) return;
    event.preventDefault(); event.stopPropagation(); setSelected(element.id);
    const rect = event.currentTarget.closest('.led-stage')!.getBoundingClientRect(), pointX = (event.clientX - rect.left) / rect.width * LED.width, pointY = (event.clientY - rect.top) / rect.height * LED.height;
    const next = { type, id: element.id, offsetX: pointX - element.x, offsetY: pointY - element.y, startX: pointX, startWidth: element.width, original: draft } as Gesture;
    gesture.current = next; beginGesture(next); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current; if (!active) return;
    const rect = event.currentTarget.getBoundingClientRect(), pointX = (event.clientX - rect.left) / rect.width * LED.width, pointY = (event.clientY - rect.top) / rect.height * LED.height;
    const element = elements.find((item: ElementState) => item.id === active.id); if (!element) return;
    if (active.type === 'resize') { onPatch(active.id, { width: resizeElement(element, active.startWidth + pointX - active.startX).width }, true); setGuides([]); return; }
    const raw = clampElement({ ...element, x: pointX - active.offsetX, y: pointY - active.offsetY });
    if (event.altKey) { onPatch(active.id, { x: raw.x, y: raw.y }, true); setGuides([]); return; }
    const safePercent = TEMPLATES[draft.template].layout.safeMargin;
    const snapped = snapPosition(element, raw.x, raw.y, elements, safePercent / 100 * LED.width, safePercent / 100 * LED.height);
    onPatch(active.id, { x: snapped.x, y: snapped.y }, true); setGuides(snapped.guides);
  };
  const stop = () => { if (!gesture.current) return; gesture.current = null; setGuides([]); endGesture(); };
  return <div className={`canvas-wrap led-stage ${direct ? 'editing' : ''}`} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onPointerDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
    <canvas ref={canvas} className="led-canvas" aria-label="LED 현수막 미리보기" />
    {safe && <div className="canvas-safe" style={{ inset: `${TEMPLATES[draft.template].layout.safeMargin}%` }}><span>SAFE MARGIN</span></div>}
    {direct && guides.map((guide, index) => <i key={`${guide.axis}-${guide.value}-${index}`} className={`snap-guide ${guide.axis}`} style={guide.axis === 'x' ? { left: `${guide.value / LED.width * 100}%` } : { top: `${guide.value / LED.height * 100}%` }} />)}
    {direct && elements.filter((element: ElementState) => !element.hidden && (contentFor(draft, element) || assetFor(draft, element))).map((element: ElementState) => <button
      key={element.id} type="button" aria-label={`${LABELS[element.kind]} 선택 및 이동`} className={`element-hitbox ${selected === element.id ? 'selected' : ''} ${element.kind}`}
      style={{ left: `${element.x / LED.width * 100}%`, top: `${element.y / LED.height * 100}%`, width: `${element.width / LED.width * 100}%`, height: `${element.height / LED.height * 100}%`, zIndex: element.zIndex + 20 }}
      onPointerDown={event => start(event, element, 'move')} onClick={() => setSelected(element.id)}>
      {selected === element.id && <><span className="selection-label">{LABELS[element.kind]}</span><span className="resize-handle" role="presentation" onPointerDown={event => start(event, element, 'resize')} /></>}
    </button>)}
  </div>;
}

export default function Home() {
  const [draft, setDraft] = useState<Draft>(defaults), [pasted, setPasted] = useState(''), [advanced, setAdvanced] = useState(false), [safe, setSafe] = useState(false), [selected, setSelected] = useState<string | null>(null), [guides, setGuides] = useState<Guide[]>([]);
  const [history, setHistory] = useState<Draft[]>([]), [future, setFuture] = useState<Draft[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const workFile = useRef<HTMLInputElement>(null), gestureStart = useRef<Draft | null>(null), cfg = TEMPLATES[draft.template], palette = paletteFor(draft), elements = resolvedElements(draft);
  const selectedElement = elements.find((item: ElementState) => item.id === selected) || null, selectedText = selectedElement && TEXT_KINDS.includes(selectedElement.kind);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('erica-led-v4') || localStorage.getItem('erica-led-v3') || localStorage.getItem('erica-led-v2');
      const old = raw ? JSON.parse(raw) : {}, migrated: Draft = { ...defaults(), ...old, mode: old.mode || 'simple', templateEdits: old.templateEdits || {}, templateCopies: old.templateCopies || {} };
      if (!old.backgroundSource && old.background) migrated.backgroundSource = 'upload';
      if (old.customPositions) {
        for (const [template, positions] of Object.entries(old.customPositions) as Array<[TemplateId, Record<string, { x: number; y: number }> ]>) {
          const bases = Object.fromEntries((elementDefaults(template) as ElementState[]).map(item => [item.id, item]));
          migrated.templateEdits[template] = migrated.templateEdits[template] || {};
          for (const key of ['title', 'subtitle', 'meta', 'host']) if (positions[key]) {
            const targets = key === 'meta' ? ['date', 'venue'] : key === 'host' ? ['host', 'organizer'] : [key];
            targets.forEach(id => { const base = bases[id]; if (base) migrated.templateEdits[template]![id] = { ...migrated.templateEdits[template]![id], x: positions[key].x / 100 * LED.width, y: positions[key].y / 100 * LED.height }; });
          }
        }
      }
      const params = new URLSearchParams(window.location.search), requested = params.get('template');
      if (requested && templateIds.includes(requested as TemplateId)) {
        const requestedTemplate = requested as TemplateId;
        if (requestedTemplate !== migrated.template && migrated.backgroundSource === 'preset') { migrated.background = null; migrated.backgroundSource = null; migrated.cleanBackground = false; migrated.presetLayout = {}; }
        migrated.template = requestedTemplate;
      }
      if (params.get('title')) migrated.title = params.get('title')!;
      if (params.get('mode') === 'edit' || params.get('mode') === 'simple') migrated.mode = params.get('mode') as Draft['mode'];
      // oxlint-disable-next-line react/react-compiler
      setDraft(migrated);
    } catch {}
  }, []);
  useEffect(() => localStorage.setItem('erica-led-v4', JSON.stringify(draft)), [draft]);
  const save = (next: Draft) => { setHistory(items => [draft, ...items].slice(0, 30)); setFuture([]); setDraft(next); };
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => save({ ...draft, [key]: value });
  const patchElement = (id: string, patch: ElementOverride, transient = false) => {
    let next = draft; const copies = draft.templateCopies[draft.template] || [], copyIndex = copies.findIndex(item => item.id === id);
    if (copyIndex >= 0) { const nextCopies = [...copies]; nextCopies[copyIndex] = clampElement({ ...nextCopies[copyIndex], ...patch }); next = { ...draft, templateCopies: { ...draft.templateCopies, [draft.template]: nextCopies } }; }
    else { const edits = draft.templateEdits[draft.template] || {}; next = { ...draft, templateEdits: { ...draft.templateEdits, [draft.template]: { ...edits, [id]: { ...edits[id], ...patch } } } }; }
    if (transient) setDraft(next); else save(next);
  };
  const clearElementFields = (id: string, fields: Array<keyof ElementOverride>) => {
    const copies = draft.templateCopies[draft.template] || [], copyIndex = copies.findIndex(item => item.id === id);
    if (copyIndex >= 0) {
      const base = (elementDefaults(draft.template) as ElementState[]).find(item => item.kind === copies[copyIndex].kind);
      if (!base) return;
      const patch = Object.fromEntries(fields.map(field => [field, base[field as keyof ElementState]])) as ElementOverride;
      patchElement(id, patch); return;
    }
    const edits = { ...draft.templateEdits[draft.template] }, current = { ...edits[id] };
    fields.forEach(field => delete current[field]); edits[id] = current;
    save({ ...draft, templateEdits: { ...draft.templateEdits, [draft.template]: edits } });
  };
  const beginGesture = (gesture: Gesture) => { gestureStart.current = gesture.original; };
  const endGesture = () => { if (!gestureStart.current) return; setHistory(items => [gestureStart.current!, ...items].slice(0, 30)); setFuture([]); gestureStart.current = null; };
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (draft.mode !== 'edit' || !selectedElement || draft.locked || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || !event.key.startsWith('Arrow')) return;
      event.preventDefault(); const amount = event.altKey ? .5 : event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0, dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
      const moved = nudgeElement(selectedElement, dx, dy); patchElement(selectedElement.id, { x: moved.x, y: moved.y });
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, selectedElement]);
  const warnings = useMemo(() => elementWarnings(draft, elements), [draft, elements]);
  const validation = validateTemplate(draft.title, draft.template, undefined);
  const checks = [
    { name: '출력 규격', ok: true, value: '2560 × 256 px' },
    { name: '텍스트 오버플로', ok: !warnings.overflow, value: warnings.overflow ? '선택 요소의 폭·크기를 조정하세요' : '없음' },
    { name: '안전영역', ok: !warnings.safe, value: warnings.safe ? '일부 요소가 안전 여백을 벗어남' : '정상' },
    { name: '색상 대비', ok: !warnings.contrast, value: warnings.contrast ? '배경 대비가 낮은 텍스트가 있음' : '정상' },
    { name: '기본 템플릿', ok: !validation.clipping && !validation.collision, value: !validation.clipping && !validation.collision ? '회귀 없음' : '기본 배치 확인 필요' },
  ];
  const canExport = !warnings.overflow;
  const switchTemplate = (template: TemplateId) => {
    const clearPresetAsset = draft.backgroundSource === 'preset';
    save({ ...draft, template, background: clearPresetAsset ? null : draft.background, backgroundSource: clearPresetAsset ? null : draft.backgroundSource, cleanBackground: false, presetLayout: {} }); setSelected(null);
  };
  const applyPreset = async (preset: ContentPreset) => {
    const templateEdits = { ...draft.templateEdits }, templateCopies = { ...draft.templateCopies };
    delete templateEdits[preset.template]; delete templateCopies[preset.template];
    let background = draft.background, backgroundSource = draft.backgroundSource;
    try {
      if (preset.asset) {
        setBusy(true); const response = await fetch(new URL(preset.asset, window.location.href)); if (!response.ok) throw new Error('asset'); const blob = await response.blob();
        background = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : ''); reader.onerror = reject; reader.readAsDataURL(blob); });
        backgroundSource = 'preset';
      } else if (backgroundSource === 'preset') { background = null; backgroundSource = null; }
      save({ ...draft, ...preset.fields, template: preset.template, mode: 'simple', background, backgroundSource, cleanBackground: Boolean(preset.asset), presetLayout: preset.layout || {}, templateEdits, templateCopies });
      setSelected(null); setNotice(`${preset.name} 프리셋을 적용했습니다`);
    } catch { setNotice('프리셋 배경을 불러오지 못했습니다'); } finally { setBusy(false); }
  };
  const resetElementPosition = () => {
    if (!selectedElement) return; clearElementFields(selectedElement.id, ['x', 'y', 'width', 'height']);
  };
  const resetElementStyle = () => {
    if (!selectedElement) return; clearElementFields(selectedElement.id, ['fontSize', 'fontWeight', 'textAlign', 'color']);
  };
  const resetElementColor = () => { if (selectedElement) clearElementFields(selectedElement.id, ['color']); };
  const resetTemplate = () => { const edits = { ...draft.templateEdits }, copies = { ...draft.templateCopies }; delete edits[draft.template]; delete copies[draft.template]; save({ ...draft, templateEdits: edits, templateCopies: copies }); setSelected(null); };
  const duplicateSelected = () => {
    if (!selectedElement) return; const copy: ElementState = clampElement({ ...selectedElement, id: `${selectedElement.kind}-copy-${Date.now()}`, content: contentFor(draft, selectedElement), asset: assetFor(draft, selectedElement), x: selectedElement.x + 20, y: selectedElement.y + 10, zIndex: selectedElement.zIndex + 1 });
    const list = [...(draft.templateCopies[draft.template] || []), copy]; save({ ...draft, templateCopies: { ...draft.templateCopies, [draft.template]: list } }); setSelected(copy.id);
  };
  const deleteSelected = () => {
    if (!selectedElement || (REQUIRED_KINDS.includes(selectedElement.kind) && !selectedElement.id.includes('-copy-'))) return;
    const copies = draft.templateCopies[draft.template] || [];
    if (copies.some(item => item.id === selectedElement.id)) save({ ...draft, templateCopies: { ...draft.templateCopies, [draft.template]: copies.filter(item => item.id !== selectedElement.id) } });
    else patchElement(selectedElement.id, { hidden: true });
    setSelected(null);
  };
  const parse = () => {
    const lines = pasted.split(/\n+/).map(value => value.trim()).filter(Boolean), next = { ...draft };
    const date = lines.find(value => /20\d{2}[.\-/년]/.test(value)), venue = lines.find(value => /중강당|강당|컨퍼런스홀|홀/.test(value)), title = lines.find(value => value !== date && value !== venue && !/^주[최관]/.test(value));
    if (title) next.title = title.replace(/^행사명\s*[:：]?/, ''); if (venue) next.venue = venue.replace(/^장소\s*[:：]?/, '');
    if (date) { const match = date.replace(/[년월]/g, '.').match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/), times = date.match(/\d{1,2}:\d{2}/g); if (match) next.date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; if (times?.[0]) next.start = times[0]; if (times?.[1]) next.end = times[1]; }
    save(next);
  };
  const image = (event: ChangeEvent<HTMLInputElement>, background: boolean) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const value = typeof reader.result === 'string' ? reader.result : '', next = background ? { ...draft, background: value, backgroundSource: 'upload' as const, cleanBackground: false, presetLayout: {} } : { ...draft, logos: [value] }; save(next); setSelected(background ? 'image' : 'logo'); }; reader.readAsDataURL(file); };
  const downloadPng = async () => { if (!canExport || busy) return; setBusy(true); const canvas = document.createElement('canvas'); await draw(canvas, draft); canvas.toBlob(blob => { if (blob) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `${clean(draft.name || draft.title)}.png`; anchor.click(); URL.revokeObjectURL(anchor.href); } setBusy(false); }, 'image/png'); };
  const downloadPptx = async () => {
    if (!canExport || busy) return; setBusy(true);
    try {
      const file = new pptxgen(); file.defineLayout({ name: 'OFFICIAL_LED', width: PPT.width, height: PPT.height }); file.layout = 'OFFICIAL_LED'; const slide = file.addSlide(); slide.background = { color: palette.background.slice(1) };
      const ordered: Array<{ zIndex: number; type: string; element?: ElementState; shape?: Shape }> = elements.map((element: ElementState) => ({ zIndex: element.zIndex, type: 'element', element }));
      if (!draft.cleanBackground) { if (draft.template === 'photo') ordered.push({ zIndex: 8, type: 'overlay' }); cfg.decorations.forEach((shape: Shape) => { if (shape.type !== 'gradient') ordered.push({ zIndex: 10, type: 'shape', shape }); }); }
      ordered.sort((a, b) => a.zIndex - b.zIndex);
      for (const layer of ordered) {
        if (layer.type === 'overlay') { slide.addShape(file.ShapeType.rect, { x: 0, y: 0, w: PPT.width, h: PPT.ledHeight, fill: { color: palette.overlay.slice(1), transparency: Math.round((1 - (palette.overlayOpacity || .58)) * 100) }, line: { transparency: 100 } }); continue; }
        if (layer.type === 'shape') { const shape = layer.shape!, color = palette[shape.color] || shape.color || palette.line; slide.addShape(file.ShapeType.rect, { x: shape.x / 100 * PPT.width, y: shape.y / 100 * PPT.ledHeight, w: shape.w / 100 * PPT.width, h: Math.max(.01, shape.h / 100 * PPT.ledHeight), fill: { color: color.slice(1) }, line: { transparency: 100 } }); continue; }
        const element = layer.element!; if (element.hidden) continue;
        const x = element.x / LED.width * PPT.width, y = element.y / LED.height * PPT.ledHeight, w = element.width / LED.width * PPT.width, h = element.height / LED.height * PPT.ledHeight;
        if (element.kind === 'logo' || element.kind === 'image') { const data = assetFor(draft, element); if (data) slide.addImage({ data, x, y, w, h, transparency: 0 }); continue; }
        const text = contentFor(draft, element); if (!text) continue;
        slide.addText(text, { x, y, w, h, fontFace: draft.font, fontSize: Math.max(5, (element.fontSize || 20) * .38), bold: (element.fontWeight || 400) >= 700, color: (element.color || '#000000').slice(1), margin: 0, align: element.textAlign || 'left', valign: 'top', breakLine: false, ...(draft.mode === 'simple' ? { fit: 'shrink' as const } : {}) });
      }
      await file.writeFile({ fileName: `${clean(draft.name || draft.title)}_수정용.pptx` }); setNotice('PPTX 생성 완료');
    } finally { setBusy(false); }
  };
  const saveJson = () => { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 4, draft }, null, 2)], { type: 'application/json' })); anchor.download = `${clean(draft.name || draft.title)}.json`; anchor.click(); };
  const loadJson = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const source = typeof reader.result === 'string' ? reader.result : '', value = JSON.parse(source), loaded = value.draft || value; save({ ...defaults(), ...loaded, templateEdits: loaded.templateEdits || {}, templateCopies: loaded.templateCopies || {} }); setNotice('작업 상태를 불러왔습니다'); } catch { setNotice('작업 JSON을 읽지 못했습니다'); } }; reader.readAsText(file); };
  const undo = () => { if (!history.length) return; setFuture(items => [draft, ...items]); setDraft(history[0]); setHistory(items => items.slice(1)); }, redo = () => { if (!future.length) return; setHistory(items => [draft, ...items]); setDraft(future[0]); setFuture(items => items.slice(1)); };
  const cards = (group: string) => templateIds.filter(id => TEMPLATES[id].group === group);
  const presetGroups = [
    { id: 'reference', title: '제공 예시 프리셋', note: '첨부 디자인과 예시 문구를 그대로 적용', items: contentPresets.filter(preset => preset.collection === 'reference') },
    { id: 'recommended', title: '추천 내용 프리셋', note: '문구와 디자인을 한 번에 적용', items: contentPresets.filter(preset => !preset.collection) },
  ];
  const baseButtons = EDITABLE_KINDS.map(kind => elements.find((item: ElementState) => item.id === kind)).filter(Boolean) as ElementState[];
  const setFontSize = (value: number) => { if (!selectedElement || !selectedText) return; const limits = FONT_LIMITS[selectedElement.kind as keyof typeof FONT_LIMITS]; patchElement(selectedElement.id, { fontSize: Math.max(limits.min, Math.min(limits.max, value)) }); };
  return <main className="app-shell">
    <header className="app-header"><div className="brand-mark"><span className="h">H</span><span>HANYANG UNIVERSITY<br /><b>ERICA</b></span></div><div><p className="eyebrow">FACILITY OPERATIONS TOOL · v2.2</p><h1>컨퍼런스홀 LED 현수막 제작기</h1></div><div className="header-status">2560 × 256 · 공식 PPTX 규격</div></header>
    <div className="workspace"><aside className="editor-panel">
      <section className="paste-panel"><div className="section-title"><b>QUICK START</b><span>행사명 · 일시 · 장소</span></div><textarea value={pasted} onChange={event => setPasted(event.target.value)} placeholder={'행사명\n2026. 9. 15. 14:00~17:00\n컨퍼런스홀 중강당'} /><button className="ghost-button" onClick={parse}>정보 자동 분리</button><label>행사명<input value={draft.title} onChange={event => update('title', event.target.value)} /></label><div className="field-row"><label>날짜<input type="date" value={draft.date} onChange={event => update('date', event.target.value)} /></label><label>시작<input type="time" value={draft.start} onChange={event => update('start', event.target.value)} /></label></div><label>장소<input value={draft.venue} onChange={event => update('venue', event.target.value)} /></label></section>
      {presetGroups.map(group => <section className={`preset-section ${group.id}`} key={group.id}><div className="section-heading"><div><b>{group.title}</b><span>{group.note}</span></div><em>{group.items.length}종</em></div><div className="preset-grid">{group.items.map(preset => <button disabled={busy} className={`content-preset ${preset.asset ? `has-asset ${preset.theme}` : ''}`} style={{ borderTopColor: preset.accent, ...(preset.asset ? { backgroundImage: `linear-gradient(${preset.theme === 'dark' ? 'rgba(3,24,63,.2)' : 'rgba(255,255,255,.68)'},${preset.theme === 'dark' ? 'rgba(3,24,63,.2)' : 'rgba(255,255,255,.82)'}),url(./${preset.asset})` } : {}) }} onClick={() => void applyPreset(preset)} key={preset.id}><span>{preset.eyebrow}</span><strong>{preset.fields.title}</strong><small><i style={{ background: preset.accent }} />{preset.name} · {TEMPLATES[preset.template].name}</small></button>)}</div></section>)}
      {['ERICA MODERN', '시설팀 기존 양식'].map(group => <section className="input-section" key={group}><div className="section-heading"><b>{group}</b><em>{cards(group).length}종</em></div><div className="template-grid">{cards(group).map(id => <button className={`template-card ${id} ${draft.template === id ? 'active' : ''}`} onClick={() => switchTemplate(id)} key={id}><i style={{ background: `linear-gradient(90deg,${TEMPLATES[id].palette.background} 64%,${TEMPLATES[id].palette.accent} 64%)` }} /><strong>{TEMPLATES[id].name}</strong><small>{TEMPLATES[id].use}</small></button>)}</div></section>)}
      <section className="accordion"><button onClick={() => setAdvanced(!advanced)}><span>내용 및 이미지</span><ChevronDown className={advanced ? 'open' : ''} size={17} /></button>{advanced && <div className="accordion-content"><label>부제<input value={draft.subtitle} onChange={event => update('subtitle', event.target.value)} /></label><label>종료 시간<input type="time" value={draft.end} onChange={event => update('end', event.target.value)} /></label><label>주최<input value={draft.host} onChange={event => update('host', event.target.value)} /></label><label>주관<input value={draft.organizer} onChange={event => update('organizer', event.target.value)} /></label><label>추가 문구<input value={draft.extra} onChange={event => update('extra', event.target.value)} /></label><label>글꼴<select value={draft.font} onChange={event => update('font', event.target.value)}><option>Arial</option><option>Malgun Gothic</option><option>Georgia</option></select></label><label>배경/키비주얼<input type="file" accept="image/*" onChange={event => image(event, true)} /></label><label>외부기관 로고<input type="file" accept="image/*" onChange={event => image(event, false)} /></label></div>}</section>
      <section className="work-tools"><input ref={workFile} type="file" hidden accept=".json,application/json" onChange={loadJson} /><button onClick={saveJson}><Save size={14} /> JSON 저장</button><button onClick={() => workFile.current?.click()}><Upload size={14} /> 불러오기</button><button onClick={undo} disabled={!history.length}><Undo2 size={14} /> Undo</button><button onClick={redo} disabled={!future.length}><Redo2 size={14} /> Redo</button></section>
    </aside><section className="preview-panel">
      <div className="preview-toolbar"><div><p className="eyebrow">LIVE PREVIEW</p><h2>실제 송출 영역</h2></div><div className="preview-actions"><div className="mode-switch" aria-label="편집 모드"><button className={draft.mode === 'simple' ? 'active' : ''} onClick={() => { update('mode', 'simple'); setSelected(null); }}>간편 모드</button><button className={draft.mode === 'edit' ? 'active' : ''} onClick={() => update('mode', 'edit')}><Move size={13} /> 직접 편집</button></div><label className="safe-toggle"><input type="checkbox" checked={safe} onChange={event => setSafe(event.target.checked)} /> 안전영역</label></div></div>
      <Preview draft={draft} selected={selected} setSelected={setSelected} onPatch={patchElement} beginGesture={beginGesture} endGesture={endGesture} guides={guides} setGuides={setGuides} safe={safe} />
      {draft.mode === 'edit' && <section className="context-editor">
        <div className="element-tabs">{baseButtons.map(element => <button key={element.id} className={`${selected === element.id ? 'active' : ''} ${element.hidden ? 'hidden' : ''}`} onClick={() => { setSelected(element.id); if (element.hidden) patchElement(element.id, { hidden: false }); }}>{LABELS[element.kind]}{element.hidden ? ' · 숨김' : ''}</button>)}</div>
        {selectedElement ? <div className="context-row"><div className="selected-title"><b>{LABELS[selectedElement.kind]}</b><span>X {Math.round(selectedElement.x)} · Y {Math.round(selectedElement.y)} · W {Math.round(selectedElement.width)}</span></div>
          {selectedText && <><div className="font-size-control"><button title="1px 작게" onClick={() => setFontSize((selectedElement.fontSize || 20) - 1)}><Minus size={14} /></button><input aria-label="글자 크기" type="number" value={Math.round(selectedElement.fontSize || 20)} min={FONT_LIMITS[selectedElement.kind as keyof typeof FONT_LIMITS].min} max={FONT_LIMITS[selectedElement.kind as keyof typeof FONT_LIMITS].max} onChange={event => setFontSize(Number(event.target.value))} /><span>px</span><button title="1px 크게" onClick={() => setFontSize((selectedElement.fontSize || 20) + 1)}><Plus size={14} /></button></div><div className="tool-group"><button className={(selectedElement.fontWeight || 400) >= 700 ? 'active' : ''} title="굵게" onClick={() => patchElement(selectedElement.id, { fontWeight: (selectedElement.fontWeight || 400) >= 700 ? 400 : 700 })}><Bold size={15} /></button>{(['left', 'center', 'right'] as Align[]).map(align => <button key={align} className={selectedElement.textAlign === align ? 'active' : ''} title={`${align} 정렬`} onClick={() => patchElement(selectedElement.id, { textAlign: align })}>{align === 'left' ? <AlignLeft size={15} /> : align === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}</button>)}</div><div className="color-tools"><button className="template-color" title="템플릿 기본색" onClick={resetElementColor}>기본색</button>{COLORS.map(color => <button key={color.value} className="color-swatch" aria-label={color.name} title={color.name} style={{ background: color.value }} onClick={() => patchElement(selectedElement.id, { color: color.value })} />)}<input aria-label="사용자 색상" type="color" value={selectedElement.color || '#000000'} onChange={event => patchElement(selectedElement.id, { color: event.target.value })} /></div></>}
          <label className="width-control">폭 <input type="number" min="80" max={Math.floor(LED.width - selectedElement.x)} value={Math.round(selectedElement.width)} onChange={event => patchElement(selectedElement.id, { width: resizeElement(selectedElement, Number(event.target.value)).width })} /></label>
          {selectedElement.kind === 'image' && <div className="tool-group"><button className={draft.fit === 'cover' ? 'active' : ''} onClick={() => update('fit', 'cover')}>채우기</button><button className={draft.fit === 'contain' ? 'active' : ''} onClick={() => update('fit', 'contain')}>맞추기</button></div>}
          <div className="layer-tools"><button title="맨 뒤로" onClick={() => patchElement(selectedElement.id, { zIndex: layerValue(elements, selectedElement.id, 'back') })}>맨 뒤</button><button title="뒤로 보내기" onClick={() => patchElement(selectedElement.id, { zIndex: layerValue(elements, selectedElement.id, 'backward') })}>뒤</button><button title="앞으로 가져오기" onClick={() => patchElement(selectedElement.id, { zIndex: layerValue(elements, selectedElement.id, 'forward') })}>앞</button><button title="맨 앞으로" onClick={() => patchElement(selectedElement.id, { zIndex: layerValue(elements, selectedElement.id, 'front') })}>맨 앞</button></div>
          <div className="tool-group"><button title="복제" onClick={duplicateSelected}><Copy size={14} /></button><button title="삭제 또는 숨김" disabled={REQUIRED_KINDS.includes(selectedElement.kind) && !selectedElement.id.includes('-copy-')} onClick={deleteSelected}><Trash2 size={14} /></button></div>
          <div className="reset-tools"><button onClick={resetElementPosition}>위치 초기화</button>{selectedText && <button onClick={resetElementStyle}>스타일 초기화</button>}<button onClick={resetTemplate}>템플릿 전체 초기화</button></div>
        </div> : <p className="editor-hint">미리보기의 요소를 선택하세요. 드래그 또는 방향키로 이동할 수 있습니다.</p>}
      </section>}
      <div className="preview-caption"><b>{cfg.name}</b><span>{draft.mode === 'edit' ? '캔버스 픽셀 좌표로 직접 편집 중' : '자동 레이아웃 적용 중'}</span></div><details className="check-panel" open={!canExport || warnings.safe || warnings.contrast}><summary>{canExport && !warnings.safe && !warnings.contrast ? '✓ 출력 준비 완료' : '! 출력 전 확인 필요'}</summary>{checks.map(item => <div className={`check-item ${item.ok ? '' : 'warning'}`} key={item.name}>{item.ok ? <Check size={16} /> : <AlertTriangle size={16} />}<b>{item.name}</b><span>{item.value}</span></div>)}</details>
    </section></div>
    <footer className="action-bar"><div className="lock-control"><button onClick={() => update('locked', !draft.locked)}>{draft.locked ? <Lock size={15} /> : <LockOpen size={15} />}{draft.locked ? '잠금 해제' : '편집 잠금'}</button></div><input placeholder="출력 파일명 (선택)" value={draft.name} onChange={event => update('name', event.target.value)} /><button className="reset" onClick={() => { if (confirm('모든 템플릿의 작업을 초기화할까요?')) { setDraft(defaults()); setHistory([]); setFuture([]); setSelected(null); } }}><RotateCcw size={17} /> 전체 초기화</button><button className="download secondary" disabled={!canExport || busy} onClick={downloadPptx}><FileText size={18} /> 수정 가능한 PPTX</button><button className="download" disabled={!canExport || busy} onClick={downloadPng}><FileImage size={18} /> PNG 다운로드</button></footer>
    {notice && <p className="notice">{notice}</p>}<p className="facility-note">공식 LED: 6400 × 640mm · 2560 × 256px · PPTX 원본 슬라이드 크기 변경 금지 · 현장지원 4446</p>
  </main>;
}
