#!/usr/bin/env bash
# ============================================================================
# run-qa.sh — Run blockchain QA checks on this project
#
# Usage:
#   ./scripts/run-qa.sh              # run all checks
#   ./scripts/run-qa.sh slither      # run one check
#   ./scripts/run-qa.sh coverage gas # run specific checks
#
# Available checks:
#   slither   — Static analysis
#   coverage  — Forge test coverage report
#   gas       — Gas snapshot (create or compare)
#   mutation  — Mutation testing with Gambit + forge test
#   halmos    — Formal verification / symbolic testing
#   all       — Run all of the above
#
# Output:
#   Results are saved to .local/qa-results/
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/.local/qa-results"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_ok()      { echo -e "${GREEN}[PASS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()     { echo -e "${RED}[FAIL]${NC} $1"; }
log_section() { echo -e "\n${CYAN}════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}════════════════════════════════════════${NC}\n"; }

mkdir -p "$RESULTS_DIR"

# ---------------------------------------------------------------------------
# Slither — Static Analysis
# ---------------------------------------------------------------------------
run_slither() {
  log_section "Static Analysis (Slither)"

  if ! command -v slither &>/dev/null; then
    log_err "slither not installed — run: ./scripts/setup-qa-tools.sh slither"
    return 1
  fi

  local outfile="$RESULTS_DIR/slither-${TIMESTAMP}.json"
  local txtfile="$RESULTS_DIR/slither-${TIMESTAMP}.txt"

  echo "Running slither on $CONTRACTS_DIR/src/ ..."

  # Run with JSON output for machine parsing + text for human reading
  (cd "$PROJECT_ROOT" && slither "$CONTRACTS_DIR/src/" \
    --solc-remaps "forge-std/=contracts/lib/forge-std/src/ @openzeppelin/=contracts/lib/openzeppelin-contracts/" \
    --json "$outfile" \
    2>&1) | tee "$txtfile" || true

  if [ -f "$outfile" ]; then
    local high=$(python3 -c "import json; d=json.load(open('$outfile')); print(len([r for r in d.get('results',{}).get('detectors',[]) if r['impact']=='High']))" 2>/dev/null || echo "?")
    local medium=$(python3 -c "import json; d=json.load(open('$outfile')); print(len([r for r in d.get('results',{}).get('detectors',[]) if r['impact']=='Medium']))" 2>/dev/null || echo "?")
    local low=$(python3 -c "import json; d=json.load(open('$outfile')); print(len([r for r in d.get('results',{}).get('detectors',[]) if r['impact']=='Low']))" 2>/dev/null || echo "?")
    echo ""
    echo "Findings: High=$high  Medium=$medium  Low=$low"
    echo "Full report: $outfile"
  fi

  log_ok "Slither complete — results in $RESULTS_DIR/"
}

# ---------------------------------------------------------------------------
# Coverage — Forge Coverage
# ---------------------------------------------------------------------------
run_coverage() {
  log_section "Test Coverage (forge coverage)"

  local outfile="$RESULTS_DIR/coverage-${TIMESTAMP}.txt"
  local lcov_file="$RESULTS_DIR/lcov-${TIMESTAMP}.info"

  echo "Running forge coverage ..."

  (cd "$PROJECT_ROOT" && forge coverage 2>&1) | tee "$outfile"

  # Also generate lcov for CI integration
  echo ""
  echo "Generating lcov report ..."
  (cd "$PROJECT_ROOT" && forge coverage --report lcov --report-file "$lcov_file" 2>/dev/null) || true

  if [ -f "$lcov_file" ]; then
    echo "LCOV report: $lcov_file"
  fi

  log_ok "Coverage complete — results in $outfile"
}

# ---------------------------------------------------------------------------
# Gas — Snapshot
# ---------------------------------------------------------------------------
run_gas() {
  log_section "Gas Snapshot"

  local snapshot_file="$PROJECT_ROOT/.gas-snapshot"
  local outfile="$RESULTS_DIR/gas-${TIMESTAMP}.txt"

  if [ -f "$snapshot_file" ]; then
    echo "Existing snapshot found — comparing ..."
    (cd "$PROJECT_ROOT" && forge snapshot --diff 2>&1) | tee "$outfile"
    log_ok "Gas diff complete"
  else
    echo "No existing snapshot — creating baseline ..."
    (cd "$PROJECT_ROOT" && forge snapshot 2>&1) | tee "$outfile"
    log_ok "Gas baseline created at $snapshot_file"
  fi

  echo "Results: $outfile"
}

# ---------------------------------------------------------------------------
# Mutation Testing — Gambit + forge test
# ---------------------------------------------------------------------------
run_mutation() {
  log_section "Mutation Testing (Gambit)"

  if ! command -v gambit &>/dev/null; then
    log_err "gambit not installed — run: ./scripts/setup-qa-tools.sh gambit"
    return 1
  fi

  local outdir="$RESULTS_DIR/gambit-${TIMESTAMP}"
  local report="$RESULTS_DIR/mutation-${TIMESTAMP}.txt"
  mkdir -p "$outdir"

  echo "Generating mutants for Token.sol ..."
  (cd "$PROJECT_ROOT" && gambit mutate \
    --filename "$CONTRACTS_DIR/src/Token.sol" \
    --outdir "$outdir" \
    --solc-remaps "forge-std/=contracts/lib/forge-std/src/ @openzeppelin/=contracts/lib/openzeppelin-contracts/" \
    2>&1) | tee "$report"

  local total_mutants=$(find "$outdir" -name "*.sol" 2>/dev/null | wc -l | tr -d ' ')
  echo ""
  echo "Generated $total_mutants mutants"

  if [ "$total_mutants" -eq 0 ]; then
    log_warn "No mutants generated"
    return
  fi

  # Test each mutant
  local killed=0
  local survived=0
  local errors=0

  echo "Testing mutants against test suite ..."
  echo ""

  for mutant in "$outdir"/*.sol; do
    local name=$(basename "$mutant")
    # Backup original
    cp "$CONTRACTS_DIR/src/Token.sol" "$CONTRACTS_DIR/src/Token.sol.bak"
    # Replace with mutant
    cp "$mutant" "$CONTRACTS_DIR/src/Token.sol"

    if (cd "$PROJECT_ROOT" && forge test --no-match-contract Invariant 2>&1) | grep -q "FAIL\|Error\|error"; then
      killed=$((killed + 1))
      echo "  KILLED  $name"
    else
      survived=$((survived + 1))
      echo "  SURVIVED $name  ← test gap!"
    fi

    # Restore original
    mv "$CONTRACTS_DIR/src/Token.sol.bak" "$CONTRACTS_DIR/src/Token.sol"
  done

  local score=0
  if [ $((killed + survived)) -gt 0 ]; then
    score=$(python3 -c "print(round($killed / ($killed + $survived) * 100, 1))")
  fi

  echo "" | tee -a "$report"
  echo "════════════════════════════════" | tee -a "$report"
  echo "  Mutation Score: ${score}%" | tee -a "$report"
  echo "  Killed:    $killed" | tee -a "$report"
  echo "  Survived:  $survived" | tee -a "$report"
  echo "  Total:     $total_mutants" | tee -a "$report"
  echo "════════════════════════════════" | tee -a "$report"

  if [ "$survived" -gt 0 ]; then
    log_warn "Mutation score: ${score}% — $survived mutants survived"
  else
    log_ok "Mutation score: 100% — all mutants killed"
  fi
}

# ---------------------------------------------------------------------------
# Halmos — Formal Verification
# ---------------------------------------------------------------------------
run_halmos() {
  log_section "Formal Verification (Halmos)"

  if ! command -v halmos &>/dev/null; then
    log_err "halmos not installed — run: ./scripts/setup-qa-tools.sh halmos"
    return 1
  fi

  local outfile="$RESULTS_DIR/halmos-${TIMESTAMP}.txt"

  echo "Running halmos symbolic tests ..."

  # Halmos looks for test functions prefixed with `check_` in test contracts
  (cd "$PROJECT_ROOT" && halmos \
    --root "$PROJECT_ROOT" \
    --contract TokenHalmosTest \
    2>&1) | tee "$outfile"

  log_ok "Halmos complete — results in $outfile"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print_summary() {
  log_section "QA Run Summary"
  echo "Timestamp: $TIMESTAMP"
  echo "Results:   $RESULTS_DIR/"
  echo ""
  ls -la "$RESULTS_DIR/"*"${TIMESTAMP}"* 2>/dev/null || echo "(no results files)"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local targets=("$@")

  if [ ${#targets[@]} -eq 0 ] || [ "${targets[0]}" = "all" ]; then
    targets=(slither coverage gas mutation halmos)
  fi

  echo "═══════════════════════════════════════════"
  echo "  Blockchain QA Pipeline"
  echo "  Project: ethereum-account-state"
  echo "  Time:    $TIMESTAMP"
  echo "═══════════════════════════════════════════"

  for target in "${targets[@]}"; do
    case "$target" in
      slither)  run_slither ;;
      coverage) run_coverage ;;
      gas)      run_gas ;;
      mutation) run_mutation ;;
      halmos)   run_halmos ;;
      *)        log_err "Unknown check: $target (available: slither, coverage, gas, mutation, halmos)" ;;
    esac
  done

  print_summary
}

main "$@"
