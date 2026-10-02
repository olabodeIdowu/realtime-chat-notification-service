# High-Scale Real-Time Chat & Notification Service

> Production-grade real-time messaging backend capable of handling 50,000+ concurrent connections with presence, message persistence, and horizontal scaling.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Socket.io](https://img.shields.io/badge/Socket.io-4-black)
![Redis](https://img.shields.io/badge/Redis-7-red)
![Kafka](https://img.shields.io/badge/Kafka-ready-orange)
![Docker](https://img.shields.io/badge/Docker-ready-blue)

## Overview

This service provides a scalable real-time chat and notification system built for high concurrency.

**Key capabilities:**
- WebSocket connections via Socket.io
- Horizontal scaling with Redis Adapter
- Presence system (online / offline / last seen)
- Room-based messaging
- Message persistence
- Event streaming to Kafka for downstream notifications / analytics
- Stateless design ready for multiple instances behind a load balancer

## Architecture

Clients (Web / Mobile)
        │  WebSocket
        ▼
┌────────────────────────────────────────┐
│         Socket.io Servers              │  (multiple instances)
│  - Connection handling                 │
│  - Rooms & Namespaces                  │
│  - Presence                            │
└──────────────┬─────────────────────────┘
               │ Redis Adapter (pub/sub)
               ▼
┌────────────────────────────────────────┐
│              Redis                     │
│  - Adapter for multi-node Socket.io    │
│  - Presence store                      │
│  - Optional message cache              │
└──────────────┬─────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│         Kafka (optional)               │
│  - Chat events                         │
│  - Notification events                 │
└────────────────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────┐
│         MySQL / MongoDB                │
│  - Persistent message history          │
└────────────────────────────────────────┘

### Design Decisions & Trade-offs

| Decision | Why | Trade-off |
|----------|-----|---------|
| Socket.io + Redis Adapter | Enables true horizontal scaling across multiple Node processes/servers | Extra Redis dependency |
| Presence in Redis | Fast reads/writes for online status and last-seen | Eventual consistency if Redis is partitioned |
| Kafka for events | Decouples chat from notification / analytics pipelines | Added operational complexity |
| Stateless servers | Easy to scale and deploy | All shared state lives in Redis / DB |
| Room-based model | Simple and efficient for group chats | Large rooms need careful monitoring |

## Tech Stack

- **Runtime:** Node.js 18+ + TypeScript
- **Real-time:** Socket.io 4
- **Scaling:** @socket.io/redis-adapter
- **Presence & Pub/Sub:** Redis
- **Event Streaming:** KafkaJS (optional)
- **Persistence:** MySQL (message history)
- **Infra:** Docker + Docker Compose

## Quick Start

```bash
git clone https://github.com/olabodeIdowu/realtime-chat-notification-service.git
cd realtime-chat-notification-service
cp .env.example .env
docker-compose up --build

Service will be available at: http://localhost:5000Test with a simple clientYou can use any Socket.io client or the browser console:js

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join', { room: 'general', userId: 'user_1', username: 'Olabode' });
});

socket.on('message', (msg) => console.log('New message:', msg));
socket.on('presence', (data) => console.log('Presence update:', data));

Project Structure

src/
├── config/
│   ├── index.ts
│   ├── redis.ts
│   └── kafka.ts
├── sockets/
│   ├── index.ts
│   ├── presence.ts
│   └── handlers.ts
├── services/
│   └── message.service.ts
├── utils/
│   └── logger.ts
├── app.ts
└── server.ts

What I OwnedEnd-to-end real-time architecture
Horizontal scaling strategy with Redis Adapter
Presence system design
Message flow and basic persistence
Kafka integration for downstream events
Dockerized multi-service local environment

Scaling NotesRun multiple instances of the Node service behind a load balancer (sticky sessions recommended for Socket.io, or pure Redis Adapter).
Redis Adapter handles cross-node emission automatically.
Presence keys use short TTLs + heartbeat to stay accurate.
Kafka allows other services (notification, analytics, moderation) to react without coupling.

Future ImprovementsAdd authentication middleware (JWT) on Socket.io handshake
Implement message delivery receipts and read status
Add rate limiting per socket / user
Move to a dedicated message store (e.g. Cassandra or MongoDB for very high write volume)
Full OpenTelemetry instrumentation

