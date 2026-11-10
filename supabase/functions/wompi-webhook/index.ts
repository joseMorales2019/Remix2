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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://stqthrzbvuqcavtsonba.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable_wCWbStazCktCFs1_RPAHuA_uQeg3CD5';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();

    const { 
      ResultadoTransaccion, 
      IdIntentoPago, 
      IdTransaccion, 
      Monto, 
      Moneda, 
      FechaTransaccion, 
      EsProductiva, 
      Referencia, 
      cliente 
    } = payload;

    const userEmail = cliente?.Email || cliente?.EMail || payload?.email_cliente || null;
    const userDui = cliente?.DocumentoIdentidad || null;

    // 1. Registrar la transacción en wompi_transacciones_exitosas
    try {
      await supabase.from('wompi_transacciones_exitosas').insert({
        id_transaccion: IdTransaccion ? Number(IdTransaccion) : null,
        id_intento_pago: IdIntentoPago || null,
        monto: Monto ? Number(Monto) : null,
        moneda: Moneda || 'USD',
        fecha_transaccion: FechaTransaccion ? new Date(FechaTransaccion).toISOString() : new Date().toISOString(),
        resultado_transaccion: ResultadoTransaccion,
        es_productiva: typeof EsProductiva === 'boolean' ? EsProductiva : false,
        referencia: Referencia || null,
        email_cliente: userEmail,
        payload_completo: payload
      });
    } catch (insertErr) {
      console.warn("Aviso al registrar en wompi_transacciones_exitosas:", insertErr);
    }

    // Registro secundario de respaldo en wompi_transactions si la tabla existe
    try {
      await supabase.from('wompi_transactions').insert({
        id_intento_pago: IdIntentoPago,
        id_transaccion: IdTransaccion,
        email_cliente: userEmail,
        monto: Monto,
        resultado: ResultadoTransaccion,
        json_completo: payload
      });
    } catch (_) {
      // Ignorar si no existe tabla antigua
    }

    // 2. Procesar transacciones aprobadas
    if (ResultadoTransaccion === 'ExitosaAprobada') {

      // CASO A: Pago de ruleta para volver a intentar (IdIntentoPago: f292f55a-5a34-4387-bea9-3e5a32effcac)
      if (IdIntentoPago === 'f292f55a-5a34-4387-bea9-3e5a32effcac') {
        let targetProfiles: any[] = [];

        if (userEmail) {
          const { data } = await supabase
            .from('profiles')
            .select('id, store_diamonds, email')
            .eq('email', userEmail);
          if (data && data.length > 0) targetProfiles = data;
        }

        if (targetProfiles.length === 0 && userDui) {
          const { data } = await supabase
            .from('profiles')
            .select('id, store_diamonds, email')
            .eq('dui', userDui);
          if (data && data.length > 0) targetProfiles = data;
        }

        if (targetProfiles.length > 0) {
          for (const profile of targetProfiles) {
            // Habilitar inmediatamente la ruleta rusa (quita el tiempo de espera de 1 hora)
            await supabase.from('user_roulette_status').upsert({
              user_id: profile.id,
              next_available_at: null, // elimina el cooldown de 1 hora
              extra_attempt_available: true, // otorga giro inmediato
              has_used_extra_spin: false,
              updated_at: new Date().toISOString()
            });

            // Opcionalmente acreditar diamantes de cortesía
            await supabase
              .from('profiles')
              .update({ store_diamonds: (profile.store_diamonds || 0) + 4 })
              .eq('id', profile.id);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            message: "Ruleta habilitada exitosamente: tiempo de espera removido e intento otorgado",
            profiles_updated: targetProfiles.length 
          }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Pago de ruleta registrado con éxito. Usuario no vinculado aún por correo o DUI." 
        }), { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // CASO B: Paquete de 100 diamantes de tienda (IdIntentoPago: 2000ec42-757d-4cdc-be80-92ad4be6914b)
      if (IdIntentoPago === '2000ec42-757d-4cdc-be80-92ad4be6914b') {
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

        for (const profile of profiles) {
          await supabase
            .from('profiles')
            .update({ store_diamonds: (profile.store_diamonds || 0) + 100 })
            .eq('id', profile.id);
        }

        return new Response(JSON.stringify({ success: true, message: "Acreditación de 100 diamantes exitosa" }), { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Transacción aprobada registrada exitosamente en wompi_transacciones_exitosas" 
      }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: `Transacción con resultado ${ResultadoTransaccion} registrada para auditoría` 
    }), { 
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