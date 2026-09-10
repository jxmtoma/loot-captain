// Loot Captain - popup (character switcher + formula)

const PROFILES_KEY = 'profiles';
const COMPARE_KEY = 'compareProfileIds';
const LAYOUT_KEY = 'compareBadgeLayout';
const SCORE_KEY = 'scoreFormula';
const CONSENT_KEY = 'consentVersion';
const CONSENT_VERSION = 1;

const scoring = window.LootCaptain.diff;
const SCORE_FORMULAS = scoring.SCORE_FORMULAS;
let formulaProfileId = '';
let loadGeneration = 0;

function $(sel) { return document.querySelector(sel); }

let selectedIds = [];

async function load() {
  const generation = ++loadGeneration;
  const res = await chrome.storage.local.get([PROFILES_KEY, COMPARE_KEY, LAYOUT_KEY, SCORE_KEY]);
  if (generation !== loadGeneration) return;
  const profiles = res[PROFILES_KEY] || {};
  selectedIds = Array.isArray(res[COMPARE_KEY]) ? res[COMPARE_KEY] : [];
  const layoutKey = res[LAYOUT_KEY] === 'expanded' ? 'expanded' : 'collapsed';


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

  // Editing scoring never changes which characters are compared.
  const characterSelect = $('#formula-character');
  if (!profiles[formulaProfileId]) formulaProfileId = Object.keys(profiles)[0] || '';
  characterSelect.replaceChildren(...Object.keys(profiles).map((id) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = profiles[id].name || 'Unnamed';
    return option;
  }));
  characterSelect.value = formulaProfileId;
  characterSelect.disabled = !formulaProfileId;
  const resolved = scoring.resolveFormula(profiles[formulaProfileId], res[SCORE_KEY]);
  $('#formula-status').textContent = resolved.warning || (formulaProfileId ? resolved.key + ' v' + resolved.version : 'Add a character first');
  // Formula select
  const formulaSel = $('#formula-select');
  formulaSel.innerHTML = SCORE_FORMULAS.map((f) => '<option value="' + f.key + '">' + f.label + '</option>').join('');
  formulaSel.value = resolved.key;
  formulaSel.disabled = !formulaProfileId;

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

  $('#formula-character').addEventListener('change', async (event) => {
    formulaProfileId = event.target.value;
    await load();
  });
  $('#formula-select').addEventListener('change', async (event) => {
    const id = formulaProfileId;
    const formula = SCORE_FORMULAS.find((entry) => entry.key === event.target.value);
    try {
      const result = await chrome.runtime.sendMessage({ type: 'SET_PROFILE_FORMULA', profileId: id,
        formula: { key: formula.key, version: formula.version } });
      if (!result || !result.ok) throw new Error(result && result.error || 'Could not save formula');
      await load();
    } catch (error) {
      await load();
      $('#formula-status').textContent = error.message;
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[PROFILES_KEY] || changes[SCORE_KEY])) load();
  });

}

document.addEventListener('DOMContentLoaded', init);
