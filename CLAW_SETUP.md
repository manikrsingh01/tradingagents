# OpenClaw Autonomous AI Assistant — Production Setup & Maintenance Guide

> **Target Audience:** Future AI coding assistants, DevOps engineers, and system administrators maintaining the private OpenClaw deployment on the Hetzner VPS.

---

## 1. Executive Summary & Host Context

* **Host Machine:** Dedicated Hetzner VPS (CX23 — 2 vCPU, 4 GB RAM, 40 GB NVMe, Ubuntu 24.04 LTS).
* **IPv4 Address:** `2.28.118.15`
* **SSH Access:** `ssh root@2.28.118.15` (Passwordless SSH configured from local development machine).
* **Server Timezone:** `Asia/Kolkata` (IST, UTC+5:30).
* **Core Application:** OpenClaw autonomous AI agent with sandboxed command execution and Telegram connectivity.
* **Co-hosted Services:** Independent from `tradingagents.service` (Python Gunicorn on port `5001`, Nginx SSL on `stocks.manikumarsingh.com`, and daily 9:10 AM IST cron).

---

## 2. OpenClaw Architecture & Service Configuration

### Runtime & Paths
* **OpenClaw Binary:** `/usr/bin/openclaw` (Version `2026.9.3`)
* **Node.js Runtime:** Node.js `v24.21.0` (Global `/usr/bin/node`)
* **Configuration File:** `/root/.openclaw/openclaw.json`
* **Local Gateway Port:** `127.0.0.1:18789` (Loopback only)
* **Log Files:** `/tmp/openclaw/openclaw-YYYY-MM-DD.log` and systemd journal logs.

### Systemd Service Definition
The OpenClaw gateway runs as a user systemd service managed under root:
* **Service File:** `/root/.config/systemd/user/openclaw-gateway.service`
* **Service Name:** `openclaw-gateway.service`

```bash
# Check service status
systemctl --user status openclaw-gateway.service

# Restart gateway
systemctl --user restart openclaw-gateway.service

# Inspect live journal logs
journalctl --user -u openclaw-gateway.service -f
```

### ⚠️ CRITICAL PITFALL: User Lingering (`loginctl enable-linger`)
> [!CAUTION]
> In Ubuntu / systemd, user-level services (`systemctl --user`) are **automatically killed with SIGTERM** the moment an SSH session logs out unless user lingering is enabled.
> 
> Lingering was explicitly enabled on the server:
> ```bash
> loginctl enable-linger root
> ```
> Verify anytime: `loginctl show-user root | grep Linger` (Must return `Linger=yes`). If the server is rebuilt or user changed, **always verify linger is enabled**, otherwise OpenClaw will die when you disconnect from SSH!

---

## 3. Telegram Channel & Zero-Trust Security Protocol

### Telegram Bot Credentials
* **Bot Username:** `@manik_assistant_bot`
* **Bot Token:** `<TELEGRAM_BOT_TOKEN>` (Configured in `/root/.openclaw/openclaw.json`)
* **Primary Owner Telegram ID:** `1010154783`

### The DM Pairing Gate
OpenClaw enforces a zero-trust policy for direct messages:
1. When a new Telegram user messages the bot, OpenClaw halts and responds with an 8-character pairing code (e.g. `5NY3ZYA7`).
2. The server administrator must approve the sender:
   ```bash
   openclaw pairing approve telegram <PAIRING_CODE>
   ```
3. Once approved, the Telegram ID is written to `commands.ownerAllowFrom` in `/root/.openclaw/openclaw.json`:
   ```json
   "commands": {
       "ownerAllowFrom": [
           "telegram:1010154783"
       ]
   }
   ```
4. Subsequent messages from this user ID are executed without any code prompt.

---

## 4. AI Provider & Quota Optimization (Google Gemini)

### Active Model Configuration
* **Provider:** Google Gemini (`google`)
* **Primary Model:** `google/gemini-3.5-flash-lite` (Ultra-fast ~1s latency, maximum Free-Tier burst headroom, prevents 429 burst errors)
* **Automatic Fallback for Deeper Analysis:** `google/gemini-3.5-flash`
* **API Key:** Stored under `auth.profiles["google:manual"]` in `/root/.openclaw/openclaw.json`.

### ⚠️ Rate Limits & Thinking Mode (`thinkingDefault: "off"`)
> [!IMPORTANT]
> **Why 429 RESOURCE_EXHAUSTED happens on Free Tier:**
> OpenClaw is an autonomous agent. When `thinking=medium`, it makes 5–6 chained reasoning calls per user prompt within 10–15 seconds. On Google AI Studio Free Tier (15 RPM / strict token-per-minute limits), this bursts past Google's quota and produces `HTTP 429`.
>
> **The Solution Applied:**
> Under `agents.entries.main`, set `thinkingDefault: "off"`:
> ```json
> "agents": {
>     "entries": {
>         "main": {
>             "identity": {
>                 "name": "Cloud AI",
>                 "emoji": "⚡",
>                 "theme": "sharp, resourceful, and direct — built to get things done."
>             },
>             "thinkingDefault": "off"
>         }
>     }
> }
> ```
>
> **Effect:**
> * Standard conversational and instructional messages reply in **1 single API call** (fast and avoids quota exhaustion).
> * When the user asks for tools/actions (Docker commands, bash scripts, file operations), OpenClaw **dynamically executes multi-step tool calls on-demand**.

---

## 5. Docker Sandboxing & Execution Safety

* **Docker Engine:** Version `29.1.3` running on the host.
* **Container Isolation:** OpenClaw executes untrusted or external scripts in Docker containers rather than directly on the host root filesystem, preventing accidental damage to the Trading Agents environment or host network configuration.

---

## 6. Daily Operations & Troubleshooting Cheat Sheet

| Task | Command on VPS |
| :--- | :--- |
| **Check Gateway Status** | `systemctl --user status openclaw-gateway.service` |
| **Restart Gateway** | `systemctl --user restart openclaw-gateway.service` |
| **View Live Telegram Logs** | `journalctl --user -u openclaw-gateway.service -f` |
| **Check Model & Gateway Startup** | `journalctl --user -u openclaw-gateway.service -n 30 --no-pager` |
| **List Pending Telegram Pairings** | `openclaw pairing list` |
| **Approve Telegram User** | `openclaw pairing approve telegram <CODE>` |
| **List Supported Models** | `openclaw models list` |
| **Run OpenClaw Doctor** | `openclaw doctor` |
| **Verify Root Lingering** | `loginctl show-user root \| grep Linger` |

---

## 7. Full `/root/.openclaw/openclaw.json` Reference

```json
{
    "auth": {
        "profiles": {
            "google:manual": {
                "provider": "google",
                "mode": "api_key"
            }
        }
    },
    "plugins": {
        "entries": {
            "anthropic": {
                "config": {
                    "sessionCatalog": {
                        "enabled": false
                    }
                }
            },
            "codex": {
                "config": {
                    "sessionCatalog": {
                        "enabled": false
                    }
                }
            },
            "telegram": {
                "enabled": true
            }
        }
    },
    "meta": {
        "migrations": {
            "modelPolicyAllowlist": true
        },
        "lastTouchedVersion": "2026.9.3"
    },
    "agents": {
        "defaults": {
            "model": {
                "primary": "google/gemini-3.6-flash"
            },
            "models": {
                "google/gemini-2.5-flash": {},
                "google/gemini-3.6-flash": {}
            }
        },
        "entries": {
            "main": {
                "identity": {
                    "name": "Cloud AI",
                    "emoji": "⚡",
                    "theme": "sharp, resourceful, and direct — built to get things done."
                },
                "thinkingDefault": "off"
            }
        }
    },
    "channels": {
        "telegram": {
            "enabled": true,
            "botToken": "<YOUR_TELEGRAM_BOT_TOKEN>"
        }
    },
    "gateway": {
        "mode": "local",
        "auth": {
            "mode": "token",
            "token": "<LOCAL_GATEWAY_TOKEN>"
        }
    },
    "commands": {
        "ownerAllowFrom": [
            "telegram:1010154783"
        ]
    }
}
```
