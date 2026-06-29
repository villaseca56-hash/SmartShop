/**
 * useGeolocation.js - Wrapper to handle browser geolocation permissions and coordinates
 */

const DEFAULT_LOCATION = { lat: -33.4372, lng: -70.6506 }; // Santiago Centro

export const useGeolocation = {
    async getCurrentPosition() {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by this browser.");
            return DEFAULT_LOCATION;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.warn("Error getting location, using default Santiago coordinates:", error.message);
                    resolve(DEFAULT_LOCATION);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 6000,
                    maximumAge: 0
                }
            );
        });
    },

    getDefaultLocation() {
        return { ...DEFAULT_LOCATION };
    }
};
