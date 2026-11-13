export const arrayFrom=(value,key)=>Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:[];
export const riskLevel=value=>String(value||'LOW').toUpperCase();
export const riskClass=value=>`risk-badge risk-${riskLevel(value).toLowerCase()}`;
export const fmtNumber=value=>Number(value||0).toLocaleString();
export const monthNow=()=>new Date().toISOString().slice(0,7);
export const csvBlob=async(api,path,params,filename)=>{const response=await api.get(path,{params,responseType:'blob'});const url=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)};
