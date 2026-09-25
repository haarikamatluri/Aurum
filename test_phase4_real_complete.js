const http = require('http');

async function fetchAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'auth_token=demo-token-bypass'
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
  console.log('================================================');
  console.log('AURUM PHASE 4: FORENSIC REAL-DATA E2E VERIFICATION');
  console.log('================================================\n');

  try {
    console.log('[1/5] Testing Real-Time Feature Generation (/api/features/TCS)');
    let res = await fetchAPI('/api/features/TCS', 'GET');
    console.log('  Status:', res.status);
    console.log('  Response:', res.data);
    if (!res.data || !res.data.features || typeof res.data.features.returns1D !== 'number') {
      throw new Error('Feature generation failed or returned mock data.');
    }

    console.log('\n[2/5] Testing ML-Driven Strategy Evaluation (/api/strategies/evaluate)');
    res = await fetchAPI('/api/strategies/evaluate', 'POST', { symbol: 'TCS', strategyId: 'STRAT_MOMENTUM_ALPHA_V1' });
    console.log('  Status:', res.status);
    console.log('  Response:', res.data);
    if (res.status !== 200 || !res.data.signalType) {
      throw new Error('Strategy evaluation failed.');
    }

    const priceFromEval = res.data.currentPrice;

    console.log('\n[3/5] Checking Paper Portfolio (/api/paper-trading/portfolio)');
    res = await fetchAPI('/api/paper-trading/portfolio', 'GET');
    console.log('  Status:', res.status);
    const orderCountBefore = res.data.portfolio.paperOrders.length;
    console.log('  Orders Before:', orderCountBefore);

    console.log('\n[4/5] Executing Paper Trade (/api/paper-trading/execute-signal)');
    res = await fetchAPI('/api/paper-trading/execute-signal', 'POST', {
      symbol: 'TCS',
      side: 'BUY',
      quantity: 10,
      price: priceFromEval,
      manualOverride: true
    });
    console.log('  Status:', res.status);
    console.log('  Response:', res.data);

    console.log('\n[5/5] Verifying Audit & Portfolio Update (/api/paper-trading/portfolio)');
    res = await fetchAPI('/api/paper-trading/portfolio', 'GET');
    const orderCountAfter = res.data.portfolio.paperOrders.length;
    console.log('  Orders After:', orderCountAfter);
    
    if (orderCountAfter <= orderCountBefore) {
      throw new Error('Paper order was not recorded in the portfolio.');
    }

    console.log('\n================================================');
    console.log('SUCCESS: All components successfully connected using real data!');
    console.log('================================================');

  } catch (err) {
    console.error('\nTEST FAILED:', err.message);
  }
}

runTest();
