import { FieldUnit, Road, Shelter, Sos, Zone } from './types'

export const demoLocation: [number, number] = [10.5276, 76.2144]
export const demoRescuerLocation: [number, number] = [10.5318, 76.2202]
export const initialFieldUnits: FieldUnit[] = [
  { id: 'unit-01', name: 'Unit 01', rescuer: 'Rescuer 1', latitude: demoRescuerLocation[0], longitude: demoRescuerLocation[1], status: 'LIVE', lastUpdate: '4 seconds ago' },
]
export const mapCenter: [number, number] = [10.528, 76.216]
export const shelters: Shelter[] = [
  { id: 'camp-a', name: 'Camp A · St. Marys School', lat: 10.5326, lng: 76.2078, distance: '1.2 km', capacity: 150, occupancy: 78, status: 'OPEN', supplies: 'Food · Medical', medicineStatus: 'AVAILABLE', medicalKits: 42, foodStatus: 'AVAILABLE', foodStock: 320, emergencySupplies: 'AVAILABLE' },
  { id: 'camp-b', name: 'Camp B · Civic Grounds', lat: 10.5189, lng: 76.2261, distance: '2.8 km', capacity: 300, occupancy: 116, status: 'OPEN', supplies: 'Food · Water', medicineStatus: 'LOW', medicalKits: 18, foodStatus: 'AVAILABLE', foodStock: 240, emergencySupplies: 'LOW' },
  { id: 'camp-c', name: 'Camp C · Railway Relief Hub', lat: 10.5414, lng: 76.2292, distance: '4.1 km', capacity: 500, occupancy: 188, status: 'OPEN', supplies: 'Full supplies', medicineStatus: 'AVAILABLE', medicalKits: 86, foodStatus: 'AVAILABLE', foodStock: 610, emergencySupplies: 'AVAILABLE' },
  { id: 'camp-d', name: 'Camp D · Medical College', lat: 10.5142, lng: 76.2014, distance: '4.8 km', capacity: 200, occupancy: 194, status: 'FULL', supplies: 'Medical only', medicineStatus: 'AVAILABLE', medicalKits: 12, foodStatus: 'LOW', foodStock: 40, emergencySupplies: 'LOW' },
]
export const zones: Zone[] = [
  { id: 'zone-1', name: 'Puzhakkal overflow', type: 'flooded', severity: 'HIGH', polygon: [[10.534,76.205],[10.539,76.214],[10.533,76.220],[10.526,76.216],[10.528,76.208]] },
  { id: 'zone-2', name: 'Market lowlands', type: 'flooded', severity: 'CRITICAL', polygon: [[10.516,76.211],[10.522,76.214],[10.519,76.224],[10.511,76.221],[10.511,76.214]] },
  { id: 'zone-3', name: 'East bank watch zone', type: 'risk', severity: 'MEDIUM', polygon: [[10.538,76.222],[10.545,76.223],[10.547,76.234],[10.539,76.236],[10.534,76.229]] },
]
export const roads: Road[] = [
  { id: 'road-1', name: 'Main Junction Road', status: 'flooded', severity: 'HIGH', path: [[10.515,76.204],[10.524,76.211],[10.532,76.218],[10.542,76.226]], reported: '12 min ago' },
  { id: 'road-2', name: 'Puzhakkal Bridge', status: 'blocked', severity: 'CRITICAL', path: [[10.541,76.203],[10.535,76.212],[10.529,76.222],[10.520,76.229]], reported: '8 min ago' },
  { id: 'road-3', name: 'College Link Road', status: 'safe', severity: 'LOW', path: [[10.508,76.198],[10.517,76.207],[10.527,76.210],[10.536,76.208]], reported: '24 min ago' },
  { id: 'road-4', name: 'Canal Service Road', status: 'at-risk', severity: 'MEDIUM', path: [[10.508,76.226],[10.517,76.223],[10.526,76.224],[10.536,76.229]], reported: '18 min ago' },
  { id: 'road-5', name: 'East Ring Road', status: 'destroyed', severity: 'CRITICAL', path: [[10.532,76.232],[10.539,76.234],[10.547,76.235]], reported: '31 min ago' },
]
export const initialSos: Sos[] = [
  { id: 'RL-SOS-1024', phone: '+91 98765 43210', lat: 10.5261, lng: 76.2154, locationSource: 'GPS', cityCode: '01', people: 4, critical: 1, priority: 'CRITICAL', score: 92, method: 'SMS', payload: 'RAKSHA|SOS|+919876543210|01|4|C1|10.5261,76.2154', status: 'RECEIVED', createdAt: '2 min ago' },
  { id: 'RL-SOS-1022', phone: '+91 88480 11223', lat: 10.518, lng: 76.22, locationSource: 'GPS', cityCode: '01', people: 2, critical: 0, priority: 'HIGH', score: 64, method: '4G / 5G', payload: 'RAKSHA|SOS|+918848011223|01|2|C0|10.518,76.22', status: 'ACKNOWLEDGED', createdAt: '9 min ago' },
  { id: 'RL-SOS-1019', phone: '+91 70123 99001', lat: 10.541, lng: 76.225, locationSource: 'GPS', cityCode: '01', people: 6, critical: 0, priority: 'MEDIUM', score: 48, method: 'USSD', payload: 'SOS|+917012399001|01|6|C0', status: 'RECEIVED', createdAt: '14 min ago' },
  { id: 'RL-SOS-1003', phone: '+91 81234 56780', lat: 10.524, lng: 76.2085, locationSource: 'GPS', cityCode: '01', people: 3, critical: 2, priority: 'CRITICAL', score: 90, method: 'SMS', payload: 'RAKSHA|SOS|+918123456780|01|3|C2|10.524,76.2085', status: 'RECEIVED', createdAt: '18 min ago' },
  { id: 'RL-SOS-1004', phone: '+91 76543 21098', lat: 10.536, lng: 76.225, locationSource: 'GPS', cityCode: '01', people: 2, critical: 0, priority: 'MEDIUM', score: 42, method: '4G / 5G', payload: 'RAKSHA|SOS|+917654321098|01|2|C0|10.536,76.225', status: 'RECEIVED', createdAt: '21 min ago' },
  { id: 'RL-SOS-1005', phone: '+91 99887 76655', lat: 10.5195, lng: 76.216, locationSource: 'GPS', cityCode: '01', people: 5, critical: 1, priority: 'CRITICAL', score: 86, method: 'USSD', payload: 'SOS|+919988776655|01|5|C1', status: 'RECEIVED', createdAt: '24 min ago' },
]
