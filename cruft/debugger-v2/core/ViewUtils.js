/**
 * ViewUtils - Shared utilities for View classes
 *
 * Provides common functionality used across all views:
 * - Unique ID generation
 * - HTML escaping
 * - Element validation
 * - Data binding helpers
 */

/**
 * Generate a unique ID for a view instance
 * @param {string} componentName - Name of the component (e.g., 'toolbar', 'console')
 * @returns {string} Unique ID in format: componentname-randomstring
 */
export function generateUniqueId(componentName) {
    const normalized = componentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const random = Math.random().toString(36).substr(2, 9);
    return `${normalized}-${random}`;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for HTML insertion
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Unescape HTML entities
 * @param {string} html - HTML string to unescape
 * @returns {string} Unescaped text
 */
export function unescapeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Validate that required DOM elements exist in a container
 * @param {HTMLElement|jQuery} container - Container element
 * @param {string[]} requiredSelectors - Array of selectors that must exist
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateElements(container, requiredSelectors) {
    const $container = $(container);
    const missing = [];

    requiredSelectors.forEach(selector => {
        if ($container.find(selector).length === 0) {
            missing.push(selector);
        }
    });

    return {
        valid: missing.length === 0,
        missing
    };
}

/**
 * Build element ID from instance ID and suffix
 * @param {string} instanceId - View instance ID
 * @param {string} suffix - Element suffix (e.g., '-connect-btn')
 * @returns {string} Complete element ID
 */
export function buildElementId(instanceId, suffix) {
    if (!suffix || suffix === '') {
        return instanceId;
    }
    // Ensure suffix starts with hyphen
    const normalizedSuffix = suffix.startsWith('-') ? suffix : `-${suffix}`;
    return `${instanceId}${normalizedSuffix}`;
}

/**
 * Create a debounced function that delays execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Create a throttled function that limits execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum milliseconds between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
export function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Check if value is an object
 * @param {*} item - Value to check
 * @returns {boolean} True if item is an object
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Format timestamp for display
 * @param {Date} date - Date object
 * @returns {string} Formatted time string (HH:MM:SS)
 */
export function formatTimestamp(date = new Date()) {
    return date.toLocaleTimeString();
}

/**
 * Extract filename from URL
 * @param {string} url - File URL
 * @returns {string} Filename only
 */
export function getFileName(url) {
    if (!url) return '';

    // Handle file:// URLs
    if (url.startsWith('file://')) {
        url = url.substring(7);
    }

    // Get last segment after /
    const segments = url.split('/');
    return segments[segments.length - 1] || url;
}

/**
 * Check if element is scrolled to bottom
 * @param {HTMLElement} element - Scrollable element
 * @param {number} threshold - Pixel threshold (default: 5)
 * @returns {boolean} True if at bottom
 */
export function isScrolledToBottom(element, threshold = 5) {
    if (!element) return false;
    return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

/**
 * Scroll element to bottom
 * @param {HTMLElement} element - Scrollable element
 */
export function scrollToBottom(element) {
    if (element) {
        element.scrollTop = element.scrollHeight;
    }
}

/**
 * Parse localStorage value safely
 * @param {string} key - localStorage key
 * @param {*} defaultValue - Default value if not found or invalid
 * @returns {*} Parsed value or default
 */
export function getLocalStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) {
            return defaultValue;
        }
        return JSON.parse(value);
    } catch (e) {
        console.warn(`Failed to parse localStorage key "${key}":`, e);
        return defaultValue;
    }
}

/**
 * Save value to localStorage safely
 * @param {string} key - localStorage key
 * @param {*} value - Value to save
 * @returns {boolean} True if saved successfully
 */
export function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`Failed to save to localStorage key "${key}":`, e);
        return false;
    }
}

/**
 * Create CSS selector from ID
 * @param {string} id - Element ID
 * @returns {string} CSS selector (#id)
 */
export function idToSelector(id) {
    return `#${id}`;
}

/**
 * Generate data attribute name
 * @param {string} name - Attribute name
 * @returns {string} data-* attribute name
 */
export function dataAttr(name) {
    return `data-${name}`;
}
