const API_BASE_URL=(process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/$/,'');
export async function apiRequest<T>(path:string,init?:RequestInit):Promise<T>{const response=await fetch(API_BASE_URL+path,{...init,headers:{'Content-Type':'application/json',...init?.headers}});if(!response.ok)throw new Error('API request failed ('+response.status+')');return response.json() as Promise<T>;}
export { API_BASE_URL };
