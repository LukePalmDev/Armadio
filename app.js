/* ==========================================================================
   WARDROBE ARCHIVE - APPLICATION STATE & LOGIC
   ========================================================================== */

// 1. HUMAN-READABLE LABELS FOR SECTIONS
const SECTION_NAMES = {
    'sec1-top-rail': 'Appendiabiti Superiore (Sezione 1)',
    'sec1-bottom-rail': 'Appendiabiti Inferiore (Sezione 1)',
    'sec2-top-shelf': 'Ripiano Superiore (Sezione 2)',
    'sec2-middle-rail': 'Appendiabiti Centrale (Sezione 2)',
    'sec2-drawer1': 'Cassetto Sinistro (Sezione 2)',
    'sec2-drawer2': 'Cassetto Centrale (Sezione 2)',
    'sec2-drawer3': 'Cassetto Destro (Sezione 2)'
};

// 2. DEFAULT SEED DATA (To ensure the app starts with a populated wardrobe)
function getSeedData() {
    return [
        // Milano Clothes
        { id: 'm1', house: 'Milano', section: 'sec1-top-rail', name: 'Camicia di Lino Celeste', type: 'shirt', color: '#87ceeb', brand: 'Ralph Lauren', notes: 'Taglia M' },
        { id: 'm2', house: 'Milano', section: 'sec1-top-rail', name: 'Felpa Bianca Slim Fit', type: 'hoodie', color: '#ffffff', brand: 'Uniqlo', notes: 'Cotone organico' },
        { id: 'm3', house: 'Milano', section: 'sec1-bottom-rail', name: 'Giacca Vintage Beige', type: 'jacket', color: '#f5f5dc', brand: 'Baracuta', notes: 'Primaverile' },
        { id: 'm4', house: 'Milano', section: 'sec2-middle-rail', name: 'Cappotto di Lana Nero', type: 'jacket', color: '#333333', brand: 'Zara', notes: 'Invernale pesante' },
        { id: 'm5', house: 'Milano', section: 'sec2-middle-rail', name: 'Camicia di Jeans Lavaggio Scuro', type: 'shirt', color: '#3b82f6', brand: 'Levi\'s', notes: 'Molto resistente' },
        { id: 'm6', house: 'Milano', section: 'sec2-top-shelf', name: 'Maglione in Cashmere Grigio', type: 'sweater', color: '#8c8c8c', brand: 'Falconeri', notes: 'Lavare a mano' },
        { id: 'm7', house: 'Milano', section: 'sec2-drawer1', name: 'Calze di Lana x5', type: 'sweater', color: '#8c8c8c', brand: 'Calvin Klein', notes: 'Invernali' },
        { id: 'm8', house: 'Milano', section: 'sec2-drawer2', name: 'Pantalone Corto Beige', type: 'shorts', color: '#ff9f00', brand: 'Timberland', notes: 'Estivo' },

        // Reggio Clothes
        { id: 'r1', house: 'Reggio', section: 'sec1-top-rail', name: 'Camicia di Lino Bianca', type: 'shirt', color: '#ffffff', brand: 'Boggi', notes: 'Perfetta per il caldo' },
        { id: 'r2', house: 'Reggio', section: 'sec2-middle-rail', name: 'Giacca Bomber Verde Militare', type: 'jacket', color: '#22c55e', brand: 'Alpha Industries', notes: 'Autunnale' },
        { id: 'r3', house: 'Reggio', section: 'sec2-top-shelf', name: 'Felpa con Cappuccio Grigia', type: 'hoodie', color: '#8c8c8c', brand: 'Nike', notes: 'Tempo libero' },

        // Sardegna Clothes
        { id: 's1', house: 'Sardegna', section: 'sec1-top-rail', name: 'Felpa Gialla Limone', type: 'hoodie', color: '#eab308', brand: 'Patagonia', notes: 'Estiva' },
        { id: 's2', house: 'Sardegna', section: 'sec1-bottom-rail', name: 'Costume da Bagno Rosso', type: 'shorts', color: '#ef4444', brand: 'Sundek', notes: 'Con velcro' },
        { id: 's3', house: 'Sardegna', section: 'sec2-top-shelf', name: 'Felpa Grigia Melange', type: 'hoodie', color: '#8c8c8c', brand: 'Nike', notes: 'Tempo libero' }
    ];
}

// 3. STATE DECLARATION
let currentHouse = 'Milano';
let selectedSection = null;
let clothes = [];
let editingItemId = null;

// 4. CORE DATA METHODS
function loadData() {
    const stored = localStorage.getItem('armadio_clothes');
    if (stored) {
        try {
            clothes = JSON.parse(stored);
            
            // Migration for legacy section IDs
            let migrated = false;
            clothes.forEach(item => {
                if (item.section) {
                    if (item.section === 'col1-shelf' || item.section.startsWith('col4-shelf')) {
                        item.section = 'sec2-top-shelf';
                        migrated = true;
                    } else if (item.section.startsWith('col1-drawer')) {
                        item.section = 'sec2-drawer3-col1';
                        migrated = true;
                    } else if (item.section === 'col2-top-rail') {
                        item.section = 'sec1-top-rail';
                        migrated = true;
                    } else if (item.section === 'col2-bottom-rail') {
                        item.section = 'sec1-bottom-rail';
                        migrated = true;
                    } else if (item.section === 'col3-rail') {
                        item.section = 'sec2-middle-rail';
                        migrated = true;
                    } else if (item.section === 'sec2-drawer1') {
                        item.section = 'sec2-drawer2-col1';
                        migrated = true;
                    } else if (item.section === 'sec2-drawer2') {
                        item.section = 'sec2-drawer2-col1';
                        migrated = true;
                    } else if (item.section === 'sec2-drawer3') {
                        item.section = 'sec2-drawer3-col1';
                        migrated = true;
                    }
                }
            });
            
            if (migrated) {
                localStorage.setItem('armadio_clothes', JSON.stringify(clothes));
            }
        } catch (e) {
            console.error("Errore nel caricamento del database", e);
            clothes = [];
        }
    } else {
        // Seeding initial data
        clothes = getSeedData();
        saveData();
    }
}

function saveData() {
    localStorage.setItem('armadio_clothes', JSON.stringify(clothes));
    updateStats();
}

// 5. RULERS ENGINE (CAD COORDINATES)
const rulerTop = document.getElementById('ruler-top');
const rulerLeft = document.getElementById('ruler-left');

function renderRulers() {
    if (rulerTop) {
        rulerTop.innerHTML = '';
        const width = window.innerWidth;
        // Major ticks every 100px, minor ticks every 20px (drawn by CSS linear gradients)
        for (let i = 100; i < width; i += 100) {
            const marker = document.createElement('span');
            marker.style.position = 'absolute';
            marker.style.left = `${i}px`;
            marker.style.bottom = '1px';
            marker.style.fontSize = '8px';
            marker.innerText = i;
            rulerTop.appendChild(marker);
        }
    }
    if (rulerLeft) {
        rulerLeft.innerHTML = '';
        const height = window.innerHeight;
        for (let i = 100; i < height; i += 100) {
            const marker = document.createElement('span');
            marker.style.position = 'absolute';
            marker.style.top = `${i}px`;
            marker.style.left = '2px';
            marker.style.fontSize = '8px';
            marker.innerText = i;
            rulerLeft.appendChild(marker);
        }
    }
}

// 6. DOOR LOGIC
function initDoors() {
    const doorL1 = document.getElementById('door-l1');
    const doorL2 = document.getElementById('door-l2');
    const doorR1 = document.getElementById('door-r1');
    const doorR2 = document.getElementById('door-r2');
    const toggleAllBtn = document.getElementById('btn-toggle-doors');

    const toggleLeftPair = () => {
        const isOpen = doorL1.classList.contains('open') || doorL2.classList.contains('open');
        if (isOpen) {
            doorL1.classList.remove('open');
            doorL2.classList.remove('open');
            if (selectedSection && selectedSection.startsWith('sec1')) {
                resetInspector();
            }
        } else {
            doorL1.classList.add('open');
            doorL2.classList.add('open');
        }
        updateToggleAllButtonText();
    };

    const toggleRightPair = () => {
        const isOpen = doorR1.classList.contains('open') || doorR2.classList.contains('open');
        if (isOpen) {
            doorR1.classList.remove('open');
            doorR2.classList.remove('open');
            if (selectedSection && selectedSection.startsWith('sec2')) {
                resetInspector();
            }
        } else {
            doorR1.classList.add('open');
            doorR2.classList.add('open');
        }
        updateToggleAllButtonText();
    };

    if (doorL1) doorL1.addEventListener('click', (e) => { e.stopPropagation(); toggleLeftPair(); });
    if (doorL2) doorL2.addEventListener('click', (e) => { e.stopPropagation(); toggleLeftPair(); });
    if (doorR1) doorR1.addEventListener('click', (e) => { e.stopPropagation(); toggleRightPair(); });
    if (doorR2) doorR2.addEventListener('click', (e) => { e.stopPropagation(); toggleRightPair(); });

    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', () => {
            const doors = [doorL1, doorL2, doorR1, doorR2];
            const closedDoors = doors.filter(d => d && !d.classList.contains('open'));
            if (closedDoors.length > 0) {
                doors.forEach(d => d && d.classList.add('open'));
            } else {
                doors.forEach(d => d && d.classList.remove('open'));
                resetInspector();
            }
            updateToggleAllButtonText();
        });
    }
}

function updateToggleAllButtonText() {
    const doors = document.querySelectorAll('.wardrobe-door');
    const toggleAllBtn = document.getElementById('btn-toggle-doors');
    if (!toggleAllBtn) return;
    const allOpen = Array.from(doors).every(d => d.classList.contains('open'));
    
    if (allOpen) {
        toggleAllBtn.textContent = "CHIUDI TUTTO";
    } else {
        toggleAllBtn.textContent = "APRI TUTTO";
    }
}

// Automatically open appropriate doors when clicking a compartment node
function ensureDoorsOpenForSection(sectionId) {
    const doorL1 = document.getElementById('door-l1');
    const doorL2 = document.getElementById('door-l2');
    const doorR1 = document.getElementById('door-r1');
    const doorR2 = document.getElementById('door-r2');

    if (sectionId.startsWith('sec1')) {
        if (doorL1) doorL1.classList.add('open');
        if (doorL2) doorL2.classList.add('open');
    } else if (sectionId.startsWith('sec2')) {
        if (doorR1) doorR1.classList.add('open');
        if (doorR2) doorR2.classList.add('open');
    }
    updateToggleAllButtonText();
}

// 7. COMPARTMENT VISUAL RENDER (DRAW CLOTHES IN ARMADIO)
function renderClothesInWardrobe() {
    // Clear all containers first
    const containers = document.querySelectorAll('.clothes-container');
    containers.forEach(c => c.innerHTML = '');

    // Reset pulled drawers
    const drawers = document.querySelectorAll('.drawer-node');
    drawers.forEach(d => d.classList.remove('pulled-out'));

    // Filter clothes of current house
    const houseClothes = clothes.filter(item => item.house === currentHouse);

    houseClothes.forEach(item => {
        const container = document.getElementById(`container-${item.section}`);
        if (!container) return;

        // Visual representation style
        const isHanging = item.section.includes('rail');
        
        if (isHanging) {
            // Render dynamic hanger based on type
            const shirtDiv = document.createElement('div');
            shirtDiv.className = 'visual-hanger';
            shirtDiv.innerHTML = `
                ${getHangerSvg(item.type, item.color)}
                <div class="cloth-tooltip">
                    <strong>${item.name}</strong><br>
                    ${item.brand ? `[${item.brand}]` : ''}
                </div>
            `;
            // Add click hook to open section inspector when clicking visual clothes
            shirtDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSection(item.section);
            });
            container.appendChild(shirtDiv);
        }
    });

    // Render shelves as aggregated folded stacks
    const shelfNodes = document.querySelectorAll('.shelf-node');
    shelfNodes.forEach(shelfNode => {
        const sectionId = shelfNode.getAttribute('data-section');
        const container = document.getElementById(`container-${sectionId}`);
        if (!container) return;
        
        const items = houseClothes.filter(c => c.section === sectionId);
        container.innerHTML = getFoldedStackSvg(items);
    });

    // Draw the horizontal shirt stacks in the open drawers
    renderDrawerColumns();

    // If selected section is a drawer sub-container, keep its parent drawer pulled out
    if (selectedSection && selectedSection.includes('drawer')) {
        const parts = selectedSection.split('-');
        const drawerId = `sec-${parts[0]}-${parts[1]}`;
        const activeDrawer = document.getElementById(drawerId);
        if (activeDrawer) {
            activeDrawer.classList.add('pulled-out');
        }
        
        // Highlight active sub-container column
        const activeCol = document.getElementById(`sec-${selectedSection}`);
        if (activeCol) {
            activeCol.classList.add('selected');
        }
    }
}

// 8. INSPECTOR ACTIONS & STATE SYNC
function selectSection(sectionId) {
    cancelEditClothing();
    selectedSection = sectionId;
    
    // Ensure appropriate doors are open so user doesn't inspect closed elements
    ensureDoorsOpenForSection(sectionId);

    // Remove selected state from all nodes
    document.querySelectorAll('.compartment-node').forEach(node => {
        node.classList.remove('selected');
    });

    // Highlight the selected node
    const node = document.getElementById(`sec-${sectionId}`);
    if (node) {
        node.classList.add('selected');
    }

    // Switch inspector states
    document.getElementById('inspector-default').classList.remove('active');
    document.getElementById('inspector-active').classList.add('active');

    // Update inspector textual details
    document.getElementById('inspect-house-name').textContent = currentHouse.toUpperCase();
    document.getElementById('inspect-section-name').textContent = SECTION_NAMES[sectionId] || sectionId.toUpperCase();

    // Render clothes inventory inside the selected section
    renderSectionInventory();
}

function resetInspector() {
    cancelEditClothing();
    selectedSection = null;
    document.querySelectorAll('.compartment-node').forEach(node => {
        node.classList.remove('selected');
    });
    
    // Clean up drawers pulled class
    document.querySelectorAll('.drawer-node').forEach(d => d.classList.remove('pulled-out'));

    document.getElementById('inspector-active').classList.remove('active');
    document.getElementById('inspector-default').classList.add('active');
    
    // Re-render wardrobe visual states
    renderClothesInWardrobe();
}

function renderSectionInventory() {
    const listContainer = document.getElementById('inventory-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const sectionClothes = clothes.filter(
        item => item.house === currentHouse && item.section === selectedSection
    );

    document.getElementById('inventory-count').textContent = sectionClothes.length;

    if (sectionClothes.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-inventory-msg">Nessun capo registrato in questa sezione. Aggiungi il tuo primo capo qui sotto!</div>
        `;
        return;
    }

    sectionClothes.forEach((item, index) => {
        const isFirst = (index === 0);
        const isLast = (index === sectionClothes.length - 1);

        const card = document.createElement('div');
        card.className = 'clothing-item-card';
        card.innerHTML = `
            <div class="clothing-item-info">
                <span class="clothing-color-badge" style="background-color: ${item.color};"></span>
                <div class="clothing-text-details">
                    <span class="cloth-title">${item.name}</span>
                    <span class="cloth-meta-label">
                        ${item.brand ? `${item.brand.toUpperCase()}` : 'GENERICO'} 
                        ${item.notes ? `• ${item.notes}` : ''}
                    </span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-move-up" title="Sposta su" data-id="${item.id}" ${isFirst ? 'disabled' : ''}>▲</button>
                <button class="btn-move-down" title="Sposta giù" data-id="${item.id}" ${isLast ? 'disabled' : ''}>▼</button>
                <button class="btn-edit-cloth" title="Modifica capo" data-id="${item.id}">✏️</button>
                <button class="btn-delete-cloth" title="Elimina capo" data-id="${item.id}">&times;</button>
            </div>
        `;

        // Move Up listener
        if (!isFirst) {
            card.querySelector('.btn-move-up').addEventListener('click', (e) => {
                e.stopPropagation();
                moveClothing(item.id, 'up');
            });
        }

        // Move Down listener
        if (!isLast) {
            card.querySelector('.btn-move-down').addEventListener('click', (e) => {
                e.stopPropagation();
                moveClothing(item.id, 'down');
            });
        }

        // Edit button listener
        card.querySelector('.btn-edit-cloth').addEventListener('click', (e) => {
            e.stopPropagation();
            startEditClothing(item.id);
        });

        // Delete button listener
        card.querySelector('.btn-delete-cloth').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteClothing(item.id);
        });

        listContainer.appendChild(card);
    });
}

function deleteClothing(itemId) {
    if (confirm("Sei sicuro di voler rimuovere questo capo dall'archivio?")) {
        clothes = clothes.filter(item => item.id !== itemId);
        saveData();
        renderSectionInventory();
        renderClothesInWardrobe();
    }
}

function moveClothing(itemId, direction) {
    const itemIndex = clothes.findIndex(c => c.id === itemId);
    if (itemIndex === -1) return;
    
    const targetItem = clothes[itemIndex];
    const sectionId = targetItem.section;
    const house = targetItem.house;
    
    const siblingIndices = [];
    clothes.forEach((c, idx) => {
        if (c.house === house && c.section === sectionId) {
            siblingIndices.push(idx);
        }
    });
    
    const siblingPos = siblingIndices.indexOf(itemIndex);
    if (siblingPos === -1) return;
    
    if (direction === 'up' && siblingPos > 0) {
        const prevGlobalIdx = siblingIndices[siblingPos - 1];
        const temp = clothes[itemIndex];
        clothes[itemIndex] = clothes[prevGlobalIdx];
        clothes[prevGlobalIdx] = temp;
    } else if (direction === 'down' && siblingPos < siblingIndices.length - 1) {
        const nextGlobalIdx = siblingIndices[siblingPos + 1];
        const temp = clothes[itemIndex];
        clothes[itemIndex] = clothes[nextGlobalIdx];
        clothes[nextGlobalIdx] = temp;
    } else {
        return;
    }
    
    saveData();
    renderSectionInventory();
    renderClothesInWardrobe();
}

// 9. NEW CLOTHING FORM MANAGEMENT
function initForm() {
    const form = document.getElementById('add-clothing-form');
    if (!form) return;

    // Custom color picker support
    const customColorInput = document.getElementById('cloth-color-custom');
    const customColorRadio = document.getElementById('radio-custom-color');
    
    if (customColorInput && customColorRadio) {
        customColorInput.addEventListener('input', () => {
            customColorRadio.value = customColorInput.value;
            customColorRadio.checked = true;
        });
        customColorInput.addEventListener('click', () => {
            customColorRadio.checked = true;
        });
    }

    // Cancel edit button listener
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelEditClothing);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!selectedSection) {
            alert("Errore: Seleziona una sezione dell'armadio prima di registrare un capo.");
            return;
        }

        const nameInput = document.getElementById('cloth-name');
        const typeSelect = document.getElementById('cloth-type');
        const brandInput = document.getElementById('cloth-brand');
        const notesText = document.getElementById('cloth-notes');

        // Retrieve color radio select
        let selectedColor = '#ffffff';
        const colorRadio = document.querySelector('input[name="cloth-color"]:checked');
        if (colorRadio) {
            if (colorRadio.value === 'custom') {
                selectedColor = customColorInput.value;
            } else {
                selectedColor = colorRadio.value;
            }
        }

        if (editingItemId) {
            // Edit Mode
            const idx = clothes.findIndex(item => item.id === editingItemId);
            if (idx !== -1) {
                clothes[idx].name = nameInput.value.trim();
                clothes[idx].type = typeSelect.value;
                clothes[idx].color = selectedColor;
                clothes[idx].brand = brandInput.value.trim();
                clothes[idx].notes = notesText.value.trim();
            }
            
            editingItemId = null;
            
            // Reset Form UI
            document.getElementById('form-title').textContent = "+ AGGIUNGI CAPO";
            document.getElementById('btn-submit-cloth').textContent = "REGISTRA CAPO";
            document.getElementById('btn-cancel-edit').style.display = "none";
        } else {
            // Add Mode
            const newItem = {
                id: 'cloth_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                house: currentHouse,
                section: selectedSection,
                name: nameInput.value.trim(),
                type: typeSelect.value,
                color: selectedColor,
                brand: brandInput.value.trim(),
                notes: notesText.value.trim()
            };
            clothes.push(newItem);
        }

        saveData();

        // Reset form inputs except color
        nameInput.value = '';
        brandInput.value = '';
        notesText.value = '';

        // Refresh views
        renderSectionInventory();
        renderClothesInWardrobe();
    });
}

// 9.5. EDIT MODALITY LOGIC
function startEditClothing(itemId) {
    const item = clothes.find(c => c.id === itemId);
    if (!item) return;
    
    editingItemId = itemId;
    
    // Populate form fields
    document.getElementById('cloth-name').value = item.name;
    document.getElementById('cloth-type').value = item.type;
    document.getElementById('cloth-brand').value = item.brand || '';
    document.getElementById('cloth-notes').value = item.notes || '';
    
    // Select the correct color swatch radio
    const customColorInput = document.getElementById('cloth-color-custom');
    const customColorRadio = document.getElementById('radio-custom-color');
    const colorRadios = document.querySelectorAll('input[name="cloth-color"]');
    
    colorRadios.forEach(radio => radio.checked = false);
    
    let matched = false;
    for (let radio of colorRadios) {
        if (radio.value.toLowerCase() === item.color.toLowerCase() && radio.id !== 'radio-custom-color') {
            radio.checked = true;
            matched = true;
            break;
        }
    }
    
    if (!matched && customColorInput && customColorRadio) {
        customColorInput.value = item.color;
        customColorRadio.value = item.color;
        customColorRadio.checked = true;
    }
    
    // Update Form UI
    document.getElementById('form-title').textContent = "MODIFICA CAPO";
    document.getElementById('btn-submit-cloth').textContent = "SALVA MODIFICHE";
    document.getElementById('btn-cancel-edit').style.display = "block";
    
    // Smooth scroll form into view
    document.getElementById('add-clothing-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelEditClothing() {
    editingItemId = null;
    
    const form = document.getElementById('add-clothing-form');
    if (form) {
        document.getElementById('cloth-name').value = '';
        document.getElementById('cloth-brand').value = '';
        document.getElementById('cloth-notes').value = '';
    }
    
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = "+ AGGIUNGI CAPO";
    
    const submitBtn = document.getElementById('btn-submit-cloth');
    if (submitBtn) submitBtn.textContent = "REGISTRA CAPO";
    
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) cancelBtn.style.display = "none";
}

// 10. STATISTICS CALCULATION
function updateStats() {
    const houseClothes = clothes.filter(c => c.house === currentHouse);
    
    const total = houseClothes.length;
    const hanging = houseClothes.filter(c => c.section.includes('rail')).length;
    const shelf = houseClothes.filter(c => c.section.includes('shelf')).length;
    const drawer = houseClothes.filter(c => c.section.includes('drawer')).length;

    // Update defaults panel stats
    document.getElementById('stat-total-items').textContent = total;
    document.getElementById('stat-hanging-items').textContent = hanging;
    document.getElementById('stat-shelf-items').textContent = shelf;
    document.getElementById('stat-drawer-items').textContent = drawer;
    document.getElementById('summary-house-name').textContent = currentHouse.toUpperCase();

    // Footer stats
    document.getElementById('db-size-indicator').textContent = `DB ITEMS: ${clothes.length}`;
}

// 11. HOUSE NAVIGATION TABS
function initNavigation() {
    const tabs = document.querySelectorAll('.menu-tab');
    const statusText = document.getElementById('current-house-status');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active status
            tabs.forEach(t => t.classList.remove('active'));
            
            // Activate this tab
            tab.classList.add('active');
            currentHouse = tab.getAttribute('data-house');

            // Update Status Light text
            statusText.textContent = `${currentHouse.toUpperCase()}_ONLINE`;

            // Reset selected compartment on house swap to avoid confusion
            resetInspector();
            
            // Re-render and update stats
            updateStats();
            renderClothesInWardrobe();
        });
    });
}

// 12. COMPARTMENT CLICK DELEGATION
function initCompartmentClicks() {
    const nodes = document.querySelectorAll('.compartment-node');
    nodes.forEach(node => {
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            const sectionId = node.getAttribute('data-section');
            selectSection(sectionId);
        });
    });
}

// 13. BOOTSTRAP INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    // 1. Draw CAD Rulers
    renderRulers();
    window.addEventListener('resize', renderRulers);

    // 2. Load DB
    loadData();

    // 3. Init Navigation tabs
    initNavigation();

    // 4. Init interactive wardrobe doors
    initDoors();

    // 5. Init compartment click delegates
    initCompartmentClicks();

    // 6. Init form color pickers and submit actions
    initForm();

    // 7. Update visual stats
    updateStats();

    // 8. Init drawers engine
    initDrawers();

    // 9. Draw hangers and clothes inside the wardrobe layout
    renderClothesInWardrobe();
    
    // Back button in active inspector
    document.getElementById('btn-back-to-default').addEventListener('click', resetInspector);
});

// 13.5. DRAWERS SUB-CONTAINERS ENGINE
function initDrawers() {
    const drawers = document.querySelectorAll('.drawer-node');
    drawers.forEach(drawer => {
        drawer.addEventListener('click', (e) => {
            if (drawer.classList.contains('pulled-out')) return;
            
            e.stopPropagation();
            
            // Close other drawers
            drawers.forEach(d => d.classList.remove('pulled-out'));
            // Open this drawer
            drawer.classList.add('pulled-out');
            
            // Ensure Section 2 doors are open so user can see the drawer interior!
            const doorR1 = document.getElementById('door-r1');
            const doorR2 = document.getElementById('door-r2');
            if (doorR1) doorR1.classList.add('open');
            if (doorR2) doorR2.classList.add('open');
            updateToggleAllButtonText();
            
            // Automatically select first column if available
            const firstCol = drawer.querySelector('.drawer-col-container');
            if (firstCol) {
                const sectionId = firstCol.getAttribute('data-section');
                selectSection(sectionId);
            } else {
                // Empty drawer 1
                resetInspector();
            }
        });
    });

    // Sub-compartments click listeners
    const colNodes = document.querySelectorAll('.drawer-col-container');
    colNodes.forEach(col => {
        col.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent drawer node click trigger
            const sectionId = col.getAttribute('data-section');
            selectSection(sectionId);
        });
    });
}

function renderDrawerColumns() {
    const drawerSections = [
        'sec2-drawer2-col1',
        'sec2-drawer2-col2',
        'sec2-drawer3-col1',
        'sec2-drawer3-col2',
        'sec2-drawer3-col3'
    ];
    
    drawerSections.forEach(sectionId => {
        const el = document.getElementById(`sec-${sectionId}`);
        if (!el) return;
        
        el.innerHTML = '';
        
        // Remove old selected highlight (will be reapplied at end of render loop for active selection)
        el.classList.remove('selected');
        
        const items = clothes.filter(c => c.house === currentHouse && c.section === sectionId);
        
        if (items.length === 0) {
            el.innerHTML = `
                <div class="empty-drawer-stack" title="Vuoto. Clicca per ispezionare ed aggiungere capi.">
                    <span>+</span>
                </div>
            `;
            return;
        }
        
        el.innerHTML = getFoldedStackSvg(items);
    });
}

function getHangerSvg(type, color) {
    const hook = `
        <!-- Hanger Hook -->
        <path d="M20,4 C17,4 15,7 18,11 C20,13 20,16 20,18" fill="none" stroke="#333" stroke-width="1.5" stroke-linecap="round" />
    `;

    // Exact jacket shape from user screenshot
    const content = `
        <!-- Main Coat Body -->
        <path d="M 10,22 L 28,22 L 32,28 L 32,75 L 10,75 Z" fill="${color}" stroke="#333" stroke-width="1.5" stroke-linejoin="round" />
        
        <!-- Hanger Frame (visible inside the collar) -->
        <path d="M 14,24 L 20,18 L 26,24 M 14,24 L 26,24" fill="none" stroke="#333" stroke-width="1.2" stroke-linejoin="round" />
        
        <!-- Collar back stand -->
        <path d="M 17,20 C 18,16 22,16 23,20" fill="none" stroke="#333" stroke-width="1.2" />
        
        <!-- Left Collar Flap / Lapel -->
        <path d="M 20,18 L 13,21 L 18,25 Z" fill="${color}" stroke="#333" stroke-width="1.2" stroke-linejoin="round" />
        <!-- Right Collar Flap / Lapel -->
        <path d="M 20,18 L 27,16 L 24,24 Z" fill="${color}" stroke="#333" stroke-width="1.2" stroke-linejoin="round" />
        
        <!-- Front Sleeve (hanging in front, center-right) -->
        <path d="M 18,25 L 18,68 L 25,68 L 25,25 Z" fill="${color}" stroke="#333" stroke-width="1.5" stroke-linejoin="round" />
        
        <!-- Pocket flap details on the left of the sleeve -->
        <path d="M 18,59 L 13,59 L 11,62 L 18,62" fill="${color}" stroke="#333" stroke-width="1.2" stroke-linejoin="round" />
        
        <!-- Double line at the bottom hem of the coat -->
        <line x1="10" y1="72" x2="32" y2="72" stroke="#333" stroke-width="1" />
    `;

    return `
    <svg viewBox="0 0 40 80" width="30" height="60" style="filter: drop-shadow(1px 1px 0px rgba(0,0,0,0.15));">
        ${content}
        ${hook}
    </svg>
    `;
}

// 15. DYNAMIC FOLDED STACK SVG GENERATOR (Exact replica of T-shirt stack screenshot)
function getFoldedStackSvg(items) {
    if (!items || items.length === 0) return '';
    
    const maxLayers = 6;
    const displayItems = items.slice(-maxLayers);
    const K = displayItems.length;
    
    const dy = 7; // Spacing between layers
    
    let layersSvg = '';
    
    // Draw the floor line first
    const floorLine = `<line x1="6" y1="44" x2="74" y2="44" stroke="#333" stroke-width="1.5" stroke-linecap="round" />`;
    
    for (let i = 0; i < K; i++) {
        const item = displayItems[i];
        const color = item.color || '#fff';
        const isTop = (i === K - 1);
        
        const y_bottom = 44 - i * dy;
        const y_top = y_bottom - 8;
        
        let details = '';
        if (isTop) {
            const y = y_top;
            details = `
                <!-- Collar outline from user T-shirt screenshot -->
                <path d="M 33,${y} Q 36,${y-3} 39,${y} Q 36,${y+2} 33,${y} Z" fill="${color}" stroke="#333" stroke-width="1.2" />
                <path d="M 47,${y} Q 44,${y-3} 41,${y} Q 44,${y+2} 47,${y} Z" fill="${color}" stroke="#333" stroke-width="1.2" />
                <path d="M 39,${y} L 40,${y+2} L 41,${y}" fill="none" stroke="#333" stroke-width="1.2" />
            `;
        }
        
        // Soft rounded capsule representing the folded garment layer
        layersSvg += `
            <g class="folded-item-group" data-id="${item.id}">
                <path d="M 12,${y_top} L 68,${y_top} Q 71,${y_top} 71,${y_top+4} Q 71,${y_bottom} 68,${y_bottom} L 12,${y_bottom} Q 9,${y_bottom} 9,${y_top+4} Q 9,${y_top} 12,${y_top} Z" fill="${color}" stroke="#333" stroke-width="1.5" stroke-linejoin="round" />
                ${details}
                <title>${item.name}${item.brand ? ' [' + item.brand + ']' : ''}</title>
            </g>
        `;
    }
    
    return `
    <svg viewBox="0 0 80 50" width="100%" height="100%" style="overflow: visible;">
        ${floorLine}
        ${layersSvg}
    </svg>
    `;
}
