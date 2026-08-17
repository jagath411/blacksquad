import { View } from 'react-native';
interface NativeMapViewProps { center?: { latitude: number; longitude: number }; zoom?: number; markers?: unknown[]; interactive?: boolean; style?: unknown; }
export function NativeMapView(_props: NativeMapViewProps) { return <View style={{ flex: 1 }} />; }

