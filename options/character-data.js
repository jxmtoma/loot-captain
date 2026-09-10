// Editor for manually observed character data. Values never feed scoring in 05A.
let characterDataView = null;
let characterDataStatusGeneration = 0;
const characterDataModel = window.LootCaptain.characterData;
const characterMetricLabel = (key) => ({ HP: 'Max HP', MANA: 'Max mana', END: 'Max endurance', ATK: 'Displayed ATK', Accuracy: 'Accuracy modifier (Stats tab)' }[key] ||
  (key.endsWith('Cap') ? key.slice(0, -3) + ' cap' : key.startsWith('H') ? 'Heroic ' + key.slice(1) : key));
function characterInput(parent, label, value = '', type = 'text') {
  const wrapper = el('label', '', label);
  const input = el(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.value = value == null ? '' : value;
  if (type === 'number') { input.min = '0'; input.step = 'any'; input.placeholder = 'Unknown'; }
  wrapper.appendChild(input); parent.appendChild(wrapper);
  return input;
}
function localObservationTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function timeFields(time) {
  const value = time.value;
  if (!value || !Number.isFinite(new Date(value).getTime())) throw new Error('Enter the observation time');
  return { observedAt: new Date(value).toISOString(), observedAtRaw: value,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
function characterSection(parent, title, open = false) {
  const section = el('details', 'character-data-section'); section.open = open;
  section.appendChild(el('summary', '', title)); parent.appendChild(section);
  return section;
}
function characterButton(parent, label, action) {
  const button = el('button', 'btn btn-small', label); button.type = 'button';
  button.addEventListener('click', action); parent.appendChild(button); return button;
}
function readCharacterAAs(view) {
  return view.aaRows.map((row) => ({ ...Object.fromEntries(Object.entries(row.inputs).map(([key, input]) => [key, input.value])),
    ...(row.assumed ? { assumed: true } : {}) }))
    .filter((row) => Object.values(row).some((value) => typeof value === 'string' && value.trim()));
}
async function refreshCharacterDataStatus() {
  const view = characterDataView;
  if (!view || view.profileId !== editingId) return;
  const generation = ++characterDataStatusGeneration;
  const profile = profiles[view.profileId];
  if (!profile) { view.status.textContent = 'Save this character first, or reopen it if it was deleted.'; return; }
  const status = await characterDataModel.status(profile);
  if (view !== characterDataView || generation !== characterDataStatusGeneration) return;
  view.status.textContent = status.message;
  view.status.dataset.state = status.state;
  const ranks = profile.characterData && profile.characterData.aaRanks || [];
  const assumed = ranks.filter((entry) => entry.assumed).length;
  view.managerSummary.textContent = 'AA & character stats · ' + (ranks.length ? ranks.length + ' AAs' + (assumed ? ' (' + assumed + ' assumed)' : '') : 'Max-rank defaults') +
    ' · ' + ({ missing: 'No snapshot', partial: 'Partial snapshot', stale: 'Snapshot needs update', recorded: 'Snapshot saved', unsupported: 'Unsupported data' }[status.state] || '');
  const revision = profile.characterData && profile.characterData.revision || 0;
  if (revision !== view.revision) view.status.textContent += ' Saved inputs changed; reload them before saving this draft.';
}
async function saveCharacterInput(view, action, value) {
  if (view.busy || view !== characterDataView || editingId !== view.profileId) return;
  view.busy = true; view.fields.disabled = true;
  view.message.textContent = 'Saving…';
  try {
    const draftProfile = { ...editingProfile, cls: $('#profile-class').value,
      level: $('#profile-level').value.trim(), server: $('#profile-server').value.trim() };
    const binding = await view.binding;
    if (await characterDataModel.fingerprint(draftProfile) !== binding) {
      throw new Error('Save your character or gear edits first, then reload the saved inputs. Your input draft has been kept.');
    }
    if (['snapshot', 'observation', 'approveRule'].includes(action) && characterDataModel.serialize(characterDataModel.aaRanks(readCharacterAAs(view))) !==
        characterDataModel.serialize(view.data.aaRanks)) throw new Error('Save your AA rank edits before capturing the snapshot.');
    const response = await chrome.runtime.sendMessage({ type: 'SAVE_CHARACTER_DATA', profileId: view.profileId,
      expectedRevision: view.revision, expectedBinding: binding, action, value });
    if (!response || !response.ok) throw new Error(response && response.error || 'Could not save character inputs');
    if (view !== characterDataView || editingId !== view.profileId) return;
    view.data = response.characterData; view.revision = response.characterData.revision;
    if (profiles[view.profileId]) profiles[view.profileId].characterData = response.characterData;
    editingProfile.characterData = response.characterData;
    if (view.aaSummary) view.aaSummary.textContent = 'AA ranks (' + view.data.aaRanks.length + ')';
    view.message.textContent = action === 'observation' ? 'Observation saved locally; it has not been validated.' : 'Saved locally.';
    renderCharacterObservations(view);
    renderProjectionReview(view);
    await refreshCharacterDataStatus();
  } catch (error) {
    if (view === characterDataView) view.message.textContent = error.message;
  } finally {
    view.busy = false;
    if (view === characterDataView) view.fields.disabled = view.profileId === 'new';
  }
}
function renderCharacterObservations(view) {
  view.history.replaceChildren(el('summary', '', 'Saved observations (' + view.data.observations.length + ')'));
  if (!view.data.observations.length) view.history.appendChild(el('p', 'hint', 'No gear-swap observations recorded.'));
  for (const entry of view.data.observations) {
    const record = characterSection(view.history, entry.oldItem + ' → ' + entry.newItem + ' — ' + entry.reviewStatus);
    record.appendChild(el('p', 'hint', new Date(entry.observedAt).toLocaleString() + ' · ' + entry.slot));
    for (const key of characterDataModel.METRICS) {
      if (![entry.before, entry.after, entry.restored].some((stage) => stage[key] && stage[key].num != null)) continue;
      record.appendChild(el('p', '', characterMetricLabel(key) + ': ' +
        [entry.before, entry.after, entry.restored].map((stage) => stage[key] && stage[key].raw || 'Unknown').join(' → ')));
    }
    record.appendChild(el('p', '', entry.itemChanges));
    if (entry.reviewStatus === 'inconsistent') record.appendChild(el('p', 'hint', 'Restoring the original item did not restore the original readings. Do not use this as a clean calibration.'));
    characterButton(record, 'Remove observation', () => saveCharacterInput(view, 'removeObservation', entry.id));
  }
}
function renderCharacterData() {
  const mount = $('#character-data-panel');
  if (!mount || !editingProfile) return;
  const keepOpen = characterDataView?.profileId === editingId && !!mount.querySelector('.character-data-manager')?.open;
  const host = el('details', 'character-data-manager'); host.open = keepOpen;
  const managerSummary = el('summary', '', 'AA & character stats · Max-rank defaults');
  host.appendChild(managerSummary); mount.replaceChildren(host);
  const profile = profiles[editingId] || editingProfile;
  const saved = profile.characterData;
  host.appendChild(el('p', 'hint', 'AA defaults, optional character readings and calibration. Your gear and scores stay unchanged.'));
  const status = el('p', 'character-data-status'); status.setAttribute('role', 'status'); host.appendChild(status);
  const message = el('p', 'hint'); message.setAttribute('role', 'status'); host.appendChild(message);
  const tools = el('div', 'character-data-actions'); host.appendChild(tools);
  characterButton(tools, 'Discard input edits and reload saved inputs', renderCharacterData);
  characterButton(tools, 'Export saved inputs', () => {
    const data = profiles[editingId] && profiles[editingId].characterData;
    if (!data) { message.textContent = 'No saved character inputs to export.'; return; }
    const blob = new Blob([JSON.stringify({ profileId: editingId, characterData: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = el('a');
    link.href = url; link.download = 'loot-captain-character-data.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (saved && saved.version !== 1) {
    managerSummary.textContent = 'AA & character stats · unsupported data version';
    characterDataView = null; status.textContent = 'Unsupported character-data version. Export is available; this version cannot be edited.'; return;
  }
  const fields = el('fieldset', 'character-data-fields'); host.appendChild(fields);
  fields.disabled = editingId === 'new';
  if (fields.disabled) managerSummary.textContent = 'AA & character stats · save character first';
  const data = saved || { version: 1, revision: 0, snapshot: null, aaRanks: [], observations: [] };
  const view = { profileId: editingId, data, revision: data.revision, binding: characterDataModel.fingerprint(profile),
    status, managerSummary, message, fields, busy: false, aaRows: [] };
  characterDataView = view;
  host.oninput = (event) => { if (event.target.dataset.characterFilter) return; if (view === characterDataView) message.textContent = 'Unsaved input edits. Use the corresponding Save button below.'; };
  const run = (action, read) => {
    try { return saveCharacterInput(view, action, read()); } catch (error) { message.textContent = error.message; }
  };

  const aa = characterSection(fields, 'AA ranks (' + data.aaRanks.length + ')', true);
  view.aaSummary = aa.querySelector(':scope > summary');
  aa.appendChild(el('p', 'hint', 'New entries default to max rank (assumed). Search to edit exceptions; confirm maxed ranks if they match your character.'));
  const aaList = el('div', 'character-aa-results'); aa.appendChild(aaList);
  const filterStatus = el('p', 'hint aa-filter-status', 'Search an AA name to edit.'); filterStatus.setAttribute('role', 'status'); aa.insertBefore(filterStatus, aaList);
  let filterQuery = '';
  const filterRows = () => {
    const query = filterQuery.trim().toLowerCase();
    let matches = 0;
    for (const record of view.aaRows) {
      const match = !!query && record.inputs.name.value.toLowerCase().includes(query);
      record.row.hidden = !match || ++matches > 8;
    }
    aaList.hidden = !query || !matches;
    filterStatus.textContent = !query ? 'Search an AA name to edit.' : !matches ? 'No matching AA.' : matches > 8 ? 'Showing 8 of ' + matches + ' matches. Narrow the search.' : matches + ' matching AA' + (matches === 1 ? '' : 's') + '.';
  };
  const addAA = (entry = {}) => {
    const row = el('div', 'character-aa-record'), inputs = {}; row.hidden = true;
    const main = el('div', 'character-data-grid'); row.appendChild(main);
    inputs.name = characterInput(main, 'AA name', entry.name);
    inputs.rank = characterInput(main, 'Purchased rank', entry.rank && entry.rank.raw, 'number'); inputs.rank.step = '1';
    const detail = characterSection(row, 'Definition and source (optional)');
    for (const [key, label] of [['id', 'AA ID'], ['definitionVersion', 'Definition version / source'],
      ['classMask', 'Applicable classes'], ['requiredLevel', 'Required level'], ['expansion', 'Expansion'], ['description', 'Effect description']]) {
      inputs[key] = characterInput(detail, label, key === 'requiredLevel' ? entry[key] && entry[key].raw : entry[key], key === 'description' ? 'textarea' : 'text');
    }
    const record = { row, inputs, assumed: entry.assumed === true };  view.aaRows.push(record); aaList.appendChild(row);
    characterButton(row, 'Remove AA from draft', () => { view.aaRows = view.aaRows.filter((value) => value !== record); row.remove(); filterRows(); });
    inputs.rank.oninput = () => { record.assumed = false; };
    return record;
  };
  data.aaRanks.forEach(addAA);
  const catalogControls = el('div', 'character-data-grid');
  aa.insertBefore(catalogControls, aaList);
  const eraLabel = el('label', '', 'Active expansion');
  const era = el('select'); era.appendChild(el('option', '', 'Choose expansion')); era.options[0].value = '';
  era.dataset.characterFilter = 'true';
  eraLabel.appendChild(era); catalogControls.appendChild(eraLabel);
  const search = characterInput(catalogControls, 'Find an AA / adjust an exception', '', 'search');
  search.dataset.characterFilter = 'true';
  search.placeholder = 'Search AA name to adjust a rank';
  search.oninput = () => { filterQuery = search.value; filterRows(); };
  const catalogStatus = el('p', 'hint'); catalogStatus.setAttribute('role', 'status'); aa.insertBefore(catalogStatus, aaList);
  chrome.runtime.sendMessage({ type: 'GET_AA_CATALOG', profileId: view.profileId }).then((response) => {
    if (view !== characterDataView || !response || !response.ok) return;
    for (const name of response.expansions || []) { const option = el('option', '', name); option.value = name; era.appendChild(option); }
    era.value = data.snapshot && data.snapshot.expansion || '';
  }).catch(() => {});
  let catalogGeneration = 0;
  era.onchange = () => {
    catalogGeneration++;
    for (const record of view.aaRows) record.catalog = null;
    catalogStatus.textContent = 'Load the checklist for this expansion before applying maximums.';
  };
  characterButton(catalogControls, 'Load AA checklist', async () => {
    const generation = ++catalogGeneration;
    const selectedEra = era.value;
    if (!era.value) { catalogStatus.textContent = 'Choose your current expansion first.'; return; }
    catalogStatus.textContent = 'Loading RaidLoot definitions…';
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_AA_CATALOG', profileId: view.profileId, expansion: selectedEra });
      if (view !== characterDataView || generation !== catalogGeneration || era.value !== selectedEra) return;
      if (!result || !result.ok) throw new Error(result && result.error || 'Could not load AA definitions');
      for (const record of view.aaRows) {
        record.catalog = null;
        record.inputs.rank.oninput = () => { record.assumed = false; };
        record.inputs.rank.onchange = () => {
          record.assumed = false;
          for (const key of ['definitionVersion', 'description', 'classMask', 'requiredLevel', 'expansion']) record.inputs[key].value = '';
        };
        const note = record.row.querySelector('.aa-catalog-note');
        if (note) note.textContent = 'Not listed for this filter; existing rank preserved.';
      }
      for (const entry of result.entries) {
        let record = view.aaRows.find((row) => row.inputs.name.value.trim().toLowerCase() === entry.name.toLowerCase());
        const existed = !!record;
        if (!record) record = addAA({ name: entry.name, rank: { raw: String(entry.rank) }, assumed: true });
        record.catalog = entry;
        record.inputs.name.readOnly = true;
        const oldRank = record.inputs.rank, savedRank = oldRank.value;
        const rankSelect = el('select');
        for (const [value, label] of [['', 'Unknown'], ['0', '0 — not purchased'], ...entry.ranks.map((rank) => [String(rank.rank), 'Rank ' + rank.rank + ' · Lv ' + rank.requiredLevel])]) {
          const option = el('option', '', label); option.value = value; rankSelect.appendChild(option);
        }
        if (savedRank && !Array.from(rankSelect.options).some((option) => option.value === savedRank)) {
          const option = el('option', '', 'Saved rank ' + savedRank + ' (outside this catalog filter)'); option.value = savedRank; rankSelect.appendChild(option);
        }
        rankSelect.value = savedRank; oldRank.replaceWith(rankSelect); record.inputs.rank = rankSelect;
        record.inputs.rank.title = 'Catalog maximum for this selection: ' + entry.rank;
        const note = record.row.querySelector('.aa-catalog-note') || el('p', 'hint aa-catalog-note');
        record.updateNote = () => { note.textContent = (record.assumed ? 'Assumed rank · ' : '') + 'Max ' + entry.rank + ' · ' + entry.expansion; };
        record.updateNote();
        record.row.appendChild(note);
        record.setDefinition = () => {
          const definition = entry.ranks.find((rank) => record.inputs.rank.value !== '' && rank.rank === Number(record.inputs.rank.value));
          record.inputs.definitionVersion.value = definition ? result.sourceUrl + ' · ' + result.catalogVersion : '';
          record.inputs.description.value = definition ? definition.description : '';
          record.inputs.classMask.value = definition ? definition.classMask : '';
          record.inputs.requiredLevel.value = definition ? String(definition.requiredLevel) : '';
          record.inputs.expansion.value = definition ? definition.expansion : '';
        };
        record.inputs.rank.onchange = () => { record.assumed = false; record.setDefinition(); record.updateNote(); };
        if (!existed) record.setDefinition();
      }
      catalogStatus.textContent = result.entries.length + ' AAs loaded. New entries use assumed max ranks; saved exceptions are preserved.';
      filterRows();
    } catch (error) { if (view === characterDataView) catalogStatus.textContent = error.message; }
  });
  const bulkControls = el('div', 'character-aa-bulk'); aa.insertBefore(bulkControls, aaList);
  const setMaximums = () => {
    let count = 0;
    for (const record of view.aaRows) if (record.catalog) {
      record.inputs.rank.value = String(record.catalog.rank); record.assumed = true;
      record.setDefinition(); record.updateNote(); count++;
    }
    catalogStatus.textContent = count ? count + ' max defaults set (assumed).' + ' Save AA ranks to keep changes.' : 'Load a catalog first.';
  };
  characterButton(bulkControls, 'Reset to max defaults', setMaximums);
  characterButton(bulkControls, 'Confirm current ranks', () => {
    let count = 0;
    for (const record of view.aaRows) if (record.inputs.rank.value.trim()) {
      record.assumed = false; if (record.updateNote) record.updateNote(); count++;
    }
    catalogStatus.textContent = count + ' ranks confirmed without changing exceptions. Save AA ranks to keep them.';
  });
  characterButton(bulkControls, 'Save AA ranks', () => run('aa', () => readCharacterAAs(view)));
  const advancedAA = characterSection(aa, 'Unlisted AA (advanced)');
  characterButton(advancedAA, 'Add unlisted AA', () => {
    const record = addAA(); record.row.hidden = false; aaList.hidden = false;
    record.inputs.name.focus();
  });
  filterRows();

  const current = data.snapshot || {};
  const snapshot = characterSection(fields, 'Character snapshot');
  if (current.observedAt) snapshot.appendChild(el('p', 'hint', 'Previous capture: ' + new Date(current.observedAt).toLocaleString() + '. Recheck the values in game before saving a new capture.'));
  const context = el('div', 'character-data-grid'); snapshot.appendChild(context);
  const observedAt = characterInput(context, 'Observed at (local time)', localObservationTime(), 'datetime-local');
  const observer = characterInput(context, 'Observed by', current.observer);
  const expansion = characterInput(context, 'Current expansion', current.expansion);
  const patch = characterInput(context, 'Patch / build identifier', current.patch);
  const conventionLabel = el('label', '', 'Do displayed base values include heroics?');
  const convention = el('select');
  for (const [value, label] of [['unknown', 'Unknown'], ['yes', 'Yes'], ['no', 'No']]) {
    const option = el('option', '', label); option.value = value; convention.appendChild(option);
  }
  convention.value = current.includesHeroics || 'unknown'; conventionLabel.appendChild(convention); context.appendChild(conventionLabel);
  const values = {}, pools = el('div', 'character-data-grid'); snapshot.appendChild(pools);
  for (const key of ['HP', 'MANA', 'END', 'ATK', 'Accuracy']) values[key] = characterInput(pools, characterMetricLabel(key), current.readings && current.readings[key] && current.readings[key].raw, 'number');
  const table = el('table', 'character-readings-table'), header = el('tr');
  for (const label of ['Attribute', 'Sheet value', 'Sheet cap', 'Heroic']) { const cell = el('th', '', label); cell.setAttribute('scope', 'col'); header.appendChild(cell); }
  table.appendChild(header);
  for (const key of characterDataModel.ATTRIBUTES) {
    const row = el('tr'); row.appendChild(el('th', '', key));
    for (const field of [key, key + 'Cap', 'H' + key]) {
      const cell = el('td');
      values[field] = characterInput(cell, characterMetricLabel(field), current.readings && current.readings[field] && current.readings[field].raw, 'number');
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
  const scroll = el('div', 'character-table-scroll'); scroll.appendChild(table); snapshot.appendChild(scroll);
  const unbuffed = characterInput(snapshot, 'These readings are unbuffed', '', 'checkbox'); unbuffed.checked = false;
  const gearConfirmed = characterInput(snapshot, 'I checked these readings in game against this profile’s worn gear and augments', '', 'checkbox'); gearConfirmed.checked = false;
  const conditions = characterInput(snapshot, 'Conditions: tribute/trophies, power source, food/drink, stance and persistent effects', current.conditions, 'textarea');
  const modifiers = characterInput(snapshot, 'Modifier totals and next-point tooltips (optional)', current.modifiers, 'textarea');
  const references = characterInput(snapshot, 'Capture references / notes (optional; nothing is uploaded)', current.sourceReferences, 'textarea');
  characterButton(snapshot, 'Save snapshot', () => run('snapshot', () => ({ ...timeFields(observedAt), observer: observer.value,
    expansion: expansion.value, patch: patch.value, includesHeroics: convention.value,
    readings: Object.fromEntries(Object.entries(values).map(([key, input]) => [key, input.value])),
    unbuffed: unbuffed.checked, gearConfirmed: gearConfirmed.checked, conditions: conditions.value,
    modifiers: modifiers.value, sourceReferences: references.value })));

  const swap = characterSection(fields, 'Record an in-game gear swap');
  swap.appendChild(el('p', 'hint', 'Start from a saved current snapshot. Record A, change one item to B, then restore A. Use maximum pools. Local Equip/Undo buttons do not count as in-game observations.'));
  const swapContext = el('div', 'character-data-grid'); swap.appendChild(swapContext);
  const swapTime = characterInput(swapContext, 'Observed at (local time)', localObservationTime(), 'datetime-local');
  const swapObserver = characterInput(swapContext, 'Observed by', current.observer);
  const slot = characterInput(swapContext, 'Exact slot (e.g. left ear)', '');
  const oldItem = characterInput(swapContext, 'Original item name / ID', '');
  const newItem = characterInput(swapContext, 'Replacement item name / ID', '');
  const itemChanges = characterInput(swap, 'Full item stat changes, effects and augment changes', '', 'textarea');
  const swapTable = el('table', 'character-readings-table'), swapHeader = el('tr');
  for (const label of ['Reading', 'Before (A)', 'After (B)', 'Restored (A)', '']) swapHeader.appendChild(el('th', '', label));
  swapTable.appendChild(swapHeader);
  const metricRows = new Map();
  const addMetric = (key) => {
    if (metricRows.has(key)) return;
    const row = el('tr'), inputs = {}; row.appendChild(el('th', '', characterMetricLabel(key)));
    for (const stage of ['before', 'after', 'restored']) { const cell = el('td'); inputs[stage] = characterInput(cell, characterMetricLabel(key) + ' ' + stage, '', 'number'); row.appendChild(cell); }
    const remove = el('td'); characterButton(remove, 'Remove', () => { metricRows.delete(key); row.remove(); }); row.appendChild(remove);
    metricRows.set(key, inputs); swapTable.appendChild(row);
  };
  ['HP', 'STA', 'STACap', 'HSTA'].forEach(addMetric);
  const swapScroll = el('div', 'character-table-scroll'); swapScroll.appendChild(swapTable); swap.appendChild(swapScroll);
  const metricLabel = el('label', '', 'Additional reading'), metric = el('select');
  for (const key of characterDataModel.METRICS) { const option = el('option', '', characterMetricLabel(key)); option.value = key; metric.appendChild(option); }
  metricLabel.appendChild(metric); swap.appendChild(metricLabel);
  characterButton(swap, 'Add reading', () => addMetric(metric.value));
  const unchanged = characterInput(swap, 'I observed this swap in game and held the recorded conditions constant', '', 'checkbox');
  const swapReferences = characterInput(swap, 'Capture references / notes', '', 'textarea');
  characterButton(swap, 'Save observation', () => run('observation', () => ({ ...timeFields(swapTime), observer: swapObserver.value,
    slot: slot.value, oldItem: oldItem.value, newItem: newItem.value, itemChanges: itemChanges.value,
    conditionsUnchanged: unchanged.checked, sourceReferences: swapReferences.value,
    ...Object.fromEntries(['before', 'after', 'restored'].map((stage) => [stage,
      Object.fromEntries(Array.from(metricRows, ([key, inputs]) => [key, inputs[stage].value]))])),
  })));
  view.history = characterSection(fields, 'Saved observations');
  view.rules = characterSection(fields, 'Projection rule validation');
  renderCharacterObservations(view);
  renderProjectionReview(view);
  refreshCharacterDataStatus();
}

function renderProjectionReview(view) {
  if (!view.rules) return;
  view.rules.replaceChildren(el('summary', '', 'Projection rule validation'));
  const rule = window.LootCaptain.projection.RULE;
  view.rules.appendChild(el('p', 'hint', 'Reference HP, mana, endurance and displayed-ATK estimates need no calibration. This optional section validates the Heroic DEX → Accuracy rule for level-100 Beastlords (400–4000 Heroic DEX).'));
  const link = el('a', '', 'Developer source: ' + rule.sourceDate); link.href = rule.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; view.rules.appendChild(link);
  if (!view.data.observations.length) view.rules.appendChild(el('p', 'hint', 'Record a reversible swap with Heroic DEX and Accuracy before, after and restored, including capture references. It must cross an Accuracy breakpoint.'));
  for (const observation of view.data.observations) {
    const check = window.LootCaptain.projection.assess(observation);
    const row = el('div', 'character-aa-record');
    row.appendChild(el('strong', '', observation.oldItem + ' → ' + observation.newItem));
    row.appendChild(el('p', 'hint', check.reason));
    const approved = (view.data.ruleApprovals || []).some((entry) => entry.ruleKey === rule.key && entry.version === rule.version && entry.observationId === observation.id);
    if (approved) row.appendChild(el('p', '', 'Approved for this observation’s context and measured Heroic DEX interval. New conditions or out-of-range replacements remain unavailable.'));
    else if (check.ok) {
      const confirm = characterInput(row, 'I verified these are in-game readings and the recorded AA ranks and other conditions did not change', '', 'checkbox');
      characterButton(row, 'Approve Accuracy rule for this observation', () => saveCharacterInput(view, 'approveRule', {
        ruleKey: rule.key, version: rule.version, observationId: observation.id, confirmed: confirm.checked,
      }));
    }
    view.rules.appendChild(row);
  }
}
