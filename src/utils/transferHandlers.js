import { 
  createTransferSession, 
  updateTransferSession, 
  logError 
} from '../utils/analytics.js';
import { TransferSession } from '../models/Analytics.js';

/**
 * Optional Socket Event Handlers for Enhanced Transfer Tracking
 * 
 * Add these event handlers to your server.js inside the io.on("connection") block
 * to track detailed file transfer metrics.
 * 
 * IMPORTANT: Your frontend needs to emit these events for this to work!
 */

/**
 * Track when a file transfer starts
 * Frontend should emit: socket.emit('transfer-start', { roomId, sessionId, fileCount, totalBytes })
 */
export function handleTransferStart(socket) {
  socket.on('transfer-start', async ({ roomId, sessionId, fileCount, totalBytes }) => {
    try {
      await createTransferSession(roomId, sessionId, socket.id);
      await updateTransferSession(sessionId, {
        fileCount,
        totalBytes,
        status: 'transferring',
        startTime: new Date()
      });
      
      console.log(`[Transfer Start] Room: ${roomId} | Files: ${fileCount} | Size: ${formatBytes(totalBytes)}`);
    } catch (error) {
      console.error('[Transfer Start Error]:', error.message);
    }
  });
}

/**
 * Track when a file transfer completes successfully
 * Frontend should emit: socket.emit('transfer-complete', { roomId, sessionId })
 */
export function handleTransferComplete(socket) {
  socket.on('transfer-complete', async ({ roomId, sessionId }) => {
    try {
      const session = await TransferSession.findOne({ sessionId });
      if (!session) {
        console.warn(`[Transfer Complete] Session not found: ${sessionId}`);
        return;
      }
      
      const duration = (Date.now() - new Date(session.startTime).getTime()) / 1000;
      
      await updateTransferSession(sessionId, {
        status: 'completed',
        endTime: new Date(),
        duration,
        receiverId: socket.id
      });
      
      // Update daily stats
      const { incrementDailyStat } = await import('../utils/analytics.js');
      await incrementDailyStat('transfersCompleted');
      await incrementDailyStat('totalBytesTransferred', session.totalBytes);
      
      console.log(`[Transfer Complete] Room: ${roomId} | Duration: ${duration.toFixed(2)}s | ${formatBytes(session.totalBytes)}`);
    } catch (error) {
      console.error('[Transfer Complete Error]:', error.message);
    }
  });
}

/**
 * Track when a transfer is paused
 * Frontend should emit: socket.emit('transfer-paused', { roomId, sessionId })
 */
export function handleTransferPaused(socket) {
  socket.on('transfer-paused', async ({ roomId, sessionId }) => {
    try {
      await updateTransferSession(sessionId, {
        status: 'paused'
      });
      
      console.log(`[Transfer Paused] Room: ${roomId} | Session: ${sessionId}`);
    } catch (error) {
      console.error('[Transfer Paused Error]:', error.message);
    }
  });
}

/**
 * Track when a transfer is resumed
 * Frontend should emit: socket.emit('transfer-resumed', { roomId, sessionId })
 */
export function handleTransferResumed(socket) {
  socket.on('transfer-resumed', async ({ roomId, sessionId }) => {
    try {
      await updateTransferSession(sessionId, {
        status: 'transferring'
      });
      
      console.log(`[Transfer Resumed] Room: ${roomId} | Session: ${sessionId}`);
    } catch (error) {
      console.error('[Transfer Resumed Error]:', error.message);
    }
  });
}

/**
 * Track when a transfer fails or is cancelled
 * Frontend should emit: socket.emit('transfer-failed', { roomId, sessionId, reason })
 */
export function handleTransferFailed(socket) {
  socket.on('transfer-failed', async ({ roomId, sessionId, reason }) => {
    try {
      await updateTransferSession(sessionId, {
        status: reason === 'cancelled' ? 'cancelled' : 'failed',
        endTime: new Date()
      });
      
      await logError('transfer_failed', reason || 'Unknown error', {
        roomId,
        sessionId,
        userId: socket.id
      });
      
      console.log(`[Transfer Failed] Room: ${roomId} | Reason: ${reason}`);
    } catch (error) {
      console.error('[Transfer Failed Error]:', error.message);
    }
  });
}

/**
 * Track transfer progress (optional - can be called periodically)
 * Frontend should emit: socket.emit('transfer-progress', { sessionId, bytesTransferred, percentage })
 */
export function handleTransferProgress(socket) {
  socket.on('transfer-progress', async ({ sessionId, bytesTransferred, percentage }) => {
    try {
      // Store progress in session metadata
      await updateTransferSession(sessionId, {
        $set: {
          'metadata.lastProgress': {
            bytesTransferred,
            percentage,
            timestamp: new Date()
          }
        }
      });
      
      // Optional: Log significant milestones
      if (percentage % 25 === 0) {
        console.log(`[Transfer Progress] Session: ${sessionId} | ${percentage}% | ${formatBytes(bytesTransferred)}`);
      }
    } catch (error) {
      console.error('[Transfer Progress Error]:', error.message);
    }
  });
}

// Utility function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * HOW TO USE IN server.js:
 * 
 * Import these handlers at the top of server.js:
 * 
 * import {
 *   handleTransferStart,
 *   handleTransferComplete,
 *   handleTransferPaused,
 *   handleTransferResumed,
 *   handleTransferFailed,
 *   handleTransferProgress
 * } from './utils/transferHandlers.js';
 * 
 * Then inside io.on("connection", (socket) => { ... }), add:
 * 
 * // Optional: Enhanced transfer tracking
 * handleTransferStart(socket);
 * handleTransferComplete(socket);
 * handleTransferPaused(socket);
 * handleTransferResumed(socket);
 * handleTransferFailed(socket);
 * handleTransferProgress(socket); // Optional - for progress tracking
 */
