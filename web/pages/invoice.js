import React, { useState } from 'react'
import { api, API_URL } from '../lib/api'

export default function Invoice(){
  const [currency,setCurrency]=useState('INR')
  const [lines,setLines]=useState([ { description:'Room Night', qty:1, rateMinor:500000, taxMinor:90000, taxPct:18 } ])
  const [created,setCreated]=useState(null)

  const addLine=()=> setLines([...lines,{ description:'', qty:1, rateMinor:0, taxMinor:0 }])
  const update=(i,k,v)=>{ const copy=[...lines]; copy[i]={...copy[i],[k]:v}; setLines(copy) }

  const submit=async(e)=>{
    e.preventDefault()
    const r=await api('/api/invoices',{ method:'POST', body: JSON.stringify({ currency, lines }) })
    setCreated(r.invoice)
  }

  return <div style={{maxWidth:900, margin:'2rem auto'}}>
    <h1>Create Invoice</h1>
    <form onSubmit={submit}>
      <div>Currency: <input value={currency} onChange={e=>setCurrency(e.target.value)} /></div>
      <table style={{width:'100%', marginTop:12, background:'#fff'}}>
        <thead><tr><th>Description</th><th>Qty</th><th>Rate (minor)</th><th>Tax (minor)</th></tr></thead>
        <tbody>
          {lines.map((l,i)=>(
            <tr key={i}>
              <td><input value={l.description} onChange={e=>update(i,'description',e.target.value)} /></td>
              <td><input type="number" value={l.qty} onChange={e=>update(i,'qty',parseInt(e.target.value))} /></td>
              <td><input type="number" value={l.rateMinor} onChange={e=>update(i,'rateMinor',parseInt(e.target.value))} /></td>
              <td><input type="number" value={l.taxMinor} onChange={e=>update(i,'taxMinor',parseInt(e.target.value))} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addLine}>+ Add line</button>
      <button type="submit">Create</button>
    </form>
    {created && <div style={{marginTop:16, padding:12, background:'#eef'}}>
      <div>Invoice #{created.number}</div>
      <img alt="QR" src={`${API_URL}/api/invoices/${created.id}/qr.png`} />
      <div><a href={`${API_URL}/verify/${created.id}`} target="_blank" rel="noreferrer">Verify</a></div>
    </div>}
  </div>
}
