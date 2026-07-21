import { createClient } from '@supabase/supabase-js'

// Pastikan nilainya dimasukkan ke dalam tanda petik tunggal ('...')
const supabaseUrl = 'https://jtrxkvslmnmvomhwfqbb.supabase.co' 
const supabaseAnonKey = 'sb_publishable_MqF9GXg5e7rSJMsUYO85Ig_iNS3ADod' // Ganti dengan Anon Key panjang kamu

// Di bawah ini jangan diubah bagian teks di dalam kurungnya
export const supabase = createClient(supabaseUrl, supabaseAnonKey)