import logoFabrica from './assets/logo-fabrica.png'
import { useState } from 'react'
import './App.css'

import noahLocutor from './assets/noah-locutor.png'
import ninaLocutora from './assets/nina-locutora-1.png'
import celsoLocutor from './assets/celso-locutor.png'
import pedroLocutor from './assets/pedro-locutor.png'
import gabyLocutora from './assets/gaby-locutor.png'
import luizaLocutora from './assets/luisa-locutor.png'

type Voz = {
  id: string
  nome: string
  foto: string
  demonstrativo: string
}
const henriqueLocutor = '/henrique-foto.png'
const mateusLocutor = '/mateus-foto.png'
const viniciusLocutor = '/vinicius-foto.png'
const vitorLocutor = '/vitor-foto.png'

function App() {
    const [acessoLiberado, setAcessoLiberado] = useState(() => {
    return sessionStorage.getItem('fabrica_acesso') === 'liberado'
  })

  const [senhaAcesso, setSenhaAcesso] = useState('')
  const [erroAcesso, setErroAcesso] = useState('')

  const entrarNaFabrica = () => {
    if (senhaAcesso === 'fabrica@1985') {
      sessionStorage.setItem('fabrica_acesso', 'liberado')
      setAcessoLiberado(true)
      setErroAcesso('')
      return
    }

    setErroAcesso('Senha incorreta.')
    setSenhaAcesso('')
  }

  const [vozSelecionada, setVozSelecionada] =
    useState('IKne3meq5aSn9XLyUdCD')

  const [estiloSelecionado, setEstiloSelecionado] =
    useState('normal')

  const [velocidade, setVelocidade] =
    useState('normal')

  const [texto, setTexto] =
    useState('')
  const [corrigindoTexto, setCorrigindoTexto] = useState(false)  

  const [audioUrl, setAudioUrl] =
    useState('')

    const [mixAudioUrl, setMixAudioUrl] =
  useState('')

    const [audioOriginalUrl, setAudioOriginalUrl] =
  useState('')

  const [gerando, setGerando] =
    useState(false)

  const [mixando, setMixando] =
    useState(false)

  const [mostrarTrilhas, setMostrarTrilhas] =
    useState(false)

  const [trilhaSelecionada, setTrilhaSelecionada] =
    useState('')

  const [trilhaArquivo, setTrilhaArquivo] =
    useState<File | null>(null)

  const [nomeTrilhaArquivo, setNomeTrilhaArquivo] =
    useState('')

  const [volumeTrilha, setVolumeTrilha] =
    useState(28)

  const [volumeVoz, setVolumeVoz] =
    useState(100)

  const [segundosInicio, setSegundosInicio] =
    useState(5)

  const [segundosFinal, setSegundosFinal] =
    useState(5)

  if (!acessoLiberado) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box',
          background: '#090909',
          color: '#fff'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            padding: '35px',
            boxSizing: 'border-box',
            borderRadius: '20px',
            background: '#151515',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}
        >
          <img
            src={logoFabrica}
            alt="Fábrica da Voz"
            style={{
              width: '180px',
              maxWidth: '80%',
              marginBottom: '25px'
            }}
          />

          <h2 style={{ marginBottom: '8px' }}>
            🔒 Acesso restrito
          </h2>

          <p
            style={{
              opacity: 0.7,
              marginBottom: '25px'
            }}
          >
            Digite a senha para entrar na Fábrica da Voz.
          </p>

          <input
            type="password"
            value={senhaAcesso}
            placeholder="Digite sua senha"
            onChange={(e) => {
              setSenhaAcesso(e.target.value)
              setErroAcesso('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                entrarNaFabrica()
              }
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '15px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: '#222',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '12px'
            }}
          />

          <button
            type="button"
            onClick={entrarNaFabrica}
            style={{
              width: '100%',
              padding: '15px',
              border: '0',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '16px'
            }}
          >
            Entrar
          </button>

          {erroAcesso && (
            <p
              style={{
                color: '#ff6b6b',
                marginTop: '15px',
                fontWeight: 600
              }}
            >
              {erroAcesso}
            </p>
          )}
        </div>
      </div>
    )
  }
  // =====================================================
  // VELOCIDADE
  // =====================================================

  const velocidadeSelecionada =
    velocidade === 'normal'
      ? 1
      : velocidade === 'rapido'
        ? 1.25
        : 1.45

  // =====================================================
  // VOZES
  // =====================================================

  const vozes: Voz[] = [
    {
      id: 'rz25pon9uanPpUGOW98Y',
      nome: 'Noah',
      foto: noahLocutor,
      demonstrativo: '/noah-amostra-novo.mp3'
    },

    {
      id: 'cxaKsaoZvZoce6kBBu0n',
      nome: 'Nina',
      foto: ninaLocutora,
      demonstrativo: '/nina-amostra-novo.mp3'
    },

    {
      id: 'rpNe0HOx7heUulPiOEaG',
      nome: 'Celso',
      foto: celsoLocutor,
      demonstrativo: '/vozes/celso.mp3'
    },

    {
      id: '0utPdY4y5ppoXQxzubar',
      nome: 'Pedro',
      foto: pedroLocutor,
      demonstrativo: '/vozes/pedro-amostra-novo.mp3'
    },
        {
      id: 'xyyAflT5WWJ3HeqszUn0',
      nome: 'Henrique',
      foto: henriqueLocutor,
      demonstrativo: '/vozes/henrique-voz.mp3'
    },
        {
      id: 'xqmVsyH6TEc0qQYSNT8P',
      nome: 'Mateus',
      foto: mateusLocutor,
      demonstrativo: '/vozes/mateus-voz.mp3'
    },
        {
      id: 'B7HqRIxroDpybJI9vXMj',
      nome: 'Vinícius',
      foto: viniciusLocutor,
      demonstrativo: '/vozes/vinicius-voz.mp3'
    },
        {
      id: 'a5zGngtwpITbxmy3Sekk',
      nome: 'Vitor',
      foto: vitorLocutor,
      demonstrativo: '/vozes/vitor-voz.mp3'
    },

    {
      id: 'myEJoaX0UkuoJmX7w2Rf',
      nome: 'Luiza',
      foto: luizaLocutora,
      demonstrativo: '/vozes/luiza.mp3'
    },

    {
      id: 'qn85SVnJvSWg5wutkjZa',
      nome: 'Gaby',
      foto: gabyLocutora,
      demonstrativo: '/vozes/gaby.mp3'
    }
  ]

  const vozesMasculinas = vozes.filter(
  (voz) =>
    ['Noah', 'Celso', 'Pedro', 'Henrique', 'Mateus', 'Vinícius', 'Vitor'].includes(voz.nome)
)

const vozesFemininas = vozes.filter(
  (voz) =>
    ['Nina', 'Luiza', 'Gaby'].includes(voz.nome)
)
  const vozAtual =
    vozes.find(
      (voz) =>
        voz.id === vozSelecionada
    ) || vozes[0]

  // =====================================================
  // GERAR VOZ
  // =====================================================

  const corrigirTextoComIA = async () => {
  const textoDigitado = texto.trim()

  if (!textoDigitado) {
    alert('Digite um texto para corrigir.')
    return
  }

  setCorrigindoTexto(true)

  try {
    const resposta = await fetch('/api/corrigir-texto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texto: textoDigitado
      })
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      throw new Error(dados?.erro || 'Não foi possível corrigir o texto.')
    }

    setTexto(dados.texto || '')
  } catch (erro) {
    console.error('Erro ao corrigir texto:', erro)

    alert(
      erro instanceof Error
        ? erro.message
        : 'Não foi possível corrigir o texto.'
    )
  } finally {
    setCorrigindoTexto(false)
  }
}
  const gerarVoz = async () => {
  const textoDigitado = texto.trim()

  if (!textoDigitado) {
    alert('Digite um texto para gerar a voz.')
    return
  }

  const textoFinal = textoDigitado

  setGerando(true)

  try {
    const resposta = await fetch(
      '/api/gerar-voz',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texto: textoFinal,
          voiceId: vozAtual.id,
          speed: velocidadeSelecionada,
          estilo: estiloSelecionado
        })
      }
    )

    if (!resposta.ok) {
      const corpoErro = await resposta.text()

      let mensagem = 'Erro ao gerar a voz.'

      try {
        const dadosErro = JSON.parse(corpoErro)

        mensagem =
          dadosErro.erro ||
          dadosErro.error ||
          dadosErro.message ||
          mensagem
      } catch {
        if (corpoErro.trim()) {
          mensagem = corpoErro
        }
      }

      throw new Error(mensagem)
    }

    // O servidor devolve ÁUDIO MP3, não JSON
    const audioBlob = await resposta.blob()

    if (!audioBlob.size) {
      throw new Error('O servidor retornou um áudio vazio.')
    }

    const urlAudio = URL.createObjectURL(audioBlob)

    setAudioUrl(urlAudio)
    setAudioOriginalUrl(urlAudio)
    setMixAudioUrl('')

    

  } catch (erro) {
    console.error('Erro ao gerar voz:', erro)

    alert(
      erro instanceof Error
        ? erro.message
        : 'Não foi possível gerar a voz.'
    )

  } finally {
    setGerando(false)
  }
}
  // =====================================================
  // SELECIONAR TRILHA DO COMPUTADOR
  // =====================================================

  const selecionarTrilhaArquivo = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const arquivo =
      e.target.files?.[0]

    if (!arquivo) {
      return
    }

    const tiposAceitos = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/mp4',
      'audio/aac',
      'audio/x-m4a'
    ]

    if (
      arquivo.type &&
      !tiposAceitos.includes(
        arquivo.type
      )
    ) {
      alert(
        'Escolha um arquivo de áudio MP3, WAV, OGG, M4A ou AAC.'
      )

      e.target.value = ''

      return
    }

    setTrilhaArquivo(
      arquivo
    )
    setMixAudioUrl('')

    setNomeTrilhaArquivo(
      arquivo.name
    )

    setTrilhaSelecionada('')
  }

  // =====================================================
  // AUDIOBUFFER PARA WAV
  // =====================================================

  const audioBufferParaWav = (
    buffer: AudioBuffer
  ): Blob => {
    const numeroCanais =
      buffer.numberOfChannels

    const sampleRate =
      buffer.sampleRate

    const bitsPorSample =
      16

    const dataLength =
      buffer.length *
      numeroCanais *
      (bitsPorSample / 8)

    const arrayBuffer =
      new ArrayBuffer(
        44 +
        dataLength
      )

    const view =
      new DataView(
        arrayBuffer
      )

    const escreverTexto = (
      offset: number,
      texto: string
    ) => {
      for (
        let i = 0;
        i < texto.length;
        i++
      ) {
        view.setUint8(
          offset + i,
          texto.charCodeAt(i)
        )
      }
    }

    escreverTexto(
      0,
      'RIFF'
    )

    view.setUint32(
      4,
      36 + dataLength,
      true
    )

    escreverTexto(
      8,
      'WAVE'
    )

    escreverTexto(
      12,
      'fmt '
    )

    view.setUint32(
      16,
      16,
      true
    )

    view.setUint16(
      20,
      1,
      true
    )

    view.setUint16(
      22,
      numeroCanais,
      true
    )

    view.setUint32(
      24,
      sampleRate,
      true
    )

    view.setUint32(
      28,
      sampleRate *
        numeroCanais *
        (bitsPorSample / 8),
      true
    )

    view.setUint16(
      32,
      numeroCanais *
        (bitsPorSample / 8),
      true
    )

    view.setUint16(
      34,
      bitsPorSample,
      true
    )

    escreverTexto(
      36,
      'data'
    )

    view.setUint32(
      40,
      dataLength,
      true
    )

    const canaisData:
      Float32Array[] = []

    for (
      let canal = 0;
      canal < numeroCanais;
      canal++
    ) {
      canaisData.push(
        buffer.getChannelData(
          canal %
            buffer.numberOfChannels
        )
      )
    }

    let offset = 44

    for (
      let i = 0;
      i < buffer.length;
      i++
    ) {
      for (
        let canal = 0;
        canal < numeroCanais;
        canal++
      ) {
        let amostra =
          canaisData[canal][i]

        amostra =
          Math.max(
            -1,
            Math.min(
              1,
              amostra
            )
          )

        const valor =
          amostra < 0
            ? amostra * 0x8000
            : amostra * 0x7fff

        view.setInt16(
          offset,
          valor,
          true
        )

        offset += 2
      }
    }

    return new Blob(
      [arrayBuffer],
      {
        type:
          'audio/wav'
      }
    )
  }

  // =====================================================
  // MIXAR VOZ + TRILHA
  // =====================================================

  const mixarVozComTrilha =
    async () => {
      if (!audioUrl) {
        alert(
          'Gere uma voz primeiro.'
        )

        return
      }

      if (
        !trilhaSelecionada &&
        !trilhaArquivo
      ) {
        alert(
          'Escolha uma trilha ou envie sua própria trilha.'
        )

        return
      }

      setMixando(true)

      try {
        const vozResponse =
          await fetch(
            audioOriginalUrl
          )

        if (!vozResponse.ok) {
          throw new Error(
            'Não foi possível acessar o áudio da voz.'
          )
        }

        const vozBuffer =
          await vozResponse.arrayBuffer()

        let trilhaBuffer:
          ArrayBuffer

        if (
          trilhaArquivo
        ) {
          trilhaBuffer =
            await trilhaArquivo.arrayBuffer()
        } else {
          const trilhaResponse =
            await fetch(
              trilhaSelecionada
            )

          if (
            !trilhaResponse.ok
          ) {
            throw new Error(
              'Não foi possível carregar a trilha selecionada.'
            )
          }

          trilhaBuffer =
            await trilhaResponse.arrayBuffer()
        }

        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext
            }
          ).webkitAudioContext

        if (!AudioContextClass) {
          throw new Error(
            'Seu navegador não suporta mixagem de áudio.'
          )
        }

        const contexto =
          new AudioContextClass()

        const voz =
          await contexto.decodeAudioData(
            vozBuffer.slice(0)
          )

        const trilha =
          await contexto.decodeAudioData(
            trilhaBuffer.slice(0)
          )

        const inicio =
          Math.max(
            0,
            Number(
              segundosInicio
            ) || 0
          )

        const final =
          Math.max(
            0,
            Number(
              segundosFinal
            ) || 0
          )

        const duracaoVoz =
          voz.duration

        const duracaoTotal =
          inicio +
          duracaoVoz +
          final

        const sampleRate =
          contexto.sampleRate

        const canais =
          Math.max(
            2,
            voz.numberOfChannels
          )

        const frames =
          Math.ceil(
            duracaoTotal *
            sampleRate
          )

        const offline =
          new OfflineAudioContext(
            canais,
            frames,
            sampleRate
          )

        // =================================================
        // VOZ
        // =================================================

        const vozSource =
          offline.createBufferSource()

        vozSource.buffer =
          voz

        const vozGain =
          offline.createGain()

        const volumeVozNormalizado =
          Math.max(
            0,
            Math.min(
              1.5,
              volumeVoz / 100
            )
          )

        vozGain.gain.setValueAtTime(
          volumeVozNormalizado,
          0
        )

        vozSource.connect(
          vozGain
        )

        vozGain.connect(
          offline.destination
        )

        vozSource.start(
          inicio
        )

        // =================================================
        // TRILHA / DUCKING
        // =================================================

        const trilhaGain =
          offline.createGain()

        const volumeNormal =
          Math.max(
            0,
            Math.min(
              1,
              volumeTrilha / 100
            )
          )

        const volumeDuranteVoz =
          volumeNormal * 0.30

        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          0
        )

        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          inicio
        )

        trilhaGain.gain.setValueAtTime(
          volumeDuranteVoz,
          inicio + 0.01
        )

        const fimDaVoz =
          inicio +
          duracaoVoz

        trilhaGain.gain.setValueAtTime(
          volumeDuranteVoz,
          fimDaVoz
        )

        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          fimDaVoz + 0.01
        )

        // =================================================
        // FADE FINAL
        // =================================================

        if (final > 0) {
          const fadeOutInicio =
            duracaoTotal -
            final

          trilhaGain.gain.setValueAtTime(
            volumeNormal,
            fadeOutInicio
          )

          trilhaGain.gain.linearRampToValueAtTime(
            0,
            duracaoTotal
          )
        }

        trilhaGain.connect(
          offline.destination
        )

        // =================================================
        // REPETIR TRILHA
        // =================================================

        let trilhaAtual = 0

        while (
          trilhaAtual <
          duracaoTotal
        ) {
          const trilhaSource =
            offline.createBufferSource()

          trilhaSource.buffer =
            trilha

          trilhaSource.connect(
            trilhaGain
          )

          const restante =
            duracaoTotal -
            trilhaAtual

          const duracaoFonte =
            Math.min(
              trilha.duration,
              restante
            )

          trilhaSource.start(
            trilhaAtual,
            0,
            duracaoFonte
          )

          trilhaAtual +=
            trilha.duration
        }

        // =================================================
        // RENDERIZAR
        // =================================================

        const renderizado =
          await offline.startRendering()

        const wavBlob =
          audioBufferParaWav(
            renderizado
          )

        const mixUrl =
          URL.createObjectURL(
            wavBlob
          )

        setMixAudioUrl(mixUrl)
        

        await contexto.close()

      } catch (erro) {
        console.error(
          'Erro na mixagem:',
          erro
        )

        alert(
          erro instanceof Error
            ? erro.message
            : 'Não foi possível mixar a voz com a trilha.'
        )

      } finally {
        setMixando(false)
      }
    }

  // =====================================================
  // EDITOR
  // =====================================================

  {
    return (
      <div className="app">

        <header className="topo">

          <div className="logo">

            <img
              src={logoFabrica}
              alt="Fábrica da Voz"
            />

          </div>

          <p
            style={{
              marginTop:
                '25px'
            }}
          >
            Seu estúdio de locução profissional
          </p>

        </header>

        <main className="main">

          <section className="hero">

            <span className="tag">
              ESTÚDIO DE LOCAÇÃO
            </span>

            <h2>
              Estúdio de Locução
            </h2>

            <p>
              Crie sua locução profissional com inteligência artificial.
            </p>

          </section>

          <section className="editor-area">

            <div className="editor">

              <h3>
                Crie sua locução
              </h3>

              {/* =================================================
                  VOZES
              ================================================= */}

              <div className="vozes">

                <label>
                  Escolha a voz
                </label>

                <div className="opcoes-voz">

                  <h3 className="titulo-sexo-voz">
  MASCULINO
</h3>

{vozesMasculinas.map(
  (voz) => (
    <div
      className="voz-card"
      key={voz.id}
    >
      <button
        type="button"
        className={
          vozSelecionada === voz.id
            ? 'voz ativo'
            : 'voz'
        }
        onClick={() =>
          setVozSelecionada(voz.id)
        }
      >
        <img
          src={voz.foto}
          alt={voz.nome}
        />

        <span>
          {voz.nome}
        </span>
      </button>

      <audio
        controls
        preload="none"
        src={voz.demonstrativo}
      />
    </div>
  )
)}

<h3 className="titulo-sexo-voz">
  FEMININA
</h3>

{vozesFemininas.map(
  (voz) => (
    <div
      className="voz-card"
      key={voz.id}
    >
      <button
        type="button"
        className={
          vozSelecionada === voz.id
            ? 'voz ativo'
            : 'voz'
        }
        onClick={() =>
          setVozSelecionada(voz.id)
        }
      >
        <img
          src={voz.foto}
          alt={voz.nome}
        />

        <span>
          {voz.nome}
        </span>
      </button>

      <audio
        controls
        preload="none"
        src={voz.demonstrativo}
      />
    </div>
  )
)}

                </div>

              </div>

              {/* =================================================
                  ESTILOS
              ================================================= */}

              <div className="estilos">

                <label>
                  Estilo da Voz
                </label>

                <select
                  className="seletor-estilo"
                  value={estiloSelecionado}
                  onChange={(e) =>
                    setEstiloSelecionado(e.target.value)
                  }
                  style={{
                    width: '100%',
                    padding: '15px 18px',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.55)',
                    background: '#171020',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="normal">
                    Natural — Voz natural e profissional
                  </option>
                  <option value="animado">
                    Animado — Mais energia e entusiasmo
                  </option>
                  <option value="muitoAnimado">
                    Muito Animado — Mais ritmo e empolgação
                  </option>
                  <option value="superImpacto">
                    Impacto — Forte, intenso e marcante
                  </option>
                  <option value="serio">
                    Sério — Firme, sério e profissional
                  </option>
                  <option value="urgente">
                    Urgente — Atenção e intensidade
                  </option>
                  <option value="comercial">
                    Comercial — Persuasivo e vendedor
                  </option>
                  <option value="festa">
                    Festa — Alegre e descontraído
                  </option>
                  <option value="solene">
                    Solene — Grave e respeitoso
                  </option>
                </select>

              </div>

              {/* =================================================
                  VELOCIDADE
              ================================================= */}

              <div className="opcoes-velocidade">

                <label>
                  Velocidade
                </label>

                <button
                  type="button"
                  className={
                    velocidade ===
                    'normal'
                      ? 'velocidade ativo'
                      : 'velocidade'
                  }
                  onClick={() =>
                    setVelocidade(
                      'normal'
                    )
                  }
                >
                  Normal
                </button>

                <button
                  type="button"
                  className={
                    velocidade ===
                    'rapido'
                      ? 'velocidade ativo'
                      : 'velocidade'
                  }
                  onClick={() =>
                    setVelocidade(
                      'rapido'
                    )
                  }
                >
                  Rápido
                </button>

                <button
                  type="button"
                  className={
                    velocidade ===
                    'superRapido'
                      ? 'velocidade ativo'
                      : 'velocidade'
                  }
                  onClick={() =>
                    setVelocidade(
                      'superRapido'
                    )
                  }
                >
                  Super rápido
                </button>

              </div>

              <div
                style={{
                  height:
                    '20px'
                }}
              />

              {/* =================================================
                  TEXTO
              ================================================= */}

              <label>
                Texto da locução
              </label>

              <textarea
  id="campoTextoLocucao"
  className="campo-texto"
  value={texto}
  onChange={(e) => setTexto(e.target.value)}
  placeholder="Digite aqui o texto que você quer transformar..."
/>

<div className="contador-caracteres">
  {texto.length} caracteres
</div>
<button
  type="button"
  className="botao-corrigir"
  onClick={corrigirTextoComIA}
  disabled={corrigindoTexto}
>
  {corrigindoTexto ? 'Corrigindo texto...' : '✨ Corrigir texto com IA'}
</button>

              {/* =================================================
                  GERAR
              ================================================= */}

              <div className="acoes-geracao">
                <button
                  className="botao-gerar"
                  onClick={gerarVoz}
                  disabled={gerando}
                >
                  {gerando
                    ? '⏳ Gerando...'
                    : '🔊 Gerar voz'}
                </button>
              </div>

              {/* =================================================
                  RESULTADO DA VOZ
              ================================================= */}

              {audioUrl && (
                <div className="resultado-pos-geracao">

                  <div className="titulo-previa">
                    🎧 Prévia da sua locução
                  </div>

                  <audio
                    className="player-audio"
                    controls
                    src={audioUrl}
                  />

                  <div className="acoes-geracao">

                    <a
                      className="botao-download"
                      href={audioUrl}
                      download="fabrica-da-voz.mp3"
                    >
                      ⬇️ Baixar áudio
                    </a>

                    <button
                      type="button"
                      className="botao-trilha"
                      onClick={() =>
                        setMostrarTrilhas(!mostrarTrilhas)
                      }
                    >
                      🎵{' '}
                      {mostrarTrilhas
                        ? 'Fechar trilhas'
                        : 'Adicionar trilha'}
                    </button>

                  </div>

                  {/* =================================================
                      TRILHAS
                  ================================================= */}

                  {mostrarTrilhas && (
                    <div className="painel-trilhas">

                      <h3>
                        🎵 Escolha uma trilha
                      </h3>

                      {/* =================================================
                          EDITOR DE TEMPO
                      ================================================= */}

                      <div className="editor-tempo">

                        <h3>
                          ⏱️ Ajuste da trilha
                        </h3>

                        <p>
                          Escolha quanto tempo de trilha ficará antes e depois da sua locução.
                        </p>

                        <div className="tempo-opcoes">

                          <div className="tempo-campo">

                            <label>
                              ⏮️ Trilha antes da voz
                            </label>

                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={segundosInicio}
                              onChange={(e) =>
                                setSegundosInicio(
                                  Math.min(
                                    60,
                                    Math.max(
                                      0,
                                      Number(e.target.value)
                                    )
                                  )
                                )
                              }
                            />

                            <small>
                              segundos
                            </small>

                          </div>

                          <div className="tempo-campo">

                            <label>
                              ⏭️ Trilha depois da voz
                            </label>

                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={segundosFinal}
                              onChange={(e) =>
                                setSegundosFinal(
                                  Math.min(
                                    60,
                                    Math.max(
                                      0,
                                      Number(e.target.value)
                                    )
                                  )
                                )
                              }
                            />

                            <small>
                              segundos
                            </small>

                          </div>

                        </div>

                        <div className="resumo-tempo">
                          🎵 {segundosInicio}s de trilha
                          {' → '}
                          🎙️ Locução
                          {' → '}
                          {segundosFinal}s de trilha 🎵
                        </div>

                      </div>

                      {/* =================================================
                          TRILHA DO COMPUTADOR
                      ================================================= */}

                      <div className="trilha-item">

                        <strong>
                          📤 Enviar minha própria trilha
                        </strong>

                        <p>
                          Escolha uma música ou trilha de áudio do seu computador.
                        </p>

                        <input
                          type="file"
                          accept="audio/*"
                          onChange={selecionarTrilhaArquivo}
                        />

                        {nomeTrilhaArquivo && (
                          <div
                            style={{
                              marginTop: '10px'
                            }}
                          >
                            🎵{' '}
                            <strong>
                              {nomeTrilhaArquivo}
                            </strong>
                          </div>
                        )}

                        {trilhaArquivo && (
                          <audio
                            controls
                            style={{
                              width: '100%',
                              marginTop: '10px'
                            }}
                            src={URL.createObjectURL(
                              trilhaArquivo
                            )}
                          />
                        )}

                      </div>

                      {/* =================================================
                          TRILHA 1
                      ================================================= */}

                      <div className="trilha-item">

                        <strong>
                          Trilha para Mercado
                        </strong>

                        <audio
                          controls
                          src="/trilhas/TRILHA PARA MERCADO.mp3"
                        />

                        <button
                          type="button"
                          className={
                            trilhaSelecionada ===
                            '/trilhas/TRILHA PARA MERCADO.mp3'
                              ? 'botao-trilha ativo'
                              : 'botao-trilha'
                          }
                          onClick={() => {
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO.mp3'
                            )
                            setMixAudioUrl('')
                            setTrilhaArquivo(null)
                            setNomeTrilhaArquivo('')
                          }}
                        >
                          ✓ Usar esta trilha
                        </button>

                      </div>

                      {/* =================================================
                          TRILHA 2
                      ================================================= */}

                      <div className="trilha-item">

                        <strong>
                          Trilha para Mercado 2
                        </strong>

                        <audio
                          controls
                          src="/trilhas/TRILHA PARA MERCADO (2).mp3"
                        />

                        <button
                          type="button"
                          className={
                            trilhaSelecionada ===
                            '/trilhas/TRILHA PARA MERCADO (2).mp3'
                              ? 'botao-trilha ativo'
                              : 'botao-trilha'
                          }
                          onClick={() => {
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO (2).mp3'
                            )
                            setMixAudioUrl('')
                            setTrilhaArquivo(null)
                            setNomeTrilhaArquivo('')
                          }}
                        >
                          ✓ Usar esta trilha
                        </button>

                      </div>

                      {/* =================================================
                          TRILHA 3
                      ================================================= */}

                      <div className="trilha-item">

                        <strong>
                          Trilha para Mercado 3
                        </strong>

                        <audio
                          controls
                          src="/trilhas/TRILHA PARA MERCADO (3).mp3"
                        />

                        <button
                          type="button"
                          className={
                            trilhaSelecionada ===
                            '/trilhas/TRILHA PARA MERCADO (3).mp3'
                              ? 'botao-trilha ativo'
                              : 'botao-trilha'
                          }
                          onClick={() => {
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO (3).mp3'
                            )
                            setMixAudioUrl('')
                            setTrilhaArquivo(null)
                            setNomeTrilhaArquivo('')
                          }}
                        >
                          ✓ Usar esta trilha
                        </button>

                      </div>

                      {/* =================================================
                          VOLUMES
                      ================================================= */}

                      {(trilhaSelecionada ||
                        trilhaArquivo) && (
                        <div
                          className="controle-volume-trilha"
                          style={{
                            marginTop: '20px',
                            padding: '18px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)'
                          }}
                        >

                          <label
                            style={{
                              display: 'block',
                              marginBottom: '10px',
                              fontWeight: 700
                            }}
                          >
                            🎙️ Volume da voz: {volumeVoz}%
                          </label>

                          <input
                            type="range"
                            min="0"
                            max="150"
                            step="1"
                            value={volumeVoz}
                            onChange={(e) =>
                              setVolumeVoz(
                                Number(e.target.value)
                              )
                            }
                            style={{
                              width: '100%',
                              cursor: 'pointer'
                            }}
                          />

                          <label
                            style={{
                              display: 'block',
                              marginTop: '22px',
                              marginBottom: '10px',
                              fontWeight: 700
                            }}
                          >
                            🎵 Volume da trilha: {volumeTrilha}%
                          </label>

                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={volumeTrilha}
                            onChange={(e) =>
                              setVolumeTrilha(
                                Number(e.target.value)
                              )
                            }
                            style={{
                              width: '100%',
                              cursor: 'pointer'
                            }}
                          />

                          <small
                            style={{
                              display: 'block',
                              marginTop: '12px',
                              opacity: 0.75
                            }}
                          >
                            Durante a voz, a trilha é reduzida automaticamente para deixar o locutor em destaque.
                          </small>

                        </div>
                      )}

                      {/* =================================================
                          MIXAR
                      ================================================= */}

                      {(trilhaSelecionada ||
                        trilhaArquivo) && (
                        <div
                          className="acoes-geracao"
                          style={{
                            marginTop: '22px'
                          }}
                        >

                          <button
                            type="button"
                            className="botao-trilha"
                            style={{
                              color: "#ffffff",
                              background: "linear-gradient(135deg, #6d28d9, #4c1d95)",
                              border: "1px solid #8b5cf6",
                              fontWeight: 700,
                              opacity: 1,
                              visibility: "visible"
                            }}
                            onClick={mixarVozComTrilha}
                            disabled={mixando}
                          >
                            {mixando
                              ? '⏳ Mixando...'
                              : '🎚️ Mixar voz + trilha'}
                          </button>

                        </div>
                      )}

                      {/* =================================================
                          RESULTADO DA MIXAGEM
                      ================================================= */}

                      {mixAudioUrl && (
                        <div className="resultado-mixagem">

                          <div className="titulo-previa">
                            🎵 Mixagem pronta
                          </div>

                          <audio
                            className="player-audio"
                            controls
                            src={mixAudioUrl}
                          />

                          <a
                            href={mixAudioUrl}
                            download="fabrica-da-voz-mixagem.mp3"
                            className="botao-download-mixagem"
                          >
                            ⬇️ Baixar mixagem
                          </a>

                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}


          </div>

          </section>

        </main>

      </div>
    )
  }

}

export default App


