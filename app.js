/* ==========================================================================
   WARDROBE ARCHIVE - APPLICATION STATE & LOGIC
   ========================================================================== */

// 1. HUMAN-READABLE LABELS FOR SECTIONS
const SECTION_NAMES = {
    'col1-shelf': 'Ripiano Superiore (Colonna 1)',
    'col1-drawer1': 'Cassettone 1 (Colonna 1 Inferiore)',
    'col1-drawer2': 'Cassettone 2 (Colonna 1 Inferiore)',
    'col1-drawer3': 'Cassettone 3 (Colonna 1 Inferiore)',
    'col2-top-rail': 'Appendiabiti Superiore (Colonna 2)',
    'col2-bottom-rail': 'Appendiabiti Inferiore (Colonna 2)',
    'col3-rail': 'Appendiabiti Centrale (Colonna 3)',
    'col4-shelf1': 'Ripiano 1 (Colonna 4)',
    'col4-shelf2': 'Ripiano 2 (Colonna 4)',
    'col4-shelf3': 'Ripiano 3 (Colonna 4)',
    'col4-shelf4': 'Ripiano 4 (Colonna 4)'
};

// 2. DEFAULT SEED DATA (To ensure the app starts with a populated wardrobe)
function getSeedData() {
    return [
        // Milano Clothes
        { id: 'm1', house: 'Milano', section: 'col2-top-rail', name: 'Camicia di Lino Celeste', type: 'shirt', color: '#87ceeb', brand: 'Ralph Lauren', notes: 'Taglia M' },
        { id: 'm2', house: 'Milano', section: 'col2-top-rail', name: 'T-Shirt Bianca Slim Fit', type: 'tshirt', color: '#ffffff', brand: 'Uniqlo', notes: 'Cotone organico' },
        { id: 'm3', house: 'Milano', section: 'col2-bottom-rail', name: 'Giacca Vintage Beige', type: 'jacket', color: '#f5f5dc', brand: 'Baracuta', notes: 'Primaverile' },
        { id: 'm4', house: 'Milano', section: 'col3-rail', name: 'Cappotto di Lana Nero', type: 'jacket', color: '#333333', brand: 'Zara', notes: 'Invernale pesante' },
        { id: 'm5', house: 'Milano', section: 'col3-rail', name: 'Camicia di Jeans Lavaggio Scuro', type: 'shirt', color: '#3b82f6', brand: 'Levi\'s', notes: 'Molto resistente' },
        { id: 'm6', house: 'Milano', section: 'col1-shelf', name: 'Maglione in Cashmere Grigio', type: 'sweater', color: '#8c8c8c', brand: 'Falconeri', notes: 'Lavare a mano' },
        { id: 'm7', house: 'Milano', section: 'col4-shelf1', name: 'Polo in Piquet Blu', type: 'tshirt', color: '#1e3a8a', brand: 'Lacoste', notes: 'Estiva' },
        { id: 'm8', house: 'Milano', section: 'col4-shelf2', name: 'Jeans 501 Regular Fit', type: 'pants', color: '#4b5563', brand: 'Levi\'s', notes: 'W32 L32' },
        { id: 'm9', house: 'Milano', section: 'col1-drawer1', name: 'Boxer in Cotone Grigio x5', type: 'other', color: '#8c8c8c', brand: 'Calvin Klein', notes: 'Intimo' },
        { id: 'm10', house: 'Milano', section: 'col1-drawer2', name: 'Cintura in Cuoio Marrone', type: 'other', color: '#ff9f00', brand: 'Timberland', notes: 'Accessorio' },

        // Reggio Clothes
        { id: 'r1', house: 'Reggio', section: 'col2-top-rail', name: 'Camicia di Lino Bianca', type: 'shirt', color: '#ffffff', brand: 'Boggi', notes: 'Perfetta per il caldo' },
        { id: 'r2', house: 'Reggio', section: 'col3-rail', name: 'Giacca Bomber Verde Militare', type: 'jacket', color: '#22c55e', brand: 'Alpha Industries', notes: 'Autunnale' },
        { id: 'r3', house: 'Reggio', section: 'col1-shelf', name: 'Felpa con Cappuccio Grigia', type: 'sweater', color: '#8c8c8c', brand: 'Nike', notes: 'Tempo libero' },
        { id: 'r4', house: 'Reggio', section: 'col4-shelf3', name: 'Chino Tortora', type: 'pants', color: '#f5f5dc', brand: 'Mason\'s', notes: 'Estivi leggeri' },

        // Sardegna Clothes
        { id: 's1', house: 'Sardegna', section: 'col2-top-rail', name: 'T-shirt Gialla Limone', type: 'tshirt', color: '#eab308', brand: 'Patagonia', notes: 'Vacanza mare' },
        { id: 's2', house: 'Sardegna', section: 'col2-bottom-rail', name: 'Costume da Bagno Rosso', type: 'shorts', color: '#ef4444', brand: 'Sundek', notes: 'Con velcro' },
        { id: 's3', house: 'Sardegna', section: 'col4-shelf1', name: 'Cappello di Paglia Fedora', type: 'hat', color: '#ff9f00', brand: 'Panama', notes: 'Protezione solare' },
        { id: 's4', house: 'Sardegna', section: 'col4-shelf2', name: 'Scarpe Espadrillas Blu', type: 'shoes', color: '#3b82f6', brand: 'Toms', notes: 'Comode' }
    ];
}

// 3. STATE DECLARATION
let currentHouse = 'Milano';
let selectedSection = null;
let clothes = [];

// 4. CORE DATA METHODS
function loadData() {
    const stored = localStorage.getItem('armadio_clothes');
    if (stored) {
        try {
            clothes = JSON.parse(stored);
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
    const doors = document.querySelectorAll('.wardrobe-door');
    const toggleAllBtn = document.getElementById('btn-toggle-doors');

    doors.forEach(door => {
        door.addEventListener('click', (e) => {
            // Stop propagation so clicking the handle/door doesn't trigger parent clicks
            e.stopPropagation();
            door.classList.toggle('open');
            updateToggleAllButtonText();
            
            // If we closed the doors containing our selected compartment, reset inspector
            const doorId = door.getAttribute('data-door');
            checkClosedSection(doorId);
        });
    });

    toggleAllBtn.addEventListener('click', () => {
        const closedDoors = Array.from(doors).filter(d => !d.classList.contains('open'));
        if (closedDoors.length > 0) {
            // If any door is closed, open all
            doors.forEach(d => d.classList.add('open'));
        } else {
            // Close all
            doors.forEach(d => d.classList.remove('open'));
            resetInspector();
        }
        updateToggleAllButtonText();
    });
}

function updateToggleAllButtonText() {
    const doors = document.querySelectorAll('.wardrobe-door');
    const toggleAllBtn = document.getElementById('btn-toggle-doors');
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

    if (sectionId.startsWith('col1')) {
        doorL1.classList.add('open');
    } else if (sectionId.startsWith('col2')) {
        doorL2.classList.add('open');
    } else if (sectionId.startsWith('col3')) {
        doorR1.classList.add('open');
    } else if (sectionId.startsWith('col4')) {
        doorR2.classList.add('open');
    }
    updateToggleAllButtonText();
}

function checkClosedSection(doorId) {
    if (!selectedSection) return;
    
    // Check if the door closed covers the selected section
    const coversSection = 
        (doorId === 'l1' && selectedSection.startsWith('col1')) ||
        (doorId === 'l2' && selectedSection.startsWith('col2')) ||
        (doorId === 'r1' && selectedSection.startsWith('col3')) ||
        (doorId === 'r2' && selectedSection.startsWith('col4'));

    if (coversSection) {
        resetInspector();
    }
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
            // Render hanger shirt
            const shirtDiv = document.createElement('div');
            shirtDiv.className = 'visual-hanger';
            shirtDiv.innerHTML = `
                <svg viewBox="0 0 40 40" width="22" height="28" style="filter: drop-shadow(1px 1px 0px rgba(0,0,0,0.15));">
                    <!-- Hanger hook -->
                    <path d="M20,6 C18,6 17,9 20,11 C23,9 22,6 20,6 Z" fill="none" stroke="#333" stroke-width="1.5" />
                    <path d="M20,11 L20,13" fill="none" stroke="#333" stroke-width="1.5" />
                    <!-- Hanger shoulders -->
                    <path d="M4,15 L20,13 L36,15" fill="none" stroke="#333" stroke-width="1.5" stroke-linecap="round" />
                    <!-- Shirt -->
                    <path d="M6,16 L11,36 L29,36 L34,16 L28,15 L25,20 L15,20 L12,15 Z" fill="${item.color}" stroke="#333" stroke-width="1.5" stroke-linejoin="round" />
                    <!-- Collar details -->
                    <path d="M15,15 L20,19 L25,15" fill="none" stroke="#333" stroke-width="1.5" />
                </svg>
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
        } else if (item.section.includes('shelf')) {
            // Render folded clothes stack
            const foldedDiv = document.createElement('div');
            foldedDiv.className = 'visual-folded';
            foldedDiv.style.backgroundColor = item.color;
            foldedDiv.innerHTML = `
                <div style="position: absolute; bottom: 1px; left: 2px; right: 2px; height: 1.5px; background: rgba(0,0,0,0.15);"></div>
                <div class="cloth-tooltip">
                    <strong>${item.name}</strong><br>
                    ${item.brand ? `[${item.brand}]` : ''}
                </div>
            `;
            foldedDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSection(item.section);
            });
            container.appendChild(foldedDiv);
        } else if (item.section.includes('drawer')) {
            // Drawers hide actual clothing visuals, but we add visual highlight to active/occupied drawers
            // Let's add a minor dither marker or indicator that there are clothes inside the drawer node
            const drawerNode = document.getElementById(`sec-${item.section}`);
            if (drawerNode) {
                let badge = drawerNode.querySelector('.drawer-clothes-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'drawer-clothes-badge';
                    badge.style.position = 'absolute';
                    badge.style.top = '4px';
                    badge.style.right = '4px';
                    badge.style.width = '6px';
                    badge.style.height = '6px';
                    badge.style.backgroundColor = 'var(--primary)';
                    badge.style.borderRadius = '50%';
                    badge.style.border = '0.5px solid var(--border-color)';
                    drawerNode.appendChild(badge);
                }
            }
        }
    });

    // If selected section is a drawer, keep it pulled out
    if (selectedSection && selectedSection.includes('drawer')) {
        const activeDrawer = document.getElementById(`sec-${selectedSection}`);
        if (activeDrawer) {
            activeDrawer.classList.add('pulled-out');
        }
    }
}

// 8. INSPECTOR ACTIONS & STATE SYNC
function selectSection(sectionId) {
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

    sectionClothes.forEach(item => {
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
            <button class="btn-delete-cloth" title="Elimina capo" data-id="${item.id}">&times;</button>
        `;

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

        // Add to database
        clothes.push(newItem);
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

    // 8. Draw hangers and clothes inside the wardrobe layout
    renderClothesInWardrobe();
    
    // Back button in active inspector
    document.getElementById('btn-back-to-default').addEventListener('click', resetInspector);
});
