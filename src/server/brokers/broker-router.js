// ============================================================================
// Aurum Broker Router — Single Dispatch Gateway
// Handles paper simulation vs live broker routing (Zerodha / Webull)
// ============================================================================

const zerodhaAdapter = require('./zerodha-adapter');
const webullAdapter = require('./webull-adapter');

class BrokerRouter {
  getAdapter(brokerId) {
    if (brokerId === 'zerodha') return zerodhaAdapter;
    if (brokerId === 'webull') return webullAdapter;
    return null;
  }

  async getAccountOverview() {
    const zerodhaAccount = await zerodhaAdapter.getAccount();
    const webullAccount = await webullAdapter.getAccount();
    return [zerodhaAccount, webullAccount];
  }

  async routeOrder(orderReq) {
    const targetBroker = orderReq.brokerId || (orderReq.currency === 'INR' || orderReq.market === 'IN' ? 'zerodha' : 'webull');
    const adapter = this.getAdapter(targetBroker);

    if (orderReq.mode === 'PAPER' || !orderReq.executeLiveBroker) {
      // Paper Trading Execution Simulator
      const orderId = `PAPER-ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        isPaper: true,
        success: true,
        orderId,
        brokerOrderId: `SIM-${orderId}`,
        brokerStatus: 'FILLED',
        executionPrice: orderReq.price,
        executedQuantity: orderReq.quantity,
        executedAt: new Date().toISOString(),
        message: `Paper order executed cleanly in isolated simulation mode.`
      };
    }

    if (!adapter) {
      throw new Error(`Unsupported broker ID: ${targetBroker}`);
    }

    if (!adapter.isConfigured()) {
      throw new Error(`BLOCKED BY EXTERNAL DEPENDENCY: ${targetBroker.toUpperCase()} adapter is not configured with live credentials. Cannot execute live money trade.`);
    }

    // Dispatch to external live broker REST API
    const brokerRes = await adapter.placeOrder(orderReq);
    return {
      isPaper: false,
      success: true,
      orderId: `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      brokerOrderId: brokerRes.brokerOrderId,
      brokerStatus: brokerRes.brokerStatus || 'SUBMITTED',
      executedAt: brokerRes.submittedAt,
      message: `Live order submitted to ${adapter.name}. Real Broker Order ID: ${brokerRes.brokerOrderId}`
    };
  }
}

module.exports = new BrokerRouter();
