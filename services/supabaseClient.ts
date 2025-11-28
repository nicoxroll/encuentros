import { createClient } from '@supabase/supabase-js';

// Credentials provided by the user
const supabaseUrl = 'https://fkhcqmffffdcrvgkwkhm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraGNxbWZmZmZkY3J2Z2t3a2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTI3NzgsImV4cCI6MjA3OTkyODc3OH0.FhJ28Sxd_--tecg2X1o2MpGHV6PHYM4sPtSCEvCf6rc';

export const supabase = createClient(supabaseUrl, supabaseKey);
