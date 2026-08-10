export function orderPollDelay({ failures = 0, section = "", lastNewAt = 0, now = Date.now() }) {
  if (failures > 0) return Math.min(120000, 5000 * 2 ** Math.min(failures - 1, 5));
  if (section === "orders" || now - lastNewAt < 60000) return 15000;
  if (now - lastNewAt < 300000) return 20000;
  return 30000;
}

export function shouldStartOrderPoll({ hidden = false, inFlight = false }) {
  return !hidden && !inFlight;
}

export function orderListChange(previousSignature, orders) {
  const signature = JSON.stringify(Array.isArray(orders) ? orders : []);
  return { changed: signature !== previousSignature, signature };
}

export function newlyAddedOrderIds(seenIds, orders, initialized) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const list = Array.isArray(orders) ? orders : [];
  const added = initialized
    ? list.filter((order) => order?.id && !seen.has(order.id) && order.status === "new").map((order) => order.id)
    : [];
  list.forEach((order) => order?.id && seen.add(order.id));
  return { added, seen };
}

export function createOrderAlertTracker() {
  const pending = new Set();
  return {
    start(ids) {
      const before = pending.size;
      (ids || []).forEach((id) => id && pending.add(id));
      return pending.size > before;
    },
    acknowledge(id) {
      pending.delete(id);
      return pending.size;
    },
    has(id) {
      return pending.has(id);
    },
    get size() {
      return pending.size;
    },
  };
}
