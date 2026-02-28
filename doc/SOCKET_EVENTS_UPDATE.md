# Socket.IO Events Update - Frontend Integration Guide

## Overview
The backend room management system has been improved with better connection handling, capacity limits (2 users per room), and automatic room cleanup. This document outlines all socket event changes for frontend developers.

---

## Events Summary

### ✅ Updated Events
- `room-created`
- `room-joined`
- `user-joined`
- `user-left`
- `error`

### ✨ New Events
- `room-full`
- `room-dismissed`
- `leave-room` (client emit)
- `room-left`

---

## Detailed Event Changes

### 1. **room-created** (Server → Client)
**Purpose:** Sent when user creates a new room

#### Before:
```javascript
socket.emit("room-created", roomId);

// Receiving end:
socket.on("room-created", (roomId) => {
  console.log("Room ID:", roomId);
});
```

#### After:
```javascript
socket.emit("room-created", { 
  roomId, 
  occupancy: 1, 
  capacity: 2 
});

// Receiving end:
socket.on("room-created", (data) => {
  const { roomId, occupancy, capacity } = data;
  console.log(`Room ${roomId} created | ${occupancy}/${capacity} users`);
});
```

**UI/UX Improvements:**
- Display room capacity information
- Show occupancy status
- Enable capacity indicators/badges

---

### 2. **room-joined** (Server → Client)
**Purpose:** Sent when user successfully joins an existing room

#### Before:
```javascript
socket.emit("room-joined", roomId);

// Receiving end:
socket.on("room-joined", (roomId) => {
  console.log("Joined room:", roomId);
});
```

#### After:
```javascript
socket.emit("room-joined", { 
  roomId, 
  occupancy: 2, 
  capacity: 2,
  isFull: true
});

// Receiving end:
socket.on("room-joined", (data) => {
  const { roomId, occupancy, capacity, isFull } = data;
  console.log(`Joined ${roomId} | ${occupancy}/${capacity} users | Full: ${isFull}`);
});
```

**UI/UX Improvements:**
- Disable join button visually once room is full
- Show real-time occupancy info
- Display warning if room becomes full
- Update capacity indicator

---

### 3. **user-joined** (Server → Client)
**Purpose:** Broadcast to other users when a new peer joins the room

#### Before:
```javascript
socket.to(roomId).emit("user-joined", socket.id);

// Receiving end:
socket.on("user-joined", (userId) => {
  console.log("Peer joined:", userId);
  // Start WebRTC offer creation
});
```

#### After:
```javascript
socket.to(roomId).emit("user-joined", { 
  userId: socket.id,
  occupancy: 2,
  capacity: 2,
  isFull: true
});

// Receiving end:
socket.on("user-joined", (data) => {
  const { userId, occupancy, capacity, isFull } = data;
  console.log(`Peer ${userId} joined | ${occupancy}/${capacity} | Full: ${isFull}`);
  // Start WebRTC offer creation
});
```

**UI/UX Improvements:**
- Update peer avatar/status display
- Show occupancy change in real-time
- Disable further join attempts if room is full
- Show peer connection status

---

### 4. **user-left** (Server → Client)
**Purpose:** Broadcast when a user leaves the room

#### Before:
```javascript
socket.to(roomId).emit("user-left");

// Receiving end:
socket.on("user-left", () => {
  console.log("Peer has left");
});
```

#### After:
```javascript
socket.to(roomId).emit("user-left", { 
  userId: socket.id,
  occupancy: 1,
  capacity: 2
});

// Receiving end:
socket.on("user-left", (data) => {
  const { userId, occupancy, capacity } = data;
  console.log(`Peer ${userId} left | ${occupancy}/${capacity} remaining`);
});
```

**UI/UX Improvements:**
- Hide/remove departed peer's video/status
- Update occupancy display
- Enable join button again if room becomes available
- Show peer disconnection reason/status
- Close RTC connections for that peer

---

### 5. **room-full** (Server → Client) - ✨ NEW
**Purpose:** Sent when room reaches maximum capacity OR when someone tries to join an already full room

**Scenarios:**
1. **After successful join:** Broadcast to all users in room when 2nd user joins
2. **Rejected join attempt:** Sent to user trying to join when room already has 2 users

```javascript
// Scenario 1: Broadcast to all users after room becomes full
io.to(roomId).emit("room-full", { 
  roomId, 
  occupancy: 2,
  capacity: 2, 
  message: "Room is now full. No more users can join." 
});

// Scenario 2: Sent to user attempting to join full room
socket.emit("room-full", { 
  roomId, 
  occupancy: 2,
  capacity: 2, 
  message: "Room is full (2/2 users). Cannot join." 
});

// Receiving end:
socket.on("room-full", (data) => {
  const { roomId, occupancy, capacity, message } = data;
  console.log(message);
  // Disable UI elements or show error
});
```

**UI/UX Improvements:**
- Disable "Join Room" input/button
- Show "Room Full" status badge
- Display notification/toast message
- Prevent further join attempts
- Update room status indicator
- Show error message if join attempt was rejected

---

### 6. **room-dismissed** (Server → Client) - ✨ NEW
**Purpose:** Broadcast when room is deleted (last user leaves)

```javascript
socket.emit("room-dismissed", { 
  roomId, 
  reason: "Room closed" 
});

// Receiving end:
socket.on("room-dismissed", (data) => {
  const { roomId, reason } = data;
  console.log(`Room ${roomId} has been dismissed: ${reason}`);
});
```

**UI/UX Improvements:**
- Show room closure notification
- Clear room data from UI
- Return to main/home page
- Display informative message to user
- Update active rooms list

---

### 7. **leave-room** (Client → Server) - ✨ NEW
**Purpose:** Explicitly leave a room (new event client can emit)

```javascript
// Client sending:
socket.emit("leave-room");

// Server response:
socket.on("room-left", (data) => {
  const { roomId, message } = data;
  console.log(message);
});
```

**UI/UX Improvements:**
- Add "Leave Room" button
- Clean up UI when leaving
- Stop WebRTC connections
- Return to home/waiting state
- Show confirmation message

---

### 8. **room-left** (Server → Client) - ✨ NEW
**Purpose:** Confirmation that user successfully left the room

```javascript
socket.emit("room-left", { 
  roomId, 
  message: "Successfully left the room" 
});

// Receiving end:
socket.on("room-left", (data) => {
  const { roomId, message } = data;
  console.log(message);
});
```

**UI/UX Improvements:**
- Confirm successful room exit
- Clear room status from UI
- Reset connection state
- Return to initial state

---

### 9. **error** (Server → Client) - UPDATED
**Purpose:** Send error messages to client

#### Before:
```javascript
socket.emit("error", "Room is full.");

// Receiving end:
socket.on("error", (message) => {
  console.error("Error:", message);
});
```

#### After:
```javascript
socket.emit("error", { 
  code: 'ROOM_FULL', 
  message: "Room is full (2/2 users)." 
});

// Receiving end:
socket.on("error", (data) => {
  const { code, message } = data;
  console.error(`[${code}] ${message}`);
});
```

**Error Codes:**
- `ROOM_NOT_FOUND` - Room doesn't exist or was dismissed
- `ROOM_FULL` - Room has reached max capacity

**UI/UX Improvements:**
- Handle specific error types differently
- Display user-friendly error messages
- Show error codes for debugging
- Provide recovery options based on error type

---

## Room Constraints & Rules

| Property | Value |
|----------|-------|
| **Max Room Capacity** | 2 users |
| **Room ID Length** | 6 characters (alphanumeric) |
| **Room Lifetime** | Until last user leaves (auto-dismissed) |
| **Concurrent Rooms** | Unlimited |

---

## Implementation Checklist for Frontend

- [ ] Update `room-created` listener to use new payload structure
- [ ] Update `room-joined` listener to use new payload structure
- [ ] Update `user-joined` listener to use new payload structure
- [ ] Update `user-left` listener to use new payload structure
- [ ] Add listener for `room-full` event
- [ ] Add listener for `room-dismissed` event
- [ ] Add listener for `room-left` event
- [ ] Implement `leave-room` emit functionality
- [ ] Update error handler to use `code` and `message` properties
- [ ] Update UI to show room occupancy (current/max users)
- [ ] Add visual indicators when room is full
- [ ] Add "Leave Room" button with proper cleanup
- [ ] Display peer userId in connection status
- [ ] Add room dismissal handling (redirect to home)
- [ ] Test all scenarios: create, join, full, dismiss, leave, disconnect

---

## Example Usage Pattern

```javascript
// Create Room
socket.emit("create-room");
socket.on("room-created", ({ roomId, occupancy, capacity }) => {
  console.log(`Created room ${roomId}: ${occupancy}/${capacity}`);
  displayRoomInfo(roomId, occupancy, capacity);
});

// Join Room
socket.emit("join-room", "ABC123");
socket.on("room-joined", ({ roomId, occupancy, capacity, isFull }) => {
  console.log(`Joined ${roomId}: ${occupancy}/${capacity}, Full: ${isFull}`);
  updateRoomStatus(occupancy, capacity, isFull);
});

// Listen for peer join
socket.on("user-joined", ({ userId, occupancy, capacity, isFull }) => {
  console.log(`Peer ${userId} joined`);
  startWebRTCOffer();
});

// Listen for room full (sent when room becomes full OR when join is rejected)
socket.on("room-full", ({ roomId, occupancy, capacity, message }) => {
  console.log(message);
  // Handle both scenarios: in-room notification or join rejection
  showNotification(message);
  disableJoinButton();
});

// Leave Room
function leaveRoom() {
  socket.emit("leave-room");
  socket.on("room-left", ({ roomId, message }) => {
    console.log(message);
    returnToHome();
  });
}

// Listen for room dismissal
socket.on("room-dismissed", ({ roomId, reason }) => {
  console.log(`Room ${roomId} dismissed: ${reason}`);
  returnToHome();
});
```

---

## Benefits & Improvements

✅ **Better UX:** Real-time capacity feedback  
✅ **Improved Connection Management:** Automatic room cleanup  
✅ **User Awareness:** Know room status at all times  
✅ **Error Handling:** Structured error responses with codes  
✅ **Scalability:** Support only 1:1 connections per room  
✅ **Data Integrity:** Proper tracking of users and rooms  

---

**Last Updated:** February 28, 2026  
**Backend Version:** 2.0 (Enhanced Room Management)
