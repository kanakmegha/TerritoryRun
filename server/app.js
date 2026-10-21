import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

export function createApp({ authRouter = authRoutes, gameRouter = gameRoutes, logRequests = true } = {}) {
  const app = express();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '1mb' }));

  if (logRequests) {
    app.use((req, res, next) => {
      const start = Date.now();
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${Date.now() - start}ms)`);
      });
      next();
    });
  }

  app.use(['/api/auth', '/auth'], authRouter);
  app.use(['/api/game', '/game'], gameRouter);
  app.get(['/', '/api'], (req, res) => res.send('Territory Run API Operational'));

  // Fallback for unhandled routes: return clean JSON 404 instead of HTML
  app.use((req, res, next) => {
    if (res.headersSent) return next();
    return res.status(404).json({
      success: false,
      code: 'endpoint_not_found',
      message: `Endpoint ${req.method} ${req.originalUrl || req.url} does not exist on this server.`,
    });
  });

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, code: 'payload_too_large', message: 'Request body exceeds the 1 MB limit.' });
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, code: 'invalid_json', message: 'Request body must contain valid JSON.' });
    }
    return next(error);
  });

  return app;
}

export default createApp();
