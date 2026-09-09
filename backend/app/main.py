from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import json
import sqlite3
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "raksha.db"
app = FastAPI(title="RAKSHA LINK API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
clients: set[WebSocket] = set()

class LoginRequest(BaseModel):
    username: str
    password: str

class SosRequest(BaseModel):
    phone_number: str
    latitude: float
    longitude: float
    city_code: str = "01"
    people_count: int = Field(ge=1)
    critical_count: int = Field(default=0, ge=0)
    communication_method: str = "AUTO"
    location_source: str = "GPS"
    payload: str

class VictimLocationRequest(BaseModel):
    latitude: float
    longitude: float
    source: str

class StatusRequest(BaseModel):
    status: str

class ZoneRequest(BaseModel):
    name: str
    geometry: list[list[float]]
    zone_type: str
    severity: str
    reported_by: str = "Rescuer 1"

class RoadRequest(BaseModel):
    status: str
    severity: str = "HIGH"

class GatewayRequest(BaseModel):
    method: str
    payload: str
    internet: bool = True
    cellular: bool = True

class ShelterUpdate(BaseModel):
    capacity: int | None = None
    occupancy: int | None = None
    medicineStatus: str | None = None
    medicalKits: int | None = None
    foodStatus: str | None = None
    foodStock: int | None = None
    emergencySupplies: str | None = None
    status: str | None = None

def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    connection = db()
    connection.executescript("""
      CREATE TABLE IF NOT EXISTS rescuers (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT);
      CREATE TABLE IF NOT EXISTS zones (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, geometry TEXT, zone_type TEXT, severity TEXT, reported_by TEXT, created_at TEXT);
      CREATE TABLE IF NOT EXISTS roads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, geometry TEXT, status TEXT, severity TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS shelters (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, latitude REAL, longitude REAL, capacity INTEGER, occupancy INTEGER, status TEXT, medicine_status TEXT DEFAULT 'AVAILABLE', medical_kits INTEGER DEFAULT 0, food_status TEXT DEFAULT 'AVAILABLE', food_stock INTEGER DEFAULT 0, emergency_supplies TEXT DEFAULT 'AVAILABLE');
    CREATE TABLE IF NOT EXISTS sos_messages (id TEXT PRIMARY KEY, phone_number TEXT, latitude REAL, longitude REAL, location_source TEXT DEFAULT 'GPS', city_code TEXT, people_count INTEGER, critical_count INTEGER, critical_code TEXT, priority TEXT, communication_method TEXT, payload TEXT, transmission_status TEXT, command_centre_status TEXT, created_at TEXT);
      CREATE TABLE IF NOT EXISTS communication_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, sos_id TEXT, method TEXT, payload TEXT, status TEXT, created_at TEXT);
    """)
    columns = {row[1] for row in connection.execute("PRAGMA table_info(shelters)").fetchall()}
    for name, definition in {"medicine_status": "TEXT DEFAULT 'AVAILABLE'", "medical_kits": "INTEGER DEFAULT 0", "food_status": "TEXT DEFAULT 'AVAILABLE'", "food_stock": "INTEGER DEFAULT 0", "emergency_supplies": "TEXT DEFAULT 'AVAILABLE'"}.items():
        if name not in columns: connection.execute(f"ALTER TABLE shelters ADD COLUMN {name} {definition}")
    sos_columns = {row[1] for row in connection.execute("PRAGMA table_info(sos_messages)").fetchall()}
    if "location_source" not in sos_columns: connection.execute("ALTER TABLE sos_messages ADD COLUMN location_source TEXT DEFAULT 'GPS'")
    if connection.execute("SELECT COUNT(*) FROM rescuers").fetchone()[0] == 0:
        for number in range(1, 7):
            connection.execute("INSERT INTO rescuers (username, password_hash) VALUES (?, ?)", (f"Rescuer {number}", "raksha123"))
    if connection.execute("SELECT COUNT(*) FROM shelters").fetchone()[0] == 0:
        camps = [
            ("Camp A · St. Marys School", 10.5326, 76.2078, 150, 78, "OPEN", "AVAILABLE", 42, "AVAILABLE", 320, "AVAILABLE"),
            ("Camp B · Civic Grounds", 10.5189, 76.2261, 300, 116, "OPEN", "LOW", 18, "AVAILABLE", 240, "LOW"),
            ("Camp C · Railway Relief Hub", 10.5414, 76.2292, 500, 188, "OPEN", "AVAILABLE", 86, "AVAILABLE", 610, "AVAILABLE"),
            ("Camp D · Medical College", 10.5142, 76.2014, 200, 194, "FULL", "AVAILABLE", 12, "LOW", 40, "LOW"),
        ]
        connection.executemany("INSERT INTO shelters (name, latitude, longitude, capacity, occupancy, status, medicine_status, medical_kits, food_status, food_stock, emergency_supplies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", camps)
    connection.commit()
    connection.close()

def serialize_sos(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "phoneNumber": row["phone_number"],
        "latitude": float(row["latitude"]) if row["latitude"] is not None else None,
        "longitude": float(row["longitude"]) if row["longitude"] is not None else None,
        "locationSource": row["location_source"] or "GPS",
        "cityCode": row["city_code"],
        "cityName": "Thrissur" if row["city_code"] == "01" else "Unknown",
        "peopleCount": row["people_count"],
        "criticalCount": row["critical_count"],
        "criticalCode": row["critical_code"],
        "priority": row["priority"],
        "communicationMethod": row["communication_method"],
        "transmissionStatus": row["transmission_status"],
        "commandCentreStatus": row["command_centre_status"],
        "payload": row["payload"],
        "createdAt": row["created_at"],
    }

@app.on_event("startup")
def startup():
    init_db()

async def broadcast(event: dict[str, Any]):
    disconnected = []
    for client in clients:
        try:
            await client.send_json(event)
        except Exception:
            disconnected.append(client)
    for client in disconnected:
        clients.discard(client)

@app.get("/api/health")
def health():
    return {"status": "operational", "service": "RAKSHA LINK", "database": "sqlite-development"}

@app.post("/api/auth/login")
def login(request: LoginRequest):
    connection = db()
    user = connection.execute("SELECT username FROM rescuers WHERE username = ? AND password_hash = ?", (request.username, request.password)).fetchone()
    connection.close()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid demo credentials")
    return {"authenticated": True, "username": user["username"], "token": f"demo-token-{user['username'].replace(' ', '-').lower()}"}

@app.get("/api/zones")
def get_zones():
    connection = db(); rows = connection.execute("SELECT * FROM zones ORDER BY id").fetchall(); connection.close()
    return [{**dict(row), "geometry": json.loads(row["geometry"])} for row in rows]

@app.post("/api/zones")
async def create_zone(zone: ZoneRequest):
    now = datetime.now(timezone.utc).isoformat()
    connection = db(); cursor = connection.execute("INSERT INTO zones (name, geometry, zone_type, severity, reported_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", (zone.name, json.dumps(zone.geometry), zone.zone_type, zone.severity, zone.reported_by, now)); connection.commit(); zone_id = cursor.lastrowid; connection.close()
    await broadcast({"type": "ZONE_CREATED", "id": zone_id, **zone.model_dump()})
    return {"id": zone_id, **zone.model_dump(), "created_at": now}

@app.get("/api/roads")
def get_roads():
    connection = db(); rows = connection.execute("SELECT * FROM roads ORDER BY id").fetchall(); connection.close()
    return [dict(row) for row in rows]

@app.patch("/api/roads/{road_id}")
async def update_road(road_id: int, request: RoadRequest):
    now = datetime.now(timezone.utc).isoformat(); connection = db(); cursor = connection.execute("UPDATE roads SET status = ?, severity = ?, updated_at = ? WHERE id = ?", (request.status, request.severity, now, road_id)); connection.commit(); connection.close()
    if cursor.rowcount == 0: raise HTTPException(status_code=404, detail="Road not found")
    await broadcast({"type": "ROAD_UPDATED", "id": road_id, **request.model_dump()})
    return {"id": road_id, **request.model_dump(), "updated_at": now}

@app.get("/api/shelters")
def get_shelters():
    connection = db(); rows = connection.execute("SELECT * FROM shelters ORDER BY id").fetchall(); connection.close(); return [dict(row) for row in rows]

@app.get("/api/shelters/{shelter_id}")
def get_shelter(shelter_id: int):
    connection = db(); row = connection.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,)).fetchone(); connection.close()
    if not row: raise HTTPException(status_code=404, detail="Shelter not found")
    return dict(row)

@app.patch("/api/shelters/{shelter_id}")
async def update_shelter(shelter_id: int, request: ShelterUpdate):
    values = {key: value for key, value in request.model_dump().items() if value is not None}
    if not values: raise HTTPException(status_code=400, detail="No shelter changes supplied")
    columns = {"medicineStatus": "medicine_status", "medicalKits": "medical_kits", "foodStatus": "food_status", "foodStock": "food_stock", "emergencySupplies": "emergency_supplies", "capacity": "capacity", "occupancy": "occupancy", "status": "status"}
    assignments = ", ".join(f"{columns[key]} = ?" for key in values)
    connection = db(); cursor = connection.execute(f"UPDATE shelters SET {assignments} WHERE id = ?", [*values.values(), shelter_id]); connection.commit(); row = connection.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,)).fetchone(); connection.close()
    if cursor.rowcount == 0: raise HTTPException(status_code=404, detail="Shelter not found")
    result = dict(row); await broadcast({"type": "SHELTER_UPDATED", "data": result}); return result

@app.patch("/api/shelters/{shelter_id}/resources")
async def update_shelter_resources(shelter_id: int, request: ShelterUpdate):
    return await update_shelter(shelter_id, request)

@app.post("/api/sos")
async def create_sos(request: SosRequest):
    now = datetime.now(timezone.utc).isoformat(); sos_id = f"RL-SOS-{1000 + abs(hash(now + request.phone_number)) % 8999}"; priority = "CRITICAL" if request.critical_count else "HIGH" if request.people_count > 3 else "MEDIUM"; score = 92 if priority == "CRITICAL" else 64 if priority == "HIGH" else 48
    connection = db(); connection.execute("INSERT INTO sos_messages (id, phone_number, latitude, longitude, location_source, city_code, people_count, critical_count, critical_code, priority, communication_method, payload, transmission_status, command_centre_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", (sos_id, request.phone_number, request.latitude, request.longitude, request.location_source, request.city_code, request.people_count, request.critical_count, f"C{request.critical_count}", priority, request.communication_method, request.payload, "CREATED", "PENDING", now)); connection.commit(); connection.close()
    event = {"id": sos_id, **request.model_dump(), "priority": priority, "score": score, "transmission_status": "CREATED", "command_centre_status": "PENDING", "created_at": now}; await broadcast({"type": "SOS_CREATED", "data": event}); return event

@app.get("/api/sos")
def get_sos():
    connection = db(); rows = connection.execute("SELECT * FROM sos_messages ORDER BY critical_count DESC, people_count DESC, created_at DESC").fetchall(); connection.close(); return [serialize_sos(row) for row in rows]

@app.patch("/api/sos/{sos_id}")
async def update_sos(sos_id: str, request: StatusRequest):
    connection = db(); cursor = connection.execute("UPDATE sos_messages SET command_centre_status = ? WHERE id = ?", (request.status, sos_id)); connection.commit(); connection.close()
    if cursor.rowcount == 0: raise HTTPException(status_code=404, detail="SOS not found")
    await broadcast({"type": "SOS_UPDATED", "id": sos_id, "status": request.status}); return {"id": sos_id, "status": request.status}

@app.post("/api/sos/transmit")
async def transmit_sos(request: GatewayRequest):
    method = request.method if request.method != "AUTO" else ("4G / 5G" if request.internet else "SMS" if request.cellular else "USSD")
    status = "TRANSMITTED" if method else "STORED LOCALLY"
    return {"method": method, "status": status, "gateway": f"DEMO {method} GATEWAY", "received": status == "TRANSMITTED", "payload": request.payload}

@app.get("/api/communication/status")
def communication_status():
    return {"internet": True, "cellular": True, "fallback_order": ["4G / 5G", "SMS", "USSD", "LOCAL STORAGE"]}

@app.post("/api/victim/location")
def set_victim_location(request: VictimLocationRequest):
    if not -90 <= request.latitude <= 90 or not -180 <= request.longitude <= 180 or request.source not in {"GPS", "MANUAL"}:
        raise HTTPException(status_code=422, detail="Invalid victim location")
    return {"success": True, **request.model_dump()}

@app.post("/api/communication/simulate")
def simulate_communication(request: GatewayRequest):
    return {"method": request.method, "status": "TRANSMITTED", "simulated": True, "message": "Demo gateway event accepted by command centre"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept(); clients.add(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect: clients.discard(websocket)
