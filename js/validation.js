const Validation = {
    validateProductForm(name, quantity) {
        const errors = {};
        const cleanName = name.trim();

        if (!cleanName) {
            errors.productName = 'El nombre del producto es obligatorio.';
        } else if (cleanName.length < 3) {
            errors.productName = 'Debe tener al menos 3 caracteres.';
        } else if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-\.\/]+$/.test(cleanName)) {
            errors.productName = 'Contiene caracteres no permitidos.';
        }

        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum < 1) {
            errors.productQuantity = 'La cantidad mínima es 1.';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
};