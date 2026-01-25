# Swoosh Signaling Server

Backend signaling server for P2P file sharing using WebRTC. It provides room management and forwards SDP/ICE data between two peers.

## Prerequisites
- Node.js 18+ (ES module support)
- npm (comes with Node)

## Setup
1) Install dependencies:
   - `npm install`
2) (Optional) Create a `.env` file:
   - `PORT=5000`

## Scripts
- `npm run start` — run server with Node.
- `npm run dev` — run with nodemon for live reload.

## Run
- Development: `npm run dev`
- Production: `npm run start`

Server listens on `PORT` (default 5000) and enables CORS for all origins.

## Socket.io Events
- `create-room` (client → server): creates a 6-character room ID, joins creator, emits `room-created`.
- `join-room` (client → server): joins existing room if it exists and has <2 users; emits `room-joined` or `error`.
- `user-joined` (server → room): notifies initiator that a peer joined.
- `offer` / `answer` / `ice-candidate`: forwarded between peers within the room.
- `user-left`: emitted to remaining peer when someone disconnects.
- `error`: emitted when join failures occur (room missing or full).

## Room Behavior
- Rooms hold up to 2 users.
- Rooms are removed when empty.
- On disconnect, remaining peer gets `user-left`.

## Suggested Client Flow
1) Peer A: connect → emit `create-room` → store returned `room-created` ID.
2) Peer B: connect → emit `join-room` with ID → wait for `room-joined`.
3) Exchange WebRTC SDP/ICE via `offer`, `answer`, `ice-candidate`.

## Deployment Notes
- Expose the configured `PORT`.
- If hosting behind HTTPS, ensure the client uses the correct WebSocket secure origin (wss://).
- Adjust CORS to restrict origins as needed.
