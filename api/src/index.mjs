import 'dotenv/config'
import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import nacl from 'tweetnacl'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { DateTime } from 'luxon'
import { normalizePhone, sum } from './util.mjs'
import { isValidGSTIN, isValidVAT } from './validate.mjs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const prisma = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const ROOT_ADMIN_KEY = process.env.ROOT_ADMIN_KEY || 'dev-admin'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`

const seedHex = process.env.SIGN_SEED_HEX || '0'.repeat(64)
const seed = Buffer.from(seedHex, 'hex')
const kp = nacl.sign.keyPair.fromSeed(seed)
const PUBKEY_ID = 'ed25519-1'

const s3 = process.env.S3_BUCKET ? new S3Client({ region: process.env.AWS_REGION }) : null
const S3_BUCKET = process.env.S3_BUCKET || null
const S3_PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL || (S3_BUCKET && process.env.AWS_REGION ? `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com` : null)

app.use(morgan('tiny'))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

function signToken(payload){ return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }) }
function requireAuth(req,res,next){
  const h = req.headers.authorization
  const token = (h && h.startsWith('Bearer ')) ? h.slice(7) : (req.cookies.auth_token || null)
  if(!token) return res.status(401).json({ ok:false, error:'unauthorized' })
  try{
    const p = jwt.verify(token, JWT_SECRET)
    req.user = p; req.tenantId = p.tid; req.role = p.role
    next()
  }catch{ return res.status(401).json({ ok:false, error:'invalid_token' }) }
}
function requireAdmin(req,res,next){ if(req.role!=='ADMIN') return res.status(403).json({ ok:false }); next() }

app.get('/health', (_req,res)=> res.json({ ok:true, pubKeyId: PUBKEY_ID }))

app.post('/api/admin/issue-tenant', async (req,res)=>{
  const key = req.headers['x-admin-key']
  if(key !== ROOT_ADMIN_KEY) return res.status(401).json({ ok:false, error:'unauthorized' })
  const { name, email, baseCurrency='INR' } = req.body || {}
  if(!name || !email) return res.status(400).json({ ok:false, error:'missing_fields' })
  const tenant = await prisma.tenant.create({ data:{ name, baseCurrency } })
  const tempPass = crypto.randomBytes(6).toString('base64url')
  const passHash = await bcrypt.hash(tempPass, 10)
  const user = await prisma.user.create({ data:{ tenantId: tenant.id, email, role:'ADMIN', passHash, name: email.split('@')[0] } })
  const sub = await prisma.subscription.create({ data:{ tenantId: tenant.id, startedAt: new Date(), expiresAt: DateTime.now().plus({ days:365 }).toJSDate() } })
  await prisma.otaProvider.upsert({ where:{ id:'bookingcom' }, update:{}, create:{ id:'bookingcom', name:'Booking.com' } })
  await prisma.otaProvider.upsert({ where:{ id:'expedia' }, update:{}, create:{ id:'expedia', name:'Expedia' } })
  res.json({ ok:true, tenant, admin:{ email, tempPassword: tempPass }, subscription: sub })
})

app.post('/api/auth/login', async (req,res)=>{
  const { email, password } = req.body || {}
  const user = await prisma.user.findUnique({ where:{ email }})
  if(!user) return res.status(401).json({ ok:false })
  const ok = await bcrypt.compare(String(password||''), user.passHash)
  if(!ok) return res.status(401).json({ ok:false })
  const token = signToken({ uid:user.id, tid:user.tenantId, role:user.role, email:user.email })
  res.cookie('auth_token', token, { httpOnly:true, sameSite:'lax', secure: true, maxAge: 7*864e5 })
  res.json({ ok:true, token })
})

app.get('/api/tenant/profile', requireAuth, async (req,res)=>{
  const p = await prisma.tenantProfile.findUnique({ where:{ tenantId: req.tenantId }})
  res.json({ ok:true, profile:p })
})
app.post('/api/tenant/profile', requireAuth, requireAdmin, async (req,res)=>{
  const allowed = ["legalName","address1","address2","city","state","postal","country","phone","email","website","gstin","vatNumber","logoUrl","brandColor"]
  const data = {}; for(const k of allowed) if(k in req.body) data[k]=req.body[k]
  const country = (data.country || 'IN').toUpperCase()
  if(data.gstin && !isValidGSTIN(data.gstin)) return res.status(400).json({ ok:false, error:'invalid_gstin_format' })
  if(data.vatNumber && !isValidVAT(country, data.vatNumber)) return res.status(400).json({ ok:false, error:`invalid_vat_format_${country}` })
  const p = await prisma.tenantProfile.upsert({ where:{ tenantId:req.tenantId }, update:data, create:{ tenantId:req.tenantId, ...data }})
  res.json({ ok:true, profile:p })
})

app.post('/api/uploads/presign', requireAuth, requireAdmin, async (req,res)=>{
  if(!s3 || !S3_BUCKET || !S3_PUBLIC_BASE) return res.status(503).json({ ok:false, error:'s3_not_configured' })
  const { folder='logos', filename='file', contentType='application/octet-stream' } = req.body || {}
  const safe = String(filename).replace(/[^\w.\-]/g, '_')
  const key = `${folder}/${req.tenantId}/${Date.now()}-${safe}`
  const put = new PutObjectCommand({ Bucket:S3_BUCKET, Key:key, ContentType:contentType, ACL:"private" })
  const uploadUrl = await getSignedUrl(s3, put, { expiresIn:60 })
  const publicUrl = `${S3_PUBLIC_BASE}/${key}`
  res.json({ ok:true, uploadUrl, publicUrl, key })
})

app.get('/api/rooms', requireAuth, async (req,res)=>{
  const rooms = await prisma.room.findMany({ where:{ tenantId:req.tenantId }, orderBy:{ number:'asc' }})
  res.json({ ok:true, rooms })
})
app.post('/api/rooms', requireAuth, requireAdmin, async (req,res)=>{
  const { number, type } = req.body || {}
  if(!number) return res.status(400).json({ ok:false, error:'number_required' })
  const r = await prisma.room.create({ data:{ tenantId:req.tenantId, number:String(number), type:type||null } })
  res.json({ ok:true, room:r })
})
app.delete('/api/rooms/:id', requireAuth, requireAdmin, async (req,res)=>{
  const now = DateTime.now().toJSDate()
  const future = await prisma.reservation.findFirst({ where:{ tenantId:req.tenantId, roomId:req.params.id, startDate: { gte: now }}})
  if(future) return res.status(400).json({ ok:false, error:'room_has_future_reservations' })
  await prisma.room.delete({ where:{ id:req.params.id }})
  res.json({ ok:true })
})

app.get('/api/customers', requireAuth, async (req,res)=>{
  const { phone } = req.query
  if(!phone) return res.json({ ok:true, items:[] })
  const norm = normalizePhone(String(phone))
  const items = await prisma.customer.findMany({ where:{ tenantId:req.tenantId, OR:[ { phoneE164: norm.e164 }, { phoneRaw: String(phone) } ]}})
  res.json({ ok:true, items })
})
app.post('/api/customers', requireAuth, async (req,res)=>{
  const { name, phone, email } = req.body || {}
  if(!name) return res.status(400).json({ ok:false, error:'name_required' })
  const norm = normalizePhone(phone)
  const c = await prisma.customer.create({ data:{ tenantId:req.tenantId, name, phoneRaw:norm.raw, phoneE164:norm.e164, email:email||null }})
  res.json({ ok:true, customer:c })
})

app.get('/api/rate-plans', requireAuth, async (req,res)=>{
  const items = await prisma.ratePlan.findMany({ where:{ tenantId:req.tenantId }, orderBy:{ name:'asc' }})
  res.json({ ok:true, items })
})
app.post('/api/rate-plans', requireAuth, requireAdmin, async (req,res)=>{
  const { id, code, name, currency, baseMinor=0 } = req.body || {}
  if(!code || !name || !currency) return res.status(400).json({ ok:false, error:'missing_fields' })
  const data = { tenantId:req.tenantId, code, name, currency, baseMinor: parseInt(baseMinor||0,10) }
  const row = id ? await prisma.ratePlan.update({ where:{ id }, data }) : await prisma.ratePlan.create({ data })
  res.json({ ok:true, ratePlan: row })
})

function serializeInvoice(inv, lines){
  const body = {
    id: inv.id, number: inv.number, createdAt: inv.createdAt.toISOString(),
    currency: inv.currency, reportingCurrency: inv.reportingCurrency, fxRate: inv.fxRate?.toString() || null,
    subtotalMinor: inv.subtotalMinor, taxTotalMinor: inv.taxTotalMinor, grandTotalMinor: inv.grandTotalMinor,
    lines: lines.map(l=>({ description:l.description, qty:l.qty, rateMinor:l.rateMinor, taxPct:l.taxPct, taxMinor:l.taxMinor, lineTotalMinor:l.lineTotalMinor, hsnSac:l.hsnSac||null }))
  }
  return JSON.stringify(body)
}
app.post('/api/invoices', requireAuth, async (req,res)=>{
  const { customerId=null, currency, reportingCurrency=null, fxRate=null, lines=[] } = req.body || {}
  if(!currency || !Array.isArray(lines) || !lines.length) return res.status(400).json({ ok:false, error:'missing_fields' })
  const subtotal = sum(lines.map(l=> parseInt(l.qty||0,10) * parseInt(l.rateMinor||0,10) ))
  const taxTotal = sum(lines.map(l=> parseInt(l.taxMinor||0,10) ))
  const grand = subtotal + taxTotal
  const last = await prisma.invoice.findFirst({ where:{ tenantId:req.tenantId }, orderBy:{ createdAt:'desc' }})
  const nextNum = last ? Number(last.number || '0') + 1 : 1
  const inv = await prisma.invoice.create({ data:{
    tenantId:req.tenantId, customerId, number: String(nextNum), currency, reportingCurrency, fxRate,
    subtotalMinor: subtotal, taxTotalMinor: taxTotal, grandTotalMinor: grand, signedPayload:'', signature:'', pubKeyId: PUBKEY_ID
  }})
  const createdLines = await prisma.$transaction(lines.map(l=> prisma.invoiceLine.create({ data:{
    invoiceId: inv.id, description:String(l.description||''), qty: parseInt(l.qty||0,10), rateMinor: parseInt(l.rateMinor||0,10),
    taxPct: l.taxPct==null? null : parseInt(l.taxPct,10), taxMinor: parseInt(l.taxMinor||0,10),
    lineTotalMinor: parseInt(l.lineTotalMinor|| (parseInt(l.qty||0,10)*parseInt(l.rateMinor||0,10)+parseInt(l.taxMinor||0,10)),10),
    taxCode: l.taxCode || null, hsnSac: l.hsnSac || null
  }})))
  const payload = serializeInvoice(inv, createdLines)
  const sig = nacl.sign.detached(new TextEncoder().encode(payload), kp.secretKey)
  const signatureB64 = Buffer.from(sig).toString('base64')
  const saved = await prisma.invoice.update({ where:{ id:inv.id }, data:{ signedPayload: payload, signature: signatureB64 }})
  res.json({ ok:true, invoice: { ...saved, lines: createdLines } })
})
app.get('/api/invoices/:id', requireAuth, async (req,res)=>{
  const inv = await prisma.invoice.findFirst({ where:{ id:req.params.id, tenantId:req.tenantId }, include:{ lines:true } })
  if(!inv) return res.status(404).json({ ok:false })
  res.json({ ok:true, invoice: inv })
})
app.get('/api/invoices/:id/qr.png', requireAuth, async (req,res)=>{
  const inv = await prisma.invoice.findFirst({ where:{ id:req.params.id, tenantId:req.tenantId }})
  if(!inv) return res.status(404).end()
  const url = `${PUBLIC_BASE_URL}/verify/${inv.id}`
  res.setHeader('content-type','image/png')
  const png = await QRCode.toBuffer(url, { margin: 1, width: 256 })
  res.end(png)
})
app.get('/verify/:id', async (req,res)=>{
  const inv = await prisma.invoice.findUnique({ where:{ id:req.params.id }, include:{ lines:true } })
  if(!inv) return res.status(404).json({ ok:false })
  const ok = nacl.sign.detached.verify(new TextEncoder().encode(inv.signedPayload), Buffer.from(inv.signature,'base64'), kp.publicKey)
  res.json({ ok, pubKeyId: inv.pubKeyId, invoiceId: inv.id, number: inv.number })
})
app.get('/verify', async (req,res)=>{
  const { payload, sigB64 } = req.query
  if(!payload || !sigB64) return res.status(400).json({ ok:false })
  const ok = nacl.sign.detached.verify(new TextEncoder().encode(String(payload)), Buffer.from(String(sigB64),'base64'), kp.publicKey)
  res.json({ ok, pubKeyId: PUBKEY_ID })
})

function aesEncrypt(plain, keyHex){
  const key = Buffer.from(keyHex, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

app.get('/api/ota/providers', requireAuth, async (_req,res)=>{
  const items = await prisma.otaProvider.findMany({ orderBy:{ id:'asc' }})
  res.json({ ok:true, items })
})
app.get('/api/ota/credentials', requireAuth, async (req,res)=>{
  const rows = await prisma.otaCredential.findMany({ where:{ tenantId:req.tenantId }, include:{ provider:true }, orderBy:{ createdAt:'desc' } })
  res.json({ ok:true, items: rows.map(r=>({ id:r.id, providerId:r.providerId, providerName:r.provider.name, propertyCode:r.propertyCode, username:r.username, enabled:r.enabled, secretMasked:true, createdAt:r.createdAt })) })
})
app.post('/api/ota/credentials', requireAuth, requireAdmin, async (req,res)=>{
  const { id, providerId, propertyCode, username, secret, enabled=true } = req.body || {}
  if(!providerId || !propertyCode || !secret) return res.status(400).json({ ok:false, error:'missing_fields' })
  const keyHex = process.env.PII_AES_KEY || '0'*64
  const enc = aesEncrypt(String(secret), keyHex)
  const data = { tenantId:req.tenantId, providerId, propertyCode, username: username||null, secretEnc: enc, enabled: !!enabled }
  const row = id ? await prisma.otaCredential.update({ where:{ id }, data }) : await prisma.otaCredential.create({ data })
  res.json({ ok:true, id: row.id })
})
app.delete('/api/ota/credentials/:id', requireAuth, requireAdmin, async (req,res)=>{
  await prisma.otaCredential.delete({ where:{ id:req.params.id }})
  res.json({ ok:true })
})
app.get('/api/ota/mappings', requireAuth, async (req,res)=>{
  const { credentialId, kind } = req.query
  if(!credentialId) return res.status(400).json({ ok:false, error:'credentialId_required' })
  const maps = await prisma.otaMapping.findMany({ where:{ tenantId:req.tenantId, credentialId:String(credentialId), ...(kind?{ kind:String(kind) }:{}) }, orderBy:{ updatedAt:'desc' }})
  res.json({ ok:true, items: maps })
})
app.post('/api/ota/mappings', requireAuth, requireAdmin, async (req,res)=>{
  const { id, credentialId, kind, internalId, providerCode, active=true } = req.body || {}
  if(!credentialId || !kind || !internalId || !providerCode) return res.status(400).json({ ok:false, error:'missing_fields' })
  const data = { tenantId:req.tenantId, credentialId, kind, internalId, providerCode, active }
  const row = id ? await prisma.otaMapping.update({ where:{ id }, data }) : await prisma.otaMapping.create({ data })
  res.json({ ok:true, id: row.id })
})
app.delete('/api/ota/mappings/:id', requireAuth, requireAdmin, async (req,res)=>{
  await prisma.otaMapping.delete({ where:{ id:req.params.id }})
  res.json({ ok:true })
})
app.post('/api/ota/push-ari', requireAuth, async (req,res)=>{
  const { credentialId, rooms=[], ratePlans=[] } = req.body || {}
  if(!credentialId) return res.status(400).json({ ok:false, error:'credentialId_required' })
  const maps = await prisma.otaMapping.findMany({ where:{ tenantId:req.tenantId, credentialId, active:true }})
  const toProvRoom = new Map(maps.filter(m=>m.kind==='ROOM').map(m=>[m.internalId, m.providerCode]))
  const toProvRate = new Map(maps.filter(m=>m.kind==='RATE').map(m=>[m.internalId, m.providerCode]))
  const providerRooms = rooms.map(id=>toProvRoom.get(id)).filter(Boolean)
  const providerRates = ratePlans.map(id=>toProvRate.get(id)).filter(Boolean)
  if(!providerRooms.length || !providerRates.length) return res.status(400).json({ ok:false, error:'missing_mappings' })
  res.json({ ok:true, mapped:{ rooms: providerRooms, rates: providerRates } })
})

app.listen(PORT, ()=> console.log(`API listening on ${PORT}`))
