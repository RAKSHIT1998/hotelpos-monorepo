export async function getServerSideProps({ req }){
  const host = req.headers.host || ''
  if (host.startsWith('admin.')) return { redirect: { destination: '/admin', permanent: false } }
  return { redirect: { destination: '/login', permanent: false } }
}
export default function Home(){ return null }
