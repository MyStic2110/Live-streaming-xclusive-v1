import { EventBus } from '../core/EventBus.js';
import { ContextStore } from '../core/ContextStore.js';
import { TimelineSync } from '../core/TimelineSync.js';
import { novaClient } from '../NovaClient.js';
import assert from 'assert';

console.log("--- RUNNING SDK CORE AUTOMATED TESTS ---");

// Test 1: EventBus
const bus = new EventBus();
let eventTriggered = false;
bus.subscribe("test_event", (data) => {
    eventTriggered = data.success;
});
bus.publish("test_event", { success: true });
assert(eventTriggered, "EventBus failed to publish/subscribe correctly.");
console.log("✅ EventBus: Passed");

// Test 2: ContextStore Lifecycle
const store = new ContextStore();
store.register("mock_action", "Does something", () => {});
let schema = store.getSchema();
assert(schema.available_actions["mock_action"] === "Does something", "ContextStore failed to register capability.");
store.unregister("mock_action");
schema = store.getSchema();
assert(schema.available_actions["mock_action"] === undefined, "ContextStore failed to unregister capability.");
console.log("✅ ContextStore (Micro-Schemas): Passed");

// Test 3: TimelineSync Queue Engine
const timeline = new TimelineSync(bus);
timeline.setAgentState("speaking");

let executed = false;
timeline.enqueue(async () => {
    executed = true;
}, (status) => {});

// Should be blocked because agent is "speaking"
assert(executed === false, "TimelineSync failed to block execution while agent was speaking!");

// Release the queue
timeline.setAgentState("idle");

// It is async, so we wait a tick
setTimeout(() => {
    assert(executed === true, "TimelineSync failed to execute after agent stopped speaking!");
    console.log("✅ TimelineSync (Cinematic Engine): Passed");
    console.log("\n--- ALL CORE SDK TESTS PASSED ---");
}, 100);
