
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { MercadoPagoConfig, Preference } from 'npm:mercadopago@2.0.11'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { orderItems, total, deliveryFee, customerInfo } = await req.json()

        const client = new MercadoPagoConfig({
            accessToken: Deno.env.get('MP_ACCESS_TOKEN') || '',
            options: { timeout: 5000 }
        });

        const preference = new Preference(client);

        const items = orderItems.map((item: any) => ({
            id: item.marmita.id,
            title: item.marmita.name,
            unit_price: Number(item.marmita.price + (item.selectedOptionals || []).reduce((sum: number, opt: any) => sum + opt.precoAdicional, 0)),
            quantity: Number(item.quantity),
            currency_id: 'BRL'
        }));

        if (deliveryFee > 0) {
            items.push({
                id: 'delivery-fee',
                title: 'Taxa de Entrega',
                unit_price: Number(deliveryFee),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        const result = await preference.create({
            body: {
                items,
                payer: {
                    name: customerInfo.name,
                    phone: {
                        area_code: '55',
                        number: customerInfo.phone.replace(/\D/g, '')
                    },
                },
                back_urls: {
                    success: `${req.headers.get('origin')}/success`,
                    failure: `${req.headers.get('origin')}/cart`,
                    pending: `${req.headers.get('origin')}/pending`,
                },
                auto_return: 'approved',
                notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
                external_reference: `PED-${Date.now()}`,
            }
        });

        return new Response(
            JSON.stringify({ init_point: result.init_point, preference_id: result.id }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
