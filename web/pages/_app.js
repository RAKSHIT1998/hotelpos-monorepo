import React from 'react'
export default function MyApp({ Component, pageProps }) {
  return <div style={{ fontFamily: 'Inter, system-ui, Arial', background:'#f7fafc', minHeight:'100vh' }}>
    <Component {...pageProps} />
  </div>
}
