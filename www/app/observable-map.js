/**
 * ObservableMap - A Map that emits events when values change
 *
 * Extends the native Map class to provide observation capabilities.
 * When a value is set, it publishes an event that observers can subscribe to.
 *
 * @class ObservableMap
 * @extends Map
 */
class ObservableMap extends Map {
    /**
     * Creates a new ObservableMap
     * @param {Object} pubSubProvider - Object that provides pub() method for publishing events
     */
    constructor(pubSubProvider) {
        super();
        this.pubSubProvider = pubSubProvider;
    }

    /**
     * Set a key-value pair and publish a change event
     * @param {string} key - The key to set
     * @param {*} value - The value to set
     * @returns {ObservableMap} This map for chaining
     */
    set(key, value) {
        const oldValue = this.get(key);
        const hasChanged = oldValue !== value;

        // Set the value in the map
        super.set(key, value);

        // Publish event if value changed
        if (hasChanged && this.pubSubProvider && typeof this.pubSubProvider.pub === 'function') {
            this.pubSubProvider.pub(`store:${key}:changed`, {
                key: key,
                oldValue: oldValue,
                newValue: value,
                timestamp: Date.now()
            });
        }

        return this;
    }

    /**
     * Delete a key and publish a deletion event
     * @param {string} key - The key to delete
     * @returns {boolean} True if the key was deleted
     */
    delete(key) {
        const oldValue = this.get(key);
        const wasDeleted = super.delete(key);

        // Publish event if deletion occurred
        if (wasDeleted && this.pubSubProvider && typeof this.pubSubProvider.pub === 'function') {
            this.pubSubProvider.pub(`store:${key}:deleted`, {
                key: key,
                oldValue: oldValue,
                timestamp: Date.now()
            });
        }

        return wasDeleted;
    }
}