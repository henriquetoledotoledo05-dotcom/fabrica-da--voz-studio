const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const mercadoPagoClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const preferenceClient = new Preference(mercadoPagoClient);
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT) || 3010;
const PACOTES_CREDITOS = {
  credito1: {
    titulo: "1 crÃ©dito",
    creditos: 1,
    valor: 4.90,
  },
  credito10: {
    titulo: "10 crÃ©ditos",
    creditos: 10,
    valor: 19.90,
  },
  credito50: {
    titulo: "50 crÃ©ditos",
    creditos: 50,
    valor: 69.90,
  },
  credito100: {
    titulo: "100 crÃ©ditos",
    creditos: 100,
    valor: 119.90,
  },
};
app.post("/api/criar-pagamento", async (req, res) => {
  try {
    const { pacote } = req.body;

    const pacoteSelecionado = PACOTES_CREDITOS[pacote];

    if (!pacoteSelecionado) {
      return res.status(400).json({
        erro: "Pacote de crÃ©ditos invÃ¡lido.",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "UsuÃ¡rio nÃ£o autenticado.",
      });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: erroUsuario,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (erroUsuario || !user) {
      return res.status(401).json({
        erro: "SessÃ£o do usuÃ¡rio invÃ¡lida.",
      });
    }

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            title: pacoteSelecionado.titulo,
            quantity: 1,
            currency_id: "BRL",
            unit_price: pacoteSelecionado.valor,
          },
        ],

        external_reference: `${user.id}|${pacote}`,

        metadata: {
          user_id: user.id,
          pacote: pacote,
          creditos: pacoteSelecionado.creditos,
        },
      },
    });

    return res.json({
      id: preference.id,
      init_point: preference.init_point,
    });
  } catch (erro) {
    console.error("Erro ao criar pagamento:", erro);

    return res.status(500).json({
      erro: "NÃ£o foi possÃ­vel criar o pagamento.",
    });
  }
});

// =====================================================
// WEBHOOK MERCADO PAGO - PAYMENT + ORDER
// =====================================================
// Esta aplicaÃ§Ã£o usa Checkout Pro pela API de PreferÃªncias
// (/checkout/preferences). Para esse fluxo, o evento correto
// Ã© "Pagamentos" (tÃ³pico payment). Mantemos suporte a "order"
// tambÃ©m para compatibilidade futura.
// O mesmo pagamento nÃ£o pode gerar crÃ©ditos duas vezes porque
// o Supabase controla mercado_pago_id como UNIQUE.

function extrairAssinaturaMercadoPago(xSignature) {
  const resultado = { ts: null, v1: null };

  if (!xSignature || typeof xSignature !== "string") {
    return resultado;
  }

  for (const parte of xSignature.split(",")) {
    const [chave, ...resto] = parte.split("=");
    if (!chave || !resto.length) continue;

    const valor = resto.join("=").trim();
    const chaveLimpa = chave.trim();

    if (chaveLimpa === "ts") resultado.ts = valor;
    if (chaveLimpa === "v1") resultado.v1 = valor;
  }

  return resultado;
}

function validarAssinaturaMercadoPago(req, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "MERCADOPAGO_WEBHOOK_SECRET nÃ£o configurada no servidor."
    );
  }

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  if (!xSignature || !xRequestId || !dataId) {
    return false;
  }

  const { ts, v1 } = extrairAssinaturaMercadoPago(xSignature);

  if (!ts || !v1) {
    return false;
  }

  // Manifesto oficial do Mercado Pago.
  // O data.id Ã© usado em minÃºsculas no cÃ¡lculo da assinatura.
  const manifest =
    `id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${ts};`;

  const assinaturaCalculada = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const esperado = Buffer.from(assinaturaCalculada, "utf8");
  const recebido = Buffer.from(String(v1), "utf8");

  if (esperado.length !== recebido.length) {
    return false;
  }

  return crypto.timingSafeEqual(esperado, recebido);
}

app.post("/api/mercadopago/webhook", async (req, res) => {
  try {
    console.log("");
    console.log("=================================");
    console.log("WEBHOOK MERCADO PAGO RECEBIDO");
    console.log("=================================");

    const dataId = String(
      req.query["data.id"] ||
      req.body?.data?.id ||
      ""
    ).trim();

    const tipo = String(
      req.query.type ||
      req.body?.type ||
      ""
    ).trim().toLowerCase();

    console.log("Tipo:", tipo);
    console.log("ID do recurso:", dataId);

    if (!dataId) {
      console.error("Webhook recebido sem data.id.");
      return res.status(400).json({
        erro: "ID do recurso nÃ£o informado.",
      });
    }

    if (!validarAssinaturaMercadoPago(req, dataId)) {
      console.error("Webhook Mercado Pago rejeitado: assinatura invÃ¡lida.");
      return res.status(401).json({
        erro: "Assinatura do webhook invÃ¡lida.",
      });
    }

    if (tipo !== "payment" && tipo !== "order") {
      console.log("Webhook ignorado: tipo nÃ£o suportado:", tipo);
      return res.status(200).json({
        recebido: true,
        processado: false,
      });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error(
        "MERCADOPAGO_ACCESS_TOKEN nÃ£o configurado."
      );
    }

    let recurso;
    let statusAprovado = false;
    let externalReference = "";
    let metadata = null;
    let valorPago = NaN;
    let recursoId = dataId;

    if (tipo === "payment") {
      // Checkout Pro via Preferences API: consultar pagamento.
      const respostaPagamento = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
            Accept: "application/json",
          },
        }
      );

      if (!respostaPagamento.ok) {
        const detalhes = await respostaPagamento.text();
        console.error(
          "Erro ao consultar pagamento no Mercado Pago:",
          detalhes
        );
        return res.status(502).json({
          erro: "NÃ£o foi possÃ­vel consultar o pagamento no Mercado Pago.",
        });
      }

      recurso = await respostaPagamento.json();
      recursoId = String(recurso.id || dataId);
      statusAprovado =
        recurso.status === "approved" &&
        (recurso.status_detail === "accredited" ||
          !recurso.status_detail);
      externalReference = String(
        recurso.external_reference || ""
      ).trim();
      metadata = recurso.metadata || null;
      valorPago = Number(recurso.transaction_amount);

      console.log("Status do pagamento:", recurso.status);
      console.log("Status detail:", recurso.status_detail);
      console.log("External reference:", externalReference);
      console.log("Valor do pagamento:", valorPago);
    } else {
      // Compatibilidade com Checkout Pro via Orders API.
      const respostaOrder = await fetch(
        `https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
            Accept: "application/json",
          },
        }
      );

      if (!respostaOrder.ok) {
        const detalhes = await respostaOrder.text();
        console.error(
          "Erro ao consultar order no Mercado Pago:",
          detalhes
        );
        return res.status(502).json({
          erro: "NÃ£o foi possÃ­vel consultar a order no Mercado Pago.",
        });
      }

      recurso = await respostaOrder.json();
      recursoId = String(recurso.id || dataId);
      statusAprovado =
        recurso.status === "processed" &&
        recurso.status_detail === "accredited";
      externalReference = String(
        recurso.external_reference || ""
      ).trim();
      metadata = recurso.metadata || null;
      valorPago = Number(
        recurso.total_paid_amount ?? recurso.total_amount
      );

      console.log("Status da order:", recurso.status);
      console.log("Status detail:", recurso.status_detail);
      console.log("External reference:", externalReference);
      console.log("Valor da order:", valorPago);
    }

    if (!statusAprovado) {
      console.log(
        "Pagamento ainda nÃ£o estÃ¡ aprovado/acreditado. Nenhum crÃ©dito serÃ¡ adicionado."
      );

      return res.status(200).json({
        recebido: true,
        processado: false,
        status: recurso.status,
        status_detail: recurso.status_detail,
      });
    }

    let userId = "";
    let pacote = "";

    // O fluxo atual grava: UUID|pacote
    const separador = externalReference.indexOf("|");

    if (separador > 0) {
      userId = externalReference.slice(0, separador).trim();
      pacote = externalReference.slice(separador + 1).trim();
    }

    // Fallback para metadata caso a referÃªncia externa nÃ£o esteja disponÃ­vel.
    if ((!userId || !pacote) && metadata) {
      userId = String(metadata.user_id || "").trim();
      pacote = String(metadata.pacote || "").trim();
    }

    if (!userId || !pacote) {
      console.error(
        "NÃ£o foi possÃ­vel identificar usuÃ¡rio/pacote do pagamento.",
        {
          externalReference,
          metadata,
        }
      );

      return res.status(400).json({
        erro: "NÃ£o foi possÃ­vel identificar o usuÃ¡rio e o pacote do pagamento.",
      });
    }

    const pacoteSelecionado = PACOTES_CREDITOS[pacote];

    if (!pacoteSelecionado) {
      console.error("Pacote nÃ£o encontrado:", pacote);
      return res.status(400).json({
        erro: "Pacote de crÃ©ditos nÃ£o encontrado.",
      });
    }

    const valorEsperado = Number(pacoteSelecionado.valor);

    if (
      !Number.isFinite(valorPago) ||
      Math.abs(valorPago - valorEsperado) > 0.01
    ) {
      console.error(
        "Valor do pagamento diferente do pacote:",
        {
          valorPago,
          valorEsperado,
          pacote,
        }
      );

      return res.status(400).json({
        erro: "Valor do pagamento nÃ£o corresponde ao pacote.",
      });
    }

    const { data, error } = await supabaseAdmin.rpc(
      "processar_pagamento_aprovado",
      {
        p_mercado_pago_id: recursoId,
        p_user_id: userId,
        p_pacote: pacote,
        p_creditos: pacoteSelecionado.creditos,
        p_valor: valorPago,
      }
    );

    if (error) {
      console.error(
        "ERRO AO PROCESSAR PAGAMENTO NO SUPABASE:",
        error
      );

      return res.status(500).json({
        erro: "NÃ£o foi possÃ­vel registrar o pagamento no Supabase.",
      });
    }

    console.log("Pagamento processado pelo Supabase:", data);
    console.log(
      "CrÃ©ditos adicionados:",
      pacoteSelecionado.creditos
    );

    return res.status(200).json({
      recebido: true,
      processado: true,
      paymentId: recursoId,
      creditos: pacoteSelecionado.creditos,
    });
  } catch (erro) {
    console.error("ERRO NO WEBHOOK MERCADO PAGO:", erro);

    return res.status(500).json({
      erro: erro?.message || "Erro interno no webhook.",
    });
  }
});

// =====================================================
// CONFIGURAÃ‡ÃƒO
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
      // e os domÃ­nios oficiais da FÃ¡brica da Voz.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // NÃ£o bloqueia o navegador por CORS; a aplicaÃ§Ã£o continua
      // protegida pelo prÃ³prio domÃ­nio/rota.
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

// A geraÃ§Ã£o tambÃ©m aceita JSON enviado como text/plain.
// Isso evita o preflight OPTIONS que o proxy do domÃ­nio estava redirecionando.
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
  console.error("ERRO: FFmpeg nÃ£o encontrado.");
  console.error("");
  process.exit(1);
}

console.log("");
console.log("FFmpeg encontrado:");
console.log(ffmpegPath);

// =====================================================
// UTILITÃRIOS
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
// PEGAR DURAÃ‡ÃƒO DO ÃUDIO
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
            "NÃ£o foi possÃ­vel descobrir a duraÃ§Ã£o do Ã¡udio."
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
async function aplicarReverbDireto(audioBuffer, volume) {
  const intensidade = Math.max(0, Math.min(100, Number(volume) || 0));

  if (!audioBuffer || !audioBuffer.length || intensidade <= 0) {
    return audioBuffer;
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-af",
      "aecho=1.0:0.8:80|150:" +
        [0.25, 0.12].map(v => (v * intensidade / 100).toFixed(2)).join("|"),
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-f", "mp3",
      "pipe:1"
    ]);

    const partes = [];
    let erro = "";

    ffmpeg.stdout.on("data", parte => partes.push(parte));
    ffmpeg.stderr.on("data", parte => { erro += parte.toString(); });
    ffmpeg.on("error", reject);

    ffmpeg.on("close", codigo => {
      if (codigo === 0 && partes.length) {
        resolve(Buffer.concat(partes));
      } else {
        reject(new Error(erro || "Falha ao aplicar reverb direto."));
      }
    });

    ffmpeg.stdin.on("error", erroEntrada => {
      if (erroEntrada.code !== "EPIPE") reject(erroEntrada);
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

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
  segundosFinal,
  reverb = false,
  volumeReverb = 0
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
      "DuraÃ§Ã£o da voz:",
      duracaoVoz
    );
    console.log(
      "Segundos depois:",
      final
    );
    console.log(
      "DuraÃ§Ã£o final:",
      duracaoTotal
    );
    console.log(
      "Fade final:",
      inicioFade,
      "atÃ©",
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
      // comeÃ§a apÃ³s os segundos iniciais
      // e recebe silÃªncio depois.
      `[0:a]adelay=${delayMs}|${delayMs},` + (reverb && Number(volumeReverb ?? 0) > 0 ? `asplit=2[vozOriginal][reverbEntrada];[reverbEntrada]aecho=0.8:0.9:90|180|300:0.7|0.55|0.4,volume=${Math.max(0, Math.min(1, Number(volumeReverb ?? 0) / 100))}[reverbSom];[vozOriginal][reverbSom]amix=inputs=2:duration=longest:dropout_transition=0:weights=1 1,` : "") + `apad=pad_dur=${final}[voz];` +

      // Trilha:
      // 20% de volume, duraÃ§Ã£o final exata
      // e fade out nos Ãºltimos 2 segundos.
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

    if (reverb && Number(volumeReverb ?? 0) > 0) {
      fs.copyFileSync(
        saidaPath,
        require("path").join(__dirname, "teste-eco-final.mp3")
      );
      console.log("?UDIO DE TESTE SALVO: teste-eco-final.mp3");
    }

    console.log("");
    console.log(
      "================================="
    );
    console.log("MIXAGEM CONCLUÃDA");
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
// =========================================================
// CORRIGIR TEXTO COM IA
// =========================================================

app.post("/api/corrigir-texto", async (req, res) => {
  try {
    const { texto } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({
        erro: "Digite um texto para corrigir.",
      });
    }

    const resposta = await openai.responses.create({
      model: "gpt-5.6-luna",
      instructions: `
VocÃª Ã© um revisor especializado em textos para locuÃ§Ã£o de rÃ¡dio em portuguÃªs do Brasil.

Corrija:
- erros de ortografia;
- acentuaÃ§Ã£o;
- pontuaÃ§Ã£o;
- concordÃ¢ncia;
- palavras digitadas incorretamente;
- frases que estejam pouco naturais para serem faladas.

Deixe o texto natural, claro e agradÃ¡vel para uma locuÃ§Ã£o.

MUITO IMPORTANTE:
- NÃ£o invente informaÃ§Ãµes.
- NÃ£o altere nomes de pessoas, empresas ou lugares.
- NÃ£o altere nÃºmeros de telefone.
- NÃ£o altere preÃ§os.
- NÃ£o altere datas ou horÃ¡rios.
- NÃ£o altere endereÃ§os.
- Preserve as informaÃ§Ãµes e o sentido original.
- Retorne SOMENTE o texto corrigido, sem explicaÃ§Ãµes, sem aspas e sem comentÃ¡rios.
      `,
      input: texto.trim(),
    });

    const textoCorrigido = resposta.output_text?.trim();

    if (!textoCorrigido) {
      return res.status(500).json({
        erro: "A IA nÃ£o retornou um texto corrigido.",
      });
    }

    res.json({
      texto: textoCorrigido,
    });
  } catch (erro) {
    console.error("ERRO AO CORRIGIR TEXTO:", erro);

    res.status(500).json({
      erro: "NÃ£o foi possÃ­vel corrigir o texto.",
      detalhes: erro?.message || "Erro desconhecido",
    });
  }
});

// =====================================================
// AUTENTICAÃ‡ÃƒO E CRÃ‰DITOS
// =====================================================

async function autenticarUsuario(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("UsuÃ¡rio nÃ£o autenticado.");
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    throw new Error("Token de autenticaÃ§Ã£o nÃ£o informado.");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("SessÃ£o do usuÃ¡rio invÃ¡lida.");
  }

  return user;
}

async function consumirCreditos(userId, quantidade) {
  const { data, error } = await supabaseAdmin.rpc(
    "consumir_creditos",
    {
      p_user_id: userId,
      p_quantidade: quantidade,
    }
  );

  if (error) {
    console.error("ERRO AO CONSUMIR CRÃ‰DITOS:", error);
    throw new Error(
      error.message || "NÃ£o foi possÃ­vel consumir os crÃ©ditos."
    );
  }

  return data;
}

async function devolverCreditos(userId, quantidade) {
  const { data, error } = await supabaseAdmin.rpc(
    "devolver_creditos",
    {
      p_user_id: userId,
      p_quantidade: quantidade,
    }
  );

  if (error) {
    console.error("ERRO AO DEVOLVER CRÃ‰DITOS:", error);
    return null;
  }

  return data;
}

function calcularCreditosNecessarios(texto) {
  const quantidadeCaracteres = texto.trim().length;

  if (quantidadeCaracteres <= 0) {
    return 0;
  }

  return Math.ceil(quantidadeCaracteres / 800);
}

// =====================================================
// GERAR VOZ - ELEVENLABS
// =====================================================

app.post(
  "/api/gerar-voz",
  async (req, res) => {
    let usuarioId = null;
    let creditosConsumidos = 0;

    try {
      const {
        texto,
        voiceId,
        speed,
        categoria,
        estilo,
        reverb,
        volumeReverb,
        instrucaoPersonalizada,
      } = req.body;

      console.log("ESTILO RECEBIDO:", estilo);

      const vozesPermitidasAoVivo = [
        "rpNe0HOx7heUulPiOEaG",
        "xyyAflT5WWJ3HeqszUn0",
        "g2E836wHBXhsWq15NkoD",
      ];

      if (
        estilo === "aoVivoLoja" &&
        !vozesPermitidasAoVivo.includes(voiceId)
      ) {
        return res.status(400).json({
          erro: "O estilo Ao Vivo - Loja e Ofertas esta disponivel apenas para Celso, Henrique e Gustavo.",
        });
      }

      console.log("");
      console.log("=================================");
      console.log("GERANDO VOZ - ESTILO:", estilo);
      console.log("=================================");

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
          erro: "Nenhuma voz foi selecionada.",
        });
      }

      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({
          erro:
            "ELEVENLABS_API_KEY nÃ£o configurada no arquivo .env.",
        });
      }

      const textoLimpo = texto.trim();
      const quantidadeCaracteres = textoLimpo.length;
      const creditosNecessarios =
        calcularCreditosNecessarios(textoLimpo);

      console.log("Quantidade de caracteres:", quantidadeCaracteres);
      console.log("CrÃ©ditos necessÃ¡rios:", creditosNecessarios);

      // =====================================================
      // AUTENTICAR USUÃRIO
      // =====================================================

      const usuario = await autenticarUsuario(req);
      usuarioId = usuario.id;

      // =====================================================
      // CONSUMIR CRÃ‰DITOS
      //
      // 1 a 800       = 1 crÃ©dito
      // 801 a 1600    = 2 crÃ©ditos
      // 1601 a 2400   = 3 crÃ©ditos
      // etc.
      // =====================================================

      await consumirCreditos(
        usuarioId,
        creditosNecessarios
      );

      creditosConsumidos = creditosNecessarios;

      console.log(
        "CrÃ©ditos consumidos:",
        creditosConsumidos
      );

      console.log("Voice ID:", voiceId);
      console.log("Texto:", textoLimpo);

      // =====================================================
      // ESTILOS DE LOCUÃ‡ÃƒO - ELEVEN V3
      // =====================================================

      let textoParaVoz = textoLimpo;
let estabilidadeEstilo = 0.50;

if (estilo === "animado") {
  textoParaVoz = `[excited] ${textoLimpo}`;
  estabilidadeEstilo = 0.45;

} else if (estilo === "muitoAnimado") {
  textoParaVoz = `[excited] ${textoLimpo}`;
  estabilidadeEstilo = 0.40;

} else if (estilo === "superImpacto") {
  textoParaVoz = `[shouts] ${textoLimpo}`;
  estabilidadeEstilo = 0.42;

} else if (estilo === "serio") {
  textoParaVoz = `[serious] ${textoLimpo}`;
  estabilidadeEstilo = 0.65;

} else if (estilo === "urgente") {
  textoParaVoz = `[shouts] ${textoLimpo}`;
  estabilidadeEstilo = 0.40;

} else if (estilo === "comercial") {
  textoParaVoz = `[excited] ${textoLimpo}`;
  estabilidadeEstilo = 0.45;

} else if (estilo === "festa") {
  textoParaVoz = `[happily] ${textoLimpo}`;
  estabilidadeEstilo = 0.42;

} else if (estilo === "solene") {
  textoParaVoz = `[calm] [serious] ${textoLimpo}`;
  estabilidadeEstilo = 0.72;

} else if (estilo === "aoVivoLoja") {
  textoParaVoz = `[excited] [happily] ${textoLimpo}`;
  estabilidadeEstilo = 0.42;
}

      // INSTRUÃ‡ÃƒO PERSONALIZADA - INTERPRETAÃ‡ÃƒO COM IA
      // =====================================================

      if (
        estilo !== "aoVivoLoja" &&
        instrucaoPersonalizada &&
        instrucaoPersonalizada.trim()
      ) {
        try {
          console.log("INSTRUÃ‡ÃƒO PERSONALIZADA:", instrucaoPersonalizada);

          const interpretacao = await openai.responses.create({
            model: "gpt-5.6-luna",
            instructions: `
VocÃª Ã© um diretor de voz para locuÃ§Ãµes profissionais em portuguÃªs do Brasil.

Receba a instruÃ§Ã£o do cliente e transforme-a SOMENTE em uma combinaÃ§Ã£o de tags de interpretaÃ§Ã£o compatÃ­veis com o ElevenLabs V3.

Tags permitidas:
[excited]
[happily]
[shouts]
[serious]
[calm]

Regras:
- Entenda o sentido completo da instruÃ§Ã£o.
- "locutor de rÃ¡dio", "rÃ¡dio", "chamada de rÃ¡dio" normalmente indica [excited].
- "futebol", "narraÃ§Ã£o de gol", "narrador esportivo" pode usar [excited] [shouts].
- "muito animado", "empolgado", "muita energia" pode usar [excited] [happily].
- "forte", "impactante", "chamando atenÃ§Ã£o" pode usar [shouts].
- "sÃ©rio", "institucional", "autoridade", "profissional" pode usar [serious].
- "calmo", "tranquilo", "emocional" pode usar [calm].
- Combine tags quando fizer sentido.
- Nunca invente tags.
- Nunca escreva explicaÃ§Ãµes.
- Retorne SOMENTE as tags, separadas por espaÃ§o.
- Se nenhuma tag for adequada, retorne [calm].
            `,
            input: instrucaoPersonalizada.trim(),
          });

          const tagsInterpretadas =
            interpretacao.output_text?.trim() || "[calm]";

          const tagsValidas = tagsInterpretadas
            .match(/\[(excited|happily|shouts|serious|calm)\]/g);

          if (tagsValidas && tagsValidas.length > 0) {
            const tagsUnicas = [...new Set(tagsValidas)];

            textoParaVoz =
              `${tagsUnicas.join(" ")} ${textoLimpo}`;

            console.log(
              "TAGS INTERPRETADAS PELA IA:",
              tagsUnicas
            );
          } else {
            console.log(
              "IA nÃ£o retornou tags vÃ¡lidas. Mantendo estilo selecionado."
            );
          }

        } catch (erroInstrucao) {
          console.error(
            "ERRO AO INTERPRETAR INSTRUÃ‡ÃƒO PERSONALIZADA:",
            erroInstrucao.message
          );

          console.log(
            "Continuando geraÃ§Ã£o com o estilo selecionado."
          );
        }
      }
      // ELEVENLABS
      // =====================================================

      const resposta = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}`,
        {
          method: "POST",

          headers: {
            "xi-api-key":
              process.env.ELEVENLABS_API_KEY,

            "Content-Type":
              "application/json",

            "Accept":
              "audio/mpeg",
          },

          body: JSON.stringify({
            text: textoParaVoz,

            model_id:
              "eleven_v3",

            language_code:
              "pt",

            voice_settings: {
              stability: estabilidadeEstilo,
              style: 0,
            },

            output_format:
              "mp3_44100_128",
          }),
        }
      );

      if (!resposta.ok) {
        const erroApi =
          await resposta.text();

        console.error("ELEVENLABS ERRO:");
        console.error(erroApi);

        throw new Error(
          erroApi ||
          "Erro na ElevenLabs."
        );
      }

      let audio =
        Buffer.from(
          await resposta.arrayBuffer()
        );

      if (!audio.length) {
        throw new Error(
          "A ElevenLabs retornou um Ã¡udio vazio."
        );
      }

      console.log(
        "Ãudio recebido:",
        audio.length,
        "bytes"
      );

      // =====================================================
      // VELOCIDADE OPCIONAL
      // =====================================================

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

      if (!audio.length) {
        throw new Error(
          "O Ã¡udio ficou vazio apÃ³s o processamento."
        );
      }

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          audio.length.toString(),

        "Cache-Control":
          "no-store",

        // Informa ao frontend quantos crÃ©ditos foram usados.
        "X-Creditos-Consumidos":
          creditosConsumidos.toString(),
      });

      const aplicarEco =
        estilo === "aoVivoLoja" || Boolean(reverb);

      if (aplicarEco) {
        const intensidadeEco =
          estilo === "aoVivoLoja"
            ? 65
            : Number(volumeReverb ?? 0);

        console.log(
          "APLICANDO REVERB DIRETO:",
          estilo,
          intensidadeEco + "%"
        );

        audio = await aplicarReverbDireto(
          audio,
          intensidadeEco
        );

        if (!audio || !audio.length) {
          throw new Error("O reverb retornou um ?udio vazio.");
        }

        res.set(
          "Content-Length",
          audio.length.toString()
        );
      }

      res.send(audio);
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO AO GERAR VOZ:"
      );
      console.error(erro);

      // =====================================================
      // DEVOLVER CRÃ‰DITOS SE A GERAÃ‡ÃƒO FALHAR
      // =====================================================

      if (
        usuarioId &&
        creditosConsumidos > 0
      ) {
        await devolverCreditos(
          usuarioId,
          creditosConsumidos
        );

        console.log(
          "CrÃ©ditos devolvidos:",
          creditosConsumidos
        );
      }

      const mensagem =
        erro?.message ||
        "NÃ£o foi possÃ­vel gerar a voz.";

      const semCreditos =
        mensagem.toLowerCase().includes(
          "crÃ©ditos insuficientes"
        );

      res.status(
        semCreditos ? 402 : 500
      ).json({
        erro: semCreditos
          ? "VocÃª nÃ£o possui crÃ©ditos suficientes para gerar essa locuÃ§Ã£o."
          : mensagem,
      });
    }
  }
);


// =====================================================
// MIXAGEM COM TRILHA DA FÃBRICA
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
        "MIXAGEM - TRILHA DA FÃBRICA"
      );
      console.log(
        "================================="
      );

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "Ãudio da voz nÃ£o informado.",
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
            "Ãudio da voz vazio ou invÃ¡lido.",
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
          "Trilha nÃ£o encontrada:",
          trilhaPath
        );

        return res.status(404).json({
          erro:
            `Trilha nÃ£o encontrada: ${nomeTrilha}`,
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
          segundosFinal,
          estilo === "aoVivoLoja" || Boolean(reverb),
          estilo === "aoVivoLoja"
            ? 65
            : Number(volumeReverb ?? 0)
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
          "Erro ao mixar os Ã¡udios.",
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
            "Ãudio da voz nÃ£o informado.",
        });
      }

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "A trilha enviada pelo cliente nÃ£o foi encontrada.",
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
            "Ãudio da voz vazio ou invÃ¡lido.",
        });
      }

      if (!trilhaBuffer) {
        return res.status(400).json({
          erro:
            "Ãudio da trilha vazio ou invÃ¡lido.",
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
        "Mixagem da trilha do cliente concluÃ­da."
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
          "NÃ£o foi possÃ­vel mixar a trilha enviada.",
      });
    }
  }
);
// =====================================================
// CONVERTER WAV PARA MP3
// =====================================================

app.post(
  "/api/converter-mp3",
  async (req, res) => {
    try {
      const partes = [];

      req.on("data", (parte) => {
        partes.push(parte);
      });

      req.on("end", () => {
        const wavBuffer =
          Buffer.concat(partes);

        if (!wavBuffer.length) {
          return res.status(400).json({
            erro:
              "Ãudio WAV nÃ£o informado.",
          });
        }

        const ffmpeg = spawn(
          ffmpegPath,
          [
            "-hide_banner",
            "-loglevel",
            "error",

            "-i",
            "pipe:0",

            "-c:a",
            "libmp3lame",

            "-b:a",
            "192k",

            "-ar",
            "44100",

            "-ac",
            "2",

            "-f",
            "mp3",

            "pipe:1",
          ]
        );

        const partesMp3 = [];
        let erro = "";

        ffmpeg.stdout.on(
          "data",
          (parte) => {
            partesMp3.push(parte);
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
            console.error(
              "ERRO AO CONVERTER MP3:",
              err
            );

            if (!res.headersSent) {
              res.status(500).json({
                erro:
                  "Erro ao converter para MP3.",
              });
            }
          }
        );

        ffmpeg.on(
          "close",
          (codigo) => {
            if (codigo !== 0) {
              console.error(
                "FFmpeg conversÃ£o:",
                erro
              );

              if (!res.headersSent) {
                res.status(500).json({
                  erro:
                    erro ||
                    "NÃ£o foi possÃ­vel converter o Ã¡udio para MP3.",
                });
              }

              return;
            }

            const mp3Buffer =
              Buffer.concat(partesMp3);

            res.set({
              "Content-Type":
                "audio/mpeg",

              "Content-Length":
                mp3Buffer.length.toString(),

              "Content-Disposition":
                'attachment; filename="fabrica-da-voz-mixagem.mp3"',

              "Cache-Control":
                "no-store",
            });

            res.send(mp3Buffer);
          }
        );

        ffmpeg.stdin.end(
          wavBuffer
        );
      });
    } catch (erro) {
      console.error(
        "ERRO NA CONVERSÃƒO PARA MP3:",
        erro
      );

      res.status(500).json({
        erro:
          erro.message ||
          "Erro ao converter para MP3.",
      });
    }
  }
);
// =====================================================
// ROTA DE MASTERIZACAO

app.post("/api/masterizar-audio", (req, res) => {
  const chunks = [];
  let total = 0;
  let excedeuLimite = false;
  const limite = 100 * 1024 * 1024;

  req.on("data", chunk => {
    total += chunk.length;
    if (total > limite) {
      excedeuLimite = true;
      res.status(413).json({ erro: "Ãudio maior que 100 MB." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (excedeuLimite || res.headersSent) return;
    const entrada = Buffer.concat(chunks);
    if (!entrada.length) {
      return res.status(400).json({ erro: "Nenhum Ã¡udio enviado." });
    }

    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-af", "highpass=f=35,loudnorm=I=-14:TP=-1.5:LRA=11,volume=2dB,alimiter=limit=0.891",
      "-c:a", "libmp3lame", "-b:a", "192k",
      "-ar", "44100", "-ac", "2", "-f", "mp3", "pipe:1"
    ]);

    const saida = [];
    let erros = "";
    let finalizado = false;

    ffmpeg.stdout.on("data", chunk => saida.push(chunk));
    ffmpeg.stderr.on("data", chunk => { erros += chunk.toString(); });
    ffmpeg.on("error", erro => {
      if (finalizado) return;
      finalizado = true;
      console.error("[MASTERIZACAO]", erro);
      if (!res.headersSent) res.status(500).json({ erro: "Falha ao iniciar FFmpeg." });
    });
    ffmpeg.on("close", codigo => {
      if (finalizado) return;
      finalizado = true;
      const audio = Buffer.concat(saida);
      if (codigo !== 0 || !audio.length) {
        console.error("[MASTERIZACAO]", erros);
        if (!res.headersSent) res.status(500).json({ erro: "NÃ£o foi possÃ­vel masterizar." });
        return;
      }
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Content-Disposition": 'attachment; filename="fabrica-da-voz-masterizada.mp3"',
        "Cache-Control": "no-store"
      });
      res.send(audio);
    });
    ffmpeg.stdin.on("error", erro => {
      if (erro.code !== "EPIPE") console.error("[MASTERIZACAO - ENTRADA]", erro);
    });
    ffmpeg.stdin.end(entrada);
  });
});

// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    servidor: "FÃ¡brica da Voz",
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
        "FÃ¡brica da Voz",

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
// FRONTEND VITE / REACT
//
// O Render precisa executar `npm run build` para criar a
// pasta dist. Depois o prÃ³prio Express entrega essa pasta.
// As rotas /api/* continuam sendo atendidas acima.
// =====================================================

const distPath = path.join(__dirname, "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("/central-demonstrativos", (req, res) => {
    res.sendFile(path.join(distPath, "central-demonstrativos.html"));
  });

  // SPA: qualquer rota que nÃ£o seja /api/* recebe o index.html.
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    const indexPath = path.join(distPath, "index.html");

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }

    res.status(500).send(
      "Frontend nÃ£o encontrado. Execute npm run build no deploy."
    );
  });
} else {
  console.warn(
    "AVISO: pasta dist nÃ£o encontrada. O frontend nÃ£o serÃ¡ exibido atÃ© o build do Vite ser executado."
  );

  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.status(503).send(
      "FÃ¡brica da Voz: frontend ainda nÃ£o foi compilado. Execute npm run build."
    );
  });
}

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
        "        FÃBRICA DA VOZ"
      );
      console.log(
        "================================="
      );
      console.log(
        `Servidor: http://localhost:${PORT}`
      );
      console.log(
        "GeraÃ§Ã£o de voz: ATIVADA"
      );
      console.log(
        "Segundos antes/depois: ATIVADOS"
      );
      console.log(
        "Fade final: 2 segundos"
      );
      console.log(
        "Trilha da fÃ¡brica: ATIVADA"
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
