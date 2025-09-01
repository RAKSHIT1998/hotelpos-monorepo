import React,{useEffect,useState} from 'react'
import { api } from '../lib/api'
export default function RatePlans(){
  const [items,setItems]=useState([]);const [code,setCode]=useState('STD');const [name,setName]=useState('Standard');const [currency,setCurrency]=useState('INR');const [baseMinor,setBase]=useState(500000)
  const load=async()=>{const r=await api('/api/rate-plans');setItems(r.items)}
  useEffect(()=>{load()},[])
  const save=async(e)=>{e.preventDefault();await api('/api/rate-plans',{method:'POST',body:JSON.stringify({code,name,currency,baseMinor})});load()}
  return <div style={{maxWidth:800,margin:'2rem auto'}}>
    <h1>Rate Plans</h1>
    <form onSubmit={save}>
      <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Code"/>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>
      <input value={currency} onChange={e=>setCurrency(e.target.value)} placeholder="Currency"/>
      <input value={baseMinor} onChange={e=>setBase(e.target.value)} placeholder="Base minor (e.g. 500000 == 5,000.00)"/>
      <button>Save</button>
    </form>
    <ul>{items.map(x=><li key={x.id}>{x.code} — {x.name} — {x.currency} — {(x.baseMinor/100).toFixed(2)}</li>)}</ul>
  </div>
}
