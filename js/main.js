document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Iniciando SmartShop...');

        DataStorage.loadState();

        if (DataStorage.state.budget > 0) {
            document.getElementById('budgetInput').value = DataStorage.state.budget;
        }

        await DataStorage.initStoreData(DataStorage.state.userLocation);
        await DataStorage.initProductCatalog();

        let currentData = DataStorage.fetchPrices();
        let defaultMarket = Object.keys(currentData)[0] || 'Jumbo';

        const mapStatus = document.getElementById('mapStatus');

        const fetchSupermarkets = async (lat, lng) => {
            if (mapStatus) mapStatus.textContent = 'Buscando supermercados cercanos...';
            try {
                const osmShops = await DataStorage.searchSupermarketsOSM(lat, lng, 7000);
                const localShops = DataStorage.getNearbySupermarketsFromDB(lat, lng, 7000);
                const seen = new Set();
                const merged = [...osmShops, ...localShops].filter(shop => {
                    const key = shop.name + shop.lat + shop.lng;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                if (mapStatus) mapStatus.textContent = merged.length > 0
                    ? `✓ ${merged.length} supermercados encontrados`
                    : '✗ Sin supermercados cercanos';
                return merged;
            } catch (e) {
                console.warn('Error fetching supermarkets:', e);
                const local = DataStorage.getNearbySupermarketsFromDB(lat, lng, 7000);
                if (mapStatus) mapStatus.textContent = `⚠ Usando datos locales (${local.length} tiendas)`;
                return local;
            }
        };

        const refreshAppUI = () => {
            currentData = DataStorage.fetchPrices();
            defaultMarket = Object.keys(currentData)[0] || 'Jumbo';
            const totalExpense = currentData[defaultMarket] ? currentData[defaultMarket].subtotal : 0;

            UI.renderProductsList(DataStorage.state.products, (idToDelete) => {
                DataStorage.deleteProduct(idToDelete);
                DataStorage.state.selectedItems = DataStorage.state.selectedItems.filter(i => i.productId !== idToDelete);
                DataStorage.rebuildMarketLists();
                refreshAppUI();
            });

            UI.renderMetrics(totalExpense, DataStorage.state.budget);
            UI.renderComparisonTable(currentData, DataStorage.state.products, (prodId, market, unitPrice, totalPrice) => {
                const isSelected = DataStorage.isProductSelected(prodId);
                const currentMarket = DataStorage.getSelectedMarket(prodId);

                if (isSelected && currentMarket === market) {
                    DataStorage.unselectProduct(prodId);
                } else {
                    DataStorage.selectProduct(prodId, market, unitPrice, totalPrice);
                }
                refreshAppUI();
            });

            UI.renderChart(currentData);
            UI.renderMarketOrganization();
            UI.renderBalanceSummary();
        };

        const initGeolocalizacion = async () => {
            if (navigator.geolocation) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true, timeout: 8000
                        });
                    });
                    DataStorage.setUserLocation(position.coords.latitude, position.coords.longitude);
                } catch (error) {
                    console.warn('Permiso de ubicación denegado. Usando Santiago Centro.');
                }
            } else {
                console.warn('Geolocalización no soportada.');
            }

            const userLoc = DataStorage.state.userLocation;
            const shops = await fetchSupermarkets(userLoc.lat, userLoc.lng);
            await UI.initMap(userLoc, shops);

            UI.renderLocationSearch(async (location) => {
                const loc = { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
                DataStorage.setUserLocation(loc.lat, loc.lng);
                const nearbyShops = await fetchSupermarkets(loc.lat, loc.lng);
                await UI.initMap(loc, nearbyShops);
            });
        };

        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('productName');
            const quantityInput = document.getElementById('productQuantity');

            const validationResult = Validation.validateProductForm(
                nameInput.value, quantityInput.value
            );
            if (!validationResult.isValid) {
                UI.showErrors(validationResult.errors);
                return;
            }
            UI.clearErrors();

            DataStorage.addProduct({
                id: Date.now().toString(36),
                name: Utils.sanitize(nameInput.value.trim()),
                quantity: parseInt(quantityInput.value, 10)
            });

            refreshAppUI();
            e.target.reset();
        });

        document.getElementById('budgetInput').addEventListener('input', (e) => {
            DataStorage.saveBudget(e.target.value);
            refreshAppUI();
        });

        document.getElementById('btnCompare').addEventListener('click', () => {
            if (DataStorage.state.products.length === 0) return alert('Agrega productos primero.');
            refreshAppUI();
        });

        refreshAppUI();
        initGeolocalizacion();

        console.log('SmartShop iniciado correctamente');
    } catch (error) {
        console.error('Error inicializando SmartShop:', error);
        DataStorage.loadState();

        try {
            const shops = DataStorage.getNearbySupermarketsFromDB(
                DataStorage.state.userLocation.lat,
                DataStorage.state.userLocation.lng,
                7000
            );
            await UI.initMap(DataStorage.state.userLocation, shops);
        } catch (e) {
            console.warn('Error en mapa de respaldo:', e);
        }

        try {
            const refreshFallback = () => {
                const data = DataStorage.fetchPrices();
                const mk = Object.keys(data)[0] || 'Jumbo';
                UI.renderMetrics(data[mk] ? data[mk].subtotal : 0, DataStorage.state.budget);
                UI.renderProductsList(DataStorage.state.products, (id) => {
                    DataStorage.deleteProduct(id);
                    refreshFallback();
                });
            };
            refreshFallback();
        } catch (e) {
            console.error('Error en UI de respaldo:', e);
        }
    }
});
