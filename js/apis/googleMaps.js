const GoogleMapsAPI = {
    API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY',
    loaded: false,
    map: null,
    markers: [],
    circles: [],

    async load() {
        if (this.loaded) return Promise.resolve();
        if (!this.API_KEY || this.API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
            console.warn('Google Maps API key not configured. Usando Leaflet fallback.');
            return Promise.reject(new Error('No API key'));
        }
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existing) {
                const checkLoaded = () => {
                    if (window.google && google.maps) {
                        this.loaded = true;
                        resolve();
                    } else {
                        setTimeout(checkLoaded, 200);
                    }
                };
                checkLoaded();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.API_KEY}&libraries=places&loading=async`;
            script.async = true;
            script.defer = true;
            script.onload = () => { this.loaded = true; resolve(); };
            script.onerror = () => reject(new Error('Failed to load Google Maps API'));
            document.head.appendChild(script);
        });
    },

    initMap(elementId, center, zoom) {
        if (this.map) {
            this.clearMarkers();
            this.circles.forEach(c => c.setMap(null));
            this.circles = [];
        }
        this.map = new google.maps.Map(document.getElementById(elementId), {
            center: { lat: center.lat, lng: center.lng },
            zoom: zoom || 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
            ]
        });
        return this.map;
    },

    addMarker(position, title, content, icon) {
        const markerOptions = {
            position: { lat: position.lat, lng: position.lng },
            map: this.map,
            title: title
        };
        if (icon) markerOptions.icon = icon;
        const marker = new google.maps.Marker(markerOptions);
        if (content) {
            const infoWindow = new google.maps.InfoWindow({ content });
            marker.addListener('click', () => infoWindow.open(this.map, marker));
        }
        this.markers.push(marker);
        return marker;
    },

    addCircle(center, radiusMeters) {
        const circle = new google.maps.Circle({
            map: this.map,
            center: { lat: center.lat, lng: center.lng },
            radius: radiusMeters,
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.3,
            strokeWeight: 2
        });
        this.circles.push(circle);
        return circle;
    },

    async searchSupermarkets(location, radius) {
        if (!this.loaded || !this.map) throw new Error('Google Maps not loaded');
        const service = new google.maps.places.PlacesService(this.map);
        return new Promise((resolve, reject) => {
            service.nearbySearch({
                location: { lat: location.lat, lng: location.lng },
                radius: radius || 7000,
                type: ['supermarket']
            }, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results.map(p => ({
                        name: p.name,
                        brand: p.name.split(' ')[0],
                        address: p.vicinity || p.formatted_address,
                        lat: p.geometry.location.lat(),
                        lng: p.geometry.location.lng(),
                        rating: p.rating || 0,
                        placeId: p.place_id
                    })));
                } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve([]);
                } else {
                    reject(new Error(`Places API error: ${status}`));
                }
            });
        });
    },

    async geocode(address) {
        if (!this.loaded) throw new Error('Google Maps not loaded');
        const geocoder = new google.maps.Geocoder();
        return new Promise((resolve, reject) => {
            geocoder.geocode({ address: address }, (results, status) => {
                if (status === 'OK') {
                    const loc = results[0].geometry.location;
                    resolve({
                        lat: loc.lat(),
                        lng: loc.lng(),
                        formattedAddress: results[0].formatted_address
                    });
                } else {
                    reject(new Error(`Geocode error: ${status}`));
                }
            });
        });
    },

    createAutocomplete(inputElement) {
        if (!this.loaded) return null;
        return new google.maps.places.Autocomplete(inputElement, {
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: 'CL' }
        });
    },

    clearMarkers() {
        this.markers.forEach(m => m.setMap(null));
        this.markers = [];
    }
};
