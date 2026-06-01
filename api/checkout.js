const Stripe = require('stripe');

// Price IDs validi — whitelist di sicurezza
const ALLOWED_PRICES = {
  'price_1TdSzKE9gcEDgyKRhYvkjDWN': 'subscription', // Piano Base 15€/mese
  'price_1TdSzKE9gcEDgyKRArVXNulj': 'subscription', // Piano Base 9€/mese
  'price_1TdT0NE9gcEDgyKR2H9AEoig': 'subscription', // Piano Pro 29€/mese
  'price_1TdT0qE9gcEDgyKROzM2L5bp': 'subscription', // Piano Pro 49€
};

module.exports = async function handler(req, res) {
  // CORS
  const origin = process.env.SITE_URL || 'https://vetrinasrlpro.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = {};

  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (error) {
    return res.status(400).json({ error: 'Body JSON non valido.' });
  }

  const { priceId } = body;

  // Validazione input — sicurezza OWASP A03
  if (!priceId || typeof priceId !== 'string' || !ALLOWED_PRICES[priceId]) {
    return res.status(400).json({ error: 'Prezzo non valido.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Variabile STRIPE_SECRET_KEY mancante su Vercel.' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const siteUrl = process.env.SITE_URL || 'https://vetrinasrlpro.vercel.app';
    const price = await stripe.prices.retrieve(priceId);

    if (!price || !price.recurring) {
      return res.status(400).json({ error: 'Il prezzo selezionato non e un abbonamento ricorrente.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: ALLOWED_PRICES[priceId],
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/grazie?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#prezzi`,
      locale: 'it',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({
      error: err.message || 'Errore durante la creazione del pagamento.',
      type: err.type || null,
      code: err.code || null,
      requestId: err.requestId || null,
    });
  }
};
