document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Iniciando SmartShop con APIs en tiempo real...');
        
        // Cargar estado guardado
        DataStorage.loadState();
        
        if(DataStorage.state.budget > 0) {
            document.getElementById('budgetInput').value = DataStorage.state.budget;
        }
        
        // Inicializar datos de tiendas usando APIs en tiempo real
        await DataStorage.initStoreData(DataStorage.state.userLocation);
        
        // Inicializar catálogo de productos
        await DataStorage.initProductCatalog();
        
        // Función para refrescar la interfaz de usuario
        const refreshAppUI = async () => {
            UI.renderProductsList(DataStorage.state.products, (idToDelete) => {
                DataStorage.deleteProduct(idToDelete);
                refreshAppUI();
            });
            
            const currentData = DataStorage.fetchPrices();
            const defaultMarket = Object.keys(currentData)[0];
            const totalExpense = currentData[defaultMarket] ? currentData[defaultMarket].subtotal : 0;
            
            UI.renderMetrics(totalExpense, DataStorage.state.budget);
            UI.renderComparisonTable(currentData, DataStorage.state.products);
            UI.renderChart(currentData);
            UI.renderSavingsRecommendations();
            UI.renderNonEssentialSuggestions();
            UI.renderMonthlyRecords();
            
            UI.updateSavingsMetrics();
        };
        
        // Inicializar mapas con ubicación de usuario real
        const initGeolocalizacion = async () => {
            if (navigator.geolocation) {
                try {
                    const position = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                    });
                    
                    // Guardar coordenadas reales del cliente
                    DataStorage.setUserLocation(position.coords.latitude, position.coords.longitude);
                    await DataStorage.initStoreData(DataStorage.getUserLocation());
                    
                    // Renderizar mapa con tiendas reales
                    const shopsInRange = DataStorage.getNearbyStores();
                    UI.initMap(DataStorage.getUserLocation(), shopsInRange);
                    
                } catch (error) {
                    console.warn('Permiso de ubicación denegado. Usando Santiago Centro por defecto.');
                    // Fallback a ubicación por defecto
                    await DataStorage.initStoreData(DataStorage.state.userLocation);
                    UI.initMap(DataStorage.state.userLocation, DataStorage.getNearbyStores());
                }
            } else {
                console.warn('Geolocalización no soportada. Usando Santiago Centro por defecto.');
                await DataStorage.initStoreData(DataStorage.state.userLocation);
                UI.initMap(DataStorage.state.userLocation, DataStorage.getNearbyStores());
            }
        };
        
        // Formulario de Productos
        const form = document.getElementById('productForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('productName');
            const categorySelect = document.getElementById('productCategory');
            const quantityInput = document.getElementById('productQuantity');
            
            const validationResult = Validation.validateProductForm(nameInput.value, categorySelect.value, quantityInput.value);
            if (!validationResult.isValid) { UI.showErrors(validationResult.errors); return; }
            UI.clearErrors();
            
            DataStorage.addProduct({
                id: Date.now().toString(36),
                name: Utils.sanitize(nameInput.value.trim()),
                category: categorySelect.value,
                quantity: parseInt(quantityInput.value, 10)
            });
            
            refreshAppUI();
            form.reset();
        });
        
        document.getElementById('budgetInput').addEventListener('input', (e) => {
            DataStorage.saveBudget(e.target.value);
            refreshAppUI();
        });
        
        document.getElementById('btnCompare').addEventListener('click', () => {
            if(DataStorage.state.products.length === 0) return alert('Agrega productos.');
            refreshAppUI();
        });
        
        // Cargar inicial de datos e interfaz de mapas
        refreshAppUI();
        initGeolocalizacion();
        
        console.log('SmartShop iniciado correctamente con APIs en tiempo real');
        
    } catch (error) {
        console.error('Error inicializando SmartShop:', error);
        
        // Intentar recuperar de caché
        DataStorage.loadState();
        
        // Usar tiendas cercanas como fallback
        const shopsInRange = DataStorage.getNearbyStores();
        if (shopsInRange.length > 0) {
            UI.initMap(DataStorage.state.userLocation, shopsInRange);
        } else {
            console.warn('No hay datos en caché disponibles. Usando configuración básica.');
            // Usar la función initMap de UI
            UI.initMap(DataStorage.state.userLocation, []);
        }
        
        refreshAppUI();
    }
});

console.log('SmartShop cargado con soporte de APIs en tiempo real');