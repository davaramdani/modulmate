import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { selectCitedSources, tutorPrompt } from '@/lib/rag';
import type { Source } from '@/lib/types';
export const runtime = 'nodejs';
export const maxDuration = 60;
const inputSchema = z.object({
  moduleId: z.uuid(), conversationId: z.uuid().optional(),
  question: z.string().trim().min(1).max(2000),
  embedding: z.array(z.number().finite().min(-1).max(1)).length(384)
    .refine(v => v.reduce((sum,x) => sum+x*x,0)>0.1, 'Embedding tidak valid'),
  mode: z.enum(['ask','simple','tutor']).default('ask')
});
const error = (message: string, status: number) => Response.json({ error: message }, { status });
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get('authorization');
    if (!bearer?.startsWith('Bearer ')) return error('Masuk terlebih dahulu untuk belajar.',401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || !process.env.GROQ_API_KEY) return error('Konfigurasi layanan belum lengkap.',503);
    const db = createClient(url, key, { global:{headers:{Authorization:bearer}},auth:{persistSession:false, autoRefreshToken:false} });
    const {data: {user}, error: authError} = await db.auth.getUser(bearer.slice(7));
    if (authError || !user) return error('Sesi berakhir. Silakan masuk kembali.',401);
    if (Number(request.headers.get('content-length') || 0)>40000) return error('Permintaan terlalu besar.',413);
    const raw = await request.text();
    if (raw.length>40000) return error('Permintaan terlalu besar.',413);
    let json: unknown;
    try {json=JSON.parse(raw);} catch {return error('Format permintaan tidak valid.',400);}
    const parsed=inputSchema.safeParse(json);
    if (!parsed.success) return error('Pertanyaan atau data pencarian tidak valid.',400);
    const {moduleId,question,embedding,mode} = parsed.data;
    const {data: module} = await db.from('modules').select('id,title,status').eq('id',moduleId).single();
    if (!module) return error('Modul tidak ditemukan.',404);
    if (module.status!=='ready') return error('Tunggu hingga modul selesai diproses.',409);
    let conversationId=parsed.data.conversationId;
    if (conversationId) {
      const {data: conversation}=await db.from('conversations').select('id').eq('id',conversationId).eq('module_id',moduleId).single();
      if (!conversation) return error('Percakapan tidak ditemukan.',404);
    }
    const {data: allowed,error: quotaError}=await db.rpc('consume_chat_request');
    if (quotaError) return error('Layanan belum siap. Periksa konfigurasi database.',503);
    if (!allowed) return error('Batas belajar tercapai (8 pertanyaan/menit, 100/hari). Coba lagi nanti.',429);
    const {data: matches,error: retrievalError}=await db.rpc('match_module_chunks',{p_module_id:moduleId,query_embedding:embedding,match_count:6});
    if (retrievalError) return error('Pencarian materi gagal. Silakan coba lagi.',503);
    const sources: Source[]=(matches || []).filter((m: {similarity:number}) => m.similarity>=0.65)
      .map((m: {id:string;page:number;content:string},i:number)=>({id:i+1,chunkId:m.id,page:m.page,content:m.content}));
    let history: {role:'user'|'assistant';content:string}[]=[];
    if (conversationId) {
      const {data}=await db.from('messages').select('role,content').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(6);
      history=(data||[]).reverse() as typeof history;
    }
    let answer='Saya belum menemukan informasi yang cukup di modul ini. Coba sebutkan istilah, bab, atau topik yang ingin kamu pelajari.';
    if (sources.length) {
      const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST', headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(45000),
        body:JSON.stringify({model:process.env.GROQ_MODEL || 'openai/gpt-oss-20b',temperature:0.2,max_completion_tokens:3000,
          messages:[{role:'system',content:tutorPrompt(mode)},...history,{role:'user',content:JSON.stringify({module:module.title, sources:sources.map(s=>({id:s.id,page:s.page,text:s.content})),question})}]
        })
      });
      if (!response.ok) return error(response.status===429?'Groq sedang mencapai batas pemakaian. Tunggu sebentar lalu coba lagi.':'Layanan AI belum dapat menjawab. Periksa model dan API key Groq di server.',response.status===429?429:502);
      const result=await response.json();
      const content=result.choices?.[0]?.message?.content;
      if (typeof content!=='string' || !content.trim()) return error('AI belum menghasilkan jawaban. Coba ulangi pertanyaan.',502);
      answer=content.replace(/\[(\d+)\]/g,(match,id)=>sources.some(s=>s.id===Number(id))?match:'').slice(0,18000);
      // Do not present ungrounded generated prose as a sourced answer.
      if (!selectCitedSources(answer,sources).length && !/belum|tidak.*(ditemukan|tersedia|cukup|memuat)/i.test(answer))
        answer='Saya belum bisa memberikan jawaban dengan rujukan yang dapat diperiksa. Coba tanyakan konsep yang lebih spesifik dari modul ini.';
    }
    if (!conversationId) {
      const {data,error: createError}=await db.from('conversations').insert({module_id:moduleId,user_id:user.id,title:question.slice(0,100)}).select('id').single();
      if (createError || !data) return error('Percakapan belum tersimpan. Silakan coba lagi.',503);
      conversationId=data.id;
    }
    const cited=selectCitedSources(answer,sources);
    const now=Date.now();
    const {data: saved,error: saveError}=await db.from('messages').insert([
      {conversation_id:conversationId,user_id:user.id,role:'user',content:question,sources:[],created_at:new Date(now).toISOString()},
      {conversation_id:conversationId,user_id:user.id,role:'assistant',content:answer,sources:cited,created_at:new Date(now+1).toISOString()}
    ]).select('id,role,content,sources');
    if (saveError) return error('Jawaban belum tersimpan. Silakan coba lagi.',503);
    return Response.json({conversationId,message:saved?.find(m=>m.role==='assistant')},{headers:{'Cache-Control':'no-store'}});
  } catch (e) {
    return error(e instanceof Error && e.name==='TimeoutError'?'Jawaban memerlukan terlalu lama. Silakan coba lagi.':'Permintaan gagal. Periksa koneksi lalu coba lagi.',502);
  }
}
