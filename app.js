// Contenuto COMPLETO e FINALE per: app.js

const { useState, useEffect } = React;

// Inserisci solo la chiave di Gemini qui. Quella di Kling è al sicuro sul server!
const GEMINI_API_KEY = "AIzaSyBMpJjT0BUs3qutns8acAMHVBTIUMsT9qc";


// Funzione per chiamare l'API di Gemini e generare la sceneggiatura.
// QUESTA FUNZIONE NON CAMBIA.
async function callGeminiAPI(videoDescription) {
  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `
    Sei un esperto sceneggiatore di video. Data la seguente descrizione, crea una sceneggiatura per un breve video.
    Suddividi la sceneggiatura in 3 clip. Ogni clip deve durare 8 secondi.
    Fornisci la risposta esclusivamente in formato JSON, come un array di oggetti.
    Ogni oggetto deve avere le seguenti proprietà: 'id' (un numero progressivo da 1 a 3), 'text' (la descrizione della scena), e 'duration' (impostata a 8).
    Non includere nient'altro nella tua risposta al di fuori del codice JSON.
    Descrizione del video: "${videoDescription}"
  `;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) throw new Error(`Errore API Gemini: ${response.statusText}`);
    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;
    const cleanedJson = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("Errore durante la chiamata a Gemini:", error);
    alert("Si è verificato un errore durante la generazione della sceneggiatura. Controlla la console.");
    return null;
  }
}

// === QUESTA FUNZIONE È STATA MODIFICATA ===
// Ora chiama il nostro proxy sicuro su Vercel, non più Kling direttamente.
async function callKlingAPI(promptText) {
  // Questo è l'indirizzo relativo della nostra funzione sicura.
  // Una volta online, Vercel saprà come raggiungerla.
  const PROXY_ENDPOINT = '/api/generate-video';

  try {
    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Mostriamo l'errore dettagliato che ci arriva dal nostro proxy
      throw new Error(data.message || 'Errore sconosciuto dal proxy');
    }

    // IPOTESI: La risposta contiene l'URL del video.
    // La struttura esatta (es. data.outputs) potrebbe variare.
    return data.video_url || (data.outputs && data.outputs[0].url);

  } catch (error) {
    console.error('Errore chiamando il proxy Kling:', error);
    alert(`Errore nella generazione del video: ${error.message}`);
    return null;
  }
}

// ------ Da qui in poi, il codice è identico a prima, ma lo includo tutto per semplicità ------

function VideoGeneratorApp() {
  const [currentStep, setCurrentStep] = useState(1);
  const [videoDescription, setVideoDescription] = useState("");
  const [scriptClips, setScriptClips] = useState([]);
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [editingClipId, setEditingClipId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState([]);
  const [isScriptLoading, setIsScriptLoading] = useState(false);

  // Genera sceneggiatura con Gemini
  const generateScript = async () => {
    if (!videoDescription.trim() || !GEMINI_API_KEY || GEMINI_API_KEY.includes("INCOLLA_QUI")) {
      alert("Per favore, inserisci una descrizione e la tua chiave API di Gemini.");
      return;
    }
    setIsScriptLoading(true);
    const clips = await callGeminiAPI(videoDescription);
    setIsScriptLoading(false);
    if (clips) {
      setScriptClips(clips.map(c => ({ ...c, approved: false, status: 'pending' })));
      setCurrentStep(2);
    }
  };
  
  // Avvia la generazione video chiamando il nostro proxy
  const startVideoGeneration = () => {
    const approvedClips = scriptClips.filter(clip => clip.approved);
    if (approvedClips.length === 0) {
      alert("Devi approvare almeno una clip!");
      return;
    }

    setCurrentStep(3);
    setGeneratedVideos([]);
    
    const progressItems = approvedClips.map(clip => ({
      clipId: clip.id,
      clipText: clip.text,
      status: 'pending',
    }));
    setGenerationProgress(progressItems);

    approvedClips.forEach(clip => {
      generateSingleVideo(clip);
    });
  };

  const generateSingleVideo = async (clip) => {
    setGenerationProgress(prev => prev.map(item =>
      item.clipId === clip.id ? { ...item, status: 'generating' } : item
    ));
    const videoUrl = await callKlingAPI(clip.text);
    if (videoUrl) {
      setGenerationProgress(prev => prev.map(item =>
        item.clipId === clip.id ? { ...item, status: 'completed' } : item
      ));
      const newVideo = {
        id: Date.now() + clip.id,
        clipId: clip.id,
        clipText: clip.text,
        videoUrl: videoUrl,
        approved: null,
        status: 'reviewing'
      };
      setGeneratedVideos(prev => [...prev, newVideo]);
    } else {
      setGenerationProgress(prev => prev.map(item =>
        item.clipId === clip.id ? { ...item, status: 'error' } : item
      ));
    }
  };

  useEffect(() => {
    const approvedCount = scriptClips.filter(c => c.approved).length;
    if (currentStep === 3 && approvedCount > 0 && generationProgress.length === approvedCount && generationProgress.every(p => p.status === 'completed' || p.status === 'error')) {
      const successfulGenerations = generationProgress.filter(p => p.status === 'completed').length;
      if (successfulGenerations > 0) {
        setTimeout(() => setCurrentStep(4), 1000);
      }
    }
  }, [generationProgress, currentStep, scriptClips]);

  const openEditModal = (clipId) => { setEditingClipId(clipId); setIsModalOpen(true); };
  const closeEditModal = () => { setIsModalOpen(false); setEditingClipId(null); };
  const saveClipChanges = (clipId, newText) => {
    setScriptClips(prev => prev.map(c => c.id === clipId ? { ...c, text: newText } : c));
    closeEditModal();
  };
  const toggleClipApproval = (clipId) => {
    setScriptClips(prev => prev.map(c => c.id === clipId ? { ...c, approved: !c.approved } : c));
  };
  const reviewVideo = (videoId, approved) => {
    setGeneratedVideos(prev => prev.map(v => v.id === videoId ? { ...v, approved, status: approved ? 'approved' : 'rejected' } : v));
  };
  const regenerateVideo = (videoId) => {
    alert("La funzione di rigenerazione non è ancora implementata in questa versione.");
  };
  const proceedToAssembly = () => {
    const approvedVideos = generatedVideos.filter(v => v.approved === true);
    if (approvedVideos.length === 0) {
      alert("Devi approvare almeno un video!");
      return;
    }
    setCurrentStep(5);
  };
  const resetApp = () => {
    setCurrentStep(1);
    setVideoDescription("");
    setScriptClips([]);
    setGeneratedVideos([]);
    setGenerationProgress([]);
  };

  return (
    <div className="video-generator-app">
      <header className="app-header"><div className="container"><h1 className="app-title">Generatore Video AI</h1></div></header>
      <main className="container">
        <ProgressSteps currentStep={currentStep} stepNames={["Descrizione Video", "Revisione Sceneggiatura", "Generazione Video", "Revisione Video", "Assemblaggio Finale"]} />
        <div className="step-content">
          {currentStep === 1 && <VideoDescriptionStep description={videoDescription} setDescription={setVideoDescription} onNext={generateScript} isLoading={isScriptLoading} />}
          {currentStep === 2 && <ScriptReviewStep clips={scriptClips} onEdit={openEditModal} onToggleApproval={toggleClipApproval} onNext={startVideoGeneration} onBack={() => setCurrentStep(1)} />}
          {currentStep === 3 && <VideoGenerationStep progress={generationProgress} />}
          {currentStep === 4 && <VideoReviewStep videos={generatedVideos} onReview={reviewVideo} onRegenerate={regenerateVideo} onNext={proceedToAssembly} onBack={() => setCurrentStep(2)} />}
          {currentStep === 5 && <FinalAssemblyStep videos={generatedVideos.filter(v => v.approved === true)} clips={scriptClips} onReset={resetApp} />}
        </div>
      </main>
      {isModalOpen && <EditClipModal clip={scriptClips.find(c => c.id === editingClipId)} onSave={saveClipChanges} onClose={closeEditModal} />}
    </div>
  );
}

function ProgressSteps({ currentStep, stepNames }) {
  return (<div className="progress-steps">{stepNames.map((name, index) => { const stepNumber = index + 1; const isActive = stepNumber === currentStep; const isCompleted = stepNumber < currentStep; return (<div key={stepNumber} className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}><div className={`step-circle ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>{isCompleted ? '✓' : stepNumber}</div><span>{name}</span></div>); })}</div>);
}

function VideoDescriptionStep({ description, setDescription, onNext, isLoading }) {
  return (<><div className="step-header"><h2 className="step-title">Descrivi il Video che Vuoi Creare</h2><p className="step-description">L'IA (Gemini) creerà una sceneggiatura basata sulla tua descrizione.</p></div><div className="description-form"><div className="form-group"><label htmlFor="video-desc" className="form-label">Descrizione del Video</label><textarea id="video-desc" className="