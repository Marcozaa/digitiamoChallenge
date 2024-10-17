const fetch = require("node-fetch");

const express = require("express");

const PORT = process.env.PORT || 3001;
const { db } = require("./firebase.js");
const {
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDoc,
} = require("firebase/firestore");
const generateRequestId = require("./utils/generateRequestId");

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Limite di 100 richieste per IP
  message: "Troppe richieste dal tuo IP, riprova più tardi.",
});

const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());
app.use(limiter);

app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

app.post("/api/HTTP/GET", (req, res) => {
  const url = req.body.url; // Ottieni l'URL dal frontend

  // Inizia il timer per misurare il tempo di caricamento della prima richiesta
  const startTime = Date.now();

  // Fai la prima richiesta HTTP
  fetch(url, { redirect: "manual" }) // Disabilita i redirect automatici
    .then((response) => {
      const statusCode = response.status;
      const headers = [...response.headers];
      const serverInfo = response.headers.get("Server");

      // Fine del timer per la prima richiesta
      const endTime = Date.now();
      const loadTime = endTime - startTime;

      const parsedUrl = new URL(url);
      const scheme = parsedUrl.protocol;
      const host = req.get("host");
      const path = parsedUrl.pathname;
      const statusLine = `${scheme}/1.1 ${res.statusCode}`;

      requestId = generateRequestId(parsedUrl.hostname);

      const firstRequestData = {
        message: "Prima richiesta completata con successo",
        statusCode: statusCode,
        serverInfo: serverInfo,
        headers: headers,
        body: "", // Inizialmente vuoto, sarà riempito con il body se non c'è redirect
        fullUrl: url,
        scheme: scheme,
        host: host,
        path: path,
        loadTime: `${loadTime}`,
        statusLine: statusLine,
        requestId: requestId,
      };
      saveHttpRequest(
        parsedUrl.hostname,
        scheme,
        statusCode,
        loadTime,
        requestId,
        serverInfo,
        path,
        loadTime
      );

      // Se è un redirect (status code 3xx), facciamo una seconda richiesta
      if (statusCode >= 300 && statusCode < 400) {
        const redirectUrl = response.headers.get("Location");

        // Fai la seconda richiesta al nuovo URL di reindirizzamento
        return fetch(redirectUrl).then((redirectResponse) => {
          const redirectStatusCode = redirectResponse.status;
          const redirectHeaders = [...redirectResponse.headers];
          const redirectServerInfo = redirectResponse.headers.get("Server");

          return redirectResponse.text().then((redirectBody) => {
            // Calcoliamo il tempo di caricamento della seconda richiesta
            const redirectEndTime = Date.now();
            const redirectLoadTime = redirectEndTime - endTime;

            const parsedRedirectUrl = new URL(redirectUrl);
            const redirectPath = parsedRedirectUrl.pathname;

            const secondRequestData = {
              message: "Seconda richiesta (redirect) completata con successo",
              statusCode: redirectStatusCode,
              serverInfo: redirectServerInfo,
              headers: redirectHeaders,
              body: redirectBody,
              fullUrl: redirectUrl,
              scheme: parsedRedirectUrl.protocol,
              host: parsedRedirectUrl.hostname,
              path: redirectPath,
              loadTime: `${redirectLoadTime}`,
              statusLine: statusLine,
            };

            // Invia i dati della prima e della seconda richiesta al frontend
            res.json({
              firstRequest: firstRequestData,
              secondRequest: secondRequestData,
            });
          });
        });
      }

      // Se non è un redirect, ritorniamo solo la prima risposta
      return response.text().then((body) => {
        firstRequestData.body = body;
        res.json({
          firstRequest: firstRequestData,
        });
      });
    })
    .catch((error) => {
      console.error("Errore nella richiesta:", error);
      res.status(500).json({ message: "Errore nella richiesta" });
    });
});

app.post("/api/HTTP/POST", (req, res) => {
  const url = req.body.url; // Ottieni l'URL dal frontend

  // Inizia il timer per misurare il tempo di caricamento
  const startTime = Date.now();

  // Fai una richiesta HTTP al link ricevuto
  fetch(url, {
    method: "POST",
  })
    .then((response) => {
      // Definisci sia statusCode che headers qui dentro
      const statusCode = response.status; // Definisco statusCode correttamente
      const headers = [...response.headers]; // Definisco headers correttamente
      const serverInfo = response.headers.get("Server");

      // Verifica se la richiesta ha avuto successo

      return response
        .text()
        .then((body) => ({ statusCode, serverInfo, headers, body }));
    })
    .then(({ statusCode, serverInfo, headers, body }) => {
      if (!statusCode) return; // Prevent execution if statusCode is not set

      // Fine del timer, calcola il tempo di caricamento
      const endTime = Date.now();
      const loadTime = endTime - startTime; // Calcola il tempo di caricamento in millisecondi

      const parsedUrl = new URL(url);
      const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
      const scheme = parsedUrl.protocol; // e.g., 'http' or 'https'
      const host = req.get("host"); // e.g., 'example.com'
      const path = parsedUrl.pathname; // e.g., '/path/to/resource'
      const query = req.query; // Query parameters as an object
      const statusLine = `${scheme}/1.1 ${res.statusCode}`;

      requestId = generateRequestId(parsedUrl.hostname);
      // Invio la risposta analizzata al frontend, incluso il tempo di caricamento
      res.json({
        message: "Analisi completata con successo",
        statusCode: statusCode, // Invia lo status code
        serverInfo: serverInfo, // Invia le informazioni sul server
        headers: headers, // Invia gli headers
        body: body, // Invia il corpo della risposta
        fullUrl: req.body.url,
        scheme: scheme,
        host: host,
        path: path,
        statusLine: statusLine,
        hostname: parsedUrl.hostname,
        loadTime: `${loadTime}`, // Tempo di caricamento in millisecondi
        requestId: requestId,
      });
      saveHttpRequest(
        parsedUrl.hostname,
        scheme,
        statusCode,
        loadTime,
        requestId,
        serverInfo,
        path,
        loadTime
      );
    })
    .catch((error) => {
      console.error("Error in request:", error);
    });
});

const saveHttpRequest = async (
  hostname,
  schema,
  statusCode,
  responseTime,
  requestId,
  serverInfo,
  path,
  loadTime
) => {
  try {
    // Riferimento al documento con ID personalizzato
    const docRef = doc(db, "richieste", requestId);

    await setDoc(docRef, {
      fullUrl: hostname,
      scheme: schema,
      statusCode: statusCode,
      responseTime: responseTime, // Tempo di risposta della richiesta
      date: new Date(), // Data della richiesta
      serverInfo: serverInfo,
      path: path,
      loadTime: loadTime,
    });

    console.log("Richiesta salvata con ID: ", docRef.id);
  } catch (e) {
    console.error("Errore nel salvataggio della richiesta: ", e);
  }
};

app.post("/api/request", async (req, res) => {
  const requestId = req.body.searchedRequest;
  const docRef = doc(db, "richieste", requestId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    res.json({
      message: "Richiesta trovata con successo",
      firstRequest: docSnap.data(), // Mappa direttamente i dati al campo firstRequest
    });
  } else {
    res.json({ message: "Richiesta non trovata" });
  }
});
