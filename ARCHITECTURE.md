# Trading Agents - Production Architecture & Infrastructure Reference

> **Confidential Reference Document**  
> This file contains the complete operational, infrastructure, DNS, and deployment details for the Trading Agents production system.

---

## 1. System Overview & Architecture

```
                                  Internet
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
     stocks.manikumarsingh.com                   manikumarsingh.com
        (DNS: Cloudflare)                        (DNS: Cloudflare)
                 │                                       │
                 ▼                                       ▼
        ┌──────────────────┐                    ┌──────────────────┐
        │   Hetzner VPS    │                    │ Namecheap Shared │
        │   2.28.118.15    │                    │ (Main Website)   │
        └────────┬─────────┘                    └──────────────────┘
                 │
      ┌──────────┴──────────┐
      │  Nginx (Port 80/443)│  <── Let's Encrypt SSL (Auto-renew)
      └──────────┬──────────┘
                 │
         ┌───────┴───────────────────────┐
         ▼                               ▼
  Static Frontend                  API Backend
  /frontend/dist                   127.0.0.1:5001
  (React / Vite SPA)               (Gunicorn / Flask)
                                         │
                                ┌────────┴────────┐
                                ▼                 ▼
                           DeepSeek LLM      Gmail SMTP (Port 587)
                           API (Reasoning)   (PDF Email Delivery)
```

---

## 2. Server & Infrastructure Details

| Component | Detail |
| :--- | :--- |
| **Hosting Provider** | Hetzner Cloud |
| **Server Model** | CX23 (Shared Resources, Cost-Optimized) |
| **Hardware Specs** | 2 vCPUs, 4 GB RAM, 40 GB NVMe SSD |
| **Operating System** | Ubuntu 24.04 LTS (x86_64) |
| **Server Timezone** | `Asia/Kolkata` (IST, UTC + 5:30) |
| **Public IPv4 Address** | `2.28.118.15` |
| **SSH Access** | `ssh root@2.28.118.15` (Passwordless via local SSH key) |
| **Root Password** | *(Configured securely; SSH key access preferred)* |

---

## 3. Domains, DNS & SSL Configuration

* **Subdomain:** `stocks.manikumarsingh.com`
  * **DNS Provider:** Cloudflare (or Namecheap)
  * **Record Type:** `A`
  * **Target IP:** `2.28.118.15`
  * **Proxy Status:** DNS Only (Grey Cloud)
* **Main Domain:** `manikumarsingh.com`
  * Retained on Namecheap hosting (completely independent from this VPS).
* **SSL / TLS Certificate:**
  * Issued by: Let's Encrypt via `certbot`
  * Installed path: `/etc/letsencrypt/live/stocks.manikumarsingh.com/`
  * Auto-renewal: Configured via `systemd` certbot timer.

---

## 4. Application Paths & Services on the VPS

### File Paths
* **Project Root:** `/var/www/tradingagents`
* **Virtualenv:** `/var/www/tradingagents/venv`
* **Frontend Build:** `/var/www/tradingagents/frontend/dist`
* **Environment File:** `/var/www/tradingagents/.env`
* **Reports Storage:** `/var/www/tradingagents/reports`
* **Cron Log:** `/var/log/tradingagents_cron.log`

### Systemd Service (`tradingagents.service`)
* **Unit File:** `/etc/systemd/system/tradingagents.service`
* **Status Command:** `systemctl status tradingagents`
* **Restart Command:** `systemctl restart tradingagents`
* **Logs Command:** `journalctl -u tradingagents -f`
* **Execution:**
  ```bash
  gunicorn --workers 2 --threads 4 --timeout 600 -b 127.0.0.1:5001 api_server:app
  ```

### Web Server (Nginx)
* **Config File:** `/etc/nginx/sites-available/tradingagents`
* **Enabled Symlink:** `/etc/nginx/sites-enabled/tradingagents`
* **Features:**
  * React SPA URL rewrites (`try_files $uri $uri/ /index.html;`)
  * `/api/` reverse proxy to `http://127.0.0.1:5001/api/`
  * `proxy_buffering off` enabled for live SSE streaming chunks.

---

## 5. Automated Morning Analysis (Cron)

* **Trigger Time:** Every weekday morning at **09:10:00 AM IST sharp** (Monday–Friday).
* **Crontab Entry (`crontab -l` for root):**
  ```bash
  10 9 * * 1-5 cd /var/www/tradingagents && ./venv/bin/python cron_analysis.py "^NSEI" >> /var/log/tradingagents_cron.log 2>&1
  ```
* **Workflow:**
  1. Fetches real-time market data for Nifty 50 (`^NSEI`).
  2. Executes multi-agent analysis with DeepSeek LLM (`deepseek-chat` / `deepseek-reasoner`).
  3. Generates the executive summary for the email body.
  4. Compiles the master report into a formatted PDF using `markdown-pdf`.
  5. Sends the email via Gmail SMTP (`smtp.gmail.com:587`, TLS) from `mani01october@gmail.com` to `hello@manikumarsingh.com`.
  6. Completes before the market opens at 09:15 AM IST.

---

## 6. Maintenance & Deployment Guide

### How to Deploy Code Changes from Your Mac to the VPS

When you update code on your Mac and push to GitHub, run this single command to update the live server:

```bash
# 1. For backend/Python changes:
ssh root@2.28.118.15 "cd /var/www/tradingagents && git pull origin main && systemctl restart tradingagents"

# 2. For frontend/UI changes (or both):
ssh root@2.28.118.15 "cd /var/www/tradingagents && git pull origin main && cd frontend && npm run build && systemctl restart tradingagents"
```

### Useful Quick Commands
```bash
# View live backend logs
ssh root@2.28.118.15 "journalctl -u tradingagents -n 50 -f"

# View morning cron execution log
ssh root@2.28.118.15 "cat /var/log/tradingagents_cron.log"

# Test morning cron manually anytime
ssh root@2.28.118.15 "cd /var/www/tradingagents && ./venv/bin/python cron_analysis.py '^NSEI'"

# Test email delivery manually
ssh root@2.28.118.15 "cd /var/www/tradingagents && ./venv/bin/python test_email.py"
```

---

## 7. OpenClaw Autonomous AI Assistant (Telegram)

* **Service:** OpenClaw Gateway Daemon (`~/.config/systemd/user/openclaw-gateway.service`)
* **AI Model:** Google Gemini 3.6 Flash (`google/gemini-3.6-flash`)
* **Status:** Connected & running in polling mode
* **Telegram Bot:** `@manik_assistant_bot`
* **Dedicated Setup & Troubleshooting Guide:** [CLAW_SETUP.md](file:///Users/manikrsingh/Documents/Tauric%20Research/tradingagents/CLAW_SETUP.md)
* **Features:**
  * 24/7 personal conversational operator
  * Autonomous shell command & script execution inside Docker sandbox
  * Web search & live market summarization
  * Managed via systemd: `systemctl --user -M clawbot@ status openclaw-gateway.service`
  * Quota optimization: `thinkingDefault: "off"` on Gemini 3.6 Flash (single-turn chat, multi-call on demand for tools)

---

## 8. OmniRoute Unified AI Gateway (OmniAI)

* **Gateway Container:** Docker container `omniroute` on Hetzner VPS (`2.28.118.15`)
* **Port Binding:** `127.0.0.1:20128` (Local loopback on VPS, tunneled or bridged to clients)
* **Virtual Combo Model:** `omniai`
* **Endpoint:** `http://127.0.0.1:20128/v1`
* **Authorization Token:** `omniroute-master-key-2026`
* **Provider Routing Priority Chain:**
  1. **Google Gemini (`gemini`):** `gemini/gemini-3.6-flash`, `gemini/gemini-3.1-pro-preview` *(Note: `gemini-2.5-flash` and `gemini-2.5-pro` are officially retired/deprecated by Google returning HTTP 404)*.
  2. **Groq LPU (`groq`):** `groq/llama-3.3-70b-versatile`, `groq/qwen/qwen3.8-27b` — ultra-fast sub-second latency.
  3. **OpenRouter (`openrouter`):** Configured with free-tier fallback models (`:free`) using key `sk-or-v1-...`.
* **⚠️ STRICT POLICY: DeepSeek Exclusion:**
  * By user instruction, DeepSeek is **strictly excluded** from the OmniRoute gateway pool. Never add DeepSeek API keys into OmniRoute DB or `omniai` routing combo without explicit user consent.

---

## 9. Critical Operational Bugfixes & Engineering Knowledge

### 1. Market Data Truncation Bug (`stockstats_utils.py`)
* **Symptom:** `No market data for '<SYMBOL>.NS': latest in-range OHLCV bar has no closing price`
* **Root Cause:** Indian NSE tickers (e.g. `NESTLEIND.NS`, `PINELABS.NS`) returned by Yahoo Finance frequently contain an unpopulated placeholder bar for the current trading session where `Close`, `Open`, `High`, `Low` are `NaN` or empty strings.
* **Fix Applied:** In `tradingagents/dataflows/stockstats_utils.py`, implemented automatic backward scanning to pop trailing rows with `NaN` close prices before computing indicators.

### 2. Frontend Stream Crash (`frontend/src/App.jsx`)
* **Symptom:** `Failed to execute 'json' on 'Response': Unexpected end of JSON input`
* **Root Cause:** If an SSE connection drops or the server returns an empty or raw error body, calling `await response.json()` threw an unhandled JSON parsing exception in React.
* **Fix Applied:** Wrapped response body parsing with `response.text()` fallback and checked `response.ok` to cleanly display HTTP status messages.

### 3. Rate Limit Stalls & Groq 7,000 ITPM Ceiling
* **Symptom:** Multi-agent debate hangs at `29% Complete` on `[tools_market]`.
* **Root Cause:** In TradingAgents, multi-agent debate rounds concatenate full analyst messages, ballooning prompt size to **9,600+ tokens**.
  * Groq Free Tier enforces a strict **7,000 Input Tokens Per Minute (ITPM)** limit, returning `[413]: Request too large (Limit 7000, Requested 9613)`.
  * Google Gemini Free Tier hits 15 RPM / quota exhaustion (`429: rate_limited`).
  * When all providers hit limits simultaneously, OmniRoute returns `503` or `413`, causing TradingAgents to wait in 30-second exponential backoff loops.
* **Resolution Rule:** Keep debate rounds to `shallow` or summarize conversation history so prompt tokens remain < 6,000.

### 4. Telegram Bot "Typing..." Indefinite Freeze
* **Symptom:** `@manik_assistant_bot` shows "typing..." status in Telegram but never replies.
* **Root Cause:** Session context bloat. The conversational history JSON on the VPS accumulated 50,000+ tokens. When OpenClaw sent this massive payload to Gemini/Groq, the API timed out or exceeded max context.
* **Fix Command:** Run `openclaw sessions compact` on the VPS to summarize and compress the active session history back down to under 1,000 tokens.

---

## 10. Service Ports Quick Reference

| Port | Service | Process / Container | Binding |
| :--- | :--- | :--- | :--- |
| **80 / 443** | Nginx Reverse Proxy | `nginx` systemd | `0.0.0.0` (Public) |
| **5001** | TradingAgents Backend API | `api_server.py` (Gunicorn/Flask) | `127.0.0.1` |
| **8001** | Server-Personal Ops Backend | FastAPI (`uvicorn app:app`) | `127.0.0.1` |
| **5180** | Server-Personal Ops Frontend | Vite / React | `127.0.0.1` |
| **18789** | OpenClaw Gateway | Node.js (`clawbot` user) | `127.0.0.1` |
| **20128** | OmniRoute AI Gateway | Docker `omniroute` | `127.0.0.1` |


