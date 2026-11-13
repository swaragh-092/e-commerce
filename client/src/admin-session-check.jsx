import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider,createTheme,CssBaseline,Box,TextField,Typography,Button} from '@mui/material';
import {AuthContext} from './context/AuthContext';
import api from './services/api';
import AdminSessionGuard from './components/admin/AdminSessionGuard';
const user={id:'demo-admin',email:'demo@example.test'};
const key='admin-session-fixture';
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({start:Date.now(),expiry:Date.now()+90000}));
api.defaults.adapter=async config=>{
 const s=JSON.parse(localStorage.getItem(key));
 if(config.url==='/auth/login'){
  localStorage.setItem(key,JSON.stringify({start:Date.now(),expiry:Date.now()+1800000}));
  return {data:{data:{user}},status:200,config,headers:{}};
 }
 if(config.url==='/auth/admin-session/activity') return {data:{data:{}},status:200,config,headers:{}};
 if(config.url==='/auth/admin-session'){
  if(s.expiry<=Date.now())throw {response:{status:401,data:{error:{code:'ADMIN_SESSION_EXPIRED'}}},config};
  return {data:{data:{userId:user.id,startedAt:new Date(s.start).toISOString(),serverTime:new Date().toISOString(),absoluteExpiresAt:new Date(s.expiry).toISOString(),idleExpiresAt:new Date(s.expiry).toISOString(),reauthContext:'fixture-context'}},status:200,config,headers:{}};
 }
 return {data:{data:user},status:200,config,headers:{}};
};
function App(){const [draft,setDraft]=useState('Draft product description');return <ThemeProvider theme={createTheme()}><CssBaseline/><AuthContext.Provider value={{user,finalizeAuthenticatedSession:async()=>user,verifyTwoFactor:async()=>({user})}}><Box sx={{p:5,maxWidth:850,mx:'auto'}}><Typography variant="h4" sx={{mb:3}}>Admin editor · synthetic verification</Typography><TextField fullWidth label="Unsaved description" value={draft} onChange={e=>setDraft(e.target.value)}/><Button sx={{mt:2}} onClick={()=>{const s=JSON.parse(localStorage.getItem(key));s.expiry=Date.now()-1;localStorage.setItem(key,JSON.stringify(s));window.dispatchEvent(new Event('admin-session:expired'));}}>Simulate server expiry</Button><Typography sx={{mt:3}}>Unsaved work stays mounted while locked. No customer data is used.</Typography></Box><AdminSessionGuard/></AuthContext.Provider></ThemeProvider>}
createRoot(document.getElementById('root')).render(<App/>);
