/**
 * DashboardCards.js - Renders dashboard statistic cards.
 */

import { formatCurrency } from '../utils/helpers.js';

export const DashboardCards = {
    render(metrics) {
        const grid = document.getElementById('metricsGrid');
        if (!grid) return;

        // Destructure metrics
        const { 
            estimatedMonthlySaving, 
            accumulatedSaving, 
            highestDiffProduct, 
            recommendedSupermarket 
        } = metrics;

        grid.innerHTML = `
            <div class="metric-card card-savings" id="cardAhorroEst">
                <div class="card-icon">🎯</div>
                <div class="card-body">
                    <span class="card-label">Ahorro Estimado Mensual</span>
                    <span class="card-value">${formatCurrency(estimatedMonthlySaving || 0)}</span>
                </div>
            </div>
            
            <div class="metric-card card-accumulated" id="cardAhorroAcum">
                <div class="card-icon">💰</div>
                <div class="card-body">
                    <span class="card-label">Ahorro Acumulado</span>
                    <span class="card-value">${formatCurrency(accumulatedSaving || 0)}</span>
                </div>
            </div>
            
            <div class="metric-card card-difference" id="cardMayorDiferencia">
                <div class="card-icon">⚖️</div>
                <div class="card-body">
                    <span class="card-label">Mayor Diferencia</span>
                    <span class="card-value" style="font-size: 1.15rem; font-weight: 600;">
                        ${highestDiffProduct.name}
                    </span>
                    <span class="card-subtext" style="font-size: 0.75rem; color: var(--text-muted);">
                        Ahorro potencial: ${formatCurrency(highestDiffProduct.saving)}
                    </span>
                </div>
            </div>
            
            <div class="metric-card card-recommendation" id="cardSuperRecomendado">
                <div class="card-icon">🏪</div>
                <div class="card-body">
                    <span class="card-label">Supermercado Recomendado</span>
                    <span class="card-value">${recommendedSupermarket || 'Ninguno'}</span>
                </div>
            </div>
        `;
    }
};
