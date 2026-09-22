require('dotenv').config({ path: '.env' });

async function testProviders() {
    const results = {};
    const timeout = 10000;
    
    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    };

    // 1. Finnhub
    try {
        console.log('Testing Finnhub...');
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) throw new Error('Not configured');
        const res = await fetchWithTimeout(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${apiKey}`);
        const data = await res.json();
        results.finnhub = { status: res.ok ? 'HEALTHY' : 'FAILED', data };
    } catch(e) {
        results.finnhub = { status: 'ERROR', error: e.message };
    }

    // 2. Twelve Data
    try {
        console.log('Testing Twelve Data...');
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        if (!apiKey) throw new Error('Not configured');
        const res = await fetchWithTimeout(`https://api.twelvedata.com/quote?symbol=AAPL&apikey=${apiKey}`);
        const data = await res.json();
        results.twelvedata = { status: data.status === 'error' ? 'FAILED' : 'HEALTHY', data };
    } catch(e) {
        results.twelvedata = { status: 'ERROR', error: e.message };
    }

    // 3. Massive (Polygon.io)
    try {
        console.log('Testing Massive...');
        const apiKey = process.env.MASSIVE_API_KEY;
        if (!apiKey) throw new Error('Not configured');
        const res = await fetchWithTimeout(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apiKey=${apiKey}`);
        const data = await res.json();
        results.massive = { status: res.ok ? 'HEALTHY' : 'FAILED', data };
    } catch(e) {
        results.massive = { status: 'ERROR', error: e.message };
    }

    // 4. Upstox
    try {
        console.log('Testing Upstox...');
        const apiKey = process.env.UPSTOX_API_KEY;
        const accessToken = process.env.UPSTOX_ACCESS_TOKEN;
        if (!apiKey) throw new Error('Not configured');
        
        const headers = { 'Accept': 'application/json' };
        if (accessToken && !accessToken.includes('your_')) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const res = await fetchWithTimeout(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_EQ|INE002A01018`, {
            headers
        });
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch(err) { data = { text }; }
        results.upstox = { status: res.ok ? 'HEALTHY' : 'FAILED', data };
    } catch(e) {
        results.upstox = { status: 'ERROR', error: e.message };
    }

    // 5. Alpha Vantage
    try {
        console.log('Testing Alpha Vantage...');
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) throw new Error('Not configured');
        const res = await fetchWithTimeout(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${apiKey}`);
        const data = await res.json();
        results.alphaVantage = { status: res.ok ? 'HEALTHY' : 'FAILED', data };
    } catch(e) {
        results.alphaVantage = { status: 'ERROR', error: e.message };
    }

    // 6. Gemini
    try {
        console.log('Testing Gemini...');
        let gKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
        if (!gKey) throw new Error('Not configured');
        const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${gKey}`);
        const data = await res.json();
        results.gemini = { status: res.ok ? 'HEALTHY' : 'FAILED', data };
    } catch(e) {
        results.gemini = { status: 'ERROR', error: e.message };
    }

    console.log('\n\n--- RESULTS ---');
    console.log(JSON.stringify(results, null, 2));
}

testProviders();
