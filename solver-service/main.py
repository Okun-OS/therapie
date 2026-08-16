"""
Therapie Constraint Solver — FastAPI entrypoint.
POST /solve   → accepts PlanningRuleModel JSON, returns GenerierterPlan JSON
GET  /health  → liveness probe
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
import uvicorn

from solver import solve

app = FastAPI(title="Therapie Constraint Solver", version="1.0.0")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


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


def _pick_host() -> str:
    """
    §90 Bindeadresse robust wählen.

    Railways privates Netzwerk (*.railway.internal) und der Plattform-
    Healthcheck sprechen Dienste über IPv6 an. Bindet der Server nur auf
    "0.0.0.0" (IPv4), schlagen beide fehl. "::" bedient dual-stack — ist in der
    Umgebung aber kein IPv6 verfügbar, kann der Server GAR NICHT starten.
    Deshalb: IPv6 testen und nur dann verwenden, sonst auf IPv4 zurückfallen.
    """
    import os
    import socket

    explicit = os.environ.get("HOST")
    if explicit:
        return explicit

    try:
        probe = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        try:
            probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            pass  # manche Systeme erlauben das Umschalten nicht — trotzdem versuchen
        probe.bind(("::", 0))
        probe.close()
        return "::"
    except OSError:
        return "0.0.0.0"


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8080))
    host = _pick_host()
    print(f"[solver] starting on {host}:{port}", flush=True)
    uvicorn.run(app, host=host, port=port)
