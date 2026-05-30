// Supabase Client Initialization Module

const supabaseUrl = 'https://tfhsiiymzehbqaauwcxr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmaHNpaXltemVoYnFhYXV3Y3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjMxNjUsImV4cCI6MjA5NTM5OTE2NX0.79m5Dd3Quom1srOLeayi_2x5Vx46UrjNiRTnofILnw4';

// Use the global supabase client loaded via CDN script
export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
