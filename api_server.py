import json
import os
from pathlib import Path

from dotenv import load_dotenv, set_key
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

load_dotenv('.env', override=True)

app = Flask(__name__)
CORS(app)

# Removed duplicate cancel_analysis route

@app.route('/api/settings', methods=['GET', 'POST'])
def manage_settings():
    env_path = '.env'
    if request.method == 'GET':
        # Return masked keys
        keys = {
            'google': os.environ.get('GOOGLE_API_KEY', ''),
            'anthropic': os.environ.get('ANTHROPIC_API_KEY', ''),
            'groq': os.environ.get('GROQ_API_KEY', ''),
            'openai': os.environ.get('OPENAI_API_KEY', '')
        }
        # Mask keys for security
        for k, v in keys.items():
            if v and len(v) > 8:
                keys[k] = v[:4] + '...' + v[-4:]
        return jsonify({"status": "success", "keys": keys})

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

            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        results_dir = Path(DEFAULT_CONFIG.get("results_dir", "reports"))
        reports = []
        if results_dir.exists():
            for filepath in results_dir.rglob("*.md"):
                # Path format: reports / FOLDER_NAME / report.md (e.g. 1_analysts/market.md)
                # The topmost folder inside reports is the run folder
                rel_path = filepath.relative_to(results_dir)
                parts = rel_path.parts

                if len(parts) >= 2:
                    folder_name = parts[0]
                    # folder_name format: YYYYMMDD_HHMMSS_TICKER or YYYY-MM-DD_TICKER
                    if "_" in folder_name:
                        date_str, ticker_raw = folder_name.split("_", 1)
                    else:
                        date_str = folder_name
                        ticker_raw = folder_name

                    # Build nice display name based on subfolder structure
                    report_type = parts[-1].replace(".md", "")
                    if len(parts) > 2:
                        category = parts[-2].split("_", 1)[-1].title()
                        report_type = f"{category} - {report_type.title()}"
                    elif report_type == "complete_report":
                        report_type = "Complete Report"

                    name = f"{date_str} - {ticker_raw.upper()} ({report_type})"

                    reports.append({
                        "name": name,
                        "path": str(filepath),
                        "date": folder_name
                    })
        # Sort by date descending
        reports.sort(key=lambda x: x["date"], reverse=True)
        return jsonify({"status": "success", "reports": reports})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/history/view', methods=['POST'])
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
def clear_cache():
    global CANCEL_FLAG
    CANCEL_FLAG = True
    return jsonify({"status": "success", "message": "Backend reset signal sent"})

@app.route('/api/cancel', methods=['POST'])
def cancel_analysis():
    global CANCEL_FLAG
    CANCEL_FLAG = True
    return jsonify({"status": "cancelled"})

@app.route('/api/analyze', methods=['POST'])
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
            try:
                from pathlib import Path

                from tradingagents.reporting import write_report_tree

                # Format folder as date_ticker (since country is implied in ticker suffix or NSEI)
                folder_name = f"{trade_date}_{ticker.replace('^', '')}"
                results_dir = Path(DEFAULT_CONFIG.get("results_dir", "reports"))
                save_path = results_dir / folder_name
                write_report_tree(final_state, ticker, save_path)
            except Exception as e:
                print(f"Error saving report: {e}")

            if "risk_debate_state" in final_state and isinstance(final_state["risk_debate_state"], dict):
                summary_text = final_state["risk_debate_state"].get("judge_decision", summary_text)
            elif "trader_investment_plan" in final_state:
                summary_text = final_state["trader_investment_plan"]

            yield f"data: {json.dumps({'status': 'completed', 'summary': summary_text})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)
