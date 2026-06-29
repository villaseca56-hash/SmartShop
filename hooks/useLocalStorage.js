/**
 * useLocalStorage.js - Simple local storage hook for reactive/clean persistence
 */

export const useLocalStorage = {
    getItem(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error reading key "${key}" from localStorage:`, error);
            return defaultValue;
        }
    },

    setItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error writing key "${key}" to localStorage:`, error);
        }
    },

    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing key "${key}" from localStorage:`, error);
        }
    }
};
