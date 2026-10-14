import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('.env에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY를 넣으세요 (.env.example 참고)')

export const supabase = createClient(url, key)
