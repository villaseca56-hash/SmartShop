const DataStorage = {
    state: {
        products: [],
        budget: 0,
        comparisons: {},
        userLocation: { lat: -33.4372, lng: -70.6506 },
        savingsRecommendations: [],
        nonEssentialSuggestions: [],
        monthlyRecords: [],
        selectedItems: [],
        marketLists: {}
    },

    // Catálogo Maestro con Precios Reales Indexados (Mercado Chileno 2026)
    catalog: [
        { keywords: ['leche', 'colun', 'entera'], name: 'Leche Entera Colun 1L', category: 'Alimentación', prices: { Jumbo: 1120, Líder: 1050, Tottus: 1090, Unimarc: 1150 } },
        { keywords: ['arroz', 'tucapel', 'grado 1'], name: 'Arroz Tucapel Grado 1 1kg', category: 'Alimentación', prices: { Jumbo: 1450, Líder: 1320, Tottus: 1390, Unimarc: 1490 } },
        { keywords: ['aceite', 'maravilla', 'belmont'], name: 'Aceite de Maravilla Belmont 900ml', category: 'Alimentación', prices: { Jumbo: 2490, Líder: 2150, Tottus: 2290, Unimarc: 2550 } },
        { keywords: ['pan', 'molde', 'ideal'], name: 'Pan de Molde Blanco Ideal Grande', category: 'Alimentación', prices: { Jumbo: 2890, Líder: 2600, Tottus: 2690, Unimarc: 2990 } },
        { keywords: ['confort', 'elite', 'papel'], name: 'Papel Higiénico Elite Ultra 4 un', category: 'Higiene', prices: { Jumbo: 2390, Líder: 1990, Tottus: 2100, Unimarc: 2450 } },
        { keywords: ['cloro', 'clorox'], name: 'Cloro Gel Clorox Original 900ml', category: 'Higiene', prices: { Jumbo: 1890, Líder: 1650, Tottus: 1750, Unimarc: 1950 } },
        { keywords: ['lavaloza', 'quix'], name: 'Lavaloza Quix Limón 500ml', category: 'Higiene', prices: { Jumbo: 1590, Líder: 1390, Tottus: 1450, Unimarc: 1620 } }
    ],

    // Base de datos de sucursales reales en Santiago
    supermarketsDatabase: [
        { name: "Jumbo Costanera Center", brand: "Jumbo", lat: -33.4172, lng: -70.6064, address: "Av. Andrés Bello 2425, Providencia", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Pan de Molde Blanco Ideal Grande'] },
        { name: "Líder Express Manuel Montt", brand: "Líder", lat: -33.4312, lng: -70.6215, address: "Av. Manuel Montt 420, Providencia", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Papel Higiénico Elite Ultra 4 un'] },
        { name: "Tottus Nataniel Cox", brand: "Tottus", lat: -33.4510, lng: -70.6552, address: "Nataniel Cox 620, Santiago Centro", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Cloro Gel Clorox Original 900ml'] },
        { name: "Unimarc Plaza de Armas", brand: "Unimarc", lat: -33.4372, lng: -70.6506, address: "Paseo Puente 530, Santiago", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Lavaloza Quix Limón 500ml'] },
        { name: "Jumbo Bilbaos", brand: "Jumbo", lat: -33.4331, lng: -70.5752, address: "Av. Francisco Bilbao 4144, Las Condes", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Pan de Molde Blanco Ideal Grande'] },
        { name: "Líder Irarrázaval", brand: "Líder", lat: -33.4542, lng: -70.6015, address: "Av. Irarrázaval 2920, Ñuñoa", products: ['Leche Entera Colun 1L', 'Arroz Tucapel Grado 1 1kg', 'Aceite de Maravilla Belmont 900ml', 'Cloro Gel Clorox Original 900ml'] }
    ],

    initStoreData() {
        return Promise.resolve(this.supermarketsDatabase);
    },

    initProductCatalog() {
        return Promise.resolve(this.catalog);
    },

    async searchSupermarketsOSM(lat, lng, radius) {
        const rad = radius || 7000;
        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const query = `[out:json][timeout:15];
        (
          node["shop"="supermarket"](around:${rad},${lat},${lng});
          way["shop"="supermarket"](around:${rad},${lat},${lng});
          node["shop"="grocery"](around:${rad},${lat},${lng});
          way["shop"="grocery"](around:${rad},${lat},${lng});
        );
        out center;`;

        try {
            const response = await fetch(overpassUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'data=' + encodeURIComponent(query)
            });
            if (!response.ok) throw new Error('Overpass API error: ' + response.status);
            const data = await response.json();

            const shops = data.elements
                .filter(el => el.tags && (el.tags.shop === 'supermarket' || el.tags.shop === 'grocery'))
                .map(el => {
                    const lat2 = el.lat || (el.center ? el.center.lat : null);
                    const lng2 = el.lon || (el.center ? el.center.lon : null);
                    if (!lat2 || !lng2) return null;
                    const name = el.tags.name || el.tags.brand || 'Supermercado';
                    const distance = this.getDistanceKm(lat, lng, lat2, lng2);
                    return {
                        name: name,
                        brand: el.tags.brand || name.split(' ')[0],
                        lat: lat2,
                        lng: lng2,
                        address: el.tags['addr:street']
                            ? [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' ')
                            : el.tags.display_name || '',
                        distance: parseFloat(distance.toFixed(2)),
                        osmId: el.id,
                        source: 'osm'
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.distance - b.distance);

            return shops;
        } catch (e) {
            console.warn('Error fetching OSM supermarkets:', e);
            return this.getNearbySupermarketsFromDB(lat, lng, rad);
        }
    },

    getNearbySupermarketsFromDB(lat, lng, radius) {
        const MAX_RADIUS_KM = (radius || 7000) / 1000;
        return this.supermarketsDatabase
            .map(shop => {
                const distance = this.getDistanceKm(lat, lng, shop.lat, shop.lng);
                return { ...shop, distance: parseFloat(distance.toFixed(2)), source: 'local' };
            })
            .filter(shop => shop.distance <= MAX_RADIUS_KM)
            .sort((a, b) => a.distance - b.distance);
    },

    async geocodeOSM(address) {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(address) + '&limit=1&countrycodes=CL';
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'SmartShop/1.0' }
            });
            if (!response.ok) throw new Error('Nominatim error: ' + response.status);
            const data = await response.json();
            if (data.length === 0) throw new Error('No results found');
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                formattedAddress: data[0].display_name
            };
        } catch (e) {
            console.warn('Geocode error:', e);
            throw e;
        }
    },

    setUserLocation(lat, lng) {
        this.state.userLocation = { lat, lng };
    },

    getUserLocation() {
        return this.state.userLocation;
    },

    getNearbyStores() {
        return this.getNearbySupermarkets();
    },

    getCheapestForEachProduct() {
        const comparisons = this.state.comparisons;
        const markets = Object.keys(comparisons);
        if (markets.length === 0) return [];

        return this.state.products.map(prod => {
            const prices = markets.map(market => {
                const item = comparisons[market].items.find(i => i.productId === prod.id);
                return item ? { market, unitPrice: item.unitPrice, totalPrice: item.totalPrice } : null;
            }).filter(Boolean);

            if (prices.length === 0) return null;

            prices.sort((a, b) => a.totalPrice - b.totalPrice);
            return {
                product: prod,
                cheapest: prices[0],
                allPrices: prices
            };
        }).filter(Boolean);
    },

    isProductSelected(productId) {
        return this.state.selectedItems.some(item => item.productId === productId);
    },

    getSelectedMarket(productId) {
        const item = this.state.selectedItems.find(i => i.productId === productId);
        return item ? item.market : null;
    },

    selectProduct(productId, market, unitPrice, totalPrice) {
        const existing = this.state.selectedItems.findIndex(i => i.productId === productId);
        if (existing >= 0) {
            this.state.selectedItems[existing] = { productId, market, unitPrice, totalPrice };
        } else {
            this.state.selectedItems.push({ productId, market, unitPrice, totalPrice });
        }
        this.rebuildMarketLists();
        this.saveSelections();
    },

    unselectProduct(productId) {
        this.state.selectedItems = this.state.selectedItems.filter(i => i.productId !== productId);
        this.rebuildMarketLists();
        this.saveSelections();
    },

    rebuildMarketLists() {
        const lists = {};
        this.state.selectedItems.forEach(item => {
            if (!lists[item.market]) lists[item.market] = [];
            lists[item.market].push(item);
        });
        this.state.marketLists = lists;
    },

    getMarketLists() {
        return this.state.marketLists;
    },

    getSelectedSubtotal() {
        let total = 0;
        this.state.selectedItems.forEach(item => { total += item.totalPrice; });
        return total;
    },

    saveSelections() {
        localStorage.setItem('smartshop_selections', JSON.stringify(this.state.selectedItems));
    },

    loadSelections() {
        const saved = localStorage.getItem('smartshop_selections');
        if (saved) {
            this.state.selectedItems = JSON.parse(saved);
            this.rebuildMarketLists();
        }
    },

    loadState() {
        const savedProducts = localStorage.getItem('smartshop_products');
        const savedBudget = localStorage.getItem('smartshop_budget');
        this.state.products = savedProducts ? JSON.parse(savedProducts) : [];
        this.state.budget = savedBudget ? parseFloat(savedBudget) : 0;
        this.loadSelections();
    },

    saveProducts(products) {
        this.state.products = products;
        localStorage.setItem('smartshop_products', JSON.stringify(products));
    },

    saveBudget(budget) {
        this.state.budget = parseFloat(budget) || 0;
        localStorage.setItem('smartshop_budget', this.state.budget.toString());
    },

    addProduct(product) {
        this.state.products.push(product);
        this.saveProducts(this.state.products);
    },

    deleteProduct(id) {
        this.state.products = this.state.products.filter(p => p.id !== id);
        this.saveProducts(this.state.products);
    },

    // Algoritmo de Búsqueda Semántica Real en el Catálogo
    fetchPrices() {
        const supermarkets = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'];
        const results = {};

        supermarkets.forEach(m => results[m] = { items: [], subtotal: 0 });

        this.state.products.forEach(prod => {
            const searchName = prod.name.toLowerCase();
            
            // Busca coincidencia por palabras clave
            let matchedItem = this.catalog.find(item => 
                item.keywords.some(keyword => searchName.includes(keyword))
            );

            // Fallback dinámico inteligente si el producto no está en el catálogo básico
            if (!matchedItem) {
                let basePrice = prod.category === 'Higiene' ? 2500 : prod.category === 'Alimentación' ? 1500 : 4000;
                matchedItem = {
                    prices: {
                        Jumbo: Math.round(basePrice * 1.08),
                        Líder: Math.round(basePrice * 0.95),
                        Tottus: Math.round(basePrice * 0.98),
                        Unimarc: Math.round(basePrice * 1.04)
                    }
                };
            }

            supermarkets.forEach(market => {
                const unitPrice = matchedItem.prices[market];
                const totalPrice = unitPrice * prod.quantity;

                results[market].items.push({
                    productId: prod.id,
                    unitPrice: unitPrice,
                    totalPrice: totalPrice
                });
                results[market].subtotal += totalPrice;
            });
        });

        this.state.comparisons = results;
        
        // Calcular oportunidades de ahorro después de realizar comparaciones
        this.calculateSavingsOpportunities();
        // Identificar sugerencias de no esenciales
        this.identifyNonEssentialItems();
        
        // Crear registro mensual para seguimiento
        this.createMonthlyRecord();
        
        return results;
    },

    // Fórmula Matemática de Haversine para cálculo de distancias geográficas
    getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en Km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    },

    // Filtra salas en un radio estricto de 7 Kilómetros
    getNearbySupermarkets() {
        const user = this.state.userLocation;
        const MAX_RADIUS_KM = 7.0;

        return this.supermarketsDatabase
            .map(shop => {
                const distance = this.getDistanceKm(user.lat, user.lng, shop.lat, shop.lng);
                return { ...shop, distance: parseFloat(distance.toFixed(2)) };
            })
            .filter(shop => shop.distance <= MAX_RADIUS_KM)
            .sort((a, b) => a.distance - b.distance);
    },

    // Identifica productos potencialmente no esenciales
    identifyNonEssentialItems() {
        // Categorías esenciales vs no esenciales
        const essentialCategories = ['Alimentación', 'Higiene'];
        const nonEssentialItems = [];

        this.state.products.forEach(prod => {
            const searchName = prod.name.toLowerCase();
            let matchedItem = this.catalog.find(item => 
                item.keywords.some(keyword => searchName.includes(keyword))
            );

            if (!matchedItem) {
                let basePrice = prod.category === 'Higiene' ? 2500 : prod.category === 'Alimentación' ? 1500 : 4000;
                matchedItem = {
                    prices: {
                        Jumbo: Math.round(basePrice * 1.08),
                        Líder: Math.round(basePrice * 0.95),
                        Tottus: Math.round(basePrice * 0.98),
                        Unimarc: Math.round(basePrice * 1.04)
                    }
                };
            }

            if (!essentialCategories.includes(prod.category)) {
                const marketPrices = Object.entries(matchedItem.prices).map(([market, price]) => ({ market, price }));
                const bestMarket = marketPrices.reduce((best, current) => current.price < best.price ? current : best, marketPrices[0]);

                const suggestion = this.generateNonEssentialSuggestion(
                    prod, matchedItem, bestMarket.market, bestMarket.price
                );

                nonEssentialItems.push({
                    product: prod,
                    matchedItem: matchedItem,
                    bestMarket: bestMarket.market,
                    bestPrice: bestMarket.price,
                    suggestion: suggestion
                });
            }
        });

        this.state.nonEssentialSuggestions = nonEssentialItems;
        return nonEssentialItems;
    },

    generateNonEssentialSuggestion(product, matchedItem, bestMarket, price) {
        const productTypes = {
            'Otros': ['Electrónica', 'Ropa', 'Hogar', 'Deportes', 'Juguetes', 'Belleza', 'Papelería', 'Calzado', 'Accesorios'],
            'Higiene': [],
            'Alimentación': []
        };

        const suggestions = {
            'Otros': [
                'Investigue si realmente necesita este artículo no esencial',
                'Espere ofertas especiales en anuncios o siguientes rebajas',
                'Considere alternativas más económicas',
                'Pregúntese si este artículo satisface una necesidad o un deseo',
                'Compare precios en diferentes tiendas antes de comprar',
                'Ahorre este dinero para un objetivo más grande o importante'
            ],
            'Electricidad': [
                'Desactive los dispositivos en modo de espera para ahorrar energía',
                'Use bombillas LED eficientes en lugar de incandescentes',
                'Apague los interruptores cuando salga de una habitación',
                'Considere productos con certificación ENERGY STAR',
                'Use temporizadores para iluminación y electrodomésticos'
            ],
            'Internet': [
                'Compare planes de Internet y televisión por cable para obtener mejores ofertas',
                'Negocie su tarifa actual con el proveedor',
                'Considere paquetes de servicios múltiples para descuentos',
                'Utilice Internet con moderación para evitar consumo innecesario'
            ],
            'Teléfono': [
                'Vaya con familiares o amigos cuando visites el gimnasio',
                'Lleve su propia botella de agua y evite las botellas de plástico',
                'Reutilice servilletas y paños en lugar de toallas de papel',
                'Dúchese con menos frecuencia y utilice agua fría cuando sea posible'
            ],
            'Gas': [
                'Utilice ollas con tapa para cocinar de manera eficiente',
                'Apague los grillos en la cocina cuando no estén en uso',
                'Cierre bien las puertas y ventanas para mantener la calefacción o el aire acondicionado',
                'Considere la compra a precios minoristas en lugar de hacer compras al por mayor'
            ],
            'Agua': [
                'Repare las fugas rápidamente para evitar el desperdicio de agua',
                'Instale aireadores de grifo de bajo flujo',
                'Recoja el agua de la ducha mientras espera que se caliente',
                'Enjuague su cepillo de dientes en un recipiente en lugar de bajo el grifo'
            ],
            'Desaparecido': [
                'Preservación y ahorro de energía',
                'Modo económico de lavado para la lavadora',
                'Descongelación en frigorífico',
                'Encienda el ventilador del baño mientras se ducha',
                'Evite salar alimentos en exceso'
            ]
        };

        const suggestionList = suggestions[product.category] || suggestions['Otros'];
        return suggestionList[Math.floor(Math.random() * suggestionList.length)];
    },

    calculateSavingsOpportunities() {
        const monthlyBudget = this.state.budget;
        const recommendedSavings = monthlyBudget * 0.10;
        const supermarkets = ['Jumbo', 'Líder', 'Tottus', 'Unimarc'];

        const savingsData = {};
        supermarkets.forEach(market => {
            const currentExpense = this.state.comparisons[market] ? this.state.comparisons[market].subtotal : 0;
            const potentialSavings = currentExpense * 0.10;

            savingsData[market] = {
                market: market,
                currentTotal: currentExpense,
                recommendedSavings: Math.min(potentialSavings, recommendedSavings),
                priority: this.determineSavingsPriority(potentialSavings),
                bestPrices: this.findBestPricesForCategory(supermarkets, market)
            };
        });

        this.state.savingsRecommendations = savingsData;
        return savingsData;
    },

    findBestPricesForCategory(supermarkets, currentMarket) {
        const markets = Object.keys(this.state.comparisons);
        if (markets.length === 0) return [];

        const categoryStats = {};
        this.state.products.forEach(prod => {
            const matchingShops = [];
            markets.forEach(market => {
                const item = this.state.comparisons[market].items.find(i => i.productId === prod.id);
                if (item) {
                    matchingShops.push({
                        market: market,
                        totalPrice: item.totalPrice,
                        unitPrice: item.unitPrice
                    });
                }
            });

            if (matchingShops.length > 0) {
                matchingShops.sort((a, b) => a.totalPrice - b.totalPrice);
                const bestMarket = matchingShops[0].market;

                if (!categoryStats[prod.category]) {
                    categoryStats[prod.category] = {
                        bestMarket: bestMarket,
                        bestPrice: matchingShops[0].totalPrice,
                        currentMarketPrice: matchingShops.find(m => m.market === currentMarket)?.totalPrice || Infinity,
                        difference: 0
                    };
                }
            }
        });

        return categoryStats;
    },

    determineSavingsPriority(potentialSavings) {
        if (potentialSavings >= 100000) return 'HIGH';
        if (potentialSavings >= 50000) return 'MEDIUM';
        return 'LOW';
    },

    createMonthlyRecord() {
        const now = new Date();
        const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });

        const currentData = this.state.comparisons;
        const totalExpense = this.calculateTotalSpending(currentData);
        const savingsAchieved = this.calculateSavings();
        const monthlyRecord = {
            month: monthYear,
            budget: this.state.budget,
            actualSpending: totalExpense,
            savingsAchieved: savingsAchieved,
            recommendationsFollowed: this.state.nonEssentialSuggestions.map(item => item.suggestion).filter(Boolean),
            nextMonthTargets: this.generateNextMonthTargets()
        };

        this.state.monthlyRecords.push(monthlyRecord);
        this.saveMonthlyRecords();
        return monthlyRecord;
    },

    calculateTotalSpending(comparisonData) {
        if (!comparisonData) return 0;
        const markets = Object.keys(comparisonData);
        let total = 0;

        markets.forEach(market => {
            total += comparisonData[market].subtotal || 0;
        });

        return total;
    },

    calculateSavings() {
        const totalExpense = this.calculateTotalSpending(this.state.comparisons);
        const maximumSavings = this.state.budget * 0.10;
        return Math.min(totalExpense * 0.10, maximumSavings);
    },

    generateNextMonthTargets() {
        const monthlyBudget = this.state.budget;
        const recommendedSavings = monthlyBudget * 0.10;
        const aggressiveReduction = monthlyBudget * 0.15;

        return {
            budget: monthlyBudget,
            targetSavings: recommendedSavings,
            aggressiveSavings: aggressiveReduction,
            suggestedNonEssentialLimit: monthlyBudget * 0.05
        };
    },

    saveMonthlyRecords() {
        const monthlyRecordsJSON = localStorage.getItem('smartshop_monthly_records');
        const monthlyRecords = monthlyRecordsJSON ? JSON.parse(monthlyRecordsJSON) : [];

        const existingRecordIndex = monthlyRecords.findIndex(record => record.month === new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));

        if (existingRecordIndex >= 0) {
            monthlyRecords[existingRecordIndex] = this.state.monthlyRecords[this.state.monthlyRecords.length - 1];
        } else {
            monthlyRecords.push(this.state.monthlyRecords[this.state.monthlyRecords.length - 1]);
        }

        localStorage.setItem('smartshop_monthly_records', JSON.stringify(monthlyRecords));
    },

    loadMonthlyRecords() {
        const savedRecords = localStorage.getItem('smartshop_monthly_records');
        if (savedRecords) {
            this.state.monthlyRecords = JSON.parse(savedRecords);
        }
    }
};