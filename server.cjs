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
    titulo: "1 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito",
    creditos: 1,
    valor: 4.90,
  },
  credito10: {
    titulo: "10 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos",
    creditos: 10,
    valor: 19.90,
  },
  credito50: {
    titulo: "50 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos",
    creditos: 50,
    valor: 69.90,
  },
  credito100: {
    titulo: "100 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos",
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
        erro: "Pacote de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido.",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        erro: "UsuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o autenticado.",
      });
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: erroUsuario,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (erroUsuario || !user) {
      return res.status(401).json({
        erro: "SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida.",
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
      erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel criar o pagamento.",
    });
  }
});

// =====================================================
// WEBHOOK MERCADO PAGO - PAYMENT + ORDER
// =====================================================
// Esta aplicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o usa Checkout Pro pela API de PreferÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncias
// (/checkout/preferences). Para esse fluxo, o evento correto
// ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© "Pagamentos" (tÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³pico payment). Mantemos suporte a "order"
// tambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m para compatibilidade futura.
// O mesmo pagamento nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pode gerar crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos duas vezes porque
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
      "MERCADOPAGO_WEBHOOK_SECRET nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o configurada no servidor."
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
  // O data.id ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© usado em minÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºsculas no cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lculo da assinatura.
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
        erro: "ID do recurso nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado.",
      });
    }

    if (!validarAssinaturaMercadoPago(req, dataId)) {
      console.error("Webhook Mercado Pago rejeitado: assinatura invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida.");
      return res.status(401).json({
        erro: "Assinatura do webhook invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida.",
      });
    }

    if (tipo !== "payment" && tipo !== "order") {
      console.log("Webhook ignorado: tipo nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o suportado:", tipo);
      return res.status(200).json({
        recebido: true,
        processado: false,
      });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error(
        "MERCADOPAGO_ACCESS_TOKEN nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o configurado."
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
          erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel consultar o pagamento no Mercado Pago.",
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
          erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel consultar a order no Mercado Pago.",
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
        "Pagamento ainda nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ aprovado/acreditado. Nenhum crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ adicionado."
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

    // Fallback para metadata caso a referÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia externa nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o esteja disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel.
    if ((!userId || !pacote) && metadata) {
      userId = String(metadata.user_id || "").trim();
      pacote = String(metadata.pacote || "").trim();
    }

    if (!userId || !pacote) {
      console.error(
        "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel identificar usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio/pacote do pagamento.",
        {
          externalReference,
          metadata,
        }
      );

      return res.status(400).json({
        erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel identificar o usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio e o pacote do pagamento.",
      });
    }

    const pacoteSelecionado = PACOTES_CREDITOS[pacote];

    if (!pacoteSelecionado) {
      console.error("Pacote nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado:", pacote);
      return res.status(400).json({
        erro: "Pacote de crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado.",
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
        erro: "Valor do pagamento nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o corresponde ao pacote.",
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
        erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel registrar o pagamento no Supabase.",
      });
    }

    console.log("Pagamento processado pelo Supabase:", data);
    console.log(
      "CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos adicionados:",
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
// CONFIGURAÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O
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
      // e os domÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nios oficiais da FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡brica da Voz.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o bloqueia o navegador por CORS; a aplicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o continua
      // protegida pelo prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³prio domÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nio/rota.
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

// A geraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o tambÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©m aceita JSON enviado como text/plain.
// Isso evita o preflight OPTIONS que o proxy do domÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­nio estava redirecionando.
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
  console.error("ERRO: FFmpeg nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado.");
  console.error("");
  process.exit(1);
}

console.log("");
console.log("FFmpeg encontrado:");
console.log(ffmpegPath);

// =====================================================
// UTILITÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂRIOS
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
// PEGAR DURAÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O DO ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂUDIO
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
            "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel descobrir a duraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio."
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

async function aplicarEqualizacaoToledo(audioBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-af", "highpass=f=65,equalizer=f=180:width_type=h:width=1.0:g=1.5,equalizer=f=2500:width_type=h:width=1.0:g=1.2,equalizer=f=5000:width_type=h:width=1.0:g=-1.5,deesser=i=0.75:m=0.65:f=0.45:s=o,volume=3dB,alimiter=limit=0.95",
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
        reject(new Error(erro || "Falha na equaliza??o do Toledo."));
      }
    });

    ffmpeg.stdin.on("error", erroEntrada => {
      if (erroEntrada.code !== "EPIPE") reject(erroEntrada);
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

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

// EFEITOS EXCLUSIVOS DO DJ EXPRESS
async function aplicarEfeitoDJ(audioBuffer, estilo) {
  const filtros = {
    pancadao: "aecho=0.8:0.9:45|90:0.35|0.20",
    reiDaPista: "aecho=0.8:0.9:70|140:0.40|0.25",
    fantasma: "aecho=0.8:0.9:180|320|480:0.35|0.25|0.15",
    explosao: "aecho=0.8:0.9:35|110:0.45|0.30",
    assinaturaDJ: "aecho=0.8:0.8:90|170:0.28|0.16",
    alerta: "aecho=0.8:0.9:30|60:0.38|0.20"
  };

  const filtro = filtros[estilo];

  if (!audioBuffer || !audioBuffer.length || !filtro) {
    throw new Error("Estilo de efeito DJ invÃƒÆ’Ã‚Â¡lido ou ÃƒÆ’Ã‚Â¡udio vazio.");
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-af", filtro,
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-ar", "44100",
      "-f", "mp3",
      "pipe:1"
    ]);

    const partes = [];
    let erro = "";

    ffmpeg.stdout.on("data", parte => partes.push(parte));
    ffmpeg.stderr.on("data", parte => { erro += parte.toString(); });
    ffmpeg.on("error", reject);

    ffmpeg.on("close", codigo => {
      const resultado = Buffer.concat(partes);

      if (codigo === 0 && resultado.length) {
        resolve(resultado);
      } else {
        reject(new Error(erro || "Falha ao aplicar efeito do DJ Express."));
      }
    });

    ffmpeg.stdin.on("error", erroEntrada => {
      if (erroEntrada.code !== "EPIPE") reject(erroEntrada);
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

// LASER EXCLUSIVO DO DJ EXPRESS: abertura e encerramento
async function adicionarLaserDJ(audioBuffer) {
  const laserPath = path.join(__dirname, "public", "efeitos", "Laser.mp3");

  if (!fs.existsSync(laserPath)) {
    throw new Error("Arquivo Laser.mp3 nÃƒÂ£o encontrado.");
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-i", laserPath,
      "-filter_complex",
      "[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[voz];" +
      "[1:a]atrim=end=0.8,asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=0.30[laserA];" +
      "[voz][laserA]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]",
      "-map", "[out]",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-ar", "44100",
      "-f", "mp3",
      "pipe:1"
    ]);

    const partes = [];
    let erro = "";

    ffmpeg.stdout.on("data", parte => partes.push(parte));
    ffmpeg.stderr.on("data", parte => { erro += parte.toString(); });
    ffmpeg.on("error", reject);

    ffmpeg.on("close", codigo => {
      const resultado = Buffer.concat(partes);

      if (codigo === 0 && resultado.length) {
        resolve(resultado);
      } else {
        reject(new Error(erro || "Falha ao adicionar laser ao jingle."));
      }
    });

    ffmpeg.stdin.on("error", erroEntrada => {
      if (erroEntrada.code !== "EPIPE") reject(erroEntrada);
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

// ECO FINAL EXCLUSIVO DO DJ EXPRESS
async function adicionarEcoFinalDJ(audioBuffer) {
  if (!audioBuffer || !audioBuffer.length) {
    throw new Error("Audio vazio para aplicar o eco final.");
  }

  function executarFFmpeg(argumentos, entrada) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, argumentos);
      const partes = [];
      let erro = "";

      ffmpeg.stdout.on("data", parte => partes.push(parte));
      ffmpeg.stderr.on("data", parte => { erro += parte.toString(); });
      ffmpeg.on("error", reject);

      ffmpeg.on("close", codigo => {
        const resultado = Buffer.concat(partes);
        resolve({ codigo, resultado, erro });
      });

      ffmpeg.stdin.on("error", erroEntrada => {
        if (erroEntrada.code !== "EPIPE") reject(erroEntrada);
      });

      ffmpeg.stdin.end(entrada);
    });
  }

  // Consulta a duraÃ§Ã£o a partir de um arquivo temporÃ¡rio.
  const arquivoTemporario = path.join(
    __dirname,
    ".dj-eco-" + process.pid + "-" + Date.now() + ".mp3"
  );

  let textoInfo = "";

  try {
    fs.writeFileSync(arquivoTemporario, audioBuffer);

    textoInfo = await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, [
        "-hide_banner",
        "-i", arquivoTemporario,
        "-f", "null",
        "-"
      ]);

      let erro = "";
      proc.stderr.on("data", parte => { erro += parte.toString(); });
      proc.on("error", reject);
      proc.on("close", () => resolve(erro));
    });
  } finally {
    if (fs.existsSync(arquivoTemporario)) {
      fs.unlinkSync(arquivoTemporario);
    }
  }

  const correspondencia = String(textoInfo).match(
    /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/
  );

  if (!correspondencia) {
    console.error("DJ EXPRESS - informaÃ§Ã£o de duraÃ§Ã£o:", String(textoInfo).slice(0, 1500));
    throw new Error("NÃ£o foi possÃ­vel identificar a duraÃ§Ã£o do Ã¡udio para o eco final.");
  }

  const duracao =
    Number(correspondencia[1]) * 3600 +
    Number(correspondencia[2]) * 60 +
    Number(correspondencia[3]);
  // Processa apenas os ÃƒÂºltimos 1,4 segundos, preservando o restante da fala.
  const inicioCauda = Math.max(0, duracao - 0.8).toFixed(3);

  const resultado = await executarFFmpeg([
    "-hide_banner",
    "-loglevel", "error",
    "-i", "pipe:0",
    "-filter_complex",
    `[0:a]atrim=end=${inicioCauda},asetpts=PTS-STARTPTS[corpo];` +
    `[0:a]atrim=start=${inicioCauda},asetpts=PTS-STARTPTS,` +
    "aecho=0.8:0.85:250|500|750:0.45|0.30|0.18,apad=pad_dur=4.0,afade=t=out:st=1.0:d=3.0[cauda];" +
    "[corpo][cauda]concat=n=2:v=0:a=1[out]",
    "-map", "[out]",
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    "-ar", "44100",
    "-f", "mp3",
    "pipe:1"
  ], audioBuffer);

  if (resultado.codigo !== 0 || !resultado.resultado.length) {
    throw new Error(resultado.erro || "Falha ao aplicar eco final.");
  }

  return resultado.resultado;
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
      "DuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da voz:",
      duracaoVoz
    );
    console.log(
      "Segundos depois:",
      final
    );
    console.log(
      "DuraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o final:",
      duracaoTotal
    );
    console.log(
      "Fade final:",
      inicioFade,
      "atÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©",
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
      // comeÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s os segundos iniciais
      // e recebe silÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncio depois.
      `[0:a]adelay=${delayMs}|${delayMs},` + (reverb && Number(volumeReverb ?? 0) > 0 ? `asplit=2[vozOriginal][reverbEntrada];[reverbEntrada]aecho=0.8:0.9:90|180|300:0.7|0.55|0.4,volume=${Math.max(0, Math.min(1, Number(volumeReverb ?? 0) / 100))}[reverbSom];[vozOriginal][reverbSom]amix=inputs=2:duration=longest:dropout_transition=0:weights=1 1,` : "") + `apad=pad_dur=${final}[voz];` +

      // Trilha:
      // 20% de volume, duraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o final exata
      // e fade out nos ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltimos 2 segundos.
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
    console.log("MIXAGEM CONCLUÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂDA");
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
    try {
      await autenticarUsuario(req);
    } catch (erroAuth) {
      return res.status(401).json({ erro: "Sessao invalida ou expirada. Entre novamente." });
    }

    const { texto } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({
        erro: "Digite um texto para corrigir.",
      });
    }

    const resposta = await openai.responses.create({
      model: "gpt-5.6-luna",
      instructions: `
VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© um revisor especializado em textos para locuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de rÃƒÆ’Ã‚Â¡dio em portuguÃƒÆ’Ã‚Âªs do Brasil.

Corrija:
- erros de ortografia;
- acentuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o;
- pontuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o;
- concordÃƒÆ’Ã‚Â¢ncia;
- palavras digitadas incorretamente;
- frases pouco naturais para serem faladas.

Deixe o texto natural, claro e agradÃƒÆ’Ã‚Â¡vel para uma locuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.

MUITO IMPORTANTE:
- NÃƒÆ’Ã‚Â£o invente informaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes.
- NÃƒÆ’Ã‚Â£o altere nomes de pessoas, empresas ou lugares.
- NÃƒÆ’Ã‚Â£o altere nÃƒÆ’Ã‚Âºmeros de telefone.
- NÃƒÆ’Ã‚Â£o altere preÃƒÆ’Ã‚Â§os.
- NÃƒÆ’Ã‚Â£o altere datas ou horÃƒÆ’Ã‚Â¡rios.
- NÃƒÆ’Ã‚Â£o altere endereÃƒÆ’Ã‚Â§os.
- Preserve as informaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes e o sentido original.
- Retorne SOMENTE o texto corrigido, sem explicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes, aspas ou comentÃƒÆ’Ã‚Â¡rios.
      `,
      input: texto.trim(),
    });

    const textoCorrigido = resposta.output_text?.trim();

    if (!textoCorrigido) {
      return res.status(500).json({
        erro: "A IA n\u00e3o retornou um texto corrigido.",
      });
    }

    res.json({
      texto: textoCorrigido,
    });
  } catch (erro) {
    console.error("ERRO AO CORRIGIR TEXTO:", erro);

    res.status(500).json({
      erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel corrigir o texto.",
    });
  }
});

// =====================================================
// AUTENTICAÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O E CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DITOS
// =====================================================

async function autenticarUsuario(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("UsuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o autenticado.");
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();

  if (!accessToken) {
    throw new Error("Token de autenticaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado.");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida.");
  }

  return user;
}

async function consumirRegeneracao(userId) {
  const { data, error } = await supabaseAdmin.rpc(
    "consumir_regeneracao",
    { p_user_id: userId }
  );

  if (error) {
    console.error("ERRO AO CONSUMIR REGENERACAO:", error);
    throw new Error("N?o foi poss?vel consumir a regenera??o.");
  }

  if (data !== true) {
    throw new Error("Voc? n?o possui regenera??es dispon?veis.");
  }

  return true;
}

async function devolverRegeneracao(userId) {
  const { data, error } = await supabaseAdmin.rpc(
    "devolver_regeneracao",
    { p_user_id: userId }
  );

  if (error) {
    console.error("ERRO AO DEVOLVER REGENERACAO:", error);
    throw new Error("N?o foi poss?vel devolver a regenera??o.");
  }

  return data;
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
    console.error("ERRO AO CONSUMIR CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DITOS:", error);
    throw new Error(
      error.message || "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel consumir os crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos."
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
    console.error("ERRO AO DEVOLVER CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DITOS:", error);
    return null;
  }

  return data;
}

function textosSaoSemelhantes(textoOriginal, textoNovo) {
  const normalizar = (texto) =>
    String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const original = normalizar(textoOriginal);
  const novo = normalizar(textoNovo);

  if (!original || !novo) return false;
  if (original === novo) return true;

  const palavrasOriginais = new Set(original.split(" "));
  const palavrasNovas = new Set(novo.split(" "));

  let emComum = 0;
  for (const palavra of palavrasOriginais) {
    if (palavrasNovas.has(palavra)) emComum++;
  }

  const menorQuantidade = Math.min(
    palavrasOriginais.size,
    palavrasNovas.size
  );

  const maiorQuantidade = Math.max(
    palavrasOriginais.size,
    palavrasNovas.size
  );

  const sobreposicao = emComum / menorQuantidade;
  const semelhancaGlobal = emComum / maiorQuantidade;

  // Textos curtos: permitir pequenas correcoes.
  if (Math.max(original.length, novo.length) <= 30) {
    return Math.abs(original.length - novo.length) <= 8 &&
      emComum >= 2 &&
      sobreposicao >= 0.5;
  }

  // Textos maiores: permitir corrigir palavras e acrescentar
  // informacoes sem liberar anuncios completamente diferentes.
  return emComum >= 3 &&
    sobreposicao >= 0.75 &&
    semelhancaGlobal >= 0.45;
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


// Acrescenta uma sobra natural ao final da locução.
// Usa o FFmpeg já configurado no servidor.
async function adicionarCaudaSilencio(audioBuffer, segundos = 0.5) {
  return new Promise((resolve, reject) => {
    const processo = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-af", `areverse,afade=t=in:st=0:d=0.1,areverse,apad=pad_dur=${segundos}`,
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-f", "mp3",
      "pipe:1"
    ]);

    const partes = [];
    const erros = [];

    processo.stdout.on("data", parte => partes.push(parte));
    processo.stderr.on("data", parte => erros.push(parte));
    processo.on("error", reject);

    processo.on("close", codigo => {
      if (codigo === 0 && partes.length) {
        resolve(Buffer.concat(partes));
      } else {
        reject(new Error(
          "Falha ao adicionar silêncio: " +
          Buffer.concat(erros).toString()
        ));
      }
    });

    processo.stdin.on("error", erro => {
      if (erro.code !== "EPIPE") {
        console.error("Erro ao enviar áudio ao FFmpeg:", erro.message);
      }
    });

    processo.stdin.end(audioBuffer);
  });
}
app.post(
  "/api/gerar-voz",
  async (req, res) => {
    let usuarioId = null;
    let creditosConsumidos = 0;
    let regeneracaoConsumida = false;

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
        regenerar = false,
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
            "ELEVENLABS_API_KEY nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o configurada no arquivo .env.",
        });
      }

      const textoLimpo = texto.trim();
      // MODERACAO DE SEGURANCA ANTES DO CONSUMO DE CREDITOS
      if (!openai) {
        return res.status(503).json({
          erro: "Verificacao de seguranca indisponivel. Nenhum credito foi consumido."
        });
      }

      try {
        const verificacao = await openai.moderations.create({
          model: "omni-moderation-latest",
          input: textoLimpo
        });

        if (verificacao.results?.[0]?.flagged) {
          return res.status(400).json({
            erro: "Este texto precisa ser revisado. Nenhum credito foi consumido."
          });
        }
      } catch (erroModeracao) {
        console.error("Falha na verificacao de seguranca:", erroModeracao.status || "erro");
        return res.status(503).json({
          erro: "Verificacao de seguranca indisponivel. Nenhum credito foi consumido."
        });
      }

      const quantidadeCaracteres = textoLimpo.length;
      const creditosNecessarios =
        calcularCreditosNecessarios(textoLimpo);

      console.log("Quantidade de caracteres:", quantidadeCaracteres);
      console.log("CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos necessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rios:", creditosNecessarios);

      // =====================================================
      // AUTENTICAR USUÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂRIO
      // =====================================================

      const usuario = await autenticarUsuario(req);
      usuarioId = usuario.id;

      // =====================================================
      // CONSUMIR CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DITOS
      //
      // 1 a 800       = 1 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dito
      // 801 a 1600    = 2 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos
      // 1601 a 2400   = 3 crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos
      // etc.
      // =====================================================

      if (regenerar === true) {
        const { data: ultimaGeracao, error: erroUltimaGeracao } =
          await supabaseAdmin
            .from("ultima_geracao_regeneracao")
            .select("texto")
            .eq("user_id", usuarioId)
            .maybeSingle();

        if (erroUltimaGeracao) {
          console.error("ERRO AO VALIDAR ULTIMA GERACAO:", erroUltimaGeracao);
          throw new Error("Nao foi possivel validar a ultima locucao.");
        }

        if (
          !ultimaGeracao ||
          !textosSaoSemelhantes(ultimaGeracao.texto, textoLimpo)
        ) {
          return res.status(400).json({
            erro: "A regeneracao permite corrigir o texto da ultima locucao, mas nao criar um anuncio diferente. Use os creditos normais para isso."
          });
        }

        await consumirRegeneracao(usuarioId);
        regeneracaoConsumida = true;
        console.log("Uma regeneracao foi consumida.");
      } else {
        await consumirCreditos(
          usuarioId,
          creditosNecessarios
        );

        creditosConsumidos = creditosNecessarios;
        console.log("Creditos consumidos:", creditosConsumidos);
      }

      console.log("Voice ID:", voiceId);
      console.log("Texto:", textoLimpo);

      // =====================================================
      // ESTILOS DE LOCUÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O - ELEVEN V3
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

      // INSTRUÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O PERSONALIZADA - INTERPRETAÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O COM IA
      // =====================================================

      if (
        estilo !== "aoVivoLoja" &&
        instrucaoPersonalizada &&
        instrucaoPersonalizada.trim()
      ) {
        try {
          console.log("INSTRUÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O PERSONALIZADA:", instrucaoPersonalizada);

          const interpretacao = await openai.responses.create({
            model: "gpt-5.6-luna",
            instructions: `
VocÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© um diretor de voz para locuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes profissionais em portuguÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªs do Brasil.

Receba a instruÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do cliente e transforme-a SOMENTE em uma combinaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de tags de interpretaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o compatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis com o ElevenLabs V3.

Tags permitidas:
[excited]
[happily]
[shouts]
[serious]
[calm]

Regras:
- Entenda o sentido completo da instruÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.
- "locutor de rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡dio", "rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡dio", "chamada de rÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡dio" normalmente indica [excited].
- "futebol", "narraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de gol", "narrador esportivo" pode usar [excited] [shouts].
- "muito animado", "empolgado", "muita energia" pode usar [excited] [happily].
- "forte", "impactante", "chamando atenÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o" pode usar [shouts].
- "sÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rio", "institucional", "autoridade", "profissional" pode usar [serious].
- "calmo", "tranquilo", "emocional" pode usar [calm].
- Combine tags quando fizer sentido.
- Nunca invente tags.
- Nunca escreva explicaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âµes.
- Retorne SOMENTE as tags, separadas por espaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§o.
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
              "IA nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o retornou tags vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lidas. Mantendo estilo selecionado."
            );
          }

        } catch (erroInstrucao) {
          console.error(
            "ERRO AO INTERPRETAR INSTRUÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O PERSONALIZADA:",
            erroInstrucao.message
          );

          console.log(
            "Continuando geraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com o estilo selecionado."
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
          "A ElevenLabs retornou um ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio vazio."
        );
      }

      console.log(
        "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio recebido:",
        audio.length,
        "bytes"
      );

      // =====================================================

      if (voiceId === "Gxi5hLxJ4skjTWK8XHBJ") {
        console.log("Aplicando equaliza??o exclusiva do Toledo.");
        audio = await aplicarEqualizacaoToledo(audio);
      }

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
          "O ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio ficou vazio apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s o processamento."
        );
      }

      res.set({
        "Content-Type":
          "audio/mpeg",

        "Content-Length":
          audio.length.toString(),

        "Cache-Control":
          "no-store",

        // Informa ao frontend quantos crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos foram usados.
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

      {
        const { error: erroSalvarUltimaGeracao } = await supabaseAdmin
          .from("ultima_geracao_regeneracao")
          .upsert(
            { user_id: usuarioId, texto: textoLimpo, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );

        if (erroSalvarUltimaGeracao) {
          console.error("ERRO AO SALVAR ULTIMA GERACAO:", erroSalvarUltimaGeracao);
          throw new Error("Nao foi possivel registrar a ultima locucao.");
        }
      }

      audio = await adicionarCaudaSilencio(audio, 0.5);
      res.set("Content-Length", audio.length.toString());
      res.send(audio);
    } catch (erro) {
      console.error("");
      console.error(
        "ERRO AO GERAR VOZ:"
      );
      console.error(erro);

      // =====================================================
      // DEVOLVER CRÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â°DITOS SE A GERAÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O FALHAR
      // =====================================================

      if (usuarioId && regeneracaoConsumida) {
        try {
          await devolverRegeneracao(usuarioId);
          console.log("Regeneracao devolvida apos falha na geracao.");
        } catch (erroDevolucao) {
          console.error("ERRO AO DEVOLVER REGENERACAO:", erroDevolucao);
        }
      }

      if (
        usuarioId &&
        creditosConsumidos > 0
      ) {
        await devolverCreditos(
          usuarioId,
          creditosConsumidos
        );

        console.log(
          "CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos devolvidos:",
          creditosConsumidos
        );
      }

      const mensagem =
        erro?.message ||
        "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel gerar a voz.";

      const semCreditos =
        mensagem.toLowerCase().includes(
          "crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos insuficientes"
        );

      res.status(
        semCreditos ? 402 : 500
      ).json({
        erro: semCreditos
          ? "VocÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âª nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o possui crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ditos suficientes para gerar essa locuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o."
          : mensagem,
      });
    }
  }
);


// =====================================================
// MIXAGEM COM TRILHA DA FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂBRICA
//
// O frontend envia:
// - audioBase64
// - trilhaSelecionada
// - segundosInicio
// - segundosFinal
// =====================================================

// =====================================================
// DJ EXPRESS - GERACAO DE JINGLES COM EFEITOS
// Custo fixo: 2 creditos por jingle
// =====================================================

app.post("/api/gerar-jingle-dj", async (req, res) => {
  let usuarioId = null;
  let creditosConsumidos = 0;

  try {
    const { texto, nomeDJ, voiceId, estilo } = req.body || {};

    const estilosPermitidos = [
      "pancadao",
      "reiDaPista",
      "fantasma",
      "explosao",
      "assinaturaDJ",
      "alerta"
    ];

    const textoLimpo = typeof texto === "string" ? texto.trim() : "";
    const nomeLimpo = typeof nomeDJ === "string" ? nomeDJ.trim() : "";

    if (!nomeLimpo || nomeLimpo.length > 60) {
      return res.status(400).json({
        erro: "Informe o nome do DJ, com no maximo 60 caracteres."
      });
    }

    if (!textoLimpo || textoLimpo.length > 800) {
      return res.status(400).json({
        erro: "Digite o texto do jingle, com no maximo 800 caracteres."
      });
    }

    const vozesPermitidasDJ = [
      "rz25pon9uanPpUGOW98Y",
      "cxaKsaoZvZoce6kBBu0n",
      "rpNe0HOx7heUulPiOEaG",
      "0utPdY4y5ppoXQxzubar",
      "xyyAflT5WWJ3HeqszUn0",
      "xqmVsyH6TEc0qQYSNT8P",
      "B7HqRIxroDpybJI9vXMj",
      "a5zGngtwpITbxmy3Sekk",
      "DQRaZFBAlsnenMlFVe0R",
      "g2E836wHBXhsWq15NkoD",
      "8Rw0UhFNLhw1t75pidLJ",
      "3T1fxRR4KTmnl9K43DtE",
      "Tkf2paIF3z04RS9egsf2",
      "myEJoaX0UkuoJmX7w2Rf",
      "qn85SVnJvSWg5wutkjZa",
      "u1vCfFgLgJ3YbJEqXmbf",
      "exVv2CbwvTu1WNVuSWXs",
      "gyiJ08WU9Wi2LNY7nTcB",
      "Oxtl4GQ22m0Q0rh8YGCI",
      "0Np4P6bO9DGhECZoT8Ls",
      "qPAKBzRQkQs6EIhLSbMi",
      "UaeEQHfiDI8l58WWXiwS",
      "oQL5kq26ctJzupM0mJot",
      "mmUpm90TBHi5276nYDJk",
      "GiNbP6xPhrH6X8DJBD08",
      "g0iauLqQtYFe6LlIx8oy",
      "QbKKWw1Bp1k0ycDNqoY7",
];

    if (
      typeof voiceId !== "string" ||
      !vozesPermitidasDJ.includes(voiceId)
    ) {
      return res.status(400).json({
        erro: "Selecione uma voz valida."
      });
    }

    if (!estilosPermitidos.includes(estilo)) {
      return res.status(400).json({
        erro: "Selecione um efeito DJ valido."
      });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({
        erro: "ELEVENLABS_API_KEY nao configurada."
      });
    }

    if (!openai) {
      return res.status(503).json({
        erro: "Verificacao de seguranca indisponivel. Nenhum credito foi consumido."
      });
    }

    try {
      const verificacao = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: nomeLimpo + ". " + textoLimpo
      });

      if (verificacao.results?.[0]?.flagged) {
        return res.status(400).json({
          erro: "Este texto precisa ser revisado. Nenhum credito foi consumido."
        });
      }
    } catch (erroModeracao) {
      console.error("DJ EXPRESS - erro na moderacao:", erroModeracao.message);
      return res.status(503).json({
        erro: "Verificacao de seguranca indisponivel. Nenhum credito foi consumido."
      });
    }

    const usuario = await autenticarUsuario(req);
    usuarioId = usuario.id;

    const CUSTO_DJ = 2;
    await consumirCreditos(usuarioId, CUSTO_DJ);
    creditosConsumidos = CUSTO_DJ;

    const textoParaVoz = "[excited] " + nomeLimpo + "! " + textoLimpo;

    const resposta = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/" +
        encodeURIComponent(voiceId),
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: textoParaVoz,
          model_id: "eleven_v3",
          language_code: "pt",
          voice_settings: {
            stability: 0.42,
            style: 0
          },
          output_format: "mp3_44100_128"
        })
      }
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 500);
      console.error("DJ EXPRESS - erro ElevenLabs:", detalhe);
      throw new Error("A ElevenLabs nao conseguiu gerar o jingle. Tente novamente.");
    }

    let audio = Buffer.from(await resposta.arrayBuffer());

    if (!audio.length) {
      throw new Error("A ElevenLabs retornou um audio vazio.");
    }

    audio = await aplicarEfeitoDJ(audio, estilo);
    audio = await adicionarEcoFinalDJ(audio);
    audio = await adicionarLaserDJ(audio);

    if (!audio || !audio.length) {
      throw new Error("Nao foi possivel aplicar o efeito DJ.");
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length.toString(),
      "Cache-Control": "no-store",
      "X-Creditos-Consumidos": String(creditosConsumidos)
    });

    return res.send(audio);
  } catch (erro) {
    console.error("DJ EXPRESS - falha na geracao:", erro);

    if (usuarioId && creditosConsumidos > 0) {
      try {
        const devolucao = await devolverCreditos(
          usuarioId,
          creditosConsumidos
        );

        if (typeof devolucao === "number" && Number.isFinite(devolucao)) {
          console.log(
            "DJ EXPRESS - devolucao confirmada. Novo saldo:",
            devolucao
          );
        } else {
          console.error(
            "DJ EXPRESS - ATENCAO: retorno inesperado ao devolver creditos:",
            devolucao
          );
        }
      } catch (erroDevolucao) {
        console.error(
          "DJ EXPRESS - FALHA AO DEVOLVER CREDITOS:",
          erroDevolucao
        );
      }
    }

    if (res.headersSent) {
      return;
    }

    const mensagem =
      erro?.message || "Nao foi possivel gerar o jingle DJ.";

    const semCreditos = /cr[eÃƒÂ©]ditos insuficientes/i.test(mensagem);

    return res.status(semCreditos ? 402 : 500).json({
      erro: semCreditos
        ? "Voce nao possui creditos suficientes. Sao necessarios 2 creditos."
        : mensagem
    });
  }
});
app.post("/api/gerar-vinhetas-radio-ia", async (req, res) => {
  let usuarioId = null;
  let creditosReservados = 0;

  try {
    const {
      nomeRadio,
      slogan,
      estilo,
      voiceId
    } = req.body || {};

    const nome = typeof nomeRadio === "string" ? nomeRadio.trim() : "";
    const assinatura = typeof slogan === "string" ? slogan.trim() : "";
    const estilosPermitidos = [
      "popular", "sertanejo", "jovem", "gospel", "adulta", "moderna"
    ];

    const vozesPermitidas = [
      "rz25pon9uanPpUGOW98Y", "cxaKsaoZvZoce6kBBu0n",
      "rpNe0HOx7heUulPiOEaG", "0utPdY4y5ppoXQxzubar",
      "xyyAflT5WWJ3HeqszUn0", "xqmVsyH6TEc0qQYSNT8P",
      "B7HqRIxroDpybJI9vXMj", "a5zGngtwpITbxmy3Sekk",
      "DQRaZFBAlsnenMlFVe0R", "g2E836wHBXhsWq15NkoD",
      "8Rw0UhFNLhw1t75pidLJ", "3T1fxRR4KTmnl9K43DtE",
      "Tkf2paIF3z04RS9egsf2", "myEJoaX0UkuoJmX7w2Rf",
      "qn85SVnJvSWg5wutkjZa", "u1vCfFgLgJ3YbJEqXmbf",
      "exVv2CbwvTu1WNVuSWXs", "gyiJ08WU9Wi2LNY7nTcB",
      "Oxtl4GQ22m0Q0rh8YGCI", "0Np4P6bO9DGhECZoT8Ls",
      "qPAKBzRQkQs6EIhLSbMi", "UaeEQHfiDI8l58WWXiwS",
      "oQL5kq26ctJzupM0mJot", "mmUpm90TBHi5276nYDJk",
      "GiNbP6xPhrH6X8DJBD08", "g0iauLqQtYFe6LlIx8oy",
      "QbKKWw1Bp1k0ycDNqoY7"
    ];

    if (!nome || nome.length > 60) {
      return res.status(400).json({
        erro: "Informe o nome da rádio, com no máximo 60 caracteres."
      });
    }

    if (assinatura.length > 100) {
      return res.status(400).json({
        erro: "O slogan deve ter no máximo 100 caracteres."
      });
    }

    if (!estilosPermitidos.includes(estilo)) {
      return res.status(400).json({ erro: "Estilo de rádio inválido." });
    }

    if (voiceId !== "auto" &&
        (typeof voiceId !== "string" || !vozesPermitidas.includes(voiceId))) {
      return res.status(400).json({ erro: "Selecione uma voz válida." });
    }

    if (!openai || !process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({
        erro: "Serviço de geração indisponível. Nenhum crédito foi consumido."
      });
    }

    const usuario = await autenticarUsuario(req);
    usuarioId = usuario.id;

    const verificacao = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: nome + ". " + assinatura
    });

    if (verificacao.results?.[0]?.flagged) {
      return res.status(400).json({
        erro: "Os dados informados precisam ser revisados. Nenhum crédito foi consumido."
      });
    }

    const respostaRoteiros = await openai.responses.create({
      model: "gpt-5.6-luna",
      instructions: [
        "Você é diretor de criação de uma rádio brasileira.",
        "Crie exatamente cinco chamadas de identificação de emissora.",
        "Escreva em português brasileiro natural, para locução profissional.",
        "Cada chamada deve ser curta, distinta e ter entre 8 e 14 palavras.",
        "Use o nome da rádio em todas as chamadas.",
        "Use o slogan quando fornecido, sem forçar sua inclusão em todas.",
        "Não invente frequências, cidades, prêmios ou informações não fornecidas.",
        "Adapte a linguagem ao estilo informado.",
        "Retorne somente um array JSON com cinco strings, sem Markdown."
      ].join(" "),
      input: JSON.stringify({
        radio: nome,
        slogan: assinatura,
        estilo
      })
    });

    let roteiros;
    try {
      let textoJSON = respostaRoteiros.output_text?.trim() || "";
      textoJSON = textoJSON
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      roteiros = JSON.parse(textoJSON);
    } catch {
      throw new Error("Não foi possível preparar os cinco roteiros. Tente novamente.");
    }

    if (
      !Array.isArray(roteiros) ||
      roteiros.length !== 5 ||
      !roteiros.every(
        item => typeof item === "string" &&
          item.trim().length >= 5 &&
          item.trim().length <= 180
      )
    ) {
      throw new Error("A IA não retornou cinco roteiros válidos. Tente novamente.");
    }


    await consumirCreditos(usuarioId, 5);
    creditosReservados = 5;

    const vozEscolhida = voiceId === "auto"
      ? vozesPermitidas[Math.floor(Math.random() * vozesPermitidas.length)]
      : voiceId;

    const titulos = [
      "Assinatura da rádio",
      "Identidade sonora",
      "Chamada de programação",
      "Vinheta de impacto",
      "Encerramento da emissora"
    ];

    const vinhetas = [];
    const falhas = [];

    for (let i = 0; i < roteiros.length; i++) {
      try {
        const respostaAudio = await fetch(
          "https://api.elevenlabs.io/v1/text-to-speech/" +
            encodeURIComponent(vozEscolhida),
          {
            method: "POST",
            headers: {
              "xi-api-key": process.env.ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg"
            },
            body: JSON.stringify({
              text: roteiros[i].trim(),
              model_id: "eleven_v3",
              language_code: "pt",
              voice_settings: {
                stability: 0.42,
                style: 0
              },
              output_format: "mp3_44100_128"
            })
          }
        );

        if (!respostaAudio.ok) {
          const detalhe = (await respostaAudio.text()).slice(0, 300);
          console.error("VINHETAS RADIO IA - erro ElevenLabs:", detalhe);
          throw new Error("Falha na geração do áudio.");
        }

        let audio = Buffer.from(await respostaAudio.arrayBuffer());

        if (!audio.length) {
          throw new Error("Áudio vazio.");
        }

        // Efeito sutil e independente dos efeitos exclusivos do DJ Express.
        try {
          audio = await aplicarReverbDireto(audio, 15);
        } catch (erroEfeito) {
          console.warn("VINHETAS RADIO IA - reverb ignorado:", erroEfeito.message);
        }

        try {
          audio = await adicionarCaudaSilencio(audio, 0.25);
        } catch (erroCauda) {
          console.warn("VINHETAS RADIO IA - cauda ignorada:", erroCauda.message);
        }

        vinhetas.push({
          titulo: titulos[i],
          texto: roteiros[i].trim(),
          audioBase64: audio.toString("base64")
        });
      } catch (erroAudio) {
        console.error(
          `VINHETAS RADIO IA - falha no áudio ${i + 1}:`,
          erroAudio.message
        );
        falhas.push(i + 1);
      }
    }

    const creditosADevolver = 5 - vinhetas.length;
    let devolucaoConfirmada = creditosADevolver === 0;

    if (creditosADevolver > 0) {
      const saldoDevolucao = await devolverCreditos(
        usuarioId,
        creditosADevolver
      );

      devolucaoConfirmada =
        typeof saldoDevolucao === "number" &&
        Number.isFinite(saldoDevolucao);

      if (!devolucaoConfirmada) {
        console.error(
          "VINHETAS RADIO IA - ATENÇÃO: não foi possível confirmar a devolução.",
          { usuarioId, creditosADevolver }
        );
      }
    }

    // Impede uma segunda devolução no bloco catch.
    creditosReservados = 0;

    if (vinhetas.length === 0) {
      return res.status(500).json({
        erro: devolucaoConfirmada
          ? "Nenhuma vinheta foi gerada. Os cinco créditos foram devolvidos."
          : "Nenhuma vinheta foi gerada. Não foi possível confirmar a devolução automática; entre em contato com o suporte.",
        creditosConsumidos: 0,
        creditosDevolvidos: devolucaoConfirmada ? 5 : 0
      });
    }

    return res.json({
      vinhetas,
      creditosConsumidos: vinhetas.length,
      creditosDevolvidos: devolucaoConfirmada ? creditosADevolver : 0,
      devolucaoConfirmada,
      aviso: !devolucaoConfirmada
        ? "A devolução dos créditos dos áudios que falharam precisa ser conferida pelo suporte."
        : undefined
    });
  } catch (erro) {
    console.error("VINHETAS RADIO IA - falha na operação:", erro);

    if (usuarioId && creditosReservados > 0) {
      try {
        const saldoDevolucao = await devolverCreditos(
          usuarioId,
          creditosReservados
        );

        if (typeof saldoDevolucao === "number" &&
            Number.isFinite(saldoDevolucao)) {
          creditosReservados = 0;
        } else {
          console.error(
            "VINHETAS RADIO IA - ATENÇÃO: devolução não confirmada.",
            saldoDevolucao
          );
        }
      } catch (erroDevolucao) {
        console.error(
          "VINHETAS RADIO IA - falha na devolução:",
          erroDevolucao
        );
      }
    }

    if (res.headersSent) return;

    const mensagem = erro?.message || "Não foi possível gerar as vinhetas.";
    const semCreditos = /cr[eé]ditos insuficientes/i.test(mensagem);

    return res.status(semCreditos ? 402 : 500).json({
      erro: semCreditos
        ? "Você não possui cinco créditos disponíveis para este pacote."
        : mensagem
    });
  }
});
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
        "MIXAGEM - TRILHA DA FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂBRICA"
      );
      console.log(
        "================================="
      );

      if (!audioBase64) {
        return res.status(400).json({
          erro:
            "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio da voz nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado.",
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
            "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio da voz vazio ou invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido.",
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
          "Trilha nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada:",
          trilhaPath
        );

        return res.status(404).json({
          erro:
            `Trilha nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada: ${nomeTrilha}`,
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
          "Erro ao mixar os ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udios.",
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
            "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio da voz nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado.",
        });
      }

      if (!trilhaBase64) {
        return res.status(400).json({
          erro:
            "A trilha enviada pelo cliente nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi encontrada.",
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
            "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio da voz vazio ou invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido.",
        });
      }

      if (!trilhaBuffer) {
        return res.status(400).json({
          erro:
            "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio da trilha vazio ou invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido.",
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
        "Mixagem da trilha do cliente concluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­da."
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
          "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel mixar a trilha enviada.",
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
      try {
        await autenticarUsuario(req);
      } catch (erroAuth) {
        return res.status(401).json({ erro: "Sessao invalida ou expirada. Entre novamente." });
      }

      const partes = [];
      const limiteAudio = 100 * 1024 * 1024;
      let totalAudio = 0;
      let excedeuLimite = false;

      req.on("data", (parte) => {
        if (excedeuLimite) return;
        totalAudio += parte.length;
        if (totalAudio > limiteAudio) {
          excedeuLimite = true;
          partes.length = 0;
          if (!res.headersSent) res.status(413).json({ erro: "Audio maior que 100 MB." });
          return;
        }
        partes.push(parte);
      });

      req.on("end", () => {
        if (excedeuLimite || res.headersSent) return;
        const wavBuffer =
          Buffer.concat(partes);

        if (!wavBuffer.length) {
          return res.status(400).json({
            erro:
              "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio WAV nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o informado.",
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
                "FFmpeg conversÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o:",
                erro
              );

              if (!res.headersSent) {
                res.status(500).json({
                  erro:
                    erro ||
                    "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel converter o ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio para MP3.",
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
        "ERRO NA CONVERSÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢O PARA MP3:",
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

app.post("/api/masterizar-audio", async (req, res) => {
  try {
    await autenticarUsuario(req);
  } catch (erroAuth) {
    return res.status(401).json({ erro: "Sessao invalida ou expirada. Entre novamente." });
  }

  const chunks = [];
  let total = 0;
  let excedeuLimite = false;
  const limite = 100 * 1024 * 1024;

  req.on("data", chunk => {
    total += chunk.length;
    if (total > limite) {
      excedeuLimite = true;
      res.status(413).json({ erro: "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âudio maior que 100 MB." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (excedeuLimite || res.headersSent) return;
    const entrada = Buffer.concat(chunks);
    if (!entrada.length) {
      return res.status(400).json({ erro: "Nenhum ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡udio enviado." });
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
        if (!res.headersSent) res.status(500).json({ erro: "NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel masterizar." });
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
    servidor: "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡brica da Voz",
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
        "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡brica da Voz",

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
// pasta dist. Depois o prÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³prio Express entrega essa pasta.
// As rotas /api/* continuam sendo atendidas acima.
// =====================================================

const distPath = path.join(__dirname, "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get("/central-demonstrativos", (req, res) => {
    res.sendFile(path.join(distPath, "central-demonstrativos.html"));
  });

  // SPA: qualquer rota que nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o seja /api/* recebe o index.html.
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    const indexPath = path.join(distPath, "index.html");

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
      return;
    }

    res.status(500).send(
      "Frontend nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado. Execute npm run build no deploy."
    );
  });
} else {
  console.warn(
    "AVISO: pasta dist nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada. O frontend nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o serÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ exibido atÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â© o build do Vite ser executado."
  );

  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.status(503).send(
      "FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡brica da Voz: frontend ainda nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi compilado. Execute npm run build."
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
        "        FÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂBRICA DA VOZ"
      );
      console.log(
        "================================="
      );
      console.log(
        `Servidor: http://localhost:${PORT}`
      );
      console.log(
        "GeraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de voz: ATIVADA"
      );
      console.log(
        "Segundos antes/depois: ATIVADOS"
      );
      console.log(
        "Fade final: 2 segundos"
      );
      console.log(
        "Trilha da fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡brica: ATIVADA"
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






















