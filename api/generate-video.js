// Contenuto per: api/generate-video.js

// Questo è il nostro "meccanico" che lavora al sicuro sul server di Vercel.

export default async function handler(request, response) {
  // Per sicurezza, controlliamo che ci stiano chiedendo di fare qualcosa nel modo giusto (con il metodo POST)
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Metodo non consentito. Usa POST.' });
  }

  // Il meccanico prende le chiavi segrete dalla sua cassetta degli attrezzi sicura (le Environment Variables di Vercel)
  const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
  const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;

  // Se le chiavi non sono state impostate su Vercel, ci fermiamo per sicurezza.
  if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    return response.status(500).json({ message: 'Le chiavi API di Kling non sono state configurate correttamente sul server.' });
  }

  try {
    // Prendiamo il 'prompt' (la descrizione della scena) che la nostra app nel browser ci ha inviato
    const { prompt } = request.body;

    if (!prompt) {
      return response.status(400).json({ message: 'Nessun prompt fornito per generare il video.' });
    }

    // Qui proviamo a fare la chiamata a Kling.
    // L'autenticazione 'Bearer' è un'ipotesi comune e potrebbe funzionare.
    // Se Kling richiede una "firma" speciale, questo punto andrà modificato seguendo la loro documentazione.
    const endpoint = 'https://api-singapore.klingai.com/v1/videos/generations';

    const klingResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KLING_SECRET_KEY}`, // La nostra ipotesi di autenticazione
      },
      body: JSON.stringify({
        prompt: prompt,
      }),
    });

    // Prendiamo la risposta da Kling
    const data = await klingResponse.json();

    // Se Kling ci ha dato un errore, lo comunichiamo al browser
    if (!klingResponse.ok) {
      console.error('Errore ricevuto da Kling:', data);
      return response.status(klingResponse.status).json({ message: 'Kling ha restituito un errore.', details: data });
    }

    // Se tutto è andato bene, inviamo la risposta di Kling (che contiene l'URL del video) al nostro browser
    return response.status(200).json(data);

  } catch (error) {
    // Se c'è stato un problema imprevisto nel nostro "meccanico"
    console.error('Errore imprevisto nel proxy:', error);
    return response.status(500).json({ message: 'C\'è stato un errore interno nel nostro server proxy.' });
  }
}