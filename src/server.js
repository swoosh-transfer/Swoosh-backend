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
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://swoosh-transfer.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];

// Normalize to avoid trailing-slash mismatches with the Origin header
const allowedOrigins = rawAllowedOrigins.map(o => o.replace(/\/$/, ''));

// CORS configuration for ping endpoint (allows different origins)
const pingAllowedOrigins = process.env.PING_ALLOWED_ORIGINS 
  ? process.env.PING_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : '*'; // Allow all origins for ping endpoint by default

const pingCorsOptions = {
  origin: pingAllowedOrigins === '*' ? true : function (origin, callback) {
    // Allow requests without origin (e.g., curl, cron jobs)
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (pingAllowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow ping from any origin by default
    }
  },
  credentials: false
};

// Standard CORS configuration for main app
app.use(cors({
  origin: function (origin, callback) {
    // Block requests with no Origin header to avoid unauthenticated sources (curl, scripts)
    if (!origin) return callback(new Error('Origin header required'));

    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) {
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

// Map<RoomID, Set<SocketID>> - Tracks connected users in each room
// Map<SocketID, RoomID> - Tracks which room a socket belongs to
const roomUsers = new Map();
const userRoomMap = new Map();

const MAX_ROOM_CAPACITY = 2;
const ROOM_ID_LENGTH = 6;

/**
 * Generates a random 6-character Room ID
 */
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current room occupancy
 */
function getRoomOccupancy(roomId) {
  return roomUsers.get(roomId)?.size || 0;
}

/**
 * Check if room is full
 */
function isRoomFull(roomId) {
  return getRoomOccupancy(roomId) > MAX_ROOM_CAPACITY;
}

/**
 * Check if room exists and is active
 */
function roomExists(roomId) {
  return roomUsers.has(roomId);
}

/**
 * Delete room and notify clients
 */
function deleteRoom(roomId) {
  if (roomUsers.has(roomId)) {
    io.to(roomId).emit("room-dismissed", { roomId, reason: "Room closed" });
    roomUsers.delete(roomId);
    log(`[Room Dismissed] ID: ${roomId} - No users remaining`);
  }
}

io.on("connection", (socket) => {
  log(`[Connect] Socket ID: ${socket.id}`);

  // --- ROOM MANAGEMENT ---

  socket.on("create-room", async () => {
    const roomId = generateRoomId();
    
    // Initialize room with first user
    roomUsers.set(roomId, new Set([socket.id]));
    userRoomMap.set(socket.id, roomId);
    
    socket.join(roomId);
    
    // Track analytics
    await trackRoomCreated(roomId, socket.id);
    
    socket.emit("room-created", { roomId, occupancy: 1, capacity: MAX_ROOM_CAPACITY }); 
    log(`[Room Created] ID: ${roomId} | Creator: ${socket.id}`);
  });

  socket.on("join-room", async (roomId) => {
    // Validate room exists
    if (!roomExists(roomId)) {
      socket.emit("error", { 
        code: 'ROOM_NOT_FOUND', 
        message: "Room ID not found or has been dismissed." 
      });
      await logError('room_not_found', 'Room ID not found', { roomId, userId: socket.id });
      return;
    }

    // Check if room is full
    const currentOccupancy = getRoomOccupancy(roomId);
    if (isRoomFull(roomId)) {
      // Send room-full event to the user trying to join
      socket.emit("room-full", { 
        roomId, 
        occupancy: currentOccupancy, 
        capacity: MAX_ROOM_CAPACITY,
        message: `Room is full (${currentOccupancy}/${MAX_ROOM_CAPACITY} users). Cannot join.` 
      });
      
      socket.emit("error", { 
        code: 'ROOM_FULL', 
        message: `Room is full (${currentOccupancy}/${MAX_ROOM_CAPACITY} users).` 
      });
      await logError('room_full', 'Room is full', { roomId, userId: socket.id, occupancy: currentOccupancy });
      log(`[Join Rejected] Room: ${roomId} is full | Rejected user: ${socket.id}`);
      return;
    }

    // Add user to room
    roomUsers.get(roomId).add(socket.id);
    userRoomMap.set(socket.id, roomId);
    socket.join(roomId);

    const newOccupancy = getRoomOccupancy(roomId);

    // Track analytics
    await trackRoomJoined(roomId, socket.id, newOccupancy);

    // Notify other users in room
    socket.to(roomId).emit("user-joined", { 
      userId: socket.id,
      occupancy: newOccupancy,
      capacity: MAX_ROOM_CAPACITY,
      isFull: isRoomFull(roomId)
    });
    
    // Notify joiner of success
    socket.emit("room-joined", { 
      roomId, 
      occupancy: newOccupancy, 
      capacity: MAX_ROOM_CAPACITY,
      isFull: isRoomFull(roomId)
    });
    
    log(`[Room Joined] ID: ${roomId} | User: ${socket.id} | Occupancy: ${newOccupancy}/${MAX_ROOM_CAPACITY}`);

    // Notify all users if room is now full
    if (isRoomFull(roomId)) {
      io.to(roomId).emit("room-full", { 
        roomId, 
        occupancy: newOccupancy, 
        message: "Room is now full. No more users can join." 
      });
      log(`[Room Full] ID: ${roomId}`);
    }
  });

  // --- SIGNALING (Forwarding Logic) ---

  socket.on("leave-room", async () => {
    const roomId = userRoomMap.get(socket.id);
    
    if (roomId && roomUsers.has(roomId)) {
      const roomUserSet = roomUsers.get(roomId);
      roomUserSet.delete(socket.id);
      userRoomMap.delete(socket.id);
      socket.leave(roomId);

      const remainingOccupancy = roomUserSet.size;

      // Track analytics
      await trackUserLeft(roomId, socket.id, remainingOccupancy);

      if (remainingOccupancy === 0) {
        // Room is now empty - dismiss it
        deleteRoom(roomId);
      } else {
        // Notify remaining users
        socket.to(roomId).emit("user-left", { 
          userId: socket.id,
          occupancy: remainingOccupancy,
          capacity: MAX_ROOM_CAPACITY
        });
      }

      socket.emit("room-left", { roomId, message: "Successfully left the room" });
      log(`[Room Left] Room: ${roomId} | User: ${socket.id} | Remaining: ${remainingOccupancy}/${MAX_ROOM_CAPACITY}`);
    }
  });

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
    const roomId = userRoomMap.get(socket.id);
    
    if (roomId && roomUsers.has(roomId)) {
      const roomUserSet = roomUsers.get(roomId);
      roomUserSet.delete(socket.id);
      userRoomMap.delete(socket.id);

      const remainingOccupancy = roomUserSet.size;

      // Track analytics
      await trackUserLeft(roomId, socket.id, remainingOccupancy);

      if (remainingOccupancy === 0) {
        // Room is now empty - dismiss it
        deleteRoom(roomId);
      } else {
        // Notify remaining users
        socket.to(roomId).emit("user-left", { 
          userId: socket.id,
          occupancy: remainingOccupancy,
          capacity: MAX_ROOM_CAPACITY
        });
        log(`[User Left] Room: ${roomId} | User: ${socket.id} | Remaining: ${remainingOccupancy}/${MAX_ROOM_CAPACITY}`);
      }
    }
  });

  socket.on("disconnect", () => {
    // Cleanup any remaining references
    const roomId = userRoomMap.get(socket.id);
    if (roomId) {
      userRoomMap.delete(socket.id);
      const roomUserSet = roomUsers.get(roomId);
      if (roomUserSet) {
        roomUserSet.delete(socket.id);
      }
    }
    log(`[Disconnect] Socket ID: ${socket.id}`);
  });
});

// --- ANALYTICS API ENDPOINTS ---

// Ping endpoint for keeping app alive (Render free plan, cron jobs, etc.)
// Allows requests from any origin
app.get('/ping', cors(pingCorsOptions), (req, res) => {
  res.json({ 
    status: 'pong', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

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
  const activeRooms = Array.from(roomUsers.entries()).map(([roomId, userSet]) => ({ 
    id: roomId, 
    userCount: userSet.size,
    capacity: MAX_ROOM_CAPACITY,
    isFull: userSet.size >= MAX_ROOM_CAPACITY
  }));
  
  res.json({ 
    totalActiveRooms: roomUsers.size,
    rooms: activeRooms
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  log(`Signaling Server running on port ${PORT}`);
  log(`Analytics API available at http://localhost:${PORT}/api/analytics`);
});
