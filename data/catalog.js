/**
 * catalog.js - Database and catalog structures for SmartShop.
 * Focuses on major Chilean supermarket brands and products requested by user.
 */

export const STORES_DATABASE = [
    { 
        id: 'jumbo_costanera',
        name: "Jumbo Costanera Center", 
        brand: "Jumbo", 
        lat: -33.4172, 
        lng: -70.6064, 
        address: "Av. Andrés Bello 2425, Providencia", 
        basePriceFactor: 1.08 // Premium pricing
    },
    { 
        id: 'lider_manuel_montt',
        name: "Líder Express Manuel Montt", 
        brand: "Lider", 
        lat: -33.4312, 
        lng: -70.6215, 
        address: "Av. Manuel Montt 420, Providencia", 
        basePriceFactor: 0.95 // Discount/Low cost pricing
    },
    { 
        id: 'santa_isabel_portugal',
        name: "Santa Isabel Portugal", 
        brand: "Santa Isabel", 
        lat: -33.4475, 
        lng: -70.6380, 
        address: "Av. Portugal 512, Santiago Centro", 
        basePriceFactor: 0.99 
    },
    { 
        id: 'tottus_nataniel',
        name: "Tottus Nataniel Cox", 
        brand: "Tottus", 
        lat: -33.4510, 
        lng: -70.6552, 
        address: "Nataniel Cox 620, Santiago Centro", 
        basePriceFactor: 0.97 
    },
    { 
        id: 'unimarc_plaza_armas',
        name: "Unimarc Plaza de Armas", 
        brand: "Unimarc", 
        lat: -33.4372, 
        lng: -70.6506, 
        address: "Paseo Puente 530, Santiago", 
        basePriceFactor: 1.03 // Convenience pricing
    },
    { 
        id: 'jumbo_portugal',
        name: "Jumbo Alameda", 
        brand: "Jumbo", 
        lat: -33.4439, 
        lng: -70.6502, 
        address: "Av. Libertador Bernardo O'Higgins 3470, Estación Central", 
        basePriceFactor: 1.07
    },
    { 
        id: 'lider_santa_rosa',
        name: "Líder Santa Rosa", 
        brand: "Lider", 
        lat: -33.4560, 
        lng: -70.6440, 
        address: "Santa Rosa 1250, Santiago Centro", 
        basePriceFactor: 0.94
    },
    { 
        id: 'santa_isabel_alameda',
        name: "Santa Isabel Alameda", 
        brand: "Santa Isabel", 
        lat: -33.4428, 
        lng: -70.6625, 
        address: "Av. Libertador Bernardo O'Higgins 1500, Santiago", 
        basePriceFactor: 1.00
    }
];

export const PRODUCT_CATALOG = [
    // Arroz
    { id: 'p_arroz_tucapel', name: 'Arroz Tucapel Grado 1 1kg', category: 'arroz', keywords: ['arroz', 'tucapel', 'grado 1'], basePrice: 1450, brand: 'Tucapel' },
    { id: 'p_arroz_banquete', name: 'Arroz Banquete Grado 1 1kg', category: 'arroz', keywords: ['arroz', 'banquete', 'grado 1'], basePrice: 1390, brand: 'Banquete' },
    // Aceite
    { id: 'p_aceite_belmont', name: 'Aceite de Maravilla Belmont 900ml', category: 'aceite', keywords: ['aceite', 'maravilla', 'belmont'], basePrice: 2390, brand: 'Belmont' },
    { id: 'p_aceite_natura', name: 'Aceite de Girasol Natura 900ml', category: 'aceite', keywords: ['aceite', 'natura', 'girasol'], basePrice: 2490, brand: 'Natura' },
    // Leche
    { id: 'p_leche_colun', name: 'Leche Entera Colun 1L', category: 'leche', keywords: ['leche', 'colun', 'entera'], basePrice: 1100, brand: 'Colun' },
    { id: 'p_leche_soprole', name: 'Leche Soprole Descremada 1L', category: 'leche', keywords: ['leche', 'soprole', 'descremada', 'sin lactosa'], basePrice: 1150, brand: 'Soprole' },
    { id: 'p_leche_nestle', name: 'Leche Nido Entera Polvo 800g', category: 'leche', keywords: ['leche', 'nestle', 'nido', 'polvo'], basePrice: 5890, brand: 'Nestlé' },
    // Pan
    { id: 'p_pan_ideal', name: 'Pan de Molde Blanco Ideal Grande', category: 'pan', keywords: ['pan', 'molde', 'ideal', 'blanco'], basePrice: 2800, brand: 'Ideal' },
    { id: 'p_pan_hallulla', name: 'Pan Hallulla Corriente 1kg', category: 'pan', keywords: ['pan', 'hallulla', 'corriente', 'panaderia'], basePrice: 1990, brand: 'Panadería local' },
    { id: 'p_pan_marraqueta', name: 'Pan Marraqueta Crujiente 1kg', category: 'pan', keywords: ['pan', 'marraqueta', 'panaderia'], basePrice: 2090, brand: 'Panadería local' },
    // Detergente
    { id: 'p_detergente_omo', name: 'Detergente Líquido Omo Multiacción 3L', category: 'detergente', keywords: ['detergente', 'omo', 'liquido', 'multiact'], basePrice: 9990, brand: 'Omo' },
    { id: 'p_detergente_drive', name: 'Detergente en Polvo Drive Matic 3kg', category: 'detergente', keywords: ['detergente', 'drive', 'polvo', 'matic'], basePrice: 7990, brand: 'Drive' },
    // Bebidas
    { id: 'p_bebida_cocacola', name: 'Bebida Coca Cola Original 2.5L', category: 'bebidas', keywords: ['bebida', 'coca', 'cola', 'refresco'], basePrice: 2200, brand: 'Coca Cola' },
    { id: 'p_bebida_fanta', name: 'Bebida Fanta Naranja 2.5L', category: 'bebidas', keywords: ['bebida', 'fanta', 'naranja', 'refresco'], basePrice: 1990, brand: 'Fanta' },
    { id: 'p_bebida_nectar', name: 'Néctar Andina Durazno 1.5L', category: 'bebidas', keywords: ['nectar', 'jugo', 'andina', 'durazno'], basePrice: 1350, brand: 'Andina' },
    // Azúcar
    { id: 'p_azucar_iansa', name: 'Azúcar Blanca Granulada Iansa 1kg', category: 'azucar', keywords: ['azucar', 'iansa', 'blanca', 'granulada'], basePrice: 1290, brand: 'Iansa' },
    // Pollo
    { id: 'p_pollo_pechuga', name: 'Pechuga de Pollo Deshuesada Sopraval 1kg', category: 'pollo', keywords: ['pollo', 'pechuga', 'deshuesada', 'sopraval'], basePrice: 5690, brand: 'Sopraval' },
    { id: 'p_pollo_trutro', name: 'Trutro Entero de Pollo Ariztía 1kg', category: 'pollo', keywords: ['pollo', 'trutro', 'entero', 'ariztia'], basePrice: 3890, brand: 'Ariztía' }
];

// Suggested items co-purchasing database (What users also buy)
export const SUGGESTIONS_DATABASE = {
    'leche': ['p_pan_ideal', 'p_azucar_iansa'],
    'pan': ['p_leche_colun', 'p_azucar_iansa'],
    'arroz': ['p_aceite_belmont', 'p_pollo_pechuga'],
    'aceite': ['p_arroz_tucapel', 'p_pollo_pechuga'],
    'pollo': ['p_arroz_tucapel', 'p_aceite_belmont'],
    'bebidas': ['p_pan_ideal'],
    'azucar': ['p_leche_colun', 'p_pan_ideal'],
    'detergente': []
};
