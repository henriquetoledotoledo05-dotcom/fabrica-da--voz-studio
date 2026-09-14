const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3010;

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
}));

app.options(/.*/, cors());

app.use(express.json({ limit: "100mb" }));
app.use(express.text({
  type: ["text/plain", "text/plain;charset=UTF-8"],
  limit: "100mb"
}));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use((req, res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch {}
  }
  next();
});

if (!ffmpegPath) {
  console.error("FFmpeg não encontrado.");
  process.exit(1);
}

console.log("FFmpeg:", ffmpegPath);

function limparBase64(valor) {
  if (!valor || typeof valor !== "string") return null;
  return valor.replace(/^data:audio\/[^;]+;base64,/i, "");
}

function base64ParaBuffer(valor) {
  const limpo = limparBase64(valor);
  if (!limpo) return null;

  try {
    const buffer = Buffer.from(limpo, "base64");
    return buffer.length ? buffer : null;
  } catch {
    return null;
  }
}

function obterDuracao(audioPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ["-hide_banner", "-i", audioPath]);
    let stderr = "";

    proc.stderr.on("data", data => {
      stderr += data.toString();
    });

    proc.on("error", reject);

    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);

      if (!m) {
        reject(
          new Error("Não foi possível descobrir a duração do áudio.")
        );
        return;
      }

      resolve(
        Number(m[1]) * 3600 +
        Number(m[2]) * 60 +
        Number(m[3])
      );
    });
  });
}

function alterarVelocidade(audioBuffer, speed) {
  return new Promise((resolve, reject) => {
    let velocidade = Number(speed);

    if (!Number.isFinite(velocidade)) velocidade = 1;

    velocidade = Math.max(
      0.5,
      Math.min(2, velocidade)
    );

    const proc = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-filter:a",
      `atempo=${velocidade}`,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-f",
      "mp3",
      "pipe:1"
    ]);

    const partes = [];
    let erro = "";

    proc.stdout.on("data", parte => {
      partes.push(parte);
    });

    proc.stderr.on("data", parte => {
      erro += parte.toString();
    });

    proc.on("error", reject);

    proc.on("close", codigo => {
      if (codigo === 0) {
        resolve(Buffer.concat(partes));
        return;
      }

      reject(
        new Error(
          erro || "Erro ao alterar a velocidade da voz."
        )
      );
    });

    proc.stdin.end(audioBuffer);
  });
}

function executarFfmpeg(argumentos, saidaPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, argumentos);
    let erro = "";

    proc.stderr.on("data", data => {
      erro += data.toString();
    });

    proc.on("error", reject);

    proc.on("close", codigo => {
      if (codigo !== 0) {
        reject(
          new Error(
            erro || "FFmpeg retornou um erro."
          )
        );
        return;
      }

      try {
        resolve(fs.readFileSync(saidaPath));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function localizarTrilha(trilhaSelecionada) {
  const nome = path.basename(
    String(trilhaSelecionada || "")
  );

  const candidatos = [
    path.join(__dirname, "public", "trilhas", nome),
    path.join(__dirname, "public", nome),
    path.join(__dirname, "dist", "trilhas", nome),
    path.join(__dirname, "dist", nome)
  ];

  return candidatos.find(
    caminho => fs.existsSync(caminho)
  ) || null;
}

/*
  MIXAGEM PROFISSIONAL

  - segundosInicio: tempo de trilha antes da voz
  - voz entra depois desse tempo
  - trilha fica tocando por baixo da voz
  - sidechaincompress abaixa a trilha automaticamente durante a fala
  - segundosFinal: trilha continua depois da voz
  - fadeFinal: fade-out no final
  - volumeVoz: volume da locução
  - volumeTrilha: volume normal da trilha
  - ducking: intensidade do abaixamento durante a fala
*/
async function mixarAudio(
  vozBuffer,
  trilhaBuffer,
  segundosInicio = 5,
  segundosFinal = 5,
  volumeVoz = 1,
  volumeTrilha = 0.2,
  ducking = 0.2,
  fadeFinal = 2
) {
  let inicio = Number(segundosInicio);
  let final = Number(segundosFinal);
  let volVoz = Number(volumeVoz);
  let volTrilha = Number(volumeTrilha);
  let intensidadeDucking = Number(ducking);
  let fade = Number(fadeFinal);

  if (!Number.isFinite(inicio)) inicio = 5;
  if (!Number.isFinite(final)) final = 5;
  if (!Number.isFinite(volVoz)) volVoz = 1;
  if (!Number.isFinite(volTrilha)) volTrilha = 0.2;
  if (!Number.isFinite(intensidadeDucking)) intensidadeDucking = 0.2;
  if (!Number.isFinite(fade)) fade = 2;

  inicio = Math.max(0, Math.min(60, inicio));
  final = Math.max(0, Math.min(60, final));
  volVoz = Math.max(0, Math.min(1.5, volVoz));
  volTrilha = Math.max(0, Math.min(1, volTrilha));
  intensidadeDucking = Math.max(
    0,
    Math.min(1, intensidadeDucking)
  );
  fade = Math.max(0, Math.min(10, fade));

  const pastaTemp = fs.mkdtempSync(
    path.join(os.tmpdir(), "fabrica-da-voz-")
  );

  const vozPath = path.join(
    pastaTemp,
    "voz.mp3"
  );

  const trilhaPath = path.join(
    pastaTemp,
    "trilha.mp3"
  );

  const saidaPath = path.join(
    pastaTemp,
    "final.mp3"
  );

  try {
    fs.writeFileSync(
      vozPath,
      vozBuffer
    );

    fs.writeFileSync(
      trilhaPath,
      trilhaBuffer
    );

    const duracaoVoz =
      await obterDuracao(vozPath);

    const duracaoTotal =
      Math.max(
        0.1,
        inicio +
        duracaoVoz +
        final
      );

    const fadeDuracao =
      Math.min(
        fade,
        duracaoTotal
      );

    const fadeInicio =
      Math.max(
        0,
        duracaoTotal -
        fadeDuracao
      );

    const delayMs =
      Math.round(
        inicio * 1000
      );

    /*
      Quanto menor o ducking, mais a trilha é reduzida
      enquanto o locutor fala.

      0% = redução forte
      100% = redução mínima
    */
    const ratio =
      1 +
      (1 - intensidadeDucking) *
      19;

    const filtro =
      `[0:a]` +
      `volume=${volVoz},` +
      `adelay=${delayMs}|${delayMs},` +
      `apad=pad_dur=${final},` +
      `atrim=duration=${duracaoTotal},` +
      `asetpts=N/SR/TB[voz];` +

      `[1:a]` +
      `volume=${volTrilha},` +
      `atrim=duration=${duracaoTotal},` +
      `asetpts=N/SR/TB[trilha];` +

      `[trilha][voz]` +
      `sidechaincompress=` +
      `threshold=0.025:` +
      `ratio=${ratio}:` +
      `attack=10:` +
      `release=300:` +
      `makeup=1:` +
      `mix=1` +
      `[trilhaDucked];` +

      `[trilhaDucked]` +
      `afade=t=out:` +
      `st=${fadeInicio}:` +
      `d=${fadeDuracao}` +
      `[musica];` +

      `[voz][musica]` +
      `amix=inputs=2:` +
      `duration=longest:` +
      `dropout_transition=0:` +
      `normalize=0,` +
      `atrim=duration=${duracaoTotal},` +
      `asetpts=N/SR/TB` +
      `[out]`;

    console.log("");
    console.log("=================================");
    console.log("INICIANDO MIXAGEM");
    console.log("=================================");
    console.log("Segundos antes:", inicio);
    console.log("Duração da voz:", duracaoVoz);
    console.log("Segundos depois:", final);
    console.log("Duração total:", duracaoTotal);
    console.log("Volume voz:", volVoz);
    console.log("Volume trilha:", volTrilha);
    console.log("Ducking:", intensidadeDucking);
    console.log("Fade final:", fade);
    console.log("=================================");

    const argumentos = [
      "-hide_banner",
      "-loglevel",
      "error",

      "-i",
      vozPath,

      "-stream_loop",
      "-1",

      "-i",
      trilhaPath,

      "-filter_complex",
      filtro,

      "-map",
      "[out]",

      "-c:a",
      "libmp3lame",

      "-b:a",
      "192k",

      "-ar",
      "44100",

      "-ac",
      "2",

      "-y",
      saidaPath
    ];

    const resultado =
      await executarFfmpeg(
        argumentos,
        saidaPath
      );

    console.log("MIXAGEM CONCLUÍDA");
    console.log(
      "Tamanho:",
      resultado.length,
      "bytes"
    );

    return resultado;
  } finally {
    try {
      fs.rmSync(
        pastaTemp,
        {
          recursive: true,
          force: true
        }
      );
    } catch {}
  }
}

async function obterRespostaElevenLabs(
  voiceId,
  texto
) {
  const apiKey =
    process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY não configurada no Render."
    );
  }

  const resposta =
    await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId
      )}`,
      {
        method: "POST",

        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },

        body: JSON.stringify({
          text: texto,

          model_id:
            process.env.ELEVENLABS_MODEL_ID ||
            "eleven_v3",

          language_code: "pt",

          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.82,
            style: 0.35,
            use_speaker_boost: true
          },

          output_format:
            "mp3_44100_128"
        })
      }
    );

  if (!resposta.ok) {
    const erro =
      await resposta.text();

    throw new Error(
      erro ||
      "Erro na ElevenLabs."
    );
  }

  return Buffer.from(
    await resposta.arrayBuffer()
  );
}

app.post(
  "/api/gerar-voz",
  async (req, res) => {
    try {
      const {
        texto,
        voiceId,
        speed
      } = req.body || {};

      if (
        !texto ||
        typeof texto !== "string" ||
        !texto.trim()
      ) {
        return res.status(400).json({
          erro: "Digite um texto."
        });
      }

      if (!voiceId) {
        return res.status(400).json({
          erro:
            "Nenhuma voz foi selecionada."
        });
      }

      let audio =
        await obterRespostaElevenLabs(
          voiceId,
          texto.trim()
        );

      if (!audio.length) {
        return res.status(500).json({
          erro:
            "A ElevenLabs retornou um áudio vazio."
        });
      }

      if (
        speed !== undefined &&
        Number(speed) !== 1
      ) {
        audio =
          await alterarVelocidade(
            audio,
            Number(speed)
          );
      }

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          String(audio.length),

        "Cache-Control":
          "no-store"
      });

      res.send(audio);
    } catch (erro) {
      console.error(
        "ERRO AO GERAR VOZ:",
        erro
      );

      res.status(500).json({
        erro:
          erro.message ||
          "Não foi possível gerar a voz."
      });
    }
  }
);

async function processarMixagem(
  req,
  res,
  trilhaBuffer
) {
  const {
    audioBase64,
    segundosInicio,
    segundosFinal,
    volumeVoz,
    volumeTrilha,
    ducking,
    fadeFinal
  } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({
      erro:
        "Áudio da voz não informado."
    });
  }

  if (
    !trilhaBuffer ||
    !trilhaBuffer.length
  ) {
    return res.status(400).json({
      erro:
        "Áudio da trilha vazio ou inválido."
    });
  }

  const vozBuffer =
    base64ParaBuffer(
      audioBase64
    );

  if (!vozBuffer) {
    return res.status(400).json({
      erro:
        "Áudio da voz vazio ou inválido."
    });
  }

  const resultado =
    await mixarAudio(
      vozBuffer,
      trilhaBuffer,
      segundosInicio,
      segundosFinal,
      volumeVoz,
      volumeTrilha,
      ducking,
      fadeFinal
    );

  res.set({
    "Content-Type":
      "audio/mpeg",

    "Content-Length":
      String(resultado.length),

    "Content-Disposition":
      'attachment; filename="fabrica-da-voz.mp3"',

    "Cache-Control":
      "no-store"
  });

  res.send(resultado);
}

app.post(
  "/api/mixar-voz",
  async (req, res) => {
    try {
      const {
        trilhaSelecionada
      } = req.body || {};

      if (!trilhaSelecionada) {
        return res.status(400).json({
          erro:
            "Nenhuma trilha foi selecionada."
        });
      }

      const trilhaPath =
        localizarTrilha(
          trilhaSelecionada
        );

      if (!trilhaPath) {
        return res.status(404).json({
          erro:
            `Trilha não encontrada: ${path.basename(
              trilhaSelecionada
            )}`
        });
      }

      await processarMixagem(
        req,
        res,
        fs.readFileSync(
          trilhaPath
        )
      );
    } catch (erro) {
      console.error(
        "ERRO NA MIXAGEM:",
        erro
      );

      if (!res.headersSent) {
        res.status(500).json({
          erro:
            erro.message ||
            "Erro ao mixar os áudios."
        });
      }
    }
  }
);

app.post(
  "/api/mixar-upload",
  async (req, res) => {
    try {
      const {
        trilhaBase64
      } = req.body || {};

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "A trilha enviada pelo cliente não foi encontrada."
        });
      }

      const trilhaBuffer =
        base64ParaBuffer(
          trilhaBase64
        );

      if (!trilhaBuffer) {
        return res.status(400).json({
          erro:
            "Áudio da trilha vazio ou inválido."
        });
      }

      await processarMixagem(
        req,
        res,
        trilhaBuffer
      );
    } catch (erro) {
      console.error(
        "ERRO NA MIXAGEM DO CLIENTE:",
        erro
      );

      if (!res.headersSent) {
        res.status(500).json({
          erro:
            erro.message ||
            "Não foi possível mixar a trilha enviada."
        });
      }
    }
  }
);

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      servidor:
        "Fábrica da Voz",
      porta: PORT,
      ffmpeg:
        !!ffmpegPath,
      geracaoVoz: true,
      trilhaCliente: true,
      mixagem: true
    });
  }
);

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      funcionando: true,
      servidor:
        "Fábrica da Voz",
      porta: PORT,
      ffmpeg:
        !!ffmpegPath,
      geracaoVoz: true,
      segundos: true,
      fadeFinal: true,
      volumeVoz: true,
      volumeTrilha: true,
      ducking: true,
      trilhaFabrica: true,
      trilhaCliente: true
    });
  }
);

app.get(
  "/",
  (req, res) => {
    res.json({
      nome:
        "Fábrica da Voz",
      status:
        "online",
      mensagem:
        "Servidor funcionando corretamente."
    });
  }
);

app.use(
  (err, req, res, next) => {
    console.error(
      "ERRO GERAL:",
      err
    );

    if (res.headersSent) {
      return next(err);
    }

    res.status(500).json({
      erro:
        err.message ||
        "Erro interno do servidor."
    });
  }
);

const server =
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log("");
      console.log(
        "================================="
      );
      console.log(
        "FÁBRICA DA VOZ"
      );
      console.log(
        "================================="
      );
      console.log(
        `Servidor na porta ${PORT}`
      );
      console.log(
        "Geração de voz: ATIVADA"
      );
      console.log(
        "Mixagem: ATIVADA"
      );
      console.log(
        "Volume de voz: ATIVADO"
      );
      console.log(
        "Volume de trilha: ATIVADO"
      );
      console.log(
        "Ducking automático: ATIVADO"
      );
      console.log(
        "Fade final: ATIVADO"
      );
      console.log(
        "Trilha do cliente: ATIVADA"
      );
      console.log(
        "================================="
      );
    }
  );

function encerrarServidor(sinal) {
  console.log(
    `Recebido ${sinal}. Encerrando servidor...`
  );

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 5000);
}

process.on(
  "SIGINT",
  () => encerrarServidor("SIGINT")
);

process.on(
  "SIGTERM",
  () => encerrarServidor("SIGTERM")
);
