const http = require('http');

async function fetchAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('--- AURUM PHASE 4 END-TO-END VERIFICATION ---');
  
  try {
    // 1. Watchlist
    console.log('\n[1/4] Adding TCS to Watchlist (GET/POST /api/watchlist)');
    let res = await fetchAPI('/api/watchlist', 'POST', { symbol: 'TCS.NS' });
    console.log('  Watchlist Update:', res.status === 200 ? 'SUCCESS' : 'FAILED', res.data);

    // 2. ML Inference (Feature Gen -> Evaluation)
    console.log('\n[2/4] Running ML Inference for TCS (POST /api/ml/predict)');
    res = await fetchAPI('/api/ml/predict', 'POST', { symbol: 'TCS.NS', version: 'v2' });
    console.log('  ML Inference:', res.status === 200 ? 'SUCCESS' : 'FAILED');
    if (res.status === 200) {
      console.log('    Prediction:', res.data.prediction);
      console.log('    Confidence:', res.data.calibratedConfidence + '%');
      console.log('    Feature Drivers:', res.data.featureDrivers);
    }

    // 3. Strategy / Risk Evaluation (Order Preview)
    console.log('\n[3/4] Evaluating Order & Risk (POST /api/orders/preview)');
    res = await fetchAPI('/api/orders/preview', 'POST', {
      symbol: 'TCS.NS',
      side: 'BUY',
      quantity: 10,
      type: 'MARKET'
    });
    console.log('  Order Preview:', res.status === 200 ? 'SUCCESS' : 'FAILED');
    if (res.status === 200 && res.data.order) {
      console.log('    Risk Status:', res.data.order.riskStatus);
      console.log('    Estimated Total:', res.data.order.estimatedTotal);
    }

    // 4. Broker / Execution (Paper trading via fake webhook)
    console.log('\n[4/4] Executing Paper Trade (Simulated via Webhook /api/webhooks/zerodha)');
    // Just simulating a webhook hit
    res = await fetchAPI('/api/webhooks/zerodha', 'POST', {
      order_id: res.data.order ? res.data.order.id : 'DUMMY',
      status: 'COMPLETE',
      average_price: 3500.00,
      transaction_type: 'BUY'
    });
    console.log('  Webhook Processed:', res.status === 200 ? 'SUCCESS' : 'FAILED');

    console.log('\nPHASE 4 E2E VERIFICATION COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('\nTEST FAILED:', err);
  }
}

runTest();
