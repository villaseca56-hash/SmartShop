/**
 * supermarketService.js - Decoupled data access layer for supermarket operations.
 * Implements a smart mock pricing mode with realistic, stable pricing.
 */

import { PRODUCT_CATALOG, STORES_DATABASE, SUGGESTIONS_DATABASE } from '../data/catalog.js';

/**
 * Simple hash function to generate a stable, deterministic float between -0.05 and 0.05
 * based on a string key (e.g. productId + storeId).
 * This ensures that mock prices are stable during a user session but vary by store.
 */
function getStablePriceVariance(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Return float between -0.06 and +0.06
    const value = (Math.abs(hash) % 1000) / 1000; // 0 to 1
    return -0.06 + (value * 0.12);
}

export const supermarketService = {
    /**
     * Search product catalog using keywords with autocomplete logic
     */
    searchCatalog(query, filters = {}) {
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return [];
        }

        const normalizedQuery = query.toLowerCase().trim();
        const words = normalizedQuery.split(/\s+/);

        return PRODUCT_CATALOG.filter(item => {
            // Check category filter
            if (filters.category && filters.category !== 'all' && item.category !== filters.category) {
                return false;
            }

            // Check brand filter
            if (filters.brand && filters.brand !== 'all' && item.brand !== filters.brand) {
                return false;
            }

            // Match all search words against product name or keywords
            const matchAllWords = words.every(word => {
                return item.name.toLowerCase().includes(word) || 
                       item.keywords.some(kw => kw.toLowerCase().includes(word));
            });

            return matchAllWords;
        });
    },

    /**
     * Get related items that users also buy (suggestions)
     */
    getSuggestions(selectedProducts) {
        const categories = new Set(selectedProducts.map(p => {
            // Find in catalog
            const catalogItem = PRODUCT_CATALOG.find(c => c.name.toLowerCase().includes(p.name.toLowerCase()));
            return catalogItem ? catalogItem.category : null;
        }).filter(Boolean));

        const suggestedIds = new Set();
        categories.forEach(cat => {
            const list = SUGGESTIONS_DATABASE[cat] || [];
            list.forEach(id => suggestedIds.add(id));
        });

        // Map IDs back to full catalog items
        return PRODUCT_CATALOG.filter(item => {
            // Exclude already added products
            const isAlreadyAdded = selectedProducts.some(p => p.name.toLowerCase() === item.name.toLowerCase());
            return suggestedIds.has(item.id) && !isAlreadyAdded;
        });
    },

    /**
     * Calculate and return prices for a list of products across all supermarkets.
     * Incorporates stable pseudo-random variations per store.
     */
    getPricesForList(products) {
        const results = {};

        STORES_DATABASE.forEach(store => {
            results[store.brand] = {
                storeId: store.id,
                storeName: store.name,
                address: store.address,
                distance: store.distance || 99, // Computed later by mapsService
                items: [],
                subtotal: 0
            };
        });

        products.forEach(prod => {
            // Find closest match in catalog or create mock catalog entry
            let matchedItem = PRODUCT_CATALOG.find(item => 
                item.name.toLowerCase().includes(prod.name.toLowerCase()) ||
                item.keywords.some(kw => prod.name.toLowerCase().includes(kw))
            );

            // Fallback for custom products added by user
            if (!matchedItem) {
                matchedItem = {
                    id: 'custom_' + prod.name.replace(/\s+/g, '_').toLowerCase(),
                    name: prod.name,
                    basePrice: 2200,
                    category: 'otros',
                    brand: 'Genérica'
                };
            }

            STORES_DATABASE.forEach(store => {
                // Apply stable pricing algorithm
                // Price = Base Price * Store Factor * Stable Variance (derived from product + store)
                const variance = getStablePriceVariance(matchedItem.id + store.brand);
                const storeFactor = store.basePriceFactor;
                const unitPrice = Math.round(matchedItem.basePrice * storeFactor * (1 + variance));
                const totalPrice = unitPrice * prod.quantity;

                // Push to store list if not already present
                const existingItem = results[store.brand].items.find(i => i.productId === prod.id);
                if (!existingItem) {
                    results[store.brand].items.push({
                        productId: prod.id,
                        productName: prod.name,
                        unitPrice: unitPrice,
                        totalPrice: totalPrice,
                        quantity: prod.quantity
                    });
                    results[store.brand].subtotal += totalPrice;
                }
            });
        });

        return results;
    },

    /**
     * Fetch unique categories and brands for advanced search filtering
     */
    getFilterOptions() {
        const categories = [...new Set(PRODUCT_CATALOG.map(p => p.category))];
        const brands = [...new Set(PRODUCT_CATALOG.map(p => p.brand))];
        return { categories, brands };
    }
};
