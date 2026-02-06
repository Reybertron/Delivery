
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { MercadoPagoConfig, Preference } from 'npm:mercadopago@2.0.11'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
        const { orderItems, total, deliveryFee, customerInfo } = body;

        const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
        if (!mpToken) {
            return new Response(JSON.stringify({ error: "Token MP_ACCESS_TOKEN não encontrado." }), { status: 400, headers: corsHeaders });
        }

        const client = new MercadoPagoConfig({ accessToken: mpToken });
        const preference = new Preference(client);

        // Simplificação máxima dos itens para evitar erro de validação
        const items = (orderItems || []).map((item: any) => ({
            title: String(item.marmita.name).substring(0, 50),
            unit_price: Number(parseFloat(Number(item.marmita.price || 0).toFixed(2))),
            quantity: Number(item.quantity || 1),
            currency_id: 'BRL'
        }));

        if (Number(deliveryFee) > 0) {
            items.push({
                title: 'Taxa de Entrega',
                unit_price: Number(parseFloat(Number(deliveryFee).toFixed(2))),
                quantity: 1,
                currency_id: 'BRL'
            });
        }

        const result = await preference.create({
            body: {
                items,
                back_urls: {
                    success: `${req.headers.get('origin') || 'http://localhost:3000'}/success`,
                    failure: `${req.headers.get('origin') || 'http://localhost:3000'}/cart`,
                    pending: `${req.headers.get('origin') || 'http://localhost:3000'}/pending`,
                },
                auto_return: 'approved',
                external_reference: `PED-${Date.now()}`
            }
        });

        return new Response(
            JSON.stringify({ init_point: result.init_point, sandbox_point: result.sandbox_init_point, id: result.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({
                error: error.message || "Erro no Mercado Pago",
                details: error.stack || error
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
