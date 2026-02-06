
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MercadoPagoConfig, Payment } from 'npm:mercadopago@2.0.11'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { type, data } = await req.json()

        if (type === 'payment' && data.id) {
            const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN') || ''
            const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

            const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
            const payment = new Payment(mpClient);
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            const paymentInfo = await payment.get({ id: data.id });

            const externalReference = paymentInfo.external_reference;
            const status = paymentInfo.status;

            if (status === 'approved' && externalReference) {
                const { error } = await supabase
                    .from('pedidos')
                    .update({ status: 'Impresso' })
                    .eq('id', externalReference);

                if (error) throw error;
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error: any) {
        console.error("Webhook Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
