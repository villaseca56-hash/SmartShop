/**
 * MapComponent.js - Visual map representation using Leaflet.
 * Features custom markers, supermarket saving labels, and route simulations.
 */

import { mapsService } from '../services/mapsService.js';
import { formatCurrency, sanitize } from '../utils/helpers.js';

export const MapComponent = {
    init(containerId, centerLocation, stores, savingsData = {}, recommendedStore = '', onStoreClickCallback) {
        // Initialize the base Leaflet map
        const map = mapsService.initMap(containerId, centerLocation);
        if (!map) return;

        // Overlay circles or overlays if needed
        if (typeof L !== 'undefined') {
            L.circle([centerLocation.lat, centerLocation.lng], {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.04,
                radius: 7000 // 7 km radius circle
            }).addTo(map);
        }

        // Plot each supermarket store marker
        stores.forEach(store => {
            const isRecommended = store.brand === recommendedStore;
            
            // Calculate saving at this store compared to worst store
            // Let's get simulated savings info for this store
            const storeSavings = savingsData[store.brand] || 0;
            const savingsText = storeSavings > 0 ? `Ahorro: ${formatCurrency(storeSavings)}` : 'Sin ahorro';

            const markerColor = isRecommended ? '#22c55e' : '#3b82f6';
            const markerHtml = `
                <div class="store-leaflet-marker ${isRecommended ? 'recommended-pulse' : ''}" 
                     style="background-color: ${markerColor};">
                    <span class="store-initial">${store.brand.charAt(0)}</span>
                    <div class="store-saving-tooltip">${store.brand} | ${sanitize(savingsText)}</div>
                </div>
            `;

            const customIcon = L.divIcon({
                className: 'store-custom-marker-wrapper',
                html: markerHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const popupContent = `
                <div class="map-popup-card">
                    <h4>${sanitize(store.name)}</h4>
                    <p class="popup-address">${sanitize(store.address)}</p>
                    <div class="popup-stats">
                        <span class="popup-dist">🚗 ${store.distance} km</span>
                        <span class="popup-time">⏱️ ${Math.round(store.distance * 3 + 2)} mins</span>
                    </div>
                    <div class="popup-savings-badge ${isRecommended ? 'recommended' : ''}">
                        ${isRecommended ? '⭐️ Supermercado Recomendado' : ''}
                        <div class="popup-saving-value">${sanitize(savingsText)}</div>
                    </div>
                    <button class="btn btn-primary btn-draw-route" style="padding:4px 8px; font-size:0.75rem; margin-top:8px;">
                        Ver Ruta de Ahorro
                    </button>
                </div>
            `;

            const marker = L.marker([store.lat, store.lng], { icon: customIcon })
                .addTo(map)
                .bindPopup(popupContent);

            // Trigger route simulation on popup click or button click
            marker.on('popupopen', () => {
                const btn = document.querySelector('.btn-draw-route');
                if (btn) {
                    btn.addEventListener('click', () => {
                        mapsService.drawSimulatedRoute(centerLocation, { lat: store.lat, lng: store.lng }, store.name);
                        
                        // Show visual feedback or routing message
                        const status = document.getElementById('mapStatus');
                        if (status) {
                            status.innerHTML = `
                                <strong>Ruta a ${store.name}:</strong> ${store.distance} km | 
                                ⏱️ Aprox. ${Math.round(store.distance * 3 + 2)} min. | 
                                <span style="color: #22c55e; font-weight: bold;">${savingsText}</span>
                            `;
                        }
                    }, { once: true });
                }
            });

            marker.on('click', () => {
                if (onStoreClickCallback) {
                    onStoreClickCallback(store);
                }
            });
        });
    }
};
