import axios from 'axios';
const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:5000/api',timeout:15000});
api.interceptors.request.use(config=>{const token=localStorage.getItem('volttrack-token');if(token)config.headers.Authorization=`Bearer ${token}`;return config});
api.interceptors.response.use(response=>response,error=>{if(error.response?.status===401){localStorage.removeItem('volttrack-token');localStorage.removeItem('volttrack-user');window.dispatchEvent(new Event('volttrack:logout'))}return Promise.reject(error)});
export const payload=response=>{const body=response?.data??response;if(body?.data!==undefined)return body.data;return body};
export const messageOf=(error,fallback='Something went wrong')=>error?.response?.data?.message||error?.response?.data?.error||error?.message||fallback;
export default api;
