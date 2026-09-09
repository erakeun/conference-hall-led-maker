import assert from 'node:assert/strict';
import { TEMPLATE_IDS } from '../lib/template-config.js';
import {
  EDITABLE_KINDS,
  LED,
  clampElement,
  elementDefaults,
  isInsideSafeMargin,
  layerValue,
  materializeElements,
  nudgeElement,
  resizeElement,
  snapPosition,
} from '../lib/editor-model.js';

for (const template of TEMPLATE_IDS) {
  const defaults = elementDefaults(template);
  assert.deepEqual(defaults.map(item => item.kind).sort(), [...EDITABLE_KINDS].sort(), `${template}: editable elements`);
  for (const item of defaults) {
    assert.ok(item.x >= 0 && item.y >= 0, `${template}/${item.kind}: negative position`);
    assert.ok(item.x + item.width <= LED.width, `${template}/${item.kind}: horizontal overflow`);
    assert.ok(item.y + item.height <= LED.height, `${template}/${item.kind}: vertical overflow`);
  }
}

const base = materializeElements('standard').find(item => item.id === 'title');
assert.equal(nudgeElement(base, 1, 0).x, base.x + 1, 'Arrow moves 1px');
assert.equal(nudgeElement(base, 10, 0).x, base.x + 10, 'Shift+Arrow moves 10px');
assert.equal(nudgeElement(base, .5, 0).x, base.x + .5, 'Option+Arrow moves 0.5px');
assert.equal(clampElement({ ...base, x: -100 }).x, 0, 'left canvas boundary');
assert.equal(clampElement({ ...base, x: LED.width }).x, LED.width - base.width, 'right canvas boundary');
assert.equal(resizeElement(base, 20).width, 80, 'minimum width');

const centered = snapPosition(base, LED.width / 2 - base.width / 2 + 5, base.y, [base], 100, 10);
assert.equal(centered.x, LED.width / 2 - base.width / 2, 'center snapping');
assert.ok(centered.guides.some(guide => guide.axis === 'x' && guide.value === LED.width / 2), 'center guide');
assert.equal(isInsideSafeMargin({ ...base, x: 100, y: 10 }, 100, 10), true, 'independent safe margins');

const elements = materializeElements('standard');
assert.ok(layerValue(elements, 'image', 'front') > elements.find(item => item.id === 'title').zIndex, 'image can move forward');
assert.ok(layerValue(elements, 'title', 'back') < elements.find(item => item.id === 'image').zIndex, 'text can move to back without moving canvas background');

const edited = materializeElements('standard', { title: { x: 333, fontSize: 52, textAlign: 'right', color: '#000000' } });
const title = edited.find(item => item.id === 'title');
assert.equal(title.x, 333);
assert.equal(title.fontSize, 52);
assert.equal(title.textAlign, 'right');
assert.equal(title.color, '#000000');
assert.equal(materializeElements('blue').find(item => item.id === 'title').x, elementDefaults('blue').find(item => item.id === 'title').x, 'template isolation');

const snapshot = { mode: 'edit', templateEdits: { standard: { title: { x: 333, width: 1200, fontSize: 52, fontWeight: 700, textAlign: 'right', color: '#000000', zIndex: 42, hidden: false } } } };
assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot, 'JSON round trip');
console.log(`PASS editor model: ${TEMPLATE_IDS.length} templates, canvas constraints, nudge, resize, snap, layers, JSON`);
