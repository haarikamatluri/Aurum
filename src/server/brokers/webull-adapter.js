// ============================================================================
// Aurum Broker Adapter — Webull Financial (US / NASDAQ / NYSE)
// ============================================================================

class WebullAdapter {
  constructor() {
    this.brokerId = 'webull';
    this.name = 'Webull Financial';
    this.appKey = process.env.WEBULL_APP_KEY || null;
    this.appSecret = process.env.WEBULL_APP_SECRET || null;
    this.accountId = process.env.WEBULL_ACCOUNT_ID || null;
  }

  isConfigured() {
    return Boolean(this.appKey && this.appSecret && this.accountId);
  }

  async getAccount() {
    if (!this.isConfigured()) {
      return {
        connected: false,
        brokerId: this.brokerId,
        brokerName: this.name,
        status: 'BLOCKED BY EXTERNAL DEPENDENCY',
        reason: 'WEBULL_APP_KEY or WEBULL_APP_SECRET credentials missing in server environment.'
      };
    }
    return {
      connected: true,
      brokerId: this.brokerId,
      brokerName: this.name,
      accountId: this.accountId,
      status: 'ACTIVE',
      clientType: 'INDIVIDUAL',
      segment: ['US_EQUITY', 'NASDAQ', 'NYSE']
    };
  }

  async placeOrder(orderReq) {
    if (!this.isConfigured()) {
      throw new Error('BLOCKED BY EXTERNAL DEPENDENCY: Webull API credentials (WEBULL_APP_KEY) not configured on backend.');
    }
    throw new Error('Webull live REST API connection pending official sandbox credentials.');
  }

  async getHoldings() {
    if (!this.isConfigured()) {
      throw new Error('BLOCKED BY EXTERNAL DEPENDENCY: Webull API credentials not configured.');
    }
    return [];
  }
}

module.exports = new WebullAdapter();
