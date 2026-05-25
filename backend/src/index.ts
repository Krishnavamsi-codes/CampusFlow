import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getAllRooms, getRoomById, getFreeRoomsNow } from './controllers/roomController';
import { login } from './controllers/authController';
import { cancelClass, moveClass, getCRSchedules, deleteOverride } from './controllers/overrideController';
import { authenticateJWT } from './middlewares/authMiddleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://campus-flow-lime.vercel.app",
      ];

      const isVercelPreview = origin.endsWith(".vercel.app") || origin.includes(".vercel.app");

      if (allowedOrigins.includes(origin) || isVercelPreview) {
        callback(null, true);
      } else {
        console.warn(`[CORS Blocked] Origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json());

// Public room availability APIs
app.get('/api/rooms', getAllRooms);
app.get('/api/rooms/:id', getRoomById);
app.get('/api/availability', getFreeRoomsNow);

// Authentication API
app.post('/api/auth/login', login);

// CR Actions APIs (Protected)
app.post('/api/override/cancel', authenticateJWT as any, cancelClass as any);
app.post('/api/override/move', authenticateJWT as any, moveClass as any);
app.get('/api/cr/schedules', authenticateJWT as any, getCRSchedules as any);
app.delete('/api/override/:id', authenticateJWT as any, deleteOverride as any);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`IIITS Live Rooms API Server running on port ${PORT}`);
    console.log(`=================================================`);
  });
}

export { app };
