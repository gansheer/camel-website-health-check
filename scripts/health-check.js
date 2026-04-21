#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://camel.apache.org/';
const DATA_FILE = 'data/health-data.json';
const SUMMARY_FILE = 'data/health-summary.json';
const RETENTION_DAYS = 90;
const TIMEOUT_MS = 10000;

async function checkWebsite(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let responseData = '';

    const req = https.get(url, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0 (Health Check Bot)' }
    }, (res) => {
      res.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        const cert = res.socket.getPeerCertificate();

        let sslValid = true;
        let sslDaysRemaining = 0;

        if (cert && cert.valid_to) {
          const expiryDate = new Date(cert.valid_to);
          const now = new Date();
          sslDaysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
          sslValid = sslDaysRemaining > 0;
        }

        const contentCheck = responseData.toLowerCase().includes('camel');

        resolve({
          timestamp: new Date().toISOString(),
          status: res.statusCode === 200 && sslValid ? 'up' : 'down',
          httpStatus: res.statusCode,
          responseTime,
          sslValid,
          sslDaysRemaining,
          contentCheck,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        timestamp: new Date().toISOString(),
        status: 'down',
        httpStatus: 0,
        responseTime: Date.now() - startTime,
        sslValid: false,
        sslDaysRemaining: 0,
        contentCheck: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        timestamp: new Date().toISOString(),
        status: 'down',
        httpStatus: 0,
        responseTime: TIMEOUT_MS,
        sslValid: false,
        sslDaysRemaining: 0,
        contentCheck: false,
        error: 'Request timeout'
      });
    });
  });
}

function loadHealthData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      checks: [],
      metadata: {
        lastUpdated: null,
        totalChecks: 0,
        oldestCheck: null
      }
    };
  }

  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading health data:', err.message);
    return {
      checks: [],
      metadata: {
        lastUpdated: null,
        totalChecks: 0,
        oldestCheck: null
      }
    };
  }
}

function saveHealthData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function pruneOldData(checks) {
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return checks.filter(check => new Date(check.timestamp) > cutoffDate);
}

function calculateSummary(checks) {
  if (checks.length === 0) {
    return {
      current: {
        status: 'unknown',
        lastCheck: null,
        responseTime: 0,
        sslDaysRemaining: 0
      },
      uptime: {
        last24h: 0,
        last7d: 0,
        last30d: 0,
        allTime: 0
      },
      performance: {
        avgResponseTime7d: 0,
        avgResponseTime30d: 0,
        minResponseTime: 0,
        maxResponseTime: 0
      }
    };
  }

  const now = Date.now();
  const filterByHours = (hours) => checks.filter(c =>
    (now - new Date(c.timestamp).getTime()) <= hours * 60 * 60 * 1000
  );

  const calculateUptime = (checks) => {
    if (checks.length === 0) return 0;
    const upCount = checks.filter(c => c.status === 'up').length;
    return Math.round((upCount / checks.length) * 1000) / 10;
  };

  const average = (arr) => {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  };

  const checks24h = filterByHours(24);
  const checks7d = filterByHours(24 * 7);
  const checks30d = filterByHours(24 * 30);

  const current = checks[checks.length - 1];

  const responseTimes7d = checks7d.map(c => c.responseTime);
  const responseTimes30d = checks30d.map(c => c.responseTime);
  const allResponseTimes = checks.map(c => c.responseTime);

  return {
    current: {
      status: current.status,
      lastCheck: current.timestamp,
      responseTime: current.responseTime,
      sslDaysRemaining: current.sslDaysRemaining
    },
    uptime: {
      last24h: calculateUptime(checks24h),
      last7d: calculateUptime(checks7d),
      last30d: calculateUptime(checks30d),
      allTime: calculateUptime(checks)
    },
    performance: {
      avgResponseTime7d: average(responseTimes7d),
      avgResponseTime30d: average(responseTimes30d),
      minResponseTime: allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0,
      maxResponseTime: allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0
    }
  };
}

function saveSummary(summary) {
  const dir = path.dirname(SUMMARY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
}

async function main() {
  console.log(`Checking ${TARGET_URL}...`);

  const checkResult = await checkWebsite(TARGET_URL);
  console.log('Check result:', checkResult);

  const healthData = loadHealthData();

  healthData.checks.push(checkResult);

  healthData.checks = pruneOldData(healthData.checks);

  healthData.metadata = {
    lastUpdated: checkResult.timestamp,
    totalChecks: healthData.checks.length,
    oldestCheck: healthData.checks.length > 0 ? healthData.checks[0].timestamp : null
  };

  saveHealthData(healthData);
  console.log(`Health data saved. Total checks: ${healthData.checks.length}`);

  const summary = calculateSummary(healthData.checks);
  saveSummary(summary);
  console.log('Summary saved.');

  console.log(`Status: ${checkResult.status.toUpperCase()}`);
  console.log(`Response time: ${checkResult.responseTime}ms`);
  console.log(`SSL valid: ${checkResult.sslValid} (${checkResult.sslDaysRemaining} days remaining)`);
  console.log(`Content check: ${checkResult.contentCheck}`);

  if (checkResult.status === 'down') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
