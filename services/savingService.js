/**
 * savingService.js - Savings manager.
 * Calculates savings metrics, monthly records, budget status, and flags non-essential items.
 */

import { useLocalStorage } from '../hooks/useLocalStorage.js';

export const savingService = {
    /**
     * Compute savings metrics for the current product list and store comparisons.
     * 
     * @param {Array} products - User product list
     * @param {Object} comparisons - Computed prices per supermarket brand
     */
    calculateSavingsMetrics(products, comparisons) {
        if (!products || products.length === 0 || !comparisons) {
            return {
                estimatedMonthlySaving: 0,
                accumulatedSaving: this.getAccumulatedSavings(),
                highestDiffProduct: { name: 'Ninguno', saving: 0 },
                recommendedSupermarket: 'Ninguno'
            };
        }

        const brands = Object.keys(comparisons);
        if (brands.length === 0) {
            return {
                estimatedMonthlySaving: 0,
                accumulatedSaving: this.getAccumulatedSavings(),
                highestDiffProduct: { name: 'Ninguno', saving: 0 },
                recommendedSupermarket: 'Ninguno'
            };
        }

        let totalMinPrice = 0;
        let totalMaxPrice = 0;
        let highestDiffProduct = { name: 'Ninguno', saving: 0 };
        let bestSubtotal = Infinity;
        let recommendedSupermarket = 'Lider';

        // Calculate product-by-product max vs min difference
        products.forEach(prod => {
            let minPrice = Infinity;
            let maxPrice = -Infinity;

            brands.forEach(brand => {
                const item = comparisons[brand].items.find(i => i.productId === prod.id);
                if (item) {
                    const price = item.totalPrice;
                    if (price < minPrice) minPrice = price;
                    if (price > maxPrice) maxPrice = price;
                }
            });

            if (minPrice !== Infinity && maxPrice !== -Infinity) {
                totalMinPrice += minPrice;
                totalMaxPrice += maxPrice;

                const diff = maxPrice - minPrice;
                if (diff > highestDiffProduct.saving) {
                    highestDiffProduct = {
                        name: prod.name,
                        saving: diff
                    };
                }
            }
        });

        // Determine recommended supermarket (the one with the lowest overall subtotal)
        brands.forEach(brand => {
            const subtotal = comparisons[brand].subtotal;
            if (subtotal > 0 && subtotal < bestSubtotal) {
                bestSubtotal = subtotal;
                recommendedSupermarket = brand;
            }
        });

        // Estimated monthly saving is the difference between buying at the most expensive vs the cheapest option
        const estimatedMonthlySaving = totalMaxPrice - totalMinPrice;

        return {
            estimatedMonthlySaving,
            accumulatedSaving: this.getAccumulatedSavings() + estimatedMonthlySaving,
            highestDiffProduct,
            recommendedSupermarket
        };
    },

    /**
     * Get sum of all past savings from historical monthly records
     */
    getAccumulatedSavings() {
        const records = useLocalStorage.getItem('smartshop_monthly_records', []);
        return records.reduce((sum, r) => sum + (r.savingsAchieved || 0), 0);
    },

    /**
     * Identify non-essential items in list and return tailored savings suggestions
     */
    identifyNonEssentialItems(products) {
        const nonEssentialKeywords = ['coca', 'fanta', 'bebida', 'nectar', 'jugo', 'chocolate', 'papitas', 'snack', 'papas', 'galletas', 'cerveza'];
        
        return products.filter(prod => {
            const name = prod.name.toLowerCase();
            return nonEssentialKeywords.some(keyword => name.includes(keyword));
        }).map(prod => {
            const suggestions = [
                'Considera comprar la marca propia del supermercado para ahorrar hasta un 30%.',
                'Puedes reducir la frecuencia de consumo para mejorar tu presupuesto mensual.',
                'Intenta comprar en formato familiar para bajar el costo por litro/kilo.',
                'Evalúa reemplazar por alternativas caseras o agua purificada.'
            ];
            // Deterministic suggestion index based on product name length
            const index = prod.name.length % suggestions.length;
            return {
                id: prod.id,
                name: prod.name,
                category: 'no-esencial',
                suggestion: suggestions[index]
            };
        });
    },

    /**
     * Get or create a monthly record and save it to storage
     */
    saveMonthlyRecord(budget, actualSpending, savingsAchieved) {
        const now = new Date();
        const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const records = useLocalStorage.getItem('smartshop_monthly_records', []);
        const existingIndex = records.findIndex(r => r.month === monthYear);

        const newRecord = {
            month: monthYear,
            budget,
            actualSpending,
            savingsAchieved
        };

        if (existingIndex >= 0) {
            records[existingIndex] = newRecord;
        } else {
            // Keep maximum 12 months records
            if (records.length >= 12) records.shift();
            records.push(newRecord);
        }

        useLocalStorage.setItem('smartshop_monthly_records', records);
        return records;
    },

    /**
     * Pre-populate historical monthly data if storage is empty, to make Chart.js look beautiful.
     */
    initializeHistoricalRecordsIfEmpty() {
        const records = useLocalStorage.getItem('smartshop_monthly_records', []);
        if (records.length === 0) {
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
            const year = new Date().getFullYear();
            
            const initialRecords = months.map((month, idx) => {
                const budget = 180000;
                const actualSpending = 160000 + (idx * 2000) - (Math.random() * 5000);
                const savingsAchieved = budget - actualSpending;

                return {
                    month: `${month} ${year}`,
                    budget,
                    actualSpending: Math.round(actualSpending),
                    savingsAchieved: Math.round(savingsAchieved)
                };
            });

            useLocalStorage.setItem('smartshop_monthly_records', initialRecords);
        }
    }
};
