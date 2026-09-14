const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const app = express();

/* =========================================================
   CONFIGURAÇÃO
========================================================= */

const PORT = Number(process.env.PORT) || 3000;

app.use(cors());

/*
  A trilha enviada pelo celular/computador vira Base64.
  Por isso precisamos permitir mais de 10 MB.
*/
app.use(
  express.json({
    limit: "60mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "60mb",
  })
);

/* =========================================================
   UPLOAD
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

/* =========================================================
   CAMINHO DO FRONTEND
========================================================= */

const distPath = path.join(__dirname, "dist");

/* =========================================================
   LOG
========================================================= */

console.log("");
console.log("==========================================");
console.log("       FÁBRICA DA VOZ - SERVIDOR");
console.log("==========================================");
console.log("Porta:", PORT);
console.log("Geração de voz: ATIVADA");
console.log("Mixagem: ATIVADA");
console.log("Trilha do cliente: ATIVADA");
console.log("==========================================");
console.log("");

/* =========================================================
   STATUS
========================================================= */

app.get("/api/status", (req, res) => {
  res.json({
    nome: "Fábrica da Voz",
    status: "online",
    mensagem: "Servidor funcionando corretamente.",
    voz: "ativada",
    mixagem: "ativada",
    trilha: "ativada",
  });
});

/* =========================================================
   ELEVENLABS
========================================================= */

async function gerarAudioElevenLabs({
  texto,
  voiceId,
  speed,
}) {
  const API_KEY = process.env.ELEVENLABS_API_KEY;

  if (!API_KEY) {
    throw new Error(
      "ELEVENLABS_API_KEY não configurada no servidor."
    );
  }

  /*
    O frontend usa:
    1
    1.25
    1.45

    A ElevenLabs aceita no máximo 1.2.
    Então limitamos corretamente.
  */

  const velocidade =
    Number.isFinite(Number(speed))
      ? Math.min(Math.max(Number(speed), 0.7), 1.2)
      : 1;

  console.log("");
  console.log("Chamando ElevenLabs...");
  console.log("Voice ID:", voiceId);
  console.log("Velocidade:", velocidade);

  const resposta = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId
    )}`,
    {
      method: "POST",

      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },

      body: JSON.stringify({
        text: String(texto),

        model_id: "eleven_multilingual_v2",

        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },

        speed: velocidade,
      }),
    }
  );

  if (!resposta.ok) {
    let erroTexto = "";

    try {
      erroTexto = await resposta.text();
    } catch {
      erroTexto =
        "Não foi possível ler a resposta da ElevenLabs.";
    }

    const erro = new Error(
      `ElevenLabs HTTP ${resposta.status}: ${
        erroTexto || "resposta sem detalhes"
      }`
    );

    erro.statusCode = resposta.status;
    erro.details = erroTexto;

    throw erro;
  }

  const audioArrayBuffer =
    await resposta.arrayBuffer();

  const audioBuffer =
    Buffer.from(audioArrayBuffer);

  if (!audioBuffer.length) {
    throw new Error(
      "A ElevenLabs retornou um áudio vazio."
    );
  }

  console.log(
    "Áudio recebido:",
    Math.round(audioBuffer.length / 1024),
    "KB"
  );

  return audioBuffer;
}

/* =========================================================
   ENVIAR MP3
========================================================= */

function enviarMp3(res, buffer, nomeArquivo) {
  res.setHeader(
    "Content-Type",
    "audio/mpeg"
  );

  res.setHeader(
    "Content-Length",
    buffer.length
  );

  res.setHeader(
    "Content-Disposition",
    `inline; filename="${nomeArquivo}"`
  );

  return res.send(buffer);
}

/* =========================================================
   GERAR VOZ
========================================================= */

app.post("/api/gerar-voz", async (req, res) => {
  try {
    console.log("");
    console.log("==========================================");
    console.log("NOVA SOLICITAÇÃO DE VOZ");
    console.log("==========================================");

    const texto = req.body?.texto;
    const voiceId = req.body?.voiceId;
    const speed = req.body?.speed;

    if (!texto || !String(texto).trim()) {
      return res.status(400).json({
        erro: "Digite um texto para gerar a voz.",
      });
    }

    if (!voiceId || !String(voiceId).trim()) {
      return res.status(400).json({
        erro: "Selecione uma voz.",
      });
    }

    console.log(
      "Texto:",
      String(texto).substring(0, 150)
    );

    const audioBuffer =
      await gerarAudioElevenLabs({
        texto,
        voiceId,
        speed,
      });

    return enviarMp3(
      res,
      audioBuffer,
      "fabrica-da-voz.mp3"
    );
  } catch (erro) {
    console.error("");
    console.error("ERRO NA GERAÇÃO:");
    console.error(erro);
    console.error("");

    const status =
      Number.isInteger(erro.statusCode) &&
      erro.statusCode >= 400 &&
      erro.statusCode <= 599
        ? erro.statusCode
        : 500;

    return res.status(status).json({
      erro:
        status === 500
          ? "Erro interno no servidor."
          : "A ElevenLabs recusou a geração da voz.",

      detalhes:
        erro.details ||
        erro.message ||
        "Erro desconhecido.",
    });
  }
});

/* =========================================================
   LOCALIZA TRILHA DA FÁBRICA
========================================================= */

function localizarTrilhaDaFabrica(
  trilhaSelecionada
) {
  if (
    !trilhaSelecionada ||
    typeof trilhaSelecionada !== "string"
  ) {
    throw new Error(
      "Nenhuma trilha da Fábrica foi selecionada."
    );
  }

  /*
    O App.tsx envia algo como:

    /trilhas/TRILHA PARA MERCADO.mp3
  */

  let caminhoRelativo;

  try {
    caminhoRelativo =
      decodeURIComponent(trilhaSelecionada);
  } catch {
    caminhoRelativo = trilhaSelecionada;
  }

  caminhoRelativo =
    caminhoRelativo.replace(/^\/+/, "");

  const caminhoCompleto =
    path.resolve(
      distPath,
      caminhoRelativo
    );

  const distReal =
    path.resolve(distPath);

  /*
    Segurança:
    não permite acessar arquivos fora do dist.
  */

  if (
    caminhoCompleto !== distReal &&
    !caminhoCompleto.startsWith(
      distReal + path.sep
    )
  ) {
    throw new Error(
      "Caminho da trilha inválido."
    );
  }

  if (!fs.existsSync(caminhoCompleto)) {
    throw new Error(
      `Trilha não encontrada no servidor: ${trilhaSelecionada}`
    );
  }

  return caminhoCompleto;
}

/* =========================================================
   BASE64 → BUFFER
========================================================= */

function base64ParaBuffer(valor) {
  if (
    !valor ||
    typeof valor !== "string"
  ) {
    throw new Error(
      "Áudio em Base64 não informado."
    );
  }

  let base64 = valor;

  /*
    Caso venha assim:

    data:audio/mpeg;base64,AAAA...
  */

  if (base64.includes(",")) {
    base64 =
      base64.substring(
        base64.indexOf(",") + 1
      );
  }

  base64 = base64.replace(/\s/g, "");

  const buffer =
    Buffer.from(base64, "base64");

  if (!buffer.length) {
    throw new Error(
      "O áudio Base64 está vazio."
    );
  }

  return buffer;
}

/* =========================================================
   MIXAGEM COM FFMPEG
========================================================= */

function mixarAudio(
  voz,
  trilha,
  saida,
  segundosInicio = 5,
  segundosFinal = 5
) {
  return new Promise(
    (resolve, reject) => {
      const ffmpeg =
        require("ffmpeg-static");

      if (!ffmpeg) {
        reject(
          new Error(
            "FFmpeg não encontrado."
          )
        );

        return;
      }

      const inicio = Math.min(
        60,
        Math.max(
          0,
          Number(segundosInicio) || 0
        )
      );

      const final = Math.min(
        60,
        Math.max(
          0,
          Number(segundosFinal) || 0
        )
      );

      /*
        A voz começa depois de segundosInicio.

        Depois da voz:
        apad mantém silêncio pelo tempo
        definido em segundosFinal.

        Como a música está em loop,
        ela acompanha todo o áudio.

        Resultado:

        TRILHA
        ↓
        segundosInicio
        ↓
        VOZ
        ↓
        segundosFinal
        ↓
        FIM
      */

      const atrasoMs =
        Math.round(inicio * 1000);

      console.log("");
      console.log(
        "=========================================="
      );
      console.log("INICIANDO FFMPEG");
      console.log(
        "Trilha antes:",
        inicio,
        "segundos"
      );
      console.log(
        "Trilha depois:",
        final,
        "segundos"
      );
      console.log(
        "=========================================="
      );

      const filtro =
        `[0:a]aresample=44100,adelay=${atrasoMs}:all=1,apad=pad_dur=${final}[voice];` +
        `[1:a]aresample=44100,volume=0.18,aloop=loop=-1:size=2e+09[music];` +
        `[voice][music]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[out]`;

      const argumentos = [
        "-y",

        "-i",
        voz,

        "-i",
        trilha,

        "-filter_complex",
        filtro,

        "-map",
        "[out]",

        "-ac",
        "2",

        "-ar",
        "44100",

        "-codec:a",
        "libmp3lame",

        "-b:a",
        "192k",

        saida,
      ];

      console.log(
        "Executando FFmpeg..."
      );

      const processo =
        spawn(
          ffmpeg,
          argumentos
        );

      let erroFFmpeg = "";

      processo.stderr.on(
        "data",
        dados => {
          const texto =
            dados.toString();

          erroFFmpeg += texto;

          /*
            Mostra no log somente uma parte.
          */

          if (
            texto.includes("Error") ||
            texto.includes("error")
          ) {
            console.error(
              "FFmpeg:",
              texto
            );
          }
        }
      );

      processo.on(
        "error",
        erro => {
          console.error(
            "Erro ao iniciar FFmpeg:",
            erro
          );

          reject(erro);
        }
      );

      processo.on(
        "close",
        codigo => {
          if (codigo === 0) {
            console.log(
              "FFmpeg terminou corretamente."
            );

            if (
              !fs.existsSync(
                saida
              )
            ) {
              reject(
                new Error(
                  "FFmpeg terminou, mas não criou o arquivo final."
                )
              );

              return;
            }

            const tamanho =
              fs.statSync(
                saida
              ).size;

            if (!tamanho) {
              reject(
                new Error(
                  "O arquivo final está vazio."
                )
              );

              return;
            }

            console.log(
              "Arquivo final:",
              Math.round(
                tamanho / 1024
              ),
              "KB"
            );

            resolve();
            return;
          }

          console.error(
            "FFmpeg código:",
            codigo
          );

          reject(
            new Error(
              `FFmpeg falhou. ${erroFFmpeg.slice(
                -2500
              )}`
            )
          );
        }
      );
    }
  );
}

/* =========================================================
   ROTA - MIXAR VOZ + TRILHA DA FÁBRICA
========================================================= */

app.post(
  "/api/mixar-voz",
  async (req, res) => {
    let vozPath = null;
    let saidaPath = null;

    try {
      console.log("");
      console.log(
        "=========================================="
      );
      console.log(
        "MIXAGEM COM TRILHA DA FÁBRICA"
      );
      console.log(
        "=========================================="
      );

      const audioBase64 =
        req.body?.audioBase64;

      const trilhaSelecionada =
        req.body?.trilhaSelecionada;

      const segundosInicio =
        req.body?.segundosInicio ?? 5;

      const segundosFinal =
        req.body?.segundosFinal ?? 5;

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaSelecionada) {
        return res.status(400).json({
          erro:
            "Selecione uma trilha.",
        });
      }

      const trilhaPath =
        localizarTrilhaDaFabrica(
          trilhaSelecionada
        );

      const audioBuffer =
        base64ParaBuffer(
          audioBase64
        );

      const pastaTemp =
        os.tmpdir();

      const id =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

      vozPath =
        path.join(
          pastaTemp,
          `voz-${id}.mp3`
        );

      saidaPath =
        path.join(
          pastaTemp,
          `mix-${id}.mp3`
        );

      fs.writeFileSync(
        vozPath,
        audioBuffer
      );

      console.log(
        "Voz temporária:",
        vozPath
      );

      console.log(
        "Trilha:",
        trilhaPath
      );

      await mixarAudio(
        vozPath,
        trilhaPath,
        saidaPath,
        segundosInicio,
        segundosFinal
      );

      const resultado =
        fs.readFileSync(
          saidaPath
        );

      const envio =
        enviarMp3(
          res,
          resultado,
          "fabrica-da-voz-mixagem.mp3"
        );

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        saidaPath
      );

      return envio;
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO NA MIXAGEM DA FÁBRICA:"
      );
      console.error(erro);
      console.error("");

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        saidaPath
      );

      if (res.headersSent) {
        return;
      }

      return res.status(500).json({
        erro:
          "Não foi possível mixar a voz com a trilha.",

        detalhes:
          erro.message ||
          "Erro desconhecido.",
      });
    }
  }
);

/* =========================================================
   ROTA - MIXAR VOZ + TRILHA DO CLIENTE
========================================================= */

app.post(
  "/api/mixar-upload",
  async (req, res) => {
    let vozPath = null;
    let trilhaPath = null;
    let saidaPath = null;

    try {
      console.log("");
      console.log(
        "=========================================="
      );
      console.log(
        "MIXAGEM COM TRILHA DO CLIENTE"
      );
      console.log(
        "=========================================="
      );

      const audioBase64 =
        req.body?.audioBase64;

      const trilhaBase64 =
        req.body?.trilhaBase64;

      const segundosInicio =
        req.body?.segundosInicio ?? 5;

      const segundosFinal =
        req.body?.segundosFinal ?? 5;

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Áudio da voz não informado.",
        });
      }

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "A trilha do cliente não foi enviada.",
        });
      }

      const audioBuffer =
        base64ParaBuffer(
          audioBase64
        );

      const trilhaBuffer =
        base64ParaBuffer(
          trilhaBase64
        );

      const pastaTemp =
        os.tmpdir();

      const id =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

      vozPath =
        path.join(
          pastaTemp,
          `voz-${id}.mp3`
        );

      trilhaPath =
        path.join(
          pastaTemp,
          `trilha-${id}.mp3`
        );

      saidaPath =
        path.join(
          pastaTemp,
          `mix-${id}.mp3`
        );

      fs.writeFileSync(
        vozPath,
        audioBuffer
      );

      fs.writeFileSync(
        trilhaPath,
        trilhaBuffer
      );

      console.log(
        "Voz temporária criada."
      );

      console.log(
        "Trilha do cliente recebida:",
        Math.round(
          trilhaBuffer.length / 1024
        ),
        "KB"
      );

      await mixarAudio(
        vozPath,
        trilhaPath,
        saidaPath,
        segundosInicio,
        segundosFinal
      );

      const resultado =
        fs.readFileSync(
          saidaPath
        );

      const envio =
        enviarMp3(
          res,
          resultado,
          "fabrica-da-voz-mixagem.mp3"
        );

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        trilhaPath
      );

      apagarArquivo(
        saidaPath
      );

      return envio;
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO NA MIXAGEM DO CLIENTE:"
      );
      console.error(erro);
      console.error("");

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        trilhaPath
      );

      apagarArquivo(
        saidaPath
      );

      if (res.headersSent) {
        return;
      }

      return res.status(500).json({
        erro:
          "Não foi possível mixar a trilha do cliente.",

        detalhes:
          erro.message ||
          "Erro desconhecido.",
      });
    }
  }
);

/* =========================================================
   ROTA ANTIGA - GERAR VOZ COM TRILHA
   Mantida para compatibilidade
========================================================= */

app.post(
  "/api/gerar-voz-com-trilha",
  upload.single("trilha"),
  async (req, res) => {
    let vozPath = null;
    let trilhaPath = null;
    let saidaPath = null;

    try {
      const texto =
        req.body?.texto;

      const voiceId =
        req.body?.voiceId;

      const speed =
        req.body?.speed;

      if (
        !texto ||
        !String(texto).trim()
      ) {
        return res.status(400).json({
          erro:
            "Texto não informado.",
        });
      }

      if (
        !voiceId ||
        !String(voiceId).trim()
      ) {
        return res.status(400).json({
          erro:
            "Voz não selecionada.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          erro:
            "Nenhuma trilha foi enviada.",
        });
      }

      const audio =
        await gerarAudioElevenLabs({
          texto,
          voiceId,
          speed,
        });

      const pastaTemp =
        os.tmpdir();

      const id =
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

      vozPath =
        path.join(
          pastaTemp,
          `voz-${id}.mp3`
        );

      trilhaPath =
        path.join(
          pastaTemp,
          `trilha-${id}.mp3`
        );

      saidaPath =
        path.join(
          pastaTemp,
          `mix-${id}.mp3`
        );

      fs.writeFileSync(
        vozPath,
        audio
      );

      fs.writeFileSync(
        trilhaPath,
        req.file.buffer
      );

      await mixarAudio(
        vozPath,
        trilhaPath,
        saidaPath,
        5,
        5
      );

      const resultado =
        fs.readFileSync(
          saidaPath
        );

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        trilhaPath
      );

      apagarArquivo(
        saidaPath
      );

      return enviarMp3(
        res,
        resultado,
        "fabrica-da-voz-mixagem.mp3"
      );
    } catch (erro) {
      console.error(
        "Erro em gerar-voz-com-trilha:",
        erro
      );

      apagarArquivo(
        vozPath
      );

      apagarArquivo(
        trilhaPath
      );

      apagarArquivo(
        saidaPath
      );

      if (res.headersSent) {
        return;
      }

      return res.status(500).json({
        erro:
          "Não foi possível gerar a mixagem.",

        detalhes:
          erro.message ||
          "Erro desconhecido.",
      });
    }
  }
);

/* =========================================================
   ARQUIVO TEMPORÁRIO
========================================================= */

function apagarArquivo(
  arquivo
) {
  if (!arquivo) {
    return;
  }

  try {
    if (
      fs.existsSync(
        arquivo
      )
    ) {
      fs.unlinkSync(
        arquivo
      );

      console.log(
        "Arquivo temporário removido:",
        arquivo
      );
    }
  } catch (erro) {
    console.log(
      "Não foi possível apagar:",
      arquivo,
      erro.message
    );
  }
}

/* =========================================================
   FRONTEND VITE
========================================================= */

app.use(
  express.static(
    distPath
  )
);

/* =========================================================
   FALLBACK DO FRONTEND
========================================================= */

app.get(
  "/{*splat}",
  (req, res) => {
    const indexPath =
      path.join(
        distPath,
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

    return res
      .status(404)
      .send(
        "Frontend não encontrado. Execute o build do Vite."
      );
  }
);

/* =========================================================
   ERROS
========================================================= */

app.use(
  (
    erro,
    req,
    res,
    next
  ) => {
    if (
      erro instanceof
      multer.MulterError
    ) {
      return res
        .status(400)
        .json({
          erro:
            "Erro no upload da trilha.",

          detalhes:
            erro.message,
        });
    }

    if (erro) {
      console.error(
        "Erro não tratado:",
        erro
      );

      if (
        res.headersSent
      ) {
        return next(
          erro
        );
      }

      return res
        .status(500)
        .json({
          erro:
            "Erro interno do servidor.",

          detalhes:
            erro.message ||
            "Erro desconhecido.",
        });
    }

    return next();
  }
);

/* =========================================================
   INICIA SERVIDOR
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "      FÁBRICA DA VOZ ESTÁ ONLINE"
    );
    console.log(
      "=========================================="
    );
    console.log(
      `Porta: ${PORT}`
    );
    console.log(
      "API: ATIVA"
    );
    console.log(
      "Geração de voz: ATIVA"
    );
    console.log(
      "Mixagem: ATIVA"
    );
    console.log(
      "Trilha do cliente: ATIVA"
    );
    console.log(
      "Servidor: RODANDO"
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);