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
const PORT = Number(process.env.PORT) || 10000;

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const allowedOrigins = [
  "https://www.fabricadavozstudio.com.br",
  "https://fabricadavozstudio.com.br",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3010",
];

app.use(
  cors({
    origin(origin, callback) {
      // Permite chamadas sem Origin (ex.: curl, health-checks)
      // e os domínios oficiais da Fábrica da Voz.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // Não bloqueia o navegador por CORS; a aplicação continua
      // protegida pelo próprio domínio/rota.
      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

app.options(/.*/, cors());

app.use(
  express.json({
    limit: "100mb",
  })
);

// A geração também aceita JSON enviado como text/plain.
// Isso evita o preflight OPTIONS que o proxy do domínio estava redirecionando.
app.use(
  express.text({
    type: ["text/plain", "text/plain;charset=UTF-8"],
    limit: "100mb",
  })
);

// Normaliza o corpo para JSON quando o navegador enviar text/plain.
app.use((req, res, next) => {
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch {}
  }
  next();
});

app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
  })
);

// =====================================================
// FFMPEG
// =====================================================

if (!ffmpegPath) {
  console.error("");
  console.error("ERRO: FFmpeg não encontrado.");
  console.error("");
  process.exit(1);
}

console.log("");
console.log("FFmpeg encontrado:");
console.log(ffmpegPath);

// =====================================================
// UTILITÁRIOS
// =====================================================

function limparBase64(valor) {
  if (!valor || typeof valor !== "string") {
    return null;
  }

  return valor.replace(
    /^data:audio\/[^;]+;base64,/i,
    ""
  );
}

function base64ParaBuffer(valor) {
  const limpo = limparBase64(valor);

  if (!limpo) {
    return null;
  }

  const buffer = Buffer.from(limpo, "base64");

  return buffer.length ? buffer : null;
}

// =====================================================
// PEGAR DURAÇÃO DO ÁUDIO
// =====================================================

function obterDuracao(audioPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffmpegPath, [
      "-hide_banner",
      "-i",
      audioPath,
    ]);

    let erro = "";

    ffprobe.stderr.on("data", (data) => {
      erro += data.toString();
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });

    ffprobe.on("close", () => {
      const resultado = erro.match(
        /Duration:\s*(\d+):(\d+):([\d.]+)/
      );

      if (!resultado) {
        reject(
          new Error(
            "Não foi possível descobrir a duração do áudio."
          )
        );
        return;
      }

      const horas = Number(resultado[1]);
      const minutos = Number(resultado[2]);
      const segundos = Number(resultado[3]);

      resolve(
        horas * 3600 +
        minutos * 60 +
        segundos
      );
    });
  });
}

// =====================================================
// ALTERAR VELOCIDADE
// =====================================================

function alterarVelocidade(audioBuffer, speed) {
  return new Promise((resolve, reject) => {
    let velocidade = Number(speed);

    if (!Number.isFinite(velocidade)) {
      velocidade = 1;
    }

    velocidade = Math.max(
      0.5,
      Math.min(2, velocidade)
    );

    const ffmpeg = spawn(ffmpegPath, [
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

      "pipe:1",
    ]);

    const partes = [];
    let erro = "";

    ffmpeg.stdout.on("data", (parte) => {
      partes.push(parte);
    });

    ffmpeg.stderr.on("data", (parte) => {
      erro += parte.toString();
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });

    ffmpeg.on("close", (codigo) => {
      if (codigo === 0) {
        resolve(Buffer.concat(partes));
        return;
      }

      reject(
        new Error(
          erro ||
          "Erro ao alterar a velocidade da voz."
        )
      );
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

// =====================================================
// MIXAGEM PROFISSIONAL
//
// SEGUNDOS ANTES
// + VOZ
// + SEGUNDOS DEPOIS
// + FADE FINAL DE 2 SEGUNDOS
//
// A TRILHA FICA EM 20% DE VOLUME.
// =====================================================

async function mixarAudio(
  vozBuffer,
  trilhaBuffer,
  segundosInicio,
  segundosFinal
) {
  let inicio = Number(segundosInicio);
  let final = Number(segundosFinal);

  if (!Number.isFinite(inicio)) {
    inicio = 5;
  }

  if (!Number.isFinite(final)) {
    final = 5;
  }

  inicio = Math.max(
    0,
    Math.min(60, inicio)
  );

  final = Math.max(
    0,
    Math.min(60, final)
  );

  const pastaTemp = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "fabrica-da-voz-"
    )
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
      inicio +
      duracaoVoz +
      final;

    const inicioFade = Math.max(
      0,
      duracaoTotal - 2
    );

    console.log("");
    console.log(
      "================================="
    );
    console.log("INICIANDO MIXAGEM");
    console.log(
      "Segundos antes:",
      inicio
    );
    console.log(
      "Duração da voz:",
      duracaoVoz
    );
    console.log(
      "Segundos depois:",
      final
    );
    console.log(
      "Duração final:",
      duracaoTotal
    );
    console.log(
      "Fade final:",
      inicioFade,
      "até",
      duracaoTotal
    );
    console.log(
      "================================="
    );

    const delayMs = Math.round(
      inicio * 1000
    );

    const duracaoVozComInicio =
      inicio + duracaoVoz;

    const argumentos = [
      "-hide_banner",
      "-loglevel",
      "error",

      // VOZ
      "-i",
      vozPath,

      // TRILHA em loop para nunca acabar antes da voz
      "-stream_loop",
      "-1",
      "-i",
      trilhaPath,

      "-filter_complex",

      // Voz:
      // começa após os segundos iniciais
      // e recebe silêncio depois.
      `[0:a]adelay=${delayMs}|${delayMs},apad=pad_dur=${final}[voz];` +

      // Trilha:
      // 20% de volume, duração final exata
      // e fade out nos últimos 2 segundos.
      `[1:a]volume=0.20,` +
      `atrim=duration=${duracaoTotal},` +
      `afade=t=out:st=${inicioFade}:d=2[trilha];` +

      // Mistura voz + trilha.
      `[voz][trilha]` +
      `amix=inputs=2:` +
      `duration=first:` +
      `dropout_transition=0:` +
      `normalize=0,` +
      `atrim=duration=${duracaoTotal},` +
      `asetpts=N/SR/TB[out]`,

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
      saidaPath,
    ];

    const resultado = await executarFfmpeg(
      argumentos,
      saidaPath
    );

    console.log("");
    console.log(
      "================================="
    );
    console.log("MIXAGEM CONCLUÍDA");
    console.log(
      "Tamanho:",
      resultado.length,
      "bytes"
    );
    console.log(
      "================================="
    );
    console.log("");

    return resultado;
  } finally {
    try {
      fs.rmSync(
        pastaTemp,
        {
          recursive: true,
          force: true,
        }
      );
    } catch {}
  }
}

// =====================================================
// EXECUTAR FFMPEG
// =====================================================

function executarFfmpeg(
  argumentos,
  saidaPath
) {
  return new Promise(
    (resolve, reject) => {
      const ffmpeg = spawn(
        ffmpegPath,
        argumentos
      );

      let erro = "";

      ffmpeg.stderr.on(
        "data",
        (data) => {
          erro += data.toString();
        }
      );

      ffmpeg.on(
        "error",
        (err) => {
          reject(err);
        }
      );

      ffmpeg.on(
        "close",
        (codigo) => {
          if (codigo !== 0) {
            reject(
              new Error(
                erro ||
                "FFmpeg retornou um erro."
              )
            );
            return;
          }

          try {
            const resultado =
              fs.readFileSync(
                saidaPath
              );

            resolve(resultado);
          } catch (err) {
            reject(err);
          }
        }
      );
    }
  );
}

// =====================================================
// GERAR VOZ - ELEVENLABS
// =====================================================

app.post(
  "/api/gerar-voz",
  async (req, res) => {
    try {
      const {
        texto,
        voiceId,
        speed,
      } = req.body;

      console.log("");
      console.log(
        "================================="
      );
      console.log("GERANDO VOZ");
      console.log(
        "================================="
      );

      if (
        !texto ||
        typeof texto !== "string" ||
        !texto.trim()
      ) {
        return res.status(400).json({
          erro: "Digite um texto.",
        });
      }

      if (!voiceId) {
        return res.status(400).json({
          erro:
            "Nenhuma voz foi selecionada.",
        });
      }

      if (
        !process.env
          .ELEVENLABS_API_KEY
      ) {
        return res.status(500).json({
          erro:
            "ELEVENLABS_API_KEY não configurada no arquivo .env.",
        });
      }

      console.log(
        "Voice ID:",
        voiceId
      );

      console.log(
        "Texto:",
        texto
      );

      const resposta =
        await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
            voiceId
          )}`,
          {
            method: "POST",

            headers: {
              "xi-api-key":
                process.env
                  .ELEVENLABS_API_KEY,

              "Content-Type":
                "application/json",

              "Accept":
                "audio/mpeg",
            },

            body: JSON.stringify({
              text: texto,

              // Mantido conforme o projeto atual.
              model_id:
                "eleven_v3",

              language_code:
                "pt",

              voice_settings: {
                stability: 0.45,
                similarity_boost: 0.80,
                style: 0.55,
                use_speaker_boost: true,
              },

              output_format:
                "mp3_44100_128",
            }),
          }
        );

      if (!resposta.ok) {
        const erroApi =
          await resposta.text();

        console.error(
          "ELEVENLABS ERRO:"
        );
        console.error(
          erroApi
        );

        return res
          .status(resposta.status)
          .json({
            erro:
              erroApi ||
              "Erro na ElevenLabs.",
          });
      }

      let audio =
        Buffer.from(
          await resposta.arrayBuffer()
        );

      if (!audio.length) {
        return res.status(500).json({
          erro:
            "A ElevenLabs retornou um áudio vazio.",
        });
      }

      console.log(
        "Áudio recebido:",
        audio.length,
        "bytes"
      );

      // Velocidade opcional.
      if (
        speed !== undefined &&
        speed !== null &&
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
          audio.length.toString(),

        "Cache-Control":
          "no-store",
      });

      res.send(audio);
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO AO GERAR VOZ:"
      );
      console.error(erro);

      res.status(500).json({
        erro:
          erro.message ||
          "Não foi possível gerar a voz.",
      });
    }
  }
);

// =====================================================
// MIXAGEM COM TRILHA DA FÁBRICA
//
// O frontend envia:
// - audioBase64
// - trilhaSelecionada
// - segundosInicio
// - segundosFinal
// =====================================================

app.post(
  "/api/mixar-voz",
  async (req, res) => {
    try {
      const {
        audioBase64,
        trilhaSelecionada,
        segundosInicio,
        segundosFinal,
      } = req.body;

      console.log("");
      console.log(
        "================================="
      );
      console.log(
        "MIXAGEM - TRILHA DA FÁBRICA"
      );
      console.log(
        "================================="
      );

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaSelecionada) {
        return res.status(400).json({
          erro:
            "Nenhuma trilha foi selecionada.",
        });
      }

      const vozBuffer =
        base64ParaBuffer(
          audioBase64
        );

      if (!vozBuffer) {
        return res.status(400).json({
          erro:
            "Áudio da voz vazio ou inválido.",
        });
      }

      // Aceita tanto:
      // "TRILHA.mp3"
      // quanto:
      // "/TRILHA.mp3"
      // quanto:
      // "public/TRILHA.mp3"
      const nomeTrilha =
        path.basename(
          String(trilhaSelecionada)
        );

      const trilhaPath =
        path.join(
          __dirname,
          "public",
          nomeTrilha
        );

      if (
        !fs.existsSync(
          trilhaPath
        )
      ) {
        console.error(
          "Trilha não encontrada:",
          trilhaPath
        );

        return res.status(404).json({
          erro:
            `Trilha não encontrada: ${nomeTrilha}`,
        });
      }

      const trilhaBuffer =
        fs.readFileSync(
          trilhaPath
        );

      const resultado =
        await mixarAudio(
          vozBuffer,
          trilhaBuffer,
          segundosInicio,
          segundosFinal
        );

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          resultado.length.toString(),

        "Content-Disposition":
          'attachment; filename="fabrica-da-voz.mp3"',

        "Cache-Control":
          "no-store",
      });

      res.send(resultado);
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO NA MIXAGEM:"
      );
      console.error(erro);

      res.status(500).json({
        erro:
          erro.message ||
          "Erro ao mixar os áudios.",
      });
    }
  }
);

// =====================================================
// MIXAGEM COM TRILHA ENVIADA PELO CLIENTE
//
// O frontend envia:
// - audioBase64
// - trilhaBase64
// - segundosInicio
// - segundosFinal
// =====================================================

app.post(
  "/api/mixar-upload",
  async (req, res) => {
    try {
      const {
        audioBase64,
        trilhaBase64,
        segundosInicio,
        segundosFinal,
      } = req.body;

      console.log("");
      console.log(
        "================================="
      );
      console.log(
        "MIXAGEM - TRILHA DO CLIENTE"
      );
      console.log(
        "================================="
      );

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "A trilha enviada pelo cliente não foi encontrada.",
        });
      }

      const vozBuffer =
        base64ParaBuffer(
          audioBase64
        );

      const trilhaBuffer =
        base64ParaBuffer(
          trilhaBase64
        );

      if (!vozBuffer) {
        return res.status(400).json({
          erro:
            "Áudio da voz vazio ou inválido.",
        });
      }

      if (!trilhaBuffer) {
        return res.status(400).json({
          erro:
            "Áudio da trilha vazio ou inválido.",
        });
      }

      const resultado =
        await mixarAudio(
          vozBuffer,
          trilhaBuffer,
          segundosInicio,
          segundosFinal
        );

      console.log(
        "Mixagem da trilha do cliente concluída."
      );

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          resultado.length.toString(),

        "Content-Disposition":
          'attachment; filename="fabrica-da-voz.mp3"',

        "Cache-Control":
          "no-store",
      });

      res.send(resultado);
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO NA MIXAGEM DO CLIENTE:"
      );
      console.error(erro);

      res.status(500).json({
        erro:
          erro.message ||
          "Não foi possível mixar a trilha enviada.",
      });
    }
  }
);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    servidor: "Fábrica da Voz",
    porta: PORT,
    ffmpeg: !!ffmpegPath,
    geracaoVoz: true,
    trilhaCliente: true,
    mixagem: true,
  });
});

// =====================================================
// STATUS
// =====================================================

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      funcionando: true,

      servidor:
        "Fábrica da Voz",

      porta:
        PORT,

      ffmpeg:
        !!ffmpegPath,

      geracaoVoz:
        true,

      segundos:
        true,

      fadeFinal:
        true,

      trilhaFabrica:
        true,

      trilhaCliente:
        true,
    });
  }
);

// =====================================================
// ROTA DE TESTE
// =====================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      nome:
        "Fábrica da Voz",

      status:
        "online",

      mensagem:
        "Servidor funcionando corretamente.",
    });
  }
);

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

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
        "Erro interno do servidor.",
    });
  }
);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

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
        "        FÁBRICA DA VOZ"
      );
      console.log(
        "================================="
      );
      console.log(
        `Servidor: http://localhost:${PORT}`
      );
      console.log(
        "Geração de voz: ATIVADA"
      );
      console.log(
        "Segundos antes/depois: ATIVADOS"
      );
      console.log(
        "Fade final: 2 segundos"
      );
      console.log(
        "Trilha da fábrica: ATIVADA"
      );
      console.log(
        "Trilha do cliente: ATIVADA"
      );
      console.log(
        "================================="
      );
      console.log("");
    }
  );

// =====================================================
// ENCERRAMENTO SEGURO
// =====================================================

function encerrarServidor(sinal) {
  console.log("");
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
