'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export default function PdfViewer({url,initialPage}:{url:string;initialPage:number}) {
  const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
  const [page,setPage]=useState(initialPage);
  const [width,setWidth]=useState(600);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const container=useRef<HTMLDivElement>(null);
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(!container.current)return;
    const observer=new ResizeObserver(entries=>setWidth(Math.max(100,entries[0].contentRect.width)));
    observer.observe(container.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    let active=true,task:PDFDocumentLoadingTask|undefined;
    setDocument(null);setError('');setBusy(true);
    void (async()=>{
      try{
        const pdfjs=await import('pdfjs-dist');
        if(!active)return;
        pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
        task=pdfjs.getDocument({url:url.split('#')[0],standardFontDataUrl:'/pdf-fonts/',cMapUrl:'/pdf-cmaps/',cMapPacked:true,wasmUrl:'/pdf-wasm/'});
        const pdf=await task.promise;
        if(active){setPage(Math.min(Math.max(initialPage,1),pdf.numPages));setDocument(pdf);}
      }catch{if(active){setError('Halaman PDF belum dapat dimuat. Gunakan tautan PDF di atas atau coba buka sumber kembali.');setBusy(false);}}
    })();
    return()=>{active=false;void task?.destroy();};
  },[url,initialPage]);
  useEffect(()=>{
    if(!document||!canvas.current)return;
    let active=true,task:RenderTask|undefined;
    setBusy(true);setError('');
    void (async()=>{
      try{
        const pdfPage=await document.getPage(page);
        if(!active||!canvas.current)return;
        const base=pdfPage.getViewport({scale:1});
        const scale=Math.max((width-24)/base.width,0.1)*Math.min(window.devicePixelRatio||1,2);
        const viewport=pdfPage.getViewport({scale});
        const surface=canvas.current;
        surface.width=Math.floor(viewport.width);surface.height=Math.floor(viewport.height);
        task=pdfPage.render({canvas:surface,viewport});await task.promise;
        if(active)setBusy(false);
      }catch{if(active){setError('Halaman PDF belum dapat ditampilkan. Coba tautan PDF di atas.');setBusy(false);}}
    })();
    return()=>{active=false;task?.cancel();};
  },[document,page,width]);
  return <section className="pdf-reader" aria-label="Pembaca PDF">
    <div className="pdf-controls"><button className="icon-button" aria-label="Halaman sebelumnya" disabled={!document||page<=1||busy} onClick={()=>setPage(p=>p-1)}><ArrowLeft size={15}/></button><span>Halaman {page}{document?` dari ${document.numPages}`:''}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={!document||page>=(document?.numPages||1)||busy} onClick={()=>setPage(p=>p+1)}><ArrowRight size={15}/></button></div>
    <div className="pdf-surface" ref={container}>{busy&&<div className="pdf-loading" role="status"><Loader2 size={18} className="spin"/>Memuat halaman PDF…</div>}{error&&<p className="error-box" role="alert">{error}</p>}<canvas ref={canvas} role="img" aria-label={`Halaman ${page} dokumen PDF`} style={{visibility:busy||error?'hidden':'visible'}}/></div>
  </section>;
}
