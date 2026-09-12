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
* **Dedicated Unprivileged System User:** `clawbot` (UID 1000, Group `docker`, NO sudo privileges)
* **Configuration File:** `/home/clawbot/.openclaw/openclaw.json`
* **Local Gateway Port:** `127.0.0.1:18789` (Loopback only)
* **Log Files:** `/tmp/openclaw-1000/openclaw-YYYY-MM-DD.log` and systemd journal logs.

### Systemd Service Definition
The OpenClaw gateway runs as a user systemd service managed under the isolated `clawbot` user:
* **Service File:** `/home/clawbot/.config/systemd/user/openclaw-gateway.service`
* **Service Name:** `openclaw-gateway.service`

```bash
# Check service status from root
systemctl --user -M clawbot@ status openclaw-gateway.service

# Restart gateway from root
systemctl --user -M clawbot@ restart openclaw-gateway.service

# Inspect live journal logs
journalctl _SYSTEMD_USER_UNIT=openclaw-gateway.service -f
```

### ⚠️ CRITICAL PITFALL: User Lingering (`loginctl enable-linger`)
> [!CAUTION]
> In Ubuntu / systemd, user-level services (`systemctl --user`) are **automatically killed with SIGTERM** the moment an SSH session logs out unless user lingering is enabled.
> 
> Lingering is explicitly enabled for `clawbot`:
> ```bash
> loginctl enable-linger clawbot
> ```
> Verify anytime: `loginctl show-user clawbot | grep Linger` (Must return `Linger=yes`). If the server is rebuilt or user changed, **always verify linger is enabled**, otherwise OpenClaw will die when you disconnect from SSH!

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
* **Provider:** Groq (`groq`)
* **Primary Model:** `groq/openai/gpt-oss-120b` (and `groq/qwen/qwen3.8-27b`)
  * **Free Limits:** High rate limits & blazing fast inference (~0.09s response time)
  * **Architecture:** 120B parameter state-of-the-art open model hosted on Groq LPU
  * **Rate Limit Immunity:** Eliminates Google AI Studio's 1 QPS burst filter
* **Automatic Fallback Chain:**
  1. `google/gemini-3.5-flash-lite`
  2. `google/gemini-3.5-flash`
* **Google Web Search Grounding:** Enabled via `plugins.entries.google.config.webSearch` and `tools.web.search` (`provider: gemini`).
* **Installed System Dependencies:** `yfinance`, `pandas` installed globally on VPS for Python market data tools.
* **API Keys:** Stored securely in OpenClaw auth database (`openclaw models auth paste-api-key --provider groq`) and injected into `openclaw-gateway.service`.

### ⚠️ Provider Model Registration (`models.providers.groq`)
> [!IMPORTANT]
> In OpenClaw, custom/external OpenAI-compatible endpoints like Groq require explicit registration under `models.providers` in `/root/.openclaw/openclaw.json`, otherwise the gateway logs `Unknown model: groq/... Found agents.defaults.models, but no matching models.providers. Add to models.providers to register this provider model` and falls back to Gemini:
> ```json
> "models": {
>     "mode": "merge",
>     "providers": {
>         "groq": {
>             "baseUrl": "https://api.groq.com/openai/v1",
>             "apiKey": "<GROQ_API_KEY>",
>             "api": "openai-completions",
>             "models": [
>                 {
>                     "id": "llama-3.3-70b-versatile",
>                     "name": "llama-3.3-70b-versatile"
>                 }
>             ]
>         }
>     }
> }
> ```

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
| **Check Gateway Status** | `systemctl --user -M clawbot@ status openclaw-gateway.service` |
| **Restart Gateway** | `systemctl --user -M clawbot@ restart openclaw-gateway.service` |
| **View Live Telegram Logs** | `journalctl _SYSTEMD_USER_UNIT=openclaw-gateway.service -f` |
| **Check Recent Gateway Startup Logs** | `journalctl _SYSTEMD_USER_UNIT=openclaw-gateway.service -n 50 --no-pager` |
| **Fix "Typing..." Hang (Compact Session)** | `su - clawbot -c "openclaw sessions compact"` |
| **List Active Sessions** | `su - clawbot -c "openclaw sessions list"` |
| **List Pending Telegram Pairings** | `su - clawbot -c "openclaw pairing list"` |
| **Approve Telegram User** | `su - clawbot -c "openclaw pairing approve telegram <CODE>"` |
| **List Supported Models** | `su - clawbot -c "openclaw models list"` |
| **Run OpenClaw Doctor** | `su - clawbot -c "openclaw doctor"` |
| **Verify Clawbot Lingering** | `loginctl show-user clawbot \| grep Linger` |

---

### ⚠️ Troubleshooting: Indefinite "Typing..." in Telegram (Session Context Bloat)

**Problem:**
You send a message to `@manik_assistant_bot` on Telegram. The bot displays "typing..." continuously and never sends a reply.

**Root Cause:**
OpenClaw records every message, prompt, and tool execution into a persistent session file. Over time, this history reaches **40,000 to 50,000+ tokens**. When a new message arrives, OpenClaw submits the entire monolithic history to the upstream LLM (Gemini 3.6 Flash / Groq). The LLM either times out, exceeds input token limits, or crashes silently in the streaming loop.

**Instant Fix:**
Run session compaction as the `clawbot` user:
```bash
# As root on VPS:
su - clawbot -c "openclaw sessions compact"
systemctl --user -M clawbot@ restart openclaw-gateway.service
```
This summarizes earlier turns and reduces context payload by 95%+, restoring immediate sub-second replies.

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
