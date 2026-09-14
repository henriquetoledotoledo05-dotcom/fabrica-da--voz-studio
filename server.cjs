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

const PORT = process.env.PORT || 3010;

app.use(cors());

app.use(express.json({
  limit: "10mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "10mb"
}));

/* =========================================================
   UPLOAD DE TRILHA
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});

/* =========================================================
   LOG INICIAL
========================================================= */

console.log("");
console.log("==========================================");
console.log("       FÁBRICA DA VOZ - SERVIDOR");
console.log("==========================================");
console.log("Porta:", PORT);
console.log("Geração de voz: ATIVADA");
console.log("Trilha do cliente: ATIVADA");
console.log("==========================================");
console.log("");

/* =========================================================
   STATUS
========================================================= */

app.get("/{*splat}",(req, res) => {
  res.json({
    nome: "Fábrica da Voz",
    status: "online",
    mensagem: "Servidor funcionando corretamente.",
    voz: "ativada",
    trilha: "ativada"
  });
});

/* =========================================================
   ROTA PRINCIPAL DE GERAÇÃO DE VOZ
========================================================= */

app.post("/api/gerar-voz", async (req, res) => {
  try {

    console.log("");
    console.log("==========================================");
    console.log("NOVA SOLICITAÇÃO DE VOZ");
    console.log("==========================================");

    const {
      texto,
      voiceId,
      speed
    } = req.body;

    /* -----------------------------------------
       VALIDAÇÕES
    ----------------------------------------- */

    if (!texto || !String(texto).trim()) {

      console.log("ERRO: texto não informado");

      return res.status(400).json({
        erro: "Digite um texto para gerar a voz."
      });
    }

    if (!voiceId) {

      console.log("ERRO: voz não selecionada");

      return res.status(400).json({
        erro: "Selecione uma voz."
      });
    }

    /* -----------------------------------------
       CHAVE DA ELEVENLABS
    ----------------------------------------- */

    const API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!API_KEY) {

      console.log("ERRO: ELEVENLABS_API_KEY não encontrada");

      return res.status(500).json({
        erro: "A chave da ElevenLabs não está configurada no Render."
      });
    }

    console.log("Voz:", voiceId);
    console.log("Texto:", texto.substring(0, 100));

    /* -----------------------------------------
       VELOCIDADE
    ----------------------------------------- */

    let velocidade = Number(speed);

    if (!Number.isFinite(velocidade)) {
      velocidade = 1;
    }

    if (velocidade < 0.7) {
      velocidade = 0.7;
    }

    if (velocidade > 1.2) {
      velocidade = 1.2;
    }

    /* -----------------------------------------
       CHAMADA ELEVENLABS
    ----------------------------------------- */

    const resposta = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",

        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },

        body: JSON.stringify({
          text: String(texto),

          model_id: "eleven_multilingual_v2",

          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.35,
            use_speaker_boost: true
          },

          speed: velocidade
        })
      }
    );

    /* -----------------------------------------
       ERRO DA ELEVENLABS
    ----------------------------------------- */

    if (!resposta.ok) {

      const erroTexto = await resposta.text();

      console.log("");
      console.log("ERRO ELEVENLABS:");
      console.log(erroTexto);
      console.log("");

      return res.status(resposta.status).json({
        erro: "A ElevenLabs recusou a geração da voz.",
        detalhes: erroTexto
      });
    }

    /* -----------------------------------------
       RECEBE O ÁUDIO
    ----------------------------------------- */

    const audioArrayBuffer = await resposta.arrayBuffer();

    const audioBuffer = Buffer.from(audioArrayBuffer);

    if (!audioBuffer.length) {

      return res.status(500).json({
        erro: "A ElevenLabs retornou um áudio vazio."
      });
    }

    console.log(
      "Áudio gerado:",
      Math.round(audioBuffer.length / 1024),
      "KB"
    );

    /* -----------------------------------------
       RETORNA MP3
    ----------------------------------------- */

    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Content-Length",
      audioBuffer.length
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="fabrica-da-voz.mp3"'
    );

    res.send(audioBuffer);

  } catch (erro) {

    console.error("");
    console.error("ERRO GERAL NA GERAÇÃO:");
    console.error(erro);
    console.error("");

    return res.status(500).json({
      erro: "Erro interno no servidor.",
      detalhes: erro.message
    });
  }
});

/* =========================================================
   ROTA PARA GERAR VOZ + TRILHA
========================================================= */

/*
   Essa rota aceita:

   - texto
   - voiceId
   - speed
   - trilha

   A trilha pode ser enviada como arquivo.

   O frontend pode usar FormData.
*/

app.post(
  "/api/gerar-voz-com-trilha",
  upload.single("trilha"),
  async (req, res) => {

    let vozPath = null;
    let trilhaPath = null;
    let saidaPath = null;

    try {

      console.log("");
      console.log("==========================================");
      console.log("GERAÇÃO COM TRILHA");
      console.log("==========================================");

      const texto = req.body.texto;
      const voiceId = req.body.voiceId;
      const speed = Number(req.body.speed || 1);

      if (!texto) {

        return res.status(400).json({
          erro: "Texto não informado."
        });
      }

      if (!voiceId) {

        return res.status(400).json({
          erro: "Voz não selecionada."
        });
      }

      const API_KEY = process.env.ELEVENLABS_API_KEY;

      if (!API_KEY) {

        return res.status(500).json({
          erro: "ELEVENLABS_API_KEY não configurada no Render."
        });
      }

      /* -----------------------------------------
         GERA A VOZ
      ----------------------------------------- */

      const resposta = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",

          headers: {
            "xi-api-key": API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
          },

          body: JSON.stringify({
            text: String(texto),

            model_id: "eleven_multilingual_v2",

            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.80,
              style: 0.35,
              use_speaker_boost: true
            },

            speed: Number.isFinite(speed)
              ? Math.min(Math.max(speed, 0.7), 1.2)
              : 1
          })
        }
      );

      if (!resposta.ok) {

        const erro = await resposta.text();

        console.error(
          "Erro ElevenLabs:",
          erro
        );

        return res.status(resposta.status).json({
          erro: "Erro ao gerar a voz.",
          detalhes: erro
        });
      }

      const audio = Buffer.from(
        await resposta.arrayBuffer()
      );

      /* -----------------------------------------
         SALVA VOZ TEMPORARIAMENTE
      ----------------------------------------- */

      const pastaTemp = os.tmpdir();

      const id = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}`;

      vozPath = path.join(
        pastaTemp,
        `voz-${id}.mp3`
      );

      saidaPath = path.join(
        pastaTemp,
        `mix-${id}.mp3`
      );

      fs.writeFileSync(
        vozPath,
        audio
      );

      /* -----------------------------------------
         SEM TRILHA
      ----------------------------------------- */

      if (!req.file) {

        console.log(
          "Nenhuma trilha enviada."
        );

        res.setHeader(
          "Content-Type",
          "audio/mpeg"
        );

        res.setHeader(
          "Content-Disposition",
          'inline; filename="fabrica-da-voz.mp3"'
        );

        res.send(audio);

        apagarArquivo(vozPath);

        return;
      }

      /* -----------------------------------------
         SALVA TRILHA
      ----------------------------------------- */

      const extensaoOriginal =
        path.extname(req.file.originalname)
          .toLowerCase() || ".mp3";

      trilhaPath = path.join(
        pastaTemp,
        `trilha-${id}${extensaoOriginal}`
      );

      fs.writeFileSync(
        trilhaPath,
        req.file.buffer
      );

      console.log(
        "Trilha recebida:",
        req.file.originalname
      );

      /* -----------------------------------------
         MIXAGEM
      ----------------------------------------- */

      await mixarAudio(
        vozPath,
        trilhaPath,
        saidaPath
      );

      /* -----------------------------------------
         ENVIA MIXAGEM
      ----------------------------------------- */

      const resultado = fs.readFileSync(
        saidaPath
      );

      console.log(
        "Mixagem concluída:",
        Math.round(resultado.length / 1024),
        "KB"
      );

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Content-Length",
        resultado.length
      );

      res.setHeader(
        "Content-Disposition",
        'inline; filename="fabrica-da-voz-mixagem.mp3"'
      );

      res.send(resultado);

      /* -----------------------------------------
         LIMPEZA
      ----------------------------------------- */

      apagarArquivo(vozPath);
      apagarArquivo(trilhaPath);
      apagarArquivo(saidaPath);

    } catch (erro) {

      console.error("");
      console.error(
        "ERRO NA MIXAGEM:"
      );
      console.error(erro);
      console.error("");

      apagarArquivo(vozPath);
      apagarArquivo(trilhaPath);
      apagarArquivo(saidaPath);

      return res.status(500).json({
        erro: "Não foi possível gerar a mixagem.",
        detalhes: erro.message
      });
    }
  }
);

/* =========================================================
   FUNÇÃO DE MIXAGEM
========================================================= */

function mixarAudio(
  voz,
  trilha,
  saida
) {

  return new Promise((resolve, reject) => {

    /*
      A trilha fica mais baixa
      para não cobrir a locução.

      Volume da trilha:
      0.18

      Volume da voz:
      1.00
    */

    const ffmpeg =
      require("ffmpeg-static");

    if (!ffmpeg) {

      return reject(
        new Error(
          "FFmpeg não encontrado."
        )
      );
    }

    const argumentos = [

      "-y",

      "-i",
      voz,

      "-i",
      trilha,

      "-filter_complex",

      "[1:a]volume=0.18,aloop=loop=-1:size=2e+09[bg];" +
      "[0:a]aresample=44100[voice];" +
      "[bg]aresample=44100[music];" +
      "[voice][music]amix=inputs=2:" +
      "duration=first:" +
      "dropout_transition=2:normalize=0[out]",

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

      saida
    ];

    console.log(
      "Iniciando FFmpeg..."
    );

    const processo = spawn(
      ffmpeg,
      argumentos
    );

    let erroFFmpeg = "";

    processo.stderr.on(
      "data",
      (dados) => {

        erroFFmpeg +=
          dados.toString();
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

          console.log(
            "FFmpeg terminou corretamente."
          );

          resolve();

        } else {

          console.error(
            "FFmpeg código:",
            codigo
          );

          reject(
            new Error(
              `FFmpeg falhou. ${erroFFmpeg.slice(-1000)}`
            )
          );
        }
      }
    );
  });
}

/* =========================================================
   LIMPA ARQUIVO TEMPORÁRIO
========================================================= */

function apagarArquivo(arquivo) {

  if (!arquivo) {
    return;
  }

  try {

    if (fs.existsSync(arquivo)) {
      fs.unlinkSync(arquivo);
    }

  } catch (erro) {

    console.log(
      "Não foi possível apagar:",
      arquivo
    );
  }
}

/* =========================================================
   FRONTEND DO VITE
========================================================= */

const distPath =
  path.join(__dirname, "dist");

app.use(
  express.static(distPath)
);

/* =========================================================
   ROTAS DO FRONTEND
========================================================= */

app.get(
  "*",
  (req, res) => {

    const indexPath =
      path.join(
        distPath,
        "index.html"
      );

    if (fs.existsSync(indexPath)) {

      res.sendFile(indexPath);

    } else {

      res.status(404).send(
        "Frontend não encontrado. Execute o build do Vite."
      );
    }
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
    console.log("==========================================");
    console.log("      FÁBRICA DA VOZ ESTÁ ONLINE");
    console.log("==========================================");
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
      "Servidor: RODANDO"
    );
    console.log("==========================================");
    console.log("");
  }
);