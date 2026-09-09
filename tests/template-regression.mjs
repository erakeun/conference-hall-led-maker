import assert from 'node:assert/strict';
import { contrastRatio, TEMPLATE_IDS, TEMPLATES, templateDefaults, titlePlan, validateTemplate } from '../lib/template-config.js';

const titles = [
  '신임교원 환영식',
  '2026 한양대학교 ERICA 산학협력 성과공유회',
  '2026년 지역혁신중심 대학지원체계 기반 산학연 협력 성과공유 및 미래전략 포럼',
  'HANYANG ERICA GLOBAL INNOVATION FORUM 2026',
  'ERICA IC-PBL 10th Anniversary Conference',
];

assert.equal(TEMPLATE_IDS.length, 12);
for (const template of TEMPLATE_IDS) {
  const cfg = TEMPLATES[template], positions = templateDefaults(template).positions;
  assert.ok(cfg.palette.background && cfg.palette.title && cfg.palette.subtitle && cfg.palette.meta && cfg.palette.accent && cfg.palette.line);
  assert.ok(contrastRatio(cfg.palette.title,cfg.palette.background)>=3,`${template}: title contrast`);
  assert.ok(cfg.layout.titleWidth && cfg.layout.titleMaxHeight && cfg.layout.fontSize && cfg.layout.lineHeight && cfg.layout.safeMargin);
  for (const title of titles) {
    const result = validateTemplate(title, template, positions);
    assert.equal(result.clipping, false, `${template}: clipping: ${title}`);
    assert.equal(result.collision, false, `${template}: line collision: ${title}`);
    assert.equal(result.overflow, false, `${template}: overflow: ${title}`);
    assert.ok(titlePlan(title, template).size >= 34, `${template}: font below minimum`);
  }
}
const isolated={standard:{...templateDefaults('standard').positions,title:{x:25,y:25}}};
assert.notDeepEqual(isolated.standard,templateDefaults('blue').positions,'template custom positions must remain isolated');
console.log(`PASS ${TEMPLATE_IDS.length} templates × ${titles.length} titles: 0 clipping, 0 line collisions`);
