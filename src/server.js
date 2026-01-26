import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import {
  trackRoomCreated,
  trackRoomJoined,
  trackUserLeft,
  trackSignalingEvent,
  logError,
  getAnalyticsSummary,
  recordDataTransferred
} from "./utils/analytics.js";
import {
  handleTransferStart,
  handleTransferComplete,
  handleTransferPaused,
  handleTransferResumed,
  handleTransferFailed
} from "./utils/transferHandlers.js";

// Load environment variables
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const log = (...args) => {
  if (!isProd) {
    console.log(...args);
  }
};

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/swoosh-analytics';

mongoose.connect(MONGODB_URI)
  .then(() => log('[MongoDB] Connected successfully'))
  .catch((err) => console.error('[MongoDB] Connection error:', err.message));

const app = express();

// CORS configuration for frontend
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://swoosh-transfer.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    // if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Map<RoomID, UserCount> - Tracks only the number of users
const roomOccupancy = new Map();

/**
 * Generates a random 6-character Room ID
 */
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

io.on("connection", (socket) => {
  log(`[Connect] Socket ID: ${socket.id}`);

  // --- ROOM MANAGEMENT ---

  socket.on("create-room", async () => {
    const roomId = generateRoomId();
    
    socket.join(roomId);
    roomOccupancy.set(roomId, 1);
    
    // Track analytics
    await trackRoomCreated(roomId, socket.id);
    
    socket.emit("room-created", roomId); 
    log(`[Room Created] ID: ${roomId}`);
  });

  socket.on("join-room", async (roomId) => {
    const roomSize = roomOccupancy.get(roomId) || 0;

    if (roomSize === 0) {
      socket.emit("error", "Room ID not found.");
      await logError('room_not_found', 'Room ID not found', { roomId, userId: socket.id });
      return;
    }
    if (roomSize >= 2) {
      socket.emit("error", "Room is full.");
      await logError('room_full', 'Room is full', { roomId, userId: socket.id });
      return;
    }

    socket.join(roomId);
    roomOccupancy.set(roomId, roomSize + 1);

    // Track analytics
    await trackRoomJoined(roomId, socket.id, roomSize + 1);

    // Notify Initiator that peer has joined (Trigger for Offer)
    socket.to(roomId).emit("user-joined", socket.id);
    
    // Notify Joiner that success
    socket.emit("room-joined", roomId);
    log(`[Room Joined] ID: ${roomId} | User: ${socket.id}`);
  });

  // --- SIGNALING (Forwarding Logic) ---

  socket.on("offer", async ({ offer, roomId }) => {
    // Track signaling event
    await trackSignalingEvent(roomId, 'offer');
    
    // Forward Offer to the other peer in the room
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", async ({ answer, roomId }) => {
    // Track signaling event
    await trackSignalingEvent(roomId, 'answer');
    
    // Forward Answer back to the Initiator
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("ice-candidate", async ({ candidate, roomId }) => {
    // Track signaling event
    await trackSignalingEvent(roomId, 'iceCandidate');
    
    // Forward Network Candidates
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  // --- ENHANCED TRANSFER TRACKING ---
  
  // Optional: Enhanced transfer tracking
  handleTransferStart(socket);
  handleTransferComplete(socket);
  // handleTransferPaused(socket);
  // handleTransferResumed(socket);
  handleTransferFailed(socket);

  // --- DATA TRANSFER (Simple Analytics) ---

  // Frontend emits total bytes for a completed transfer
  // Payload: { roomId, bytes, sessionId? }
  socket.on("data-transfer", async ({ roomId, bytes, sessionId }) => {
    try {
      const result = await recordDataTransferred(roomId, bytes, sessionId);
      if (result) {
        log(`[Data Transfer] Room: ${roomId} | Bytes: ${bytes}`);
      }
    } catch (err) {
      console.error('[Data Transfer Error]:', err.message);
    }
  });

  // --- CLEANUP ---

  socket.on("disconnecting", async () => {
    const rooms = Array.from(socket.rooms);
    
    for (const roomId of rooms) {
      if (roomId !== socket.id && roomOccupancy.has(roomId)) {
        const newSize = roomOccupancy.get(roomId) - 1;
        
        // Track user left
        await trackUserLeft(roomId, socket.id, newSize);
        
        if (newSize <= 0) {
          roomOccupancy.delete(roomId);
          log(`[Room Deleted] ID: ${roomId}`);
        } else {
          roomOccupancy.set(roomId, newSize);
          socket.to(roomId).emit("user-left"); 
        }
      }
    }
  });
});

// --- ANALYTICS API ENDPOINTS ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Get analytics summary
app.get('/api/analytics/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const summary = await getAnalyticsSummary(days);
    res.json(summary);
  } catch (error) {
    console.error('[Analytics API] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get current active rooms count
app.get('/api/analytics/active-rooms', (req, res) => {
  res.json({ 
    activeRooms: roomOccupancy.size,
    rooms: Array.from(roomOccupancy.entries()).map(([id, count]) => ({ id, userCount: count }))
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  log(`Signaling Server running on port ${PORT}`);
  log(`Analytics API available at http://localhost:${PORT}/api/analytics`);
});
