# RAKSHA LINK

Local emergency disaster-management prototype connecting citizens with a rescue command centre.

## Run the frontend

```powershell
npm install
npm run dev
```

Open http://localhost:5173.

## Run the FastAPI backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend uses SQLite for immediate local startup. The schema is modular and includes rescuers, zones, roads, shelters, SOS messages, and communication logs. PostgreSQL/PostGIS can replace the SQLite connection layer later without changing the API contract.

## Demo flow

1. Public page opens on the live disaster map. Select Camp A and activate the safest route.
2. Open Request Rescue, set people/critical count, and transmit through AUTO, SMS, or USSD. All gateway messaging is explicitly simulated.
3. Open Rescuer login. Choose any of the six accounts and use `raksha123`.
4. In Command Centre, acknowledge critical SOS requests, draw a flooded or at-risk polygon, or click Mark blocked road and then select a road.
5. The current browser session mirrors those actions back to the public view. FastAPI exposes the same operations through REST and `/ws`.

## API

- `POST /api/auth/login`
- `GET/POST /api/zones`
- `GET/PATCH /api/roads/{id}`
- `GET /api/shelters`
- `POST/GET/PATCH /api/sos`
- `POST /api/sos/transmit`
- `GET /api/communication/status`
- `POST /api/communication/simulate`
- `WS /ws`

Map tiles default to OpenStreetMap and can be changed with `VITE_MAP_TILE_URL` in `.env`. The default map is a legal, non-Google street basemap; a satellite provider URL can be configured when a suitable key is available.

Routes use the configurable `VITE_ROUTING_URL` OSRM endpoint. OSRM returns road-snapped GeoJSON geometry and turn steps. The client scores returned alternatives against the current disaster-road data, adds penalties for at-risk/flooded roads, and excludes blocked/destroyed roads before rendering the selected geometry in Leaflet. A network connection is required for live route calculation.
