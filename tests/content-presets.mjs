import assert from 'node:assert/strict';
import { CONTENT_PRESETS } from '../lib/content-presets.js';
import { TEMPLATE_IDS, validateTemplate } from '../lib/template-config.js';

assert.equal(CONTENT_PRESETS.length, 4, '추천 프리셋은 4종이어야 합니다.');
assert.equal(
  new Set(CONTENT_PRESETS.map((preset) => preset.id)).size,
  CONTENT_PRESETS.length,
  '프리셋 ID는 고유해야 합니다.',
);

for (const preset of CONTENT_PRESETS) {
  assert.ok(
    TEMPLATE_IDS.includes(preset.template),
    `${preset.name}: 유효한 템플릿을 사용해야 합니다.`,
  );
  for (const key of [
    'title',
    'subtitle',
    'date',
    'start',
    'venue',
    'host',
    'extra',
  ]) {
    assert.ok(
      preset.fields[key]?.trim(),
      `${preset.name}: ${key} 기본 문구가 필요합니다.`,
    );
  }
  const result = validateTemplate(preset.fields.title, preset.template);
  assert.equal(
    result.clipping,
    false,
    `${preset.name}: 제목이 송출 영역을 벗어납니다.`,
  );
  assert.equal(
    result.collision,
    false,
    `${preset.name}: 제목과 메타 정보가 겹칩니다.`,
  );
}

console.log(
  `Content preset regression passed (${CONTENT_PRESETS.length} presets).`,
);
