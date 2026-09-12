"""
Therapie Constraint Solver — FastAPI entrypoint.
POST /solve   → accepts PlanningRuleModel JSON, returns GenerierterPlan JSON
GET  /health  → liveness probe
"""

import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn

from solver import solve, capabilities, validate_constraint_code

app = FastAPI(title="Therapie Constraint Solver", version="1.0.0")


# §97: Version und Fähigkeiten mitliefern. Wird nur die App ausgerollt und der
# Rechendienst nicht, laufen beide auseinander — generierter Regel-Code nutzt
# dann Variablen, die die alte Version nicht kennt, und die Regel bleibt ohne
# Wirkung. Über diese Angaben erkennt die App das und sagt es deutlich.
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", **capabilities()}


@app.get("/version")
async def version() -> dict:
    return capabilities()


# §98: Regel-Code probeweise ausführen, bevor er gespeichert oder aktiviert wird.
@app.post("/validate-constraint")
async def validate_endpoint(request: Request) -> JSONResponse:
    try:
        body: dict = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc
    return JSONResponse(content=validate_constraint_code(body.get("code", "")))


@app.post("/solve")
async def solve_endpoint(request: Request) -> JSONResponse:
    try:
        body: dict = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    try:
        result = solve(body)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return JSONResponse(content=result)


def _make_socket(port: int) -> "socket.socket":
    """
    §92 Bindung selbst vornehmen statt uvicorn raten zu lassen.

    Railways privates Netz (*.railway.internal) und der Plattform-Healthcheck
    sprechen Dienste über IPv6 an; "0.0.0.0" allein reicht dort nicht. Ein
    hartes Binden auf "::" lässt den Dienst aber in Umgebungen OHNE IPv6 gar
    nicht starten (uvicorn beendet sich mit Code 3). Deshalb: erst dual-stack
    versuchen, bei Misserfolg sauber auf IPv4 zurückfallen — der Dienst startet
    dadurch in JEDER Umgebung.
    """
    import socket

    explicit = os.environ.get("HOST")
    if explicit:
        family = socket.AF_INET6 if ":" in explicit else socket.AF_INET
        sock = socket.socket(family, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((explicit, port))
        sock.listen(2048)
        sock.set_inheritable(True)
        print(f"[solver] bound (HOST={explicit}) on port {port}", flush=True)
        return sock

    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)  # auch IPv4 bedienen
        except OSError:
            pass
        sock.bind(("::", port))
        sock.listen(2048)
        sock.set_inheritable(True)
        print(f"[solver] bound dual-stack [::]:{port}", flush=True)
        return sock
    except OSError as exc:
        print(f"[solver] IPv6 nicht verfuegbar ({exc}) - fallback auf IPv4", flush=True)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", port))
    sock.listen(2048)
    sock.set_inheritable(True)
    print(f"[solver] bound IPv4 0.0.0.0:{port}", flush=True)
    return sock


def _read_port() -> int:
    """
    §93 PORT tolerant lesen. Ist die Variable nicht gesetzt oder enthaelt sie
    etwas Unbrauchbares (z.B. den nicht aufgeloesten Platzhalter "$PORT" aus
    einem Start-Befehl ohne Shell), wird 8080 verwendet — der Dienst startet
    dann trotzdem, statt in einer Absturzschleife zu enden.
    """
    raw = os.environ.get("PORT", "")
    try:
        value = int(str(raw).strip())
        if 1 <= value <= 65535:
            return value
    except (TypeError, ValueError):
        pass
    if raw:
        print(f"[solver] PORT={raw!r} unbrauchbar - verwende 8080", flush=True)
    return 8080


if __name__ == "__main__":
    port = _read_port()
    listen_sock = _make_socket(port)
    server = uvicorn.Server(uvicorn.Config(app, log_level="info"))
    server.run(sockets=[listen_sock])
