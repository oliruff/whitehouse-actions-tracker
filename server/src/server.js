require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

const app = express();
const port = process.env.PORT || 3000;
const CACHE_TTL = process.env.CACHE_TTL || 300000; // 5 minutes default

// ======================
// Security Configuration
// ======================
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
    'Permissions-Policy': 'interest-cohort=()',
    'X-XSS-Protection': '1; mode=block'
  });
  next();
});

// =====================
// Middleware Setup
// =====================
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

// =====================
// Redis Configuration
// =====================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.NODE_ENV === 'production',
    rejectUnauthorized: false
  }
});

redisClient.on('error', (err) => 
  console.error('Redis connection error:', err));

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'proxyLimiter',
  points: parseInt(process.env.RATE_LIMIT_POINTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_DURATION) || 60,
  blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK) || 300,
  inmemoryBlockOnConsumed: parseInt(process.env.RATE_LIMIT_POINTS) || 100
});

// =====================
// Proxy Endpoint
// =====================
app.get('/proxy', 
  async (req, res, next) => {
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await rateLimiter.consume(clientIP);
      next();
    } catch (error) {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later'
      });
    }
  },
  async (req, res) => {
    try {
      const url = new URL(decodeURIComponent(req.query.url));
      
      // Validate URL structure
      if (!isValidWhiteHouseUrl(url)) {
        return res.status(400).json({ 
          error: 'Invalid request',
          message: 'Invalid URL format'
        });
      }

      // Check cache
      const cached = await redisClient.get(url.href);
      if (cached) {
        const { data, headers } = JSON.parse(cached);
        res.set(headers);
        return res.send(data);
      }

      // Fetch and process
      const response = await fetch(url.href, {
        timeout: 5000,
        headers: {
          'User-Agent': process.env.USER_AGENT || 'WhiteHouseActionsTracker/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.text();
      const headers = {
        'Content-Type': response.headers.get('Content-Type'),
        'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL/1000)}`
      };

      // Store in cache
      await redisClient.set(url.href, JSON.stringify({ data, headers }), {
        PX: CACHE_TTL
      });

      res.set(headers).send(data);

    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Please try again later'
      });
    }
  }
);

// =====================
// Health Check Endpoint
// =====================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memoryUsage: process.memoryUsage()
  });
});

// =====================
// Server Management
// =====================
async function startServer() {
  try {
    await redisClient.connect();
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Allowed origins: ${process.env.ALLOWED_ORIGINS || 'none'}`);
      console.log(`Cache TTL: ${CACHE_TTL}ms`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// =====================
// Utility Functions
// =====================
function isValidWhiteHouseUrl(url) {
  const whitelistRegex = /^https:\/\/www\.whitehouse\.gov\/(feed|briefing-room|wp-json)/i;
  return whitelistRegex.test(url.href);
}

// =====================
// Process Management
// =====================
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  await redisClient.quit();
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
}

startServer();