/**
 * pricePredictionService.js - Analytics and price prediction layer.
 * Forecasts future savings based on spending patterns using simple regressions and trends.
 */

export const pricePredictionService = {
    /**
     * Estimates future savings based on current monthly savings potential and historical data.
     * Uses linear trend extrapolation if historical records exist.
     * 
     * @param {number} currentPotentialSavings - Savings potential of current list
     * @param {Array} monthlyRecords - Historical records of monthly savings
     */
    predictSavings(currentPotentialSavings, monthlyRecords = []) {
        const fallbackSaving = currentPotentialSavings > 0 ? currentPotentialSavings : 15000; // default CLP saving fallback
        
        let baselineSavingsPerMonth = fallbackSaving;

        // If historical records are available, compute average and linear regression slope
        if (monthlyRecords && monthlyRecords.length > 0) {
            const savingsValues = monthlyRecords.map(r => r.savingsAchieved || 0).filter(v => v > 0);
            
            if (savingsValues.length > 0) {
                const sum = savingsValues.reduce((a, b) => a + b, 0);
                const avg = sum / savingsValues.length;

                if (savingsValues.length >= 2) {
                    // Simple linear regression to calculate slope (trend)
                    // X = [1, 2, ... N], Y = savingsValues
                    const n = savingsValues.length;
                    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
                    for (let i = 0; i < n; i++) {
                        const x = i + 1;
                        const y = savingsValues[i];
                        sumX += x;
                        sumY += y;
                        sumXY += x * y;
                        sumXX += x * x;
                    }
                    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
                    // Next month prediction = current average + slope
                    baselineSavingsPerMonth = Math.max(2000, avg + slope);
                } else {
                    baselineSavingsPerMonth = avg;
                }
            }
        }

        // Add a small randomized seasonal factor (+/- 3%) for realistic fluctuations
        const seasonalFactor = 0.97 + (Math.random() * 0.06);
        const projectedMonthly = Math.round(baselineSavingsPerMonth * seasonalFactor);

        return {
            nextMonth: projectedMonthly,
            in6Months: projectedMonthly * 6,
            in12Months: projectedMonthly * 12
        };
    },

    /**
     * Simulates a historical price timeline for a product.
     * Useful for showing pricing trends on Chart.js.
     */
    simulateProductPriceHistory(basePrice, weeks = 8) {
        const history = [];
        const now = new Date();
        
        for (let i = weeks; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
            // Create a random walk price variation
            const randomFactor = 0.94 + (Math.sin(i / 1.5) * 0.04) + (Math.random() * 0.02);
            history.push({
                week: `Semana ${weeks - i}`,
                date: date.toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }),
                price: Math.round(basePrice * randomFactor)
            });
        }
        return history;
    }
};
