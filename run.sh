#!/usr/bin/env bash
# ─── Agent Hub Platform — Quick Start Script ─────────────────────────────────
# Usage:
#   chmod +x run.sh
#   ./run.sh              # Interactive menu (start / restart / stop)
#   ./run.sh --dev        # Install deps + start dev server (local Node.js)
#   ./run.sh --build      # Production build + start (local Node.js)
#   ./run.sh --docker     # Docker compose up (builds + starts)
#   ./run.sh --docker-down  # Stop containers
#   ./run.sh --docker-reset # Stop + remove volumes (re-seeds config)
#   ./run.sh --docker-logs  # Tail container logs
#   ./run.sh --clean      # Remove node_modules, .next, reinstall

set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[→]${NC} $1"; }

# ─── Banner ───────────────────────────────────────────────────────────────────
banner() {
  echo ""
  echo -e "${CYAN}  🤖  Agent Hub Platform${NC}"
  echo -e "  ────────────────────────"
  echo ""
}

# ─── Pre-flight checks ───────────────────────────────────────────────────────
check_docker() {
  if ! command -v docker &>/dev/null; then
    err "Docker is not installed. Please install Docker Desktop."
    err "  → https://docs.docker.com/get-docker/"
    exit 1
  fi
}

check_node() {
  if ! command -v node &>/dev/null; then
    err "Node.js is not installed. Please install Node.js >= 22"
    err "  → https://nodejs.org/"
    exit 1
  fi
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    warn "Node.js $NODE_VER detected. Recommended: >= 22"
  else
    log "Node.js $(node -v) detected"
  fi
}

check_npm() {
  if ! command -v npm &>/dev/null; then
    err "npm is not installed."
    exit 1
  fi
  log "npm $(npm -v) detected"
}

setup_env() {
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      cp .env.example .env
      warn ".env created from .env.example — edit it to add your API keys"
    else
      warn "No .env file found. Create one with your API keys."
    fi
  fi
}

install_deps() {
  if [ ! -d node_modules ]; then
    info "Installing dependencies..."
    npm install
    log "Dependencies installed"
  else
    log "Dependencies already installed"
  fi
}

show_status() {
  echo ""
  docker compose ps
  echo ""
  info "Dashboard:    ${GREEN}http://localhost:3000${NC}"
  info "Gateway:      ${GREEN}ws://localhost:18789${NC}"
  info "Worker Pool:  ${GREEN}http://localhost:18790${NC}"
  echo ""
}

# ─── Commands ─────────────────────────────────────────────────────────────────
cmd_start() {
  check_docker
  setup_env

  echo ""
  info "Building and starting containers..."
  docker compose up -d --build
  log "Platform started"
  show_status
}

cmd_restart() {
  check_docker
  setup_env

  echo ""
  info "Stopping containers..."
  docker compose down
  echo ""
  info "Rebuilding and starting containers..."
  docker compose up -d --build
  log "Platform restarted"
  show_status
}

cmd_stop() {
  check_docker

  echo ""
  info "Stopping containers..."
  docker compose down
  log "Platform stopped"
  echo ""
}

cmd_logs() {
  check_docker
  docker compose logs -f "${2:-}"
}

cmd_reset() {
  check_docker

  echo ""
  warn "This will stop all containers and ${RED}delete all volumes${NC} (config, data, workspace)."
  echo -ne "  ${YELLOW}Are you sure? [y/N]:${NC} "
  read -r confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    docker compose down -v
    log "Containers stopped and volumes removed."
    info "Run ${CYAN}./run.sh${NC} and select Start to rebuild from scratch."
  else
    info "Cancelled."
  fi
  echo ""
}

cmd_dev() {
  check_node
  check_npm
  setup_env
  install_deps

  echo ""
  log "Starting development server..."
  info "Dashboard: ${GREEN}http://localhost:3000${NC}"
  info "API:       ${GREEN}http://localhost:3000/api/agents${NC}"
  echo ""

  npx next dev --port 3000
}

cmd_build() {
  check_node
  check_npm
  setup_env
  install_deps

  info "Building for production..."
  npx next build
  log "Build complete"

  echo ""
  log "Starting production server..."
  info "Dashboard: ${GREEN}http://localhost:3000${NC}"
  echo ""

  npx next start --port 3000
}

cmd_clean() {
  info "Cleaning project..."
  rm -rf node_modules .next
  log "Cleaned node_modules and .next"
  install_deps
  log "Fresh install complete"
}

# ─── Interactive Menu ─────────────────────────────────────────────────────────
cmd_interactive() {
  check_docker

  # Show current container status
  PLATFORM_STATUS=$(docker compose ps --format '{{.State}}' platform 2>/dev/null || echo "not running")
  GATEWAY_STATUS=$(docker compose ps --format '{{.State}}' gateway 2>/dev/null || echo "not running")
  WORKER_STATUS=$(docker compose ps --format '{{.State}}' worker-pool 2>/dev/null || echo "not running")

  if [[ "$PLATFORM_STATUS" == "running" && "$GATEWAY_STATUS" == "running" && "$WORKER_STATUS" == "running" ]]; then
    echo -e "  Status: ${GREEN}● Running${NC}  ${DIM}(platform: ${PLATFORM_STATUS}, gateway: ${GATEWAY_STATUS}, workers: ${WORKER_STATUS})${NC}"
  elif [[ "$PLATFORM_STATUS" == "running" || "$GATEWAY_STATUS" == "running" || "$WORKER_STATUS" == "running" ]]; then
    echo -e "  Status: ${YELLOW}◐ Partial${NC}  ${DIM}(platform: ${PLATFORM_STATUS}, gateway: ${GATEWAY_STATUS}, workers: ${WORKER_STATUS})${NC}"
  else
    echo -e "  Status: ${DIM}○ Stopped${NC}"
  fi

  echo ""
  echo -e "  ${BOLD}What would you like to do?${NC}"
  echo ""
  echo -e "    ${GREEN}1)${NC} Start       — Build & start all containers"
  echo -e "    ${CYAN}2)${NC} Restart     — Rebuild & restart all containers"
  echo -e "    ${RED}3)${NC} Stop        — Stop all containers"
  echo -e "    ${YELLOW}4)${NC} Logs        — Tail container logs"
  echo -e "    ${DIM}5)${NC} Reset       — Stop + remove volumes (fresh start)"
  echo ""

  while true; do
    echo -ne "  Enter choice [1-5]: "
    read -r choice
    case "$choice" in
      1) cmd_start;   break ;;
      2) cmd_restart; break ;;
      3) cmd_stop;    break ;;
      4) cmd_logs;    break ;;
      5) cmd_reset;   break ;;
      *)
        err "Invalid choice. Please enter 1-5."
        ;;
    esac
  done
}

# ─── Entry point ──────────────────────────────────────────────────────────────
banner

case "${1:-}" in
  --dev)           cmd_dev ;;
  --build)         cmd_build ;;
  --docker)        cmd_start ;;
  --docker-down)   cmd_stop ;;
  --docker-reset)  cmd_reset ;;
  --docker-logs)   cmd_logs "$@" ;;
  --clean)         cmd_clean ;;
  --help|-h)
    echo "Usage: ./run.sh [option]"
    echo ""
    echo "Options:"
    echo "  (none)          Interactive menu — start / restart / stop"
    echo "  --dev           Install deps + start local dev server"
    echo "  --build         Production build + start (local Node.js)"
    echo "  --docker        Build + start Docker containers"
    echo "  --docker-down   Stop Docker containers"
    echo "  --docker-reset  Stop + remove volumes (re-seeds config)"
    echo "  --docker-logs   Tail container logs"
    echo "  --clean         Remove node_modules/.next, reinstall"
    echo "  --help          Show this help"
    echo ""
    ;;
  *)               cmd_interactive ;;
esac
