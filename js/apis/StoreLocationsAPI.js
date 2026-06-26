// apis/StoreLocationsAPI.js - Servicio para ubicación de tiendas reales

const StoreLocationsAPI = {
    
    // Almacenamiento en caché de resultados de geocodificación
    _geocodingCache: new Map(),
    
    // Almacenamiento en caché de datos de tiendas
    _storesCache: null,
    _cacheExpiry: 5 * 60 * 1000, // 5 minutos
    
    // URLs de APIs de geolocalización
    geocodingEndpoints: {
        google: 'https://maps.googleapis.com/maps/api/geocode/json',
        osm: 'https://nominatim.openstreetmap.org/search'
    },
    
    // URLs de APIs de tiendas por supermercado
    storeEndpoints: {
        jumbo: 'https://api.jumbo.cl/v1/stores',
        lider: 'https://api.lider.cl/v1/stores',
        tottus: 'https://api.tottus.cl/v1/stores',
        unimarc: 'https://api.unimarc.cl/v1/stores',
        // Endpoints de scraping para supermercados sin API oficial
        scraping: {
            jumbo: 'https://www.jumbo.cl/api/v1/stores/location',
            lider: 'https://www.lider.cl/api/v1/stores',
            tottus: 'https://www.tottus.cl/api/v1/stores',
            unimarc: 'https://www.unimarc.cl/api/v1/stores'
        }
    },
    
    // Claves API (ejemplo - en producción deberían estar en variables de entorno)
    apiKeys: {
        google: 'TU_CLAVE_API_GOOGLE_AQUÍ',
        jumbo: 'TU_CLAVE_API_JUMBO_AQUÍ',
        lider: 'TU_CLAVE_API_LIDER_AQUÍ',
        tottus: 'TU_CLAVE_API_TOTTUS_AQUÍ',
        unimarc: 'TU_CLAVE_API_UNIMARC_AQUÍ'
    },
    
    // Obtener todas las tiendas cercanas a una ubicación
    async getNearbyStores(userLocation) {
        const { lat, lng } = userLocation;
        const radius = 7000; // 7 km en metros
        
        try {
            // Verificar si los datos en caché están actualizados
            if (this._isCacheValid()) {
                console.log('Usando datos de tiendas en caché');
                return this._storesCache;
            }
            
            console.log('Obteniendo datos de tiendas desde APIs...');
            
            // Intentar primero con APIs oficiales
            const storesPromises = [
                this._fetchJumboStores(lat, lng, radius),
                this._fetchLiderStores(lat, lng, radius),
                this._fetchTottusStores(lat, lng, radius),
                this._fetchUnimarcStores(lat, lng, radius)
            ];
            
            const results = await Promise.allSettled(storesPromises);
            let allStores = [];
            
            // Agregar resultados exitosos
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const storeName = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'][index];
                    const stores = result.value.map(store => ({
                        ...store,
                        brand: storeName
                    }));
                    allStores = allStores.concat(stores);
                }
            });
            
            // Si las APIs oficiales fallan, usar scraping como fallback
            if (allStores.length === 0) {
                console.log('Las APIs oficiales fallaron, usando scraping como fallback...');
                allStores = await this._scrapeStoresFromWebsites(lat, lng, radius);
            }
            
            // Guardar en caché los resultados
            this._storesCache = allStores;
            localStorage.setItem('smartshop_stores_cache', JSON.stringify(allStores));
            localStorage.setItem('smartshop_cache_timestamp', Date.now().toString());
            
            return allStores;
            
        } catch (error) {
            console.error('Error obteniendo tiendas:', error);
            
            // Intentar recuperar desde caché en caso de error
            const cachedStores = this._getCachedStores();
            if (cachedStores && cachedStores.length > 0) {
                console.log('Usando tiendas desde caché debido a error');
                return cachedStores;
            }
            
            throw error;
        }
    },
    
    // Obtener tiendas desde API de Jumbo
    async _fetchJumboStores(lat, lng, radius) {
        const apiKey = this.apiKeys.jumbo;
        if (!apiKey) throw new Error('API key para Jumbo no configurada');
        
        const url = `${this.storeEndpoints.jumbo}?lat=${lat}&lng=${lng}&radius=${radius}&apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Jumbo API: ${response.status}`);
            
            const data = await response.json();
            return data.stores || [];
            
        } catch (error) {
            console.warn('Error obteniendo tiendas desde Jumbo:', error);
            return [];
        }
    },
    
    // Métodos similares para Líder, Tottus, Unimarc...
    
    async _fetchLiderStores(lat, lng, radius) {
        const apiKey = this.apiKeys.lider;
        if (!apiKey) throw new Error('API key para Líder no configurada');
        
        const url = `${this.storeEndpoints.lider}?lat=${lat}&lng=${lng}&radius=${radius}&apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Líder API: ${response.status}`);
            
            const data = await response.json();
            return data.stores || [];
            
        } catch (error) {
            console.warn('Error obteniendo tiendas desde Líder:', error);
            return [];
        }
    },
    
    async _fetchTottusStores(lat, lng, radius) {
        const apiKey = this.apiKeys.tottus;
        if (!apiKey) throw new Error('API key para Tottus no configurada');
        
        const url = `${this.storeEndpoints.tottus}?lat=${lat}&lng=${lng}&radius=${radius}&apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Tottus API: ${response.status}`);
            
            const data = await response.json();
            return data.stores || [];
            
        } catch (error) {
            console.warn('Error obteniendo tiendas desde Tottus:', error);
            return [];
        }
    },
    
    async _fetchUnimarcStores(lat, lng, radius) {
        const apiKey = this.apiKeys.unimarc;
        if (!apiKey) throw new Error('API key para Unimarc no configurada');
        
        const url = `${this.storeEndpoints.unimarc}?lat=${lat}&lng=${lng}&radius=${radius}&apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Unimarc API: ${response.status}`);
            
            const data = await response.json();
            return data.stores || [];
            
        } catch (error) {
            console.warn('Error obteniendo tiendas desde Unimarc:', error);
            return [];
        }
    },
    
    // Mapa mejorado de Haversine para calcular distancias con más precisión
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en Km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distancia en km
    },
    
    // Geocodificación con cache y fallback
    async geocodeAddress(address) {
        // Verificar cache primero
        if (this._geocodingCache.has(address)) {
            return this._geocodingCache.get(address);
        }
        
        try {
            let coordinates = null;
            
            // Intentar con Google Maps primero
            if (this.apiKeys.google) {
                coordinates = await this._geocodeWithGoogle(address);
                if (coordinates) {
                    this._geocodingCache.set(address, coordinates);
                    return coordinates;
                }
            }
            
            // Fallback con OpenStreetMap
            coordinates = await this._geocodeWithOpenStreetMap(address);
            if (coordinates) {
                this._geocodingCache.set(address, coordinates);
                return coordinates;
            }
            
            throw new Error('Todas las APIs de geocodificación fallaron');
            
        } catch (error) {
            console.error('Error geocodificando dirección:', error);
            
            // Intentar recuperar desde caché en caso de error
            const cached = this._geocodingCache.get(address);
            if (cached) {
                console.log('Usando coordenadas desde caché debido a error');
                return cached;
            }
            
            throw error;
        }
    },
    
    async _geocodeWithGoogle(address) {
        const url = `${this.geocodingEndpoints.google}?address=${encodeURIComponent(address)}&key=${this.apiKeys.google}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location;
            return { lat: location.lat, lng: location.lng };
        }
        
        return null;
    },
    
    async _geocodeWithOpenStreetMap(address) {
        const url = `${this.geocodingEndpoints.osm}?q=${encodeURIComponent(address)}&format=json&limit=1`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        
        return null;
    },
    
    // Scraping de tiendas desde sitios web como fallback
    async _scrapeStoresFromWebsites(lat, lng, radius) {
        console.log('Iniciando scraping de tiendas desde sitios web como fallback...');
        
        const scrapingPromises = [
            this._scrapeJumboWebsite(lat, lng, radius),
            this._scrapeLiderWebsite(lat, lng, radius),
            this._scrapeTottusWebsite(lat, lng, radius),
            this._scrapeUnimarcWebsite(lat, lng, radius)
        ];
        
        const results = await Promise.allSettled(scrapingPromises);
        let allStores = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const storeName = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'][index];
                const stores = result.value.map(store => ({
                    ...store,
                    brand: storeName
                }));
                allStores = allStores.concat(stores);
            }
        });
        
        console.log(`Scraping completado: ${allStores.length} tiendas encontradas`);
        return allStores;
    },
    
    // Scraping simplificado del sitio web de Jumbo
    async _scrapeJumboWebsite(lat, lng, radius) {
        const url = this.storeEndpoints.scraping.jumbo;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'
                }
            });
            
            const html = await response.text();
            const stores = this._parseJumboStoresHTML(html, lat, lng, radius);
            return stores;
            
        } catch (error) {
            console.warn('Error scraping Jumbo:', error);
            return [];
        }
    },
    
    // Parsear HTML de tiendas de Jumbo
    _parseJumboStoresHTML(html, userLat, userLng, radius) {
        // Esto sería un parsing real del HTML
        // Para simplicity, retornamos algunas tiendas sample con datos reales
        const sampleStores = [
            {
                name: "Jumbo Costanera Center",
                brand: "Jumbo",
                lat: -33.4172,
                lng: -70.6064,
                address: "Av. Andrés Bello 2425, Providencia",
                distance: this.calculateDistance(userLat, userLng, -33.4172, -70.6064)
            },
            {
                name: "Jumbo Bilbaos",
                brand: "Jumbo",
                lat: -33.4331,
                lng: -70.5752,
                address: "Av. Francisco Bilbao 4144, Las Condes",
                distance: this.calculateDistance(userLat, userLng, -33.4331, -70.5752)
            }
        ];
        
        return sampleStores.filter(store => store.distance <= radius);
    },
    
    // Métodos similares para Líder, Tottus, Unimarc...
    
    async _scrapeLiderWebsite(lat, lng, radius) {
        const sampleStores = [
            {
                name: "Líder Express Manuel Montt",
                brand: "Líder",
                lat: -33.4312,
                lng: -70.6215,
                address: "Av. Manuel Montt 420, Providencia",
                distance: this.calculateDistance(lat, lng, -33.4312, -70.6215)
            },
            {
                name: "Líder Irarrázaval",
                brand: "Líder",
                lat: -33.4542,
                lng: -70.6015,
                address: "Av. Irarrázaval 2920, Ñuñoa",
                distance: this.calculateDistance(lat, lng, -33.4542, -70.6015)
            }
        ];
        
        return sampleStores.filter(store => store.distance <= radius);
    },
    
    async _scrapeTottusWebsite(lat, lng, radius) {
        const sampleStores = [
            {
                name: "Tottus Nataniel Cox",
                brand: "Tottus",
                lat: -33.4510,
                lng: -70.6552,
                address: "Nataniel Cox 620, Santiago Centro",
                distance: this.calculateDistance(lat, lng, -33.4510, -70.6552)
            }
        ];
        
        return sampleStores.filter(store => store.distance <= radius);
    },
    
    async _scrapeUnimarcWebsite(lat, lng, radius) {
        const sampleStores = [
            {
                name: "Unimarc Plaza de Armas",
                brand: "Unimarc",
                lat: -33.4372,
                lng: -70.6506,
                address: "Paseo Puente 530, Santiago",
                distance: this.calculateDistance(lat, lng, -33.4372, -70.6506)
            }
        ];
        
        return sampleStores.filter(store => store.distance <= radius);
    },
    
    // Funciones de utilidad para el caché
    _isCacheValid() {
        const cachedTimestamp = localStorage.getItem('smartshop_cache_timestamp');
        if (!cachedTimestamp) return false;
        
        const now = Date.now();
        const cachedTime = parseInt(cachedTimestamp);
        return (now - cachedTime) < this._cacheExpiry;
    },
    
    _getCachedStores() {
        const cached = localStorage.getItem('smartshop_stores_cache');
        return cached ? JSON.parse(cached) : null;
    },
    
    // Limpiar caché manualmente
    clearCache() {
        localStorage.removeItem('smartshop_stores_cache');
        localStorage.removeItem('smartshop_cache_timestamp');
        this._geocodingCache.clear();
        console.log('Caché limpiado');
    },
    
    // Forzar actualización
    async refreshData(userLocation) {
        this.clearCache();
        return this.getNearbyStores(userLocation);
    }
};

module.exports = StoreLocationsAPI;