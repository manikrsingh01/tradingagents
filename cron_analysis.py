"""Automated Morning Analysis Runner.

Designed for scheduled runs (e.g. GitHub Actions / cron jobs) at 9:10 AM IST.
Runs the Trading Agents multi-agent evaluation on the target asset (default: Nifty 50 ^NSEI),
saves the complete master report, and automatically delivers an email report
with an executive verdict in the body and the full Master Report PDF attached.
"""

import os
import sys
from datetime import datetime

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # type: ignore

from dotenv import load_dotenv

load_dotenv(".env", override=True)

from api_server import PROVIDER_MODEL_MAP, send_email_report
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.reporting import write_report_tree
from pathlib import Path


def run_morning_analysis(ticker: str = "^NSEI"):
    # Determine current trade date in IST (Indian Standard Time)
    try:
        ist = ZoneInfo("Asia/Kolkata")
        trade_date = datetime.now(ist).strftime("%Y-%m-%d")
    except Exception:
        trade_date = datetime.now().strftime("%Y-%m-%d")

    print("==================================================")
    print(f"🚀 Starting Automated Analysis for: {ticker}")
    print(f"📅 Trade Date (IST): {trade_date}")
    print("==================================================")


    # Configure asset type and analysts
    is_index = ticker.startswith("^")
    asset_type = "index" if is_index else "stock"
    selected_analysts = ["market", "news", "social"]
    if not is_index:
        selected_analysts.append("fundamentals")

    # Set up model configuration
    custom_config = DEFAULT_CONFIG.copy()
    active_model = os.environ.get("ACTIVE_MODEL", "deepseek").strip("'\"").lower()
    custom_config["llm_provider"] = active_model
    os.environ["TRADINGAGENTS_LLM_PROVIDER"] = active_model

    if active_model in PROVIDER_MODEL_MAP:
        mapping = PROVIDER_MODEL_MAP[active_model]
        custom_config["quick_think_llm"] = mapping["quick"]
        custom_config["deep_think_llm"] = mapping["deep"]
        if mapping.get("backend_url"):
            custom_config["backend_url"] = mapping["backend_url"]

    custom_config["max_debate_rounds"] = 1
    custom_config["max_risk_discuss_rounds"] = 1

    print(f"🤖 Active Model Provider: {active_model}")
    print(f"🧠 Quick Thinker: {custom_config.get('quick_think_llm')}")
    print(f"🧠 Deep Thinker: {custom_config.get('deep_think_llm')}")

    # Initialize graph
    graph = TradingAgentsGraph(selected_analysts, config=custom_config)

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

    final_state = init_agent_state.copy()

    print("\n⏳ Executing multi-agent debate and research graph...")
    for chunk in graph.graph.stream(init_agent_state, **args):
        for node_name, state_update in chunk.items():
            if isinstance(state_update, dict):
                final_state.update(state_update)
                if "messages" in state_update:
                    for msg in state_update["messages"]:
                        content = getattr(msg, "content", "")
                        if content:
                            # Print a short log snippet
                            first_line = str(content).strip().split("\n")[0][:100]
                            print(f"  [{node_name}] {first_line}...")
            print(f"  ✓ Node finished: {node_name}")

    # Extract summary verdict
    summary_text = "The TradingAgents framework successfully evaluated the asset."
    if "risk_debate_state" in final_state and isinstance(final_state["risk_debate_state"], dict):
        summary_text = final_state["risk_debate_state"].get("judge_decision", summary_text)
    if "trader_investment_plan" in final_state:
        summary_text = final_state["trader_investment_plan"]

    # Save complete report to disk
    master_report_content = ""
    try:
        folder_name = f"{trade_date}_{ticker.replace('^', '')}"
        results_dir = Path(DEFAULT_CONFIG.get("results_dir", "reports"))
        save_path = results_dir / folder_name
        report_file = write_report_tree(final_state, ticker, save_path)
        if report_file and Path(report_file).exists():
            master_report_content = Path(report_file).read_text(encoding="utf-8")
            print(f"\n📁 Complete report written to: {report_file}")
    except Exception as e:
        print(f"⚠️ Error saving report to disk: {e}")

    # Send email notification with summary in body and attached PDF
    print("\n📧 Generating PDF and dispatching email report...")
    send_email_report(ticker, trade_date, summary_text, master_report_content)
    print("\n✅ Automated Morning Analysis Complete!")


if __name__ == "__main__":
    target_ticker = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TARGET_TICKER", "^NSEI")
    run_morning_analysis(target_ticker)
