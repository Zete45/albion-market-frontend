// Configuración
const API_URL = 'https://albion-telegram-bot.onrender.com';
const FETCH_TIMEOUT_MS = 15000; // 15 segundos

// Estado de la aplicación
let currentFlips = [];
let currentCities = [];
let isWakingUp = false;

// ─── UTILIDADES ───────────────────────────────────────────────

// Fetch con timeout para no quedarse cargando eternamente
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timer);
        return response;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error('timeout');
        }
        throw err;
    }
}

// Debounce: evita disparar una función en cada tecla
function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Formatear números
function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('es-ES');
}

// Mostrar banner de "servidor despertando"
function showWakeUpBanner(show) {
    let banner = document.getElementById('wakeUpBanner');
    if (show) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'wakeUpBanner';
            banner.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(255, 140, 0, 0.95); color: #1a1528;
                padding: 12px 24px; border-radius: 12px; font-weight: 600;
                font-size: 0.9rem; z-index: 9999; backdrop-filter: blur(5px);
                box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                animation: fadeIn 0.3s ease;
            `;
            banner.textContent = '⏳ El servidor está iniciando, puede tardar hasta 60 segundos...';
            document.body.appendChild(banner);
        }
    } else {
        if (banner) banner.remove();
    }
}

// ─── INICIALIZACIÓN ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initEventListeners();
    loadDashboardData();

    // Actualizar cada 3 minutos
    setInterval(() => {
        if (getCurrentTab() === 'dashboard') loadDashboardData();
        else if (getCurrentTab() === 'flips') loadFlips();
    }, 180000);
});

// ─── TABS ─────────────────────────────────────────────────────

function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            if (tabId === 'dashboard') loadDashboardData();
            else if (tabId === 'flips') loadFlips();
        });
    });

    document.querySelectorAll('[data-tab-link]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector(`.nav-btn[data-tab="${link.dataset.tabLink}"]`).click();
        });
    });
}

function getCurrentTab() {
    const activeBtn = document.querySelector('.nav-btn.active');
    return activeBtn ? activeBtn.dataset.tab : 'dashboard';
}

// ─── EVENT LISTENERS ──────────────────────────────────────────

function initEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', searchPrices);
    document.getElementById('itemSearch').addEventListener('keypress', e => {
        if (e.key === 'Enter') searchPrices();
    });

    // Debounce: espera 400ms después de que el usuario deje de escribir
    const debouncedSuggestions = debounce(loadSuggestions, 400);
    document.getElementById('itemSearch').addEventListener('input', debouncedSuggestions);

    document.getElementById('craftingBtn').addEventListener('click', searchCrafting);
    document.getElementById('craftingSearch').addEventListener('keypress', e => {
        if (e.key === 'Enter') searchCrafting();
    });

    document.getElementById('refiningBtn').addEventListener('click', searchRefining);
    document.getElementById('refiningSearch').addEventListener('keypress', e => {
        if (e.key === 'Enter') searchRefining();
    });

    document.getElementById('flipsSearch').addEventListener('input', filterFlips);
}

// ─── STATUS ───────────────────────────────────────────────────

async function updateServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    try {
        statusText.textContent = 'Conectando...';
        const response = await fetchWithTimeout(`${API_URL}/api/status`, {}, 20000);

        if (!response.ok) throw new Error('bad response');
        const data = await response.json();

        showWakeUpBanner(false);
        isWakingUp = false;

        if (data.status === 'online') {
            statusDot.classList.add('online');
            statusText.textContent = 'Online';
        } else {
            statusDot.classList.remove('online');
            statusText.textContent = 'Offline';
        }

        if (data.last_scan) {
            document.getElementById('lastUpdate').textContent =
                new Date(data.last_scan).toLocaleTimeString();
        }
        if (data.items_monitored) {
            document.getElementById('totalItems').textContent =
                data.items_monitored.toLocaleString();
        }
        if (data.cities) {
            document.getElementById('totalCities').textContent = data.cities.length;
        }

        return data;
    } catch (error) {
        statusDot.classList.remove('online');

        if (error.message === 'timeout' || error.message === 'Failed to fetch') {
            // Servidor dormido → avisar y reintentar automáticamente
            if (!isWakingUp) {
                isWakingUp = true;
                showWakeUpBanner(true);
                statusText.textContent = 'Iniciando...';
                // Reintentar en 20 segundos
                setTimeout(() => loadDashboardData(), 20000);
            }
        } else {
            statusText.textContent = 'Error';
            showWakeUpBanner(false);
        }
        return null;
    }
}

// ─── DASHBOARD ────────────────────────────────────────────────

async function loadDashboardData() {
    await updateServerStatus();
    await Promise.all([loadBestFlips(), loadCities()]);
}

// ─── FLIPS ────────────────────────────────────────────────────

async function loadBestFlips() {
    const tbody = document.getElementById('bestFlipsBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Cargando...</td></tr>';
    try {
        const response = await fetchWithTimeout(`${API_URL}/api/flips/best`);
        const flips = await response.json();

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
        const msg = error.message === 'timeout'
            ? 'Servidor tardando en responder, reintentando...'
            : 'Error cargando datos';
        tbody.innerHTML = `<tr><td colspan="5">${msg}</td></tr>`;
    }
}

async function loadFlips() {
    const tbody = document.getElementById('flipsBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando...</td></tr>';
    try {
        const response = await fetchWithTimeout(`${API_URL}/api/flips`);
        const data = await response.json();
        const flips = data.flips || [];

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
        const msg = error.message === 'timeout'
            ? 'Servidor tardando, reintentando...'
            : 'Error cargando flips';
        tbody.innerHTML = `<tr><td colspan="7">${msg}</td></tr>`;
    }
}

function filterFlips() {
    const searchTerm = document.getElementById('flipsSearch').value.toLowerCase();
    const filtered = currentFlips.filter(f => f.item.toLowerCase().includes(searchTerm));
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

// ─── CIUDADES ─────────────────────────────────────────────────

async function loadCities() {
    const grid = document.getElementById('citiesGrid');
    grid.innerHTML = '<div class="loading">Cargando...</div>';
    try {
        const response = await fetchWithTimeout(`${API_URL}/api/cities`);
        const data = await response.json();

        grid.innerHTML = data.cities.map(city => `
            <div class="city-card">
                <span class="city-name">${city}</span>
                <span class="city-bonus">${data.bonuses[city] || 'Sin bonus'}</span>
            </div>
        `).join('');

        currentCities = data.cities;
    } catch (error) {
        grid.innerHTML = '<div class="loading">Error cargando ciudades</div>';
    }
}

// ─── PRECIOS ──────────────────────────────────────────────────

async function searchPrices() {
    const itemId = document.getElementById('itemSearch').value.trim().toUpperCase();
    if (!itemId) return;

    const resultDiv = document.getElementById('pricesResult');
    const title = document.getElementById('resultItemTitle');
    const tbody = document.getElementById('pricesBody');

    tbody.innerHTML = '<tr><td colspan="4" class="loading">Buscando...</td></tr>';
    resultDiv.style.display = 'block';

    try {
        const response = await fetchWithTimeout(`${API_URL}/api/prices/${itemId}`);
        if (!response.ok) throw new Error('not_found');

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
        const msg = error.message === 'timeout'
            ? 'Servidor tardando, intenta de nuevo'
            : `Item "${itemId}" no encontrado`;
        tbody.innerHTML = `<tr><td colspan="4">Error: ${msg}</td></tr>`;
    }
}

// ─── CRAFTING ─────────────────────────────────────────────────

async function searchCrafting() {
    const itemId = document.getElementById('craftingSearch').value.trim().toUpperCase();
    if (!itemId) return;

    const resultDiv = document.getElementById('craftingResult');
    const content = document.getElementById('craftingContent');

    content.innerHTML = '<div class="loading">Analizando...</div>';
    resultDiv.style.display = 'block';

    try {
        const response = await fetchWithTimeout(`${API_URL}/api/crafting/${itemId}`);
        if (!response.ok) throw new Error('not_found');

        const data = await response.json();

        if (!data.opportunities.length) {
            content.innerHTML = '<div class="loading">No hay oportunidades de crafting para este item</div>';
            return;
        }

        content.innerHTML = `
            <div class="result-card">
                <h4>🔨 ${data.item_id}</h4>
                <div class="result-detail">
                    <div class="detail-item">
                        <span class="detail-label">Tiempo de crafteo</span>
                        <span class="detail-value">${data.crafting_time} seg</span>
                    </div>
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
        const msg = error.message === 'timeout'
            ? 'Servidor tardando, intenta de nuevo'
            : `Item "${itemId}" no es crafteable o no existe`;
        content.innerHTML = `<div class="loading">Error: ${msg}</div>`;
    }
}

// ─── REFINADO ─────────────────────────────────────────────────

async function searchRefining() {
    const itemId = document.getElementById('refiningSearch').value.trim().toUpperCase();
    if (!itemId) return;

    const resultDiv = document.getElementById('refiningResult');
    const content = document.getElementById('refiningContent');

    content.innerHTML = '<div class="loading">Analizando...</div>';
    resultDiv.style.display = 'block';

    try {
        const response = await fetchWithTimeout(`${API_URL}/api/refining/${itemId}`);
        if (!response.ok) throw new Error('not_found');

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
        const msg = error.message === 'timeout'
            ? 'Servidor tardando, intenta de nuevo'
            : `Item "${itemId}" no es refinable o no existe`;
        content.innerHTML = `<div class="loading">Error: ${msg}</div>`;
    }
}

// ─── SUGERENCIAS (con debounce aplicado arriba) ────────────────

async function loadSuggestions() {
    const query = document.getElementById('itemSearch').value;
    if (query.length < 2) return;

    try {
        const response = await fetchWithTimeout(`${API_URL}/api/search?q=${query}`, {}, 5000);
        const data = await response.json();
        const datalist = document.getElementById('itemSuggestions');
        datalist.innerHTML = data.results.map(item => `<option value="${item}">`).join('');
    } catch (error) {
        // Silencioso — las sugerencias son opcionales
    }
}
