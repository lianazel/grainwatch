// ============================================================
// GRAINWATCH — Vercel Serverless Function : proxy GDELT v2
// ============================================================
// Contournement CORS : l'API GDELT n'envoie pas d'en-tête
// Access-Control-Allow-Origin, donc le navigateur bloque tout
// fetch() direct. Le navigateur appelle /api/gdelt (même origine),
// cette fonction relaie côté serveur (pas de CORS serveur→serveur).
// GrainWatch v0.9.1 — C9. Première brique non statique du projet.

// Hôte/chemin GDELT figés ici : aucun paramètre client ne peut
// changer la cible → pas de SSRF, le proxy ne peut joindre QUE GDELT.
const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";

// Pass-through strictement limité — aucun autre paramètre n'est relayé.
const ALLOWED_PARAMS = ["query", "mode", "maxrecords", "format", "timespan"];

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const params = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const value = req.query[key];
    if (value === undefined) continue;
    // req.query[key] peut être un tableau si le paramètre est répété → on
    // ne garde que la 1re valeur pour rester sur une chaîne propre.
    params.set(key, Array.isArray(value) ? value[0] : value);
  }

  if (!params.has("query")) {
    res.status(400).json({ error: "Missing required parameter: query" });
    return;
  }
  if (params.get("query").length > 500) {
    res.status(400).json({ error: "Query too long (max 500 chars)" });
    return;
  }

  // Valeurs par défaut sûres si le client ne les fournit pas.
  if (!params.has("format")) params.set("format", "json");
  if (!params.has("mode")) params.set("mode", "artlist");
  if (!params.has("maxrecords")) params.set("maxrecords", "8");

  const gdeltUrl = `${GDELT_ENDPOINT}?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // latence Vercel↔GDELT > 10s en prod (C9-bis)
  try {
    const response = await fetch(gdeltUrl, { signal: controller.signal });
    clearTimeout(timeout);

    // Parsing défensif (même logique que news.js C8) : GDELT renvoie ses
    // erreurs (syntaxe, rate limit) en texte brut avec un HTTP 200.
    const bodyText = await response.text();
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseError) {
      console.warn("[GDELT Proxy] Réponse non-JSON:", bodyText.substring(0, 200));
      res.status(502).json({
        error: "GDELT returned non-JSON response",
        detail: bodyText.substring(0, 200),
      });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    // Cache CDN Vercel 15 min : sert les requêtes identiques sans rappeler
    // GDELT → absorbe le rate limit GDELT (1 req/5s) sans cache custom.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === "AbortError") {
      res.status(504).json({ error: "GDELT request timeout (25s)" });
    } else {
      console.error("[GDELT Proxy] Erreur:", error.message || error);
      res.status(502).json({ error: "Failed to fetch from GDELT" });
    }
  }
};
