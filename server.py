"""Small development server for Pashmina Flow.

This server is intentionally simple and is for local learning only. It stores one
JSON document per company in SQLite and provides a version check for sync.

For a real business deployment, use secure authentication, HTTPS, backups, and
a hosted database/API instead of this demo server.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DATABASE_PATH = ROOT / "pashmina_flow.sqlite3"
DB_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialise_database() -> None:
    with DB_LOCK, connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS company_documents (
                company_id TEXT PRIMARY KEY,
                version INTEGER NOT NULL,
                state_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def read_json(handler: SimpleHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", "0"))
    if length <= 0 or length > 20_000_000:
        raise ValueError("Request body is missing or too large.")
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8"))


def write_json(handler: SimpleHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def company_id_from(value: object) -> str:
    text = str(value or "demo-company").strip()
    if not text or len(text) > 100:
        raise ValueError("Invalid company id.")
    return text


class PashminaHandler(SimpleHTTPRequestHandler):
    server_version = "PashminaFlowDev/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - name required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            write_json(self, 200, {"status": "ok", "service": "146enterprises-demo", "time": utc_now()})
            return
        if parsed.path == "/api/state":
            query = parse_qs(parsed.query)
            try:
                company_id = company_id_from(query.get("companyId", ["demo-company"])[0])
                with DB_LOCK, connect() as connection:
                    row = connection.execute(
                        "SELECT version, state_json, updated_at FROM company_documents WHERE company_id = ?",
                        (company_id,),
                    ).fetchone()
                if row is None:
                    write_json(self, 404, {"status": "empty", "message": "No server document exists yet."})
                else:
                    write_json(
                        self,
                        200,
                        {
                            "status": "ok",
                            "version": row["version"],
                            "state": json.loads(row["state_json"]),
                            "serverUpdatedAt": row["updated_at"],
                        },
                    )
                return
            except ValueError as error:
                write_json(self, 400, {"status": "error", "message": str(error)})
                return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - name required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path != "/api/sync":
            self.send_error(404)
            return

        try:
            request = read_json(self)
            company_id = company_id_from(request.get("companyId"))
            device_id = str(request.get("deviceId") or "unknown-device")[:150]
            base_version = int(request.get("baseVersion") or 0)
            state = request.get("state")
            if not isinstance(state, dict):
                raise ValueError("The state must be a JSON object.")

            with DB_LOCK, connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    "SELECT version, state_json, updated_at FROM company_documents WHERE company_id = ?",
                    (company_id,),
                ).fetchone()
                now = utc_now()

                if row is None:
                    new_version = 1
                    connection.execute(
                        "INSERT INTO company_documents (company_id, version, state_json, updated_at) VALUES (?, ?, ?, ?)",
                        (company_id, new_version, json.dumps(state, ensure_ascii=False), now),
                    )
                    result = {"status": "ok", "version": new_version, "state": state, "serverUpdatedAt": now}
                elif base_version == int(row["version"]):
                    new_version = int(row["version"]) + 1
                    connection.execute(
                        "UPDATE company_documents SET version = ?, state_json = ?, updated_at = ? WHERE company_id = ?",
                        (new_version, json.dumps(state, ensure_ascii=False), now, company_id),
                    )
                    result = {"status": "ok", "version": new_version, "state": state, "serverUpdatedAt": now, "deviceId": device_id}
                else:
                    result = {
                        "status": "conflict",
                        "version": int(row["version"]),
                        "state": json.loads(row["state_json"]),
                        "serverUpdatedAt": row["updated_at"],
                        "message": "Another device changed this company document first.",
                    }

            write_json(self, 200 if result["status"] == "ok" else 409, result)
        except (ValueError, json.JSONDecodeError) as error:
            write_json(self, 400, {"status": "error", "message": str(error)})
        except Exception as error:  # Keep the learning server easy to diagnose.
            write_json(self, 500, {"status": "error", "message": f"Server error: {error}"})

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "self")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Pashmina Flow development server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()
    initialise_database()
    server = ThreadingHTTPServer((args.host, args.port), PashminaHandler)
    print(f"Pashmina Flow is running at http://{args.host}:{args.port}")
    print("This is a local demo sync server. Press Ctrl+C to stop it.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
