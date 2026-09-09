import { TEMPLATES } from './template-config.js';

export const LED = { width: 2560, height: 256 };
export const EDITABLE_KINDS = ['title', 'subtitle', 'date', 'venue', 'host', 'organizer', 'extra', 'logo', 'image'];
export const TEXT_KINDS = ['title', 'subtitle', 'date', 'venue', 'host', 'organizer', 'extra'];
export const REQUIRED_KINDS = ['title'];
export const FONT_LIMITS = {
  title: { min: 24, max: 160 },
  subtitle: { min: 12, max: 80 },
  date: { min: 12, max: 64 },
  venue: { min: 12, max: 64 },
  host: { min: 12, max: 52 },
  organizer: { min: 12, max: 52 },
  extra: { min: 12, max: 80 },
};

const toPxX = value => value / 100 * LED.width;
const toPxY = value => value / 100 * LED.height;
const anchorLeft = (anchor, width, align) => align === 'center' ? anchor - width / 2 : align === 'right' ? anchor - width : anchor;
const groupLeft = (anchor, width, align) => align === 'center' ? anchor - width / 2 : align === 'right' ? anchor - width : anchor;

export function elementDefaults(template) {
  const cfg = TEMPLATES[template], { layout, palette } = cfg;
  const titleWidth = toPxX(layout.titleWidth), titleAnchor = toPxX(layout.title.x), titleX = anchorLeft(titleAnchor, titleWidth, layout.align);
  const metaAnchor = toPxX(layout.meta.x), metaWidth = Math.min(titleWidth, 1320), metaX = groupLeft(metaAnchor, metaWidth, layout.align);
  const hostAnchor = toPxX(layout.host.x), hostWidth = 650, hostX = hostAnchor - hostWidth;
  const dateWidth = layout.align === 'left' ? 340 : metaWidth * .47;
  const venueX = layout.align === 'left' ? metaX + 360 : metaX + metaWidth * .49;
  const venueWidth = layout.align === 'left' ? Math.min(700, titleWidth - 360) : metaWidth * .51;
  return [
    { id: 'image', kind: 'image', x: 0, y: 0, width: LED.width, height: LED.height, zIndex: 2, hidden: false },
    { id: 'title', kind: 'title', x: titleX, y: toPxY(layout.title.y), width: titleWidth, height: layout.titleMaxHeight / 100 * LED.height, fontSize: layout.fontSize, fontWeight: 700, textAlign: layout.align, color: palette.title, zIndex: 30, hidden: false },
    { id: 'subtitle', kind: 'subtitle', x: titleX, y: toPxY(layout.subtitle.y), width: titleWidth, height: 32, fontSize: 17, fontWeight: 700, textAlign: layout.align, color: palette.subtitle, zIndex: 31, hidden: false },
    { id: 'date', kind: 'date', x: metaX, y: toPxY(layout.meta.y), width: dateWidth, height: 28, fontSize: 20, fontWeight: 700, textAlign: layout.align === 'center' ? 'right' : layout.align, color: palette.meta, zIndex: 32, hidden: false },
    { id: 'venue', kind: 'venue', x: venueX, y: toPxY(layout.meta.y), width: venueWidth, height: 28, fontSize: 20, fontWeight: 700, textAlign: layout.align === 'center' ? 'left' : layout.align, color: palette.meta, zIndex: 33, hidden: false },
    { id: 'host', kind: 'host', x: hostX, y: toPxY(layout.host.y), width: hostWidth, height: 24, fontSize: 14, fontWeight: 700, textAlign: 'right', color: palette.meta, zIndex: 34, hidden: false },
    { id: 'organizer', kind: 'organizer', x: hostX + hostWidth * .55, y: toPxY(layout.host.y), width: hostWidth * .45, height: 24, fontSize: 14, fontWeight: 700, textAlign: 'right', color: palette.meta, zIndex: 35, hidden: false },
    { id: 'extra', kind: 'extra', x: titleX, y: toPxY(68), width: Math.min(titleWidth, 1180), height: 32, fontSize: 18, fontWeight: 400, textAlign: layout.align, color: palette.subtitle, zIndex: 36, hidden: false },
    { id: 'logo', kind: 'logo', x: 2290, y: 44, width: 160, height: 52, zIndex: 40, hidden: false },
  ];
}

export function materializeElements(template, overrides = {}, copies = []) {
  return [...elementDefaults(template).map(base => ({ ...base, ...overrides[base.id] })), ...copies.map(item => ({ ...item }))]
    .map(clampElement)
    .sort((a, b) => a.zIndex - b.zIndex);
}

export function clampElement(element) {
  const width = Math.max(40, Math.min(LED.width, Number(element.width) || 40));
  const height = Math.max(8, Math.min(LED.height, Number(element.height) || 24));
  return {
    ...element,
    width,
    height,
    x: Math.max(0, Math.min(LED.width - width, Number(element.x) || 0)),
    y: Math.max(0, Math.min(LED.height - height, Number(element.y) || 0)),
  };
}

export function nudgeElement(element, dx, dy) {
  return clampElement({ ...element, x: element.x + dx, y: element.y + dy });
}

export function resizeElement(element, width) {
  return clampElement({ ...element, width: Math.max(80, Math.min(LED.width - element.x, width)) });
}

export function snapPosition(element, nextX, nextY, others, safeMarginX, safeMarginY = safeMarginX, threshold = 8) {
  const result = { x: nextX, y: nextY, guides: [] };
  const snap = (value, candidates, axis) => {
    let best = null;
    for (const candidate of candidates) {
      const distance = Math.abs(value - candidate.value);
      if (distance <= threshold && (!best || distance < best.distance)) best = { ...candidate, distance };
    }
    if (best) { result.guides.push({ axis, value: best.guide }); return best.value; }
    return value;
  };
  const vertical = [
    { value: safeMarginX, guide: safeMarginX },
    { value: LED.width - safeMarginX - element.width, guide: LED.width - safeMarginX },
    { value: LED.width / 2 - element.width / 2, guide: LED.width / 2 },
  ];
  const horizontal = [
    { value: safeMarginY, guide: safeMarginY },
    { value: LED.height - safeMarginY - element.height, guide: LED.height - safeMarginY },
    { value: LED.height / 2 - element.height / 2, guide: LED.height / 2 },
  ];
  for (const other of others.filter(item => item.id !== element.id && !item.hidden)) {
    vertical.push({ value: other.x, guide: other.x }, { value: other.x + other.width, guide: other.x + other.width }, { value: other.x + other.width / 2 - element.width / 2, guide: other.x + other.width / 2 });
    horizontal.push({ value: other.y, guide: other.y }, { value: other.y + other.height, guide: other.y + other.height }, { value: other.y + other.height / 2 - element.height / 2, guide: other.y + other.height / 2 });
  }
  result.x = snap(nextX, vertical, 'x');
  result.y = snap(nextY, horizontal, 'y');
  return { ...clampElement({ ...element, x: result.x, y: result.y }), guides: result.guides };
}

export function layerValue(elements, id, action) {
  const ordered = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const current = ordered.findIndex(item => item.id === id);
  if (current < 0) return elements.find(item => item.id === id)?.zIndex || 20;
  if (action === 'front') return Math.min(90, Math.max(...ordered.map(item => item.zIndex)) + 1);
  if (action === 'back') return Math.max(1, Math.min(...ordered.map(item => item.zIndex)) - 1);
  if (action === 'forward') return ordered[Math.min(ordered.length - 1, current + 1)].zIndex + 1;
  return ordered[Math.max(0, current - 1)].zIndex - 1;
}

export function isInsideSafeMargin(element, safeMarginX, safeMarginY = safeMarginX) {
  return element.x >= safeMarginX && element.y >= safeMarginY && element.x + element.width <= LED.width - safeMarginX && element.y + element.height <= LED.height - safeMarginY;
}
