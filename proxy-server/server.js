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