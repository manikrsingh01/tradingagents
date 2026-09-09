import pexpect
import sys

print("Starting TradingAgents via pexpect...")
# Run tradingagents using the virtual environment
child = pexpect.spawn('./venv/bin/tradingagents', encoding='utf-8')
child.logfile_read = sys.stdout

# 1. Ticker
child.expect('Step 1: Ticker Symbol')
child.sendline('NVDA')

# 2. Date
child.expect('Step 2: Analysis Date')
child.sendline('')

# 3. Output Language
child.expect('Step 3: Output Language')
child.sendline('')

# 4. Analysts
child.expect('Step 4: Analysts Team')
# prompt_toolkit checkboxes. Space selects, Enter confirms.
# We want to select at least "Market Analyst", then hit enter.
# "Market Analyst" is the first one. Let's just hit enter to select default (maybe it selects none? No, we should select one.)
child.sendline('\r')

try:
    child.expect(pexpect.EOF, timeout=1200) # Wait up to 20 mins for the report
except pexpect.TIMEOUT:
    print("\nTimeout waiting for analysis to finish!")
