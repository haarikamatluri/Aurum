// ============================================================================
// Aurum Broker Adapter — Zerodha Kite Connect (India / NSE / BSE)
// Supports OAuth token exchange, holdings, positions, balances, order routing
// ============================================================================

class ZerodhaAdapter {
  constructor() {
    this.brokerId = 'zerodha';
    this.name = 'Zerodha Kite Connect';
    this.apiKey = process.env.KITE_API_KEY || null;
    this.apiSecret = process.env.KITE_API_SECRET || null;
    this.accessToken = process.env.KITE_ACCESS_TOKEN || null;
    this.baseUrl = 'https://api.kite.trade';
  }

  isConfigured() {
    return Boolean(this.apiKey && (this.accessToken || this.apiSecret));
  }

  getLoginUrl() {
    if (!this.apiKey) return null;
    return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(this.apiKey)}`;
  }

  async exchangeRequestToken(requestToken) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Zerodha KITE_API_KEY or KITE_API_SECRET is not configured in server environment.');
    }

    const crypto = require('crypto');
    const checksum = crypto.createHash('sha256')
      .update(this.apiKey + requestToken + this.apiSecret)
      .digest('hex');

    const body = new URLSearchParams({
      api_key: this.apiKey,
      request_token: requestToken,
      checksum: checksum
    });

    const res = await fetch(`${this.baseUrl}/session/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await res.json();
    if (!res.ok || data.status === 'error') {
      throw new Error(`Zerodha OAuth Token Exchange Failed: ${data.message || 'Invalid request token'}`);
    }

    this.accessToken = data.data.access_token;
    return {
      accessToken: data.data.access_token,
      userId: data.data.user_id,
      userName: data.data.user_name,
      userType: data.data.user_type,
      exchanges: data.data.exchanges
    };
  }

  async getAccount() {
    if (!this.accessToken) {
      return {
        connected: false,
        brokerId: this.brokerId,
        brokerName: this.name,
        status: 'DISCONNECTED',
        reason: 'Missing Zerodha Kite access token. Authenticate via OAuth flow.'
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/user/profile`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.apiKey}:${this.accessToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch Kite user profile');

      return {
        connected: true,
        brokerId: this.brokerId,
        brokerName: this.name,
        accountId: data.data.user_id,
        dpId: data.data.dp_ids?.[0] || 'IN300128',
        status: 'ACTIVE',
        clientType: data.data.user_type,
        segment: data.data.exchanges || ['EQUITY', 'NSE', 'BSE']
      };
    } catch (err) {
      return {
        connected: false,
        brokerId: this.brokerId,
        brokerName: this.name,
        status: 'ERROR',
        reason: err.message
      };
    }
  }

  async getHoldings() {
    if (!this.accessToken) {
      throw new Error('Zerodha Kite session not authenticated. Access token missing.');
    }

    const res = await fetch(`${this.baseUrl}/portfolio/holdings`, {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Kite Holdings Error: ${data.message}`);

    return (data.data || []).map((h) => ({
      brokerId: this.brokerId,
      symbol: h.tradingsymbol,
      exchange: h.exchange,
      quantity: h.quantity + (h.t1_quantity || 0),
      avgPurchasePrice: h.average_price,
      lastPrice: h.last_price,
      totalInvested: h.average_price * h.quantity,
      currentValue: h.last_price * h.quantity,
      pnl: h.pnl,
      pnlPct: h.average_price > 0 ? (h.pnl / (h.average_price * h.quantity)) * 100 : 0,
      currency: 'INR'
    }));
  }

  async getPositions() {
    if (!this.accessToken) {
      throw new Error('Zerodha Kite session not authenticated.');
    }

    const res = await fetch(`${this.baseUrl}/portfolio/positions`, {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Kite Positions Error: ${data.message}`);

    const netPositions = data.data?.net || [];
    return netPositions.map((p) => ({
      brokerId: this.brokerId,
      symbol: p.tradingsymbol,
      exchange: p.exchange,
      quantity: p.quantity,
      buyAveragePrice: p.buy_price,
      currentPrice: p.last_price,
      unrealizedPL: p.m2m,
      productType: p.product,
      currency: 'INR'
    }));
  }

  async getBalances() {
    if (!this.accessToken) {
      throw new Error('Zerodha Kite session not authenticated.');
    }

    const res = await fetch(`${this.baseUrl}/user/margins`, {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Kite Margins Error: ${data.message}`);

    const equity = data.data?.equity || {};
    return {
      brokerId: this.brokerId,
      brokerName: this.name,
      currency: 'INR',
      availableCash: equity.available?.live_balance || 0,
      investedAmount: equity.utilised?.debits || 0,
      usedMargin: equity.utilised?.m2m_unrealised || 0,
      totalCollateral: equity.net || 0
    };
  }

  async placeOrder(orderReq) {
    if (!this.accessToken) {
      throw new Error('Cannot execute Zerodha live order: KITE_ACCESS_TOKEN is not authenticated.');
    }

    const body = new URLSearchParams({
      tradingsymbol: orderReq.symbol,
      exchange: orderReq.exchange || 'NSE',
      transaction_type: orderReq.side, // BUY or SELL
      order_type: orderReq.orderType || 'MARKET',
      quantity: String(orderReq.quantity),
      product: orderReq.product || 'CNC', // Cash and Carry delivery
      validity: 'DAY'
    });

    if (orderReq.orderType === 'LIMIT') {
      body.append('price', String(orderReq.price));
    }

    const res = await fetch(`${this.baseUrl}/orders/regular`, {
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await res.json();
    if (!res.ok || data.status === 'error') {
      throw new Error(`Zerodha Broker Order Rejected: ${data.message || 'Order failed at broker'}`);
    }

    return {
      success: true,
      brokerOrderId: data.data.order_id,
      brokerStatus: 'SUBMITTED', // Kite returns order_id upon submission
      submittedAt: new Date().toISOString()
    };
  }

  async getOrderStatus(brokerOrderId) {
    if (!this.accessToken) {
      throw new Error('Zerodha Kite session not authenticated.');
    }

    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(brokerOrderId)}`, {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Kite Order Status Error: ${data.message}`);

    const history = data.data || [];
    const latest = history[history.length - 1];

    let normalizedStatus = 'OPEN';
    if (latest.status === 'COMPLETE') normalizedStatus = 'FILLED';
    else if (latest.status === 'REJECTED') normalizedStatus = 'REJECTED';
    else if (latest.status === 'CANCELLED') normalizedStatus = 'CANCELLED';

    return {
      brokerOrderId,
      status: normalizedStatus,
      rawStatus: latest.status,
      filledQuantity: latest.filled_quantity || 0,
      averagePrice: latest.average_price || 0,
      statusMessage: latest.status_message || ''
    };
  }
}

module.exports = new ZerodhaAdapter();
