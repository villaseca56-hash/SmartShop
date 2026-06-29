/**
 * mapsService.js - Decoupled location, geocoding and mapping layer.
 * Manages Leaflet map instances, marker renderings, routes and distance calculations.
 */

import { STORES_DATABASE } from '../data/catalog.js';
import { getDistanceKm } from '../utils/helpers.js';

export const mapsService = {
    mapInstance: null,
    routeLine: null,

    /**
     * Compute distance and get nearby supermarkets from local database
     */
    getNearbyStores(lat, lng, radiusKm = 7) {
        return STORES_DATABASE.map(store => {
            const distance = getDistanceKm(lat, lng, store.lat, store.lng);
            return {
                ...store,
                distance: parseFloat(distance.toFixed(2))
            };
        })
        .filter(store => store.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
    },

    /**
     * Geocode address using OSM Nominatim free service
     */
    async geocodeAddress(address) {
        const query = encodeURIComponent(address.trim());
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=3&countrycodes=CL`;

        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'SmartShop/2.0' }
            });
            if (!response.ok) throw new Error('Geocoding service error');
            const data = await response.json();
            if (data.length === 0) throw new Error('Address not found');

            return data.map(item => ({
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                formattedAddress: item.display_name
            }));
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    },

    /**
     * Initialize Leaflet map inside container
     */
    initMap(containerId, centerLocation) {
        if (typeof L === 'undefined') {
            console.error('Leaflet is not loaded in window scope.');
            return null;
        }

        // Clean up previous map if exists
        if (this.mapInstance) {
            this.mapInstance.remove();
            this.mapInstance = null;
        }

        this.mapInstance = L.map(containerId).setView([centerLocation.lat, centerLocation.lng], 13);

        // Modern, premium dark tile layer for maps (CartoDB Dark Matter / Positron)
        // Let's use Voyager or Positron to align with beautiful modern fintech visuals.
        // CartoDB Voyager is modern and clean. Let's use it!
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.mapInstance);

        // Add user marker
        const userIcon = L.divIcon({
            className: 'user-marker-container',
            html: `
                <div class="user-gps-marker">
                    <div class="user-gps-pulse"></div>
                    <div class="user-gps-dot"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        L.marker([centerLocation.lat, centerLocation.lng], { icon: userIcon })
            .addTo(this.mapInstance)
            .bindPopup('<b style="font-family:\'Inter\',sans-serif;">📍 Tu Ubicación Actual</b>')
            .openPopup();

        return this.mapInstance;
    },

    /**
     * Plot stores on the map, highlighting recommended one
     */
    plotStores(stores, recommendedStoreId, onMarkerClick) {
        if (!this.mapInstance) return;

        stores.forEach(store => {
            const isRecommended = store.id === recommendedStoreId;

            // Premium custom icon depending on whether it is recommended
            const markerColor = isRecommended ? '#22c55e' : '#3b82f6';
            const markerIconHtml = `
                <div class="store-map-marker" style="background-color: ${markerColor}; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); width: 18px; height: 18px; border-radius: 50%;">
                    ${isRecommended ? '<div style="background: white; width: 6px; height: 6px; border-radius: 50%; margin: 4px auto;"></div>' : ''}
                </div>
            `;

            const customIcon = L.divIcon({
                className: 'store-marker-container',
                html: markerIconHtml,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            const marker = L.marker([store.lat, store.lng], { icon: customIcon })
                .addTo(this.mapInstance);

            const popupContent = `
                <div class="map-popup-card">
                    <h4 style="font-family:'Inter',sans-serif; margin-bottom: 2px; color:#f1f5f9;">${store.name}</h4>
                    <p style="font-size:0.75rem; color:#94a3b8; margin-bottom: 6px;">${store.address}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #334155; padding-top:6px; font-size:0.8rem;">
                        <span style="font-weight:600; color:#cbd5e1;">🚗 ${store.distance} km</span>
                        ${isRecommended ? '<span style="color:#22c55e; font-weight:700; background:#064e3b; padding:1px 6px; border-radius:4px;">★ Ahorro Recomendado</span>' : ''}
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);

            marker.on('click', () => {
                if (onMarkerClick) onMarkerClick(store);
            });
        });
    },

    /**
     * Draw simulated route between user and store to show routes and time
     */
    drawSimulatedRoute(fromLoc, toLoc, storeName) {
        if (!this.mapInstance) return;

        // Clear previous route
        if (this.routeLine) {
            this.mapInstance.removeLayer(this.routeLine);
        }

        // Draw a simulated route. For a realistic look, generate a couple of control points
        // to create a multi-point polyline instead of a straight line.
        const midLat = (fromLoc.lat + toLoc.lat) / 2;
        const midLng = (fromLoc.lng + toLoc.lng) / 2;
        
        // Offset mid-point slightly to simulate street turns
        const control1 = [midLat + 0.002, fromLoc.lng - 0.001];
        const control2 = [toLoc.lat - 0.001, midLng + 0.002];

        const pathPoints = [
            [fromLoc.lat, fromLoc.lng],
            control1,
            control2,
            [toLoc.lat, toLoc.lng]
        ];

        this.routeLine = L.polyline(pathPoints, {
            color: '#3b82f6',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 10',
            lineJoin: 'round'
        }).addTo(this.mapInstance);

        // Zoom map to fit both user and supermarket
        const group = new L.featureGroup([
            L.marker([fromLoc.lat, fromLoc.lng]),
            L.marker([toLoc.lat, toLoc.lng])
        ]);
        this.mapInstance.fitBounds(group.getBounds().pad(0.15));
    }
};
