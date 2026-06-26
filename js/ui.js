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
    
    totalExpenseEl.textContent = Utils.formatCurrency(totalExpense);
    
    const estimatedSaving = budget * 0.10;
    estimatedSavingEl.textContent = Utils.formatCurrency(estimatedSaving);
    
    const finalPay = budget - totalExpense;
    finalPayEl.textContent = Utils.formatCurrency(finalPay);
};

UI.renderComparisonTable = function(currentData, products) {
    const resultsDiv = document.getElementById('comparisonResults');
    resultsDiv.innerHTML = '';
    
    const markets = Object.keys(currentData);
    if (markets.length === 0) return;
    
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
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    currentData[markets[0]].items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return;
        
        tableHTML += `
            <tr>
                <td>${Utils.sanitize(product.name)}</td>
                <td>${product.category}</td>
                <td>${product.quantity}</td>
        `;
        
        markets.forEach(market => {
            const marketItem = currentData[market].items.find(mi => mi.productId === item.productId);
            const unitPrice = marketItem ? marketItem.unitPrice : 0;
            const totalPrice = marketItem ? marketItem.totalPrice : 0;
            
            const isBestPrice = isBestPriceInCategory(item.productId, product.category, currentData);
            
            tableHTML += `
                <td class="${isBestPrice ? 'best-price' : ''}">${Utils.formatCurrency(totalPrice)}</td>
            `;
        });
        
        tableHTML += '</tr>';
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    resultsDiv.innerHTML = tableHTML;
};

UI.renderChart = function(currentData) {
    const ctx = document.getElementById('distributionChart').getContext('2d');
    
    const markets = Object.keys(currentData);
    const data = {
        labels: markets,
        datasets: [{
            label: 'Gasto por Mercado',
            data: markets.map(m => currentData[m].subtotal),
            backgroundColor: [
                'rgba(34, 197, 94, 0.7)',
                'rgba(59, 130, 246, 0.7)',
                'rgba(234, 179, 8, 0.7)',
                'rgba(239, 68, 68, 0.7)'
            ],
            borderColor: [
                'rgba(34, 197, 94, 1)',
                'rgba(59, 130, 246, 1)',
                'rgba(234, 179, 8, 1)',
                'rgba(239, 68, 68, 1)'
            ],
            borderWidth: 1
        }]
    };
    
    if (window.chartInstance) {
        window.chartInstance.destroy();
    }
    
    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total Gastado ($)' }
                }
            }
        }
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

UI.initMap = function(userLocation, nearbyShops) {
    // Si ya existe un mapa, lo removemos para evitar errores de rebote de inicialización
    if (this.mapInstance) {
        this.mapInstance.remove();
    }
    
    // Centrar mapa en la ubicación del usuario
    this.mapInstance = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(this.mapInstance);
    
    // 1. Marcador del Usuario Azul
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>',
        iconSize: [16, 16]
    });
    
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(this.mapInstance)
        .bindPopup('<b>📍 Estás Aquí</b>')
        .openPopup();
    
    // 2. Dibujar anillo de Geocerca de 7 KM
    L.circle([userLocation.lat, userLocation.lng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        radius: 7000 // Metros
    }).addTo(this.mapInstance);
    
    // 3. Renderizar Locales Filtrados dentro del rango
    nearbyShops.forEach(shop => {
        L.marker([shop.lat, shop.lng])
            .addTo(this.mapInstance)
            .bindPopup(`
                <div style="font-family: 'Inter', sans-serif;">
                    <strong style="color: var(--text-main);">${shop.name}</strong><br>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${shop.address}</span><br>
                    <span style="display: inline-block; margin-top: 5px; font-weight: 600; color: var(--primary-dark);">🚗 A ${shop.distance} km de distancia</span>
                </div>
            `);
    });
};