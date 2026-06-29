/**
 * dashboard.js - Page Orchestrator for the SmartShop Dashboard.
 * Manages core state, event handling, and synchronization between services and UI components.
 */

import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { supermarketService } from '../services/supermarketService.js';
import { mapsService } from '../services/mapsService.js';
import { pricePredictionService } from '../services/pricePredictionService.js';
import { savingService } from '../services/savingService.js';

import { DashboardCards } from '../components/DashboardCards.js';
import { Autocomplete } from '../components/Autocomplete.js';
import { ComparisonTable } from '../components/ComparisonTable.js';
import { MapComponent } from '../components/MapComponent.js';
import { SavingsChart } from '../components/SavingsChart.js';

import { sanitize, formatCurrency } from '../utils/helpers.js';

// Global state orchestrator
const state = {
    products: [],
    budget: 0,
    userLocation: null,
    selectedItems: [], // { productId, market, unitPrice, totalPrice }
    comparisons: {}
};

// Event emitter to communicate changes to components
const emitter = document.createElement('div');

export const Dashboard = {
    async init() {
        console.log('Inicializando Dashboard...');
        
        // 1. Load basic state from storage
        state.products = useLocalStorage.getItem('smartshop_products', []);
        state.budget = useLocalStorage.getItem('smartshop_budget', 0);
        state.selectedItems = useLocalStorage.getItem('smartshop_selections', []);
        
        // Set budget input value
        const budgetInput = document.getElementById('budgetInput');
        if (budgetInput && state.budget > 0) {
            budgetInput.value = state.budget;
        }

        // 2. Initialize Geolocation
        state.userLocation = useLocalStorage.getItem('smartshop_user_location', null);
        if (!state.userLocation) {
            state.userLocation = await useGeolocation.getCurrentPosition();
            useLocalStorage.setItem('smartshop_user_location', state.userLocation);
        }

        // 3. Initialize historical records if empty
        savingService.initializeHistoricalRecordsIfEmpty();

        // 4. Initialize Autocomplete search
        Autocomplete.init('productName', 'productsList', {
            onGetProducts: () => state.products,
            onSelect: (name) => {
                // Focus quantity input for speed
                const quantityInput = document.getElementById('productQuantity');
                if (quantityInput) quantityInput.focus();
            },
            onAddProduct: (name) => {
                this.addProduct(name, 1);
            },
            emitter: emitter
        });

        // 4. Attach general UI event listeners
        this.setupEventListeners();

        // 5. Run initial state refresh
        this.refresh();
    },

    setupEventListeners() {
        // Product form submission
        const form = document.getElementById('productForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('productName');
                const quantityInput = document.getElementById('productQuantity');
                
                const name = nameInput.value.trim();
                const qty = parseInt(quantityInput.value, 10);

                if (name.length < 3) {
                    alert('El nombre del producto debe tener al menos 3 caracteres.');
                    return;
                }
                if (isNaN(qty) || qty < 1) {
                    alert('La cantidad debe ser mayor o igual a 1.');
                    return;
                }

                this.addProduct(name, qty);
                
                // Reset form
                nameInput.value = '';
                quantityInput.value = '1';
                nameInput.focus();
            });
        }

        // Budget changes
        const budgetInput = document.getElementById('budgetInput');
        if (budgetInput) {
            budgetInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                state.budget = val;
                useLocalStorage.setItem('smartshop_budget', val);
                this.refresh();
            });
        }

        // Compare button trigger
        const btnCompare = document.getElementById('btnCompare');
        if (btnCompare) {
            btnCompare.addEventListener('click', () => {
                if (state.products.length === 0) {
                    alert('Agrega algunos productos a tu lista primero.');
                    return;
                }
                this.refresh();
            });
        }

        // Setup Location Search input triggers
        const mapStatus = document.getElementById('mapStatus');
        
        // Add geocoding handlers to location inputs
        const btnSearchLoc = document.getElementById('btnSearchLocation');
        const btnUseMyLoc = document.getElementById('btnUseMyLocation');
        const locInput = document.getElementById('locationSearchInput');

        if (btnSearchLoc && locInput) {
            btnSearchLoc.addEventListener('click', async () => {
                const query = locInput.value.trim();
                if (!query) return;
                if (mapStatus) mapStatus.textContent = 'Buscando ubicación...';
                try {
                    const results = await mapsService.geocodeAddress(query);
                    if (results && results.length > 0) {
                        const topLoc = results[0];
                        state.userLocation = { lat: topLoc.lat, lng: topLoc.lng };
                        useLocalStorage.setItem('smartshop_user_location', state.userLocation);
                        if (mapStatus) mapStatus.textContent = `📍 ${topLoc.formattedAddress}`;
                        this.refresh();
                    }
                } catch (e) {
                    if (mapStatus) mapStatus.textContent = 'No se encontró la dirección. Intenta de nuevo.';
                }
            });
        }

        if (btnUseMyLoc) {
            btnUseMyLoc.addEventListener('click', async () => {
                if (mapStatus) mapStatus.textContent = 'Obteniendo ubicación GPS...';
                const loc = await useGeolocation.getCurrentPosition();
                state.userLocation = loc;
                useLocalStorage.setItem('smartshop_user_location', loc);
                if (mapStatus) mapStatus.textContent = '📍 Usando tu ubicación actual';
                this.refresh();
            });
        }
    },

    addProduct(name, quantity) {
        const product = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name: sanitize(name),
            quantity
        };
        state.products.push(product);
        useLocalStorage.setItem('smartshop_products', state.products);
        
        // Notify components
        emitter.dispatchEvent(new Event('listChanged'));
        
        this.refresh();
    },

    deleteProduct(id) {
        state.products = state.products.filter(p => p.id !== id);
        useLocalStorage.setItem('smartshop_products', state.products);

        // Also clean selection for this product
        state.selectedItems = state.selectedItems.filter(item => item.productId !== id);
        useLocalStorage.setItem('smartshop_selections', state.selectedItems);

        // Notify components
        emitter.dispatchEvent(new Event('listChanged'));

        this.refresh();
    },

    selectItem(productId, market, unitPrice, totalPrice) {
        const existingIdx = state.selectedItems.findIndex(item => item.productId === productId);
        
        if (existingIdx >= 0) {
            const currentItem = state.selectedItems[existingIdx];
            // Toggle off selection if clicked again
            if (currentItem.market === market) {
                state.selectedItems.splice(existingIdx, 1);
            } else {
                state.selectedItems[existingIdx] = { productId, market, unitPrice, totalPrice };
            }
        } else {
            state.selectedItems.push({ productId, market, unitPrice, totalPrice });
        }

        useLocalStorage.setItem('smartshop_selections', state.selectedItems);
        this.refresh();
    },

    refresh() {
        // 1. Fetch pricing comparisons from service
        state.comparisons = supermarketService.getPricesForList(state.products);

        // 2. Render Products List (Tu Lista)
        this.renderProductsListUI();

        // 3. Compute Savings Metrics and Render Cards
        const metrics = savingService.calculateSavingsMetrics(state.products, state.comparisons);
        DashboardCards.render(metrics);

        // 4. Render Budget Status Summary
        this.renderBudgetStatusUI();

        // 5. Render Comparison Table
        ComparisonTable.render(state.comparisons, state.products, state.selectedItems, (prodId, market, unitPrice, totalPrice) => {
            this.selectItem(prodId, market, unitPrice, totalPrice);
        });

        // 6. Render Market Organization breakdown
        this.renderMarketOrganizationUI();

        // 7. Update Map
        this.updateMapUI(metrics);

        // 8. Update Projections and Chart
        this.updateChartUI(metrics);
        
        // 9. Update suggestions for non-essential items
        this.updateNonEssentialSuggestionsUI();
    },

    renderProductsListUI() {
        const listElement = document.getElementById('productsList');
        if (!listElement) return;

        listElement.innerHTML = '';
        if (state.products.length === 0) {
            listElement.innerHTML = `<li class="product-item text-muted" style="justify-content: center; font-style: italic;">La lista está vacía</li>`;
            return;
        }

        state.products.forEach(product => {
            const li = document.createElement('li');
            li.className = 'product-item';
            li.innerHTML = `
                <div class="info">
                    <span class="title">${sanitize(product.name)}</span>
                    <span class="meta">Cantidad: ${product.quantity}</span>
                </div>
                <button class="btn-delete" data-id="${product.id}" title="Eliminar">×</button>
            `;

            li.querySelector('.btn-delete').addEventListener('click', () => {
                this.deleteProduct(product.id);
            });

            listElement.appendChild(li);
        });
    },

    renderBudgetStatusUI() {
        const totalExpenseEl = document.getElementById('totalExpense');
        const estimatedSavingEl = document.getElementById('estimatedSaving');
        const finalPayEl = document.getElementById('finalPay');
        const budgetDisplayEl = document.getElementById('budgetDisplay');
        const container = document.getElementById('balanceSummary');

        // Selected subtotal
        const totalSelectedExpense = state.selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        
        // Set basic values
        const savingTarget = state.budget * 0.10;
        const balance = state.budget - totalSelectedExpense;

        if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalSelectedExpense);
        if (estimatedSavingEl) estimatedSavingEl.textContent = formatCurrency(savingTarget);
        if (finalPayEl) finalPayEl.textContent = formatCurrency(balance);
        if (budgetDisplayEl) budgetDisplayEl.textContent = formatCurrency(state.budget);

        const cardSaldo = document.getElementById('cardSaldo');
        if (cardSaldo) {
            if (balance < 0) {
                cardSaldo.classList.add('negative');
            } else {
                cardSaldo.classList.remove('negative');
            }
        }

        // Render HTML status message
        if (container) {
            container.innerHTML = '';
            if (state.budget > 0 && totalSelectedExpense > 0) {
                if (balance < 0) {
                    container.innerHTML = `<div class="alert-warning">⚠️ Has excedido tu presupuesto mensual en ${formatCurrency(Math.abs(balance))}. ¡Considera optimizar tus compras!</div>`;
                } else if (balance >= savingTarget) {
                    container.innerHTML = `<div class="alert-success">✅ ¡Excelente! Estás dentro de tu presupuesto y logras superar tu meta de ahorro del 10% (${formatCurrency(savingTarget)}).</div>`;
                } else {
                    container.innerHTML = `<div class="alert-info">💡 Tu saldo es positivo, pero no alcanzas la meta de ahorro del 10%. Intenta cambiar algunos artículos a tiendas más económicas.</div>`;
                }
            }
        }
    },

    renderMarketOrganizationUI() {
        const container = document.getElementById('marketOrganization');
        if (!container) return;

        container.innerHTML = '';

        // Group selected items by market
        const marketLists = {};
        state.selectedItems.forEach(item => {
            if (!marketLists[item.market]) marketLists[item.market] = [];
            marketLists[item.market].push(item);
        });

        const markets = Object.keys(marketLists);

        if (markets.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align: center; font-style: italic; padding: 1rem 0;">Selecciona productos en la tabla de comparación superior para organizarlos por supermercado.</p>';
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
                    <span class="market-total">Total: ${formatCurrency(subtotal)}</span>
                </div>
                <ul class="market-items">
                    ${items.map(item => {
                        const product = state.products.find(p => p.id === item.productId);
                        return product ? `
                            <li class="market-item">
                                <span class="market-item-name">${sanitize(product.name)}</span>
                                <span class="market-item-qty">x${product.quantity}</span>
                                <span class="market-item-price">${formatCurrency(item.totalPrice)}</span>
                            </li>
                        ` : '';
                    }).join('')}
                </ul>
            `;
            container.appendChild(card);
        });

        const grandTotal = state.selectedItems.reduce((sum, i) => sum + i.totalPrice, 0);
        const grandTotalEl = document.createElement('div');
        grandTotalEl.className = 'market-grand-total';
        grandTotalEl.innerHTML = `
            <strong>Total Seleccionado:</strong> ${formatCurrency(grandTotal)}
            <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 1rem;">
                (${markets.length} supermercados involucrados)
            </span>
        `;
        container.appendChild(grandTotalEl);
    },

    updateMapUI(metrics) {
        const { recommendedSupermarket } = metrics;
        const stores = mapsService.getNearbyStores(state.userLocation.lat, state.userLocation.lng, 7);

        // Fetch savings data per brand
        const savingsData = {};
        Object.keys(state.comparisons).forEach(brand => {
            // Mock simulated savings at this brand based on subtotal compared to highest subtotal
            const maxSubtotal = Math.max(...Object.values(state.comparisons).map(c => c.subtotal));
            const subtotal = state.comparisons[brand].subtotal;
            savingsData[brand] = Math.max(0, maxSubtotal - subtotal);
        });

        MapComponent.init(
            'map',
            state.userLocation,
            stores,
            savingsData,
            recommendedSupermarket,
            (store) => {
                // Focus / handle map supermarket marker click
                console.log('Selected store from map:', store);
            }
        );
    },

    updateChartUI(metrics) {
        const records = useLocalStorage.getItem('smartshop_monthly_records', []);
        
        // Calculate predictions using PricePredictionService
        const prediction = pricePredictionService.predictSavings(
            metrics.estimatedMonthlySaving, 
            records
        );

        // Render simple predictions text in UI
        const projectionText = document.getElementById('projectionPredictionText');
        if (projectionText) {
            projectionText.innerHTML = `
                <div class="prediction-info-box">
                    <p>Si mantienes este patrón de comparación inteligente:</p>
                    <div class="prediction-grid">
                        <div class="pred-item"><span class="pred-lbl">Próximo Mes:</span> <strong class="text-green">${formatCurrency(prediction.nextMonth)}</strong></div>
                        <div class="pred-item"><span class="pred-lbl">En 6 Meses:</span> <strong class="text-green">${formatCurrency(prediction.in6Months)}</strong></div>
                        <div class="pred-item"><span class="pred-lbl">En 12 Meses:</span> <strong class="text-green">${formatCurrency(prediction.in12Months)}</strong></div>
                    </div>
                </div>
            `;
        }

        // Render line chart
        SavingsChart.render(records, prediction);

        // Periodically save monthly values if lists change
        const totalSelectedExpense = state.selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
        if (totalSelectedExpense > 0 && state.budget > 0) {
            savingService.saveMonthlyRecord(state.budget, totalSelectedExpense, metrics.estimatedMonthlySaving);
        }
    },

    updateNonEssentialSuggestionsUI() {
        const container = document.getElementById('nonEssentialList');
        if (!container) return;

        const nonEssentials = savingService.identifyNonEssentialItems(state.products);
        
        if (nonEssentials.length === 0) {
            container.innerHTML = `
                <div class="non-essential-empty">
                    <span class="icon">🥗</span>
                    <p>No se detectaron productos no esenciales en tu lista actual. ¡Vas por buen camino!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = nonEssentials.map(item => `
            <div class="non-essential-card">
                <div class="non-essential-header">
                    <strong>⚠️ ${sanitize(item.name)}</strong>
                    <span class="non-essential-cat-badge">No Esencial</span>
                </div>
                <div class="non-essential-body">
                    <span class="lightbulb-icon">💡</span>
                    <p>${sanitize(item.suggestion)}</p>
                </div>
            </div>
        `).join('');
    }
};
