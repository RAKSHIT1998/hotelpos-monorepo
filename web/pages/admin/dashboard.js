import React,{useEffect,useState} from 'react'
import { api } from '../../lib/api'
export default function AdminDash(){
  const [profile,setProfile]=useState({})
  const [prov,setProv]=useState([])
  const [creds,setCreds]=useState([])
  const load=async()=>{const p=await api('/api/tenant/profile');setProfile(p.profile||{});const pr=await api('/api/ota/providers');setProv(pr.items||[]);const cr=await api('/api/ota/credentials');setCreds(cr.items||[])}
  useEffect(()=>{load()},[])
  const saveProfile=async(e)=>{e.preventDefault();await api('/api/tenant/profile',{method:'POST',body:JSON.stringify(profile)});alert('Saved profile')}
  const addCred=async(e)=>{e.preventDefault();const providerId=e.target.providerId.value;const propertyCode=e.target.propertyCode.value;const username=e.target.username.value;const secret=e.target.secret.value;await api('/api/ota/credentials',{method:'POST',body:JSON.stringify({providerId,propertyCode,username,secret})});e.target.reset();load()}
  return <div style={{maxWidth:960,margin:'2rem auto'}}>
    <h1>Admin Dashboard</h1>
    <section style={{background:'#fff',padding:16,borderRadius:12,marginBottom:16}}>
      <h3>Business Profile</h3>
      <form onSubmit={saveProfile}>
        <input placeholder="Legal name" value={profile.legalName||''} onChange={e=>setProfile({...profile,legalName:e.target.value})}/>
        <input placeholder="GSTIN (optional)" value={profile.gstin||''} onChange={e=>setProfile({...profile,gstin:e.target.value})}/>
        <input placeholder="VAT Number (optional)" value={profile.vatNumber||''} onChange={e=>setProfile({...profile,vatNumber:e.target.value})}/>
        <input placeholder="Logo URL (optional)" value={profile.logoUrl||''} onChange={e=>setProfile({...profile,logoUrl:e.target.value})}/>
        <button>Save</button>
      </form>
    </section>
    <section style={{background:'#fff',padding:16,borderRadius:12}}>
      <h3>OTA Credentials</h3>
      <form onSubmit={addCred}>
        <select name="providerId">{prov.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input name="propertyCode" placeholder="Property Code"/>
        <input name="username" placeholder="Username (optional)"/>
        <input name="secret" placeholder="API Secret"/>
        <button>Add</button>
      </form>
      <ul>{creds.map(c=><li key={c.id}>{c.providerName} — {c.propertyCode} ({c.enabled?'enabled':'disabled'})</li>)}</ul>
    </section>
  </div>
}
