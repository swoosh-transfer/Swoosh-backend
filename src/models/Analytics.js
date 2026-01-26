import mongoose from 'mongoose';

// Room Event Schema - Tracks individual room lifecycle events
const roomEventSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['created', 'joined', 'user_left', 'closed'],
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  userCount: {
    type: Number,
    default: 0
  }
});

// Transfer Session Schema - Tracks file transfer sessions
const transferSessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  initiatorId: String,
  receiverId: String,
  
  // Transfer metrics
  fileCount: {
    type: Number,
    default: 0
  },
  totalBytes: {
    type: Number,
    default: 0
  },
  
  // Timing
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  duration: Number, // in seconds
  
  // Status tracking
  status: {
    type: String,
    enum: ['initiated', 'transferring', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'initiated'
  },
  
  // WebRTC metrics
  iceConnectionState: String,
  signalingEventsCount: {
    offers: { type: Number, default: 0 },
    answers: { type: Number, default: 0 },
    iceCandidates: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Daily Statistics Schema - Aggregated daily metrics
const dailyStatsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  
  // Room metrics
  roomsCreated: {
    type: Number,
    default: 0
  },
  roomsCompleted: {
    type: Number,
    default: 0
  },
  peakConcurrentRooms: {
    type: Number,
    default: 0
  },
  
  // User metrics
  totalConnections: {
    type: Number,
    default: 0
  },
  uniqueUsers: {
    type: Number,
    default: 0
  },
  
  // Transfer metrics
  transfersInitiated: {
    type: Number,
    default: 0
  },
  transfersCompleted: {
    type: Number,
    default: 0
  },
  totalBytesTransferred: {
    type: Number,
    default: 0
  },
  
  // Connection quality
  averageSessionDuration: {
    type: Number,
    default: 0
  },
  
  // Hourly breakdown
  hourlyBreakdown: [{
    hour: Number,
    connections: Number,
    roomsCreated: Number,
    transfers: Number
  }]
}, {
  timestamps: true
});

// Error Log Schema - Track errors and issues
const errorLogSchema = new mongoose.Schema({
  roomId: String,
  userId: String,
  errorType: {
    type: String,
    enum: ['room_full', 'room_not_found', 'connection_failed', 'transfer_failed', 'other'],
    required: true
  },
  errorMessage: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: mongoose.Schema.Types.Mixed
});

// Create indexes for better query performance
roomEventSchema.index({ timestamp: -1, eventType: 1 });
transferSessionSchema.index({ startTime: -1, status: 1 });
dailyStatsSchema.index({ date: -1 });
errorLogSchema.index({ timestamp: -1, errorType: 1 });

// Models
export const RoomEvent = mongoose.model('RoomEvent', roomEventSchema);
export const TransferSession = mongoose.model('TransferSession', transferSessionSchema);
export const DailyStats = mongoose.model('DailyStats', dailyStatsSchema);
export const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);
