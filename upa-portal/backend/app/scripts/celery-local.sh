#!/usr/bin/env bash
#
# Manage Celery worker + beat for local development.
# Processes run detached via nohup — they survive terminal/session exits.
#
# Usage:
#   ./scripts/celery-local.sh start   — start worker + beat
#   ./scripts/celery-local.sh stop    — stop worker + beat
#   ./scripts/celery-local.sh restart — stop then start
#   ./scripts/celery-local.sh status  — show running processes
#   ./scripts/celery-local.sh logs    — tail the log files
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$APP_DIR/logs"
PIDFILE_WORKER="$LOG_DIR/celery-worker.pid"
PIDFILE_BEAT="$LOG_DIR/celery-beat.pid"

# Environment
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$HOME/Library/Python/3.9/bin:$PATH"
eval "$(pyenv init -)" 2>/dev/null || true
pyenv shell 3.11.14 2>/dev/null || true

export CELERY_BROKER_URL="amqp://guest@localhost:5672//"
export POSTGRES_SERVER="localhost"
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="80cd5b57ea252163c0366899b61295cb0642b8baa18ed0325f69e046d65cb90f"
export POSTGRES_DB="upa_portal"

mkdir -p "$LOG_DIR"

start() {
    # Check if already running
    if [ -f "$PIDFILE_WORKER" ] && kill -0 "$(cat "$PIDFILE_WORKER")" 2>/dev/null; then
        echo "Worker already running (PID $(cat "$PIDFILE_WORKER"))"
    else
        cd "$APP_DIR"
        nohup poetry run celery -A app.worker worker \
            -l INFO \
            -Q main-queue,schedule,pulsepoint-queue \
            -c 4 \
            >> "$LOG_DIR/celery-worker.log" 2>&1 &
        echo $! > "$PIDFILE_WORKER"
        echo "Worker started (PID $!)"
    fi

    if [ -f "$PIDFILE_BEAT" ] && kill -0 "$(cat "$PIDFILE_BEAT")" 2>/dev/null; then
        echo "Beat already running (PID $(cat "$PIDFILE_BEAT"))"
    else
        cd "$APP_DIR"
        nohup poetry run celery -A app.worker beat \
            -l INFO \
            >> "$LOG_DIR/celery-beat.log" 2>&1 &
        echo $! > "$PIDFILE_BEAT"
        echo "Beat started (PID $!)"
    fi
}

stop() {
    if [ -f "$PIDFILE_WORKER" ]; then
        PID=$(cat "$PIDFILE_WORKER")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null
            echo "Worker stopped (PID $PID)"
        else
            echo "Worker not running (stale PID $PID)"
        fi
        rm -f "$PIDFILE_WORKER"
    else
        echo "No worker PID file found"
    fi

    if [ -f "$PIDFILE_BEAT" ]; then
        PID=$(cat "$PIDFILE_BEAT")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null
            echo "Beat stopped (PID $PID)"
        else
            echo "Beat not running (stale PID $PID)"
        fi
        rm -f "$PIDFILE_BEAT"
    fi

    # Clean up any orphaned celery processes
    pkill -f 'celery -A app.worker' 2>/dev/null || true
    echo "All Celery processes stopped."
}

status() {
    echo "=== Celery Processes ==="
    if [ -f "$PIDFILE_WORKER" ] && kill -0 "$(cat "$PIDFILE_WORKER")" 2>/dev/null; then
        echo "Worker: RUNNING (PID $(cat "$PIDFILE_WORKER"))"
    else
        echo "Worker: STOPPED"
    fi

    if [ -f "$PIDFILE_BEAT" ] && kill -0 "$(cat "$PIDFILE_BEAT")" 2>/dev/null; then
        echo "Beat:   RUNNING (PID $(cat "$PIDFILE_BEAT"))"
    else
        echo "Beat:   STOPPED"
    fi

    PROCS=$(pgrep -f 'celery -A app.worker' 2>/dev/null | wc -l | tr -d ' ')
    echo "Total celery processes: $PROCS"
}

logs() {
    echo "=== Worker Log (last 20 lines) ==="
    tail -20 "$LOG_DIR/celery-worker.log" 2>/dev/null || echo "(no log file)"
    echo ""
    echo "=== Beat Log (last 10 lines) ==="
    tail -10 "$LOG_DIR/celery-beat.log" 2>/dev/null || echo "(no log file)"
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 2; start ;;
    status)  status ;;
    logs)    logs ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
