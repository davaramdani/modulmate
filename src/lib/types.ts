export type Module = {
  id: string; user_id: string; title: string; file_name: string; storage_path: string;
  subject: string; status: 'processing' | 'ready' | 'error'; page_count: number;
  chunk_count: number; created_at: string; error_message: string | null;
};
export type Source = { id: number; chunkId: string; page: number; content: string };
export type Message = { id: string; role: 'user' | 'assistant'; content: string; sources: Source[]; created_at?: string };
export type Conversation = { id: string; module_id: string; title: string; created_at: string };
export type Chunk = { content: string; page: number; chunk_index: number };
export type StudyMode = 'ask' | 'simple' | 'tutor';
