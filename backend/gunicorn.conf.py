import multiprocessing

# ── Server socket ─────────────────────────────────────────────────────────────
bind = "0.0.0.0:8000"
backlog = 2048

# ── Worker processes ──────────────────────────────────────────────────────────
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 30
keepalive = 5

# ── Logging ───────────────────────────────────────────────────────────────────
loglevel = "info"
accesslog = "-"
errorlog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# ── Process naming ────────────────────────────────────────────────────────────
proc_name = "feazy-api"

# ── Server mechanics ──────────────────────────────────────────────────────────
preload_app = True
max_requests = 1000
max_requests_jitter = 100
