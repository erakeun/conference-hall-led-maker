import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT_PRESETS } from '../lib/content-presets.js';
import { TEMPLATE_IDS, validateTemplate } from '../lib/template-config.js';

assert.equal(CONTENT_PRESETS.length, 10, '전체 프리셋은 10종이어야 합니다.');
assert.equal(
  CONTENT_PRESETS.filter((preset) => preset.collection === 'reference').length,
  6,
  '제공 예시는 6종이어야 합니다.',
);
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
  for (const key of ['title', 'date', 'start', 'venue'])
    assert.ok(
      preset.fields[key]?.trim(),
      `${preset.name}: ${key} 기본 문구가 필요합니다.`,
    );
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
  if (preset.asset) {
    const png = readFileSync(
      new URL(`../public/${preset.asset}`, import.meta.url),
    );
    assert.equal(
      png.readUInt32BE(16),
      2560,
      `${preset.name}: 배경 폭은 2560px이어야 합니다.`,
    );
    assert.equal(
      png.readUInt32BE(20),
      256,
      `${preset.name}: 배경 높이는 256px이어야 합니다.`,
    );
    assert.ok(
      preset.layout?.title && preset.layout?.date && preset.layout?.venue,
      `${preset.name}: 예시 전용 배치값이 필요합니다.`,
    );
  }
}

console.log(
  `Content preset regression passed (${CONTENT_PRESETS.length} presets).`,
);
