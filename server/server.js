import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 300000; // Default: 5 minutes

// ======================
// Redis Configuration
// ======================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: process.env.NODE_ENV === 'production',
    rejectUnauthorized: false,
  },
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// ======================
// Rate Limiting
// ======================
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rateLimiter',
  points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 100, // Max requests
  duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 60, // Per duration in seconds
  blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK, 10) || 300, // Block duration in seconds
});

// ======================
// Middleware
// ======================
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// Security Headers
app.use((req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; connect-src 'self';",
    'Permissions-Policy': 'interest-cohort=()',
    'X-XSS-Protection': '1; mode=block',
  });
  next();
});

// ======================
// Proxy Endpoint
// ======================
app.get('/proxy', async (req, res) => {
  try {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await rateLimiter.consume(clientIP);

    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const decodedUrl = decodeURIComponent(targetUrl);
    if (!isValidWhiteHouseUrl(decodedUrl)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Check Redis Cache
    const cachedResponse = await redisClient.get(decodedUrl);
    if (cachedResponse) {
      const { data, headers } = JSON.parse(cachedResponse);
      res.set(headers);
      return res.send(data);
    }

    // Fetch Data
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': process.env.USER_AGENT || 'WhiteHouseActionsTracker/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.text();
    const headers = {
      'Content-Type': response.headers.get('Content-Type'),
      'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL / 1000)}`,
    };

    // Cache Response
    await redisClient.set(decodedUrl, JSON.stringify({ data, headers }), {
      PX: CACHE_TTL,
    });

    res.set(headers).send(data);
  } catch (error) {
    if (error instanceof RateLimiterRedis.RateLimiterRes) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ======================
// Health Check Endpoint
// ======================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memoryUsage: process.memoryUsage(),
  });
});

// ======================
// Utility Functions
// ======================
function isValidWhiteHouseUrl(url) {
  const whiteHouseRegex = /^https:\/\/www\.whitehouse\.gov\/(feed|briefing-room|wp-json)/i;
  return whiteHouseRegex.test(url);
}

// ======================
// Server Initialization
// ======================
async function startServer() {
  try {
    await redisClient.connect();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await redisClient.quit();
  process.exit(0);
});

startServer();
