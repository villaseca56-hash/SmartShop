/**
 * SavingsChart.js - Chart.js controller.
 * Renders weekly and monthly historical records alongside savings projections.
 */

import { formatCurrency } from '../utils/helpers.js';

export const SavingsChart = {
    chartInstance: null,

    render(monthlyRecords, predictionData) {
        const ctx = document.getElementById('distributionChart');
        if (!ctx) return;

        const ctx2d = ctx.getContext('2d');
        if (!ctx2d) return;

        // Destroy previous instance
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        // Prepare chart labels and datasets
        // Combine past history (e.g. Enero, Febrero, etc.) with predictions (Próximo Mes, En 6 Meses, En 12 Meses)
        const historyLabels = monthlyRecords.map(r => r.month.split(' ')[0]); // Get month name (Enero, Febrero, etc.)
        const historyValues = monthlyRecords.map(r => r.savingsAchieved || 0);

        // Add projections
        const labels = [...historyLabels, 'Futuro (1M)', 'Futuro (6M)', 'Futuro (12M)'];
        
        // Setup data values: history goes into past dataset, projection goes into future dataset
        const pastData = [...historyValues, null, null, null];
        
        // Start future data from the last historical point
        const lastHistoricalValue = historyValues[historyValues.length - 1] || 0;
        const futureData = Array(historyValues.length - 1).fill(null);
        futureData.push(lastHistoricalValue); // connect the lines
        futureData.push(predictionData.nextMonth);
        futureData.push(predictionData.in6Months);
        futureData.push(predictionData.in12Months);

        // Grid colors and settings
        this.chartInstance = new Chart(ctx2d, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ahorro Histórico',
                        data: pastData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#ffffff',
                        pointHoverRadius: 7,
                        pointRadius: 5,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Proyección Futura (Ahorro)',
                        data: futureData,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        pointBackgroundColor: '#22c55e',
                        pointBorderColor: '#ffffff',
                        pointHoverRadius: 7,
                        pointRadius: 5,
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            font: {
                                family: 'Inter',
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        titleFont: { family: 'Inter', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed.y;
                                if (val === null) return '';
                                return ` Ahorro: ${formatCurrency(val)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 10 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(148, 163, 184, 0.05)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 10 },
                            callback: (value) => formatCurrency(value)
                        }
                    }
                }
            }
        });
    }
};
