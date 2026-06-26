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
            UI.renderSavingsRecommendations();
            UI.renderNonEssentialSuggestions();
            UI.renderMonthlyRecords();
            UI.updateSavingsMetrics();
            UI.renderMarketOrganization();
            UI.renderBalanceSummary();

            if (DataStorage.state.budget > 0) {
                const savingTarget = DataStorage.state.budget * 0.10;
                const remaining = DataStorage.state.budget - DataStorage.getSelectedSubtotal();
                const balanceEl = document.getElementById('balanceAmount');
                if (balanceEl) {
                    balanceEl.textContent = Utils.formatCurrency(remaining);
                    balanceEl.className = 'balance-value' + (remaining < 0 ? ' text-danger' : '');
                }
            }
        };

        const loadGoogleMapsAndInit = async () => {
            try {
                await GoogleMapsAPI.load();
                console.log('Google Maps API loaded');
            } catch (e) {
                console.warn('Google Maps no disponible, usando Leaflet:', e.message);
            }
            await initMapWithLocation();
        };

        const initMapWithLocation = async () => {
            try {
                const shopsInRange = DataStorage.getNearbyStores();
                await UI.initMap(DataStorage.state.userLocation, shopsInRange);
            } catch (e) {
                console.warn('Error al inicializar mapa:', e);
            }
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

            await DataStorage.initStoreData(DataStorage.state.userLocation);
            const shopsInRange = DataStorage.getNearbyStores();

            try {
                await GoogleMapsAPI.load();
            } catch (e) {
                console.warn('Google Maps no disponible para mapa inicial:', e.message);
            }

            await UI.initMap(DataStorage.state.userLocation, shopsInRange);

            UI.renderLocationSearch(async (location) => {
                if (typeof location.lat !== 'undefined') {
                    DataStorage.setUserLocation(location.lat, location.lng);
                } else if (location.lat && location.lng) {
                    DataStorage.setUserLocation(location.lat, location.lng);
                }
                await DataStorage.initStoreData(DataStorage.state.userLocation);
                const nearby = DataStorage.getNearbyStores();
                await UI.initMap(DataStorage.state.userLocation, nearby);
            });
        };

        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('productName');
            const categorySelect = document.getElementById('productCategory');
            const quantityInput = document.getElementById('productQuantity');

            const validationResult = Validation.validateProductForm(
                nameInput.value, categorySelect.value, quantityInput.value
            );
            if (!validationResult.isValid) {
                UI.showErrors(validationResult.errors);
                return;
            }
            UI.clearErrors();

            DataStorage.addProduct({
                id: Date.now().toString(36),
                name: Utils.sanitize(nameInput.value.trim()),
                category: categorySelect.value,
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
        loadGoogleMapsAndInit();

        console.log('SmartShop iniciado correctamente');
    } catch (error) {
        console.error('Error inicializando SmartShop:', error);
        DataStorage.loadState();

        try {
            const shopsInRange = DataStorage.getNearbyStores();
            await UI.initMap(DataStorage.state.userLocation, shopsInRange.length > 0 ? shopsInRange : []);
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
