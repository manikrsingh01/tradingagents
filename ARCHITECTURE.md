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
  * Managed via systemd: `systemctl --user status openclaw-gateway.service`
  * Quota optimization: `thinkingDefault: "off"` on Gemini 3.6 Flash (single-turn chat, multi-call on demand for tools)

