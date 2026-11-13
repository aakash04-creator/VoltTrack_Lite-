import {createContext,useCallback,useEffect,useMemo,useState} from 'react';
import api,{payload} from '../api/client';
export const AuthContext=createContext(null);
export function AuthProvider({children}){const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('volttrack-user')||'null')}catch{return null}});const [token,setToken]=useState(()=>localStorage.getItem('volttrack-token'));
 const accept=useCallback(auth=>{localStorage.setItem('volttrack-token',auth.token);localStorage.setItem('volttrack-user',JSON.stringify(auth.user));setToken(auth.token);setUser(auth.user)},[]);
 const login=useCallback(async credentials=>{const {data}=await api.post('/auth/login',credentials);accept(payload(data));return payload(data).user},[accept]);
 const register=useCallback(async fields=>{const {data}=await api.post('/auth/register',fields);accept(payload(data));return payload(data).user},[accept]);
 const logout=useCallback(()=>{localStorage.removeItem('volttrack-token');localStorage.removeItem('volttrack-user');setToken(null);setUser(null)},[]);
 useEffect(()=>{const handler=()=>logout();window.addEventListener('volttrack:logout',handler);return()=>window.removeEventListener('volttrack:logout',handler)},[logout]);
 useEffect(()=>{if(!token)return;let alive=true;api.get('/auth/me').then(({data})=>{const info=payload(data);if(alive&&info.user){setUser(info.user);localStorage.setItem('volttrack-user',JSON.stringify(info.user))}}).catch(()=>{});return()=>{alive=false}},[]);
 const value=useMemo(()=>({user,token,login,register,logout,isAdmin:user?.role==='ADMIN'}),[user,token,login,register,logout]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}

