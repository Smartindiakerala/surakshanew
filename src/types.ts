export type ZoneType = 'flooded' | 'risk'
export type RoadStatus = 'safe' | 'at-risk' | 'flooded' | 'blocked' | 'destroyed'
export type CommMethod = 'AUTO' | '4G / 5G' | 'SMS' | 'USSD'
export type TransmissionStatus = 'CREATED' | 'TRANSMITTING' | 'TRANSMITTED' | 'STORED LOCALLY' | 'RECEIVED' | 'ACKNOWLEDGED'
export type ResourceStatus = 'AVAILABLE' | 'LOW' | 'OUT OF STOCK'
export type CampStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'EMERGENCY'
export type DestinationType = 'RESCUE_UNIT' | 'RELIEF_CAMP'
export type LocationSource = 'GPS' | 'MANUAL'

export interface VictimLocation { latitude: number; longitude: number; source: LocationSource }
export interface FieldUnit { id: string; name: string; rescuer: string; latitude: number; longitude: number; status: 'LIVE' | 'OFFLINE'; lastUpdate: string }
export interface Shelter { id: string; name: string; lat: number; lng: number; distance: string; capacity: number; occupancy: number; status: CampStatus; supplies: string; medicineStatus: ResourceStatus; medicalKits: number; foodStatus: ResourceStatus; foodStock: number; emergencySupplies: ResourceStatus }
export interface RouteStep { instruction: 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'U-TURN' | 'ARRIVE'; distance: string; road?: string }
export interface Zone { id: string; name: string; type: ZoneType; severity: string; polygon: [number, number][] }
export interface Road { id: string; name: string; status: RoadStatus; severity: string; path: [number, number][]; reported: string }
export interface Sos { id: string; phone: string; lat: number; lng: number; locationSource: LocationSource; cityCode: string; people: number; critical: number; priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; score: number; method: CommMethod; payload: string; status: TransmissionStatus; createdAt: string }
export interface CommState { internet: boolean; cellular: boolean; method: CommMethod; lastEvent: string; lastSosId?: string }
