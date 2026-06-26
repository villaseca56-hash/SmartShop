// apis/ProductCatalogAPI.js - Servicio para búsqueda y precios de productos en vivo

const ProductCatalogAPI = {
    
    // Caché para contenido del catálogo
    _catalogCache: null,
    _cacheExpiry: 30 * 60 * 1000, // 30 minutos
    _priceCache: new Map(), // Caché de precios por tienda y producto
    
    // URLs de APIs de catálogo por supermercado
    catalogEndpoints: {
        jumbo: 'https://api.jumbo.cl/v1/catalog',
        lider: 'https://api.lider.cl/v1/catalog',
        tottus: 'https://api.tottus.cl/v1/catalog',
        unimarc: 'https://api.unimarc.cl/v1/catalog',
        // URLs de scraping para websites de supermercados sin API oficial
        scraping: {
            jumbo: 'https://www.jumbo.cl/api/v1/products/search',
            lider: 'https://www.lider.cl/api/v1/products',
            tottus: 'https://www.tottus.cl/api/v1/products',
            unimarc: 'https://www.unimarc.cl/api/v1/products'
        }
    },
    
    // Claves de APIs (ejemplo - en producción deberían estar en variables de entorno)
    apiKeys: {
        jumbo: 'TU_CLAVE_API_JUMBO_AQUÍ',
        lider: 'TU_CLAVE_API_LIDER_AQUÍ',
        tottus: 'TU_CLAVE_API_TOTTUS_AQUÍ',
        unimarc: 'TU_CLAVE_API_UNIMARC_AQUÍ'
    },
    
    // Buscar productos por palabras clave
    async searchProducts(keyword, options = {}) {
        const {
            category = null,
            limit = 20,
            includeUnavailable = false,
            storeId = null
        } = options;
        
        try {
            console.log(`Buscando productos para: "${keyword}" en categoría: ${category || 'todas'}`);
            
            // Verificar si el catálogo está en caché y es válido
            if (this._isCatalogCacheValid()) {
                console.log('Usando catálogo en caché');
                const cachedData = this._catalogCache;
                return this._filterAndSearchCatalog(cachedData, keyword, category, limit, includeUnavailable, storeId);
            }
            
            // Si no hay caché o está caducado, intentar APIs oficiales primero
            let catalogData = null;
            const catalogsPromises = [
                this._fetchJumboCatalog(),
                this._fetchLiderCatalog(),
                this._fetchTottusCatalog(),
                this._fetchUnimarcCatalog()
            ];
            
            const results = await Promise.allSettled(catalogsPromises);
            let allProducts = [];
            
            // Recopilar productos de APIs exitosas
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const storeName = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'][index];
                    const products = result.value.map(product => ({
                        ...product,
                        sourceStore: storeName,
                        lastUpdated: new Date().toISOString()
                    }));
                    allProducts = allProducts.concat(products);
                }
            });
            
            // Si las APIs oficiales fallan, usar scraping como fallback
            if (allProducts.length === 0) {
                console.log('Las APIs oficiales fallaron, usando scraping como fallback...');
                catalogData = await this._scrapeProductsFromWebsites(keyword, category, limit);
            } else {
                catalogData = allProducts;
                // Guardar en caché el catálogo
                this._catalogCache = catalogData;
                localStorage.setItem('smartshop_catalog_cache', JSON.stringify(catalogData));
                localStorage.setItem('smartshop_catalog_timestamp', Date.now().toString());
            }
            
            return this._filterAndSearchCatalog(catalogData, keyword, category, limit, includeUnavailable, storeId);
            
        } catch (error) {
            console.error('Error buscando productos:', error);
            
            // Intentar recuperar desde caché en caso de error
            const cachedData = this._getCachedCatalog();
            if (cachedData && cachedData.length > 0) {
                console.log('Usando catálogo desde caché debido a error');
                return this._filterAndSearchCatalog(cachedData, keyword, category, limit, options.includeUnavailable || false, options.storeId);
            }
            
            throw error;
        }
    },
    
    // Obtener precios de un producto específico de una tienda
    async getProductPrices(storeId, productId) {
        const cacheKey = `${storeId}:${productId}`;
        
        // Verificar si los precios están en caché
        if (this._priceCache.has(cacheKey)) {
            const cachedData = this._priceCache.get(cacheKey);
            if ((Date.now() - cachedData.timestamp) < 300000) { // 5 minutos
                return cachedData.prices;
            }
        }
        
        try {
            // Intentar obtener precios desde API oficial del supermercado
            let prices = null;
            
            switch (storeId) {
                case 'Jumbo':
                    prices = await this._fetchJumboPrices(productId);
                    break;
                case 'Líder':
                    prices = await this._fetchLiderPrices(productId);
                    break;
                case 'Tottus':
                    prices = await this._fetchTottusPrices(productId);
                    break;
                case 'Unimarc':
                    prices = await this._fetchUnimarcPrices(productId);
                    break;
                default:
                    throw new Error(`Tienda no soportada: ${storeId}`);
            }
            
            if (prices) {
                // Guardar en caché los precios
                this._priceCache.set(cacheKey, {
                    prices,
                    timestamp: Date.now()
                });
                return prices;
            }
            
            throw new Error('No se pudieron obtener precios del supermercado');
            
        } catch (error) {
            console.error(`Error obteniendo precios para ${storeId}:${productId}:`, error);
            
            // Intentar recuperar desde caché en caso de error
            const cachedData = this._priceCache.get(cacheKey);
            if (cachedData) {
                console.log('Usando precios desde caché debido a error');
                return cachedData.prices;
            }
            
            throw error;
        }
    },
    
    // Forzar limpieza de caché de precios para un producto específico
    invalidatePriceCache(productId) {
        const keysToDelete = [];
        this._priceCache.forEach((value, key) => {
            if (key.includes(`:${productId}`)) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            this._priceCache.delete(key);
        });
        
        console.log(`Caché de precios limpiado para producto: ${productId}`);
    },
    
    // Obtener catálogo completo de un supermercado específico
    async getStoreCatalog(storeId, options = {}) {
        const { category = null, includeUnavailable = false } = options;
        
        let products = [];
        
        try {
            switch (storeId) {
                case 'Jumbo':
                    products = await this._fetchJumboCatalog();
                    break;
                case 'Líder':
                    products = await this._fetchLiderCatalog();
                    break;
                case 'Tottus':
                    products = await this._fetchTottusCatalog();
                    break;
                case 'Unimarc':
                    products = await this._fetchUnimarcCatalog();
                    break;
                default:
                    throw new Error(`Tienda no soportada: ${storeId}`);
            }
            
            // Filtrar por categoría si se especifica
            if (category) {
                products = products.filter(product => 
                    product.category && product.category.toLowerCase() === category.toLowerCase()
                );
            }
            
            // Filtrar productos no disponibles si se especifica
            if (!includeUnavailable) {
                products = products.filter(product => product.inStock !== false);
            }
            
            return products;
            
        } catch (error) {
            console.error(`Error obteniendo catálogo para ${storeId}:`, error);
            throw error;
        }
    },
    
    // Buscar productos similares con coincidencia de palabras clave
    async searchSimilarProducts(productId, limit = 10) {
        try {
            const catalog = await this.searchProducts('');
            const targetProduct = catalog.find(p => p.id === productId || p.sku === productId);
            
            if (!targetProduct) {
                throw new Error(`Producto no encontrado en el catálogo: ${productId}`);
            }
            
            // Obtener tiendas similares basándose en categoría, keywords o nombre del producto
            const similarProducts = catalog
                .filter(p => p.id !== productId && p.id !== targetProduct.id)
                .map(p => {
                    // Calcular puntuación de similitud
                    let similarityScore = 0;
                    
                    if (targetProduct.category && p.category && 
                        targetProduct.category.toLowerCase() === p.category.toLowerCase()) {
                        similarityScore += 0.4;
                    }
                    
                    if (targetProduct.keywords && p.keywords) {
                        const commonKeywords = targetProduct.keywords.filter(keyword => 
                            p.keywords.some(pk => pk.toLowerCase().includes(keyword.toLowerCase()))
                        );
                        if (commonKeywords.length > 0) {
                            similarityScore += (commonKeywords.length / targetProduct.keywords.length) * 0.3;
                        }
                    }
                    
                    if (targetProduct.name && p.name) {
                        const targetWords = targetProduct.name.toLowerCase().split(' ');
                        const productWords = p.name.toLowerCase().split(' ');
                        const commonWords = targetWords.filter(word => 
                            productWords.includes(word) && word.length > 3
                        );
                        if (commonWords.length > 0) {
                            similarityScore += (commonWords.length / Math.max(targetWords.length, productWords.length)) * 0.3;
                        }
                    }
                    
                    return {
                        ...p,
                        similarityScore,
                        matchReason: this._generateMatchReason(targetProduct, p, similarityScore)
                    };
                })
                .filter(p => p.similarityScore > 0.1) // Solo incluir coincidencias significativas
                .sort((a, b) => b.similarityScore - a.similarityScore)
                .slice(0, limit);
            
            return similarProducts;
            
        } catch (error) {
            console.error('Error buscando productos similares:', error);
            throw error;
        }
    },
    
    // Buscar productos por categoría
    async searchByCategory(category, limit = 20) {
        const catalog = await this.searchProducts('');
        const filteredProducts = catalog
            .filter(product => 
                product.category && 
                product.category.toLowerCase() === category.toLowerCase()
            )
            .slice(0, limit);
        
        return filteredProducts;
    },
    
    // Obtener estado de inventario de un producto específico en una tienda
    async getInventoryStatus(storeId, productId) {
        try {
            const prices = await this.getProductPrices(storeId, productId);
            
            // Si el precio existe, asumimos que el producto está disponible
            // En un sistema real, esto debería venir de una API de inventario
            const isAvailable = prices && Object.keys(prices).length > 0;
            
            return {
                productId,
                storeId,
                available: isAvailable,
                priceInfo: prices,
                lastChecked: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error obteniendo inventario para ${storeId}:${productId}:`, error);
            return {
                productId,
                storeId,
                available: false,
                error: error.message,
                lastChecked: new Date().toISOString()
            };
        }
    },
    
    // Obtener productos de un supermercado específico con precios actuales
    async getStoreProductsWithPrices(storeId, options = {}) {
        const { keyword = null, category = null } = options;
        
        try {
            // Obtener productos del supermercado
            const products = await this.getStoreCatalog(storeId, options);
            
            // Obtener precios para cada producto
            const productsWithPrices = await Promise.all(
                products.map(async (product) => {
                    try {
                        const prices = await this.getProductPrices(storeId, product.id || product.sku);
                        return {
                            ...product,
                            prices: prices || {},
                            priceCount: prices ? Object.keys(prices).length : 0
                        };
                    } catch (error) {
                        console.warn(`No se pudieron obtener precios para ${product.name} en ${storeId}:`, error);
                        return {
                            ...product,
                            prices: {},
                            priceCount: 0,
                            error: error.message
                        };
                    }
                })
            );
            
            // Filtrar por palabra clave si se especifica
            const filteredProducts = keyword ? 
                productsWithPrices.filter(product => 
                    product.name && product.name.toLowerCase().includes(keyword.toLowerCase())
                ) : productsWithPrices;
            
            return filteredProducts;
            
        } catch (error) {
            console.error(`Error obteniendo productos con precios para ${storeId}:`, error);
            throw error;
        }
    },
    
    // Función auxiliar: Filtrar y buscar en catálogo
    _filterAndSearchCatalog(catalog, keyword, category, limit, includeUnavailable, storeId) {
        let filtered = catalog;
        
        // Filtrar por categoría
        if (category) {
            filtered = filtered.filter(product => 
                product.category && product.category.toLowerCase() === category.toLowerCase()
            );
        }
        
        // Filtrar por disponibilidad
        if (!includeUnavailable) {
            filtered = filtered.filter(product => product.inStock !== false);
        }
        
        // Filtrar por tienda específica
        if (storeId) {
            filtered = filtered.filter(product => 
                product.sourceStore && product.sourceStore === storeId
            );
        }
        
        // Buscar por palabra clave
        if (keyword) {
            const searchTerm = keyword.toLowerCase();
            filtered = filtered.filter(product => 
                (product.name && product.name.toLowerCase().includes(searchTerm)) ||
                (product.keywords && product.keywords.some(kw => kw.toLowerCase().includes(searchTerm))) ||
                (product.category && product.category.toLowerCase().includes(searchTerm))
            );
        }
        
        // Limitar resultados y agregar precios si es necesario
        return filtered.slice(0, limit);
    },
    
    // Función auxiliar: Generar razón de coincidencia para productos similares
    _generateMatchReason(targetProduct, similarProduct, score) {
        const reasons = [];
        
        if (targetProduct.category && similarProduct.category && 
            targetProduct.category.toLowerCase() === similarProduct.category.toLowerCase()) {
            reasons.push('mismo tipo');
        }
        
        if (targetProduct.keywords && similarProduct.keywords) {
            const common = targetProduct.keywords.filter(keyword => 
                similarProduct.keywords.some(kw => kw.toLowerCase().includes(keyword.toLowerCase()))
            );
            if (common.length > 0) {
                reasons.push('keywords comunes: ' + common.join(', '));
            }
        }
        
        if (targetProduct.name && similarProduct.name) {
            const targetWords = targetProduct.name.toLowerCase().split(' ');
            const productWords = similarProduct.name.toLowerCase().split(' ');
            const commonWords = targetWords.filter(word => 
                productWords.includes(word) && word.length > 3
            );
            if (commonWords.length > 0) {
                reasons.push('palabras comunes: ' + commonWords.join(', '));
            }
        }
        
        return reasons.length > 0 ? reasons.join(', ') : 'búsqueda general';
    },
    
    // Función auxiliar: Verificar si el caché del catálogo es válido
    _isCatalogCacheValid() {
        const cachedTimestamp = localStorage.getItem('smartshop_catalog_timestamp');
        if (!cachedTimestamp) return false;
        
        const now = Date.now();
        const cachedTime = parseInt(cachedTimestamp);
        return (now - cachedTime) < this._cacheExpiry;
    },
    
    // Función auxiliar: Obtener catálogo desde caché
    _getCachedCatalog() {
        const cached = localStorage.getItem('smartshop_catalog_cache');
        return cached ? JSON.parse(cached) : null;
    },
    
    // Cargar catálogos de APIs oficiales de supermercados
    async _fetchJumboCatalog() {
        const apiKey = this.apiKeys.jumbo;
        if (!apiKey) throw new Error('API key para Jumbo no configurada');
        
        const url = `${this.catalogEndpoints.jumbo}?apikey=${apiKey}&limit=100`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Jumbo API: ${response.status}`);
            
            const data = await response.json();
            return data.products || [];
            
        } catch (error) {
            console.warn('Error obteniendo catálogo de Jumbo:', error);
            return [];
        }
    },
    
    async _fetchLiderCatalog() {
        const apiKey = this.apiKeys.lider;
        if (!apiKey) throw new Error('API key para Líder no configurada');
        
        const url = `${this.catalogEndpoints.lider}?apikey=${apiKey}&limit=100`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Líder API: ${response.status}`);
            
            const data = await response.json();
            return data.products || [];
            
        } catch (error) {
            console.warn('Error obteniendo catálogo de Líder:', error);
            return [];
        }
    },
    
    async _fetchTottusCatalog() {
        const apiKey = this.apiKeys.tottus;
        if (!apiKey) throw new Error('API key para Tottus no configurada');
        
        const url = `${this.catalogEndpoints.tottus}?apikey=${apiKey}&limit=100`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Tottus API: ${response.status}`);
            
            const data = await response.json();
            return data.products || [];
            
        } catch (error) {
            console.warn('Error obteniendo catálogo de Tottus:', error);
            return [];
        }
    },
    
    async _fetchUnimarcCatalog() {
        const apiKey = this.apiKeys.unimarc;
        if (!apiKey) throw new Error('API key para Unimarc no configurada');
        
        const url = `${this.catalogEndpoints.unimarc}?apikey=${apiKey}&limit=100`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Unimarc API: ${response.status}`);
            
            const data = await response.json();
            return data.products || [];
            
        } catch (error) {
            console.warn('Error obteniendo catálogo de Unimarc:', error);
            return [];
        }
    },
    
    // Obtener precios de APIs de supermercados
    async _fetchJumboPrices(productId) {
        const apiKey = this.apiKeys.jumbo;
        if (!apiKey) throw new Error('API key para Jumbo no configurada');
        
        const url = `${this.catalogEndpoints.jumbo}/${productId}/prices?apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Jumbo precios API: ${response.status}`);
            
            const data = await response.json();
            return data.prices || {};
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Jumbo para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchLiderPrices(productId) {
        const apiKey = this.apiKeys.lider;
        if (!apiKey) throw new Error('API key para Líder no configurada');
        
        const url = `${this.catalogEndpoints.lider}/${productId}/prices?apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Líder precios API: ${response.status}`);
            
            const data = await response.json();
            return data.prices || {};
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Líder para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchTottusPrices(productId) {
        const apiKey = this.apiKeys.tottus;
        if (!apiKey) throw new Error('API key para Tottus no configurada');
        
        const url = `${this.catalogEndpoints.tottus}/${productId}/prices?apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Tottus precios API: ${response.status}`);
            
            const data = await response.json();
            return data.prices || {};
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Tottus para ${productId}:`, error);
            return null;
        }
    },
    
    async _fetchUnimarcPrices(productId) {
        const apiKey = this.apiKeys.unimarc;
        if (!apiKey) throw new Error('API key para Unimarc no configurada');
        
        const url = `${this.catalogEndpoints.unimarc}/${productId}/prices?apikey=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Unimarc precios API: ${response.status}`);
            
            const data = await response.json();
            return data.prices || {};
            
        } catch (error) {
            console.warn(`Error obteniendo precios de Unimarc para ${productId}:`, error);
            return null;
        }
    },
    
    // Scraping de productos desde sitios web como fallback
    async _scrapeProductsFromWebsites(keyword = '', category = null, limit = 20) {
        console.log('Iniciando scraping de productos desde sitios web como fallback...');
        
        const scrapingPromises = [
            this._scrapeJumboWebsite(keyword, category, limit),
            this._scrapeLiderWebsite(keyword, category, limit),
            this._scrapeTottusWebsite(keyword, category, limit),
            this._scrapeUnimarcWebsite(keyword, category, limit)
        ];
        
        const results = await Promise.allSettled(scrapingPromises);
        let allProducts = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const storeName = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'][index];
                const products = result.value.map(product => ({
                    ...product,
                    sourceStore: storeName,
                    fromScraping: true,
                    lastUpdated: new Date().toISOString()
                }));
                allProducts = allProducts.concat(products);
            }
        });
        
        console.log(`Scraping completado: ${allProducts.length} productos encontrados`);
        return allProducts;
    },
    
    // Scraping simplificado del sitio web de Jumbo
    async _scrapeJumboWebsite(keyword = '', category = null, limit = 20) {
        const url = `${this.catalogEndpoints.scraping.jumbo}?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'
                }
            });
            
            const data = await response.json();
            return this._parseJumboProducts(data, category, limit);
            
        } catch (error) {
            console.warn('Error scraping Jumbo website:', error);
            return [];
        }
    },
    
    // Parsear productos del sitio web de Jumbo
    _parseJumboProducts(data, category, limit) {
        if (!Array.isArray(data)) return [];
        
        return data
            .map(item => {
                // Mapear estructura de datos del sitio web
                return {
                    id: item.id || `jumbo-${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || item.title || '',
                    category: item.category || 'Otros',
                    keywords: this._generateKeywords(item.name || item.title || ''),
                    inStock: item.stock !== false && item.stock !== 0,
                    image: item.image || item.img || '',
                    description: item.description || '',
                    skus: item.skus || [],
                    prices: item.prices || {}
                };
            })
            .filter(item => {
                if (category && item.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                return item.name && item.name.trim() !== '';
            })
            .slice(0, limit);
    },
    
    // Métodos similares para Líder, Tottus, Unimarc...
    
    async _scrapeLiderWebsite(keyword = '', category = null, limit = 20) {
        const url = `${this.catalogEndpoints.scraping.lider}?q=${encodeURIComponent(keyword)}&category=${category || ''}&limit=${limit}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'
                }
            });
            
            const data = await response.json();
            return this._parseLiderProducts(data, category, limit);
            
        } catch (error) {
            console.warn('Error scraping Líder website:', error);
            return [];
        }
    },
    
    _parseLiderProducts(data, category, limit) {
        if (!Array.isArray(data)) return [];
        
        return data
            .map(item => {
                return {
                    id: item.id || `lider-${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || item.title || '',
                    category: item.category || 'Otros',
                    keywords: this._generateKeywords(item.name || item.title || ''),
                    inStock: item.stock !== false && item.stock !== 0,
                    image: item.image || item.img || '',
                    description: item.description || '',
                    skus: item.skus || [],
                    prices: item.prices || {}
                };
            })
            .filter(item => {
                if (category && item.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                return item.name && item.name.trim() !== '';
            })
            .slice(0, limit);
    },
    
    async _scrapeTottusWebsite(keyword = '', category = null, limit = 20) {
        const url = `${this.catalogEndpoints.scraping.tottus}?search=${encodeURIComponent(keyword)}&category=${category || ''}&limit=${limit}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'
                }
            });
            
            const data = await response.json();
            return this._parseTottusProducts(data, category, limit);
            
        } catch (error) {
            console.warn('Error scraping Tottus website:', error);
            return [];
        }
    },
    
    _parseTottusProducts(data, category, limit) {
        if (!Array.isArray(data)) return [];
        
        return data
            .map(item => {
                return {
                    id: item.id || `tottus-${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || item.title || '',
                    category: item.category || 'Otros',
                    keywords: this._generateKeywords(item.name || item.title || ''),
                    inStock: item.stock !== false && item.stock !== 0,
                    image: item.image || item.img || '',
                    description: item.description || '',
                    skus: item.skus || [],
                    prices: item.prices || {}
                };
            })
            .filter(item => {
                if (category && item.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                return item.name && item.name.trim() !== '';
            })
            .slice(0, limit);
    },
    
    async _scrapeUnimarcWebsite(keyword = '', category = null, limit = 20) {
        const url = `${this.catalogEndpoints.scraping.unimarc}?keyword=${encodeURIComponent(keyword)}&category=${category || ''}&limit=${limit}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SmartShop/1.0)'
                }
            });
            
            const data = await response.json();
            return this._parseUnimarcProducts(data, category, limit);
            
        } catch (error) {
            console.warn('Error scraping Unimarc website:', error);
            return [];
        }
    },
    
    _parseUnimarcProducts(data, category, limit) {
        if (!Array.isArray(data)) return [];
        
        return data
            .map(item => {
                return {
                    id: item.id || `unimarc-${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name || item.title || '',
                    category: item.category || 'Otros',
                    keywords: this._generateKeywords(item.name || item.title || ''),
                    inStock: item.stock !== false && item.stock !== 0,
                    image: item.image || item.img || '',
                    description: item.description || '',
                    skus: item.skus || [],
                    prices: item.prices || {}
                };
            })
            .filter(item => {
                if (category && item.category.toLowerCase() !== category.toLowerCase()) {
                    return false;
                }
                return item.name && item.name.trim() !== '';
            })
            .slice(0, limit);
    },
    
    // Generar palabras clave basadas en el nombre del producto
    _generateKeywords(name) {
        if (!name) return [];
        
        const words = name.toLowerCase()
            .replace(/[áéíóú]/g, 'a e i o u')
            .replace(/[^a-z0-9\s]/g, '')
            .split(' ')
            .filter(word => word.length > 2);
        
        // Quitar palabras comunes
        const stopwords = ['con', 'sin', 'de', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'y'];
        const filtered = words.filter(word => !stopwords.includes(word));
        
        // Limitar a palabras clave más relevantes (máximo 5)
        return filtered.slice(0, 5);
    },
    
    // Limpiar caché de un producto específico
    clearProductPriceCache(productId) {
        const keysToDelete = [];
        this._priceCache.forEach((value, key) => {
            if (key.includes(`:${productId}`)) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            this._priceCache.delete(key);
        });
        
        console.log(`Caché de precios de catálogo limpiado para producto: ${productId}`);
    },
    
    // Limpiar todo el caché
    clearCache() {
        localStorage.removeItem('smartshop_catalog_cache');
        localStorage.removeItem('smartshop_catalog_timestamp');
        this._catalogCache = null;
        this._priceCache.clear();
        console.log('Todo el caché de catálogo limpiado');
    },
    
    // Forzar actualización completa
    async refreshCatalog(userLocation) {
        this.clearCache();
        // Recargar catálogos en background para el usuario
        // En una implementación real, esto estaría coordinado
        console.log('Catálogo actualizado automáticamente');
        return true;
    }
};

module.exports = ProductCatalogAPI;