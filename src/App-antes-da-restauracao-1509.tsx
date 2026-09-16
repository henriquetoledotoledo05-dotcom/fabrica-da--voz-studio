import { useMemo, useState } from "react";
import "./App.css";

type VoiceKey = "pedro" | "luiza" | "gaby" | "celso" | "noah" | "nina";
type Style = "normal" | "animado" | "muitoAnimado" | "superImpacto";

type Locutor = {
  id: VoiceKey;
  nome: string;
  foto: string;
  demonstrativo: string;
  voiceId: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const assets = import.meta.glob("./assets/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function asset(...parts: string[]) {
  const entries = Object.entries(assets);
  const found = entries.find(([file]) => {
    const lower = file.toLowerCase();
    return parts.some((part) => lower.includes(part.toLowerCase()));
  });
  return found?.[1] || "";
}

function audioAsset(...parts: string[]) {
  return asset(...parts);
}

/*
  Os 6 locutores ficam aqui.
  Os IDs vêm do .env do Vite, para não precisar colocar sua chave/IDs
  diretamente no código.
*/
const LOCUTORES: Locutor[] = [
  {
    id: "pedro",
    nome: "Pedro",
    foto: asset("pedro", "locutor"),
    demonstrativo: audioAsset("pedro", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_PEDRO_ID || "",
  },
  {
    id: "luiza",
    nome: "Luiza",
    foto: asset("luiza", "locutora"),
    demonstrativo: audioAsset("luiza", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_LUIZA_ID || "",
  },
  {
    id: "gaby",
    nome: "Gaby",
    foto: asset("gaby", "locutora"),
    demonstrativo: audioAsset("gaby", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_GABY_ID || "",
  },
  {
    id: "celso",
    nome: "Celso",
    foto: asset("celso", "locutor"),
    demonstrativo: audioAsset("celso", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_CELSO_ID || "",
  },
  {
    id: "noah",
    nome: "Noah",
    foto: asset("noah-locutor", "noah"),
    demonstrativo: audioAsset("noah", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_NOAH_ID || "",
  },
  {
    id: "nina",
    nome: "Nina",
    foto: asset("nina-locutora-1", "nina"),
    demonstrativo: audioAsset("nina", "amostra", "demo", "demonstrativo"),
    voiceId: import.meta.env.VITE_VOICE_NINA_ID || "",
  },
];

function serverUrl(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url}`;
}

export default function App() {
  const [locutorId, setLocutorId] = useState<VoiceKey>("noah");
  const [style, setStyle] = useState<Style>("normal");
  const [text, setText] = useState("");
  const [track, setTrack] = useState<File | null>(null);
  const [trackUrl, setTrackUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const locutor = useMemo(
    () => LOCUTORES.find((item) => item.id === locutorId) || LOCUTORES[0],
    [locutorId]
  );

  function selecionarTrilha(file: File | null) {
    setTrack(file);
    setResultUrl("");
    setError("");

    if (trackUrl) URL.revokeObjectURL(trackUrl);
    setTrackUrl(file ? URL.createObjectURL(file) : "");
  }

  async function gerar() {
    setError("");
    setResultUrl("");

    if (!text.trim()) {
      setError("Digite o texto da locução.");
      return;
    }

    if (!locutor.voiceId) {
      setError(
        `O Voice ID do ${locutor.nome} não está configurado. Coloque VITE_VOICE_${locutor.id.toUpperCase()}_ID no .env.`
      );
      return;
    }

    setGenerating(true);
    setStatus(track ? "Gerando a voz e mixando a trilha..." : "Gerando a voz...");

    try {
      if (track) {
        const form = new FormData();
        form.append("text", text);
        form.append("voiceId", locutor.voiceId);
        form.append("style", style);
        form.append("speed", "1");
        form.append("trackVolume", "0.18");
        form.append("name", `fabrica-${locutor.nome}-${style}`);
        form.append("track", track);

        const response = await fetch(`${API_BASE}/api/generate-and-mix`, {
          method: "POST",
          body: form,
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Não foi possível gerar/mixar.");
        }

        setResultUrl(serverUrl(data.url));
        setStatus("Pronto! Voz e trilha foram mixadas.");
      } else {
        const response = await fetch(`${API_BASE}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voiceId: locutor.voiceId,
            style,
            speed: 1,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Não foi possível gerar a voz.");
        }

        setResultUrl(serverUrl(data.url));
        setStatus("Voz gerada com sucesso.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
      setStatus("");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Fábrica da Voz</strong>
            <span>Gerador profissional de locuções</span>
          </div>
        </div>
      </header>

      <section className="container">
        <div className="hero">
          <h1>Crie sua locução</h1>
          <p>Escolha o locutor, o estilo e gere sua voz. Você também pode enviar uma trilha para mixagem automática.</p>
        </div>

        <section className="panel">
          <h2>1. Escolha o locutor</h2>

          <div className="voices">
            {LOCUTORES.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`voice-card ${locutorId === item.id ? "selected" : ""}`}
                onClick={() => {
                  setLocutorId(item.id);
                  setError("");
                }}
              >
                <div className="voice-photo">
                  {item.foto ? (
                    <img src={item.foto} alt={item.nome} />
                  ) : (
                    <span>{item.nome.slice(0, 1)}</span>
                  )}
                </div>

                <div className="voice-info">
                  <strong>{item.nome}</strong>
                  <small>{item.voiceId ? "Voz disponível" : "Voice ID não configurado"}</small>
                </div>

                {item.demonstrativo && (
                  <audio
                    controls
                    preload="none"
                    src={item.demonstrativo}
                    onClick={(event) => event.stopPropagation()}
                  />
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>2. Estilo da locução</h2>

          <div className="styles">
            {([
              ["normal", "Normal"],
              ["animado", "Animado"],
              ["muitoAnimado", "Muito animado"],
              ["superImpacto", "Super impacto"],
            ] as [Style, string][]).map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={`style-button ${style === value ? "active" : ""}`}
                onClick={() => setStyle(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>3. Texto</h2>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Digite aqui o texto da sua locução..."
            rows={8}
          />

          <div className="counter">{text.length} caracteres</div>
        </section>

        <section className="panel">
          <h2>4. Trilha de fundo</h2>

          <label className="upload">
            <input
              type="file"
              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
              onChange={(event) => selecionarTrilha(event.target.files?.[0] || null)}
            />
            <span>🎵 Escolher trilha do cliente</span>
            <small>{track ? track.name : "MP3 ou WAV — opcional"}</small>
          </label>

          {trackUrl && (
            <audio className="track-player" controls src={trackUrl} />
          )}
        </section>

        <button
          type="button"
          className="generate"
          onClick={gerar}
          disabled={generating}
        >
          {generating ? "Gerando..." : track ? "Gerar e mixar locução" : "Gerar locução"}
        </button>

        {status && <div className="success">{status}</div>}
        {error && <div className="error">{error}</div>}

        {resultUrl && (
          <section className="result panel">
            <h2>Áudio pronto</h2>
            <audio controls src={resultUrl} />
            <a className="download" href={resultUrl} download>
              ⬇ Baixar áudio
            </a>
          </section>
        )}
      </section>
    </main>
  );
}
