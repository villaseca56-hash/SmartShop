/**
 * ComparisonTable.js - Advanced, responsive comparison table component.
 * Features price highlights, percentage differences, and supermarket recommendations.
 */

import { formatCurrency, sanitize } from '../utils/helpers.js';

export const ComparisonTable = {
    render(comparisonData, products, selectedItems, onSelectCallback) {
        const container = document.getElementById('comparisonResults');
        if (!container) return;

        const supermarkets = Object.keys(comparisonData);
        if (supermarkets.length === 0 || products.length === 0) {
            container.innerHTML = `
                <div class="no-comparison-data">
                    <p>Agrega productos a tu lista y presiona "Buscar Mejores Precios" para ver la comparación.</p>
                </div>
            `;
            return;
        }

        // Helper to find the best (cheapest) store for a specific product
        const getProductPricingDetails = (productId) => {
            let cheapestPrice = Infinity;
            let dearestPrice = -Infinity;
            let cheapestStore = '';
            
            supermarkets.forEach(brand => {
                const item = comparisonData[brand].items.find(i => i.productId === productId);
                if (item) {
                    if (item.totalPrice < cheapestPrice) {
                        cheapestPrice = item.totalPrice;
                        cheapestStore = brand;
                    }
                    if (item.totalPrice > dearestPrice) {
                        dearestPrice = item.totalPrice;
                    }
                }
            });

            const diff = dearestPrice - cheapestPrice;
            const savingsPercentage = dearestPrice > 0 ? Math.round((diff / dearestPrice) * 100) : 0;

            return {
                cheapestPrice,
                dearestPrice,
                cheapestStore,
                savingsPercentage,
                diff
            };
        };

        let tableHtml = `
            <div class="comparison-table-wrapper">
                <table class="table-res">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-center">Cant.</th>
                            ${supermarkets.map(brand => `<th class="text-right">${brand}</th>`).join('')}
                            <th class="text-center">Recomendación</th>
                            <th class="text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        products.forEach(product => {
            const pricing = getProductPricingDetails(product.id);
            const selectedStore = selectedItems.find(item => item.productId === product.id)?.market;

            tableHtml += `
                <tr class="comparison-row">
                    <td class="product-name-cell">
                        <strong>${sanitize(product.name)}</strong>
                    </td>
                    <td class="text-center quantity-cell">${product.quantity}</td>
                    
                    ${supermarkets.map(brand => {
                        const item = comparisonData[brand].items.find(i => i.productId === product.id);
                        const price = item ? item.totalPrice : 0;
                        const isCheapest = brand === pricing.cheapestStore;
                        const isSelected = selectedStore === brand;

                        return `
                            <td class="text-right price-cell ${isCheapest ? 'cheapest-price' : ''} ${isSelected ? 'selected-market-cell' : ''}">
                                <div class="price-val">${formatCurrency(price)}</div>
                                ${isCheapest ? '<span class="cheapest-badge">Mínimo</span>' : ''}
                            </td>
                        `;
                    }).join('')}

                    <td class="text-center recommendation-cell">
                        ${pricing.diff > 0 ? `
                            <span class="recommendation-badge">
                                Compra en <strong>${pricing.cheapestStore}</strong> y ahorra <strong>${pricing.savingsPercentage}%</strong>
                            </span>
                        ` : `
                            <span class="recommendation-stable">Precio único</span>
                        `}
                    </td>

                    <td class="text-center action-cell">
                        <div class="market-select-buttons">
                            ${supermarkets.map(brand => {
                                const item = comparisonData[brand].items.find(i => i.productId === product.id);
                                if (!item) return '';
                                const isSelected = selectedStore === brand;

                                return `
                                    <button class="btn-select ${isSelected ? 'selected' : ''}" 
                                            data-product-id="${product.id}" 
                                            data-market="${brand}"
                                            data-unit-price="${item.unitPrice}"
                                            data-total-price="${item.totalPrice}">
                                        ${brand.substring(0, 3)}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = tableHtml;

        // Attach click listeners to select buttons
        container.querySelectorAll('.btn-select').forEach(btn => {
            btn.addEventListener('click', () => {
                const productId = btn.dataset.productId;
                const market = btn.dataset.market;
                const unitPrice = parseFloat(btn.dataset.unitPrice);
                const totalPrice = parseFloat(btn.dataset.totalPrice);
                
                if (onSelectCallback) {
                    onSelectCallback(productId, market, unitPrice, totalPrice);
                }
            });
        });
    }
};
