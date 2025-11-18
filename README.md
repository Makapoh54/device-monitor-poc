# Device Monitor PoC

This repository contains two cooperating services plus a small UI:

- **Device Monitor** - discovers demo devices, polls their health via REST/gRPC, classifies their state and stores it in Postgres, and exposes both an API and a small frontend.
- **Device Emulator** - a containerised, configurable device API that exposes the same health payload over REST and optionally gRPC, with pluggable behaviour (stable / degraded / down).
- **Docker Compose demo** - spins up 10 emulated devices, one monitor instance, Postgres, and pgAdmin so you can see the system in action end‑to‑end.

## TL;DR – run the demo

- Start everything (monitor, emulators, Postgres, pgAdmin):  
  `docker compose up -d`
- Open the frontend:  
  `http://127.0.0.1:4000/`
- Optional: API and DB tools:  
  - Swagger UI: `http://127.0.0.1:4000/api`  
  - pgAdmin: `http://127.0.0.1:5050/`

## Table of contents

- [Device Monitor](#device-monitor)
- [Device Emulator](#device-emulator)
- [Shared Device Client library](#shared-device-client-library)
- [Docker Compose demo](#docker-compose-demo)
- [AI assistance usage](#ai-assistance-usage)


## Device Monitor

### Purpose

The Device Monitor service is responsible for:

- Discovering device endpoints (the Device Emulator containers in the demo).
- Polling each device over **gRPC when available**, falling back to **REST**.
- Applying a **retry** strategy and mapping responses (or failures) to high‑level states (`online`, `degraded`, `offline`, `unkwown`).
- Verifying a **checksum** on every health payload.
- Persisting the latest known status into **Postgres**.
- Serving:
  - A **JSON API** for devices at `GET /v1/devices`.
  - A **web UI** at `http://127.0.0.1:4000/` (via Docker) that shows device status live.
  - A **Swagger UI** at `http://127.0.0.1:4000/api`.

Internally the app is a NestJS service using Fastify, TypeORM and cron jobs from `@nestjs/schedule`.

### Discovery: pluggable strategies

Discovery is handled by `DiscoveryService`, which maintains a list of pluggable strategies implementing `DiscoveryStrategy` (`discover(): Promise<DiscoveredDevice[]>`).

There are two built‑in strategies:

- **Docker socket discovery (`DockerSocketDiscovery`)**
  - Connects to Docker via `DOCKER_SOCKET_PATH` (default `/var/run/docker.sock`) using `dockerode`.
  - Lists running containers, optionally filtered by the `DISCOVERY_DOCKER_LABEL` label (default `device-monitor.enabled=true`).
  - Builds device HTTP URLs as:
    - `DEVICE_HTTP_PROTOCOL://<serviceName>:DEVICE_HTTP_PORT`
    - Defaults: `http://<serviceName>:3000`.
  - The `<serviceName>` is taken from the Docker Compose service label `com.docker.compose.service` when present, otherwise from the container name.

- **Port scan discovery (`PortScanDiscovery`)**
  - Probes `http://127.0.0.1:<port>/v1/device/status` for ports **3001–3020** with a short timeout.
  - Each port that responds with `2xx` is treated as a discovered device with:
    - `host = "127.0.0.1:<port>"`,
    - `httpUrl = "http://127.0.0.1:<port>"`.

Which strategies are used is controlled at runtime:

- `DISCOVERY_STRATEGIES` – comma‑separated strategy names, e.g.:
  - `DISCOVERY_STRATEGIES=DockerSocketDiscovery,PortScanDiscovery`
  - Unknown names are ignored.
  - If the list is empty or contains no valid strategy, the service falls back to **DockerSocketDiscovery only**.

#### Manual override with `DISCOVERY_DEVICE_LIST`

For demos or fixed environments you can bypass discovery strategies entirely:

- `DISCOVERY_DEVICE_LIST` – comma‑separated list of `host` values.
  - Example (matching the demo Docker network):  
    `DISCOVERY_DEVICE_LIST='device-emulator-udm-se:3000,device-emulator-udm-pro:3000'`
  - Each entry yields a device with:
    - `host = entry`, `httpUrl = "http://"+entry`, and `id` / `name` derived from the same.
- When this variable is non‑empty:
  - Its devices become the **authoritative set**.
  - **All discovery strategies are skipped**.

### Polling and state classification

Polling is owned by `MonitorService` and `DeviceStatusSyncService`:

- **Discovery cron** – `runDiscovery()` runs every **30 seconds**:
  - Runs all configured discovery strategies (unless overridden by `DISCOVERY_DEVICE_LIST`).
  - Fetches an initial status for newly discovered devices.
  - Persists them into Postgres and marks previously discovered but now‑missing devices as `unkwown`.

- **Polling cron** – `pollDevices()` runs every **10 seconds**:
  - Skips polling until at least one discovery cycle has completed.
  - Loads all known devices from Postgres.
  - For each device, it:
    1. Looks up the last discovered endpoint for its `host`.
    2. **Polls the emulator with retries** via `pollDeviceWithRetry()`:
       - Decorated with `@Retry(3, [1000, 2000, 3000])`.
       - Up to **3 attempts** with **1s, 2s, 3s backoff**.
       - Uses `DeviceClientPoolService`, which:
         - Tries **gRPC** first (`DEVICE_GRPC_PORT`, default `50051`).
         - On success, marks the host as gRPC‑capable and uses gRPC for subsequent polls.
         - On failure, falls back to **REST** (`GET <baseUrl>/v1/device/status`) over `DEVICE_HTTP_PORT` (default `3000`).
    3. If polling succeeds:
       - The device is treated as **online** for this cycle.
       - Status is validated and upserted via `DeviceStatusSyncService`.
       - Any recorded failure counter for the device is cleared.
    4. If polling fails (after retries):
       - A per‑MAC failure counter is incremented.
       - The device state is set according to cumulative failures:
         - **1–2 consecutive failures** → `DEGRADED`.
         - **3+ consecutive failures** → `OFFLINE`.
       - State changes are written back to Postgres.
  - If a device is present in the database but **no longer discovered** on the network, it is marked as `UNKOWN`.

### Checksums and DB persistence

The monitor uses `DeviceStatusSyncService` and `ChecksumService` from `@app/common` to ensure consistent updates:

- Every payload from a device includes a `checksum` field.
- The monitor recomputes the checksum locally over the remaining fields and compares it to the provided value:
  - If the checksum does not match, it logs an error but still proceeds to upsert the status.
- To avoid unnecessary writes, it keeps a small in‑memory cache keyed by MAC address:
  - It only writes to Postgres when **either the state** or the **checksum** changes.

Statuses are stored in the `devices` table via TypeORM (`DeviceEntity`), including:

- Identity and topology: MAC address, hostname, model, product line, IP, host (discovery host).
- State: `state`, firmware status, version, checksum, `lastSeenAt`.
- Timestamps: `createdAt`, `updatedAt`, `startupTime`, optional `adoptionTime`.

### API and frontend

The Device Monitor exposes:

- **REST API**
  - `GET /v1/devices` – returns the current content of the `devices` table.
  - When running via Docker Compose, this is reachable at:  
    `http://127.0.0.1:4000/v1/devices`

- **Swagger UI**
  - Configured in `main.ts` with `SwaggerModule.setup('api', ...)`.
  - When running via Docker Compose:  
    `http://127.0.0.1:4000/api`

- **Frontend**
  - A static React SPA compiled into `apps/device-monitor/public`.
  - Served by the monitor at `/` from the same Fastify instance as the API.
  - When you open `http://127.0.0.1:4000/`:
    - The UI regularly refreshes the device list from `GET /v1/devices`.
    - Device tiles update **dynamically** to reflect the latest state (`online`, `degraded`, `offline`, `unkwown`).
    - When a device changes state, the UI surfaces a **notification toast** so you can quickly see flapping or failing devices.

### Device Monitor configuration (environment variables)

All environment values are read at runtime, either directly (`process.env`) or through Nest’s `ConfigService`.

**General**

- `NODE_ENV` – standard Node environment flag (`development`, `production`, …).
- `APP_ENV` – logical application environment:
  - One of: `development`, `staging`, `production`, `test`.
  - Used to set `isDevelopment`, `isProduction`, etc.
- `PORT` – HTTP port the monitor listens on inside the container.
  - Default: `3000`.

**Database (Postgres)**

- `MONITOR_DB_HOST` – hostname of the Postgres instance.  
  Default: `monitor-db` (the service name in `docker-compose.yml`).
- `MONITOR_DB_PORT` – Postgres port.  
  Default: `5432`.
- `MONITOR_DB_USER` – username.  
  Default: `monitor`.
- `MONITOR_DB_PASSWORD` – password.  
  Default: `monitor`.
- `MONITOR_DB_NAME` – database name.  
  Default: `device_monitor`.

**Discovery**

- `DISCOVERY_STRATEGIES` – comma‑separated list of strategy names:
  - Supported: `DockerSocketDiscovery`, `PortScanDiscovery`.
  - Example: `DISCOVERY_STRATEGIES=DockerSocketDiscovery,PortScanDiscovery`.
  - If omitted or invalid, falls back to `DockerSocketDiscovery`.
- `DISCOVERY_DEVICE_LIST` – optional manual list of devices (see above):
  - Example: `DISCOVERY_DEVICE_LIST='device-emulator-udm-se:3000,device-emulator-udm-pro:3000'`.
  - When set and non‑empty, discovery strategies are skipped.
- `DOCKER_SOCKET_PATH` – path to the Docker socket used by `DockerSocketDiscovery`.  
  Default: `/var/run/docker.sock`.
- `DISCOVERY_DOCKER_LABEL` – label filter used to find device containers.  
  Default: `device-monitor.enabled=true`.

**Device polling**

- `DEVICE_HTTP_PORT` – HTTP port on each device used to construct `http://<host>:<port>` URLs.
  - Default: `3000`.
  - Used by both discovery and the REST transport in `DeviceClientPoolService`.
- `DEVICE_HTTP_PROTOCOL` – HTTP scheme for device URLs.  
  Default: `http`.
- `DEVICE_GRPC_PORT` – gRPC port on each device used by the gRPC transport.  
  Default: `50051`.

## Device Emulator

### Concept

The Device Emulator is a **containerised device API** used to simulate network devices in a controlled way. Each container instance:

- Exposes the same **health endpoint** over:
  - **HTTP/REST** (`GET /v1/device/status`).
  - **gRPC** (optional, service `DeviceStatusService`, method `getStatus`).
- Responds with metadata describing a single device (model, product line, firmware status, etc.).
- Uses an internal behaviour engine to simulate:
  - Stable devices.
  - Devices that periodically drop offline.
  - Devices that eventually go completely down.
- Automatically discovers its own IP/MAC using Node’s `os` module.
- Signs every health payload with a **checksum** computed by the shared `ChecksumService`.

Each real Docker container in the demo corresponds to one logical device instance configured purely via environment variables.

### REST and gRPC endpoints

The emulator is also a NestJS application running on Fastify, with optional gRPC microservice:

- **HTTP server**
  - Port: `PORT` (default `3000` inside the container).
  - Versioned via URI; with `apiVersion = "1"` the health endpoint is:
    - `GET /v1/device/status`
  - When a device is mapped to host port `3001` in Docker, you can call:
    - `http://127.0.0.1:3001/v1/device/status`
  - Swagger UI for that emulator is at:
    - `http://127.0.0.1:3001/api`

- **gRPC server**
  - Enabled when `DEVICE_GRPC_ENABLED=true`.
  - Port: `GRPC_PORT` (default `50051` inside the container).
  - Uses the shared proto at `libs/device-client/src/dto/device-status.proto` with:
    - Package: `device`.
    - Service: `DeviceStatusService`.
    - RPC: `rpc getStatus(google.protobuf.Empty) returns (DeviceStatus)`.

### Behaviour modes (`DEVICE_BEHAVIOUR`)

Device behaviour is controlled by the `DEVICE_BEHAVIOUR` environment variable, which is parsed into the `DeviceBehaviour` enum:

- `stable` (default)
  - Device always responds successfully.
  - Health endpoint reports `state = online`.

- `degraded`
  - Device reports `state = degraded`.
  - Additionally, every 15 seconds it simulates an offline window:
    - For a random window of ~2–7 seconds within each 15‑second period, calls to the health endpoint **throw errors**.
    - This causes the monitor to see intermittent failures and eventually classify it as `degraded` or `offline` depending on configuration.

- `down`
  - Device starts out responding normally.
  - After a random delay of **20–60 seconds**, it stops responding to health checks:
    - The emulator throws on `getStatus` and logs a warning.
    - The monitor sees consistent failures and eventually marks the device as `offline`.

Any unknown behaviour value falls back to `stable`.

### Dynamic network info

The emulator does not hard‑code its IP/MAC. Instead, `NetworkInfoService` uses the Node `os` module:

- Reads `os.networkInterfaces()` and filters out internal interfaces.
- For each external interface it captures:
  - Network name.
  - MAC address.
  - IPv4 and IPv6 addresses.
- Aggregates these into a `NetworkInfo` object with:
  - A container identifier from `CONTAINER_NAME` (when set) or a best‑effort local name.
  - A primary MAC and IP address selected from the first non‑internal interface.

The resulting MAC and IP are used in the health payload so the monitor can identify the device consistently, regardless of container IP changes.

### Checksum implementation

Checksum generation is implemented in the shared `ChecksumService` (`libs/common/src/checksum.service.ts`) and used by the emulator to sign health packets:

- The input payload is normalised by:
  - Sorting object keys recursively (using `sort-keys`).
  - Serialising to JSON.
- Primary path: **system `openssl` binary**
  - The service spawns the `openssl` executable with `openssl md5` via `child_process.spawn`.
  - It writes the normalised payload to stdin and parses the `MD5(...) = <digest>` output.
  - If the command exits with non‑zero code or unexpected output, it throws.
- Fallback path: **Node.js `crypto`**
  - If `openssl` is not available or fails, it uses `crypto.createHash('md5')` on the same normalised payload.

The emulator uses `ChecksumService.checksum()` to compute the checksum for each health response. The monitor later recomputes the checksum over the received payload and verifies it with `ChecksumService.verifyChecksum()`. This structure allows other languages/services to compute the same checksum as long as they match the normalisation rules.

### Device Emulator configuration (environment variables)

All emulator behaviour is driven by environment variables read in `apps/device-emulator/src/config/config.ts`.

**General**

- `NODE_ENV` – standard Node environment flag.
- `APP_ENV` – logical environment (`development`, `staging`, `production`, `test`).
- `PORT` – HTTP port to listen on inside the container.  
  Default: `3000`.
- `GRPC_PORT` – gRPC port inside the container.  
  Default: `50051`.
- `DEVICE_GRPC_ENABLED` – whether to start the gRPC server.  
  Values: `'true'` or `'false'` (default `false`).
- `CONTAINER_NAME` – optional container ID/name used in logs and network info.

**Device metadata**

Used to construct the `DeviceStatus` payload:

- `DEVICE_VERSION` – firmware/software version string.
- `DEVICE_FIRMWARE_STATUS` – arbitrary string describing firmware state (e.g. `upToDate`, `updateAvailable`, `outOfDate`).
- `DEVICE_PRODUCT_LINE` – product line identifier (e.g. `network`, `access`, `protect`).
- `DEVICE_SHORTNAME` – short model identifier (e.g. `UDMPROSE`, `USW48`).
- `DEVICE_MODEL` – human‑readable model name (e.g. `UniFi Dream Machine SE`).
- `DEVICE_NAME` – hostname/display name (e.g. `udm-se.local`).
- `DEVICE_IS_MANAGED` – whether the device is managed by a controller.  
  Values: `'true'` or `'false'`.
- `DEVICE_ADOPTION_TIME` – ISO timestamp when the device was adopted, or empty string for unknown.

**Device behaviour**

- `DEVICE_BEHAVIOUR` – behaviour mode:
  - `stable` – always responsive, `state = online`.
  - `degraded` – intermittently rejects health requests, `state = degraded`.
  - `down` – stops responding permanently after a short delay.
  - Any other value → treated as `stable`.


## Shared Device Client library

Communication between the Device Monitor and Device Emulator is mediated by a shared client library in `libs/device-client`, which acts as the **single source of truth** for the device status model and protocols:

- **DTO and proto model**
  - `libs/device-client/src/dto/device-status.dto.ts` defines:
    - `DeviceStatus` – the TypeScript shape for the health payload.
    - `DeviceState` – the shared enum for `online` / `offline` / `degraded` / `unkwown`.
  - `libs/device-client/src/dto/device-status.proto` defines the gRPC schema used by:
    - The Device Emulator (server side) to expose `getStatus`.
    - The Device Monitor (client side) to call the emulator over gRPC.
  - Both services import these definitions via the `@app/device-client` path alias, ensuring that REST, gRPC and in‑process types all stay in sync.

- **Client pool and connection reuse**
  - `DeviceClientPoolService` maintains a pool of transport instances in memory:
    - A `Map<string, DeviceClientTransport>` keyed by endpoint (`rest:<baseUrl>` or `grpc:<host:port>`).
    - A `Map<string, boolean>` (`grpcSupportByHost`) that tracks whether a host supports gRPC.
  - When the monitor polls a device:
    - It first attempts gRPC using a **reused** `GrpcDeviceClientTransport` (and underlying `ClientGrpc`), creating it only once per `<host:port>`.
    - If gRPC fails or is not supported, it falls back to a **reused** `RestDeviceClientTransport` for that host.
  - This architecture avoids repeatedly constructing gRPC clients or HTTP base URLs on every poll, and centralises transport selection logic in one place.


## Docker Compose demo

The root `docker-compose.yml` file provides a ready‑to‑run demo environment that shows all components working together.

### What it starts

Running `docker compose up` brings up:

- **10 Device Emulator containers**
  - Named like `device-emulator-udm-se`, `device-emulator-usw-24-poe`, etc.
  - All share the same emulator image but have different:
    - Device metadata (`DEVICE_MODEL`, `DEVICE_PRODUCT_LINE`, `DEVICE_VERSION`, …).
    - Behaviour (`DEVICE_BEHAVIOUR=stable|degraded|down`).
    - gRPC support (`DEVICE_GRPC_ENABLED=true` on some, omitted on others).
  - Each exposes:
    - HTTP port `3000` → mapped to host ports `3001`–`3010`.
    - gRPC port `50051` → mapped to host ports `50051`–`50060`.
  - They all carry the label `device-monitor.enabled=true` so the monitor’s Docker discovery strategy can find them.

- **Device Monitor**
  - Built from `apps/device-monitor/Dockerfile`.
  - Connected to the same `device-emulator-net` Docker network as the emulators.
  - Has access to the Docker socket (`/var/run/docker.sock`) so it can:
    - Discover emulators by label (`device-monitor.enabled=true`).
    - Use service names as stable hostnames.
  - Uses both discovery strategies by default:
    - `DISCOVERY_STRATEGIES=DockerSocketDiscovery,PortScanDiscovery`.
  - Exposes port `3000` inside the container, mapped to:
    - `http://127.0.0.1:4000/` – frontend and API.

- **Postgres (`monitor-db`)**
  - Image: `postgres:16-alpine`.
  - Database: `device_monitor`.
  - User/password: `monitor`/`monitor`.
  - Data persisted in `monitor-db-data` named volume.

- **pgAdmin (`monitor-sql-explorer`)**
  - Image: `dpage/pgadmin4:8.13`.
  - Exposed on `http://127.0.0.1:5050/`.
  - Default login:
    - Email: `admin@example.com`.
    - Password: `root`.
  - You can point pgAdmin at `monitor-db:5432` to inspect the `devices` table live.

All services are attached to the same custom Docker network: `device-emulator-net`.

### How to run the demo

Prerequisites:

- Docker and Docker Compose installed.

Steps:

1. Build and start the stack:
   - `docker compose up --build`
2. Wait until:
   - All `device-emulator-*` containers report healthy.
   - `device-monitor` starts and connects to `monitor-db`.
3. Open the UI:
   - `http://127.0.0.1:4000/` – Device Monitor frontend.
   - `http://127.0.0.1:4000/api` – Device Monitor Swagger UI.
   - `http://127.0.0.1:5050/` – pgAdmin to inspect Postgres.

### Demo behaviour

Once the stack is running:

- The **Device Monitor**:
  - Discovers all 10 emulators via the Docker socket (label `device-monitor.enabled=true`) and port scanning.
  - Establishes per‑device clients, preferring gRPC for emulators with `DEVICE_GRPC_ENABLED=true` and falling back to REST for the others.
  - Polls device health continuously, applying retries and updating states based on success or failure.
  - Persists the latest state for every device in Postgres.

- The **Device Emulator fleet**:
  - A subset of devices are configured with `DEVICE_BEHAVIOUR=degraded` or `DEVICE_BEHAVIOUR=down`, so they:
    - Periodically drop offline for brief windows.
    - Or eventually stop responding entirely.
  - Another subset has `DEVICE_GRPC_ENABLED=true`, so the monitor uses gRPC for those.
  - The rest respond over REST only.

- The **frontend**:
  - Continuously refreshes device statuses from the monitor.
  - Reflects topology and health changes in near real time (e.g. a tile transitioning from `online` → `degraded` → `offline`).
  - Shows **toast notifications** whenever a device changes state, making it easy to see flapping devices or outages as they happen.

This setup gives you a complete, reproducible environment to experiment with device discovery, health monitoring over REST and gRPC, and UI visualisation, without needing any physical hardware.

## AI assistance usage

This PoC was developed primarily by hand, with **limited AI assistance** used as a supporting tool. In particular:

- I used AI coding assistants (such as ChatGPT / Codex-style tools) to sanity‑check ideas, clarify library APIs, and get feedback on alternative designs.
- I asked for help drafting or tightening some documentation text (including this section) and for small snippets or test scaffolding in a few places.
- All non‑trivial architectural decisions, business logic, and final code were designed, reviewed, and integrated by me; AI suggestions were always treated as proposals and edited or discarded as needed.
