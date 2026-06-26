const Utils = {
    // Sanitización robusta contra XSS sin innerHTML
    sanitize(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Formateador de moneda chilena (CLP)
    formatCurrency(value) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            minimumFractionDigits: 0
        }).format(value);
    },

    // Generador aleatorio de rangos de precios mock
    getRandomPrice(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};