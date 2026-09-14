import logoFabrica from './assets/logo-fabrica.png'
import { useState } from 'react'
import './App.css'
import noahLocutor from './assets/noah-locutor.png'
import ninaLocutora from './assets/nina-locutora-1.png'

function App() {
  const [categoriaSelecionada, setCategoriaSelecionada] =
    useState<string | null>(null)

  const [vozSelecionada, setVozSelecionada] =
    useState('masculina')

  const [estiloSelecionado, setEstiloSelecionado] =
    useState('normal')

  const [velocidade, setVelocidade] =
    useState('normal')

  const velocidadeSelecionada =
    velocidade === 'normal'
      ? 1
      : velocidade === 'rapido'
      ? 1.25
      : 1.45

  const [audioUrl, setAudioUrl] =
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

  const [segundosInicio, setSegundosInicio] =
    useState(5)

  const [segundosFinal, setSegundosFinal] =
    useState(5)

  // =====================================================
  // GERAR VOZ
  // =====================================================

  const gerarVoz = async () => {
    const textarea =
      document.querySelector(
        'textarea'
      ) as HTMLTextAreaElement

    if (
      !textarea ||
      !textarea.value.trim()
    ) {
      alert(
        'Digite um texto para gerar a voz.'
      )
      return
    }

    const voiceId =
      vozSelecionada === 'feminina'
        ? '21m00Tcm4TlvDq8ikWAM'
        : 'IKne3meq5aSn9XLyUdCD'

    let textoFinal =
      textarea.value

    if (
      estiloSelecionado ===
      'animado'
    ) {
      textoFinal =
        `[excited] ${textarea.value}`
    }

    if (
      estiloSelecionado ===
      'muitoAnimado'
    ) {
      textoFinal =
        `[excited] [happily] ${textarea.value}`
    }

    if (
      estiloSelecionado ===
      'superImpacto'
    ) {
      textoFinal =
        `[excited] [shouts] ${textarea.value}`
    }

    setGerando(true)

    try {
      const resposta =
        await fetch(
          'http://localhost:3010/api/gerar-voz',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              texto: textoFinal,
              voiceId,
              speed:
                velocidadeSelecionada,
            }),
          }
        )

      if (!resposta.ok) {
        let mensagem =
          'Erro ao gerar a voz.'

        try {
          const erro =
            await resposta.json()

          mensagem =
            erro.erro ||
            mensagem

        } catch {
          mensagem =
            await resposta.text()
        }

        throw new Error(
          mensagem
        )
      }

      const audioBlob =
        await resposta.blob()

      const novaAudioUrl =
        URL.createObjectURL(
          audioBlob
        )

      setAudioUrl(
        novaAudioUrl
      )

      const audio =
        new Audio(
          novaAudioUrl
        )

      await audio.play()

    } catch (erro) {

      console.error(
        'Erro ao gerar voz:',
        erro
      )

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

    setNomeTrilhaArquivo(
      arquivo.name
    )

    setTrilhaSelecionada('')

    console.log(
      'Trilha própria selecionada:',
      arquivo.name
    )
  }

  // =====================================================
  // MIXAR VOZ + TRILHA
  // =====================================================

  const mixarVozComTrilha = async () => {
    if (!audioUrl) {
      alert('Gere uma voz primeiro.')
      return
    }

    if (!trilhaSelecionada && !trilhaArquivo) {
      alert(
        'Escolha uma trilha ou envie sua própria trilha.'
      )
      return
    }

    setMixando(true)

    try {
      const vozResponse =
        await fetch(audioUrl)

      if (!vozResponse.ok) {
        throw new Error(
          'Não foi possível acessar o áudio da voz.'
        )
      }

      const vozBuffer =
        await vozResponse.arrayBuffer()

      let trilhaBuffer: ArrayBuffer

      if (trilhaArquivo) {

        trilhaBuffer =
          await trilhaArquivo.arrayBuffer()

      } else {

        const trilhaResponse =
          await fetch(
            trilhaSelecionada
          )

        if (!trilhaResponse.ok) {
          throw new Error(
            'Não foi possível carregar a trilha selecionada.'
          )
        }

        trilhaBuffer =
          await trilhaResponse.arrayBuffer()
      }

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }).webkitAudioContext

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
          Number(segundosInicio) || 0
        )

      const final =
        Math.max(
          0,
          Number(segundosFinal) || 0
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

      // ==============================
      // VOZ
      // ==============================

      const vozSource =
        offline.createBufferSource()

      vozSource.buffer =
        voz

      const vozGain =
        offline.createGain()

      vozGain.gain.setValueAtTime(
        1,
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

      // ==============================
      // TRILHA
      // ==============================

      const trilhaGain =
        offline.createGain()

      const volumeTrilha =
        0.28

      trilhaGain.gain.setValueAtTime(
        0,
        0
      )

      // FADE-IN

      if (inicio > 0) {

        trilhaGain.gain.linearRampToValueAtTime(
          volumeTrilha,
          inicio
        )

      } else {

        trilhaGain.gain.setValueAtTime(
          volumeTrilha,
          0
        )

      }

      // FADE-OUT FINAL

      const fadeInicio =
        inicio +
        duracaoVoz

      const fadeDuracao =
        Math.min(
          final,
          duracaoTotal -
            fadeInicio
        )

      if (fadeDuracao > 0) {

        trilhaGain.gain.setValueAtTime(
          volumeTrilha,
          fadeInicio
        )

        trilhaGain.gain.linearRampToValueAtTime(
          0,
          fadeInicio +
            fadeDuracao
        )

      }

      trilhaGain.connect(
        offline.destination
      )

      // Repetimos a trilha se ela for menor que o projeto.

      let trilhaAtual =
        0

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

      const renderizado =
        await offline.startRendering()

      // ==============================
      // EXPORTAR WAV
      // ==============================

      const wavBlob =
        audioBufferParaWav(
          renderizado
        )

      const mixUrl =
        URL.createObjectURL(
          wavBlob
        )

      setAudioUrl(
        mixUrl
      )

      const audio =
        new Audio(
          mixUrl
        )

      await audio.play()

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
  // CONVERTER AUDIOBUFFER PARA WAV
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

    const bufferArray =
      new ArrayBuffer(
        44 +
        dataLength
      )

    const view =
      new DataView(
        bufferArray
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
      36 +
        dataLength,
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

    let offset =
      44

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
          canaisData[
            canal
          ][i]

        amostra =
          Math.max(
            -1,
            Math.min(
              1,
              amostra
            )
          )

        const inteiro =
          amostra < 0
            ? amostra *
              0x8000
            : amostra *
              0x7fff

        view.setInt16(
          offset,
          inteiro,
          true
        )

        offset +=
          2
      }
    }

    return new Blob(
      [bufferArray],
      {
        type:
          'audio/wav'
      }
    )
  }

  // =====================================================
  // CATEGORIAS
  // =====================================================

  const categorias = [
    {
      emoji: '📻',
      titulo: 'Spot de Rádio',
      descricao:
        'Crie spots profissionais para sua programação'
    },

    {
      emoji: '🎉',
      titulo: 'Chamadas de Festa',
      descricao:
        'Divulgue festas, eventos e shows'
    },

    {
      emoji: '🙏',
      titulo: 'Chamadas Religiosas',
      descricao:
        'Produza chamadas para igrejas e eventos religiosos'
    },

    {
      emoji: '📢',
      titulo: 'Propaganda Comercial',
      descricao:
        'Crie comerciais para empresas e lojas'
    }
  ]

  // =====================================================
  // EDITOR
  // =====================================================

  if (
    categoriaSelecionada
  ) {

    return (

      <div className="app">

        <header>

          <h1>
            FÁBRICA DA VOZ
          </h1>

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
              ESTÚDIO DE LOCUÇÃO
            </span>

            <h2>
              {categoriaSelecionada}
            </h2>

            <p>
              Crie sua locução profissional com inteligência artificial.
            </p>

          </section>

          <section className="categorias">

            <div className="editor">

              <h3>
                Crie sua locução
              </h3>

              {/* VOZES */}

              <div className="vozes">

                <label>
                  Escolha a voz
                </label>

                <div className="opcoes-voz">

                  <div className="voz-card">

                    <button
                      type="button"
                      className={
                        vozSelecionada ===
                        'masculina'
                          ? 'voz ativo'
                          : 'voz'
                      }
                      onClick={() =>
                        setVozSelecionada(
                          'masculina'
                        )
                      }
                    >

                      <img
                        src={
                          noahLocutor
                        }
                        alt="Noah"
                      />

                      <span>
                        Noah
                      </span>

                    </button>

                    <audio
                      controls
                      src="/noah-amostra.mp3"
                    />

                  </div>

                  <div className="voz-card">

                    <button
                      type="button"
                      className={
                        vozSelecionada ===
                        'feminina'
                          ? 'voz ativo'
                          : 'voz'
                      }
                      onClick={() =>
                        setVozSelecionada(
                          'feminina'
                        )
                      }
                    >

                      <img
                        src={
                          ninaLocutora
                        }
                        alt="Nina"
                      />

                      <span>
                        Nina
                      </span>

                    </button>

                    <audio
                      controls
                      src="/nina-amostra.mp3"
                    />

                  </div>

                </div>

              </div>

              {/* ESTILOS */}

              <div className="estilos">

                <label>
                  Escolha o estilo da locução
                </label>

                <div className="opcoes-estilo">

                  <button
                    type="button"
                    className={
                      estiloSelecionado ===
                      'normal'
                        ? 'estilo ativo'
                        : 'estilo'
                    }
                    onClick={() =>
                      setEstiloSelecionado(
                        'normal'
                      )
                    }
                  >

                    <span>
                      🎙️
                    </span>

                    <strong>
                      Normal
                    </strong>

                    <small>
                      Voz natural e profissional
                    </small>

                  </button>

                  <button
                    type="button"
                    className={
                      estiloSelecionado ===
                      'animado'
                        ? 'estilo ativo'
                        : 'estilo'
                    }
                    onClick={() =>
                      setEstiloSelecionado(
                        'animado'
                      )
                    }
                  >

                    <span>
                      🔥
                    </span>

                    <strong>
                      Animado
                    </strong>

                    <small>
                      Mais energia e entusiasmo
                    </small>

                  </button>

                  <button
                    type="button"
                    className={
                      estiloSelecionado ===
                      'muitoAnimado'
                        ? 'estilo ativo'
                        : 'estilo'
                    }
                    onClick={() =>
                      setEstiloSelecionado(
                        'muitoAnimado'
                      )
                    }
                  >

                    <span>
                      🚀
                    </span>

                    <strong>
                      Muito Animado
                    </strong>

                    <small>
                      Mais ritmo e empolgação
                    </small>

                  </button>

                  <button
                    type="button"
                    className={
                      estiloSelecionado ===
                      'superImpacto'
                        ? 'estilo ativo'
                        : 'estilo'
                    }
                    onClick={() =>
                      setEstiloSelecionado(
                        'superImpacto'
                      )
                    }
                  >

                    <span>
                      💥
                    </span>

                    <strong>
                      Super Impacto
                    </strong>

                    <small>
                      Forte, intenso e marcante
                    </small>

                  </button>

                </div>

              </div>

              {/* VELOCIDADE */}

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

              {/* TEXTO */}

              <label>
                Texto da locução
              </label>

              <textarea
                className="campo-texto"
                placeholder="Digite aqui o texto que você quer transformar em voz..."
              />

              {/* EDITOR DE TEMPO */}

              <div className="editor-tempo">

                <h3>
                  ⏱️ Editor de tempo
                </h3>

                <p>
                  Defina quantos segundos de trilha você quer antes e depois da locução.
                </p>

                <div className="tempo-opcoes">

                  <div className="tempo-campo">

                    <label>
                      ⏮️ Início
                    </label>

                    <div className="tempo-presets">

                      {[0, 5, 10, 15, 20].map(
                        (valor) => (

                          <button
                            key={
                              valor
                            }
                            type="button"
                            className={
                              segundosInicio ===
                              valor
                                ? 'velocidade ativo'
                                : 'velocidade'
                            }
                            onClick={() =>
                              setSegundosInicio(
                                valor
                              )
                            }
                          >
                            {valor}s
                          </button>

                        )
                      )}

                    </div>

                    <label>
                      Personalizado
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={
                        segundosInicio
                      }
                      onChange={(e) =>
                        setSegundosInicio(
                          Math.min(
                            60,
                            Math.max(
                              0,
                              Number(
                                e.target.value
                              )
                            )
                          )
                        )
                      }
                    />

                  </div>

                  <div className="tempo-campo">

                    <label>
                      ⏭️ Final
                    </label>

                    <div className="tempo-presets">

                      {[0, 5, 10, 15, 20].map(
                        (valor) => (

                          <button
                            key={
                              valor
                            }
                            type="button"
                            className={
                              segundosFinal ===
                              valor
                                ? 'velocidade ativo'
                                : 'velocidade'
                            }
                            onClick={() =>
                              setSegundosFinal(
                                valor
                              )
                            }
                          >
                            {valor}s
                          </button>

                        )
                      )}

                    </div>

                    <label>
                      Personalizado
                    </label>

                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={
                        segundosFinal
                      }
                      onChange={(e) =>
                        setSegundosFinal(
                          Math.min(
                            60,
                            Math.max(
                              0,
                              Number(
                                e.target.value
                              )
                            )
                          )
                        )
                      }
                    />

                  </div>

                </div>

                <div className="resumo-tempo">

                  🎵 Trilha:{' '}

                  <strong>
                    {segundosInicio}s
                  </strong>

                  {' → '}

                  🎙️ Voz

                  {' → '}

                  <strong>
                    {segundosFinal}s
                  </strong>

                  {' '}🎵

                </div>

              </div>

              {/* AÇÕES */}

              <div className="acoes-geracao">

                <button
                  className="botao-gerar"
                  onClick={
                    gerarVoz
                  }
                  disabled={
                    gerando
                  }
                >

                  {gerando
                    ? '⏳ Gerando...'
                    : '🔊 Gerar voz'}

                </button>

                {audioUrl && (

                  <a
                    className="botao-download"
                    href={
                      audioUrl
                    }
                    download="fabrica-da-voz-mixada.wav"
                  >
                    ⬇️ Baixar MP3
                  </a>

                )}

                {audioUrl && (

                  <button
                    type="button"
                    className="botao-trilha"
                    onClick={() =>
                      setMostrarTrilhas(
                        !mostrarTrilhas
                      )
                    }
                  >
                    🎵 Adicionar trilha
                  </button>

                )}

                {/* PAINEL DE TRILHAS */}

                {mostrarTrilhas && (

                  <div className="painel-trilhas">

                    <h3>
                      🎵 Escolha uma trilha
                    </h3>

                    {/* UPLOAD */}

                    <div
                      className="trilha-item"
                    >

                      <strong>
                        📤 Enviar minha própria trilha
                      </strong>

                      <p>
                        Escolha uma música ou trilha de áudio do seu computador.
                      </p>

                      <input
                        type="file"
                        accept="audio/*"
                        onChange={
                          selecionarTrilhaArquivo
                        }
                      />

                      {nomeTrilhaArquivo && (

                        <div
                          style={{
                            marginTop:
                              '10px'
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
                            width:
                              '100%',
                            marginTop:
                              '10px'
                          }}
                          src={
                            URL.createObjectURL(
                              trilhaArquivo
                            )
                          }
                        />

                      )}

                    </div>

                    {/* TRILHA 1 */}

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

                          setTrilhaArquivo(
                            null
                          )

                          setNomeTrilhaArquivo(
                            ''
                          )

                        }}
                      >
                        ✓ Usar esta trilha
                      </button>

                    </div>

                    {/* TRILHA 2 */}

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

                          setTrilhaArquivo(
                            null
                          )

                          setNomeTrilhaArquivo(
                            ''
                          )

                        }}
                      >
                        ✓ Usar esta trilha
                      </button>

                    </div>

                    {/* TRILHA 3 */}

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

                          setTrilhaArquivo(
                            null
                          )

                          setNomeTrilhaArquivo(
                            ''
                          )

                        }}
                      >
                        ✓ Usar esta trilha
                      </button>

                    </div>

                  </div>

                )}

                {/* BOTÃO MIXAR */}

                {(trilhaSelecionada ||
                  trilhaArquivo) && (

                  <button
                    type="button"
                    className="botao-trilha"
                    onClick={
                      mixarVozComTrilha
                    }
                    disabled={
                      mixando
                    }
                  >

                    {mixando
                      ? '⏳ Mixando...'
                      : '🎚️ Mixar voz + trilha'}

                  </button>

                )}

                {audioUrl && (

                  <div className="titulo-previa">
                    🎧 Prévia da sua locução
                  </div>

                )}

                {audioUrl && (

                  <audio
                    className="player-audio"
                    controls
                    src={
                      audioUrl
                    }
                  />

                )}

              </div>

            </div>

            <button
              className="voltar"
              onClick={() =>
                setCategoriaSelecionada(
                  null
                )
              }
            >
              ← Voltar
            </button>

          </section>

        </main>

      </div>
    )
  }

  // =====================================================
  // TELA INICIAL
  // =====================================================

  return (

    <div className="app">

      <header className="topo">

        <div className="logo">

          <img
            src={logoFabrica}
            alt="Fábrica da Voz"
          />

        </div>

      </header>

      <main className="main">

        <section className="hero">

          <span className="tag">
            INTELIGÊNCIA ARTIFICIAL
          </span>

          <h2>
            Transforme suas ideias
            <br />
            em voz profissional.
          </h2>

          <p>
            Crie spots, chamadas e propagandas com vozes
            realistas para rádio, eventos e empresas.
          </p>

        </section>

        <section className="categorias">

          <h3>
            O que você quer produzir?
          </h3>

          <div className="grid">

            {categorias.map(
              (categoria) => (

                <button
                  className="card"
                  key={
                    categoria.titulo
                  }
                  onClick={() =>
                    setCategoriaSelecionada(
                      categoria.titulo
                    )
                  }
                >

                  <span className="cardEmoji">
                    {categoria.emoji}
                  </span>

                  <div className="cardTexto">

                    <h4>
                      {categoria.titulo}
                    </h4>

                    <p>
                      {categoria.descricao}
                    </p>

                  </div>

                  <span className="seta">
                    →
                  </span>

                </button>

              )
            )}

          </div>

        </section>

      </main>

      <footer>

        <p>
          © 2026 Fábrica da Voz • Estúdio de Locução com IA
        </p>

      </footer>

    </div>
  )
}

export default App