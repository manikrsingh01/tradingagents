import json
import os
import time
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import wraps
from pathlib import Path

import markdown
from dotenv import load_dotenv, set_key
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from markdown_pdf import MarkdownPdf, Section

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.reporting import write_report_tree

load_dotenv('.env', override=True)

app = Flask(__name__)
CORS(app)

CANCEL_FLAG = False

PROVIDER_MODEL_MAP = {
    "omniai": {
        "provider": "openai_compatible",
        "quick": "omniai",
        "deep": "omniai",
        "backend_url": "http://127.0.0.1:20128/v1"
    },
    "deepseek": {
        "provider": "deepseek",
        "quick": "deepseek-chat",
        "deep": "deepseek-reasoner",
        "backend_url": "https://api.deepseek.com"
    },
    "openai": {
        "provider": "openai",
        "quick": "gpt-5.6-luna",
        "deep": "gpt-5.6",
        "backend_url": "https://api.openai.com/v1"
    },
    "google": {
        "provider": "google",
        "quick": "gemini-3.5-flash",
        "deep": "gemini-3.5-flash",
        "backend_url": None
    },
    "anthropic": {
        "provider": "anthropic",
        "quick": "claude-sonnet-5",
        "deep": "claude-sonnet-5",
        "backend_url": "https://api.anthropic.com/"
    }
}



def send_email_report(ticker, date_str, summary_text, master_report_markdown=None):
    smtp_email = os.environ.get("SMTP_EMAIL")
    smtp_password = os.environ.get("SMTP_PASSWORD")

    if not smtp_email or not smtp_password:
        msg = f"Email credentials not found in environment (SMTP_EMAIL={'set' if smtp_email else 'missing'}, SMTP_PASSWORD={'set' if smtp_password else 'missing'}). Skipping email report."
        print(msg)
        return False, msg

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_email
        msg['To'] = 'hello@manikumarsingh.com'
        msg['Subject'] = f"Trading Agents Analysis: {ticker} ({date_str})"

        # Convert summary markdown to HTML for email body
        summary_html = markdown.markdown(summary_text) if summary_text else "<p>Analysis completed successfully.</p>"

        # Stylized HTML Email Body with Emerald theme
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d1117; color: #e6edf3; padding: 20px; }}
            .container {{ max-width: 650px; margin: 0 auto; background-color: #161b22; border-radius: 12px; border: 1px solid #30363d; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }}
            .header {{ background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%); padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }}
            .header p {{ margin: 6px 0 0 0; color: #d1fae5; font-size: 14px; }}
            .content {{ padding: 24px; color: #c9d1d9; line-height: 1.6; font-size: 14px; }}
            .summary-box {{ background-color: #0d1117; border-left: 4px solid #10b981; border-radius: 6px; padding: 16px 20px; margin: 16px 0; border: 1px solid #21262d; border-left-width: 4px; }}
            .summary-box h1, .summary-box h2, .summary-box h3 {{ color: #10b981; margin-top: 0; font-size: 16px; }}
            .summary-box p {{ margin-bottom: 8px; color: #e6edf3; }}
            .summary-box strong {{ color: #34d399; }}
            .attachment-pill {{ display: inline-flex; align-items: center; background-color: #064e3b; color: #a7f3d0; border: 1px solid #059669; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin: 16px 0; }}
            .footer {{ border-top: 1px solid #21262d; padding: 16px 24px; text-align: center; font-size: 12px; color: #8b949e; background-color: #0d1117; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Trading Agents Analysis Report</h1>
              <p>Asset: <strong>{ticker}</strong> | Date: <strong>{date_str}</strong></p>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>The autonomous Trading Agents evaluation for <strong>{ticker}</strong> has concluded. Here is the executive investment verdict:</p>

              <div class="summary-box">
                {summary_html}
              </div>

              <div class="attachment-pill">
                📎 Full Master Report Attached as PDF (Trading_Agents_Report_{ticker}_{date_str}.pdf)
              </div>

              <p>The attached PDF contains the comprehensive, multi-agent analysis including Fundamental Analysis, Market Sentiment, Technical Indicators, and Risk Management debate records.</p>
              <p>You can also review all past reports directly on your web dashboard in the <strong>History</strong> tab.</p>
            </div>

            <div class="footer">
              Sent automatically by your Trading Agents System • Confidential Research
            </div>
          </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(body_html, 'html'))

        # Convert Markdown to PDF (Full Master Report, fallback to summary_text)
        report_text_for_pdf = master_report_markdown if (master_report_markdown and len(master_report_markdown.strip()) > 0) else summary_text

        pdf = MarkdownPdf(toc_level=2)
        pdf.add_section(Section(report_text_for_pdf))

        pdf_path = f"Trading_Agents_Report_{ticker}_{date_str}.pdf"
        pdf.save(pdf_path)

        # Attach the PDF
        with open(pdf_path, "rb") as f:
            pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
            pdf_attachment.add_header('Content-Disposition', 'attachment', filename=pdf_path)
            msg.attach(pdf_attachment)

        # Clean up the temporary PDF file
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        server.quit()
        success_msg = f"Successfully sent email report with PDF attachment to hello@manikumarsingh.com for {ticker}"
        print(success_msg)
        return True, success_msg
    except Exception as e:
        err_msg = f"Failed to send email: {e}"
        print(err_msg)
        return False, err_msg


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow OPTIONS requests to pass through for CORS
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)

        app_password = os.environ.get('APP_PASSWORD')
        if not app_password:
            return f(*args, **kwargs) # Auth disabled if no password set

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401

        token = auth_header.split(' ')[1]
        if token != app_password:
            return jsonify({'error': 'Unauthorized'}), 401

        return f(*args, **kwargs)
    return decorated

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'tradingagents', 'timestamp': time.time()})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    password = data.get('password')
    app_password = os.environ.get('APP_PASSWORD')

    if not app_password or password == app_password:
        # For a single master password, returning success is sufficient.
        return jsonify({'status': 'success'})

    return jsonify({'error': 'Invalid password'}), 401

@app.route('/api/settings', methods=['GET', 'POST'])
@require_auth
def manage_settings():
    env_path = '.env'
    if request.method == 'GET':
        # Return masked keys
        keys = {
            'google': os.environ.get('GOOGLE_API_KEY', ''),
            'anthropic': os.environ.get('ANTHROPIC_API_KEY', ''),
            'groq': os.environ.get('GROQ_API_KEY', ''),
            'openai': os.environ.get('OPENAI_API_KEY', ''),
            'deepseek': os.environ.get('DEEPSEEK_API_KEY', '')
        }
        # Mask keys for security
        for k, v in keys.items():
            if v and len(v) > 8:
                keys[k] = v[:4] + '...' + v[-4:]

        active_model = os.environ.get('ACTIVE_MODEL', 'deepseek')
        return jsonify({"status": "success", "keys": keys, "active_model": active_model})

    elif request.method == 'POST':
        data = request.json
        try:
            if data.get('google') and '...' not in data['google']:
                set_key(env_path, 'GOOGLE_API_KEY', data['google'])
                os.environ['GOOGLE_API_KEY'] = data['google']
            if data.get('anthropic') and '...' not in data['anthropic']:
                set_key(env_path, 'ANTHROPIC_API_KEY', data['anthropic'])
                os.environ['ANTHROPIC_API_KEY'] = data['anthropic']
            if data.get('groq') and '...' not in data['groq']:
                set_key(env_path, 'GROQ_API_KEY', data['groq'])
                os.environ['GROQ_API_KEY'] = data['groq']
            if data.get('openai') and '...' not in data['openai']:
                set_key(env_path, 'OPENAI_API_KEY', data['openai'])
                os.environ['OPENAI_API_KEY'] = data['openai']
            if data.get('deepseek') and '...' not in data['deepseek']:
                set_key(env_path, 'DEEPSEEK_API_KEY', data['deepseek'])
                os.environ['DEEPSEEK_API_KEY'] = data['deepseek']

            if data.get('active_model'):
                chosen_model = data['active_model'].strip("'\"").lower()
                set_key(env_path, 'ACTIVE_MODEL', chosen_model)
                os.environ['ACTIVE_MODEL'] = chosen_model
                if chosen_model in PROVIDER_MODEL_MAP:
                    mapping = PROVIDER_MODEL_MAP[chosen_model]
                    set_key(env_path, 'TRADINGAGENTS_LLM_PROVIDER', mapping['provider'])
                    os.environ['TRADINGAGENTS_LLM_PROVIDER'] = mapping['provider']
                    if mapping.get('backend_url'):
                        set_key(env_path, 'TRADINGAGENTS_LLM_BACKEND_URL', mapping['backend_url'])
                        os.environ['TRADINGAGENTS_LLM_BACKEND_URL'] = mapping['backend_url']
                    set_key(env_path, 'TRADINGAGENTS_QUICK_THINK_LLM', mapping['quick'])
                    set_key(env_path, 'TRADINGAGENTS_DEEP_THINK_LLM', mapping['deep'])
                    os.environ['TRADINGAGENTS_QUICK_THINK_LLM'] = mapping['quick']
                    os.environ['TRADINGAGENTS_DEEP_THINK_LLM'] = mapping['deep']


            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
@require_auth
def get_history():
    try:
        results_dir = Path(DEFAULT_CONFIG.get("results_dir", "reports"))
        reports = []
        if results_dir.exists():
            for filepath in results_dir.rglob("*.md"):
                # Path format: reports / FOLDER_NAME / report.md (e.g. 1_analysts/market.md)
                # The topmost folder inside reports is the run folder
                # Only include the master report
                if filepath.name != "complete_report.md":
                    continue

                rel_path = filepath.relative_to(results_dir)
                parts = rel_path.parts

                if len(parts) >= 2:
                    folder_name = parts[0]
                    # folder_name format: YYYY-MM-DD_TICKER
                    if "_" in folder_name:
                        date_str, ticker_raw = folder_name.split("_", 1)
                    else:
                        date_str = folder_name
                        ticker_raw = folder_name

                    # User requested clean Master Report name
                    name = f"{date_str} - {ticker_raw.upper()} (Master Report)"

                    reports.append({
                        "name": name,
                        "path": str(filepath),
                        "date": folder_name
                    })
        # Sort by date descending (latest to oldest)
        reports.sort(key=lambda x: x["date"], reverse=True)
        return jsonify({"status": "success", "reports": reports})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/view', methods=['POST'])
@require_auth
def view_history():
    try:
        path = request.json.get('path')
        if not path or not os.path.exists(path):
            return jsonify({"error": "File not found"}), 404
        with open(path, encoding='utf-8') as f:
            content = f.read()
        return jsonify({"status": "success", "content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clear_cache', methods=['POST'])
@require_auth
def clear_cache():
    global CANCEL_FLAG
    CANCEL_FLAG = True
    return jsonify({"status": "success", "message": "Backend reset signal sent"})

@app.route('/api/cancel', methods=['POST'])
@require_auth
def cancel_analysis():
    global CANCEL_FLAG
    CANCEL_FLAG = True
    return jsonify({"status": "cancelled"})

@app.route('/api/analyze', methods=['POST'])
@require_auth
def analyze():
    global CANCEL_FLAG
    CANCEL_FLAG = False

    data = request.json
    ticker = data.get('ticker')
    trade_date = data.get('trade_date')
    research_depth = data.get('research_depth', 'shallow')
    selected_analysts = data.get('selected_analysts', ['market', 'fundamentals', 'news', 'social'])

    if not ticker or not trade_date:
        return jsonify({"error": "ticker and trade_date are required"}), 400

    def generate():
        global CANCEL_FLAG
        try:
            yield f"data: {json.dumps({'status': 'connecting', 'message': 'Initializing trading agents...'})}\n\n"

            asset_type_val = data.get('asset_type')
            if not asset_type_val:
                asset_type_val = "index" if ticker.startswith("^") else "stock"

            current_analysts = selected_analysts.copy()
            if asset_type_val in ['index', 'etf', 'crypto'] and 'fundamentals' in current_analysts:
                current_analysts.remove('fundamentals')

            custom_config = DEFAULT_CONFIG.copy()
            active_model = os.environ.get('ACTIVE_MODEL', 'omniai').strip("'\"").lower()

            if active_model in PROVIDER_MODEL_MAP:
                mapping = PROVIDER_MODEL_MAP[active_model]
                custom_config['llm_provider'] = mapping['provider']
                os.environ['TRADINGAGENTS_LLM_PROVIDER'] = mapping['provider']
                custom_config['quick_think_llm'] = mapping['quick']
                custom_config['deep_think_llm'] = mapping['deep']
                if mapping.get('backend_url'):
                    custom_config['backend_url'] = mapping['backend_url']
            else:
                custom_config['llm_provider'] = active_model
                os.environ['TRADINGAGENTS_LLM_PROVIDER'] = active_model

            if research_depth == 'medium':
                custom_config['max_debate_rounds'] = 3
                custom_config['max_risk_discuss_rounds'] = 3
            elif research_depth == 'deep':
                custom_config['max_debate_rounds'] = 5
                custom_config['max_risk_discuss_rounds'] = 5
            else:
                custom_config['max_debate_rounds'] = 1
                custom_config['max_risk_discuss_rounds'] = 1

            graph = TradingAgentsGraph(current_analysts, config=custom_config)

            asset_type = asset_type_val
            past_context = graph.memory_log.get_past_context(ticker, as_of=graph._memory_as_of(trade_date))
            instrument_context = graph.resolve_instrument_context(ticker, asset_type)

            init_agent_state = graph.propagator.create_initial_state(
                ticker,
                trade_date,
                asset_type=asset_type,
                past_context=past_context,
                instrument_context=instrument_context,
            )
            args = graph.propagator.get_graph_args()
            args["stream_mode"] = "updates"

            yield f"data: {json.dumps({'status': 'started', 'ticker': ticker, 'date': trade_date})}\n\n"

            final_state = init_agent_state.copy()

            for chunk in graph.graph.stream(init_agent_state, **args):
                if CANCEL_FLAG:
                    yield f"data: {json.dumps({'error': 'Analysis cancelled by user.'})}\n\n"
                    return

                for node_name, state_update in chunk.items():
                    if isinstance(state_update, dict):
                        # Update the final state incrementally
                        final_state.update(state_update)

                        if 'messages' in state_update:
                            for msg in state_update['messages']:
                                if hasattr(msg, 'content') and msg.content:
                                    if 'Rate limited' in str(msg.content):
                                        yield f"data: {json.dumps({'status': 'rate_limited', 'node': node_name})}\n\n"
                                    # Yield text content for terminal UI
                                    yield f"data: {json.dumps({'status': 'log', 'node': node_name, 'message': str(msg.content)})}\n\n"

                                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                                    for tc in msg.tool_calls:
                                        tool_name = tc.get('name') if isinstance(tc, dict) else getattr(tc, 'name', 'tool')
                                        yield f"data: {json.dumps({'status': 'log', 'node': node_name, 'message': f'Running tool: {tool_name}'})}\n\n"

                    yield f"data: {json.dumps({'status': 'node_finished', 'node': node_name})}\n\n"


            # Extract final summary at the end using accumulated state
            summary_text = "The TradingAgents framework successfully evaluated the asset. The full detailed report is saved locally."

            # Save the final report to disk
            master_report_content = ""
            try:
                # Format folder as date_ticker (since country is implied in ticker suffix or NSEI)
                folder_name = f"{trade_date}_{ticker.replace('^', '')}"
                results_dir = Path(DEFAULT_CONFIG.get("results_dir", "reports"))
                save_path = results_dir / folder_name
                report_file = write_report_tree(final_state, ticker, save_path)
                if report_file and Path(report_file).exists():
                    master_report_content = Path(report_file).read_text(encoding="utf-8")
            except Exception as e:
                print(f"Error saving report: {e}")

            if "risk_debate_state" in final_state and isinstance(final_state["risk_debate_state"], dict):
                summary_text = final_state["risk_debate_state"].get("judge_decision", summary_text)
            if "trader_investment_plan" in final_state:
                summary_text = final_state["trader_investment_plan"]

            # Deliver email report with full PDF attachment
            yield f"data: {json.dumps({'status': 'log', 'node': 'Email Dispatcher', 'message': 'Generating PDF and sending email to hello@manikumarsingh.com...'})}\n\n"
            try:
                ok, email_msg = send_email_report(ticker, trade_date, summary_text, master_report_content)
                if ok:
                    yield f"data: {json.dumps({'status': 'log', 'node': 'Email Dispatcher', 'message': 'Email report delivered successfully!'})}\n\n"
                else:
                    yield f"data: {json.dumps({'status': 'log', 'node': 'Email Dispatcher', 'message': f'Email skipped or failed: {email_msg}'})}\n\n"
            except Exception as email_err:
                yield f"data: {json.dumps({'status': 'log', 'node': 'Email Dispatcher', 'message': f'Email error: {email_err}'})}\n\n"

            yield f"data: {json.dumps({'status': 'completed', 'summary': summary_text})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
