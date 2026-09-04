// Loot Captain - popup (character switcher + formula)

const PROFILES_KEY = 'profiles';
const COMPARE_KEY = 'compareProfileIds';
const LAYOUT_KEY = 'compareBadgeLayout';
const SCORE_KEY = 'scoreFormula';
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;

const SCORE_FORMULAS = [
  { key: 'ac10hp', label: '1AC=10HP' },
  { key: 'ac15hp', label: '1AC=15HP' },
  { key: 'hdex', label: '1HDex=4AC=40HP' },
  { key: 'hagi', label: '1HAgi=4AC=40HP' },
  { key: 'hp', label: 'HP' },
  { key: 'mana', label: 'Mana' },
  { key: 'end', label: 'Endurance' },
  { key: 'regen', label: 'HP Regen' },
  { key: 'manaregen', label: 'Mana Regen' },
  { key: 'endregen', label: 'End Regen' },
  { key: 'netpos', label: 'Net positive' },
];
const DEFAULT_FORMULA_KEY = 'ac10hp';

function $(sel) { return document.querySelector(sel); }

let selectedIds = [];

async function load() {
  const res = await chrome.storage.local.get([PROFILES_KEY, COMPARE_KEY, LAYOUT_KEY, SCORE_KEY]);
  const profiles = res[PROFILES_KEY] || {};
  selectedIds = Array.isArray(res[COMPARE_KEY]) ? res[COMPARE_KEY] : [];
  const layoutKey = res[LAYOUT_KEY] === 'expanded' ? 'expanded' : 'collapsed';
  const formulaKey = SCORE_FORMULAS.some((formula) => formula.key === res[SCORE_KEY]) ? res[SCORE_KEY] : DEFAULT_FORMULA_KEY;

  // Compare characters (multi-select chips)
  const compareList = $('#compare-list');
  compareList.innerHTML = '';
  for (const id of Object.keys(profiles)) {
    const p = profiles[id];
    const chip = document.createElement('label');
    chip.className = 'compare-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = id;
    input.checked = selectedIds.includes(id);
    chip.appendChild(input);
    const name = document.createElement('span');
    name.textContent = [p.name || 'Unnamed', p.cls, p.level && 'Lv ' + p.level].filter(Boolean).join(' · ');
    chip.appendChild(name);
    compareList.appendChild(chip);
  }

  // Badge layout (how multi-character badges render on item pages)
  $('#layout-select').value = layoutKey;

  // Formula select
  const formulaSel = $('#formula-select');
  formulaSel.innerHTML = SCORE_FORMULAS.map((f) => '<option value="' + f.key + '">' + f.label + '</option>').join('');
  formulaSel.value = formulaKey;

  // Status
  const status = $('#status');
  const count = selectedIds.filter((id) => profiles[id]).length;
  status.textContent = count
    ? count + (count === 1 ? ' character selected' : ' characters selected')
    : 'No characters selected';
}

async function init() {
  $('#btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const consent = await chrome.storage.local.get(CONSENT_KEY);
  if (consent[CONSENT_KEY] !== CONSENT_VERSION) {
    $('#status').textContent = 'Review data use in Manage Characters';
    return;
  }

  await load();

  $('#compare-list').addEventListener('change', async () => {
    const ids = Array.from(document.querySelectorAll('#compare-list input:checked'))
      .map((input) => input.value);
    await chrome.storage.local.set({ [COMPARE_KEY]: ids });
    await load();
  });

  $('#layout-select').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ [LAYOUT_KEY]: e.target.value });
  });

  $('#formula-select').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ [SCORE_KEY]: e.target.value });
  });

}

document.addEventListener('DOMContentLoaded', init);
