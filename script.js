// Configuración
const API_URL = 'https://albion-telegram-bot.onrender.com';

// Estado de la aplicación
let currentFlips = [];
let currentCities = [];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initEventListeners();
    loadDashboardData();
    
    // Actualizar cada 3 minutos
    setInterval(() => {
        if (getCurrentTab() === 'dashboard') {
            loadDashboardData();
        } else if (getCurrentTab() === 'flips') {
            loadFlips();
        }
    }, 180000);
});

// Inicializar tabs
function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Actualizar botones activos
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Actualizar contenido
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Cargar datos según tab
            if (tabId === 'dashboard') {
                loadDashboardData();
            } else if (tabId === 'flips') {
                loadFlips();
            }
        });
    });
    
    // Links desde dashboard
    document.querySelectorAll('[data-tab-link]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.dataset.tabLink;
            document.querySelector(`.nav-btn[data-tab="${tabId}"]`).click();
        });
    });
}

// Inicializar event listeners
function initEventListeners() {
    // Búsqueda de precios
    document.getElementById('searchBtn').addEventListener('click', searchPrices);
    document.getElementById('itemSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPrices();
    });
    
    // Autocompletado
    document.getElementById('itemSearch').addEventListener('input', loadSuggestions);
    
    // Crafting
    document.getElementById('craftingBtn').addEventListener('click', searchCrafting);
    document.getElementById('craftingSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCrafting();
    });
    
    // Refining
    document.getElementById('refiningBtn').addEventListener('click', searchRefining);
    document.getElementById('refiningSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchRefining();
    });
    
    // Filtro de flips
    document.getElementById('flipsSearch').addEventListener('input', filterFlips);
}

// Obtener tab actual
function getCurrentTab() {
    const activeBtn = document.querySelector('.nav-btn.active');
    return activeBtn ? activeBtn.dataset.tab : 'dashboard';
}

// Actualizar estado del servidor
async function updateServerStatus() {
    try {
        const response = await fetch(`${API_URL}/api/status`);
        const data = await response.json();
        
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (data.status === 'online') {
            statusDot.classList.add('online');
            statusText.textContent = 'Online';
        } else {
            statusDot.classList.remove('online');
            statusText.textContent = 'Offline';
        }
        
        if (data.last_scan) {
            const lastScan = new Date(data.last_scan);
            document.getElementById('lastUpdate').textContent = lastScan.toLocaleTimeString();
        }
        
        if (data.items_monitored) {
            document.getElementById('totalItems').textContent = data.items_monitored.toLocaleString();
        }
        
        if (data.cities) {
            document.getElementById('totalCities').textContent = data.cities.length;
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching status:', error);
        document.getElementById('statusText').textContent = 'Error';
        return null;
    }
}

// Cargar dashboard
async function loadDashboardData() {
    await updateServerStatus();
    await loadBestFlips();
    await loadCities();
}

// Cargar mejores flips
async function loadBestFlips() {
    try {
        const response = await fetch(`${API_URL}/api/flips/best`);
        const flips = await response.json();
        
        const tbody = document.getElementById('bestFlipsBody');
        if (!flips.length) {
            tbody.innerHTML = '<tr><td colspan="5">No hay flips disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = flips.map(flip => `
            <tr>
                <td><strong>${flip.item}</strong></td>
                <td>${flip.buy_city}<br><small>${formatNumber(flip.buy_price)}</small></td>
                <td>${flip.sell_city}<br><small>${formatNumber(flip.sell_price)}</small></td>
                <td class="profit-positive">+${formatNumber(flip.profit)}</td>
                <td class="profit-positive">${flip.margin}%</td>
            </tr>
        `).join('');
        
        document.getElementById('totalFlips').textContent = flips.length;
        currentFlips = flips;
    } catch (error) {
        console.error('Error loading flips:', error);
        document.getElementById('bestFlipsBody').innerHTML = '<tr><td colspan="5">Error cargando datos</td></tr>';
    }
}

// Cargar todos los flips
async function loadFlips() {
    try {
        const response = await fetch(`${API_URL}/api/flips`);
        const data = await response.json();
        const flips = data.flips || [];
        
        const tbody = document.getElementById('flipsBody');
        if (!flips.length) {
            tbody.innerHTML = '<tr><td colspan="7">No hay flips disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = flips.map(flip => `
            <tr>
                <td><strong>${flip.item}</strong></td>
                <td>${flip.buy_city}</td>
                <td>${formatNumber(flip.buy_price)}</td>
                <td>${flip.sell_city}</td>
                <td>${formatNumber(flip.sell_price)}</td>
                <td class="profit-positive">+${formatNumber(flip.profit)}</td>
                <td class="profit-positive">${flip.margin}%</td>
            </tr>
        `).join('');
        
        currentFlips = flips;
    } catch (error) {
        console.error('Error loading flips:', error);
        document.getElementById('flipsBody').innerHTML = '<tr><td colspan="7">Error cargando datos</td></tr>';
    }
}

// Filtrar flips
function filterFlips() {
    const searchTerm = document.getElementById('flipsSearch').value.toLowerCase();
    const filtered = currentFlips.filter(flip => flip.item.toLowerCase().includes(searchTerm));
    
    const tbody = document.getElementById('flipsBody');
    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7">No se encontraron resultados</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(flip => `
        <tr>
            <td><strong>${flip.item}</strong></td>
            <td>${flip.buy_city}</td>
            <td>${formatNumber(flip.buy_price)}</td>
            <td>${flip.sell_city}</td>
            <td>${formatNumber(flip.sell_price)}</td>
            <td class="profit-positive">+${formatNumber(flip.profit)}</td>
            <td class="profit-positive">${flip.margin}%</td>
        </tr>
    `).join('');
}

// Cargar ciudades
async function loadCities() {
    try {
        const response = await fetch(`${API_URL}/api/cities`);
        const data = await response.json();
        
        const grid = document.getElementById('citiesGrid');
        grid.innerHTML = data.cities.map(city => `
            <div class="city-card">
                <span class="city-name">${city}</span>
                <span class="city-bonus">${data.bonuses[city] || 'Sin bonus'}</span>
            </div>
        `).join('');
        
        currentCities = data.cities;
    } catch (error) {
        console.error('Error loading cities:', error);
        document.getElementById('citiesGrid').innerHTML = '<div class="loading">Error cargando ciudades</div>';
    }
}

// Buscar precios
async function searchPrices() {
    const itemId = document.getElementById('itemSearch').value.trim().toUpperCase();
    if (!itemId) return;
    
    const resultDiv = document.getElementById('pricesResult');
    const title = document.getElementById('resultItemTitle');
    const tbody = document.getElementById('pricesBody');
    
    resultDiv.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Buscando...</td></tr>';
    resultDiv.style.display = 'block';
    
    try {
        const response = await fetch(`${API_URL}/api/prices/${itemId}`);
        if (!response.ok) throw new Error('Item no encontrado');
        
        const data = await response.json();
        title.textContent = `📦 ${data.item_id}`;
        
        if (!data.prices.length) {
            tbody.innerHTML = '<tr><td colspan="4">No hay precios disponibles</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.prices.map(price => `
            <tr>
                <td><strong>${price.city}</strong></td>
                <td>${formatNumber(price.sell_price_min)}</td>
                <td>${formatNumber(price.buy_price_max)}</td>
                <td><small>${price.updated_at ? new Date(price.updated_at).toLocaleTimeString() : '-'}</small></td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error searching prices:', error);
        tbody.innerHTML = `<tr><td colspan="4">Error: Item "${itemId}" no encontrado</td></tr>`;
    }
}

// Buscar crafting
async function searchCrafting() {
    const itemId = document.getElementById('craftingSearch').value.trim().toUpperCase();
    if (!itemId) return;
    
    const resultDiv = document.getElementById('craftingResult');
    const content = document.getElementById('craftingContent');
    
    resultDiv.style.display = 'none';
    content.innerHTML = '<div class="loading">Analizando...</div>';
    resultDiv.style.display = 'block';
    
    try {
        const response = await fetch(`${API_URL}/api/crafting/${itemId}`);
        if (!response.ok) throw new Error('Item no encontrado o no crafteable');
        
        const data = await response.json();
        
        if (!data.opportunities.length) {
            content.innerHTML = '<div class="loading">No hay oportunidades de crafting para este item</div>';
            return;
        }
        
        content.innerHTML = `
            <div class="result-card">
                <h4>🔨 ${data.item_id}</h4>
                <div class="result-detail">
                    <div class="detail-item"><span class="detail-label">Tiempo de crafteo</span><span class="detail-value">${data.crafting_time} seg</span></div>
                </div>
            </div>
            ${data.opportunities.map(opp => `
                <div class="result-card">
                    <h4>📍 ${opp.city}</h4>
                    <div class="result-detail">
                        <div class="detail-item"><span class="detail-label">Bonificación</span><span class="detail-value">${opp.bonus}%</span></div>
                        <div class="detail-item"><span class="detail-label">Costo materiales</span><span class="detail-value">${formatNumber(opp.craft_cost)}</span></div>
                        <div class="detail-item"><span class="detail-label">Precio venta</span><span class="detail-value">${formatNumber(opp.sell_price)}</span></div>
                        <div class="detail-item"><span class="detail-label">Beneficio</span><span class="detail-value profit-positive">+${formatNumber(opp.profit)}</span></div>
                        <div class="detail-item"><span class="detail-label">Margen</span><span class="detail-value profit-positive">${opp.margin}%</span></div>
                    </div>
                    <div class="materials-list">
                        <h5>📋 Materiales necesarios:</h5>
                        ${opp.materials.map(m => `
                            <div class="material-item">
                                <span>${m.name}</span>
                                <span>${m.quantity} x ${formatNumber(m.price)} = ${formatNumber(m.quantity * m.price)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
        
    } catch (error) {
        console.error('Error searching crafting:', error);
        content.innerHTML = `<div class="loading">Error: Item "${itemId}" no es crafteable o no existe</div>`;
    }
}

// Buscar refinado
async function searchRefining() {
    const itemId = document.getElementById('refiningSearch').value.trim().toUpperCase();
    if (!itemId) return;
    
    const resultDiv = document.getElementById('refiningResult');
    const content = document.getElementById('refiningContent');
    
    resultDiv.style.display = 'none';
    content.innerHTML = '<div class="loading">Analizando...</div>';
    resultDiv.style.display = 'block';
    
    try {
        const response = await fetch(`${API_URL}/api/refining/${itemId}`);
        if (!response.ok) throw new Error('Item no encontrado o no refinable');
        
        const data = await response.json();
        
        if (!data.opportunities.length) {
            content.innerHTML = '<div class="loading">No hay oportunidades de refinado para este item</div>';
            return;
        }
        
        content.innerHTML = data.opportunities.map(opp => `
            <div class="result-card">
                <h4>📍 ${opp.city} ${opp.focus ? '✨ CON FOCUS' : '🏭 SIN FOCUS'}</h4>
                <div class="result-detail">
                    <div class="detail-item"><span class="detail-label">Return rate</span><span class="detail-value">${opp.return_rate}%</span></div>
                    <div class="detail-item"><span class="detail-label">Costo efectivo</span><span class="detail-value">${formatNumber(opp.effective_cost)}</span></div>
                    <div class="detail-item"><span class="detail-label">Precio venta</span><span class="detail-value">${formatNumber(opp.sell_price)}</span></div>
                    <div class="detail-item"><span class="detail-label">Beneficio</span><span class="detail-value profit-positive">+${formatNumber(opp.profit)}</span></div>
                    <div class="detail-item"><span class="detail-label">Margen</span><span class="detail-value profit-positive">${opp.margin}%</span></div>
                </div>
                <div class="materials-list">
                    <h5>📋 Materiales por unidad:</h5>
                    ${opp.materials.map(m => `
                        <div class="material-item">
                            <span>${m.name}</span>
                            <span>${m.quantity} x ${formatNumber(m.price)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error searching refining:', error);
        content.innerHTML = `<div class="loading">Error: Item "${itemId}" no es refinable o no existe</div>`;
    }
}

// Cargar sugerencias
async function loadSuggestions() {
    const query = document.getElementById('itemSearch').value;
    if (query.length < 2) return;
    
    try {
        const response = await fetch(`${API_URL}/api/search?q=${query}`);
        const data = await response.json();
        
        const datalist = document.getElementById('itemSuggestions');
        datalist.innerHTML = data.results.map(item => `<option value="${item}">`).join('');
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

// Formatear números
function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('es-ES');
}