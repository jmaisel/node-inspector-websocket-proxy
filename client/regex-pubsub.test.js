/**
 * RegexPubSub Tests and Examples
 */

const RegexPubSub = require('./regex-pubsub');

function runTests() {
  console.log('🧪 Testing RegexPubSub\n');

  // Test 1: Basic subscription and publishing
  console.log('Test 1: Basic subscription and publishing');
  const pubsub = new RegexPubSub();

  const messages = [];
  const id1 = pubsub.subscribe(/^Runtime\./, (topic, data) => {
    messages.push({ topic, data });
    console.log(`  ✓ Received: ${topic}`, data);
  });

  const count = pubsub.publish('Runtime.consoleAPICalled', { type: 'log', args: ['Hello'] });
  console.log(`  Notified ${count} subscriber(s)\n`);

  // Test 2: Multiple subscribers with different patterns
  console.log('Test 2: Multiple subscribers with different patterns');
  const pubsub2 = new RegexPubSub();

  pubsub2.subscribe(/^Runtime\./, (topic, data) => {
    console.log(`  Runtime subscriber: ${topic}`);
  });

  pubsub2.subscribe(/^Debugger\./, (topic, data) => {
    console.log(`  Debugger subscriber: ${topic}`);
  });

  pubsub2.subscribe(/.*/, (topic, data) => {
    console.log(`  Catch-all subscriber: ${topic}`);
  });

  console.log('  Publishing Runtime.enable:');
  pubsub2.publish('Runtime.enable', {});
  console.log('  Publishing Debugger.pause:');
  pubsub2.publish('Debugger.pause', {});
  console.log('  Publishing Custom.event:');
  pubsub2.publish('Custom.event', {});
  console.log();

  // Test 3: Unsubscribe
  console.log('Test 3: Unsubscribe');
  const pubsub3 = new RegexPubSub();

  const id = pubsub3.subscribe(/test/, (topic, data) => {
    console.log(`  Received: ${topic}`);
  });

  console.log(`  Subscription count: ${pubsub3.getSubscriptionCount()}`);
  pubsub3.publish('test.message', {});

  pubsub3.unsubscribe(id);
  console.log(`  After unsubscribe: ${pubsub3.getSubscriptionCount()}`);
  const count3 = pubsub3.publish('test.message', {});
  console.log(`  Notified ${count3} subscriber(s) after unsubscribe\n`);

  // Test 4: Complex regex patterns
  console.log('Test 4: Complex regex patterns');
  const pubsub4 = new RegexPubSub();

  pubsub4.subscribe(/^(Runtime|Debugger)\.(enable|disable)$/, (topic, data) => {
    console.log(`  Matched enable/disable: ${topic}`);
  });

  pubsub4.publish('Runtime.enable', {});
  pubsub4.publish('Debugger.disable', {});
  pubsub4.publish('Runtime.evaluate', {}); // Should not match
  console.log();

  // Test 5: Get matching subscriptions
  console.log('Test 5: Get matching subscriptions');
  const pubsub5 = new RegexPubSub();

  pubsub5.subscribe(/^Runtime\./, () => {});
  pubsub5.subscribe(/^Debugger\./, () => {});
  pubsub5.subscribe(/.*paused/, () => {});

  const matches = pubsub5.getMatchingSubscriptions('Debugger.paused');
  console.log(`  Topic "Debugger.paused" matches ${matches.length} subscription(s): ${matches}`);
  console.log();

  // Test 6: Error handling
  console.log('Test 6: Error handling in callbacks');
  const pubsub6 = new RegexPubSub();

  pubsub6.subscribe(/test/, () => {
    throw new Error('Callback error');
  });

  pubsub6.subscribe(/test/, (topic) => {
    console.log(`  Second subscriber still works: ${topic}`);
  });

  const count6 = pubsub6.publish('test.error', {});
  console.log(`  Notified ${count6} subscriber(s) despite error in first callback\n`);

  console.log('✅ All tests completed\n');

  // Example: Chrome DevTools Protocol use case
  console.log('Example: Chrome DevTools Protocol message routing');
  const protocolPubSub = new RegexPubSub();

  // Subscribe to all Runtime events
  protocolPubSub.subscribe(/^Runtime\./, (topic, data) => {
    console.log(`  [Runtime Handler] ${topic}`);
  });

  // Subscribe to all Debugger events
  protocolPubSub.subscribe(/^Debugger\./, (topic, data) => {
    console.log(`  [Debugger Handler] ${topic}`);
  });

  // Subscribe to specific paused events
  protocolPubSub.subscribe(/\.paused$/, (topic, data) => {
    console.log(`  [Pause Handler] Execution paused: ${topic}`);
  });

  // Subscribe to all console-related events
  protocolPubSub.subscribe(/console/i, (topic, data) => {
    console.log(`  [Console Handler] ${topic}`);
  });

  // Simulate protocol events
  console.log('\n  Simulating protocol events:');
  protocolPubSub.publish('Runtime.consoleAPICalled', { type: 'log' });
  protocolPubSub.publish('Debugger.paused', { reason: 'breakpoint' });
  protocolPubSub.publish('Runtime.executionContextCreated', { context: {} });
  protocolPubSub.publish('Console.messageAdded', { message: 'test' });
}

// Run tests
runTests();