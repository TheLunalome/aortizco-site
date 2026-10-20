(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const svgNS = 'http://www.w3.org/2000/svg';
  const viewport = $('#graph-viewport');
  const stage = $('#graph-stage');
  const nodesEl = $('#nodes');
  const edgesEl = $('#edges');
  const listEl = $('#node-list');
  const detailEl = $('#detail');
  const searchEl = $('#node-search');
  let data;
  let lens = 'logical';
  let selected = null;
  let query = '';
  let activeJourneyStep = null;
  const expanded = new Set();
  let scale = 1, offsetX = 0, offsetY = 0, drag = null;
  const kindNames = {
    hosting: 'Hosting',
    application: 'Application / API',
    vpn: 'VPN routing',
    network: 'Network route',
    filesystem: 'Filesystem access',
    import: 'Import behavior',
    identity: 'Identity / authentication',
    backup: 'Backup copy',
    physical: 'Physical path',
    historical: 'Historical',
    storage: 'Storage'
  };
  const consumerToDependency = new Set(['application', 'vpn']);

  function element(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function byId(id) { return data.entities.find(entity => entity.id === id); }
  function children(id) { return data.entities.filter(entity => entity.parent === id); }
  function ancestors(id) {
    let entity = byId(id);
    while (entity?.parent) { expanded.add(entity.parent); entity = byId(entity.parent); }
  }
  function visible(entity) {
    let parent = entity.parent;
    while (parent) { if (!expanded.has(parent)) return false; parent = byId(parent)?.parent; }
    return true;
  }
  function position(entity) {
    if (entity.layout) return entity.layout;
    if (entity.kind === 'host') return { x: 45, y: 60 };
    if (entity.kind === 'nas') return { x: 45, y: 575 };
    if (entity.parent && byId(entity.parent)?.kind !== 'host') {
      const siblings = children(entity.parent);
      return { x: 790, y: 52 + siblings.indexOf(entity) * 112 };
    }
    const parent = byId(entity.parent);
    if (parent?.kind === 'host') {
      const siblings = children(parent.id);
      return { x: 365, y: 28 + siblings.indexOf(entity) * 106 };
    }
    return { x: 780, y: 590 };
  }
  function activeRelationships() { return data.relationships.filter(rel => rel.lens === lens); }
  function relatedIds() {
    if (!selected) return new Set();
    const ids = new Set([selected]);
    const focusIds = new Set([selected]);
    const step = activeJourneyStep === null ? null : data.mediaRequestJourney?.[activeJourneyStep];
    for (const id of step?.entityIds || []) {
      ids.add(id);
      focusIds.add(id);
    }
    for (const rel of data.relationships) {
      if (focusIds.has(rel.from)) ids.add(rel.to);
      if (focusIds.has(rel.to)) ids.add(rel.from);
    }
    return ids;
  }
  function upstreamId(rel, id) {
    if (consumerToDependency.has(rel.kind)) return rel.from === id ? rel.to : null;
    return rel.to === id ? rel.from : null;
  }
  function downstreamId(rel, id) {
    if (consumerToDependency.has(rel.kind)) return rel.to === id ? rel.from : null;
    return rel.from === id ? rel.to : null;
  }
  function applyTransform() { stage.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`; }
  function fit() {
    if (!viewport.clientWidth) return;
    scale = Math.min(1, (viewport.clientWidth - 20) / 1140, (viewport.clientHeight - 20) / 920);
    offsetX = Math.max(0, (viewport.clientWidth - 1140 * scale) / 2);
    offsetY = Math.max(0, (viewport.clientHeight - 920 * scale) / 2);
    applyTransform();
  }
  function zoom(factor) {
    const next = Math.min(2.3, Math.max(.3, scale * factor));
    const centerX = viewport.clientWidth / 2, centerY = viewport.clientHeight / 2;
    offsetX = centerX - (centerX - offsetX) * next / scale;
    offsetY = centerY - (centerY - offsetY) * next / scale;
    scale = next;
    applyTransform();
  }
  function drawEdges() {
    edgesEl.replaceChildren();
    for (const rel of activeRelationships()) {
      const from = byId(rel.from), to = byId(rel.to);
      if (!from || !to || !visible(from) || !visible(to)) continue;
      const a = position(from), b = position(to);
      const x1 = a.x + 182, y1 = a.y + 31, x2 = b.x, y2 = b.y + 31;
      const path = document.createElementNS(svgNS, 'path');
      const curve = Math.max(40, (x2 - x1) / 2);
      path.setAttribute('d', x2 >= x1 ? `M${x1} ${y1} C${x1 + curve} ${y1},${x2 - curve} ${y2},${x2} ${y2}` : `M${x1} ${y1} C${x1 + 95} ${y1},${x2 - 95} ${y2},${x2} ${y2}`);
      path.classList.add(rel.verification === 'unknown' ? 'unknown' : rel.stateClass, `kind-${rel.kind || rel.lens}`);
      const focused = selected && (rel.from === selected || rel.to === selected ||
        (activeJourneyStep !== null && data.mediaRequestJourney?.[activeJourneyStep]?.entityIds.some(id => rel.from === id || rel.to === id)));
      if (selected) path.classList.add(focused ? 'focus' : 'dim');
      edgesEl.append(path);
      const label = document.createElementNS(svgNS, 'text');
      label.classList.add('edge-label');
      if (selected) label.classList.add(focused ? 'focus' : 'dim');
      label.setAttribute('x', String((x1 + x2) / 2));
      label.setAttribute('y', String((y1 + y2) / 2 - 7));
      label.textContent = (kindNames[rel.kind] || kindNames[rel.lens] || rel.lens).toUpperCase();
      edgesEl.append(label);
    }
  }
  function drawNodes() {
    nodesEl.replaceChildren();
    const related = relatedIds();
    for (const entity of data.entities.filter(visible)) {
      const { x, y } = position(entity);
      const button = element('button', `node ${entity.kind}${data.mode === 'private' && entity.lifecycle === 'stopped' ? ' stopped' : ''}`);
      button.type = 'button';
      button.style.left = `${x}px`; button.style.top = `${y}px`;
      if (children(entity.id).length) button.setAttribute('aria-expanded', String(expanded.has(entity.id)));
      button.append(element('span', 'node-name', entity.name), element('span', 'node-role', entity.role));
      if (children(entity.id).length) button.append(element('span', 'expand', expanded.has(entity.id) ? '−' : '+'));
      if (selected === entity.id) button.classList.add('selected');
      else if (selected && !related.has(entity.id)) button.classList.add('dim');
      const step = activeJourneyStep === null ? null : data.mediaRequestJourney?.[activeJourneyStep];
      if (step?.entityIds.includes(entity.id)) button.classList.add('journey');
      if (query && `${entity.name} ${entity.role}`.toLowerCase().includes(query)) button.classList.add('match');
      button.addEventListener('click', () => select(entity.id, true));
      nodesEl.append(button);
    }
  }
  function renderList() {
    const table = element('table', 'node-table');
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    for (const label of data.mode === 'private' ? ['System', 'Role', 'Evidence'] : ['System', 'Role']) header.append(element('th', '', label));
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const entity of data.entities.filter(entity => !query || `${entity.name} ${entity.role}`.toLowerCase().includes(query))) {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const button = element('button', '', entity.name);
      button.type = 'button'; button.addEventListener('click', () => select(entity.id, false));
      name.append(button); row.append(name, element('td', '', entity.role));
      if (data.mode === 'private') row.append(element('td', '', entity.verification));
      body.append(row);
    }
    table.append(body); listEl.replaceChildren(table);
  }
  function renderDetail() {
    detailEl.replaceChildren();
    const entity = byId(selected);
    if (!entity) { detailEl.append(element('p', 'eyebrow', 'Node details'), element('h2', '', 'Select a system'), element('p', '', 'Choose a node in the diagram or list to inspect its role, relationships, and documentation.')); return; }
    const eyebrow = data.mode === 'private' ? `${entity.kind} · ${entity.verification}` : `${entity.kind} · generic role`;
    detailEl.append(element('p', 'eyebrow', eyebrow), element('h2', '', entity.name), element('p', '', entity.overview));
    const dl = document.createElement('dl');
    const entries = [['Role', entity.role]];
    if (data.mode === 'private') entries.push(['State', entity.lifecycle], ['Last verification', entity.observedAt], ['Dependencies', entity.dependencies], ['Configuration source', entity.configuration], ...(entity.monitoring ? [['Monitoring evidence', entity.monitoring]] : []), ['Backup and exclusions', entity.backup], ['Recovery', entity.recovery], ['Decision', entity.decisions], ['Provenance', entity.provenance]);
    for (const [label, value] of entries) { dl.append(element('dt', '', label), element('dd', '', value)); }
    detailEl.append(dl);
    const relations = data.relationships.filter(rel => rel.from === entity.id || rel.to === entity.id);
    if (relations.length) {
      for (const [title, resolveId] of [
        ['Upstream dependencies', rel => upstreamId(rel, entity.id)],
        ['Downstream dependents', rel => downstreamId(rel, entity.id)]
      ]) {
        const directed = relations.map(rel => ({ rel, otherId: resolveId(rel) })).filter(item => item.otherId);
        if (!directed.length) continue;
        detailEl.append(element('h3', '', title));
        const ul = element('ul', 'dependency-list');
        for (const { rel, otherId } of directed) {
          const li = document.createElement('li');
          const button = element('button', '', `${kindNames[rel.kind] || rel.lens} · ${rel.label} · ${byId(otherId)?.name} · ${rel.verification}`);
          button.type = 'button';
          button.addEventListener('click', () => select(otherId, false));
          li.append(button);
          if (data.mode === 'private' && rel.note) li.append(element('p', '', `${rel.observedAt}: ${rel.note}`));
          ul.append(li);
        }
        detailEl.append(ul);
      }
      if (data.mode === 'private' && relations.some(rel => rel.kind === 'identity')) {
        detailEl.append(element('p', '', 'Identity and application/API links are separate relationship types; do not infer one from the other.'));
      }
    }
    if (data.mode === 'private') {
      const link = element('a', '', 'Open Doculome record ↗');
      link.href = `${data.documentationPage}#${encodeURIComponent(entity.id)}`;
      detailEl.append(link);
    }
  }
  function lensNote() {
    const notes = {
      physical: 'Physical cabling, switch ports, and WAN wiring have not been verified. A dotted private line marks uncertainty; absence of a public line is intentional.',
      logical: 'Hosting, application/API dependencies, and VPN routing are distinct labels. A hosting link does not imply every application network path.',
      storage: 'Filesystem paths, disk attachment, and import behavior are distinct. A declared path does not prove its live bind mount or hardlink behavior.',
      backup: 'The NAS copy is documented; VM restore-read evidence and the data disk’s separate backup coverage need review. Proposed protection is not an active job.'
    };
    $('#lens-note').textContent = notes[lens];
  }
  function render() { drawEdges(); drawNodes(); renderList(); renderDetail(); lensNote(); }
  function select(id, toggle) {
    if (!byId(id)) return;
    ancestors(id);
    if (toggle && children(id).length) expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    selected = id; render();
  }
  function setJourneyStep(index) {
    const step = data.mediaRequestJourney?.[index];
    if (!step) return;
    activeJourneyStep = index;
    document.querySelectorAll('[data-journey-step]').forEach(button => {
      if (Number(button.dataset.journeyStep) === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const status = $('#journey-status');
    if (status) status.textContent = `${step.title}. ${step.description}`;
    const firstEntity = step.entityIds.find(id => byId(id));
    if (firstEntity) {
      ancestors(firstEntity);
      selected = firstEntity;
    }
    render();
  }
  function bind() {
    document.querySelectorAll('[data-lens]').forEach(button => button.addEventListener('click', () => {
      lens = button.dataset.lens;
      document.querySelectorAll('[data-lens]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      if (lens === 'storage') { expanded.add(data.entities.find(e => e.kind === 'host')?.id); const disk = data.entities.find(e => e.kind === 'storage'); if (disk?.parent) expanded.add(disk.parent); }
      render();
    }));
    searchEl.addEventListener('input', () => {
      query = searchEl.value.trim().toLowerCase();
      if (query) { const hit = data.entities.find(e => `${e.name} ${e.role}`.toLowerCase().includes(query)); if (hit) ancestors(hit.id); }
      render();
    });
    $('#zoom-in').addEventListener('click', () => zoom(1.2));
    $('#zoom-out').addEventListener('click', () => zoom(1 / 1.2));
    $('#fit').addEventListener('click', fit);
    document.querySelectorAll('[data-journey-step]').forEach(button => button.addEventListener('click', () => setJourneyStep(Number(button.dataset.journeyStep))));
    viewport.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      drag = { x: event.clientX, y: event.clientY, left: offsetX, top: offsetY };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
      if (!drag) return;
      offsetX = drag.left + event.clientX - drag.x;
      offsetY = drag.top + event.clientY - drag.y;
      applyTransform();
    });
    viewport.addEventListener('pointerup', () => { drag = null; });
    viewport.addEventListener('pointercancel', () => { drag = null; });
    window.addEventListener('resize', fit);
  }
  fetch('explorer-data.json', { cache: 'no-store' }).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then(json => {
    data = json;
    const root = data.entities.find(e => e.kind === 'host');
    if (root) expanded.add(root.id);
    $('#snapshot').textContent = data.mode === 'public'
      ? `Public role map · ${data.entities.length} generic roles · ${data.relationships.length} classified connections · no live system status`
      : `Inventory observed ${data.observedAt} · ${data.entities.length} roles · ${data.relationships.length} classified connections · not live monitoring`;
    bind();
    const requested = new URLSearchParams(location.search).get('node');
    if (requested && byId(requested)) select(requested, false);
    else if (data.mode === 'private' && data.mediaRequestJourney?.length) setJourneyStep(0);
    else render();
    requestAnimationFrame(fit);
  }).catch(error => { $('#snapshot').textContent = `Inventory unavailable: ${error.message}`; });
})();
