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


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
