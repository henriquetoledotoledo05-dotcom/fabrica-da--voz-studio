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



const openai = new OpenAI({



  apiKey: process.env.OPENAI_API_KEY,



});







const app = express();



app.use(express.json());



const PORT = Number(process.env.PORT) || 3010;



const PACOTES_CREDITOS = {



  credito1: {



    titulo: "1 crédito",



    creditos: 1,



    valor: 4.90,



  },



  credito10: {



    titulo: "10 créditos",



    creditos: 10,



    valor: 19.90,



  },



  credito50: {



    titulo: "50 créditos",



    creditos: 50,



    valor: 69.90,



  },



  credito100: {



    titulo: "100 créditos",



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



        erro: "Pacote de créditos inválido.",



      });



    }







    const authHeader = req.headers.authorization || "";







    if (!authHeader.startsWith("Bearer ")) {



      return res.status(401).json({



        erro: "Usuário não autenticado.",



      });



    }







    const accessToken = authHeader.replace("Bearer ", "");







    const {



      data: { user },



      error: erroUsuario,



    } = await supabaseAdmin.auth.getUser(accessToken);







    if (erroUsuario || !user) {



      return res.status(401).json({



        erro: "Sessão do usuário inválida.",



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







        external_reference: \`${user.id}|${pacote}\`,







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



      erro: "Não foi possível criar o pagamento.",



    });



  }



});







// =====================================================



// WEBHOOK MERCADO PAGO - PAYMENT + ORDER



// =====================================================



// Esta aplicação usa Checkout Pro pela API de Preferências



// (/checkout/preferences). Para esse fluxo, o evento correto



// é "Pagamentos" (tópico payment). Mantemos suporte a "order"



// também para compatibilidade futura.



// O mesmo pagamento não pode gerar créditos duas vezes porque



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



      "MERCADOPAGO_WEBHOOK_SECRET não configurada no servidor."



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



  // O data.id é usado em minúsculas no cálculo da assinatura.



  const manifest =



    \`id:${String(dataId).toLowerCase()};request-id:${xRequestId};ts:${ts};\`;







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



        erro: "ID do recurso não informado.",



      });



    }







    if (!validarAssinaturaMercadoPago(req, dataId)) {



      console.error("Webhook Mercado Pago rejeitado: assinatura inválida.");



      return res.status(401).json({



        erro: "Assinatura do webhook inválida.",



      });



    }







    if (tipo !== "payment" && tipo !== "order") {



      console.log("Webhook ignorado: tipo não suportado:", tipo);



      return res.status(200).json({



        recebido: true,



        processado: false,



      });



    }







    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {



      throw new Error(



        "MERCADOPAGO_ACCESS_TOKEN não configurado."



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



        \`https\://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}\`,



        {



          method: "GET",



          headers: {



            Authorization:



              \`Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}\`,



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



          erro: "Não foi possível consultar o pagamento no Mercado Pago.",



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



        \`https\://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}\`,



        {



          method: "GET",



          headers: {



            Authorization:



              \`Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}\`,



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



          erro: "Não foi possível consultar a order no Mercado Pago.",



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



        "Pagamento ainda não está aprovado/acreditado. Nenhum crédito será adicionado."



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







    // Fallback para metadata caso a referência externa não esteja disponível.



    if ((!userId || !pacote) && metadata) {



      userId = String(metadata.user_id || "").trim();



      pacote = String(metadata.pacote || "").trim();



    }







    if (!userId || !pacote) {



      console.error(



        "Não foi possível identificar usuário/pacote do pagamento.",



        {



          externalReference,



          metadata,



        }



      );







      return res.status(400).json({



        erro: "Não foi possível identificar o usuário e o pacote do pagamento.",



      });



    }







    const pacoteSelecionado = PACOTES_CREDITOS[pacote];







    if (!pacoteSelecionado) {



      console.error("Pacote não encontrado:", pacote);



      return res.status(400).json({



        erro: "Pacote de créditos não encontrado.",



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



        erro: "Valor do pagamento não corresponde ao pacote.",



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



        erro: "Não foi possível registrar o pagamento no Supabase.",



      });



    }







    console.log("Pagamento processado pelo Supabase:", data);



    console.log(



      "Créditos adicionados:",



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



// CONFIGURAÇÃO



// =====================================================







const allowedOrigins = [



  "https\://www\.fabricadavozstudio.com.br",



  "https\://fabricadavozstudio.com.br",



  "http\://localhost:5173",



  "http\://localhost:4173",



  "http\://localhost:3010",



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







app.options(/.\*/, cors());







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



    /^data:audi&#x6F;**\\/**[^;]+;base64,/i,



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



        /Duration:\s\*(\d+):(\d+):([\d.]+)/



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



        horas \* 3600 +



        minutos \* 60 +



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



      \`atempo=${velocidade}\`,







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



  segundosFinal,



  reverbAtivo = false



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



      inicio \* 1000



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



      \`[0:a]adelay=${delayMs}|${delayMs},\` +

      (reverbAtivo ? "aecho=0.8:0.9:70:0.25," : "") +

      \`apad=pad_dur=${final}[voz];\` +







      // Trilha:



      // 20% de volume, duração final exata



      // e fade out nos últimos 2 segundos.



      \`[1:a]volume=0.20,\` +



      \`atrim=duration=${duracaoTotal},\` +



      \`afade=t=out:st=${inicioFade}:d=2[trilha];\` +







      // Mistura voz + trilha.



      \`[voz][trilha]\` +



      \`amix=inputs=2:\` +



      \`duration=first:\` +



      \`dropout_transition=0:\` +



      \`normalize=0,\` +



      \`atrim=duration=${duracaoTotal},\` +



      \`asetpts=N/SR/TB[out]\`,







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



      instructions: \`



Você é um revisor especializado em textos para locução de rádio em português do Brasil.







Corrija:



\- erros de ortografia;



\- acentuação;



\- pontuação;



\- concordância;



\- palavras digitadas incorretamente;



\- frases que estejam pouco naturais para serem faladas.







Deixe o texto natural, claro e agradável para uma locução.







MUITO IMPORTANTE:



\- Não invente informações.



\- Não altere nomes de pessoas, empresas ou lugares.



\- Não altere números de telefone.



\- Não altere preços.



\- Não altere datas ou horários.



\- Não altere endereços.



\- Preserve as informações e o sentido original.



\- Retorne SOMENTE o texto corrigido, sem explicações, sem aspas e sem comentários.



      \`,



      input: texto.trim(),



    });







    const textoCorrigido = resposta.output_text?.trim();







    if (!textoCorrigido) {



      return res.status(500).json({



        erro: "A IA não retornou um texto corrigido.",



      });



    }







    res.json({



      texto: textoCorrigido,



    });



  } catch (erro) {



    console.error("ERRO AO CORRIGIR TEXTO:", erro);







    res.status(500).json({



      erro: "Não foi possível corrigir o texto.",



      detalhes: erro?.message || "Erro desconhecido",



    });



  }



});







// =====================================================



// AUTENTICAÇÃO E CRÉDITOS



// =====================================================







async function autenticarUsuario(req) {



  const authHeader = req.headers.authorization || "";







  if (!authHeader.startsWith("Bearer ")) {



    throw new Error("Usuário não autenticado.");



  }







  const accessToken = authHeader.replace("Bearer ", "").trim();







  if (!accessToken) {



    throw new Error("Token de autenticação não informado.");



  }







  const {



    data: { user },



    error,



  } = await supabaseAdmin.auth.getUser(accessToken);







  if (error || !user) {



    throw new Error("Sessão do usuário inválida.");



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



    console.error("ERRO AO CONSUMIR CRÉDITOS:", error);



    throw new Error(



      error.message || "Não foi possível consumir os créditos."



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



    console.error("ERRO AO DEVOLVER CRÉDITOS:", error);



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

// GERAR VOZ - CARTESIA

// =====================================================



// Pode receber o UUID da voz diretamente do frontend ou um apelido.

// Se usar apelidos, configure os IDs abaixo no Render como variáveis de ambiente.

const VOZES_CARTESIA = {

  paulinho: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',

  aninha: 'bd914056-a671-4cc2-8a1d-a27986fd1ad8',

  flavinha: '52ace6a9-86f9-4bd3-9e5a-cc3f99d9a551',

  gaby: '9d85cbd2-a5b8-4c0b-b8b6-6d1a7d133039',

  luiza: '7aade9d3-456d-482e-b8ab-4ffb37e23783',

  nina: '8207ca11-20cc-4061-bfc9-86711d52a66e',

  gustavo: '9baa38f2-0797-4f48-884e-8132dfc0cbda',

  loureno: 'fd12fc80-d3e9-4762-aaec-54fb6e3f7a56',

  vitor: '0955a4b0-5a6a-4f2d-8b96-79c647fef708',

  vincius: '5001b299-6aeb-48d0-b4b4-bf6196a16946',

  rafael: '2fa1edae-7d1e-40d9-ac10-1f0f6ed57a52',

  henrique: '162e47b4-376d-4d8d-84cc-879f978c42fb',

  pedro: '72253ed9-990b-45d2-b1af-80e7f0b27cf4',

  noah: 'e16c6afe-5f8d-498c-b358-10a5bdefdfd1',

  celso: '16efe60e-8740-4bb4-9743-6efbf75784ba',

};



function resolverVoiceIdCartesia(voiceId) {

  const informado = String(voiceId || '').trim();

  if (!informado) return '';



  const apelido = informado

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .toLowerCase()

    .replace(/[^a-z0-9]/g, '');



  // UUID de voz da Cartesia enviado pelo frontend.

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(informado)) {

    return informado;

  }



  // Apelido/nome do locutor configurado no Render.

  return VOZES_CARTESIA[apelido] || '';

}



app.post('/api/gerar-voz', async (req, res) => {

  let usuarioId = null;

  let creditosConsumidos = 0;



  try {

    const { texto, voiceId, speed, categoria, estilo, reverb } = req.body;

    console.log('ESTILO RECEBIDO:', estilo);

    console.log('=================================');

    console.log('GERANDO VOZ - CARTESIA');

    console.log('=================================');



    if (typeof texto !== 'string' || !texto.trim()) {

      return res.status(400).json({ erro: 'Digite um texto.' });

    }

    if (!voiceId) {

      return res.status(400).json({ erro: 'Nenhuma voz foi selecionada.' });

    }

    if (!process.env.CARTESIA_API_KEY) {

      return res.status(500).json({

        erro: 'CARTESIA_API_KEY não está configurada nas variáveis de ambiente do Render.',

      });

    }



    const cartesiaVoiceId = resolverVoiceIdCartesia(voiceId);

    if (!cartesiaVoiceId) {

      return res.status(400).json({

        erro: \`A voz "${String(voiceId)}" não foi reconhecida. Confira o ID da voz da Cartesia enviado pelo frontend.\`,

      });

    }



    const textoLimpo = texto.trim();

    const quantidadeCaracteres = textoLimpo.length;

    const creditosNecessarios = calcularCreditosNecessarios(textoLimpo);



    console.log('Quantidade de caracteres:', quantidadeCaracteres);

    console.log('Créditos necessários:', creditosNecessarios);



    // AUTENTICAR USUÁRIO

    const usuario = await autenticarUsuario(req);

    usuarioId = usuario.id;



    // CONSUMIR CRÉDITOS: cada bloco de até 800 caracteres consome 1 crédito.

    await consumirCreditos(usuarioId, creditosNecessarios);

    creditosConsumidos = creditosNecessarios;



    console.log('Créditos consumidos:', creditosConsumidos);

    console.log('Cartesia Voice ID:', cartesiaVoiceId);

    console.log('Texto:', textoLimpo);



    // O Sonic entende o contexto do texto. Não enviamos as tags [excited],

    // [happily] etc. da ElevenLabs porque não são instruções equivalentes na Cartesia.

    // Os presets abaixo ajustam levemente velocidade e volume para cada estilo.

        const presetsEstilo = {
  normal:        { speed: 1.00, volume: 1.00, emotion: 'neutral' },
  animado:       { speed: 1.06, volume: 1.08, emotion: 'excited' },
  muitoAnimado:  { speed: 1.12, volume: 1.16, emotion: 'excited' },
  superImpacto:  { speed: 1.08, volume: 1.22, emotion: 'excited' },
  serio:         { speed: 0.96, volume: 0.96, emotion: 'neutral' },
  urgente:       { speed: 1.10, volume: 1.12, emotion: 'angry' },
  comercial:     { speed: 1.03, volume: 1.05, emotion: 'content' },
  festa:         { speed: 1.10, volume: 1.14, emotion: 'excited' },
  solene:        { speed: 0.94, volume: 0.96, emotion: 'neutral' },
};

const preset = presetsEstilo[estilo] || presetsEstilo.normal;

const resposta = await fetch('https\://api.cartesia.ai/tts/bytes', {

      method: 'POST',

      headers: {

        Authorization: process.env.CARTESIA_API_KEY,

        'Cartesia-Version': process.env.CARTESIA_API_VERSION || '2026-08-14',

        'Content-Type': 'application/json',

        Accept: 'audio/mpeg',

      },

      body: JSON.stringify({

        model_id: process.env.CARTESIA_MODEL_ID || 'sonic-3.6',

        transcript: textoLimpo,

        voice: cartesiaVoiceId,

        locale: 'pt',

        output_format: {

          container: 'mp3',

          sample_rate: 44100,

          bit_rate: 128000,

        },

       generation_config: {

  speed: preset.speed,

  volume: preset.volume,

},

      }),

    });



    if (!resposta.ok) {

      const erroApi = await resposta.text();

      console.error('CARTESIA ERRO:', resposta.status, erroApi);

      throw new Error(\`Cartesia (${resposta.status}): ${erroApi || 'falha ao gerar áudio.'}\`);

    }



    let audio = Buffer.from(await resposta.arrayBuffer());

    if (!audio.length) {

      throw new Error('A Cartesia retornou um áudio vazio.');

    }



    console.log('Áudio recebido da Cartesia:', audio.length, 'bytes');



    // Mantém o ajuste opcional de velocidade que já existia na aplicação.

    if (speed !== undefined && speed !== null && Number(speed) !== 1) {

      audio = await alterarVelocidade(audio, Number(speed));

    }

    if (!audio.length) {

      throw new Error('O áudio ficou vazio após o processamento.');

    }



    res.set({

      'Content-Type': 'audio/mpeg',

      'Content-Length': audio.length.toString(),

      'Cache-Control': 'no-store',

      'X-Creditos-Consumidos': creditosConsumidos.toString(),

    });

    return res.send(audio);

  } catch (erro) {

    console.error('ERRO AO GERAR VOZ COM CARTESIA:', erro);



    // Devolve os créditos caso a geração falhe depois do consumo.

    if (usuarioId && creditosConsumidos > 0) {

      try {

        await devolverCreditos(usuarioId, creditosConsumidos);

        console.log('Créditos devolvidos:', creditosConsumidos);

      } catch (erroDevolucao) {

        console.error('ERRO AO DEVOLVER CRÉDITOS:', erroDevolucao);

      }

    }



    const mensagem = erro?.message || 'Não foi possível gerar a voz.';

    const semCreditos = mensagem.toLowerCase().includes('créditos insuficientes');

    return res.status(semCreditos ? 402 : 500).json({

      erro: semCreditos

        ? 'Você não possui créditos suficientes para gerar essa locução.'

        : mensagem,

    });

  }

});





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



        reverbAtivo,



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



          \_\_dirname,



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



            \`Trilha não encontrada: ${nomeTrilha}\`,



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



          Boolean(reverbAtivo)



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



        reverbAtivo,



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



          segundosFinal,



          Boolean(reverbAtivo)



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



              "Áudio WAV não informado.",



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



                "FFmpeg conversão:",



                erro



              );







              if (!res.headersSent) {



                res.status(500).json({



                  erro:



                    erro ||



                    "Não foi possível converter o áudio para MP3.",



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



        "ERRO NA CONVERSÃO PARA MP3:",



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



// HEALTH CHECK



// =====================================================







app.get("/api/health", (req, res) => {



  res.json({



    ok: true,



    servidor: "Fábrica da Voz",



    porta: PORT,



    ffmpeg: !!ffmpegPath,



    geracaoVoz: true,

    provedorVoz: 'Cartesia',



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



      provedorVoz:



        'Cartesia',







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



// O Render precisa executar \`npm run build\` para criar a



// pasta dist. Depois o próprio Express entrega essa pasta.



// As rotas /api/\* continuam sendo atendidas acima.



// =====================================================







const distPath = path.join(\_\_dirname, "dist");







if (fs.existsSync(distPath)) {



  app.use(express.static(distPath));







  // SPA: qualquer rota que não seja /api/\* recebe o index.html.



  app.get(/^(?!**\\/**&#x61;pi(?:**\\/**|$)).\*/, (req, res) => {



    const indexPath = path.join(distPath, "index-cartesia.html");







    if (fs.existsSync(indexPath)) {



      res.sendFile(indexPath);



      return;



    }







    res.status(500).send(



      "Frontend não encontrado. Execute npm run build no deploy."



    );



  });



} else {



  console.warn(



    "AVISO: pasta dist não encontrada. O frontend não será exibido até o build do Vite ser executado."



  );







  app.get(/^(?!**\\/**&#x61;pi(?:**\\/**|$)).\*/, (req, res) => {



    res.status(503).send(



      "Fábrica da Voz: frontend ainda não foi compilado. Execute npm run build."



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



        "        FÁBRICA DA VOZ"



      );



      console.log(



        "================================="



      );



      console.log(



        \`Servidor: http\://localhost:${PORT}\`



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



    \`Recebido ${sinal}. Encerrando servidor...\`



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
