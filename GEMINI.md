# RescueGrid — System Architecture, Business Logic & Memory

This document is permanently loaded into the agent's context memory to enforce strict business rules, user roles, security gates, and algorithmic constraints across all development turns.

---

## 1. System Roles & User Separation
* **`DONOR` (Food Producer)**:
  * Entities: Commercial kitchens, banquet halls, hotels, caterers.
  * Workflows: Broadcast food surplus batches, set perishability TTL, interactive pickup entrance pin, verify arriving drivers via 6-digit OTP physical handover gate, inspect AI feasible matches, review ESG scorecards.
  * Security constraint: A donor can only view and authorize pickup for their own listings.
* **`SHELTER` (Food Consumer)**:
  * Entities: Hunger shelters, NGOs, community kitchens, food banks.
  * Workflows: Inbound Redis proximity radar, adjustable scan radius (5km to 3000km All India), broadcast headcount requirements, atomic batch claiming (full or partial capacity split), Apple Wallet-style 6-digit HMAC-SHA256 OTP pass, cancel claim before pickup, confirm delivery receipt.
  * Security constraint: Handover codes are only visible to the specific shelter that claimed the batch.

---

## 2. Core Architectural & Concurrency Logic
* **Dual-Write Architecture**:
  * **Redis 7 In-Memory**: Low-latency runtime engine (`geo:donations`, `geo:shelters`, `listing:<id>` hashes, `channel:alerts` Pub/Sub).
  * **PostgreSQL 15**: ACID-compliant persistence (`food_listings`, `organizations`, `handover_audits`, `recipient_requests`).
* **Atomic Concurrency Control (`CLAIM_LUA_SCRIPT`)**:
  * Prevents race conditions and double allocation across parallel requests.
  * Evaluates active status, tiered priority windows, and executes either full claim (`CLAIMED`, removed from `geo:donations`, 24h retention) or partial claim (`PARTIALLY_CLAIMED`, decrements `quantity_remaining`, keeps remainder in `geo:donations`).
* **Cascading 3-Tier Priority Reservation**:
  * **Tier 1 (0 – 5 min)**: Exclusive lock for Rank #1 matching shelter.
  * **Tier 2 (5 – 15 min)**: Reservation expands to Rank #1 and Top-5 feasible shelters.
  * **Tier 3 (≥ 15 min)**: Fully unlocked for all verified shelters within radius.
* **Biological Shelf-Life Preservation**:
  * Biological timers are immutable (`expires_at`).
  * On claim cancellation:
    * If $> 15$ min remain: Restores to `AVAILABLE`/`PARTIALLY_CLAIMED` with the exact remaining biological TTL (clock never resets).
    * If $\le 15$ min remain: Marked `EXPIRED` to protect food safety.
* **Cryptographic Handover Verification**:
  * Handover pass uses HMAC-SHA256 derived from `listing_id:courier_id:timestamp`.
  * Verified at donor kitchen using constant-time equality (`crypto.timingSafeEqual`).
  * Brute-force protection: 5 failed attempts locks physical gate for 5 minutes (`HTTP 429`).
* **Two-Stage Deterministic Matching Engine**:
  * **Stage A (Hard Feasibility)**: Verification, collection capability, cold storage capacity, dietary match, food safety declaration, round-trip transit feasibility ($25\text{ km/h} + 45\text{m handling}$).
  * **Stage B (Scoring)**: Weighted composite ($0.30 \times \text{Travel} + 0.30 \times \text{Slack} + 0.25 \times \text{Fit} + 0.15 \times \text{Need}$).

---

## 3. Engineering Guidelines for Changes
1. **Preserve Working Logic**: Never alter or rewrite existing working endpoints, Lua scripts, or database queries unless specifically asked.
2. **Dual-Store Integrity**: Whenever listing status or inventory changes, both Redis and PostgreSQL must remain synchronized.
3. **Cluster Safety**: Broadcast cluster events via Redis Pub/Sub (`channel:alerts`) so all 3 container replicas and connected WebSocket clients receive updates.
