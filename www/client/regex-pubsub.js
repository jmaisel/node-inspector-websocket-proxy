/**
 * RegexPubSub - A publish/subscribe queue with regex pattern matching
 *
 * Allows subscribers to listen to topics using regular expressions,
 * enabling flexible pattern-based message routing.
 */
class RegexPubSub {
  constructor() {
    this.subscriptions = new Map(); // Map<subscriberId, { pattern: RegExp, callback: Function }>
    this.nextSubscriptionId = 1;
  }

  /**
   * Subscribe to messages matching a regex pattern
   *
   * @param {string|RegExp} pattern - Regular expression pattern to match topics
   * @param {Function} callback - Callback function (topic, data) => void
   * @returns {number} Subscription ID for unsubscribing
   *
   * @example
   * const id = pubsub.subscribe(/^Runtime\./, (topic, data) => {
   *   console.log(`Runtime event: ${topic}`, data);
   * });
   */
  subscribe(pattern, callback) {

    console.log('adding subscription for ' + pattern);

    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    // Convert string to RegExp if needed
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    if (!(regex instanceof RegExp)) {
      throw new TypeError('Pattern must be a string or RegExp');
    }

    const subscriptionId = this.nextSubscriptionId++;

    this.subscriptions.set(subscriptionId, {
      pattern: regex,
      callback: callback
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from messages
   *
   * @param {number} subscriptionId - The subscription ID returned from subscribe()
   * @returns {boolean} True if unsubscribed successfully, false if ID not found
   *
   * @example
   * const id = pubsub.subscribe(/test/, callback);
   * pubsub.unsubscribe(id);
   */
  unsubscribe(subscriptionId) {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Publish a message to a topic
   *
   * All subscribers whose regex patterns match the topic will receive the message.
   *
   * @param {string} topic - The topic/channel to publish to
   * @param {*} data - The data to send to subscribers
   * @returns {number} Number of subscribers that received the message
   *
   * @example
   * pubsub.publish('Runtime.consoleAPICalled', { type: 'log', args: ['Hello'] });
   */
  publish(topic, data) {
    if (typeof topic !== 'string') {
      throw new TypeError('Topic must be a string');
    }

    let notifiedCount = 0;

    for (const [id, subscription] of this.subscriptions) {
      if (subscription.pattern.test(topic)) {
        try {
          subscription.callback(topic, data);
          notifiedCount++;
        } catch (error) {
          console.error(`Error in subscription ${id} for topic "${topic}":`, error);
        }
      }
    }

    return notifiedCount;
  }

  /**
   * Get the number of active subscriptions
   *
   * @returns {number} Number of active subscriptions
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clear() {
    this.subscriptions.clear();
  }

  /**
   * Subscribe to a single message matching a pattern, then auto-unsubscribe
   *
   * @param {string|RegExp} pattern - Regular expression pattern to match topics
   * @param {Function} callback - Callback function (topic, data) => void
   * @returns {number} Subscription ID (will be auto-unsubscribed after first match)
   *
   * @example
   * pubsub.once(/^response:123$/, (topic, data) => {
   *   console.log('Got response:', data);
   * });
   */
  once(pattern, callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    // Convert string to RegExp if needed
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    if (!(regex instanceof RegExp)) {
      throw new TypeError('Pattern must be a string or RegExp');
    }

    const subscriptionId = this.nextSubscriptionId++;

    // Wrap callback to auto-unsubscribe after first invocation
    const wrappedCallback = (topic, data) => {
      try {
        callback(topic, data);
      } finally {
        // Always unsubscribe after callback, even if it throws
        this.unsubscribe(subscriptionId);
      }
    };

    this.subscriptions.set(subscriptionId, {
      pattern: regex,
      callback: wrappedCallback
    });

    return subscriptionId;
  }

  /**
   * Get all topics that would match a given pattern
   *
   * @param {string} topic - Topic to test
   * @returns {number[]} Array of subscription IDs that match the topic
   */
  getMatchingSubscriptions(topic) {
    const matches = [];

    for (const [id, subscription] of this.subscriptions) {
      if (subscription.pattern.test(topic)) {
        matches.push(id);
      }
    }

    return matches;
  }

  on = this.subscribe;
  un = this.unsubscribe;
}

if(!window && module !== undefined && module.exports){
  module.exports = RegexPubSub;
}
