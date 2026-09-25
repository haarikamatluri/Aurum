const http = require('http');

function postJSON(path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 5000, path }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf) }));
    }).on('error', reject);
  });
}

async function runAuditTests() {
  console.log('--- RUNNING EMPIRICAL AUDIT SUITE ---');

  // 1. Order Preview Valid
  const p1 = await postJSON('/api/orders/preview', {}, { symbol: 'TCS', side: 'BUY', quantity: 10, price: 3420, market: 'IN' });
  console.log('1. Order Preview Valid:', p1.status, p1.body.preview.riskCheck);

  // 2. Order Preview Excessive Risk
  const p2 = await postJSON('/api/orders/preview', {}, { symbol: 'TCS', side: 'BUY', quantity: 5000, price: 3420, market: 'IN' });
  console.log('2. Order Preview Risk Exceeded:', p2.status, p2.body.preview.riskCheck);

  // 3. Idempotency Execution Test
  const idempKey = `IDEMP-${Date.now()}`;
  const e1 = await postJSON('/api/orders', { 'x-idempotency-key': idempKey }, { symbol: 'TCS', side: 'BUY', quantity: 5, price: 3420 });
  console.log('3. First Order Executed:', e1.status, e1.body.order.orderId, 'Duplicated:', e1.body.duplicated || false);

  const e2 = await postJSON('/api/orders', { 'x-idempotency-key': idempKey }, { symbol: 'TCS', side: 'BUY', quantity: 5, price: 3420 });
  console.log('4. Second Duplicate Order Executed:', e2.status, e2.body.order.orderId, 'Duplicated:', e2.body.duplicated || false);

  // 5. Emergency Kill Switch Test
  const ksOn = await postJSON('/api/trading/kill-switch', {}, { active: true, reason: 'Audit Test Halt' });
  console.log('5. Enable Kill Switch:', ksOn.body.active, ksOn.body.message);

  const e3 = await postJSON('/api/orders', {}, { symbol: 'TCS', side: 'BUY', quantity: 1, price: 3420 });
  console.log('6. Order During Kill Switch:', e3.status, e3.body);

  const ksOff = await postJSON('/api/trading/kill-switch', {}, { active: false });
  console.log('7. Reset Kill Switch:', ksOff.body.active);

  // 8. ML Predict Test
  const ml = await postJSON('/api/ml/predict', {}, { symbol: 'TCS' });
  console.log('8. ML Predict:', ml.status, ml.body.prediction, 'Confidence:', ml.body.confidence, 'Model:', ml.body.modelId, 'Latency:', ml.body.latencyMs, 'ms');

  // 9. Automation Status
  const auto = await getJSON('/api/automation/status');
  console.log('9. Automation Status:', auto.status, auto.body.automation.status);

  console.log('--- SUITE COMPLETED SUCCESSFULLY ---');
}

runAuditTests().catch(console.error);
