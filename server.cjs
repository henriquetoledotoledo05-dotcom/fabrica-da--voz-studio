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

// =====================================================
// CONFIGURAÇÃO
// =====================================================

app.use(cors());

app.use(
  express.json({
    limit: "100mb",
  })
);

app.use(express.urlencoded({
  extended: true,
  limit: "100mb",
}));

// =====================================================
// FFMPEG
// =====================================================

if (!ffmpegPath) {
  console.error("");
  console.error("ERRO: FFmpeg não encontrado.");
  console.error("");
  process.exit(1);
}

console.log("FFmpeg encontrado:");
console.log(ffmpegPath);

// =====================================================
// FUNÇÃO PARA PEGAR DURAÇÃO DO ÁUDIO
// =====================================================

function obterDuracao(audioPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(ffmpegPath, [
      "-i",
      audioPath,
    ]);

    let saida = "";
    let erro = "";

    ffprobe.stderr.on("data", (data) => {
      erro += data.toString();
    });

    ffprobe.stdout.on("data", (data) => {
      saida += data.toString();
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });

    ffprobe.on("close", () => {
      const resultado =
        erro.match(
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

      const duracao =
        horas * 3600 +
        minutos * 60 +
        segundos;

      resolve(duracao);
    });
  });
}

// =====================================================
// ALTERAR VELOCIDADE
// =====================================================

function alterarVelocidade(
  audioBuffer,
  speed
) {
  return new Promise((resolve, reject) => {

    let velocidade =
      Number(speed) || 1;

    velocidade = Math.max(
      0.5,
      Math.min(2, velocidade)
    );

    console.log(
      "Velocidade:",
      velocidade
    );

    const ffmpeg = spawn(
      ffmpegPath,
      [
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
      ]
    );

    const partes = [];
    let erro = "";

    ffmpeg.stdout.on(
      "data",
      (parte) => {
        partes.push(parte);
      }
    );

    ffmpeg.stderr.on(
      "data",
      (parte) => {
        erro += parte.toString();
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

        if (codigo === 0) {

          resolve(
            Buffer.concat(partes)
          );

        } else {

          console.error(
            "Erro na velocidade:"
          );

          console.error(erro);

          reject(
            new Error(
              erro ||
              "Erro ao alterar velocidade."
            )
          );
        }
      }
    );

    ffmpeg.stdin.end(
      audioBuffer
    );
  });
}

// =====================================================
// MIXAGEM PROFISSIONAL
//
// SEGUNDOS ANTES
// + VOZ
// + SEGUNDOS DEPOIS
// + FADE OUT NOS ÚLTIMOS 2 SEGUNDOS
// =====================================================

function mixarAudio(
  vozBuffer,
  trilhaBuffer,
  segundosInicio,
  segundosFinal
) {
  return new Promise(
    (resolve, reject) => {

      let inicio =
        Number(segundosInicio);

      let final =
        Number(segundosFinal);

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

      console.log("");
      console.log(
        "================================="
      );
      console.log(
        "INICIANDO MIXAGEM"
      );
      console.log(
        "Segundos antes:",
        inicio
      );
      console.log(
        "Segundos depois:",
        final
      );
      console.log(
        "================================="
      );

      // ------------------------------------------------
      // CRIA ARQUIVOS TEMPORÁRIOS
      // ------------------------------------------------

      const pastaTemp =
        fs.mkdtempSync(
          path.join(
            os.tmpdir(),
            "fabrica-"
          )
        );

      const vozPath =
        path.join(
          pastaTemp,
          "voz.mp3"
        );

      const trilhaPath =
        path.join(
          pastaTemp,
          "trilha.mp3"
        );

      const saidaPath =
        path.join(
          pastaTemp,
          "final.mp3"
        );

      fs.writeFileSync(
        vozPath,
        vozBuffer
      );

      fs.writeFileSync(
        trilhaPath,
        trilhaBuffer
      );

      // ------------------------------------------------
      // DESCOBRE DURAÇÃO DA VOZ
      // ------------------------------------------------

      obterDuracao(vozPath)
        .then((duracaoVoz) => {

          const duracaoTotal =
            inicio +
            duracaoVoz +
            final;

          console.log(
            "Duração da voz:",
            duracaoVoz
          );

          console.log(
            "Duração final:",
            duracaoTotal
          );

          // ------------------------------------------------
          // FADE COMEÇA 2 SEGUNDOS ANTES DO FIM
          // ------------------------------------------------

          const inicioFade =
            Math.max(
              0,
              duracaoTotal - 2
            );

          // ------------------------------------------------
          // FFMPEG
          // ------------------------------------------------

          const argumentos = [

            "-hide_banner",

            "-loglevel",
            "error",

            // VOZ
            "-i",
            vozPath,

            // TRILHA
            "-stream_loop",
            "-1",

            "-i",
            trilhaPath,

            // ------------------------------------------------
            // FILTROS
            // ------------------------------------------------

            "-filter_complex",

            // VOZ:
            // começa depois dos segundos escolhidos
            //
            // e recebe silêncio depois
            //
            // TRILHA:
            // volume 20%
            //
            // depois cortamos a trilha exatamente
            // no tamanho final
            //
            // e fazemos fade nos últimos 2 segundos
            //

            `[0:a]adelay=${Math.round(
              inicio * 1000
            )}|${Math.round(
              inicio * 1000
            )},apad=pad_dur=${final}[voz];` +

            `[1:a]volume=0.20,` +
            `atrim=duration=${duracaoTotal},` +
            `afade=t=out:st=${inicioFade}:d=2[trilha];` +

            `[voz][trilha]` +
            `amix=inputs=2:` +
            `duration=first:` +
            `dropout_transition=0:` +
            `normalize=0,` +
            `atrim=duration=${duracaoTotal}` +
            `[out]`,

            // ------------------------------------------------
            // SAÍDA
            // ------------------------------------------------

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

          const ffmpeg =
            spawn(
              ffmpegPath,
              argumentos
            );

          let erro = "";

          ffmpeg.stderr.on(
            "data",
            (data) => {
              erro +=
                data.toString();
            }
          );

          ffmpeg.on(
            "error",
            (err) => {

              console.error(
                "Erro FFmpeg:",
                err
              );

              reject(err);
            }
          );

          ffmpeg.on(
            "close",
            (codigo) => {

              if (codigo !== 0) {

                console.error(
                  "FFmpeg falhou:"
                );

                console.error(
                  erro
                );

                reject(
                  new Error(
                    erro ||
                    "Erro ao mixar."
                  )
                );

                return;
              }

              try {

                const resultado =
                  fs.readFileSync(
                    saidaPath
                  );

                console.log("");
                console.log(
                  "================================="
                );
                console.log(
                  "MIXAGEM CONCLUÍDA"
                );
                console.log(
                  "Tamanho:",
                  resultado.length
                );
                console.log(
                  "================================="
                );
                console.log("");

                // Limpa arquivos temporários

                try {
                  fs.rmSync(
                    pastaTemp,
                    {
                      recursive: true,
                      force: true,
                    }
                  );
                } catch {}

                resolve(
                  resultado
                );

              } catch (err) {

                reject(err);
              }
            }
          );
        })
        .catch((err) => {

          try {
            fs.rmSync(
              pastaTemp,
              {
                recursive: true,
                force: true,
              }
            );
          } catch {}

          reject(err);
        });
    }
  );
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

      // ------------------------------------------------
      // VALIDA TEXTO
      // ------------------------------------------------

      if (
        !texto ||
        !texto.trim()
      ) {

        return res.status(400).json({
          erro:
            "Digite um texto.",
        });
      }

      // ------------------------------------------------
      // VALIDA VOZ
      // ------------------------------------------------

      if (!voiceId) {

        return res.status(400).json({
          erro:
            "Nenhuma voz foi selecionada.",
        });
      }

      // ------------------------------------------------
      // API
      // ------------------------------------------------

      if (
        !process.env
          .ELEVENLABS_API_KEY
      ) {

        return res.status(500).json({
          erro:
            "ELEVENLABS_API_KEY não configurada.",
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

      // ------------------------------------------------
      // ELEVENLABS
      // ------------------------------------------------

      const resposta =
        await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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

      // ------------------------------------------------
      // ERRO
      // ------------------------------------------------

      if (!resposta.ok) {

        const erro =
          await resposta.text();

        console.error(
          "ELEVENLABS ERRO:"
        );

        console.error(
          erro
        );

        return res
          .status(
            resposta.status
          )
          .json({
            erro:
              erro ||
              "Erro na ElevenLabs.",
          });
      }

      // ------------------------------------------------
      // RECEBE ÁUDIO
      // ------------------------------------------------

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

      // ------------------------------------------------
      // VELOCIDADE
      // ------------------------------------------------

      if (
        speed &&
        Number(speed) !== 1
      ) {

        audio =
          await alterarVelocidade(
            audio,
            Number(speed)
          );
      }

      // ------------------------------------------------
      // ENVIA ÁUDIO
      // ------------------------------------------------

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          audio.length.toString(),
      });

      res.send(audio);

    } catch (erro) {

      console.error("");
      console.error(
        "ERRO AO GERAR VOZ:"
      );
      console.error(
        erro
      );

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

      const base64Limpo =
        audioBase64.replace(
          /^data:audio\/[^;]+;base64,/,
          ""
        );

      const vozBuffer =
        Buffer.from(
          base64Limpo,
          "base64"
        );

      if (!vozBuffer.length) {

        return res.status(400).json({
          erro:
            "Áudio da voz vazio.",
        });
      }

      // ------------------------------------------------
      // TRILHA
      // ------------------------------------------------

      const nomeTrilha =
        trilhaSelecionada.replace(
          /^[/\\]+/,
          ""
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

        return res.status(404).json({
          erro:
            "Trilha não encontrada.",
        });
      }

      const trilhaBuffer =
        fs.readFileSync(
          trilhaPath
        );

      // ------------------------------------------------
      // MIXAGEM
      // ------------------------------------------------

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
      });

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
          "Erro ao mixar os áudios.",
      });
    }
  }
);

// =====================================================
// MIXAGEM COM TRILHA ENVIADA PELO CLIENTE
// =====================================================
//
// O frontend poderá enviar:
// - audioBase64
// - trilhaBase64
// - segundosInicio
// - segundosFinal
//
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

      // ------------------------------------------------
      // VOZ
      // ------------------------------------------------

      const vozLimpa =
        audioBase64.replace(
          /^data:audio\/[^;]+;base64,/,
          ""
        );

      const vozBuffer =
        Buffer.from(
          vozLimpa,
          "base64"
        );

      // ------------------------------------------------
      // TRILHA
      // ------------------------------------------------

      const trilhaLimpa =
        trilhaBase64.replace(
          /^data:audio\/[^;]+;base64,/,
          ""
        );

      const trilhaBuffer =
        Buffer.from(
          trilhaLimpa,
          "base64"
        );

      if (!vozBuffer.length) {

        return res.status(400).json({
          erro:
            "Áudio da voz vazio.",
        });
      }

      if (!trilhaBuffer.length) {

        return res.status(400).json({
          erro:
            "Áudio da trilha vazio.",
        });
      }

      // ------------------------------------------------
      // MIXAGEM
      // ------------------------------------------------

      const resultado =
        await mixarAudio(
          vozBuffer,
          trilhaBuffer,
          segundosInicio,
          segundosFinal
        );

      console.log(
        "Mixagem do cliente concluída."
      );

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          resultado.length.toString(),

        "Content-Disposition":
          'attachment; filename="fabrica-da-voz.mp3"',
      });

      res.send(
        resultado
      );

    } catch (erro) {

      console.error("");
      console.error(
        "ERRO NA MIXAGEM DO CLIENTE:"
      );
      console.error(
        erro
      );

      res.status(500).json({
        erro:
          erro.message ||
          "Não foi possível mixar a trilha enviada.",
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

      funcionando:
        true,

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

      trilhaCliente:
        true,

    });
  }
);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

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
    console.log("");
  }
);