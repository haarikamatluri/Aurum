const fs = require('fs');
const path = require('path');

function scanDir(dir, regexes, stats) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanDir(fullPath, regexes, stats);
      }
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      for (const [key, regex] of Object.entries(regexes)) {
        const matches = content.match(regex);
        if (matches) {
          stats[key] += matches.length;
          console.log(`[${key}] Found in ${fullPath}`);
        }
      }
    }
  }
}

const regexes = {
  mockCount: /mock|fake/ig,
  fakeFinancialValueCount: /3420\.50|2500\.00|?10,000,000|\$100,000/g,
  randomFinancialValueCount: /Math\.random\(\)\s*\*/g,
  hardcodedPriceCount: /currentPrice:\s*[\d.]+/g,
  fakeExecutionCount: /status:\s*'EXECUTED'/g,
  staticMLPredictionCount: /prediction:\s*'BUY'|prediction:\s*'SELL'/g,
  fakeNewsCount: /"fake news"|mockNews/ig,
  fakeEarningsCount: /mockEarnings/ig,
};

const stats = {
  mockCount: 0,
  fakeFinancialValueCount: 0,
  randomFinancialValueCount: 0,
  hardcodedPriceCount: 0,
  fakeExecutionCount: 0,
  staticMLPredictionCount: 0,
  fakeNewsCount: 0,
  fakeEarningsCount: 0,
};

scanDir('./src', regexes, stats);
scanDir('./server.js', regexes, stats); // Not a dir, just a file. Need to handle file in scanDir differently.

console.log("Stats:", stats);
