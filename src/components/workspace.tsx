'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, FileText, FolderOpen, GraduationCap, HelpCircle, History, LayoutGrid, Loader2, LogIn, LogOut, Menu, MessageCircle, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PdfViewer from './pdf-viewer';
import { getSupabase } from '@/lib/supabase';
import { HISTORY_PAGE_SIZE, SIDEBAR_HISTORY_LIMIT, historyPagination } from '@/lib/history';
import type { Conversation, Message, Module, Source, StudyMode } from '@/lib/types';

const samples: Module[] = [
  {id:'demo-basis-data',user_id:'demo',title:'Dasar-dasar Basis Data',file_name:'modul-basis-data.pdf',subject:'Ilmu Komputer',page_count:42,chunk_count:0,status:'ready',storage_path:'',created_at:'2026-10-18',error_message:null},
  {id:'demo-statistika',user_id:'demo',title:'Statistika & Probabilitas',file_name:'statistika.pdf',subject:'Matematika',page_count:36,chunk_count:0,status:'ready',storage_path:'',created_at:'2026-10-17',error_message:null},
  {id:'demo-jaringan',user_id:'demo',title:'Pengantar Jaringan Komputer',file_name:'jaringan.pdf',subject:'Ilmu Komputer',page_count:58,chunk_count:0,status:'ready',storage_path:'',created_at:'2026-10-16',error_message:null}
];
const demoMessage: Message = {id:'demo-answer',role:'assistant',content:'Hai! Ini adalah **pratinjau ruang belajar**.\n\nSetelah kamu masuk dan mengunggah modul sendiri, kita bisa membahas konsep, menguraikan contoh, atau latihan bersama. Setiap jawaban akan merujuk pada potongan materi dari PDF-mu.\n\nMulai dengan pertanyaan yang spesifik, misalnya: “Apa perbedaan primary key dan foreign key?”',sources:[]};
const suggestions=['Jelaskan konsep utama materi ini','Bantu saya memahami dengan contoh','Buat 3 pertanyaan latihan'];
const palettes=['sage','peach','lilac','blue'];
function BookArt() { return <svg viewBox="0 0 300 200" aria-hidden="true" className="book-art"><ellipse cx="157" cy="170" rx="104" ry="15" fill="#d2e1cb"/><g transform="rotate(-12 150 100)"><rect x="76" y="55" width="150" height="109" rx="8" fill="#294c40"/><path d="M74 46 Q112 34 150 52 Q188 34 226 46 V151 Q188 139 150 156 Q112 139 74 151Z" fill="#fafcf4" stroke="#294c40" strokeWidth="3"/><path d="M150 52v104" stroke="#294c40" strokeWidth="2"/><path d="M88 67q24-5 48 4M88 83q24-5 48 4M88 99q24-5 48 4M88 115q24-5 34 1M165 68q22-6 46-4M165 84q22-6 46-4M165 100q22-6 46-4M165 116q22-6 33-5" fill="none" stroke="#bacab0" strokeWidth="4" strokeLinecap="round"/><path d="M184 43v56l10-8 10 4V40" fill="#eaa780"/></g><path d="m50 50 4 10 10 4-10 4-4 10-4-10-10-4 10-4zM248 93l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#58876b"/><circle cx="243" cy="39" r="7" fill="#e0af7a"/><path d="m44 136 7-6m-4 17 8-4" stroke="#729072" strokeWidth="3" strokeLinecap="round"/></svg>; }

export default function Workspace() {
  const [session,setSession]=useState<Session|null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [modules,setModules]=useState<Module[]>([]);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [conversationCount,setConversationCount]=useState(0);
  const [historyRows,setHistoryRows]=useState<Conversation[]>([]);
  const [historyPage,setHistoryPage]=useState(1);
  const [historyPageLoading,setHistoryPageLoading]=useState(false);
  const [historyError,setHistoryError]=useState('');
  const [historyRevision,setHistoryRevision]=useState(0);
  const [loading,setLoading]=useState(false);
  const [nav,setNav]=useState<'library'|'history'>('library');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [selected,setSelected]=useState<Module|null>(null);
  const [conversationId,setConversationId]=useState<string>();
  const [messages,setMessages]=useState<Message[]>([]);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [question,setQuestion]=useState('');
  const [mode,setMode]=useState<StudyMode>('ask');
  const [sending,setSending]=useState(false);
  const [sendStatus,setSendStatus]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState<'login'|'register'|'forgot'|'reset'>('login');
  const [authBusy,setAuthBusy]=useState(false);
  const [authMessage,setAuthMessage]=useState('');
  const [uploadOpen,setUploadOpen]=useState(false);
  const [uploadFile,setUploadFile]=useState<File|null>(null);
  const [uploadTitle,setUploadTitle]=useState('');
  const [subject,setSubject]=useState('');
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState({text:'',percent:0});
  const [uploadError,setUploadError]=useState('');
  const [dragging,setDragging]=useState(false);
  const [helpOpen,setHelpOpen]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState<Module|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [deleteConversationTarget,setDeleteConversationTarget]=useState<Conversation|null>(null);
  const [deletingConversation,setDeletingConversation]=useState(false);
  const [deleteConversationError,setDeleteConversationError]=useState('');
  const [source,setSource]=useState<Source|null>(null);
  const [pdfUrl,setPdfUrl]=useState('');
  const endRef=useRef<HTMLDivElement>(null);
  const requestVersion=useRef(0);
  const authVersion=useRef(0);
  const authUserId=useRef<string|null>(null);
  const sourceVersion=useRef(0);
  const refreshVersion=useRef(0);
  const historyListVersion=useRef(0);
  const modalRef=useRef<HTMLDivElement>(null);
  const anyModal=authOpen||uploadOpen||helpOpen||Boolean(deleteTarget)||Boolean(deleteConversationTarget)||Boolean(source);
  const isDemo=!session;
  const shownModules=isDemo?samples:modules;
  const readyCount=shownModules.filter(m=>m.status==='ready').length;
  const name=session?.user.user_metadata?.display_name || session?.user.email?.split('@')[0] || 'teman belajar';
  const pagination=historyPagination(historyPage,conversationCount);

  const refresh=useCallback(async()=>{
    const userId=authUserId.current,generation=authVersion.current;
    if(!userId)return;
    const version=++refreshVersion.current;
    const db=getSupabase();
    const [{data: mods,error: modsError},{data: chats,error: chatsError,count}]=await Promise.all([
      db.from('modules').select('*').eq('user_id',userId).order('created_at',{ascending:false}),
      db.from('conversations').select('*',{count:'exact'}).eq('user_id',userId)
        .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(SIDEBAR_HISTORY_LIMIT)
    ]);
    if(generation!==authVersion.current||userId!==authUserId.current||version!==refreshVersion.current)return;
    if(modsError||chatsError) throw new Error('Data belum dapat dimuat. Periksa koneksi lalu muat ulang.');
    setModules(mods||[]);setConversations(chats||[]);setConversationCount(count||0);
    setHistoryRevision(value=>value+1);
  },[]);

  useEffect(()=>{
    let active=true;
    try {
      const db=getSupabase();
      const applySession=(value:Session|null)=>{
        const userId=value?.user.id||null;
        if(userId!==authUserId.current){authVersion.current++;requestVersion.current++;authUserId.current=userId;}
        setSession(value);setAuthReady(true);
      };
      db.auth.getSession().then(({data})=>{if(active)applySession(data.session);});
      const {data:{subscription}}=db.auth.onAuthStateChange((event,value)=>{
        if(!active)return;
        applySession(value);
        if(event==='PASSWORD_RECOVERY'){setAuthMode('reset');setAuthOpen(true);}
      });
      return ()=>{active=false;subscription.unsubscribe();};
    }catch(e){setError(e instanceof Error?e.message:'Konfigurasi belum tersedia.');setAuthReady(true);}
  },[]);
  useEffect(()=>{
    setError('');setNotice('');setSidebarOpen(false);
    requestVersion.current++;sourceVersion.current++;setSource(null);setPdfUrl('');setHistoryLoading(false);setSending(false);setSendStatus('');
    setSelected(null);setMessages([]);setConversationId(undefined);setModules([]);setConversations([]);
    historyListVersion.current++;refreshVersion.current++;
    setHistoryRows([]);setHistoryPage(1);setConversationCount(0);setHistoryError('');setHistoryPageLoading(false);
    setDeleteConversationTarget(null);setDeletingConversation(false);setDeleteConversationError('');
    const generation=authVersion.current;
    if(session){setLoading(true);refresh().catch(e=>{if(generation===authVersion.current)setError(e.message);}).finally(()=>{if(generation===authVersion.current)setLoading(false);});}
    else setLoading(false);
  },[session?.user.id,refresh]);
  useEffect(()=>{
    if(!session||nav!=='history'||selected)return;
    const userId=session.user.id,generation=authVersion.current,version=++historyListVersion.current;
    let active=true;
    setHistoryPageLoading(true);setHistoryError('');
    // Do not clamp against a possibly stale count before the server returns it.
    const from=(historyPage-1)*HISTORY_PAGE_SIZE;
    void (async()=>{
      try{
        const {data,error,count,status}=await getSupabase().from('conversations').select('*',{count:'exact'})
          .eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false})
          .range(from,from+HISTORY_PAGE_SIZE-1);
        if(!active||generation!==authVersion.current||version!==historyListVersion.current)return;
        if(error&&(status===416||error.code==='PGRST103')){
          const latest=await getSupabase().from('conversations').select('id',{count:'exact',head:true}).eq('user_id',userId);
          if(!active||generation!==authVersion.current||version!==historyListVersion.current)return;
          if(latest.error)throw latest.error;
          const corrected=historyPagination(historyPage,latest.count||0);
          setConversationCount(latest.count||0);setHistoryRows([]);
          if(corrected.page===historyPage&&latest.count)throw error;
          setHistoryPage(corrected.page);return;
        }
        if(error)throw error;
        const current=historyPagination(historyPage,count||0);
        setConversationCount(count||0);
        if(current.page!==historyPage){setHistoryRows([]);setHistoryPage(current.page);return;}
        setHistoryRows(data||[]);
      }catch{if(active&&generation===authVersion.current&&version===historyListVersion.current)setHistoryError('Riwayat belum dapat dimuat. Periksa koneksi lalu coba lagi.');}
      finally{if(active&&generation===authVersion.current&&version===historyListVersion.current)setHistoryPageLoading(false);}
    })();
    return()=>{active=false;};
  },[session?.user.id,nav,selected,historyPage,historyRevision]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,sending]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!uploading)return;const before=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[uploading]);
  useEffect(()=>{
    if(!anyModal)return;
    const previous=document.activeElement as HTMLElement|null;
    const timer=setTimeout(()=>modalRef.current?.querySelector<HTMLElement>('input, button, select')?.focus(),30);
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!uploading&&!authBusy&&!deleting&&!deletingConversation){setAuthOpen(false);setUploadOpen(false);setHelpOpen(false);setSource(null);setDeleteTarget(null);setDeleteConversationTarget(null);}
      if(event.key==='Tab'){
        const items=modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href], textarea');
        if(!items?.length)return;
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{clearTimeout(timer);document.removeEventListener('keydown',key);previous?.focus();};
  },[anyModal,uploading,authBusy,deleting,deletingConversation]);

  function showLogin(){setAuthMode('login');setAuthMessage('');setAuthOpen(true);}
  function showUpload(){if(!session){showLogin();return;}setUploadFile(null);setUploadTitle('');setSubject('');setUploadError('');setProgress({text:'',percent:0});setUploadOpen(true);}
  async function authenticate(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setAuthBusy(true);setAuthMessage('');
    const form=new FormData(event.currentTarget),email=String(form.get('email')||'').trim(),password=String(form.get('password')||'');
    try{
      const db=getSupabase();
      if(authMode==='register'){
        const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:String(form.get('name')||'').trim()},emailRedirectTo:location.origin}});
        if(error)throw error;
        if(data.session){setAuthOpen(false);setNotice('Akun berhasil dibuat. Unggah modul pertamamu!');}
        else setAuthMessage('Periksa email untuk mengonfirmasi akun, lalu kembali ke sini untuk masuk.');
      }else if(authMode==='forgot'){
        const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)throw error;
        setAuthMessage('Jika email terdaftar, tautan penggantian kata sandi akan dikirim.');
      }else if(authMode==='reset'){
        const {error}=await db.auth.updateUser({password});if(error)throw error;setAuthOpen(false);setNotice('Kata sandi berhasil diperbarui.');
      }else{
        const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;setAuthOpen(false);
      }
    }catch(e){setAuthMessage(e instanceof Error?e.message:'Gagal masuk. Silakan coba lagi.');}
    finally{setAuthBusy(false);}
  }
  function chooseFile(file?:File){if(!file)return;setUploadFile(file);setUploadTitle(file.name.replace(/\.pdf$/i,'').replace(/[_-]/g,' '));setUploadError('');}
  async function upload(event:FormEvent){
    event.preventDefault();if(!uploadFile||!session)return;setUploading(true);setUploadError('');
    try{
      const {uploadModule}=await import('@/lib/ingest');
      await uploadModule(uploadFile,uploadTitle,subject,session.user.id,(text,percent)=>setProgress({text,percent}));
      await refresh();setUploadOpen(false);setNotice('Modul siap! Buka modul untuk mulai belajar.');
    }catch(e){setUploadError(e instanceof Error?e.message:'Upload gagal.');await refresh().catch(()=>{});}
    finally{setUploading(false);}
  }
  async function retry(module:Module){
    setUploadOpen(true);setUploading(true);setUploadError('');setUploadFile(null);setUploadTitle(module.title);setProgress({text:'Mengambil PDF…',percent:5});
    try{
      const db=getSupabase();const {data,error}=await db.storage.from('modules').download(module.storage_path);if(error||!data)throw new Error('PDF belum dapat diunduh.');
      const {error:updateError}=await db.from('modules').update({status:'processing',error_message:null}).eq('id',module.id);if(updateError)throw updateError;
      const {processModule}=await import('@/lib/ingest');await processModule(module,data,(text,percent)=>setProgress({text,percent}));
      await refresh();setUploadOpen(false);setNotice('Modul berhasil diproses ulang.');
    }catch(e){setUploadError(e instanceof Error?e.message:'Pemrosesan gagal.');await refresh().catch(()=>{});}
    finally{setUploading(false);}
  }
  async function removeModule(){
    if(!deleteTarget)return;setDeleting(true);
    try{
      const db=getSupabase();const {error:storageError}=await db.storage.from('modules').remove([deleteTarget.storage_path]);if(storageError)throw storageError;
      const {error}=await db.from('modules').delete().eq('id',deleteTarget.id);if(error)throw error;
      setDeleteTarget(null);if(selected?.id===deleteTarget.id)setSelected(null);await refresh();setNotice('Modul dan percakapannya dihapus.');
    }catch{setError('Modul belum dapat dihapus. Silakan coba lagi.');}
    finally{setDeleting(false);}
  }
  async function removeConversation(){
    if(!deleteConversationTarget||deletingConversation||!authUserId.current)return;
    const target=deleteConversationTarget,userId=authUserId.current,generation=authVersion.current;
    setDeletingConversation(true);setDeleteConversationError('');
    try{
      const {data:deleted,error}=await getSupabase().from('conversations').delete().eq('id',target.id).eq('user_id',userId).select('id');
      if(generation!==authVersion.current)return;
      if(error)throw error;
      historyListVersion.current++;refreshVersion.current++;
      setHistoryRows(rows=>rows.filter(chat=>chat.id!==target.id));
      setConversations(rows=>rows.filter(chat=>chat.id!==target.id));
      if(deleted?.length)setConversationCount(count=>Math.max(0,count-1));
      if(conversationId===target.id){requestVersion.current++;setConversationId(undefined);setMessages([]);setQuestion('');setHistoryLoading(false);}
      setDeleteConversationTarget(null);setHistoryRevision(value=>value+1);
      setNotice('Percakapan dan pesan-pesannya berhasil dihapus.');
      void refresh().catch(()=>{if(generation===authVersion.current)setNotice('Percakapan dihapus. Muat ulang untuk memperbarui daftar terbaru.');});
    }catch{if(generation===authVersion.current)setDeleteConversationError('Percakapan belum dapat dihapus. Silakan coba lagi.');}
    finally{if(generation===authVersion.current)setDeletingConversation(false);}
  }
  async function openModule(module:Module,chatId?:string){
    if(module.status!=='ready'){await retry(module);return;}
    const version=++requestVersion.current;
    setHistoryLoading(Boolean(chatId&&!isDemo));
    setSelected(module);setSidebarOpen(false);setConversationId(chatId);setQuestion('');setError('');setMessages(isDemo?[demoMessage]:[]);
    if(chatId&&!isDemo){
      try{
        const {data,error}=await getSupabase().from('messages').select('id,role,content,sources,created_at').eq('conversation_id',chatId).order('created_at');
        if(version!==requestVersion.current)return;
        if(error)setError('Percakapan gagal dimuat.');else setMessages(data as Message[]||[]);
      }catch{if(version===requestVersion.current)setError('Percakapan gagal dimuat.');}
      finally{if(version===requestVersion.current)setHistoryLoading(false);}
    }
  }
  async function ask(event?:FormEvent,text?:string){
    event?.preventDefault();const query=(text||question).trim();if(!query||sending||historyLoading||!selected)return;
    if(!session){showLogin();return;}
    const generation=authVersion.current;
    setSending(true);setSendStatus('Mencari bagian modul yang relevan…');setError('');setQuestion('');
    const temporaryId=crypto.randomUUID();setMessages(previous=>[...previous,{id:temporaryId,role:'user',content:query,sources:[]}]);
    try{
      const {embed}=await import('@/lib/embeddings');
      const lastQuestion=messages.filter(m=>m.role==='user').at(-1)?.content;
      const retrievalQuery=lastQuestion&&query.length<100?`${lastQuestion.slice(0,350)}\n${query}`:query;
      const [embedding]=await embed([retrievalQuery],'query',text=>{if(generation===authVersion.current)setSendStatus(text);});
      if(generation!==authVersion.current)return;
      setSendStatus('Menyusun penjelasan dari modulmu…');
      const {data:{session:current}}=await getSupabase().auth.getSession();
      if(generation!==authVersion.current)return;
      if(!current)throw new Error('Sesi berakhir. Silakan masuk kembali.');
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${current.access_token}`},body:JSON.stringify({moduleId:selected.id,conversationId,question:query,embedding,mode})});
      const result=await response.json();
      if(generation!==authVersion.current)return;
      if(response.status===401){await getSupabase().auth.signOut({scope:'local'});showLogin();}
      if(!response.ok)throw new Error(result.error||'Jawaban gagal dimuat.');
      setConversationId(result.conversationId);setMessages(previous=>[...previous,result.message]);
      void refresh().catch(()=>{if(generation===authVersion.current)setNotice('Jawaban tersimpan. Daftar riwayat akan diperbarui saat halaman dimuat ulang.');});
    }catch(e){if(generation===authVersion.current){setMessages(previous=>previous.filter(m=>m.id!==temporaryId));setQuestion(query);setError(e instanceof Error?e.message:'Jawaban gagal dimuat.');}}
    finally{if(generation===authVersion.current){setSending(false);setSendStatus('');}}
  }
  async function openSource(item:Source){
    if(!selected)return;const version=++sourceVersion.current;setSource(item);setPdfUrl('');
    const {data,error}=await getSupabase().storage.from('modules').createSignedUrl(selected.storage_path,600);
    if(version!==sourceVersion.current)return;
    if(error)setError('PDF belum dapat dibuka.');else setPdfUrl(`${data.signedUrl}#page=${item.page}`);
  }
  function goLibrary(next:'library'|'history') {if(sending)return;requestVersion.current++;setHistoryLoading(false);setNav(next);setSelected(null);setSidebarOpen(false);setError('');}
  function newConversation(){requestVersion.current++;setHistoryLoading(false);setMessages(isDemo?[demoMessage]:[]);setConversationId(undefined);setError('');}

  return <div className="app-shell">
    {sidebarOpen&&<button className="sidebar-overlay" aria-label="Tutup navigasi" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen?'is-open':''}`}>
      <div className="sidebar-scroll">
      <button className="brand" onClick={()=>goLibrary('library')}><span className="brand-mark"><BookOpen size={23}/></span><span>modul<span className="brand-light">mate</span><sup>✦</sup></span></button>
      <div className="workspace-label">RUANG BELAJAR</div>
      <nav aria-label="Navigasi utama">
        <button className={!selected&&nav==='library'?'nav-item active':'nav-item'} onClick={()=>goLibrary('library')}><LayoutGrid size={19}/>Modul saya<span className="nav-count">{shownModules.length}</span></button>
        <button className={!selected&&nav==='history'?'nav-item active':'nav-item'} onClick={()=>goLibrary('history')}><History size={19}/>Riwayat belajar</button>
      </nav>
      <div className="sidebar-divider"/>
      <div className="workspace-label recent-label">PERCAKAPAN TERAKHIR</div>
      <div className="recent-chats">{conversations.slice(0,SIDEBAR_HISTORY_LIMIT).map(chat=><button key={chat.id} disabled={sending} onClick={()=>{const module=modules.find(m=>m.id===chat.module_id);if(module)void openModule(module,chat.id);}}><MessageCircle size={15}/><span>{chat.title}</span></button>)}{!conversations.length&&<p>Percakapan belajarmu akan<br/>tersimpan di sini.</p>}{conversationCount>SIDEBAR_HISTORY_LIMIT&&<button className="all-history-link" disabled={sending} onClick={()=>{setHistoryPage(1);goLibrary('history');}}>Lihat semua riwayat <ChevronRight size={14}/></button>}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="little-note"><span className="note-spark">✧</span><p>Satu pertanyaan,<br/><strong>selangkah lebih paham.</strong></p><span className="note-line"/></div>
        <button className="nav-item help-link" onClick={()=>setHelpOpen(true)}><HelpCircle size={18}/>Panduan belajar<ChevronRight size={15}/></button>
        <div className="profile"><div className="avatar">{session?String(name).slice(0,1).toUpperCase():<GraduationCap size={19}/>}</div><div><strong>{session?name:'Ruang belajarmu'}</strong><span>{session?'Akun pribadi':'Mulai perjalananmu'}</span></div><button className="icon-button" aria-label={session?'Keluar akun':'Masuk akun'} disabled={sending||uploading} onClick={()=>session?void getSupabase().auth.signOut():showLogin()}>{session?<LogOut size={17}/>:<LogIn size={17}/>}</button></div>
      </div>
    </aside>

    <main className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Buka navigasi" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button><span>Ruang belajar</span><ChevronRight size={14}/><strong>{selected?'Belajar bersama':nav==='history'?'Riwayat belajar':'Modul saya'}</strong></div><div className="topbar-right"><span className="private-label"><ShieldCheck size={14}/>Ruang pribadi</span>{!session&&<button className="button small dark" onClick={showLogin}>Masuk <ArrowUp size={13} className="arrow-diagonal"/></button>}{session&&<span className="top-avatar">{String(name).slice(0,1).toUpperCase()}</span>}</div></header>
      {notice&&<div className={`toast ${nav==='history'&&!selected?'history-toast':''}`} role="status"><CheckCircle2 size={17}/>{notice}<button aria-label="Tutup pemberitahuan" className="icon-button" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {!selected?<div className="page-content">
        {isDemo&&<div className="demo-banner"><span><span className="status-dot"/>Pratinjau dengan data contoh. Masuk untuk mengunggah dan mempelajari modulmu.</span><button onClick={showLogin}>Mulai gratis <ArrowRight size={14}/></button></div>}
        <div className="page-heading"><div><div className="eyebrow">BELAJAR DENGAN CARA KAMU</div><h1>{nav==='history'?'Jejak belajarmu.':<>Halo, {name}<span className="greeting-star">✳</span></>}</h1><p>{nav==='history'?'Kembali ke pertanyaan yang membawamu lebih paham.':'Materimu, pertanyaanmu, pemahaman baru. Mulai dari sini.'}</p></div>{nav==='library'&&<button className="button dark upload-top" onClick={showUpload}><Plus size={18}/>Unggah modul</button>}</div>
        {nav==='library'?<>
          <section className="hero-card"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={13}/>TEMAN BELAJAR BERBASIS AI</span><h2>Dari sekadar membaca,<br/>jadi benar-benar paham.</h2><p>Unggah modul, tanyakan yang belum jelas,<br className="desktop-break"/> dan temukan jawaban langsung dari materimu.</p><button className="text-button" onClick={showUpload}>Mulai dengan sebuah modul <ArrowRight size={17}/></button></div><BookArt/></section>
          <div className="stats"><div className="stat"><span className="stat-icon"><FolderOpen size={19}/></span><div><strong>{shownModules.length.toString().padStart(2,'0')}</strong><span>Modul tersimpan</span></div></div><div className="stat"><span className="stat-icon peach"><BookOpen size={19}/></span><div><strong>{readyCount.toString().padStart(2,'0')}</strong><span>Siap dipelajari</span></div></div><div className="stat"><span className="stat-icon lilac"><MessageCircle size={19}/></span><div><strong>{conversationCount.toString().padStart(2,'0')}</strong><span>Percakapan belajar</span></div></div></div>
          <section className="library"><div className="section-heading"><h2>Perpustakaan modul <span>{shownModules.length}</span></h2><label className="search-box"><Search size={16}/><input aria-label="Cari modul" placeholder="Cari modulmu…" value={search} onChange={e=>setSearch(e.target.value)}/><span>⌕</span></label></div>
            <div className="filter-row">{[['all','Semua modul'],['ready','Siap dipelajari'],['pending','Perlu diproses']].map(([value,label])=><button key={value} className={filter===value?'filter active':'filter'} onClick={()=>setFilter(value)}>{label}</button>)}<span className="sort-label">Terbaru lebih dulu <ArrowDown size={12}/></span></div>
            {loading?<div className="empty-state"><Loader2 className="spin"/><p>Memuat perpustakaanmu…</p></div>:<div className="module-grid">{shownModules.filter(m=>(filter==='all'||(filter==='ready'?m.status==='ready':m.status!=='ready'))&&`${m.title} ${m.subject}`.toLowerCase().includes(search.toLowerCase())).map((module,index)=><article className={`module-card ${palettes[index%palettes.length]}`} key={module.id}>
              <div className="module-cover"><span className="module-subject">{module.subject}</span><span className="cover-monogram">{module.subject==='Matematika'?'∑':index%2===0?'{ }':'↗'}</span><div className="cover-rings"/><BookOpen className="cover-book" size={40} strokeWidth={1.2}/></div>
              <div className="module-body"><div className="file-type"><FileText size={12}/>PDF<span>•</span>{module.page_count?`${module.page_count} halaman`:'Belum selesai'}{!isDemo&&<button className="icon-button delete-card" aria-label={`Hapus ${module.title}`} onClick={()=>setDeleteTarget(module)}><Trash2 size={14}/></button>}</div><h3>{module.title}</h3><div className="module-meta"><span className={`module-status ${module.status==='ready'?'':'pending'}`}><span className="status-dot"/>{module.status==='ready'?'Siap dipelajari':module.status==='error'?'Perlu dicoba ulang':'Belum selesai'}</span>{isDemo&&<span className="sample-tag">Contoh</span>}</div>{module.error_message&&<p className="card-error">{module.error_message}</p>}<button className="module-open" onClick={()=>void openModule(module)}>{module.status==='ready'?'Mulai belajar':'Lanjutkan pemrosesan'}<ArrowRight size={16}/></button></div>
            </article>)}<button className="add-card" onClick={showUpload}><span className="add-circle"><Plus size={23}/></span><strong>Tambah pengetahuan baru</strong><p>Unggah modul berikutnya<br/>dan mulai eksplorasi.</p><span className="add-label">PDF hingga 15 MB</span></button></div>}
            {!loading&&search&&!shownModules.some(m=>`${m.title} ${m.subject}`.toLowerCase().includes(search.toLowerCase()))&&<p className="no-results">Tidak ada modul yang cocok dengan “{search}”.</p>}
          </section>
          <div className="bottom-hint"><span><ShieldCheck size={15}/>Modulmu hanya bisa diakses oleh akunmu.</span><span>Dibuat untuk rasa ingin tahu <span className="tiny-star">✦</span></span></div>
        </>:<section className="history-list" aria-label="Daftar riwayat percakapan" aria-busy={historyPageLoading}>
          {historyError?<div className="error-box history-error" role="alert">{historyError}<button onClick={()=>setHistoryRevision(value=>value+1)}>Coba lagi</button></div>:historyPageLoading?<div className="empty-state" role="status"><Loader2 className="spin"/><p>Memuat riwayat belajarmu…</p></div>:historyRows.length?historyRows.map(chat=><div className="history-row" key={chat.id}>
            <button className="history-open" onClick={()=>{const module=modules.find(m=>m.id===chat.module_id);if(module)void openModule(module,chat.id);}}><span className="stat-icon"><MessageCircle size={20}/></span><div><strong>{chat.title}</strong><span>{modules.find(m=>m.id===chat.module_id)?.title} · {new Date(chat.created_at).toLocaleDateString('id-ID')}</span></div><ArrowRight size={18}/></button>
            <button className="history-delete" aria-label={`Hapus percakapan ${chat.title}`} title="Hapus percakapan" onClick={()=>{setDeleteConversationError('');setDeleteConversationTarget(chat);}}><Trash2 size={17}/></button>
          </div>):<div className="empty-state"><History size={36} strokeWidth={1.4}/><h2>Setiap pertanyaan punya tempat.</h2><p>Mulai percakapan dari salah satu modul.<br/>Kamu bisa melanjutkannya kapan saja di sini.</p><button className="button dark" onClick={()=>goLibrary('library')}>Buka perpustakaan <ArrowRight size={16}/></button></div>}
          {!historyError&&conversationCount>0&&<nav className="history-pagination" aria-label="Pagination riwayat percakapan">
            <span className="history-page-summary">{pagination.start}–{pagination.end} dari {conversationCount} percakapan · {HISTORY_PAGE_SIZE} per halaman</span>
            <div className="history-page-controls">
              <button disabled={historyPageLoading||pagination.page<=1} onClick={()=>setHistoryPage(page=>page-1)} aria-label="Halaman riwayat sebelumnya"><ArrowLeft size={14}/>Sebelumnya</button>
              {pagination.buttons.map((page,index)=>page==='gap'?<span key={`gap-${index}`} aria-hidden="true">…</span>:<button key={page} disabled={historyPageLoading} aria-current={page===pagination.page?'page':undefined} aria-label={`Halaman riwayat ${page}`} onClick={()=>setHistoryPage(page)}>{page}</button>)}
              <button disabled={historyPageLoading||pagination.page>=pagination.pageCount} onClick={()=>setHistoryPage(page=>page+1)} aria-label="Halaman riwayat berikutnya">Berikutnya<ArrowRight size={14}/></button>
            </div>
          </nav>}
        </section>}
        {error&&<div className="error-box" role="alert">{error}<button onClick={()=>{setError('');void refresh().catch(e=>setError(e.message));}}>Coba lagi</button></div>}
      </div>:<div className="study-layout">
        <section className="chat-panel"><div className="chat-heading"><button className="icon-button" aria-label="Kembali ke perpustakaan" disabled={sending} onClick={()=>goLibrary('library')}><ArrowLeft size={19}/></button><div><h1>{selected.title}</h1><span><span className="status-dot"/>{isDemo?'Pratinjau ruang belajar':`${selected.page_count} halaman · Materi siap dipelajari`}</span></div><button className="button small outline" disabled={sending} onClick={newConversation}>Percakapan baru <Plus size={14}/></button></div>
          <div className="messages">{historyLoading&&<div className="thinking" role="status"><Loader2 size={16} className="spin"/>Memuat percakapan…</div>}{!messages.length&&!historyLoading&&<div className="chat-welcome"><span className="welcome-icon"><Sparkles size={29}/></span><div className="eyebrow">RUANG UNTUK RASA INGIN TAHU</div><h2>Mau memahami apa hari ini?</h2><p>Kita pelajari <strong>{selected.title}</strong> bersama.<br/>Mulai dari satu pertanyaan kecil.</p><div className="suggestions">{suggestions.map((text,i)=><button key={text} onClick={()=>void ask(undefined,text)}><span>0{i+1}</span>{text}<ArrowUp size={15} className="arrow-diagonal"/></button>)}</div></div>}
            {messages.map(message=><article key={message.id} className={`message ${message.role}`}><span className="message-avatar">{message.role==='assistant'?<Sparkles size={17}/>:String(name).slice(0,1).toUpperCase()}</span><div className="message-main"><div className="message-label">{message.role==='assistant'?'ModulMate':'Kamu'}{message.role==='assistant'&&<span>TEMAN BELAJAR</span>}</div><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({children})=><span>{children}</span>,img:()=>null}}>{message.content}</ReactMarkdown></div>{message.sources?.length>0&&<div className="message-sources"><span>SUMBER MATERI</span><div>{message.sources.map(s=><button key={s.id} onClick={()=>void openSource(s)}><FileText size={13}/>[{s.id}] Halaman {s.page}<ArrowUp size={12} className="arrow-diagonal"/></button>)}</div></div>}</div></article>)}
            {sending&&<div className="thinking" role="status"><span className="message-avatar"><Sparkles size={17}/></span><Loader2 size={15} className="spin"/>{sendStatus}</div>}<div ref={endRef}/>
          </div>
          <div className="composer-area">{error&&<div className="error-box" role="alert">{error}</div>}<div className="mode-picker"><span>Cara belajar</span>{[['ask','Tanya jawab'],['simple','Lebih sederhana'],['tutor','Bimbing saya']].map(([value,label])=><button key={value} disabled={sending} className={mode===value?'active':''} onClick={()=>setMode(value as StudyMode)}>{label}</button>)}</div><form className="composer" onSubmit={ask}><textarea aria-label="Pertanyaan tentang modul" placeholder="Tanyakan sesuatu dari modulmu…" rows={2} maxLength={2000} value={question} disabled={sending||historyLoading} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask();}}}/><div><span><FileText size={13}/>{selected.file_name}</span><button type="submit" aria-label="Kirim pertanyaan" disabled={sending||historyLoading||!question.trim()}>{sending?<Loader2 size={18} className="spin"/>:<ArrowUp size={20}/>}</button></div></form><p className="composer-note">Jawaban AI bisa keliru. Buka sumber halaman untuk memeriksanya.</p></div>
        </section><aside className="study-aside"><div className="study-doc-icon"><BookOpen size={30}/></div><span className="eyebrow">MODUL AKTIF</span><h2>{selected.title}</h2><p>{selected.subject}</p><div className="study-facts"><span><FileText size={15}/>Format PDF</span><span><BookOpen size={15}/>{selected.page_count} halaman</span><span><CheckCircle2 size={15}/>Siap dipelajari</span></div><div className="study-tip"><Sparkles size={18}/><h3>Belajar sedikit, pahami lebih.</h3><p>Coba sebutkan istilah atau topik yang spesifik. Kamu juga bisa meminta contoh dan petunjuk bertahap.</p></div><button className="text-button" onClick={()=>setHelpOpen(true)}>Bagaimana cara kerjanya? <ArrowRight size={15}/></button></aside>
      </div>}
    </main>

    {anyModal&&<div className="modal-backdrop"><div className={`modal ${source?'source-modal':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef}>
      {authOpen&&<><button className="modal-close icon-button" aria-label="Tutup" disabled={authBusy} onClick={()=>setAuthOpen(false)}><X size={20}/></button><span className="modal-icon"><BookOpen size={25}/></span><span className="eyebrow">SELAMAT DATANG DI MODULMATE</span><h2 id="modal-title">{authMode==='login'?'Kembali ke rasa ingin tahu.':authMode==='register'?'Ruang belajar, milikmu.':authMode==='forgot'?'Atur ulang kata sandi.':'Buat kata sandi baru.'}</h2><p className="modal-description">{authMode==='register'?'Simpan modul dan lanjutkan belajar kapan saja.':'Satu tempat untuk materi dan pertanyaanmu.'}</p><form onSubmit={authenticate} className="form">{authMode==='register'&&<label>Nama<input name="name" required maxLength={50} placeholder="Nama panggilanmu" autoComplete="given-name"/></label>}{authMode!=='reset'&&<label>Email<input name="email" type="email" required placeholder="nama@email.com" autoComplete="email"/></label>}{authMode!=='forgot'&&<label>Kata sandi<input name="password" type="password" required minLength={8} placeholder="Minimal 8 karakter" autoComplete={authMode==='login'?'current-password':'new-password'}/></label>}{authMessage&&<div className="form-message" role="status">{authMessage}</div>}<button className="button dark full" disabled={authBusy}>{authBusy?<Loader2 size={17} className="spin"/>:null}{authMode==='login'?'Masuk ke ruang belajar':authMode==='register'?'Buat akun':authMode==='forgot'?'Kirim tautan':'Simpan kata sandi'}<ArrowRight size={17}/></button></form>{authMode==='login'&&<button className="auth-link" onClick={()=>{setAuthMode('forgot');setAuthMessage('');}}>Lupa kata sandi?</button>}{authMode!=='reset'&&<div className="auth-switch">{authMode==='register'?'Sudah punya akun?':'Belum punya akun?'} <button onClick={()=>{setAuthMode(authMode==='register'?'login':'register');setAuthMessage('');}}>{authMode==='register'?'Masuk':'Daftar sekarang'}</button></div>}</>}
      {uploadOpen&&<><button className="modal-close icon-button" aria-label="Tutup" disabled={uploading} onClick={()=>setUploadOpen(false)}><X size={20}/></button><span className="modal-icon"><UploadCloud size={26}/></span><span className="eyebrow">TAMBAH PENGETAHUAN BARU</span><h2 id="modal-title">Bawa materimu ke sini.</h2><p className="modal-description">PDF berbasis teks, maksimal 15 MB dan 150 halaman.</p>{uploading?<div className="upload-progress" role="status"><Loader2 size={32} className="spin"/><h3>Menyiapkan ruang belajarmu</h3><p>{progress.text}</p><progress max={100} value={progress.percent}/><span>Biarkan halaman tetap terbuka sampai selesai.<br/>Unduhan mesin pencarian pertama lebih lama.</span></div>:<form onSubmit={upload} className="form"><label className={`dropzone ${dragging?'dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);chooseFile(e.dataTransfer.files[0]);}}><input type="file" accept="application/pdf,.pdf" aria-label="Pilih file PDF" onChange={e=>chooseFile(e.target.files?.[0])}/><span>{uploadFile?<FileText size={29}/>:<UploadCloud size={29}/>}</span><strong>{uploadFile?uploadFile.name:'Klik atau tarik PDF ke sini'}</strong><small>{uploadFile?`${(uploadFile.size/1024/1024).toFixed(1)} MB · klik untuk mengganti`:'Gunakan PDF yang teksnya dapat diseleksi'}</small></label><label>Judul modul<input value={uploadTitle} required maxLength={160} onChange={e=>setUploadTitle(e.target.value)} placeholder="Misalnya, Dasar-dasar Basis Data"/></label><label>Mata pelajaran <span className="optional">opsional</span><input value={subject} maxLength={60} onChange={e=>setSubject(e.target.value)} placeholder="Misalnya, Ilmu Komputer"/></label>{uploadError&&<div className="error-box" role="alert">{uploadError}</div>}<button className="button dark full" disabled={!uploadFile||!uploadTitle.trim()}>Unggah & siapkan modul <ArrowRight size={17}/></button><p className="form-footnote"><ShieldCheck size={13}/>File tersimpan privat di akunmu.</p></form>}</>}
      {helpOpen&&<><button className="modal-close icon-button" aria-label="Tutup" onClick={()=>setHelpOpen(false)}><X size={20}/></button><span className="modal-icon"><Sparkles size={25}/></span><h2 id="modal-title">Mulai dari satu pertanyaan.</h2><div className="help-steps"><div><span>01</span><p><strong>Unggah materi</strong>Pilih PDF yang teksnya bisa diseleksi. Foto atau hasil pindai belum didukung.</p></div><div><span>02</span><p><strong>Tunggu hingga siap</strong>Browser menyiapkan pencarian materi. Jangan tutup halaman saat pemrosesan; jika terputus, gunakan “Lanjutkan pemrosesan”.</p></div><div><span>03</span><p><strong>Tanya, pahami, periksa</strong>Gunakan mode tutor atau minta contoh. Klik sumber untuk membuka halaman PDF dan memeriksa jawaban.</p></div></div><div className="privacy-note"><ShieldCheck size={18}/><p>Modul hanya dapat diakses akunmu. Saat bertanya, potongan materi yang relevan dan riwayat singkat dikirim ke Groq untuk menyusun jawaban. Batas penggunaan: 8 pertanyaan per menit dan 100 per hari.</p></div><button className="button dark full" onClick={()=>setHelpOpen(false)}>Siap belajar <Check size={17}/></button></>}
      {deleteTarget&&<><button className="modal-close icon-button" aria-label="Tutup" disabled={deleting} onClick={()=>setDeleteTarget(null)}><X size={20}/></button><span className="modal-icon peach"><Trash2 size={25}/></span><h2 id="modal-title">Hapus modul ini?</h2><p className="modal-description">“{deleteTarget.title}”, PDF, dan semua percakapannya akan dihapus dari akunmu.</p><div className="modal-actions"><button className="button outline" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Simpan modul</button><button className="button danger" disabled={deleting} onClick={()=>void removeModule()}>{deleting?<Loader2 size={16} className="spin"/>:<Trash2 size={16}/>}Hapus modul</button></div></>}
      {deleteConversationTarget&&<><button className="modal-close icon-button" aria-label="Tutup" disabled={deletingConversation} onClick={()=>setDeleteConversationTarget(null)}><X size={20}/></button><span className="modal-icon peach"><Trash2 size={25}/></span><h2 id="modal-title">Hapus percakapan ini?</h2><p className="modal-description">“{deleteConversationTarget.title}” dan semua pesan di dalamnya akan dihapus permanen. Modul PDF tetap tersimpan.</p>{deleteConversationError&&<div className="error-box" role="alert">{deleteConversationError}</div>}<div className="modal-actions"><button className="button outline" disabled={deletingConversation} onClick={()=>setDeleteConversationTarget(null)}>Batal</button><button className="button danger" disabled={deletingConversation} onClick={()=>void removeConversation()}>{deletingConversation?<Loader2 size={16} className="spin"/>:<Trash2 size={16}/>}Hapus percakapan</button></div></>}
      {source&&<><button className="modal-close icon-button" aria-label="Tutup sumber" onClick={()=>{sourceVersion.current++;setSource(null);}}><X size={20}/></button><span className="eyebrow">SUMBER [{source.id}]</span><h2 id="modal-title">Halaman {source.page}</h2><p className="source-title">{selected?.title}</p><blockquote className="source-excerpt">{source.content}</blockquote>{pdfUrl?<><a className="text-button" href={pdfUrl} target="_blank" rel="noreferrer">Buka PDF di tab baru <ArrowUp size={14} className="arrow-diagonal"/></a><PdfViewer key={source.chunkId} url={pdfUrl} initialPage={source.page}/></>:<p className="loading-text"><Loader2 size={16} className="spin"/>Menyiapkan PDF…</p>}</>}
    </div></div>}
    {!authReady&&<div className="initial-loading" aria-live="polite"><Loader2 size={16} className="spin"/>Menyiapkan ruang belajar…</div>}
  </div>;
}


