# ADR 0009: Redis VM Memory Capping, Eviction Policy, and Adapter Decoupling

## Status
Accepted [P0]

## Context
In the target GCP VM architecture, Redis runs locally as a systemd-managed daemon alongside Nginx and Node.js (under PM2). On a small VM instance (such as `e2-micro` or `e2-small` with 1 GB–2 GB of RAM), Redis could potentially exhaust system memory if allowed to grow unbounded or if keys lack expiry thresholds.

Additionally:
1. In multi-instance deployments, `@socket.io/redis-adapter` attaches two persistent Redis connections (`pubClient` and `subClient`) per process, which introduces unnecessary connection, memory, and polling overhead when running in a single-instance PM2/VM deployment.
2. In the legacy implementation, every authenticated API request unconditionally queried `system:setting:maintenanceMode` from Redis or MongoDB, creating redundant network round-trips for static system flags.
3. Certain cache setters did not guarantee a mandatory positive TTL, risking permanent memory residency under non-expiring key eviction policies.

## Decision
1. **Local Redis Configuration & Memory Bounds**:
   - The local Redis daemon on the GCP VM must be configured with `maxmemory 128mb` and `maxmemory-policy volatile-lru`.
   - Under `volatile-lru`, Redis will evict keys least recently used *only* among those with an expiration set (`EX`).
   - The database client (`ioredis`) parses standard `redis://` URLs with embedded authentication (e.g. `redis://:password@127.0.0.1:6379`) without third-party cloud SDK dependencies.
2. **Mandatory Expiry Guarantee on Cache Writers**:
   - `cacheHelper.set` and `redisCache.setCache` enforce a minimum positive TTL (defaulting to 300 seconds if non-positive or undefined is provided).
   - This ensures all cache keys carry expiration, making `volatile-lru` eviction strictly predictable.
3. **Decoupling Socket.io Redis Adapter in Single-Instance Mode**:
   - Introduce `SOCKET_IO_REDIS_ADAPTER_ENABLED` (boolean, default `true` for backward compatibility on multi-node clusters).
   - When set to `false` in single-instance VM deployments, Socket.io runs with its native in-memory adapter, eliminating two persistent Redis clients per Node process and reducing idle pub/sub overhead to zero.
4. **Command Overhead Optimization**:
   - Static flags like `system:setting:maintenanceMode` in `auth.js` are cached with a short 5-second in-memory TTL in production, reducing per-request Redis GETs by 99% under load.
5. **Protected Telemetry**:
   - Super Admin `/api/v1/dashboards/admin-portal/system/health` exposes live Redis memory consumption (`used_memory_human`, `maxmemory_human`), eviction counts (`evicted_keys`), and connection state.

## Consequences
### Positive
- Prevents Redis OOM crashes on the VM by enforcing a 128 MB ceiling with predictable `volatile-lru` eviction.
- Reduces Redis command traffic significantly:
  - Socket connect: drops from 2 Redis commands/subs to 0 in single-instance mode.
  - Authenticated request: drops from 3 commands to 1 command (maintenance check cached).
  - Login: drops from 3 commands to 2 commands.
- Retains 100% backward compatibility for multi-node clusters and staging environments.

### Negative / Trade-offs
- Setting maintenance mode may take up to 5 seconds to propagate to non-super-admin requests (mitigated by setting cache TTL to 0 during tests).
