
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://stqthrzbvuqcavtsonba.supabase.co';
const supabaseKey = 'sb_publishable_wCWbStazCktCFs1_RPAHuA_uQeg3CD5';

export const supabase = createClient(supabaseUrl, supabaseKey);
