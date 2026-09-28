// E2E de seguridad del piloto (uso: iniciar app en :3100 y `node scripts/pilot-security-e2e.cjs`).
// Crea un alumno temporal, prueba aislamiento/rate limit/logout y lo borra. Lee claves de .pilot-credentials.local.
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const BASE = process.env.BASE || 'http://localhost:3100';
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('pgbouncer','true');
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false}, realtime:{transport:require('ws')} });
const creds = Object.fromEntries(fs.readFileSync('.pilot-credentials.local','utf8').split('\n').filter(l=>l.includes('password=')).map(l=>[l.split(/\s+/)[0], l.match(/password=(\S+)/)[1]]));
let pass=0, fail=0;
const check=(name, ok, extra='')=>{ ok?pass++:fail++; console.log(`${ok?'PASS':'FAIL'} ${name} ${extra}`); };
function jar(){ const c={}; return { set(res){ for (const h of res.headers.getSetCookie?.()||[]) { const [kv]=h.split(';'); const i=kv.indexOf('='); const k=kv.slice(0,i), v=kv.slice(i+1); if(!v) delete c[k]; else c[k]=v; } }, header(){ return Object.entries(c).map(([k,v])=>`${k}=${v}`).join('; ') }, keys(){return Object.keys(c)} }; }
async function req(j, path, opts={}) { const res = await fetch(BASE+path, { redirect:'manual', ...opts, headers: { 'content-type':'application/json', cookie: j?j.header():'', 'x-forwarded-for': opts.ip||'10.0.0.1', ...(opts.headers||{}) } }); j&&j.set(res); let body=null; try{ body=await res.clone().json() }catch{} return { status: res.status, body, res }; }
async function login(email, password, ip) { const j=jar(); const r=await req(j,'/api/auth/login',{method:'POST', body: JSON.stringify({email,password}), ip}); return { j, r }; }
(async()=>{
  const tmpEmail = `pilot-test-${Date.now()}@example.invalid`; const tmpPass = 'Tmp-Test-' + Math.random().toString(36).slice(2) + 'A9';
  let tmpUserId=null, tmpDbId=null;
  try {
    // Setup: segundo alumno temporal en mismo colegio
    const demoAl = await prisma.user.findUnique({ where:{ email:'alumno@colegio.demo' } });
    const { data: au, error } = await admin.auth.admin.createUser({ email: tmpEmail, password: tmpPass, email_confirm: true });
    if (error) throw error; tmpUserId = au.user.id;
    tmpDbId = (await prisma.user.create({ data:{ supabaseId: tmpUserId, email: tmpEmail, fullName:'Test Temporal', role:'ALUMNO', schoolId: demoAl.schoolId } })).id;

    // A) login genérico
    const bad = await login('noexiste@example.invalid','xxxxxxxxxxA1','10.1.1.1');
    const bad2 = await login('alumno@colegio.demo','demo1234','10.1.1.2');
    check('login demo1234 rechazado', bad2.r.status===401);
    check('mensaje genérico igual email inexistente/existente', bad.r.body?.error===bad2.r.body?.error, JSON.stringify(bad.r.body));

    // Login alumno demo (víctima) y temp (atacante)
    const victim = await login('alumno@colegio.demo', creds['alumno@colegio.demo'], '10.2.0.1');
    check('login alumno demo con clave rotada', victim.r.status===200, JSON.stringify(victim.r.body));
    const att = await login(tmpEmail, tmpPass, '10.2.0.2');
    check('login alumno temporal', att.r.status===200);

    // D) aislamiento
    const victimAttempt = await prisma.testAttempt.findFirst({ where:{ studentId: demoAl.id }, include:{ test:true } });
    const cal = await req(att.j,'/api/calificaciones');
    check('calificaciones atacante no incluye intentos de víctima', cal.status===200 && !JSON.stringify(cal.body).includes(demoAl.id), `n=${cal.body?.length}`);
    if (victimAttempt) {
      const ex = await req(att.j, `/api/examenes/${victimAttempt.testId}`);
      const leaks = JSON.stringify(ex.body||{}).includes(victimAttempt.id);
      check('examen: atacante no ve intento de víctima', !leaks, `status=${ex.status}`);
      check('examen: sin correctText/isCorrect para alumno', !/correctText|isCorrect/.test(JSON.stringify(ex.body||{})));
      const gr = await req(att.j, `/api/examenes/${victimAttempt.testId}/calificar`, { method:'POST', body: JSON.stringify({ attemptId: victimAttempt.id, grades: [] }) });
      check('alumno no puede calificar', gr.status===403);
    } else console.log('SKIP: víctima sin intentos');
    const users = await req(att.j,'/api/usuarios');
    check('alumno no puede listar usuarios', users.status===403);
    const asig = await req(att.j,'/api/asignaciones');
    check('alumno no puede ver asignaciones', asig.status===403);
    const sub = await prisma.material.findFirst({ where:{ folder:{ kind:'STUDENT_SUBMISSIONS' }, uploadedById: demoAl.id } });
    if (sub) {
      const f = await req(att.j, `/api/archivos/material/${sub.id}`);
      check('archivo de entrega de otro alumno -> 404', f.status===404, `status=${f.status}`);
      const fv = await req(victim.j, `/api/archivos/material/${sub.id}`);
      check('dueño puede descargar su entrega (302 firmado)', fv.status===302, `status=${fv.status}`);
      const fl = await req(att.j, `/api/materiales?folderId=${sub.folderId}`);
      check('listado carpeta entregas no muestra la de víctima', !JSON.stringify(fl.body||{}).includes(sub.id), `status=${fl.status}`);
      const fd = await req(att.j, `/api/carpetas/${sub.folderId}`);
      check('detalle carpeta no muestra entrega víctima', !JSON.stringify(fd.body||{}).includes(sub.id), `status=${fd.status}`);
    } else console.log('SKIP: víctima sin entregas');
    const anon = await req(null,'/api/calificaciones');
    check('sin sesión -> 401', anon.status===401);

    // Admin crea usuario: clave débil rechazada, generada fuerte
    const ad = await login('admin@colegio.demo', creds['admin@colegio.demo'], '10.3.0.1');
    check('login admin', ad.r.status===200);
    const weak = await req(ad.j,'/api/usuarios',{method:'POST', body: JSON.stringify({ email:`weak-${Date.now()}@example.invalid`, fullName:'W', role:'ALUMNO', password:'demo1234' })});
    check('admin: clave débil rechazada', weak.status===400, weak.body?.error);
    const gen = await req(ad.j,'/api/usuarios',{method:'POST', body: JSON.stringify({ email:`gen-${Date.now()}@example.invalid`, fullName:'Gen Test', role:'ALUMNO' })});
    const tp = gen.body?.temporaryPassword||'';
    check('admin: genera clave temporal fuerte', gen.status===201 && tp.length>=10 && /[A-Z]/.test(tp) && /[a-z]/.test(tp) && /\d/.test(tp));
    if (gen.body?.id) { await admin.auth.admin.deleteUser(gen.body.supabaseId); await prisma.user.delete({ where:{ id: gen.body.id } }); }

    // Logout
    const before = victim.j.keys().filter(k=>k.startsWith('sb-')).length;
    const lo = await req(victim.j,'/api/auth/logout',{method:'POST'});
    const after = victim.j.keys().filter(k=>k.startsWith('sb-')).length;
    check('logout limpia cookies sb-*', lo.status===200 && before>0 && after===0, `before=${before} after=${after}`);
    const me = await req(victim.j,'/api/auth/me');
    check('tras logout /api/auth/me -> 401', me.status===401);

    // C) rate limit: 5 fallos -> 429
    const codes=[];
    for (let i=0;i<7;i++){ const r=await login(tmpEmail,'WrongPass123x','10.9.9.9'); codes.push(r.r.status); }
    check('rate limit: bloquea tras 5 fallos (429)', codes.slice(0,5).every(c=>c===401) && codes[5]===429, codes.join(','));
    const blockedEvenCorrect = await login(tmpEmail,tmpPass,'10.9.9.9');
    check('rate limit: bloqueado aunque clave correcta', blockedEvenCorrect.r.status===429);
  } finally {
    if (tmpDbId) await prisma.user.delete({ where:{ id: tmpDbId } }).catch(()=>{});
    if (tmpUserId) await admin.auth.admin.deleteUser(tmpUserId).catch(()=>{});
    await prisma.$disconnect();
    console.log(`\n${pass} PASS / ${fail} FAIL`);
    process.exitCode = fail?1:0;
  }
})();
