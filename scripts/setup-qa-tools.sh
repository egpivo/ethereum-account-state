#!/bin/env bash
# ============================================================================
# setup-qa-tools.sh — Install blockchain QA tools for this project
#
# Tools installed:
#   - slither-analyzer : Solidity static analysis (Trail of Bits)
#   - halmos           : Symbolic testing / formal verification (a]6)
#   - gambit           : Solidity mutation testing (Certora)
#
# Prerequisites:
#   - Python 3.8+
#   - Rust toolchain (cargo) — for Gambit
#   - Foundry (forge) — already installed
#
# Usage:
#   ./scripts/setup-qa-tools.sh          # install all
#   ./scripts/setup-qa-tools.sh slither  # install one tool
#   ./scripts/setup-qa-tools.sh check    # check what's installed
# ============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()  { echo -e "${RED}[ERR]${NC} $1"; }
log_info() { echo -e "     $1"; }

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
check_prereqs() {
  local missing=0

  if ! command -v python3 &>/dev/null; then
    log_err "python3 not found — required for slither and halmos"
    missing=1
  fi

  if ! command -v pip3 &>/dev/null; then
    log_err "pip3 not found — required for slither and halmos"
    missing=1
  fi

  if ! command -v cargo &>/dev/null; then
    log_warn "cargo not found — required for gambit (skip with: $0 slither halmos)"
  fi

  if ! command -v forge &>/dev/null; then
    log_err "forge not found — install Foundry first: https://getfoundry.sh"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Install functions
# ---------------------------------------------------------------------------
install_slither() {
  echo ""
  echo "── Installing slither-analyzer ──"
  if command -v slither &>/dev/null; then
    log_ok "slither already installed: $(slither --version 2>&1)"
    return
  fi
  pip3 install slither-analyzer
  if command -v slither &>/dev/null; then
    log_ok "slither installed: $(slither --version 2>&1)"
  else
    log_err "slither installation failed"
    return 1
  fi
}

install_halmos() {
  echo ""
  echo "── Installing halmos ──"
  if command -v halmos &>/dev/null; then
    log_ok "halmos already installed: $(halmos --version 2>&1)"
    return
  fi
  pip3 install halmos
  if command -v halmos &>/dev/null; then
    log_ok "halmos installed: $(halmos --version 2>&1)"
  else
    log_err "halmos installation failed"
    return 1
  fi
}

install_gambit() {
  echo ""
  echo "── Installing gambit ──"
  if command -v gambit &>/dev/null; then
    log_ok "gambit already installed: $(gambit --version 2>&1)"
    return
  fi

  if ! command -v cargo &>/dev/null; then
    log_err "cargo not found — cannot install gambit"
    log_info "Install Rust: https://rustup.rs"
    return 1
  fi

  # Gambit is published as a crate by Certora
  cargo install --git https://github.com/Certora/gambit --tag v1.0.0
  if command -v gambit &>/dev/null; then
    log_ok "gambit installed: $(gambit --version 2>&1)"
  else
    log_err "gambit installation failed"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Check status
# ---------------------------------------------------------------------------
check_status() {
  echo ""
  echo "── QA Tool Status ──"
  echo ""

  for tool in forge slither halmos gambit; do
    if command -v "$tool" &>/dev/null; then
      version=$("$tool" --version 2>&1 | head -1)
      log_ok "$tool — $version"
    else
      log_warn "$tool — not installed"
    fi
  done

  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local targets=("$@")

  # Default: install all
  if [ ${#targets[@]} -eq 0 ]; then
    targets=(slither halmos gambit)
  fi

  # Handle "check" command
  if [ "${targets[0]}" = "check" ]; then
    check_status
    exit 0
  fi

  check_prereqs

  for target in "${targets[@]}"; do
    case "$target" in
      slither) install_slither ;;
      halmos)  install_halmos ;;
      gambit)  install_gambit ;;
      *)       log_err "Unknown tool: $target (available: slither, halmos, gambit)" ;;
    esac
  done

  echo ""
  echo "── Done ──"
  check_status
}

main "$@"
