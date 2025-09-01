import React,{useState} from 'react'
import { api } from '../lib/api'
export default function Login(){
  const [email,setEmail]=useState('owner@hotelpos.in')
  const [password,setPassword]=useState('ChangeMe123!')
  const [msg,setMsg]=useState('')
  const submit=async(e)=>{e.preventDefault();setMsg('');try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});window.location.href='/dashboard'}catch{setMsg('Login failed')}}
  return <div style={{maxWidth:360,margin:'6rem auto',background:'#fff',padding:24,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.06)'}}>
    <h1>Hotel Login</h1>
    <form onSubmit={submit}>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{width:'100%',padding:10,marginBottom:8}}/>
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" style={{width:'100%',padding:10,marginBottom:8}}/>
      <button style={{width:'100%',padding:10,borderRadius:8,border:0,background:'#2563eb',color:'#fff'}}>Sign In</button>
    </form>
    <p>{msg}</p>
  </div>
}
