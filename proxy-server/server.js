require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const redis = require('redis');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET']
}));

// Redis client for rate limiting
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

// Rate limiter configuration
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'proxyLimiter',
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
});

// Middleware to handle rate limiting
const rateLimiterMiddleware = (req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).send('Too Many Requests'));
};

// Proxy endpoint
app.get('/proxy', rateLimiterMiddleware, async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);
    
    // Validate URL
    if (!url.startsWith('https://www.whitehouse.gov/')) {
      return res.status(400).send('Invalid URL');
    }

    const response = await fetch(url);
    const data = await response.text();
    
    res.set('Content-Type', response.headers.get('Content-Type'));
    res.send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
redisClient.connect().then(() => {
  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
});

// Security headers
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

  // Add to server.js
const cache = new Map();

app.get('/proxy', rateLimiterMiddleware, async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);
    
    // Check cache first
    if (cache.has(url)) {
      const { data, headers, timestamp } = cache.get(url);
      if (Date.now() - timestamp < 300000) { // 5 minute cache
        res.set(headers);
        return res.send(data);
      }
    }

    // ... existing fetch code ...

    // Cache response
    cache.set(url, {
      data,
      headers: {
        'Content-Type': response.headers.get('Content-Type')
      },
      timestamp: Date.now()
    });

    res.set('Content-Type', response.headers.get('Content-Type'));
    res.send(data);
  } catch (error) {
    // ... existing error handling ...
  }
});

// Enhanced security middleware
app.use((req, res, next) => {
    // Validate allowed HTTP methods
    const allowedMethods = ['GET'];
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).send('Method Not Allowed');
    }
    
    // Validate content types
    res.header('Accept', 'application/json');
    next();
  });
  
  // Rate limiting configuration
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false
  });
  
  app.use(limiter);