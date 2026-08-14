export type UserRole = 'DRIVER' | 'CUSTOMER';
export type RootStackParamList = { Welcome: undefined; Role: undefined; Login: { role: UserRole }; Home: { role: UserRole } };
export interface HealthResponse { success: boolean; message: string; apiStatus: string; database: { status: string } }
