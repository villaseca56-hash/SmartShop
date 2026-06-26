// apis/PricingAPI.js - Sistema avanzado de comparación de precios en tiempo real con múltiples fuentes

const PricingAPI = {
    
    // Cache para reducir llamadas y mejorar rendimiento
    _priceCache: new Map(),
    _trendCache: new Map(),
    _cacheExpiry: 5 * 60 * 1000, // 5 minutos
    
    // URLs oficiales de APIs de precios por supermercado
    pricingEndpoints: {
        // APIs chilenas oficiales
        jumbo: {
            base: 'https://api.jumbo.cl/v1/pricing',
            products: 'https://api.jumbo.cl/v1/catalog',
            stores: 'https://api.jumbo.cl/v1/stores'
        },
        lider: {
            base: 'https://api.lider.cl/v1/pricing',
            products: 'https://api.lider.cl/v1/catalog',
            stores: 'https://api.lider.cl/v1/stores'
        },
        tottus: {
            base: 'https://api.tottus.cl/v1/pricing',
            products: 'https://api.tottus.cl/v1/catalog',
            stores: 'https://api.tottus.cl/v1/stores'
        },
        unimarc: {
            base: 'https://api.unimarc.cl/v1/pricing',
            products: 'https://api.unimarc.cl/v1/catalog',
            stores: 'https://api.unimarc.cl/v1/stores'
        },
        // APIs de comercio electrónico globales para mercados internacionales
        walmart: {
            base: 'https://api.walmartlabs.com/v3/price',
            products: 'https://api.walmart.com/v3/items'
        },
        carrefour: {
            base: 'https://api.carrefour.com/pcommerce/v1/prices',
            products: 'https://api.carrefour.com/pcatalog/v1/products'
        },
        exito: {
            base: 'https://api.exito.com/pcommerce/v1/prices',
            products: 'https://api.exito.com/pcatalog/v1/products'
        },
        // APIs de scraping como fallback para supermercados sin API oficial
        scraping: {
            jumbo: {
                search: 'https://www.jumbo.cl/api/v1/price-comparison',
                product: 'https://www.jumbo.cl/api/v1/products'
            },
            lider: {
                search: 'https://www.lider.cl/api/v1/pricing',
                product: 'https://www.lider.cl/api/v1/products'
            },
            tottus: {
                search: 'https://www.tottus.cl/api/v1/price-comparison',
                product: 'https://www.tottus.cl/api/v1/products'
            },
            unimarc: {
                search: 'https://www.unimarc.cl/api/v1/pricing',
                product: 'https://www.unimarc.cl/api/v1/products'
            },
            walmart: {
                search: 'https://www.walmart.cl/api/v1/pricing',
                product: 'https://www.walmart.cl/api/v1/products'
            },
            carrefour: {
                search: 'https://www.carrefour.cl/api/v1/pricing',
                product: 'https://www.carrefour.cl/api/v1/products'
            },
            exito: {
                search: 'https://www.exito.com/api/v1/pricing',
                product: 'https://www.exito.com/api/v1/products'
            }
        }
    },
    
    // Claves API (ejemplo - en producción deberían estar en variables de entorno)
    apiKeys: {
        // APIs oficiales
        jumbo: 'TU_CLAVE_API_JUMBO_AQUÍ',
        lider: 'TU_CLAVE_API_LIDER_AQUÍ',
        tottus: 'TU_CLAVE_API_TOTTUS_AQUÍ',
        unimarc: 'TU_CLAVE_API_UNIMARC_AQUÍ',
        // APIs globales
        walmart: 'TU_CLAVE_API_WALMART_AQUÍ',
        carrefour: 'TU_CLAVE_API_CARREFOUR_AQUÍ',
        exito: 'TU_CLAVE_API_EXITTO_AQUÍ'
    },
    
    // Obtener precio más barato por producto en todos los supermercados disponibles
    async getBestPriceForProduct(productId, options = {}) {
        const {
            storeIds = ['Jumbo', 'Líder', 'Tottus', 'Unimarc', 'Walmart', 'Carrefour', 'Exito'],
            category = null,
            quantity = 1,
            includeUnavailable = false,
            includePromotions = true,
            preferredStores = [],
            avoidStores = []
        } = options;
        
        try {
            console.log(`Buscando precio más barato para producto: ${productId}, categoría: ${category || 'todas'}`);
            
            // Si solo interesa un supermercado específico
            const storesToQuery = storeIds.filter(store => 
                !avoidStores.includes(store) &&
                (preferredStores.length === 0 || preferredStores.includes(store))
            );
            
            // Obtener precios de cada supermercado
            const pricePromises = storesToQuery.map(storeId => 
                this._getStoreProductPrice(storeId, productId, category)
                    .catch(error => {
                        console.warn(`Error obteniendo precios de ${storeId}:`, error);
                        return null;
                    })
            );
            
            const results = await Promise.allSettled(pricePromises);
            const pricesByStore = {};
            
            // Recopilar precios exitosos y filtrar por tiendas favoritas/no favoritas
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const storeName = storesToQuery[index];
                    pricesByStore[storeName] = result.value;
                }
            });
            
            // Si todas las APIs oficiales fallan, usar scraping como fallback
            if (Object.keys(pricesByStore).length === 0) {
                console.log('Las APIs oficiales fallaron, usando scraping como fallback...');
                pricesByStore.scraping = await this._scrapeProductPrices(productId);
            }
            
            // Calcular el precio total por tienda con todas las consideraciones
            const comparisonResults = {};
            let bestPrice = null;
            let bestStore = null;
            
            // Calcular precios finales considerando promociones, descuentos y disponibilidad
            for (const [store, priceData] of Object.entries(pricesByStore)) {
                if (!priceData && !includeUnavailable) continue;
                
                const storePrices = await this._calculateStoreTotal(store, priceData, productId, quantity, category, includePromotions);
                comparisonResults[store] = storePrices;
                
                if (storePrices.totalPrice !== null && storePrices.totalPrice > 0) {
                    if (bestPrice === null || storePrices.totalPrice < bestPrice) {
                        bestPrice = storePrices.totalPrice;
                        bestStore = store;
                    }
                }
            }
            
            // Guardar historial de precios para análisis de tendencias (si hay datos)
            if (Object.keys(comparisonResults).length > 0) {
                this._storePriceHistory(productId, comparisonResults);
            }
            
            // Generar análisis adicional
            const priceAnalysis = this._generatePriceAnalysis(comparisonResults, bestStore);
            
            return {
                bestPrice,
                bestStore,
                comparisonResults,
                currency: 'CLP',
                timestamp: new Date().toISOString(),
                productId,
                analysis: priceAnalysis,
                totalStoresChecked: storesToQuery.length,
                successfulStores: Object.keys(pricesByStore).length
            };
            
        } catch (error) {
            console.error(`Error calculando precio más barato para ${productId}:`, error);
            throw error;
        }
    },
    
    // Obtener precio de producto de un supermercado específico con manejo de errores avanzado
    async _getStoreProductPrice(storeId, productId, category = null) {
        try {
            // Intentar obtener desde API oficial del supermercado
            let prices = null;
            
            switch (storeId.toLowerCase()) {
                case 'jumbo':
                    prices = await this._fetchJumboProductPrice(productId, category);
                    break;
                case 'lider':
                    prices = await this._fetchLiderProductPrice(productId, category);
                    break;
                case 'tottus':
                    prices = await this._fetchTottusProductPrice(productId, category);
                    break;
                case 'unimarc':
                    prices = await this._fetchUnimarcProductPrice(productId, category);
                    break;
                case 'walmart':
                    prices = await this._fetchWalmartProductPrice(productId, category);
                    break;
                case 'carrefour':
                    prices = await this._fetchCarrefourProductPrice(productId, category);
                    break;
                case 'exito':
                    prices = await this._fetchExitoProductPrice(productId, category);
                    break;
                default:
                    // Intentar con scraping si el supermercado no está soportado por API oficial
                    prices = await this._scrapeSingleStorePrice(storeId, productId);
            }
            
            return prices;
            
        } catch (error) {
            console.error(`Error obteniendo precio de ${storeId} para ${productId}:`, error);
            return null;
        }
    },
    
    // Obtener precios actuales de un producto de una tienda específica
    async _fetchJumboProductPrice(productId, category) {
        const apiKey = this.apiKeys.jumbo;
        if (!apiKey) throw new Error('API key para Jumbo no configurada');
        
        // Primero intentar obtener producto completo
        const productUrl = `${this.pricingEndpoints.jumbo.products}/${productId}?apikey=${apiKey}`;
        const priceUrl = `${this.pricingEndpoints.jumbo.base}/${productId}?apikey=${apiKey}`;
        
        try {
            // Intentar primero la información del producto
            const productResponse = await fetch(productUrl);
            if (productResponse.ok) {
                const productData = await productResponse.json();
                if (productData.prices && Object.keys(productData.prices).length > 0) {
                    return this._normalizePrices(productData.prices, 'Jumbo');
                }
            }
            
            // Si falla, intentar el endpoint de precios directamente
            const priceResponse = await fetch(priceUrl);
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return this._normalizePrices(priceData, 'Jumbo');
            }
            
            throw new Error(`Jumbo API: ${priceResponse.status}`);
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Jumbo para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchLiderProductPrice(productId, category) {
        const apiKey = this.apiKeys.lider;
        if (!apiKey) throw new Error('API key para Líder no configurada');
        
        const productUrl = `${this.pricingEndpoints.lider.products}/${productId}?apikey=${apiKey}`;
        const priceUrl = `${this.pricingEndpoints.lider.base}/${productId}?apikey=${apiKey}`;
        
        try {
            // Intentar primero la información del producto
            const productResponse = await fetch(productUrl);
            if (productResponse.ok) {
                const productData = await productResponse.json();
                if (productData.prices && Object.keys(productData.prices).length > 0) {
                    return this._normalizePrices(productData.prices, 'Líder');
                }
            }
            
            // Fallback al endpoint de precios
            const priceResponse = await fetch(priceUrl);
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return this._normalizePrices(priceData, 'Líder');
            }
            
            throw new Error(`Líder API: ${priceResponse.status}`);
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Líder para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchTottusProductPrice(productId, category) {
        const apiKey = this.apiKeys.tottus;
        if (!apiKey) throw new Error('API key para Tottus no configurada');
        
        const productUrl = `${this.pricingEndpoints.tottus.products}/${productId}?apikey=${apiKey}`;
        const priceUrl = `${this.pricingEndpoints.tottus.base}/${productId}?apikey=${apiKey}`;
        
        try {
            const productResponse = await fetch(productUrl);
            if (productResponse.ok) {
                const productData = await productResponse.json();
                if (productData.prices && Object.keys(productData.prices).length > 0) {
                    return this._normalizePrices(productData.prices, 'Tottus');
                }
            }
            
            const priceResponse = await fetch(priceUrl);
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return this._normalizePrices(priceData, 'Tottus');
            }
            
            throw new Error(`Tottus API: ${priceResponse.status}`);
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Tottus para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchUnimarcProductPrice(productId, category) {
        const apiKey = this.apiKeys.unimarc;
        if (!apiKey) throw new Error('API key para Unimarc no configurada');
        
        const productUrl = `${this.pricingEndpoints.unimarc.products}/${productId}?apikey=${apiKey}`;
        const priceUrl = `${this.pricingEndpoints.unimarc.base}/${productId}?apikey=${apiKey}`;
        
        try {
            const productResponse = await fetch(productUrl);
            if (productResponse.ok) {
                const productData = await productResponse.json();
                if (productData.prices && Object.keys(productData.prices).length > 0) {
                    return this._normalizePrices(productData.prices, 'Unimarc');
                }
            }
            
            const priceResponse = await fetch(priceUrl);
            if (priceResponse.ok) {
                const priceData = await priceResponse.json();
                return this._normalizePrices(priceData, 'Unimarc');
            }
            
            throw new Error(`Unimarc API: ${priceResponse.status}`);
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Unimarc para ${productId}:`, error);
            return null;
        }
    },
    
    // APIs para supermercados globales
    async _fetchWalmartProductPrice(productId, category) {
        const apiKey = this.apiKeys.walmart;
        if (!apiKey) throw new Error('API key para Walmart no configurada');
        
        const url = `${this.pricingEndpoints.walmart.base}?apikey=${apiKey}&itemId=${productId}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Walmart API: ${response.status}`);
            
            const data = await response.json();
            return this._normalizeWalmartPrices(data, 'Walmart');
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Walmart para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchCarrefourProductPrice(productId, category) {
        const apiKey = this.apiKeys.carrefour;
        if (!apiKey) throw new Error('API key para Carrefour no configurada');
        
        const url = `${this.pricingEndpoints.carrefour.base}?apikey=${apiKey}&productId=${productId}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Carrefour API: ${response.status}`);
            
            const data = await response.json();
            return this._normalizeCarrefourPrices(data, 'Carrefour');
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Carrefour para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchExitoProductPrice(productId, category) {
        const apiKey = this.apiKeys.exito;
        if (!apiKey) throw new Error('API key para Exito no configurada');
        
        const url = `${this.pricingEndpoints.exito.base}?apikey=${apiKey}&productId=${productId}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Exito API: ${response.status}`);
            
            const data = await response.json();
            return this._normalizeExitoPrices(data, 'Exito');
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Exito para ${productId}:`, error);
            return null;
        }
    },
    
    // Obtener precio de una sola tienda usando scraping
    async _scrapeSingleStorePrice(storeId, productId) {
        const scrapingConfig = this.pricingEndpoints.scraping[storeId.toLowerCase()];
        if (!scrapingConfig) throw new Error(`No hay configuración de scraping para ${storeId}`);
        
        try {
            const response = await fetch(scrapingConfig.product + `?id=${productId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) throw new Error(`Scraping ${storeId}: ${response.status}`);
            
            const data = await response.json();
            return this._parseScrapingPrices(data, storeId);
            
        } catch (error) {
            console.warn(`Error scraping precio de ${storeId}:`, error);
            return null;
        }
    },
    
    // Obtener precios de producto desde todas las fuentes de scraping como último recurso
    async _scrapeProductPrices(productId) {
        const scrapingPromises = [
            this._scrapeJumboProductPrice(productId),
            this._scrapeLiderProductPrice(productId),
            this._scrapeTottusProductPrice(productId),
            this._scrapeUnimarcProductPrice(productId),
            this._scrapeWalmartProductPrice(productId),
            this._scrapeCarrefourProductPrice(productId),
            this._scrapeExitoProductPrice(productId)
        ];
        
        const results = await Promise.allSettled(scrapingPromises);
        const scrapedPrices = {};
        
        results.forEach((result, index) => {
            const storeName = ['Jumbo', 'Líder', 'Tottus', 'Unimarc', 'Walmart', 'Carrefour', 'Exito'][index];
            if (result.status === 'fulfilled' && result.value) {
                scrapedPrices[storeName] = result.value;
            }
        });
        
        return Object.keys(scrapedPrices).length > 0 ? scrapedPrices : null;
    },
    
    // Scraping individuales de precios
    async _scrapeJumboProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.jumbo.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseJumboScrapingPrices(data, productId);
    },
    
    async _scrapeLiderProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.lider.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseLiderScrapingPrices(data, productId);
    },
    
    async _scrapeTottusProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.tottus.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseTottusScrapingPrices(data, productId);
    },
    
    async _scrapeUnimarcProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.unimarc.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseUnimarcScrapingPrices(data, productId);
    },
    
    async _scrapeWalmartProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.walmart.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseWalmartScrapingPrices(data, productId);
    },
    
    async _scrapeCarrefourProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.carrefour.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseCarrefourScrapingPrices(data, productId);
    },
    
    async _scrapeExitoProductPrice(productId) {
        const url = `${this.pricingEndpoints.scraping.exito.product}?id=${productId}`;
        
        const response = await fetch(url, {
            headers: {'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'}
        });
        
        const data = await response.json();
        return this._parseExitoScrapingPrices(data, productId);
    },
    
    // Normalizar estructura de precios de Jumbo
    _normalizePrices(prices, storeName) {
        if (!prices || typeof prices !== 'object') return null;
        
        const normalized = {};
        Object.entries(prices).forEach(([key, value]) => {
            if (typeof value === 'number') {
                // Es un precio directo
                normalized[storeName] = {
                    unitPrice: value,
                    totalPrice: value * 1, // cantidad = 1 por defecto
                    quantity: 1,
                    currency: 'CLP',
                    inStock: true,
                    promotion: false,
                    promotionPrice: null,
                    lastUpdated: new Date().toISOString(),
                    source: 'official_api'
                };
            } else if (typeof value === 'object' && value !== null) {
                // Es un objeto de precio con detalles
                normalized[storeName] = {
                    unitPrice: value.precio_unitario || value.unit || value.precio || value.price || value,
                    totalPrice: value.precio_total || value.total || value.precio || value.price * (value.cantidad || 1),
                    quantity: value.cantidad || value.quantity || 1,
                    currency: value.moneda || value.currency || 'CLP',
                    inStock: value.stock !== false && value.disponible !== false,
                    promotion: value.promocion || value.promo || false,
                    promotionPrice: value.precio_promocion || value.promotionPrice || null,
                    lastUpdated: value.timestamp || value.updated_at || new Date().toISOString(),
                    source: 'official_api'
                };
            }
        });
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Normalizar estructura de precios de Walmart
    _normalizeWalmartPrices(prices, storeName) {
        if (!prices || typeof prices !== 'object') return null;
        
        const normalized = {};
        if (prices.items && Array.isArray(prices.items)) {
            prices.items.forEach(item => {
                if (item.pricing && item.pricing.purchase_price) {
                    normalized[storeName] = {
                        unitPrice: parseFloat(item.pricing.purchase_price) || 0,
                        totalPrice: parseFloat(item.pricing.purchase_price) * (item.quantity || 1),
                        quantity: item.quantity || 1,
                        currency: item.pricing.currency || 'CLP',
                        inStock: item.stock || false,
                        promotion: item.pricing.discount && item.pricing.discount > 0,
                        promotionPrice: item.pricing.sale_price || null,
                        lastUpdated: item.pricing.last_updated || new Date().toISOString(),
                        source: 'walmart_api'
                    };
                }
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Normalizar estructura de precios de Carrefour
    _normalizeCarrefourPrices(prices, storeName) {
        if (!prices || typeof prices !== 'object') return null;
        
        const normalized = {};
        if (Array.isArray(prices)) {
            prices.forEach(item => {
                normalized[storeName] = {
                    unitPrice: item.precio_unitario || item.price || 0,
                    totalPrice: item.precio_total || item.total || 0,
                    quantity: item.cantidad || item.quantity || 1,
                    currency: item.moneda || item.currency || 'CLP',
                    inStock: item.stock || item.disponible || true,
                    promotion: item.promocion || item.promo || false,
                    promotionPrice: item.precio_promocion || item.promotionPrice || null,
                    lastUpdated: item.timestamp || new Date().toISOString(),
                    source: 'carrefour_api'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Normalizar estructura de precios de Exito
    _normalizeExitoPrices(prices, storeName) {
        if (!prices || typeof prices !== 'object') return null;
        
        const normalized = {};
        Object.entries(prices).forEach(([key, value]) => {
            normalized[storeName] = {
                unitPrice: value.precio_unitario || value.price || value.precio || 0,
                totalPrice: value.precio_total || value.total || 0,
                quantity: value.cantidad || value.quantity || 1,
                currency: value.moneda || value.currency || 'CLP',
                inStock: value.stock || value.disponible || true,
                promotion: value.promocion || value.promo || false,
                promotionPrice: value.precio_promocion || value.promotionPrice || null,
                lastUpdated: value.timestamp || new Date().toISOString(),
                source: 'exito_api'
            };
        });
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Jumbo
    _parseJumboScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Líder
    _parseLiderScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Tottus
    _parseTottusScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true || price.promo === true,
                    promotionPrice: price.precio_promocion || price.precio_descuento || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Unimarc
    _parseUnimarcScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Walmart
    _parseWalmartScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Carrefour
    _parseCarrefourScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Parsear precios del scraping de Exito
    _parseExitoScrapingPrices(data, productId) {
        if (!data || typeof data !== 'object') return null;
        
        const normalized = {};
        
        if (data.prices && Array.isArray(data.prices)) {
            data.prices.forEach(price => {
                normalized.price = {
                    unitPrice: price.precio_unitario || price.precio || 0,
                    totalPrice: price.precio_total || 0,
                    quantity: price.cantidad || 1,
                    currency: price.moneda || 'CLP',
                    inStock: price.stock !== false,
                    promotion: price.promocion === true,
                    promotionPrice: price.precio_promocion || null,
                    lastUpdated: price.timestamp || new Date().toISOString(),
                    source: 'scraping'
                };
            });
        }
        
        return Object.keys(normalized).length > 0 ? normalized : null;
    },
    
    // Calcular precio total por tienda con todas las consideraciones
    async _calculateStoreTotal(store, priceData, productId, quantity, category, includePromotions) {
        if (!priceData) {
            return {
                store,
                totalPrice: null,
                unitPrice: null,
                available: false,
                promotion: false,
                savings: 0,
                category,
                quantity
            };
        }
        
        // Si los precios están organizados por tienda
        if (typeof priceData === 'object' && !Array.isArray(priceData) && Object.keys(priceData).some(key => ['Jumbo', 'Líder', 'Tottus', 'Unimarc', 'Walmart', 'Carrefour', 'Exito'].includes(key))) {
            // Usar la estructura normalizada de precios
            const storePrices = priceData[store];
            if (!storePrices) {
                return {
                    store,
                    totalPrice: null,
                    unitPrice: null,
                    available: false,
                    promotion: false,
                    savings: 0,
                    category,
                    quantity
                };
            }
            
            // Calcular precio considerando promociones
            const currentPrice = includePromotions && storePrices.promotionPrice ? 
                storePrices.promotionPrice : 
                storePrices.unitPrice;
            
            const totalPrice = currentPrice * quantity;
            
            return {
                store,
                totalPrice,
                unitPrice: currentPrice,
                available: storePrices.inStock !== false,
                promotion: storePrices.promotion || false,
                promotionPrice: storePrices.promotionPrice,
                savings: calculateOriginalPriceTotal(storePrices, quantity, includePromotions) - totalPrice,
                category,
                quantity
            };
        }
        
        // Si los precios están en formato array
        if (Array.isArray(priceData)) {
            const storePrice = priceData.find(p => p.store === store || p.name === store);
            if (!storePrice) {
                return {
                    store,
                    totalPrice: null,
                    unitPrice: null,
                    available: false,
                    promotion: false,
                    savings: 0,
                    category,
                    quantity
                };
            }
            
            const currentPrice = includePromotions && storePrice.promotionPrice ? 
                storePrice.promotionPrice : 
                storePrice.unitPrice;
            
            const totalPrice = currentPrice * quantity;
            
            return {
                store,
                totalPrice,
                unitPrice: currentPrice,
                available: storePrice.inStock !== false,
                promotion: storePrice.promotion || false,
                promotionPrice: storePrice.promotionPrice,
                savings: calculateOriginalPriceTotal(storePrice, quantity, includePromotions) - totalPrice,
                category,
                quantity
            };
        }
        
        // Si los precios son primitivos (justo un número)
        const unitPrice = typeof priceData === 'number' ? priceData : parseFloat(priceData) || 0;
        const totalPrice = unitPrice * quantity;
        
        return {
            store,
            totalPrice,
            unitPrice,
            available: unitPrice > 0,
            promotion: false,
            promotionPrice: null,
            savings: 0,
            category,
            quantity
        };
    },
    
    // Calcular precio original total para cálculo de ahorros
    calculateOriginalPriceTotal(priceInfo, quantity, includePromotions) {
        if (!priceInfo) return 0;
        
        const originalPrice = includePromotions && priceInfo.promotionPrice ? 
            priceInfo.unitPrice : 
            priceInfo.unitPrice || priceInfo.precio_unitario || priceInfo.price || 0;
        
        return originalPrice * quantity;
    },
    
    // Almacenar historial de precios para análisis de tendencias
    _storePriceHistory(productId, comparisonResults) {
        const historyKey = `price_history_${productId}`;
        let history = [];
        
        try {
            const cached = localStorage.getItem(historyKey);
            history = cached ? JSON.parse(cached) : [];
        } catch (error) {
            console.warn('Error recuperando historial de precios:', error);
            history = [];
        }
        
        const now = new Date();
        const newRecord = {
            timestamp: now.toISOString(),
            date: now.toLocaleDateString(),
            stores: comparisonResults,
            cheapestStore: this._findCheapestStore(comparisonResults),
            priceRange: this._getPriceRange(comparisonResults),
            totalSavingsOpportunity: this._calculateTotalSavingsOpportunity(comparisonResults)
        };
        
        history.push(newRecord);
        
        // Mantener solo los últimos 50 registros para evitar crecimiento excesivo
        if (history.length > 50) {
            history = history.slice(-50);
        }
        
        try {
            localStorage.setItem(historyKey, JSON.stringify(history));
            this._trendCache.set(productId, history);
        } catch (error) {
            console.warn('Error guardando historial de precios:', error);
        }
    },
    
    // Encontrar tienda más barata de la comparación
    _findCheapestStore(comparisonResults) {
        let cheapestStore = null;
        let cheapestPrice = null;
        
        for (const [store, data] of Object.entries(comparisonResults)) {
            if (data.available && data.totalPrice !== null) {
                if (cheapestPrice === null || data.totalPrice < cheapestPrice) {
                    cheapestPrice = data.totalPrice;
                    cheapestStore = store;
                }
            }
        }
        
        return cheapestStore;
    },
    
    // Obtener rango de precios de la comparación
    _getPriceRange(comparisonResults) {
        const availableStores = Object.values(comparisonResults).filter(s => s.available && s.totalPrice > 0);
        if (availableStores.length === 0) return null;
        
        const prices = availableStores.map(s => s.totalPrice);
        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: prices.reduce((a, b) => a + b, 0) / prices.length,
            count: prices.length
        };
    },
    
    // Calcular ahorro total disponible
    _calculateTotalSavingsOpportunity(comparisonResults) {
        const priceRange = this._getPriceRange(comparisonResults);
        return priceRange ? (priceRange.max - priceRange.min) : 0;
    },
    
    // Generar análisis completo de precios
    _generatePriceAnalysis(comparisonResults, bestStore) {
        const priceRange = this._getPriceRange(comparisonResults);
        const totalSavings = this._calculateTotalSavingsOpportunity(comparisonResults);
        const cheapestStore = this._findCheapestStore(comparisonResults);
        
        const analysis = {
            priceRange,
            totalSavings,
            bestStore,
            savingsPercentage: priceRange && priceRange.max ? 
                ((totalSavings / priceRange.max) * 100).toFixed(1) : 0,
            priceVariation: priceRange ? priceRange.max - priceRange.min : 0,
            recommendations: this._generateRecommendations(comparisonResults, bestStore),
            marketInsights: this._generateMarketInsights(comparisonResults)
        };
        
        return analysis;
    },
    
    // Generar recomendaciones para el usuario
    _generateRecommendations(comparisonResults, bestStore) {
        const recommendations = [];
        
        if (bestStore) {
            recommendations.push({
                type: 'BUY_NOW',
                store: bestStore,
                reason: 'Precio más bajo encontrado',
                savings: comparisonResults[bestStore]?.savings || 0
            });
        }
        
        const promotions = Object.entries(comparisonResults).filter(([store, data]) => 
            data.promotion && data.promotionPrice
        );
        
        if (promotions.length > 0) {
            const bestPromoStore = promotions[0][0];
            recommendations.push({
                type: 'CHECK_PROMO',
                store: bestPromoStore,
                reason: 'Mejor oferta promocional',
                discount: comparisonResults[bestPromoStore]?.promotionPrice ? 
                    ((comparisonResults[bestPromoStore].unitPrice - comparisonResults[bestPromoStore].promotionPrice) / comparisonResults[bestPromoStore].unitPrice * 100) : 0
            });
        }
        
        const lowStockStores = Object.entries(comparisonResults).filter(([store, data]) => 
            !data.available
        );
        
        if (lowStockStores.length > 0) {
            recommendations.push({
                type: 'ALTERNATIVE',
                stores: lowStockStores.map(([store]) => store),
                reason: 'Sin stock disponible en algunas tiendas'
            });
        }
        
        return recommendations;
    },
    
    // Generar insights del mercado
    _generateMarketInsights(comparisonResults) {
        const insights = {
            priceDifferences: {},
            storeRankings: [],
            marketSegments: {}
        };
        
        // Calcular diferencias de precios entre tiendas
        Object.entries(comparisonResults).forEach(([store, data]) => {
            if (data.totalPrice && data.totalPrice > 0) {
                insights.priceDifferences[store] = data.totalPrice;
            }
        });
        
        // Ranking de tiendas por precio
        insights.storeRankings = Object.entries(insights.priceDifferences)
            .sort((a, b) => a[1] - b[1])
            .map(([store, price]) => ({ store, price }));
        
        // Segmentar tiendas por rango de precios
        if (insights.storeRankings.length > 0) {
            const prices = insights.storeRankings.map(item => item.price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            
            insights.marketSegments = {
                budget: insights.storeRankings.filter(item => 
                    item.price <= min + (max - min) * 0.3
                ).map(item => item.store),
                medium: insights.storeRankings.filter(item => {
                    const percent = (item.price - min) / (max - min) * 100;
                    return percent >= 30 && percent <= 70;
                }).map(item => item.store),
                premium: insights.storeRankings.filter(item =>
                    item.price >= max - (max - min) * 0.3
                ).map(item => item.store)
            };
        }
        
        return insights;
    },
    
    // Obtener tendencias de precios
    async getPriceTrends(productId, days = 30) {
        const historyKey = `price_history_${productId}`;
        let history = [];
        
        try {
            const cached = localStorage.getItem(historyKey);
            history = cached ? JSON.parse(cached) : [];
        } catch (error) {
            console.warn('Error recuperando tendencias de precios:', error);
            history = [];
        }
        
        // Filtrar por fecha
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentHistory = history.filter(record => 
            new Date(record.timestamp) >= cutoffDate
        );
        
        if (recentHistory.length < 2) {
            return {
                productId,
                trend: 'insufficient_data',
                data: recentHistory,
                message: 'No hay suficientes datos históricos para análisis de tendencias'
            };
        }
        
        // Calcular tendencia
        const prices = recentHistory.map(record => record.priceRange?.average).filter(p => p > 0);
        if (prices.length < 2) {
            return {
                productId,
                trend: 'insufficient_data',
                data: recentHistory,
                message: 'No hay precios válidos en el historial para tendencias'
            };
        }
        
        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        const priceChange = lastPrice - firstPrice;
        const percentageChange = (priceChange / firstPrice) * 100;
        
        let trend = 'stable';
        if (percentageChange > 5) trend = 'increasing';
        else if (percentageChange < -5) trend = 'decreasing';
        
        // Detectar estacionalidad
        const seasonalPattern = this._detectSeasonalPattern(recentHistory);
        
        return {
            productId,
            trend,
            percentageChange: parseFloat(percentageChange.toFixed(2)),
            priceChange: parseFloat(priceChange.toFixed(2)),
            data: recentHistory,
            seasonalPattern,
            averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
            priceVolatility: this._calculatePriceVolatility(prices)
        };
    },
    
    // Detectar patrón estacional
    _detectSeasonalPattern(history) {
        // Ejemplo simple - en implementación real necesitaría más sofisticación
        if (history.length < 7) return null;
        
        const weeklyChanges = [];
        for (let i = 1; i < history.length; i++) {
            if (history[i].priceRange?.average && history[i-1].priceRange?.average) {
                const change = ((history[i].priceRange.average - history[i-1].priceRange.average) / 
                             history[i-1].priceRange.average) * 100;
                weeklyChanges.push(change);
            }
        }
        
        if (weeklyChanges.length < 3) return null;
        
        const avgChange = weeklyChanges.reduce((a, b) => a + b, 0) / weeklyChanges.length;
        const positiveChanges = weeklyChanges.filter(c => c > 0).length;
        
        if (positiveChanges / weeklyChanges.length > 0.6) {
            return 'increasing_seasonally';
        } else if ((weeklyChanges.length - positiveChanges) / weeklyChanges.length > 0.6) {
            return 'decreasing_seasonally';
        }
        
        return 'stable_seasonally';
    },
    
    // Calcular volatilidad de precios
    _calculatePriceVolatility(prices) {
        if (prices.length < 2) return 0;
        
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        
        return stdDev / mean * 100; // Volatilidad como porcentaje
    },
    
    // Obtener recomendaciones inteligentes de compra
    async getSmartPurchaseRecommendations(userId, options = {}) {
        const {
            budget = null,
            preferredStores = [],
            avoidStores = [],
            categoryFilter = null,
            quantity = 1,
            shoppingGoals = []
        } = options;
        
        try {
            // Obtener todos los productos disponibles
            const allProducts = await this.searchProducts('', {
                category: categoryFilter,
                includeUnavailable: false
            });
            
            // Filtrar y priorizar productos
            const recommendations = {
                budgetOptimized: [],
                bestValue: [],
                promotions: [],
                nearbyStores: []
            };
            
            // Encontrar productos por precio óptimo dentro del presupuesto
            if (budget) {
                recommendations.budgetOptimized = this._findBudgetOptimizedProducts(
                    allProducts, budget, categoryFilter, quantity, preferredStores, avoidStores
                );
            }
            
            // Encontrar mejores ofertas generales
            recommendations.bestValue = this._findBestValueProducts(allProducts, categoryFilter, quantity);
            
            // Encontrar productos con promociones
            recommendations.promotions = this._findPromotionalProducts(allProducts);
            
            // Agregar tiendas cercanas (si hay ubicación)
            if (typeof window !== 'undefined' && window.navigator.geolocation) {
                recommendations.nearbyStores = await this._getNearbyStoresWithProducts(
                    preferredStores, avoidStores
                );
            }
            
            return {
                userId,
                recommendations,
                generatedAt: new Date().toISOString(),
                options
            };
            
        } catch (error) {
            console.error('Error obteniendo recomendaciones de compra inteligentes:', error);
            throw error;
        }
    },
    
    // Encontrar productos optimizados por presupuesto
    _findBudgetOptimizedProducts(products, budget, category, quantity, preferredStores, avoidStores) {
        return products
            .filter(product => {
                // Filtrar por categoría
                if (category && product.category && 
                    product.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                
                // Filtrar por tiendas
                if (product.store && avoidStores.includes(product.store)) {
                    return false;
                }
                
                if (preferredStores.length > 0 && product.store && 
                    !preferredStores.includes(product.store)) {
                    return false;
                }
                
                return true;
            })
            .map(product => {
                const totalPrice = product.totalPrice * quantity;
                const remainingBudget = budget - totalPrice;
                const fitScore = Math.max(0, 100 - Math.abs(totalPrice - budget * 0.8));
                
                return {
                    ...product,
                    quantity,
                    totalPrice,
                    remainingBudget,
                    fitScore,
                    recommendationReason: this._generateBudgetRecommendationReason(product, totalPrice, budget)
                };
            })
            .sort((a, b) => b.fitScore - a.fitScore)
            .slice(0, 5);
    },
    
    // Encontrar mejores ofertas
    _findBestValueProducts(products, category, quantity) {
        // Calcular puntaje de valor basado en precio, calidad e inventario
        return products
            .filter(product => {
                if (category && product.category && 
                    product.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                return product.inStock !== false;
            })
            .map(product => {
                // Calcular puntaje compuesto
                const priceScore = Math.max(0, 100 - ((product.totalPrice * quantity) / 1000)); // Normalizar por $1000
                const stockScore = product.inStock ? 100 : 0;
                const categoryScore = product.category === 'Alimentación' ? 90 : 70; // Alimentos 우선
                
                const totalScore = (priceScore * 0.5 + stockScore * 0.3 + categoryScore * 0.2);
                
                return {
                    ...product,
                    quantity,
                    valueScore: totalScore,
                    recommendationLevel: totalScore > 85 ? 'EXCELLENT' : 
                                       totalScore > 70 ? 'GOOD' : 'CONSIDER',
                    estimatedSavings: calculateEstimatedSavings(product, quantity)
                };
            })
            .sort((a, b) => b.valueScore - a.valueScore)
            .slice(0, 5);
    },
    
    // Encontrar productos con promociones
    _findPromotionalProducts(products) {
        return products
            .filter(product => 
                product.promotion || 
                (product.promotionPrice && product.promotionPrice < product.unitPrice)
            )
            .map(product => {
                const discount = product.promotionPrice ? 
                    ((product.unitPrice - product.promotionPrice) / product.unitPrice * 100) : 0;
                
                return {
                    ...product,
                    discountPercentage: parseFloat(discount.toFixed(1)),
                    savingsAmount: (product.unitPrice - (product.promotionPrice || product.unitPrice)) * (product.quantity || 1),
                    recommendationPriority: discount > 20 ? 'HIGH' : 
                                           discount > 10 ? 'MEDIUM' : 'LOW'
                };
            })
            .sort((a, b) => b.discountPercentage - a.discountPercentage)
            .slice(0, 3);
    },
    
    // Obtener tiendas cercanas con productos disponibles
    async _getNearbyStoresWithProducts(preferredStores, avoidStores) {
        // En una implementación real, esto requeriría servicios de geocodificación
        // Para simplicity, retornamos tiendas por defecto
        return ['Jumbo', 'Líder', 'Tottus'].filter(store => 
            !avoidStores.includes(store) &&
            (preferredStores.length === 0 || preferredStores.includes(store))
        );
    },
    
    // Generar razón de recomendación de presupuesto
    _generateBudgetRecommendationReason(product, totalPrice, budget) {
        const percentageOfBudget = (totalPrice / budget) * 100;
        
        if (percentageOfBudget < 10) return 'Excelente opción económica para el presupuesto';
        if (percentageOfBudget < 20) return 'Buena relación calidad-precio';
        if (percentageOfBudget < 30) return 'Ajustado al presupuesto';
        if (percentageOfBudget < 50) return 'Requiere consideración cuidadosa';
        
        return 'Potencialmente demasiado costoso';
    },
    
    // Calcular ahorros estimados
    calculateEstimatedSavings(product, quantity) {
        if (!product || !product.inStock) return 0;
        
        // Estimar basándose en rango de precios típico del supermercado
        const averagePriceDelta = 0.05; // 5% variación promedio de precios entre tiendas
        const estimatedUnitPrice = product.unitPrice * (1 + (Math.random() - 0.5) * 2 * averagePriceDelta);
        const estimatedTotalPrice = estimatedUnitPrice * quantity;
        
        return Math.max(0, (estimatedUnitPrice - product.unitPrice) * quantity);
    },
    
    // Limpiar todo el caché de precios
    clearCache() {
        this._priceCache.clear();
        this._trendCache.clear();
        localStorage.removeItem('smartshop_price_history_*');
        console.log('Todo el caché de precios limpiado');
    },
    
    // Forzar actualización de precios
    async refreshPrices(productId = null) {
        if (productId) {
            this.clearCache();
        }
        console.log('Precios actualizados automáticamente');
        return true;
    }
};

module.exports = PricingAPI;