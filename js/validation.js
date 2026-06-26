const Validation = {
    validateProductForm(name, category, quantity) {
        const errors = {};
        // Sanitizar inputs iniciales
        const cleanName = name.trim();

        // Validar Nombre
        if (!cleanName) {
            errors.productName = 'El nombre del producto es obligatorio.';
        } else if (cleanName.length < 3) {
            errors.productName = 'Debe tener al menos 3 caracteres.';
        } else if (!/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-\.\/]+$/.test(cleanName)) {
            errors.productName = 'Contiene caracteres no permitidos.';
        }

        // Validar Categoría
        if (!category) {
            errors.productCategory = 'Debes seleccionar una categoría.';
        }

        // Validar Cantidad
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