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

const PORT = process.env.PORT || 3010;

const DIST_PATH = path.join(__dirname, "dist");
const PUBLIC_PATH = path.join(__dirname, "public");

// =====================================================
// CONFIGURAÇÃO
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "100mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
  })
);

// =====================================================
// FRONTEND VITE / REACT
// =====================================================

if (fs.existsSync(DIST_PATH)) {
  console.log(
    "Frontend encontrado em:",
    DIST_PATH
  );

  app.use(
    express.static(DIST_PATH)
  );
} else {
  console.log(
    "AVISO: pasta dist não encontrada."
  );
}

// =====================================================
// ARQUIVOS PÚBLICOS
// =====================================================

if (fs.existsSync(PUBLIC_PATH)) {
  app.use(
    "/public",
    express.static(PUBLIC_PATH)
  );
}

// =====================================================
// FFMPEG
// =====================================================

if (!ffmpegPath) {
  console.error(
    "ERRO: FFmpeg não encontrado."
  );

  process.exit(1);
}

console.log(
  "FFmpeg encontrado:"
);

console.log(
  ffmpegPath
);

// =====================================================
// EXECUTAR FFMPEG
// =====================================================

function executarFFmpeg(args) {
  return new Promise(
    (resolve, reject) => {
      const processo = spawn(
        ffmpegPath,
        args
      );

      let stderr = "";

      processo.stderr.on(
        "data",
        (data) => {
          stderr += data.toString();
        }
      );

      processo.on(
        "error",
        (erro) => {
          reject(erro);
        }
      );

      processo.on(
        "close",
        (codigo) => {
          if (codigo === 0) {
            resolve();
          } else {
            reject(
              new Error(
                stderr ||
                  `FFmpeg encerrou com código ${codigo}`
              )
            );
          }
        }
      );
    }
  );
}

// =====================================================
// DURAÇÃO DO ÁUDIO
// =====================================================

async function obterDuracao(
  arquivo
) {
  return new Promise(
    (resolve, reject) => {
      const processo = spawn(
        ffmpegPath,
        [
          "-i",
          arquivo,
        ]
      );

      let stderr = "";

      processo.stderr.on(
        "data",
        (data) => {
          stderr += data.toString();
        }
      );

      processo.on(
        "error",
        reject
      );

      processo.on(
        "close",
        () => {
          const encontrado =
            stderr.match(
              /Duration:\s*(\d+):(\d+):([\d.]+)/
            );

          if (!encontrado) {
            reject(
              new Error(
                "Não foi possível descobrir a duração do áudio."
              )
            );

            return;
          }

          const horas =
            Number(encontrado[1]);

          const minutos =
            Number(encontrado[2]);

          const segundos =
            Number(encontrado[3]);

          const total =
            horas * 3600 +
            minutos * 60 +
            segundos;

          resolve(total);
        }
      );
    }
  );
}

// =====================================================
// VELOCIDADE DA VOZ
// =====================================================

async function alterarVelocidade(
  audio,
  speed
) {
  const pasta =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "fabrica-velocidade-"
      )
    );

  const entrada =
    path.join(
      pasta,
      "entrada.mp3"
    );

  const saida =
    path.join(
      pasta,
      "saida.mp3"
    );

  fs.writeFileSync(
    entrada,
    audio
  );

  let velocidade =
    Number(speed) || 1;

  velocidade =
    Math.max(
      0.5,
      Math.min(
        2,
        velocidade
      )
    );

  await executarFFmpeg([
    "-y",

    "-i",
    entrada,

    "-filter:a",
    `atempo=${velocidade}`,

    "-c:a",
    "libmp3lame",

    "-b:a",
    "128k",

    saida,
  ]);

  const resultado =
    fs.readFileSync(
      saida
    );

  fs.rmSync(
    pasta,
    {
      recursive: true,
      force: true,
    }
  );

  return resultado;
}

// =====================================================
// MIXAR VOZ + TRILHA
// =====================================================

async function mixarAudio({
  voz,
  trilha,
  antes,
  depois,
}) {
  const pasta =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "fabrica-mix-"
      )
    );

  const vozPath =
    path.join(
      pasta,
      "voz.mp3"
    );

  const trilhaPath =
    path.join(
      pasta,
      "trilha.mp3"
    );

  const saidaPath =
    path.join(
      pasta,
      "final.mp3"
    );

  fs.writeFileSync(
    vozPath,
    voz
  );

  fs.writeFileSync(
    trilhaPath,
    trilha
  );

  const duracaoVoz =
    await obterDuracao(
      vozPath
    );

  const tempoAntes =
    Math.max(
      0,
      Number(antes) || 0
    );

  const tempoDepois =
    Math.max(
      0,
      Number(depois) || 0
    );

  const duracaoTotal =
    tempoAntes +
    duracaoVoz +
    tempoDepois;

  const inicioFade =
    Math.max(
      0,
      duracaoTotal - 2
    );

  const filtro = [
    `[0:a]adelay=${Math.round(
      tempoAntes * 1000
    )}|${Math.round(
      tempoAntes * 1000
    )},apad=pad_dur=${tempoDepois}[voz]`,

    `[1:a]volume=0.20,` +
      `atrim=duration=${duracaoTotal},` +
      `afade=t=out:st=${inicioFade}:d=2[trilha]`,

    `[voz][trilha]` +
      `amix=inputs=2:` +
      `duration=longest:` +
      `dropout_transition=0:` +
      `normalize=0,` +
      `atrim=duration=${duracaoTotal}[mix]`,
  ].join(";");

  await executarFFmpeg([
    "-y",

    "-i",
    vozPath,

    "-stream_loop",
    "-1",

    "-i",
    trilhaPath,

    "-filter_complex",
    filtro,

    "-map",
    "[mix]",

    "-c:a",
    "libmp3lame",

    "-b:a",
    "192k",

    "-ar",
    "44100",

    "-ac",
    "2",

    saidaPath,
  ]);

  const resultado =
    fs.readFileSync(
      saidaPath
    );

  fs.rmSync(
    pasta,
    {
      recursive: true,
      force: true,
    }
  );

  return resultado;
}

// =====================================================
// GERAR VOZ
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

      console.log(
        "GERANDO VOZ"
      );

      console.log(
        "================================="
      );

      if (
        !texto ||
        !String(texto).trim()
      ) {
        return res.status(400).json({
          erro:
            "Digite o texto da locução.",
        });
      }

      const apiKey =
        process.env.ELEVENLABS_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          erro:
            "ELEVENLABS_API_KEY não configurada.",
        });
      }

      const vozId =
        voiceId ||
        process.env.ELEVENLABS_VOICE_ID;

      if (!vozId) {
        return res.status(400).json({
          erro:
            "Nenhuma voz foi selecionada.",
        });
      }

      console.log(
        "Voz:",
        vozId
      );

      const resposta =
        await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${vozId}`,
          {
            method: "POST",

            headers: {
              "xi-api-key":
                apiKey,

              "Content-Type":
                "application/json",

              Accept:
                "audio/mpeg",
            },

            body: JSON.stringify({
              text: String(texto),

              model_id:
                process.env.ELEVENLABS_MODEL_ID ||
                "eleven_multilingual_v2",

              language_code:
                "pt",

              voice_settings: {
                stability: 0.45,

                similarity_boost:
                  0.8,

                style:
                  0.55,

                use_speaker_boost:
                  true,
              },

              output_format:
                "mp3_44100_128",
            }),
          }
        );

      if (!resposta.ok) {
        const erro =
          await resposta.text();

        console.error(
          "Erro ElevenLabs:"
        );

        console.error(
          erro
        );

        return res.status(
          resposta.status
        ).json({
          erro:
            erro ||
            "Erro ao gerar voz.",
        });
      }

      let audio =
        Buffer.from(
          await resposta.arrayBuffer()
        );

      if (
        speed &&
        Number(speed) !== 1
      ) {
        audio =
          await alterarVelocidade(
            audio,
            speed
          );
      }

      console.log(
        "Voz gerada com sucesso."
      );

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Content-Length",
        audio.length
      );

      return res.send(
        audio
      );
    } catch (erro) {
      console.error(
        "ERRO AO GERAR VOZ:"
      );

      console.error(
        erro
      );

      return res.status(500).json({
        erro:
          erro.message ||
          "Erro interno ao gerar voz.",
      });
    }
  }
);

// =====================================================
// MIXAR COM TRILHA DA FÁBRICA
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

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaSelecionada) {
        return res.status(400).json({
          erro:
            "Trilha não selecionada.",
        });
      }

      const vozBase64 =
        String(audioBase64)
          .replace(
            /^data:audio\/[^;]+;base64,/,
            ""
          );

      const voz =
        Buffer.from(
          vozBase64,
          "base64"
        );

      let trilhaNome =
        String(
          trilhaSelecionada
        ).replace(
          /^[/\\]+/,
          ""
        );

      const trilhaPath =
        path.join(
          PUBLIC_PATH,
          trilhaNome
        );

      if (
        !fs.existsSync(
          trilhaPath
        )
      ) {
        return res.status(404).json({
          erro:
            "Arquivo da trilha não encontrado.",
        });
      }

      const trilha =
        fs.readFileSync(
          trilhaPath
        );

      const resultado =
        await mixarAudio({
          voz,
          trilha,
          antes:
            segundosInicio,
          depois:
            segundosFinal,
        });

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="fabrica-da-voz.mp3"'
      );

      res.send(
        resultado
      );
    } catch (erro) {
      console.error(
        "ERRO NA MIXAGEM:"
      );

      console.error(
        erro
      );

      res.status(500).json({
        erro:
          erro.message ||
          "Erro ao mixar áudio.",
      });
    }
  }
);

// =====================================================
// MIXAR COM TRILHA ENVIADA PELO CLIENTE
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

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "Trilha do cliente não informada.",
        });
      }

      const voz =
        Buffer.from(
          String(
            audioBase64
          ).replace(
            /^data:audio\/[^;]+;base64,/,
            ""
          ),
          "base64"
        );

      const trilha =
        Buffer.from(
          String(
            trilhaBase64
          ).replace(
            /^data:audio\/[^;]+;base64,/,
            ""
          ),
          "base64"
        );

      const resultado =
        await mixarAudio({
          voz,
          trilha,
          antes:
            segundosInicio,
          depois:
            segundosFinal,
        });

      console.log(
        "Trilha do cliente mixada com sucesso."
      );

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="fabrica-da-voz.mp3"'
      );

      res.send(
        resultado
      );
    } catch (erro) {
      console.error(
        "ERRO NA TRILHA DO CLIENTE:"
      );

      console.error(
        erro
      );

      res.status(500).json({
        erro:
          erro.message ||
          "Erro ao mixar a trilha do cliente.",
      });
    }
  }
);

// =====================================================
// STATUS
// =====================================================

app.get(
  "/api/status",
  (req, res) => {
    res.json({
      ok: true,

      servidor:
        "Fábrica da Voz",

      porta: PORT,

      frontend:
        fs.existsSync(
          DIST_PATH
        ),

      ffmpeg:
        Boolean(ffmpegPath),

      geracaoVoz:
        Boolean(
          process.env
            .ELEVENLABS_API_KEY
        ),

      trilhaCliente:
        true,

      mixagem:
        true,

      fadeFinal:
        true,
    });
  }
);

// =====================================================
// ROTA PRINCIPAL
// =====================================================

app.get(
  "/",
  (req, res) => {
    const indexPath =
      path.join(
        DIST_PATH,
        "index.html"
      );

    if (
      fs.existsSync(
        indexPath
      )
    ) {
      return res.sendFile(
        indexPath
      );
    }

    return res.status(503).send(
      "Frontend não encontrado. Execute npm run build."
    );
  }
);

// =====================================================
// FALLBACK DO REACT
// =====================================================

app.get(
  /^\/(?!api\/).*/,
  (req, res) => {
    const indexPath =
      path.join(
        DIST_PATH,
        "index.html"
      );

    if (
      fs.existsSync(
        indexPath
      )
    ) {
      return res.sendFile(
        indexPath
      );
    }

    return res.status(404).send(
      "Página não encontrada."
    );
  }
);

// =====================================================
// ERROS
// =====================================================

app.use(
  (
    erro,
    req,
    res,
    next
  ) => {
    console.error(
      "ERRO EXPRESS:"
    );

    console.error(
      erro
    );

    if (
      res.headersSent
    ) {
      return next(
        erro
      );
    }

    res.status(500).json({
      erro:
        erro.message ||
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
        "      FÁBRICA DA VOZ"
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
        "Trilha do cliente: ATIVADA"
      );

      console.log(
        "================================="
      );

      console.log(
        "SERVIDOR PERMANECERÁ RODANDO..."
      );

      console.log("");
    }
  );

// =====================================================
// ERRO DO SERVIDOR
// =====================================================

server.on(
  "error",
  (erro) => {
    console.error(
      "ERRO DO SERVIDOR:"
    );

    console.error(
      erro
    );
  }
);

// =====================================================
// ERRO NÃO CAPTURADO
// =====================================================

process.on(
  "uncaughtException",
  (erro) => {
    console.error(
      "ERRO NÃO CAPTURADO:"
    );

    console.error(
      erro
    );
  }
);

// =====================================================
// PROMISE COM ERRO
// =====================================================

process.on(
  "unhandledRejection",
  (erro) => {
    console.error(
      "PROMISE COM ERRO:"
    );

    console.error(
      erro
    );
  }
);