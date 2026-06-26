// ui.js - User Interface Module

const UI = {};

function isBestPriceInCategory(productId, category, comparisonData) {
    const markets = Object.keys(comparisonData);
    if (markets.length === 0) return false;
    
    const defaultMarket = markets[0];
    const productItems = [];
    
    markets.forEach(market => {
        const item = comparisonData[market].items.find(i => i.productId === productId);
        if (item) {
            productItems.push({
                market: market,
                totalPrice: item.totalPrice
            });
        }
    });
    
    if (productItems.length === 0) return false;
    
    productItems.sort((a, b) => a.totalPrice - b.totalPrice);
    return productItems[0].market === defaultMarket;
}

UI.renderProductsList = function(products, onDeleteCallback) {
    const listElement = document.getElementById('productsList');
    listElement.innerHTML = '';
    
    products.forEach(product => {
        const li = document.createElement('li');
        li.className = 'product-item';
        li.innerHTML = `
            <div class="info">
                <span class="title">${Utils.sanitize(product.name)}</span>
                <span class="meta">${product.category} - Cantidad: ${product.quantity}</span>
            </div>
            <button class="btn-delete" data-id="${product.id}" title="Eliminar">×</button>
        `;
        listElement.appendChild(li);
    });
    
    listElement.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', () => {
            const productId = button.getAttribute('data-id');
            onDeleteCallback(productId);
        });
    });
};

UI.renderMetrics = function(totalExpense, budget) {
    const totalExpenseEl = document.getElementById('totalExpense');
    const estimatedSavingEl = document.getElementById('estimatedSaving');
    const finalPayEl = document.getElementById('finalPay');
    const budgetDisplayEl = document.getElementById('budgetDisplay');
    const balanceEl = document.getElementById('balanceAmount');
    const savingTargetEl = document.getElementById('savingTargetAmount');

    const savingTarget = budget * 0.10;
    const balance = budget - totalExpense;

    totalExpenseEl.textContent = Utils.formatCurrency(totalExpense);
    estimatedSavingEl.textContent = Utils.formatCurrency(savingTarget);
    finalPayEl.textContent = Utils.formatCurrency(balance);

    if (budgetDisplayEl) budgetDisplayEl.textContent = Utils.formatCurrency(budget);
    if (balanceEl) balanceEl.textContent = Utils.formatCurrency(balance);
    if (savingTargetEl) savingTargetEl.textContent = Utils.formatCurrency(savingTarget);

    const cardSaldo = document.getElementById('cardSaldo');
    if (cardSaldo) {
        if (balance < 0) {
            cardSaldo.classList.add('negative');
        } else {
            cardSaldo.classList.remove('negative');
        }
    }
};

UI.renderComparisonTable = function(currentData, products, onSelect) {
    const resultsDiv = document.getElementById('comparisonResults');
    resultsDiv.innerHTML = '';

    const markets = Object.keys(currentData);
    if (markets.length === 0) return;

    const cheapestInfo = DataStorage.getCheapestForEachProduct();

    let tableHTML = `
        <table class="table-res">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Cantidad</th>
    `;

    markets.forEach(market => {
        tableHTML += `<th>${market}</th>`;
    });

    tableHTML += `<th>Seleccionar</th>`;

    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;

    currentData[markets[0]].items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;

        const cheapest = cheapestInfo.find(c => c.product.id === item.productId);
        const cheapestMarket = cheapest ? cheapest.cheapest.market : null;
        const cheapestPrice = cheapest ? cheapest.cheapest.totalPrice : Infinity;

        tableHTML += `
            <tr>
                <td>${Utils.sanitize(product.name)}</td>
                <td>${product.category}</td>
                <td>${product.quantity}</td>
        `;

        markets.forEach(market => {
            const marketItem = currentData[market].items.find(mi => mi.productId === item.productId);
            const totalPrice = marketItem ? marketItem.totalPrice : 0;
            const isCheapest = market === cheapestMarket;

            tableHTML += `
                <td class="${isCheapest ? 'cheapest-price' : ''}">
                    ${Utils.formatCurrency(totalPrice)}
                    ${isCheapest ? '<span class="cheapest-badge">✓ Mejor</span>' : ''}
                </td>
            `;
        });

        const selectedMarket = DataStorage.getSelectedMarket(item.productId);
        tableHTML += `
                <td class="select-cell">
        `;

        markets.forEach(market => {
            const marketItem = currentData[market].items.find(mi => mi.productId === item.productId);
            if (!marketItem) return;
            const isSelected = selectedMarket === market;
            tableHTML += `
                <button class="btn-select ${isSelected ? 'selected' : ''}"
                        data-product-id="${item.productId}"
                        data-market="${market}"
                        data-unit-price="${marketItem.unitPrice}"
                        data-total-price="${marketItem.totalPrice}"
                        title="${isSelected ? 'Seleccionado en ' + market : 'Seleccionar en ' + market}">
                    ${isSelected ? '✓' : market.substring(0, 3)}
                </button>
            `;
        });

        tableHTML += `</td></tr>`;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    resultsDiv.innerHTML = tableHTML;

    if (onSelect) {
        resultsDiv.querySelectorAll('.btn-select').forEach(btn => {
            btn.addEventListener('click', () => {
                const productId = btn.dataset.productId;
                const market = btn.dataset.market;
                const unitPrice = parseFloat(btn.dataset.unitPrice);
                const totalPrice = parseFloat(btn.dataset.totalPrice);
                onSelect(productId, market, unitPrice, totalPrice);
            });
        });
    }
};

UI.renderChart = function(currentData) {
    const ctx = document.getElementById('distributionChart').getContext('2d');
    if (!ctx) return;

    const markets = Object.keys(currentData);
    const hasData = markets.some(m => currentData[m].subtotal > 0);

    const barColors = [
        { bg: 'rgba(34, 197, 94, 0.8)', border: '#22c55e', hoverBg: 'rgba(34, 197, 94, 1)' },
        { bg: 'rgba(59, 130, 246, 0.8)', border: '#3b82f6', hoverBg: 'rgba(59, 130, 246, 1)' },
        { bg: 'rgba(234, 179, 8, 0.8)', border: '#eab308', hoverBg: 'rgba(234, 179, 8, 1)' },
        { bg: 'rgba(239, 68, 68, 0.8)', border: '#ef4444', hoverBg: 'rgba(239, 68, 68, 1)' }
    ];

    if (window.chartInstance) {
        window.chartInstance.destroy();
    }

    const zoomPlugin = {
        id: 'barZoom',
        beforeDraw(chart) {
            const ctx2 = chart.ctx;
            chart.getDatasetMeta(0).data.forEach((bar, index) => {
                if (bar.active) {
                    ctx2.save();
                    ctx2.shadowColor = 'rgba(0,0,0,0.15)';
                    ctx2.shadowBlur = 12;
                    ctx2.shadowOffsetY = 4;
                    ctx2.restore();
                }
            });
        }
    };

    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: markets,
            datasets: [{
                label: 'Gasto por Mercado',
                data: markets.map(m => currentData[m].subtotal),
                backgroundColor: markets.map((_, i) => barColors[i % barColors.length].bg),
                borderColor: markets.map((_, i) => barColors[i % barColors.length].border),
                borderWidth: 1,
                hoverBackgroundColor: markets.map((_, i) => barColors[i % barColors.length].hoverBg),
                hoverBorderWidth: 2,
                hoverBorderColor: markets.map((_, i) => barColors[i % barColors.length].border)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
            hover: {
                mode: 'index',
                intersect: false,
                animationDuration: 200
            },
            onHover: (event, elements) => {
                event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { weight: '600' },
                    bodyFont: { size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const market = context.label;
                            const items = currentData[market]?.items || [];
                            const productCount = items.length;
                            return [
                                `Total: ${Utils.formatCurrency(context.parsed.y)}`,
                                `Productos: ${productCount}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => Utils.formatCurrency(value)
                    },
                    title: { display: true, text: 'Total Gastado ($)', color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { weight: '600' }
                    }
                }
            },
            layout: {
                padding: { top: 10, bottom: 5 }
            }
        },
        plugins: hasData ? [zoomPlugin] : []
    });
};

UI.showErrors = function(errors) {
    const errorContainer = document.querySelectorAll('.error-msg');
    errorContainer.forEach(el => el.style.display = 'none');
    
    Object.keys(errors).forEach(key => {
        const errorEl = document.getElementById(`error-${key}`);
        if (errorEl) {
            errorEl.textContent = errors[key];
            errorEl.style.display = 'block';
        }
    });
};

UI.clearErrors = function() {
    const errorContainer = document.querySelectorAll('.error-msg');
    errorContainer.forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });
};

UI.updateSavingsMetrics = function() {
    const savingsData = DataStorage.state.savingsRecommendations;
    const nonEssentialItems = DataStorage.state.nonEssentialSuggestions;
    const monthlyRecords = DataStorage.state.monthlyRecords;
    
    const monthlyBudgetEl = document.getElementById('monthlyBudget');
    const recommendedSavingsEl = document.getElementById('recommendedSavings');
    const bestOfferEl = document.getElementById('bestOffer');
    
    if (monthlyBudgetEl && DataStorage.state.budget > 0) {
        monthlyBudgetEl.textContent = Utils.formatCurrency(DataStorage.state.budget);
    }
    
    if (recommendedSavingsEl && DataStorage.state.budget > 0) {
        const recommendedSavings = DataStorage.state.budget * 0.10;
        recommendedSavingsEl.textContent = Utils.formatCurrency(recommendedSavings);
    }
    
    if (bestOfferEl && savingsData) {
        const bestOffer = DataStorage.findBestPricesForCategory(
            Object.keys(savingsData), 
            Object.keys(savingsData)[0] || 'Jumbo'
        );
        
        const totalSavings = Object.values(bestOffer).reduce((sum, item) => {
            return sum + (item.difference || 0);
        }, 0);
        
        bestOfferEl.textContent = Utils.formatCurrency(totalSavings);
    }
    
    UI.renderNonEssentialSuggestionsUI(nonEssentialItems);
    UI.renderMonthlyRecordsUI(monthlyRecords);
};

UI.renderNonEssentialSuggestionsUI = function(items) {
    const listElement = document.getElementById('nonEssentialList');
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (items.length === 0) {
        listElement.innerHTML = '<p class="text-muted">No hay sugerencias de productos no esenciales en este momento.</p>';
        return;
    }
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'product-item';
        
        const product = item.product;
        const bestPrice = item.bestPrice;
        const bestMarket = item.bestMarket;
        const suggestion = item.suggestion;
        
        li.innerHTML = `
            <div class="info">
                <span class="title">${Utils.sanitize(product.name)}</span>
                <span class="meta">${product.category} - Encontrado en ${bestMarket} por $${bestPrice}</span>
            </div>
            <div class="suggestion">
                <span class="icon">💡</span>
                <span>${Utils.sanitize(suggestion)}</span>
            </div>
        `;
        listElement.appendChild(li);
    });
};

UI.renderMonthlyRecordsUI = function(records) {
    const recordsElement = document.getElementById('monthlyRecords');
    if (!recordsElement) return;
    
    recordsElement.innerHTML = '';
    
    if (records.length === 0) {
        recordsElement.innerHTML = '<p class="text-muted">No hay registros mensuales disponibles aún.</p>';
        return;
    }
    
    records.slice(-3).reverse().forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'metric-card shadow-sm';
        recordDiv.innerHTML = `
            <h4>${Utils.sanitize(record.month)}</h4>
            <div class="metrics-mini">
                <div>
                    <span class="label">Presupuesto:</span>
                    <span class="value">${Utils.formatCurrency(record.budget)}</span>
                </div>
                <div>
                    <span class="label">Gastado:</span>
                    <span class="value">${Utils.formatCurrency(record.actualSpending)}</span>
                </div>
                <div>
                    <span class="label">Ahorrado:</span>
                    <span class="value highlight-green">${Utils.formatCurrency(record.savingsAchieved)}</span>
                </div>
            </div>
        `;
        recordsElement.appendChild(recordDiv);
    });
};

UI.renderLocationSearch = function(onLocationSelected) {
    if (document.querySelector('.location-search-panel')) return;

    const mapPanel = document.querySelector('.panel-map');
    if (!mapPanel) return;

    const searchContainer = document.createElement('div');
    searchContainer.className = 'location-search-panel';
    searchContainer.innerHTML = `
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center;">
            <input type="text" id="locationSearchInput" placeholder="Ej: Santiago Centro, Las Condes, Providencia..."
                   style="flex: 1; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-family: inherit;">
            <button id="btnSearchLocation" class="btn btn-secondary" style="width: auto; padding: 0.75rem 1.5rem; flex-shrink: 0;">Buscar</button>
            <button id="btnUseMyLocation" class="btn" style="width: auto; padding: 0.75rem 1.5rem; flex-shrink: 0; background: #eee;">
                📍 Mi Ubicación
            </button>
        </div>
        <div id="locationStatus" style="font-size: 0.85rem; color: var(--text-muted);"></div>
    `;

    mapPanel.insertBefore(searchContainer, mapPanel.querySelector('#map'));

    document.getElementById('btnSearchLocation').addEventListener('click', async () => {
        const input = document.getElementById('locationSearchInput');
        const status = document.getElementById('locationStatus');
        const query = input.value.trim();
        if (!query) return;
        status.textContent = 'Buscando ubicación...';
        if (typeof GoogleMapsAPI !== 'undefined' && GoogleMapsAPI.loaded) {
            try {
                const result = await GoogleMapsAPI.geocode(query);
                status.textContent = `📍 ${result.formattedAddress}`;
                if (onLocationSelected) onLocationSelected(result);
            } catch (e) {
                status.textContent = 'Error al buscar dirección. Usando localización por defecto.';
                console.warn('Geocode error:', e);
            }
        } else {
            status.textContent = 'API de Google Maps no disponible. Usando datos locales.';
        }
    });

    document.getElementById('btnUseMyLocation').addEventListener('click', () => {
        const status = document.getElementById('locationStatus');
        if (!navigator.geolocation) {
            status.textContent = 'Geolocalización no soportada.';
            return;
        }
        status.textContent = 'Obteniendo ubicación...';
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                status.textContent = '📍 Usando tu ubicación actual';
                if (onLocationSelected) onLocationSelected(loc);
            },
            () => {
                status.textContent = 'Permiso denegado. Usando ubicación por defecto.';
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
};

UI.renderMarketOrganization = function() {
    const container = document.getElementById('marketOrganization');
    if (!container) return;

    const marketLists = DataStorage.getMarketLists();
    const markets = Object.keys(marketLists);

    container.innerHTML = '';

    if (markets.length === 0) {
        container.innerHTML = '<p class="text-muted">Selecciona productos en la tabla de comparación para organizarlos por supermercado.</p>';
        return;
    }

    markets.forEach(market => {
        const items = marketLists[market];
        const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);

        const card = document.createElement('div');
        card.className = 'market-card';
        card.innerHTML = `
            <div class="market-card-header">
                <h4>${market}</h4>
                <span class="market-total">Total: ${Utils.formatCurrency(subtotal)}</span>
            </div>
            <ul class="market-items">
                ${items.map(item => {
                    const product = DataStorage.state.products.find(p => p.id === item.productId);
                    return product ? `
                        <li class="market-item">
                            <span class="market-item-name">${Utils.sanitize(product.name)}</span>
                            <span class="market-item-qty">x${product.quantity}</span>
                            <span class="market-item-price">${Utils.formatCurrency(item.totalPrice)}</span>
                        </li>
                    ` : '';
                }).join('')}
            </ul>
        `;
        container.appendChild(card);
    });

    const grandTotal = Object.values(marketLists).flat().reduce((sum, i) => sum + i.totalPrice, 0);
    const grandTotalEl = document.createElement('div');
    grandTotalEl.className = 'market-grand-total';
    grandTotalEl.innerHTML = `
        <strong>Total General:</strong> ${Utils.formatCurrency(grandTotal)}
        <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 1rem;">
            (${markets.length} supermercados)
        </span>
    `;
    container.appendChild(grandTotalEl);
};

UI.renderBalanceSummary = function() {
    const container = document.getElementById('balanceSummary');
    if (!container) return;

    const budget = DataStorage.state.budget;
    const selectedSubtotal = DataStorage.getSelectedSubtotal();
    const remaining = budget - selectedSubtotal;
    const savingTarget = budget * 0.10;

    container.innerHTML =
        (remaining < 0 ? '<div class="alert-warning">⚠️ Has excedido tu presupuesto mensual en ' + Utils.formatCurrency(Math.abs(remaining)) + '.</div>' : '') +
        (budget > 0 && selectedSubtotal > 0 && remaining >= savingTarget ? '<div class="alert-success">✅ Estás dentro de tu presupuesto. Puedes ahorrar el 10% (' + Utils.formatCurrency(savingTarget) + ').</div>' : '') +
        (budget > 0 && selectedSubtotal > 0 && remaining < savingTarget && remaining >= 0 ? '<div class="alert-info">💡 Tu saldo es positivo pero no alcanza la meta de ahorro del 10%.</div>' : '');
};

UI.renderSavingsRecommendations = function() {
    if (document.querySelector('.savings-recommendations')) return;
    
    const savingsContainer = document.createElement('div');
    savingsContainer.className = 'savings-recommendations';
    savingsContainer.innerHTML = `
        <div class="panel">
            <h2><span class="icon">💰</span> Sugerencias de Ahorro</h2>
            <div class="savings-metrics">
                <div class="metric-card shadow-sm highlight-green">
                    <h3>Presupuesto Mensual</h3>
                    <p class="metric-value" id="monthlyBudget">$0</p>
                </div>
                <div class="metric-card shadow-sm">
                    <h3>Ahorro Recomendado (10%)</h3>
                    <p class="metric-value" id="recommendedSavings">$0</p>
                </div>
                <div class="metric-card shadow-sm">
                    <h3>Mejor Oferta Encontrada</h3>
                    <p class="metric-value" id="bestOffer">$0</p>
                </div>
            </div>
        </div>
    `;
    
    const dashboard = document.querySelector('.panel-dashboard');
    dashboard.insertBefore(savingsContainer, dashboard.firstChild.nextSibling);
};

UI.renderNonEssentialSuggestions = function() {
    if (document.querySelector('.non-essential-suggestions')) return;
    
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'non-essential-suggestions';
    suggestionsContainer.innerHTML = `
        <div class="panel">
            <h2><span class="icon">⚠️</span> Productos No Esenciales Sugeridos</h2>
            <div class="suggestions-list" id="nonEssentialList">
                <!-- Non-essential suggestions will be populated here -->
            </div>
        </div>
    `;
    
    const dashboard = document.querySelector('.panel-dashboard');
    dashboard.insertBefore(suggestionsContainer, document.querySelector('.chart-container'));
};

UI.renderMonthlyRecords = function() {
    if (document.querySelector('.monthly-records')) return;
    
    const recordsContainer = document.createElement('div');
    recordsContainer.className = 'monthly-records';
    recordsContainer.innerHTML = `
        <div class="panel">
            <h2><span class="icon">📅</span> Registro Mensual</h2>
            <div class="records-timeline" id="monthlyRecords">
                <!-- Monthly records will be populated here -->
            </div>
        </div>
    `;
    
    const dashboard = document.querySelector('.panel-dashboard');
    dashboard.insertBefore(recordsContainer, document.querySelector('.chart-container'));
};

UI.initMap = async function(userLocation, nearbyShops) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    if (this.mapInstance) {
        if (typeof L !== 'undefined' && this.mapInstance instanceof L.Map) {
            this.mapInstance.remove();
        }
        this.mapInstance = null;
    }

    mapContainer.innerHTML = '';

    const useGoogleMaps = typeof GoogleMapsAPI !== 'undefined' && GoogleMapsAPI.loaded && GoogleMapsAPI.map;

    if (useGoogleMaps) {
        try {
            GoogleMapsAPI.initMap('map', userLocation, 13);
            GoogleMapsAPI.addCircle(userLocation, 7000);
            GoogleMapsAPI.addMarker(userLocation, 'Tu Ubicación',
                '<div style="font-family: sans-serif;"><strong>📍 Estás Aquí</strong></div>',
                {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#3b82f6',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 10
                }
            );

            nearbyShops.forEach(shop => {
                const content = `
                    <div style="font-family: 'Inter', sans-serif; line-height: 1.5;">
                        <strong>🏪 ${shop.name}</strong><br>
                        <span style="font-size: 0.85rem; color: #666;">${shop.address || ''}</span><br>
                        <span style="display: inline-block; margin-top: 5px; font-weight: 600; color: #15803d;">
                            🚗 ${shop.distance ? shop.distance.toFixed(2) : '?'} km
                        </span>
                    </div>
                `;
                GoogleMapsAPI.addMarker(
                    { lat: shop.lat, lng: shop.lng },
                    shop.name,
                    content
                );
            });

            this.mapInstance = GoogleMapsAPI.map;
            return;
        } catch (e) {
            console.warn('Google Maps render failed, using Leaflet:', e);
            mapContainer.innerHTML = '';
        }
    }

    if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-muted);">Mapa no disponible. Configura una API key de Google Maps o verifica la conexión a internet.</p>';
        return;
    }

    this.mapInstance = L.map('map').setView([userLocation.lat, userLocation.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(this.mapInstance);

    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>',
        iconSize: [16, 16]
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(this.mapInstance)
        .bindPopup('<b>📍 Estás Aquí</b>')
        .openPopup();

    L.circle([userLocation.lat, userLocation.lng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        radius: 7000
    }).addTo(this.mapInstance);

    nearbyShops.forEach(shop => {
        L.marker([shop.lat, shop.lng])
            .addTo(this.mapInstance)
            .bindPopup(`
                <div style="font-family: 'Inter', sans-serif;">
                    <strong>${shop.name}</strong><br>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${shop.address || ''}</span><br>
                    <span style="display: inline-block; margin-top: 5px; font-weight: 600; color: var(--primary-dark);">🚗 ${shop.distance ? shop.distance.toFixed(2) : '?'} km</span>
                </div>
            `);
    });
};