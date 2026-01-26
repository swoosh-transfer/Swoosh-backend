# Frontend Transfer Events Implementation Guide

This guide explains what events you need to emit from your frontend to work with the backend transfer tracking handlers.

## Overview

The backend has handlers that track file transfer events for analytics. Your frontend needs to emit socket events at key points in the transfer lifecycle to enable this tracking.

## Required Events

### 1. Transfer Start Event

**Emit when:** File transfer begins (after successful connection is established)

**Event name:** `transfer-start`

**Required data:**
```javascript
socket.emit('transfer-start', {
  roomId: string,        // The room ID where transfer happens
  sessionId: string,     // Unique session identifier for this transfer
  fileCount: number,     // Number of files being transferred
  totalBytes: number     // Total size of all files in bytes
});
```

**Example:**
```javascript
socket.emit('transfer-start', {
  roomId: 'ABC123',
  sessionId: 'session-' + Date.now(),
  fileCount: 3,
  totalBytes: 1024 * 1024 * 50  // 50 MB
});
```

---

### 2. Transfer Complete Event

**Emit when:** Transfer finishes successfully and all files are received

**Event name:** `transfer-complete`

**Required data:**
```javascript
socket.emit('transfer-complete', {
  roomId: string,        // The room ID
  sessionId: string      // Same sessionId from transfer-start
});
```

**Example:**
```javascript
socket.emit('transfer-complete', {
  roomId: 'ABC123',
  sessionId: 'session-1234567890'
});
```

---

### 3. Transfer Failed Event

**Emit when:** Transfer fails, is cancelled, or encounters an error

**Event name:** `transfer-failed`

**Required data:**
```javascript
socket.emit('transfer-failed', {
  roomId: string,        // The room ID
  sessionId: string,     // Same sessionId from transfer-start
  reason: string         // Reason for failure (e.g., "cancelled", "network-error", "user-abort")
});
```

**Example:**
```javascript
socket.emit('transfer-failed', {
  roomId: 'ABC123',
  sessionId: 'session-1234567890',
  reason: 'user-cancelled'
});
```

---