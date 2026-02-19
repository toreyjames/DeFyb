import "@supabase/functions-js/edge-runtime.d.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, contact_name, contact_email, specialty, provider_count, pain_points } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'DeFyb <onboarding@resend.dev>',
        to: ['torey@defyb.org'],
        subject: `New Lead: ${name}`,
        html: `
          <h2>New Practice Intake</h2>
          <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Practice</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Contact</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${contact_name}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${contact_email}">${contact_email}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Specialty</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${specialty || 'Not specified'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Providers</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${provider_count || 'Not specified'}</td></tr>
            <tr><td style="padding: 8px;"><strong>Pain Points</strong></td><td style="padding: 8px;">${pain_points?.join(', ') || 'None selected'}</td></tr>
          </table>
          <br>
          <p style="color: #666;">View in Supabase dashboard for full details.</p>
        `,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
