import { Road, RoadStatus, RouteStep, Shelter, VictimLocation } from "../types";

export interface RoadRoute {
  path: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  score: number;
  steps: RouteStep[];
}

interface OsrmStep {
  distance: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs?: { steps?: OsrmStep[] }[];
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}

const OSRM_URL = import.meta.env.VITE_ROUTING_URL || "https://router.project-osrm.org/route/v1/driving";
const HAZARD_PENALTY: Record<RoadStatus, number> = {
  safe: 0,
  "at-risk": 500,
  flooded: 5000,
  blocked: Number.POSITIVE_INFINITY,
  destroyed: Number.POSITIVE_INFINITY,
};

function metersBetween(a: [number, number], b: [number, number]) {
  const latScale = 111_000;
  const lngScale = 103_000;
  return Math.hypot((a[0] - b[0]) * latScale, (a[1] - b[1]) * lngScale);
}

function routeTouchesRoad(route: [number, number][], road: Road) {
  return route.some((point) => road.path.some((roadPoint) => metersBetween(point, roadPoint) < 65));
}

function routeScore(route: OsrmRoute, roads: Road[]) {
  const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  let score = route.distance;
  for (const road of roads) {
    if (routeTouchesRoad(path, road)) {
      const penalty = HAZARD_PENALTY[road.status];
      if (!Number.isFinite(penalty)) return Number.POSITIVE_INFINITY;
      score += penalty;
    }
  }
  return score;
}

function maneuverToInstruction(step: OsrmStep): RouteStep["instruction"] {
  const modifier = step.maneuver?.modifier;
  if (step.maneuver?.type === "arrive") return "ARRIVE";
  if (modifier?.includes("uturn")) return "U-TURN";
  if (modifier?.includes("left")) return "LEFT";
  if (modifier?.includes("right")) return "RIGHT";
  return "STRAIGHT";
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(meters / 10) * 10)} m`;
}

function makeSteps(route: OsrmRoute, destinationName: string): RouteStep[] {
  const rawSteps = route.legs?.flatMap((leg) => leg.steps || []) || [];
  const steps = rawSteps.map((step) => ({
    instruction: maneuverToInstruction(step),
    distance: formatDistance(step.distance),
    road: step.name || "Unnamed road",
  }));
  if (steps.length === 0) steps.push({ instruction: "STRAIGHT", distance: formatDistance(route.distance), road: "Road network" });
  steps.push({ instruction: "ARRIVE", distance: "0 m", road: destinationName });
  return steps;
}

export async function calculateSafeRoadRoute(origin: VictimLocation, destination: Shelter | [number, number], roads: Road[], signal?: AbortSignal): Promise<RoadRoute | null> {
  const destinationPoint: [number, number] = Array.isArray(destination)
    ? destination
    : [destination.lat, destination.lng];
  const start = `${origin.longitude},${origin.latitude}`;
  const end = `${destinationPoint[1]},${destinationPoint[0]}`;
  const response = await fetch(`${OSRM_URL}/${start};${end}?overview=full&geometries=geojson&steps=true&alternatives=true`, { signal });
  if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
  const data = (await response.json()) as OsrmResponse;
  const availableRoutes = (data.routes || []).filter((route) => route.geometry?.coordinates?.length > 1);
  const scored = availableRoutes
    .map((route) => ({ route, score: routeScore(route, roads) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score);
  const selected = scored[0];
  if (!selected) return null;
  return {
    path: selected.route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceMeters: selected.route.distance,
    durationSeconds: selected.route.duration,
    score: selected.score,
    steps: makeSteps(selected.route, Array.isArray(destination) ? "Rescue Unit" : destination.name),
  };
}
