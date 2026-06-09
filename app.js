/* ==========================================================================
   ARMADIO — APPLICATION LOGIC
   ========================================================================== */

const SECTION_NAMES = {
    'sec1-top-rail':      'Appendiabiti Superiore',
    'sec1-bottom-rail':   'Appendiabiti Inferiore',
    'sec2-top-shelf':     'Ripiano',
    'sec2-middle-rail':   'Appendiabiti Centrale',
    'sec2-drawer1':       'Cassetto 1',
    'sec2-drawer2':       'Cassetto 2',
    'sec2-drawer3':       'Cassetto 3',
    'sec2-drawer2-col1':  'Cassetto 2 — Col. A',
    'sec2-drawer2-col2':  'Cassetto 2 — Col. B',
    'sec2-drawer3-col1':  'Cassetto 3 — Col. A',
    'sec2-drawer3-col2':  'Cassetto 3 — Col. B',
    'sec2-drawer3-col3':  'Cassetto 3 — Col. C',
};

// STATE
let currentHouse  = 'Milano';
let selectedSection = null;
let clothes = [];
let editingItemId = null;

// ─── MIGRATIONS ─────────────────────────────────────────────────────────────
function runMigrations() {
    let migrated = false;
    clothes.forEach(item => {
        if (!item.section) return;
        const map = {
            'col1-shelf': 'sec2-top-shelf',
            'col2-top-rail': 'sec1-top-rail',
            'col2-bottom-rail': 'sec1-bottom-rail',
            'col3-rail': 'sec2-middle-rail',
            'sec2-drawer1': 'sec2-drawer2-col1',
            'sec2-drawer2': 'sec2-drawer2-col1',
            'sec2-drawer3': 'sec2-drawer3-col1',
        };
        if (item.section.startsWith('col4-shelf')) { item.section = 'sec2-top-shelf'; migrated = true; return; }
        if (item.section.startsWith('col1-drawer')) { item.section = 'sec2-drawer3-col1'; migrated = true; return; }
        if (map[item.section]) { item.section = map[item.section]; migrated = true; }
    });
    return migrated;
}

// ─── DATA PERSISTENCE ────────────────────────────────────────────────────────
async function loadData() {
    let loaded = false;
    try {
        const res = await fetch('/api/load');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) { clothes = data; loaded = true; }
        }
    } catch (e) { console.warn('Server non raggiungibile, uso localStorage.', e); }

    if (!loaded) {
        const stored = localStorage.getItem('armadio_clothes');
        if (stored) { try { clothes = JSON.parse(stored); } catch { clothes = []; } }
        else { clothes = getSeedData(); await saveData(); }
    }

    if (runMigrations()) await saveData();
}

async function saveData() {
    localStorage.setItem('armadio_clothes', JSON.stringify(clothes));
    updateStats();
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clothes)
        });
    } catch (e) { console.error('Errore salvataggio remoto', e); }
}

function getSeedData() {
    return [
        { id: 'm1', house: 'Milano',   section: 'sec1-top-rail',    name: 'Piumino',                type: 'jacket',  color: '#22c55e', brand: 'Save the Duck', notes: '' },
        { id: 'm2', house: 'Milano',   section: 'sec1-bottom-rail',  name: 'Giacca Vintage Beige',   type: 'jacket',  color: '#f5f5dc', brand: 'Baracuta',      notes: 'Primaverile' },
        { id: 'm3', house: 'Milano',   section: 'sec2-middle-rail',  name: 'Cappotto di Lana Nero',  type: 'jacket',  color: '#333333', brand: 'Zara',          notes: 'Invernale' },
        { id: 'm4', house: 'Milano',   section: 'sec2-middle-rail',  name: 'Camicia di Jeans',       type: 'shirt',   color: '#3b82f6', brand: "Levi's",        notes: '' },
        { id: 'm5', house: 'Milano',   section: 'sec2-top-shelf',    name: 'Maglione Cashmere',      type: 'sweater', color: '#8c8c8c', brand: 'Falconeri',     notes: 'Lavare a mano' },
        { id: 'm6', house: 'Milano',   section: 'sec2-drawer2-col1', name: 'T-shirt Bianca x3',     type: 'tshirt',  color: '#ffffff', brand: 'Uniqlo',        notes: '' },
        { id: 'r1', house: 'Reggio',   section: 'sec1-top-rail',     name: 'Camicia di Lino Bianca', type: 'shirt',   color: '#ffffff', brand: 'Boggi',         notes: '' },
        { id: 'r2', house: 'Reggio',   section: 'sec2-middle-rail',  name: 'Bomber Verde Militare',  type: 'jacket',  color: '#22c55e', brand: 'Alpha Industries', notes: '' },
        { id: 'r3', house: 'Reggio',   section: 'sec1-bottom-rail',  name: 'Felpa Grigia',           type: 'hoodie',  color: '#8c8c8c', brand: 'Nike',          notes: '' },
        { id: 's1', house: 'Sardegna', section: 'sec1-top-rail',     name: 'T-shirt Gialla',         type: 'tshirt',  color: '#eab308', brand: 'Patagonia',     notes: '' },
        { id: 's2', house: 'Sardegna', section: 'sec1-bottom-rail',  name: 'Costume Rosso',          type: 'shorts',  color: '#ef4444', brand: 'Sundek',        notes: '' },
    ];
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
    const hc = clothes.filter(c => c.house === currentHouse);
    document.getElementById('stat-total-items').textContent   = hc.length;
    document.getElementById('stat-hanging-items').textContent = hc.filter(c => c.section.includes('rail')).length;
    document.getElementById('stat-shelf-items').textContent   = hc.filter(c => c.section.includes('shelf')).length;
    document.getElementById('stat-drawer-items').textContent  = hc.filter(c => c.section.includes('drawer')).length;
    document.getElementById('db-size-indicator').textContent  = `${clothes.length} CAPI`;
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function initNavigation() {
    const statusLabel = document.getElementById('current-house-status');
    document.querySelectorAll('.house-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.house-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHouse = btn.dataset.house;
            statusLabel.textContent = currentHouse.toUpperCase();
            resetInspector();
            updateStats();
            renderClothesInWardrobe();
        });
    });
}

// ─── DOORS ────────────────────────────────────────────────────────────────────
function initDoors() {
    const dl1 = document.getElementById('door-l1');
    const dl2 = document.getElementById('door-l2');
    const dr1 = document.getElementById('door-r1');
    const dr2 = document.getElementById('door-r2');
    const toggleBtn = document.getElementById('btn-toggle-doors');

    const togglePair = (d1, d2, prefix) => {
        const open = d1.classList.contains('open');
        if (open) {
            d1.classList.remove('open'); d2.classList.remove('open');
            if (selectedSection && selectedSection.startsWith(prefix)) resetInspector();
        } else {
            d1.classList.add('open'); d2.classList.add('open');
        }
        updateToggleBtn();
    };

    dl1.addEventListener('click', e => { e.stopPropagation(); togglePair(dl1, dl2, 'sec1'); });
    dl2.addEventListener('click', e => { e.stopPropagation(); togglePair(dl1, dl2, 'sec1'); });
    dr1.addEventListener('click', e => { e.stopPropagation(); togglePair(dr1, dr2, 'sec2'); });
    dr2.addEventListener('click', e => { e.stopPropagation(); togglePair(dr1, dr2, 'sec2'); });

    toggleBtn.addEventListener('click', () => {
        const doors = [dl1, dl2, dr1, dr2];
        const anyOpen = doors.some(d => d.classList.contains('open'));
        if (!anyOpen) {
            doors.forEach(d => d.classList.add('open'));
        } else {
            doors.forEach(d => d.classList.remove('open'));
            resetInspector();
        }
        updateToggleBtn();
    });
}

function updateToggleBtn() {
    const btn = document.getElementById('btn-toggle-doors');
    if (!btn) return;
    const allOpen = Array.from(document.querySelectorAll('.wardrobe-door')).every(d => d.classList.contains('open'));
    btn.textContent = allOpen ? 'CHIUDI TUTTO' : 'APRI TUTTO';
}

function ensureDoorsOpen(sectionId) {
    if (sectionId.startsWith('sec1')) {
        document.getElementById('door-l1')?.classList.add('open');
        document.getElementById('door-l2')?.classList.add('open');
    } else {
        document.getElementById('door-r1')?.classList.add('open');
        document.getElementById('door-r2')?.classList.add('open');
    }
    updateToggleBtn();
}

// ─── RENDER WARDROBE ──────────────────────────────────────────────────────────
function renderClothesInWardrobe() {
    document.querySelectorAll('.clothes-container').forEach(c => c.innerHTML = '');
    document.querySelectorAll('.drawer-node').forEach(d => d.classList.remove('pulled-out'));

    const hc = clothes.filter(c => c.house === currentHouse);

    // Rails
    ['sec1-top-rail', 'sec1-bottom-rail', 'sec2-middle-rail'].forEach(sid => {
        const container = document.getElementById(`container-${sid}`);
        if (!container) return;
        const items = hc.filter(c => c.section === sid);
        for (let i = 0; i < items.length; i += 15) {
            const row = document.createElement('div');
            row.className = 'rail-row';
            items.slice(i, i + 15).forEach(item => {
                const div = document.createElement('div');
                div.className = 'visual-hanger';
                div.innerHTML = `${getHangerSvg(item.type, item.color)}
                    <div class="cloth-tooltip"><strong>${item.name}</strong>${item.brand ? '<br>' + item.brand : ''}</div>`;
                div.addEventListener('click', e => { e.stopPropagation(); selectSection(item.section); });
                row.appendChild(div);
            });
            container.appendChild(row);
        }
    });

    // Shelf
    document.querySelectorAll('.shelf-node').forEach(node => {
        const sid = node.dataset.section;
        const container = document.getElementById(`container-${sid}`);
        if (container) container.innerHTML = getFoldedStackSvg(hc.filter(c => c.section === sid));
    });

    // Drawers
    renderDrawerColumns();

    // Re-apply selection
    if (selectedSection?.includes('drawer')) {
        const parts = selectedSection.split('-');
        const drawerId = `sec-${parts[0]}-${parts[1]}`;
        document.getElementById(drawerId)?.classList.add('pulled-out');
        document.getElementById(`sec-${selectedSection}`)?.classList.add('selected');
    }
}

// ─── SECTION SELECTION ────────────────────────────────────────────────────────
function selectSection(sectionId) {
    cancelEditClothing();
    selectedSection = sectionId;
    ensureDoorsOpen(sectionId);

    document.querySelectorAll('.compartment-node').forEach(n => n.classList.remove('selected'));
    document.getElementById(`sec-${sectionId}`)?.classList.add('selected');

    document.getElementById('inspector-default').classList.remove('active');
    document.getElementById('inspector-active').classList.add('active');
    document.getElementById('inspect-house-name').textContent  = currentHouse.toUpperCase();
    document.getElementById('inspect-section-name').textContent = SECTION_NAMES[sectionId] || sectionId;

    renderSectionInventory();
}

function resetInspector() {
    cancelEditClothing();
    selectedSection = null;
    document.querySelectorAll('.compartment-node').forEach(n => n.classList.remove('selected'));
    document.querySelectorAll('.drawer-node').forEach(d => d.classList.remove('pulled-out'));
    document.getElementById('inspector-active').classList.remove('active');
    document.getElementById('inspector-default').classList.add('active');
    renderClothesInWardrobe();
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
function renderSectionInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;
    list.innerHTML = '';

    const items = clothes.filter(c => c.house === currentHouse && c.section === selectedSection);
    document.getElementById('inventory-count').textContent = items.length;

    if (!items.length) {
        list.innerHTML = '<div class="empty-inventory-msg">Nessun capo. Aggiungine uno qui sotto.</div>';
        return;
    }

    items.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = 'clothing-item-card';
        card.innerHTML = `
            <div class="clothing-item-info">
                <span class="clothing-color-badge" style="background:${item.color}"></span>
                <div class="clothing-text-details">
                    <span class="cloth-title">${item.name}</span>
                    <span class="cloth-meta-label">${item.brand ? item.brand.toUpperCase() : 'GENERICO'}${item.notes ? ' · ' + item.notes : ''}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-move-up"    title="Su"       data-id="${item.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-move-down"  title="Giù"      data-id="${item.id}" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
                <button class="btn-edit-cloth"  title="Modifica" data-id="${item.id}">✏️</button>
                <button class="btn-delete-cloth" title="Elimina" data-id="${item.id}">×</button>
            </div>`;

        if (i > 0) card.querySelector('.btn-move-up').addEventListener('click', e => { e.stopPropagation(); moveClothing(item.id, 'up'); });
        if (i < items.length - 1) card.querySelector('.btn-move-down').addEventListener('click', e => { e.stopPropagation(); moveClothing(item.id, 'down'); });
        card.querySelector('.btn-edit-cloth').addEventListener('click', e => { e.stopPropagation(); startEditClothing(item.id); });
        card.querySelector('.btn-delete-cloth').addEventListener('click', e => { e.stopPropagation(); deleteClothing(item.id); });

        list.appendChild(card);
    });
}

async function deleteClothing(id) {
    if (!confirm('Rimuovere questo capo dall\'archivio?')) return;
    clothes = clothes.filter(c => c.id !== id);
    await saveData();
    renderSectionInventory();
    renderClothesInWardrobe();
}

async function moveClothing(id, dir) {
    const idx = clothes.findIndex(c => c.id === id);
    if (idx < 0) return;
    const { house, section } = clothes[idx];
    const siblings = clothes.map((c, i) => ({ c, i })).filter(({ c }) => c.house === house && c.section === section);
    const pos = siblings.findIndex(s => s.i === idx);
    if (dir === 'up' && pos > 0) {
        const prev = siblings[pos - 1].i;
        [clothes[idx], clothes[prev]] = [clothes[prev], clothes[idx]];
    } else if (dir === 'down' && pos < siblings.length - 1) {
        const next = siblings[pos + 1].i;
        [clothes[idx], clothes[next]] = [clothes[next], clothes[idx]];
    } else return;
    await saveData();
    renderSectionInventory();
    renderClothesInWardrobe();
}

// ─── DRAWERS ENGINE ───────────────────────────────────────────────────────────
function initDrawers() {
    document.querySelectorAll('.drawer-node').forEach(drawer => {
        drawer.addEventListener('click', e => {
            if (drawer.classList.contains('pulled-out')) return;
            e.stopPropagation();
            document.querySelectorAll('.drawer-node').forEach(d => d.classList.remove('pulled-out'));
            drawer.classList.add('pulled-out');
            document.getElementById('door-r1')?.classList.add('open');
            document.getElementById('door-r2')?.classList.add('open');
            updateToggleBtn();
            const firstCol = drawer.querySelector('.drawer-col-container');
            if (firstCol) selectSection(firstCol.dataset.section);
            else resetInspector();
        });
    });

    document.querySelectorAll('.drawer-col-container').forEach(col => {
        col.addEventListener('click', e => { e.stopPropagation(); selectSection(col.dataset.section); });
    });
}

function renderDrawerColumns() {
    const sections = ['sec2-drawer2-col1','sec2-drawer2-col2','sec2-drawer3-col1','sec2-drawer3-col2','sec2-drawer3-col3'];
    sections.forEach(sid => {
        const el = document.getElementById(`sec-${sid}`);
        if (!el) return;
        el.classList.remove('selected');
        el.innerHTML = '';
        const items = clothes.filter(c => c.house === currentHouse && c.section === sid);
        if (!items.length) {
            el.innerHTML = '<div class="empty-drawer-stack"><span>+</span></div>';
        } else {
            el.innerHTML = getFoldedStackSvg(items);
        }
    });
}

// ─── FORM ────────────────────────────────────────────────────────────────────
function initForm() {
    const form = document.getElementById('add-clothing-form');
    if (!form) return;

    const customInput = document.getElementById('cloth-color-custom');
    const customRadio = document.getElementById('radio-custom-color');

    const syncCustomSwatch = () => {
        const label = customInput.closest('.swatch');
        if (label) { label.style.backgroundImage = 'none'; label.style.backgroundColor = customInput.value; }
    };
    customInput.addEventListener('input', () => { customRadio.value = customInput.value; customRadio.checked = true; syncCustomSwatch(); });
    customInput.addEventListener('click', () => { customRadio.value = customInput.value; customRadio.checked = true; syncCustomSwatch(); });

    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEditClothing);

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!selectedSection) { alert('Seleziona prima una sezione dell\'armadio.'); return; }

        const name  = document.getElementById('cloth-name').value.trim();
        const type  = document.getElementById('cloth-type').value;
        const brand = document.getElementById('cloth-brand').value.trim();
        const notes = document.getElementById('cloth-notes').value.trim();

        let color = '#ffffff';
        const colorRadio = form.querySelector('input[name="cloth-color"]:checked');
        if (colorRadio) color = colorRadio.value === 'custom' ? customInput.value : colorRadio.value;

        if (editingItemId) {
            const idx = clothes.findIndex(c => c.id === editingItemId);
            if (idx >= 0) Object.assign(clothes[idx], { name, type, color, brand, notes });
            editingItemId = null;
            document.getElementById('form-title').textContent = 'AGGIUNGI';
            document.getElementById('btn-submit-cloth').textContent = 'REGISTRA';
            document.getElementById('btn-cancel-edit').style.display = 'none';
        } else {
            clothes.push({ id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000), house: currentHouse, section: selectedSection, name, type, color, brand, notes });
        }

        await saveData();
        resetFormFields(form, customInput);
        renderSectionInventory();
        renderClothesInWardrobe();
    });
}

function resetFormFields(form, customInput) {
    document.getElementById('cloth-name').value = '';
    document.getElementById('cloth-brand').value = '';
    document.getElementById('cloth-notes').value = '';
    const first = form.querySelector('input[name="cloth-color"]');
    if (first) first.checked = true;
    if (customInput) {
        customInput.value = '#000000';
        const label = customInput.closest('.swatch');
        if (label) { label.style.backgroundColor = ''; label.style.backgroundImage = 'linear-gradient(135deg,#ef4444,#3b82f6,#22c55e)'; }
    }
}

function startEditClothing(id) {
    const item = clothes.find(c => c.id === id);
    if (!item) return;
    editingItemId = id;

    document.getElementById('cloth-name').value  = item.name;
    document.getElementById('cloth-type').value  = item.type;
    document.getElementById('cloth-brand').value = item.brand || '';
    document.getElementById('cloth-notes').value = item.notes || '';

    const customInput = document.getElementById('cloth-color-custom');
    const customRadio = document.getElementById('radio-custom-color');
    let matched = false;
    document.querySelectorAll('input[name="cloth-color"]').forEach(r => { r.checked = false; });
    document.querySelectorAll('input[name="cloth-color"]').forEach(r => {
        if (r.value.toLowerCase() === item.color.toLowerCase() && r.id !== 'radio-custom-color') { r.checked = true; matched = true; }
    });
    if (!matched && customInput) {
        customInput.value = item.color;
        customRadio.value = item.color;
        customRadio.checked = true;
        const label = customInput.closest('.swatch');
        if (label) { label.style.backgroundImage = 'none'; label.style.backgroundColor = item.color; }
    }

    document.getElementById('form-title').textContent = 'MODIFICA';
    document.getElementById('btn-submit-cloth').textContent = 'SALVA';
    document.getElementById('btn-cancel-edit').style.display = 'block';
    document.getElementById('add-clothing-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditClothing() {
    editingItemId = null;
    const form = document.getElementById('add-clothing-form');
    const customInput = document.getElementById('cloth-color-custom');
    if (form) resetFormFields(form, customInput);
    document.getElementById('form-title').textContent = 'AGGIUNGI';
    document.getElementById('btn-submit-cloth').textContent = 'REGISTRA';
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

// ─── COMPARTMENT CLICKS ────────────────────────────────────────────────────────
function initCompartmentClicks() {
    document.querySelectorAll('.compartment-node').forEach(node => {
        node.addEventListener('click', e => { e.stopPropagation(); selectSection(node.dataset.section); });
    });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initNavigation();
    initDoors();
    initCompartmentClicks();
    initForm();
    initDrawers();
    updateStats();
    renderClothesInWardrobe();
    document.getElementById('btn-back-to-default').addEventListener('click', resetInspector);
});

/* ==========================================================================
   SVG GENERATORS — CLOTHING SILHOUETTES
   All use viewBox="0 -25 180 460", displayed at width="32" height="90"
   Inspired by the hanging jacket silhouette style.
   ========================================================================== */

const INK = '#1A1816';

function svgWrap(content) {
    return `<svg viewBox="0 -25 180 460" width="32" height="90" style="display:block;overflow:visible;">
        ${content}
    </svg>`;
}

const HOOK = `<path d="M92,5 C92,-5 81,-16 92,-21 C103,-16 99,-5 92,5" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;

function getHangerSvg(type, color) {
    switch (type) {
        case 'shirt':   return getShirtSvg(color);
        case 'hoodie':  return getHoodieSvg(color);
        case 'sweater': return getSweaterSvg(color);
        case 'pants':   return getPantsSvg(color);
        case 'shorts':  return getShortsSvg(color);
        case 'tshirt':  return getTshirtSvg(color);
        case 'jacket':
        default:        return getJacketSvg(color);
    }
}

// GIACCA — coat with lapels and front panel
function getJacketSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <path d="M92,5 L66,34 L54,124 L44,430 L136,430 L136,220 L130,76 L112,29 Z"/>
            <path d="M66,34 L92,24 L112,29" fill="none"/>
            <path d="M72,40 L92,30 L92,80 L120,93 L120,408 L57,408 L57,145 L72,40 Z" fill="${color}"/>
            <path d="M68,327 L102,322 L112,330 L68,333 Z" fill="${color}"/>
            <line x1="68" y1="333" x2="68" y2="352" stroke-width="1.8"/>
            <line x1="68" y1="352" x2="112" y2="359" stroke-width="1.8"/>
        </g>
    `);
}

// CAMICIA — shirt with collar points and button placket
function getShirtSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <path d="M92,8 L60,31 L48,110 L46,430 L134,430 L132,110 L120,31 Z"/>
            <path d="M92,8 L60,31 L76,54 L91,39 Z"/>
            <path d="M92,8 L120,31 L104,54 L91,39 Z"/>
            <path d="M76,54 L91,39 L104,54" fill="none"/>
            <line x1="91" y1="54" x2="91" y2="430" stroke-width="1.2"/>
            <circle cx="91" cy="100" r="4" fill="${INK}" stroke="none"/>
            <circle cx="91" cy="185" r="4" fill="${INK}" stroke="none"/>
            <circle cx="91" cy="270" r="4" fill="${INK}" stroke="none"/>
        </g>
    `);
}

// FELPA — hoodie with visible hood arch and kangaroo pocket
function getHoodieSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <path d="M52,38 Q92,-8 132,38 Q130,22 92,22 Q54,22 52,38 Z"/>
            <path d="M52,38 L42,430 L142,430 L132,38 Z"/>
            <ellipse cx="92" cy="38" rx="22" ry="14" fill="${color}" stroke-width="2"/>
            <path d="M65,292 L65,366 L119,366 L119,292" fill="none" stroke-width="1.8"/>
            <line x1="65" y1="292" x2="119" y2="292" stroke-width="1.8"/>
        </g>
    `);
}

// MAGLIONE — sweater with round crew neck and ribbed hem
function getSweaterSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <path d="M92,12 L60,32 L50,115 L47,385 L133,385 L130,115 L122,32 Z"/>
            <ellipse cx="92" cy="28" rx="22" ry="15" fill="${color}" stroke-width="2.2"/>
            <line x1="47" y1="390" x2="133" y2="390" stroke-width="1.8"/>
            <line x1="47" y1="400" x2="133" y2="400" stroke-width="1.8"/>
            <line x1="47" y1="410" x2="133" y2="410" stroke-width="1.8"/>
            <line x1="47" y1="428" x2="133" y2="428" stroke-width="2.2"/>
        </g>
    `);
}

// T-SHIRT / POLO — short body, round neck, short sleeves visible
function getTshirtSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <path d="M92,12 L58,30 L38,90 L48,105 L55,80 L52,280 L132,280 L129,80 L136,105 L146,90 L122,30 Z"/>
            <ellipse cx="92" cy="26" rx="20" ry="13" fill="${color}" stroke-width="2"/>
        </g>
    `);
}

// PANTALONE LUNGO — long trousers hanging by waistband
function getPantsSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <rect x="30" y="5" width="120" height="26" rx="2"/>
            <rect x="50" y="2" width="8"  height="13" rx="1" stroke-width="1.5"/>
            <rect x="86" y="2" width="8"  height="13" rx="1" stroke-width="1.5"/>
            <rect x="122" y="2" width="8" height="13" rx="1" stroke-width="1.5"/>
            <path d="M30,31 L24,430 L82,430 C80,210 86,95 90,90 C94,95 100,210 98,430 L156,430 L150,31 Z"/>
            <path d="M90,60 Q87,85 86,105" fill="none" stroke-width="1.5"/>
        </g>
    `);
}

// PANTALONE CORTO — shorts hanging by waistband
function getShortsSvg(color) {
    const stroke = `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${stroke}>
            <rect x="30" y="5" width="120" height="26" rx="2"/>
            <rect x="50" y="2" width="8"  height="13" rx="1" stroke-width="1.5"/>
            <rect x="86" y="2" width="8"  height="13" rx="1" stroke-width="1.5"/>
            <rect x="122" y="2" width="8" height="13" rx="1" stroke-width="1.5"/>
            <path d="M30,31 L28,222 L82,222 C80,140 86,90 90,85 C94,90 100,140 98,222 L152,222 L150,31 Z"/>
        </g>
    `);
}

/* ==========================================================================
   FOLDED STACK SVG (for shelves and drawers — t-shirt style)
   ========================================================================== */

function getFoldedStackSvg(items) {
    if (!items || !items.length) return '';
    const maxLayers = 6;
    const display = items.slice(-maxLayers);
    const K = display.length;
    const dy = 7;
    let layers = '';

    const floorLine = `<line x1="6" y1="44" x2="74" y2="44" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`;

    for (let i = 0; i < K; i++) {
        const item = display[i];
        const color = item.color || '#fff';
        const isTop = (i === K - 1);
        const yBottom = 44 - i * dy;
        const yTop = yBottom - 8;

        let detail = '';
        if (isTop) {
            detail = `
                <path d="M33,${yTop} Q36,${yTop-3} 39,${yTop} Q36,${yTop+2} 33,${yTop} Z" fill="${color}" stroke="${INK}" stroke-width="1.2"/>
                <path d="M47,${yTop} Q44,${yTop-3} 41,${yTop} Q44,${yTop+2} 47,${yTop} Z" fill="${color}" stroke="${INK}" stroke-width="1.2"/>
                <path d="M39,${yTop} L40,${yTop+2} L41,${yTop}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
        }

        layers += `<g class="folded-item-group" data-id="${item.id}">
            <path d="M12,${yTop} L68,${yTop} Q71,${yTop} 71,${yTop+4} Q71,${yBottom} 68,${yBottom} L12,${yBottom} Q9,${yBottom} 9,${yTop+4} Q9,${yTop} 12,${yTop} Z"
                  fill="${color}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
            ${detail}
            <title>${item.name}${item.brand ? ' [' + item.brand + ']' : ''}</title>
        </g>`;
    }

    return `<svg viewBox="0 0 80 50" width="100%" height="100%" style="overflow:visible;">${floorLine}${layers}</svg>`;
}
