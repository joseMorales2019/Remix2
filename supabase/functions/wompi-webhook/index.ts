// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = 'https://stqthrzbvuqcavtsonba.supabase.co';
    const supabaseKey = 'sb_publishable_wCWbStazCktCFs1_RPAHuA_uQeg3CD5';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();
    // Notificación recibida

    const { ResultadoTransaccion, IdIntentoPago, IdTransaccion, Monto, cliente } = payload;

    // Registro de la transacción en la tabla de historial (Para auditoría)
    await supabase.from('wompi_transactions').insert({
      id_intento_pago: IdIntentoPago,
      id_transaccion: IdTransaccion,
      email_cliente: cliente?.Email,
      monto: Monto,
      resultado: ResultadoTransaccion,
      json_completo: payload
    });

    // Lógica de acreditación de diamantes
    if (ResultadoTransaccion === 'ExitosaAprobada' && IdIntentoPago === '2000ec42-757d-4cdc-be80-92ad4be6914b') {
      
      const userEmail = cliente?.Email;
      
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "Email no encontrado" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const { data: profiles, error: findError } = await supabase
        .from('profiles')
        .select('id, store_diamonds')
        .eq('email', userEmail);

      if (findError || !profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ error: "Usuario no existe" }), { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // Sumar 100 diamantes a todos los perfiles asociados a ese correo
      for (const profile of profiles) {
        await supabase
          .from('profiles')
          .update({ store_diamonds: (profile.store_diamonds || 0) + 100 })
          .eq('id', profile.id);
      }

      return new Response(JSON.stringify({ success: true, message: "Acreditación y registro exitoso" }), { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Transacción registrada pero no requiere acreditación de diamantes" }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
})