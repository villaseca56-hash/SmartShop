/**
 * Autocomplete.js - Smart autocomplete search component with filters and suggestions.
 */

import { supermarketService } from '../services/supermarketService.js';
import { debounce, sanitize } from '../utils/helpers.js';

export const Autocomplete = {
    init(inputElementId, resultsElementId, options = {}) {
        const input = document.getElementById(inputElementId);
        const resultsContainer = document.getElementById(resultsElementId);
        if (!input || !resultsContainer) return;

        // Create autocomplete suggestions container if it doesn't exist
        let suggestionsDropdown = document.getElementById('autocompleteDropdown');
        if (!suggestionsDropdown) {
            suggestionsDropdown = document.createElement('div');
            suggestionsDropdown.id = 'autocompleteDropdown';
            suggestionsDropdown.className = 'autocomplete-dropdown';
            input.parentNode.appendChild(suggestionsDropdown);
        }

        // Hide suggestions by default
        suggestionsDropdown.style.display = 'none';

        // Advanced filter state
        let currentFilters = {
            category: 'all',
            brand: 'all'
        };

        // Render filter options
        this.renderFilters(input.parentNode.parentNode);

        // Fetch filter values
        const { categories, brands } = supermarketService.getFilterOptions();
        this.populateFilterSelects(categories, brands);

        // Track selected items to suggest co-purchased items
        const renderSuggestionsList = () => {
            if (options.onGetProducts) {
                const products = options.onGetProducts();
                const recs = supermarketService.getSuggestions(products);
                this.renderSuggestionChips(input.parentNode.parentNode, recs, options.onAddProduct);
            }
        };

        // Render initial suggestions
        renderSuggestionsList();

        // Handle searching with debounce
        const handleSearch = debounce(() => {
            const query = input.value;
            if (query.trim().length < 2) {
                suggestionsDropdown.style.display = 'none';
                return;
            }

            const matches = supermarketService.searchCatalog(query, currentFilters);
            
            if (matches.length === 0) {
                suggestionsDropdown.innerHTML = `<div class="autocomplete-no-results">No se encontraron productos</div>`;
            } else {
                suggestionsDropdown.innerHTML = matches.map(item => `
                    <div class="autocomplete-item" data-id="${item.id}" data-name="${item.name}">
                        <span class="autocomplete-item-name">${sanitize(item.name)}</span>
                        <span class="autocomplete-item-cat">${sanitize(item.brand)} | ${sanitize(item.category)}</span>
                    </div>
                `).join('');

                // Add click listener to items
                suggestionsDropdown.querySelectorAll('.autocomplete-item').forEach(el => {
                    el.addEventListener('click', () => {
                        input.value = el.dataset.name;
                        suggestionsDropdown.style.display = 'none';
                        if (options.onSelect) options.onSelect(el.dataset.name);
                    });
                });
            }
            suggestionsDropdown.style.display = 'block';
        }, 250);

        // Listeners
        input.addEventListener('input', handleSearch);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== input && !suggestionsDropdown.contains(e.target)) {
                suggestionsDropdown.style.display = 'none';
            }
        });

        // Trigger search on focus if has text
        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) {
                handleSearch();
            }
        });

        // Re-render suggestions when product lists change
        if (options.emitter) {
            options.emitter.addEventListener('listChanged', renderSuggestionsList);
        }
    },

    renderFilters(parentElement) {
        if (document.getElementById('searchFiltersWrapper')) return;

        const filtersWrapper = document.createElement('div');
        filtersWrapper.id = 'searchFiltersWrapper';
        filtersWrapper.className = 'filters-wrapper';
        filtersWrapper.innerHTML = `
            <div class="filters-header">
                <span class="filters-toggle-btn">⚙️ Filtros Avanzados</span>
            </div>
            <div class="filters-content" style="display: none;">
                <div class="filter-group">
                    <label for="filterCategory">Categoría</label>
                    <select id="filterCategory" class="filter-select">
                        <option value="all">Todas</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filterBrand">Marca</label>
                    <select id="filterBrand" class="filter-select">
                        <option value="all">Todas</option>
                    </select>
                </div>
            </div>
        `;

        parentElement.appendChild(filtersWrapper);

        // Toggle filters visibility
        filtersWrapper.querySelector('.filters-toggle-btn').addEventListener('click', () => {
            const content = filtersWrapper.querySelector('.filters-content');
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'flex' : 'none';
        });

        // Filter change listeners
        const categorySelect = filtersWrapper.querySelector('#filterCategory');
        const brandSelect = filtersWrapper.querySelector('#filterBrand');

        const filterChangeHandler = () => {
            const input = document.getElementById('productName');
            const dropdown = document.getElementById('autocompleteDropdown');
            
            // Update filter state
            const category = categorySelect.value;
            const brand = brandSelect.value;
            
            // Set current filters
            currentFilters = { category, brand };
            
            // Re-trigger search
            if (input && input.value.trim().length >= 2) {
                input.dispatchEvent(new Event('input'));
            }
        };

        categorySelect.addEventListener('change', filterChangeHandler);
        brandSelect.addEventListener('change', filterChangeHandler);
    },

    populateFilterSelects(categories, brands) {
        const catSelect = document.getElementById('filterCategory');
        const brandSelect = document.getElementById('filterBrand');

        if (catSelect) {
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
                catSelect.appendChild(opt);
            });
        }

        if (brandSelect) {
            brands.forEach(brand => {
                const opt = document.createElement('option');
                opt.value = brand;
                opt.textContent = brand;
                brandSelect.appendChild(opt);
            });
        }
    },

    renderSuggestionChips(parentElement, suggestions, onAddCallback) {
        let chipsContainer = document.getElementById('suggestionChipsContainer');
        if (!chipsContainer) {
            chipsContainer = document.createElement('div');
            chipsContainer.id = 'suggestionChipsContainer';
            chipsContainer.className = 'suggestion-chips-container';
            parentElement.appendChild(chipsContainer);
        }

        if (suggestions.length === 0) {
            chipsContainer.innerHTML = '';
            chipsContainer.style.display = 'none';
            return;
        }

        chipsContainer.innerHTML = `
            <div class="suggestions-title">Los usuarios también compran:</div>
            <div class="chips-list">
                ${suggestions.map(item => `
                    <div class="suggestion-chip" data-name="${item.name}">
                        <span>➕ ${sanitize(item.name)}</span>
                    </div>
                `).join('')}
            </div>
        `;
        chipsContainer.style.display = 'block';

        // Add click events to add suggestion directly
        chipsContainer.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const name = chip.dataset.name;
                if (onAddCallback) {
                    onAddCallback(name);
                }
            });
        });
    }
};
