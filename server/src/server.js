require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

const app = express();
const port = process.env.PORT || 3000;

// ======================
// Security Configuration
// ======================
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
    'Permissions-Policy': 'interest-cohort=()'
  });
  next();
});

// =====================
// Middleware Setup
// =====================
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET']
}));

// =====================
// Redis Configuration
// =====================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  legacyMode: false
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'proxyLimiter',
  points: 100,       // 100 requests
  duration: 60,      // per 60 seconds
  blockDuration: 300 // Block for 5 minutes if exceeded
});

// =====================
// Proxy Endpoint
// =====================
app.get('/proxy', 
  async (req, res, next) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      res.status(429).send('Too Many Requests');
    }
  },
  async (req, res) => {
    try {
      const url = decodeURIComponent(req.query.url);
      
      if (!url.startsWith('https://www.whitehouse.gov/')) {
        return res.status(400).send('Invalid URL');
      }

      const cached = await redisClient.get(url);
      if (cached) {
        const { data, headers } = JSON.parse(cached);
        res.set(headers);
        return res.send(data);
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.text();
      const headers = {
        'Content-Type': response.headers.get('Content-Type')
      };

      await redisClient.set(url, JSON.stringify({ data, headers }), {
        PX: 300000 // 5 minute cache
      });
      
      res.set(headers);
      res.send(data);

    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
    }
  }
);

// =====================
// Server Management
// =====================
async function startServer() {
  try {
    await redisClient.connect();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Allowed origins: ${process.env.ALLOWED_ORIGINS || 'none'}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

startServer();