// ============================================================================
// Aurum Order State Machine & Legal Transition Engine
// Valid States: CREATED, VALIDATING, SUBMITTED, OPEN, PARTIALLY_FILLED, FILLED, REJECTED, CANCEL_PENDING, CANCELLED, FAILED
// ============================================================================

const ORDER_STATES = {
  CREATED: 'CREATED',
  VALIDATING: 'VALIDATING',
  SUBMITTED: 'SUBMITTED',
  OPEN: 'OPEN',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  REJECTED: 'REJECTED',
  CANCEL_PENDING: 'CANCEL_PENDING',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};

const LEGAL_TRANSITIONS = {
  CREATED: ['VALIDATING', 'FAILED', 'REJECTED'],
  VALIDATING: ['SUBMITTED', 'REJECTED', 'FAILED'],
  SUBMITTED: ['OPEN', 'FILLED', 'REJECTED', 'FAILED'],
  OPEN: ['PARTIALLY_FILLED', 'FILLED', 'CANCEL_PENDING', 'CANCELLED', 'REJECTED', 'FAILED'],
  PARTIALLY_FILLED: ['PARTIALLY_FILLED', 'FILLED', 'CANCEL_PENDING', 'CANCELLED', 'FAILED'],
  CANCEL_PENDING: ['CANCELLED', 'OPEN', 'FAILED'],
  FILLED: [],      // Terminal state
  REJECTED: [],    // Terminal state
  CANCELLED: [],   // Terminal state
  FAILED: []       // Terminal state
};

function transitionOrderState(order, nextState, reason = '') {
  const currentState = order.status || ORDER_STATES.CREATED;

  if (currentState === nextState) {
    return order; // No-op if already in target state
  }

  const allowedNext = LEGAL_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(nextState)) {
    throw new Error(`ILLEGAL ORDER STATE TRANSITION: Cannot transition order ${order.orderId} from ${currentState} to ${nextState}.`);
  }

  order.previousState = currentState;
  order.status = nextState;
  order.updatedAt = new Date().toISOString();
  if (reason) order.statusReason = reason;

  order.stateHistory = order.stateHistory || [];
  order.stateHistory.push({
    from: currentState,
    to: nextState,
    timestamp: order.updatedAt,
    reason
  });

  return order;
}

module.exports = {
  ORDER_STATES,
  LEGAL_TRANSITIONS,
  transitionOrderState
};
