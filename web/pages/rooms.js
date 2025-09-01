import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function Rooms(){
  const [rooms,setRooms]=useState([])
  const [number,setNumber]=useState('')
  const load = async()=>{ const r=await api('/api/rooms'); setRooms(r.rooms) }
  useEffect(()=>{ load() },[])
  const add = async(e)=>{ e.preventDefault(); await api('/api/rooms',{method:'POST', body:JSON.stringify({number})}); setNumber(''); load() }
  const del = async(id)=>{ await api('/api/rooms/'+id,{method:'DELETE'}); load() }
  return <div style={{maxWidth:800, margin:'2rem auto'}}>
    <h1>Rooms</h1>
    <form onSubmit={add} style={{marginBottom:12}}>
      <input value={number} onChange={e=>setNumber(e.target.value)} placeholder="Room number" />
      <button>Add</button>
    </form>
    <ul>
      {rooms.map(r=> <li key={r.id}>{r.number} <button onClick={()=>del(r.id)}>Delete</button></li>)}
    </ul>
  </div>
}
