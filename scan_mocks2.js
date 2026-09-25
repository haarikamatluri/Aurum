const fs = require('fs');
const path = require('path');

function scanDir(target, regexes, stats) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  
  if (stat.isDirectory()) {
    const files = fs.readdirSync(target);
    for (const file of files) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanDir(path.join(target, file), regexes, stats);
      }
    }
  } else if (target.endsWith('.js') || target.endsWith('.ts') || target.endsWith('.html')) {
    const content = fs.readFileSync(target, 'utf8');
    
    for (const [key, regex] of Object.entries(regexes)) {
      const matches = content.match(regex);
      if (matches) {
        stats[key] += matches.length;
        console.log(`[${key}] Found '${matches[0]}' in ${target}`);
      }
    }
  }
}

const regexes = {
  mockCount: /mock|fake/ig,
  fakeFinancialValueCount: /3420\.50|2500\.00|10,000,000|100,000/g,
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
scanDir('./server.js', regexes, stats);

console.log("Stats:", stats);
