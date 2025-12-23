# RegexPubSub Usage Examples

## Node.js Usage

```javascript
const RegexPubSub = require('./src/utils/regex-pubsub');

const pubsub = new RegexPubSub();

// Subscribe to all Runtime domain events
const runtimeId = pubsub.subscribe(/^Runtime\./, (topic, data) => {
  console.log('Runtime event:', topic, data);
});

// Subscribe to all paused events
const pauseId = pubsub.subscribe(/\.paused$/, (topic, data) => {
  console.log('Execution paused:', data);
});

// Publish events
pubsub.publish('Runtime.consoleAPICalled', { type: 'log', args: ['Hello'] });
pubsub.publish('Debugger.paused', { reason: 'breakpoint' });

// Unsubscribe
pubsub.unsubscribe(runtimeId);
```

## Browser Usage

```html
<script src="src/utils/regex-pubsub-browser.js"></script>
<script>
  const pubsub = new RegexPubSub();

  // Subscribe to messages
  pubsub.subscribe(/^Runtime\./, (topic, data) => {
    console.log('Runtime event:', topic, data);
  });

  // Publish events
  pubsub.publish('Runtime.consoleAPICalled', { type: 'log' });
</script>
```

## Chrome DevTools Protocol Integration

```javascript
const RegexPubSub = require('./src/utils/regex-pubsub');

// Create a pubsub for protocol messages
const protocolEvents = new RegexPubSub();

// Subscribe to different domains
protocolEvents.subscribe(/^Debugger\./, (topic, data) => {
  handleDebuggerEvent(topic, data);
});

protocolEvents.subscribe(/^Runtime\./, (topic, data) => {
  handleRuntimeEvent(topic, data);
});

protocolEvents.subscribe(/^Console\./, (topic, data) => {
  handleConsoleEvent(topic, data);
});

// Subscribe to specific events
protocolEvents.subscribe(/^Runtime\.consoleAPICalled$/, (topic, data) => {
  updateConsoleUI(data);
});

protocolEvents.subscribe(/^Debugger\.paused$/, (topic, data) => {
  showPausedState(data);
});

// When WebSocket receives a message
ws.on('message', (message) => {
  const msg = JSON.parse(message);

  if (msg.method) {
    // It's an event - publish it
    protocolEvents.publish(msg.method, msg.params);
  }
});
```

## Advanced Patterns

### Catch-all with filtering

```javascript
// Subscribe to everything
pubsub.subscribe(/.*/, (topic, data) => {
  if (topic.startsWith('Debugger.')) {
    // Handle debugger events
  } else if (topic.startsWith('Runtime.')) {
    // Handle runtime events
  }
});
```

### Multiple patterns for one handler

```javascript
// Handle enable/disable for any domain
pubsub.subscribe(/\.(enable|disable)$/, (topic, data) => {
  const [domain, action] = topic.split('.');
  console.log(`${domain} was ${action}d`);
});
```

### Case-insensitive matching

```javascript
// Match console events regardless of case
pubsub.subscribe(/console/i, (topic, data) => {
  console.log('Console-related event:', topic);
});
```

### Complex routing

```javascript
const pubsub = new RegexPubSub();

// High-priority events
pubsub.subscribe(/^(Debugger\.paused|Runtime\.exceptionThrown)$/, (topic, data) => {
  notifyHighPriority(topic, data);
});

// Log everything
pubsub.subscribe(/.*/, (topic, data) => {
  logToFile(topic, data);
});

// Domain-specific handlers
const domains = ['Runtime', 'Debugger', 'Console', 'Profiler'];
domains.forEach(domain => {
  pubsub.subscribe(new RegExp(`^${domain}\\.`), (topic, data) => {
    routeToDomainHandler(domain, topic, data);
  });
});
```

## API Reference

### `subscribe(pattern, callback) => subscriptionId`
- `pattern`: String or RegExp to match topics
- `callback`: Function called with `(topic, data)` when matched
- Returns: Subscription ID for unsubscribing

### `unsubscribe(subscriptionId) => boolean`
- `subscriptionId`: ID returned from `subscribe()`
- Returns: `true` if unsubscribed, `false` if not found

### `publish(topic, data) => count`
- `topic`: String topic to publish to
- `data`: Data to send to subscribers
- Returns: Number of subscribers notified

### `getSubscriptionCount() => number`
- Returns: Number of active subscriptions

### `clear()`
- Removes all subscriptions

### `getMatchingSubscriptions(topic) => Array<number>`
- `topic`: Topic to test
- Returns: Array of subscription IDs that would match

## Error Handling

Errors in subscriber callbacks are caught and logged, but don't affect other subscribers:

```javascript
pubsub.subscribe(/test/, () => {
  throw new Error('Oops');
});

pubsub.subscribe(/test/, (topic) => {
  console.log('This still runs:', topic);
});

// Both subscribers are called, error is logged to console
pubsub.publish('test.event', {});
```