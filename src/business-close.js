export const BUSINESS_CLOSE_COUNTDOWN_SECONDS = 3;

export function canConfirmBusinessClose(secondsLeft, busy = false) {
  return Number(secondsLeft) <= 0 && !busy;
}
