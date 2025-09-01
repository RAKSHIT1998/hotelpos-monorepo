import React,{useState} from 'react'
import { api } from '../lib/api'
export default function Customers(){
  const [phone,setPhone]=useState('');const [results,setResults]=useState([])
  const [name,setName]=useState('');const [email,setEmail]=useState('')
  const search=async(e)=>{e.preventDefault();const r=await api('/api/customers?phone='+encodeURIComponent(phone));setResults(r.items)}
  const create=async(e)=>{e.preventDefault();await api('/api/customers',{method:'POST',body:JSON.stringify({name,phone,email})});setName('');setPhone('');setEmail('');alert('Created')}
  return <div style={{maxWidth:800,margin:'2rem auto'}}>
    <h1>Customers</h1>
    <form onSubmit={search}><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Search by phone"/><button>Search</button></form>
    <ul>{results.map(c=><li key={c.id}>{c.name} — {c.phoneE164||c.phoneRaw}</li>)}</ul>
    <h3>New Customer</h3>
    <form onSubmit={create}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name"/>
      <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone"/>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/>
      <button>Create</button>
    </form>
  </div>
}
