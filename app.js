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

// Escape user-provided strings before injecting into innerHTML/SVG
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// STATE
let currentHouse  = 'Milano';
let selectedSection = null;
let clothes = [];
let editingItemId = null;
let offlineMode = false;

function showOfflineBanner() {
    if (document.getElementById('offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.textContent = '⚠️  Server non raggiungibile — le modifiche restano solo nel browser. Avvia "python3 server.py" e ricarica per sincronizzare.';
    banner.style.cssText = 'position:fixed;top:48px;left:0;right:0;z-index:9999;background:var(--red);color:#fff;padding:7px 16px;font-family:Space Mono,monospace;font-size:11px;text-align:center;letter-spacing:0.03em;';
    document.body.prepend(banner);
}

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

    // 1) Try the API server (wardrobe.json via server.py)
    try {
        const res = await fetch('/api/load');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) { clothes = data; loaded = true; }
        }
    } catch (e) { console.warn('Server non raggiungibile, provo wardrobe.json statico...', e); }

    // 2) Fallback: fetch wardrobe.json as a static file (e.g. python3 -m http.server)
    if (!loaded) {
        try {
            const res = await fetch('wardrobe.json', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) { clothes = data; loaded = true; console.log('Dati caricati da wardrobe.json statico.'); }
            }
        } catch (e) { console.warn('wardrobe.json statico non disponibile.', e); }
    }

    // 3) Final fallback: localStorage / seed data
    if (!loaded) {
        offlineMode = true;
        showOfflineBanner();
        const stored = localStorage.getItem('armadio_clothes');
        if (stored) { try { clothes = JSON.parse(stored); } catch { clothes = []; } }
        else { clothes = getSeedData(); }
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

    // Rails — 8 hangers per row fit the compartment width without squeezing
    const PER_ROW = 8;
    ['sec1-top-rail', 'sec1-bottom-rail', 'sec2-middle-rail'].forEach(sid => {
        const container = document.getElementById(`container-${sid}`);
        if (!container) return;
        const items = hc.filter(c => c.section === sid);
        for (let i = 0; i < items.length; i += PER_ROW) {
            const row = document.createElement('div');
            row.className = 'rail-row';
            items.slice(i, i + PER_ROW).forEach(item => {
                const div = document.createElement('div');
                div.className = 'visual-hanger';
                div.innerHTML = `${getHangerSvg(item.type, item.color)}
                    <div class="cloth-tooltip"><strong>${esc(item.name)}</strong>${item.brand ? '<br>' + esc(item.brand) : ''}</div>`;
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
                <span class="clothing-color-badge" style="background:${esc(item.color)}"></span>
                <div class="clothing-text-details">
                    <span class="cloth-title">${esc(item.name)}</span>
                    <span class="cloth-meta-label">${item.brand ? esc(item.brand.toUpperCase()) : 'GENERICO'}${item.notes ? ' · ' + esc(item.notes) : ''}</span>
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
            if (firstCol) {
                selectSection(firstCol.dataset.section);
            } else {
                // Empty drawer: reset the inspector but keep the drawer visibly open
                resetInspector();
                drawer.classList.add('pulled-out');
            }
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
   All use viewBox="0 0 180 420", displayed at 38x89 px.
   Wide bodies (~75% of viewBox) so garments stay recognizable at small size.
   ========================================================================== */

const INK = '#1A1816';

function svgWrap(content) {
    return `<svg viewBox="0 0 180 420" width="38" height="89" style="display:block;overflow:visible;">
        ${content}
    </svg>`;
}

const HOOK = `<path d="M90,42 C90,30 78,20 90,12 C102,20 98,30 90,42" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
const STROKE = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const THIN = `stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"`;

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

// GIACCA — broad shoulders, V lapels, front opening, pocket flaps
function getJacketSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M90,46 L36,66 L26,400 L154,400 L144,66 Z"/>
            <path d="M90,50 L70,100 L82,92 L90,118 L98,92 L110,100 Z"/>
        </g>
        <g ${THIN}>
            <line x1="90" y1="118" x2="90" y2="396"/>
            <line x1="52" y1="72" x2="44" y2="392"/>
            <line x1="128" y1="72" x2="136" y2="392"/>
            <line x1="44" y1="308" x2="66" y2="312"/>
            <line x1="136" y1="308" x2="114" y2="312"/>
        </g>
    `);
}

// CAMICIA — collar points, button placket, shorter than a coat
function getShirtSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M90,44 L40,62 L32,330 L148,330 L140,62 Z"/>
            <path d="M90,44 L66,56 L84,82 L90,60 Z"/>
            <path d="M90,44 L114,56 L96,82 L90,60 Z"/>
        </g>
        <g ${THIN}>
            <line x1="90" y1="82" x2="90" y2="326"/>
            <line x1="54" y1="66" x2="48" y2="322"/>
            <line x1="126" y1="66" x2="132" y2="322"/>
        </g>
        <circle cx="90" cy="116" r="4" fill="${INK}"/>
        <circle cx="90" cy="168" r="4" fill="${INK}"/>
        <circle cx="90" cy="220" r="4" fill="${INK}"/>
        <circle cx="90" cy="272" r="4" fill="${INK}"/>
    `);
}

// FELPA — hood dome, drawstrings, kangaroo pocket, ribbed hem
function getHoodieSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M60,64 Q58,24 90,20 Q122,24 120,64 Q90,78 60,64 Z"/>
            <path d="M60,64 L32,80 L28,344 L152,344 L148,80 L120,64 Q90,78 60,64 Z"/>
            <path d="M64,252 L116,252 L124,314 L56,314 Z"/>
        </g>
        <g ${THIN}>
            <path d="M84,72 L81,100"/>
            <path d="M96,72 L99,100"/>
            <line x1="28" y1="330" x2="152" y2="330"/>
            <line x1="48" y1="332" x2="48" y2="342"/>
            <line x1="69" y1="332" x2="69" y2="342"/>
            <line x1="90" y1="332" x2="90" y2="342"/>
            <line x1="111" y1="332" x2="111" y2="342"/>
            <line x1="132" y1="332" x2="132" y2="342"/>
        </g>
    `);
}

// MAGLIONE — crew neckband, side seams, ribbed hem
function getSweaterSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M64,56 Q90,42 116,56 L150,74 L154,332 L26,332 L30,74 Z"/>
        </g>
        <g ${THIN}>
            <path d="M68,64 Q90,52 112,64"/>
            <line x1="48" y1="80" x2="40" y2="324"/>
            <line x1="132" y1="80" x2="140" y2="324"/>
            <line x1="26" y1="318" x2="154" y2="318"/>
            <line x1="46" y1="320" x2="46" y2="330"/>
            <line x1="68" y1="320" x2="68" y2="330"/>
            <line x1="90" y1="320" x2="90" y2="330"/>
            <line x1="112" y1="320" x2="112" y2="330"/>
            <line x1="134" y1="320" x2="134" y2="330"/>
        </g>
    `);
}

// T-SHIRT — classic tee with protruding short sleeves
function getTshirtSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M64,48 Q90,66 116,48 L150,60 L160,118 L130,130 L127,102 L127,282 L53,282 L53,102 L50,130 L20,118 L30,60 Z"/>
        </g>
        <g ${THIN}>
            <path d="M68,52 Q90,72 112,52"/>
        </g>
    `);
}

// PANTALONE LUNGO — waistband with belt loops, two legs, crotch notch
function getPantsSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M40,46 L140,46 L140,68 L40,68 Z"/>
            <path d="M40,68 L34,412 L82,412 L87,150 Q90,140 93,150 L98,412 L146,412 L140,68 Z"/>
        </g>
        <g ${THIN}>
            <line x1="50" y1="46" x2="50" y2="58"/>
            <line x1="90" y1="46" x2="90" y2="58"/>
            <line x1="130" y1="46" x2="130" y2="58"/>
            <line x1="61" y1="84" x2="58" y2="404"/>
            <line x1="119" y1="84" x2="122" y2="404"/>
        </g>
        <circle cx="90" cy="63" r="3.5" fill="${INK}"/>
    `);
}

// PANTALONE CORTO — waistband with drawstring, short legs
function getShortsSvg(color) {
    return svgWrap(`
        ${HOOK}
        <g fill="${color}" ${STROKE}>
            <path d="M36,46 L144,46 L144,68 L36,68 Z"/>
            <path d="M36,68 L30,208 L84,208 L88,136 Q90,130 92,136 L96,208 L150,208 L144,68 Z"/>
        </g>
        <g ${THIN}>
            <path d="M82,68 Q86,86 78,96"/>
            <path d="M98,68 Q94,86 102,96"/>
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
            <title>${esc(item.name)}${item.brand ? ' [' + esc(item.brand) + ']' : ''}</title>
        </g>`;
    }

    return `<svg viewBox="0 0 80 50" width="100%" height="100%" style="overflow:visible;">${floorLine}${layers}</svg>`;
}
