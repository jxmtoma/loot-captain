// Loot Captain - popup (character switcher + formula)

const PROFILES_KEY = 'profiles';
const SELECTED_KEY = 'selectedProfileId';
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
  { key: 'endregen', label: 'End Regen' },
  { key: 'netpos', label: 'Net positive' },
];
const DEFAULT_FORMULA_KEY = 'ac10hp';

function $(sel) { return document.querySelector(sel); }

async function load() {
  const res = await chrome.storage.local.get([PROFILES_KEY, SELECTED_KEY, SCORE_KEY]);
  const profiles = res[PROFILES_KEY] || {};
  const selectedId = res[SELECTED_KEY] || '';
  const formulaKey = SCORE_FORMULAS.some((formula) => formula.key === res[SCORE_KEY]) ? res[SCORE_KEY] : DEFAULT_FORMULA_KEY;

  // Profile select
  const profileSel = $('#profile-select');
  profileSel.innerHTML = '<option value="">- none -</option>';
  for (const id of Object.keys(profiles)) {
    const p = profiles[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = p.name || 'Unnamed';
    const meta = [p.cls, p.level && 'Lv ' + p.level].filter(Boolean).join(' · ');
    if (meta) opt.textContent += ' (' + meta + ')';
    profileSel.appendChild(opt);
  }
  profileSel.value = selectedId;

  // Formula select
  const formulaSel = $('#formula-select');
  formulaSel.innerHTML = SCORE_FORMULAS.map((f) => '<option value="' + f.key + '">' + f.label + '</option>').join('');
  formulaSel.value = formulaKey;

  // Status
  const status = $('#status');
  if (selectedId && profiles[selectedId]) {
    const p = profiles[selectedId];
    status.textContent = (p.items || []).length + ' items · ' + (p.cls || '?') + (p.level ? ' Lv' + p.level : '');
  } else {
    status.textContent = 'No active character';
  }
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

  $('#profile-select').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ [SELECTED_KEY]: e.target.value });
    await load();
  });

  $('#formula-select').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ [SCORE_KEY]: e.target.value });
  });

}

document.addEventListener('DOMContentLoaded', init);
