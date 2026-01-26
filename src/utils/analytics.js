import { RoomEvent, TransferSession, DailyStats, ErrorLog } from '../models/Analytics.js';

/**
 * Analytics utility functions for tracking events
 */

// Track room creation
export async function trackRoomCreated(roomId, userId) {
  try {
    await RoomEvent.create({
      roomId,
      eventType: 'created',
      userId,
      userCount: 1
    });
    await incrementDailyStat('roomsCreated');
    await incrementHourlyStat('roomsCreated');
  } catch (error) {
    console.error('[Analytics Error] trackRoomCreated:', error.message);
  }
}

// Track room join
export async function trackRoomJoined(roomId, userId, userCount) {
  try {
    await RoomEvent.create({
      roomId,
      eventType: 'joined',
      userId,
      userCount
    });
    await incrementDailyStat('totalConnections');
    await incrementHourlyStat('connections');
  } catch (error) {
    console.error('[Analytics Error] trackRoomJoined:', error.message);
  }
}

// Track user left
export async function trackUserLeft(roomId, userId, remainingUsers) {
  try {
    await RoomEvent.create({
      roomId,
      eventType: 'user_left',
      userId,
      userCount: remainingUsers
    });
    
    if (remainingUsers === 0) {
      await trackRoomClosed(roomId);
    }
  } catch (error) {
    console.error('[Analytics Error] trackUserLeft:', error.message);
  }
}

// Track room closed
export async function trackRoomClosed(roomId) {
  try {
    // Prevent double-counting the same room closure in a single day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alreadyClosed = await RoomEvent.exists({
      roomId,
      eventType: 'closed',
      timestamp: { $gte: today }
    });

    if (alreadyClosed) {
      return;
    }

    await RoomEvent.create({
      roomId,
      eventType: 'closed',
      userId: 'system',
      userCount: 0
    });
    await incrementDailyStat('roomsCompleted');
  } catch (error) {
    console.error('[Analytics Error] trackRoomClosed:', error.message);
  }
}

// Create transfer session
export async function createTransferSession(roomId, sessionId, initiatorId) {
  try {
    return await TransferSession.create({
      roomId,
      sessionId,
      initiatorId,
      status: 'initiated'
    });
  } catch (error) {
    console.error('[Analytics Error] createTransferSession:', error.message);
    return null;
  }
}

// Update transfer session
export async function updateTransferSession(sessionId, updates) {
  try {
    return await TransferSession.findOneAndUpdate(
      { sessionId },
      updates,
      { new: true }
    );
  } catch (error) {
    console.error('[Analytics Error] updateTransferSession:', error.message);
    return null;
  }
}

/**
 * Record data transferred (simple mode)
 * - Frontend sends total bytes for a transfer
 * - We aggregate into DailyStats and optionally a TransferSession
 */
export async function recordDataTransferred(roomId, bytes, sessionId = null) {
  try {
    const amount = Math.max(0, Number(bytes) || 0);
    if (amount === 0) return null;

    // Update daily aggregated bytes
    await incrementDailyStat('totalBytesTransferred', amount);
    await incrementDailyStat('transfersCompleted', 1);
    await incrementHourlyStat('transfers', 1);

    // If a sessionId is provided, update that session's totalBytes
    if (sessionId) {
      const updated = await TransferSession.findOneAndUpdate(
        { sessionId },
        { 
          $inc: { totalBytes: amount },
          $set: { status: 'completed', endTime: new Date() }
        },
        { new: true }
      );
      if (updated) return updated;
    }

    // Otherwise, create a minimal session record for this transfer
    const minimalSessionId = `${roomId}-${Date.now()}`;
    return await TransferSession.create({
      roomId,
      sessionId: minimalSessionId,
      totalBytes: amount,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    });
  } catch (error) {
    console.error('[Analytics Error] recordDataTransferred:', error.message);
    return null;
  }
}

// Track signaling events (offer, answer, ice-candidate)
export async function trackSignalingEvent(roomId, eventType) {
  try {
    // Find active transfer session for this room
    const session = await TransferSession.findOne({
      roomId,
      status: { $in: ['initiated', 'transferring'] }
    }).sort({ startTime: -1 });
    
    if (session) {
      const updateField = `signalingEventsCount.${eventType}s`;
      await TransferSession.updateOne(
        { _id: session._id },
        { $inc: { [updateField]: 1 } }
      );
    }
  } catch (error) {
    console.error('[Analytics Error] trackSignalingEvent:', error.message);
  }
}

// Log errors
export async function logError(errorType, errorMessage, metadata = {}) {
  try {
    await ErrorLog.create({
      errorType,
      errorMessage,
      metadata,
      roomId: metadata.roomId,
      userId: metadata.userId
    });
  } catch (error) {
    console.error('[Analytics Error] logError:', error.message);
  }
}

// Increment daily stats
export async function incrementDailyStat(field, amount = 1) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await DailyStats.updateOne(
      { date: today },
      { 
        $inc: { [field]: amount },
        $setOnInsert: { date: today }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('[Analytics Error] incrementDailyStat:', error.message);
  }
}

// Increment hourly stats within daily breakdown
async function incrementHourlyStat(field, amount = 1) {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const currentHour = now.getHours();
    
    // Find or create today's stats
    let stats = await DailyStats.findOne({ date: today });
    
    if (!stats) {
      stats = await DailyStats.create({
        date: today,
        hourlyBreakdown: []
      });
    }
    
    // Update hourly breakdown
    const hourIndex = stats.hourlyBreakdown.findIndex(h => h.hour === currentHour);
    
    if (hourIndex === -1) {
      stats.hourlyBreakdown.push({
        hour: currentHour,
        connections: field === 'connections' ? amount : 0,
        roomsCreated: field === 'roomsCreated' ? amount : 0,
        transfers: field === 'transfers' ? amount : 0
      });
    } else {
      stats.hourlyBreakdown[hourIndex][field] = 
        (stats.hourlyBreakdown[hourIndex][field] || 0) + amount;
    }
    
    await stats.save();
  } catch (error) {
    console.error('[Analytics Error] incrementHourlyStat:', error.message);
  }
}

// Get analytics summary
export async function getAnalyticsSummary(days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const [dailyStats, recentEvents, errorStats] = await Promise.all([
      DailyStats.find({ date: { $gte: startDate } }).sort({ date: -1 }),
      RoomEvent.countDocuments({ timestamp: { $gte: startDate } }),
      ErrorLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$errorType', count: { $sum: 1 } } }
      ])
    ]);
    
    return {
      dailyStats,
      totalEvents: recentEvents,
      errors: errorStats,
      period: `Last ${days} days`
    };
  } catch (error) {
    console.error('[Analytics Error] getAnalyticsSummary:', error.message);
    return null;
  }
}
