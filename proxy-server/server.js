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

// Validate HTTP methods
app.use((req, res, next) => {
  if (!['GET'].includes(req.method)) {
    return res.status(405).send('Method Not Allowed');
  }
  next();
});

// =====================
// Redis Configuration
// =====================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  legacyMode: false
});

// Rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'proxyLimiter',
  points: 100,       // 100 requests
  duration: 60,      // per 60 seconds
  blockDuration: 300 // Block for 5 minutes if exceeded
});

// =====================
// Caching Configuration
// =====================
const CACHE_TTL = 300000; // 5 minutes

async function getCachedResponse(url) {
  const cacheKey = `cache:${url}`;
  const cached = await redisClient.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}

async function setCachedResponse(url, data, headers) {
  const cacheKey = `cache:${url}`;
  await redisClient.set(cacheKey, JSON.stringify({ data, headers }), {
    PX: CACHE_TTL
  });
}

// =====================
// Proxy Endpoint
// =====================
app.get('/proxy', 
  // Rate limiting middleware
  async (req, res, next) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      res.status(429).send('Too Many Requests');
    }
  },
  
  // Main handler
  async (req, res) => {
    try {
      const url = decodeURIComponent(req.query.url);
      
      // Validate URL pattern
      if (!url.startsWith('https://www.whitehouse.gov/')) {
        return res.status(400).send('Invalid URL');
      }

      // Check cache
      const cached = await getCachedResponse(url);
      if (cached) {
        res.set(cached.headers);
        return res.send(cached.data);
      }

      // Fetch and cache
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.text();
      const headers = {
        'Content-Type': response.headers.get('Content-Type')
      };

      await setCachedResponse(url, data, headers);
      
      res.set(headers);
      res.send(data);

    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send(error.message || 'Internal Server Error');
    }
  }
);

// =====================
// Server Initialization
// =====================
async function startServer() {
  try {
    await redisClient.connect();
    app.listen(port, () => {
      console.log(`Proxy server running on port ${port}`);
      console.log(`Allowed origins: ${process.env.ALLOWED_ORIGINS || 'none'}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

// Start application
startServer();