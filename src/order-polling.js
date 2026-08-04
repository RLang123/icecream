export function orderPollDelay({ failures = 0, section = "", lastNewAt = 0, now = Date.now() }) {
  if (failures > 0) return Math.min(120000, 5000 * 2 ** Math.min(failures - 1, 5));
  if (section === "orders" || now - lastNewAt < 60000) return 10000;
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
