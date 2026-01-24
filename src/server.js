import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow React client connection
    methods: ["GET", "POST"]
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
  console.log(`[Connect] Socket ID: ${socket.id}`);

  // --- ROOM MANAGEMENT ---

  socket.on("create-room", () => {
    const roomId = generateRoomId();
    
    socket.join(roomId);
    roomOccupancy.set(roomId, 1);
    
    socket.emit("room-created", roomId); 
    console.log(`[Room Created] ID: ${roomId}`);
  });

  socket.on("join-room", (roomId) => {
    const roomSize = roomOccupancy.get(roomId) || 0;

    if (roomSize === 0) {
      socket.emit("error", "Room ID not found.");
      return;
    }
    if (roomSize >= 2) {
      socket.emit("error", "Room is full.");
      return;
    }

    socket.join(roomId);
    roomOccupancy.set(roomId, roomSize + 1);

    // Notify Initiator that peer has joined (Trigger for Offer)
    socket.to(roomId).emit("user-joined", socket.id);
    
    // Notify Joiner that success
    socket.emit("room-joined", roomId);
    console.log(`[Room Joined] ID: ${roomId} | User: ${socket.id}`);
  });

  // --- SIGNALING (Forwarding Logic) ---

  socket.on("offer", ({ offer, roomId }) => {
    // Forward Offer to the other peer in the room
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ answer, roomId }) => {
    // Forward Answer back to the Initiator
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    // Forward Network Candidates
    socket.to(roomId).emit("ice-candidate", { candidate });
  });

  // --- CLEANUP ---

  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms);
    
    rooms.forEach((roomId) => {
      if (roomId !== socket.id && roomOccupancy.has(roomId)) {
        const newSize = roomOccupancy.get(roomId) - 1;
        
        if (newSize <= 0) {
          roomOccupancy.delete(roomId);
          console.log(`[Room Deleted] ID: ${roomId}`);
        } else {
          roomOccupancy.set(roomId, newSize);
          socket.to(roomId).emit("user-left"); 
        }
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Signaling Server running on port ${PORT}`);
});
