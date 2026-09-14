import logoFabrica from './assets/logo-fabrica.png'
import { useState } from 'react'
import './App.css'

type Voz = {
  id: string
  nome: string
  genero: 'masculina' | 'feminina'
  foto: string
  demonstrativo: string
}

function App() {
  const [categoriaSelecionada, setCategoriaSelecionada] =
    useState<string | null>(null)

  const [vozSelecionada, setVozSelecionada] =
    useState('celso')

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

  const [segundosInicio, setSegundosInicio] =
    useState(5)

  const [segundosFinal, setSegundosFinal] =
    useState(5)

  const vozes: Voz[] = [
    {
      id: 'rpNe0HOx7heUulPiOEaG',
      nome: 'Celso',
      genero: 'masculina',
      foto: '/vozes/celso.png',
      demonstrativo: '/demonstrativos/celso.mp3'
    },
    {
      id: 'zhza6dIY7yb1xz5MKTvQ',
      nome: 'Pedro',
      genero: 'masculina',
      foto: '/vozes/pedro.png',
      demonstrativo: '/demonstrativos/pedro.mp3'
    },
    {
      id: 'x8FWrDHAK5xiFTJLpnHq',
      nome: 'Luiza',
      genero: 'feminina',
      foto: '/vozes/luiza.png',
      demonstrativo: '/demonstrativos/luiza.mp3'
    },
    {
      id: 'iScHbNW8K33gNo3lGgbo',
      nome: 'Gaby',
      genero: 'feminina',
      foto: '/vozes/gaby.png',
      demonstrativo: '/demonstrativos/gaby.mp3'
    }
  ]

  const vozAtual =
    vozes.find(
      (voz) => voz.id === vozSelecionada
    ) || vozes[0]

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
      const API_URL =
        import.meta.env.VITE_API_URL || ''

      const resposta =
        await fetch(
          `${API_URL}/api/gerar-voz`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              texto: textoFinal,

              voiceId:
                vozAtual.id,

              speed:
                velocidadeSelecionada
            })
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
        !trilhaSelecionada
      ) {
        alert(
          'Escolha uma trilha primeiro.'
        )
        return
      }

      setMixando(true)

      try {

        const respostaAudio =
          await fetch(
            audioUrl
          )

        if (
          !respostaAudio.ok
        ) {
          throw new Error(
            'Não foi possível acessar o áudio da voz.'
          )
        }

        const audioBlob =
          await respostaAudio.blob()

        const arrayBuffer =
          await audioBlob.arrayBuffer()

        const bytes =
          new Uint8Array(
            arrayBuffer
          )

        let binary = ''

        const tamanho =
          0x8000

        for (
          let i = 0;
          i < bytes.length;
          i += tamanho
        ) {
          binary +=
            String.fromCharCode(
              ...bytes.subarray(
                i,
                i + tamanho
              )
            )
        }

        const audioBase64 =
          btoa(binary)

        const API_URL =
          import.meta.env.VITE_API_URL || ''

        const respostaMixagem =
          await fetch(
            `${API_URL}/api/mixar-voz`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  audioBase64,

                  trilhaSelecionada,

                  segundosInicio,

                  segundosFinal
                })
            }
          )

        if (
          !respostaMixagem.ok
        ) {

          let mensagem =
            'Erro ao realizar a mixagem.'

          try {

            const erro =
              await respostaMixagem.json()

            mensagem =
              erro.erro ||
              mensagem

          } catch {

            mensagem =
              await respostaMixagem.text()

          }

          throw new Error(
            mensagem
          )
        }

        const mixBlob =
          await respostaMixagem.blob()

        const mixUrl =
          URL.createObjectURL(
            mixBlob
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

              {/* =================================================
                  VOZES
              ================================================= */}

              <div className="vozes">

                <label>
                  Escolha a voz
                </label>

                <div className="opcoes-voz">

                  {vozes.map(
                    (voz) => (

                      <div
                        className="voz-card"
                        key={
                          voz.id
                        }
                      >

                        <button
                          type="button"
                          className={
                            vozSelecionada ===
                            voz.id
                              ? 'voz ativo'
                              : 'voz'
                          }
                          onClick={() =>
                            setVozSelecionada(
                              voz.id
                            )
                          }
                        >

                          <img
                            src={
                              voz.foto
                            }
                            alt={
                              voz.nome
                            }
                            onError={(
                              e
                            ) => {
                              e.currentTarget.style.display =
                                'none'
                            }}
                          />

                          <span>
                            {voz.nome}
                          </span>

                        </button>

                        <audio
                          controls
                          preload="none"
                          src={
                            voz.demonstrativo
                          }
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
                className="campo-texto"
                placeholder="Digite aqui o texto que você quer transformar em voz..."
              />

              {/* =================================================
                  GERAR
              ================================================= */}

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

              </div>

              {/* =================================================
                  RESULTADO
              ================================================= */}

              {audioUrl && (

                <div className="resultado-pos-geracao">

                  <div className="titulo-previa">
                    🎧 Prévia da sua locução
                  </div>

                  <audio
                    className="player-audio"
                    controls
                    src={
                      audioUrl
                    }
                  />

                  <div className="acoes-geracao">

                    <a
                      className="botao-download"
                      href={
                        audioUrl
                      }
                      download="fabrica-da-voz.mp3"
                    >
                      ⬇️ Baixar áudio
                    </a>

                    <button
                      type="button"
                      className="botao-trilha"
                      onClick={() =>
                        setMostrarTrilhas(
                          !mostrarTrilhas
                        )
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

                            <div
                              style={{
                                display:
                                  'flex',
                                gap:
                                  '8px',
                                flexWrap:
                                  'wrap',
                                marginTop:
                                  '10px'
                              }}
                            >

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

                            <label
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '12px'
                              }}
                            >
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
                              ⏭️ Trilha depois da voz
                            </label>

                            <div
                              style={{
                                display:
                                  'flex',
                                gap:
                                  '8px',
                                flexWrap:
                                  'wrap',
                                marginTop:
                                  '10px'
                              }}
                            >

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

                            <label
                              style={{
                                display:
                                  'block',
                                marginTop:
                                  '12px'
                              }}
                            >
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

                          🎵 {segundosInicio}s de trilha
                          {' → '}
                          🎙️ Locução
                          {' → '}
                          {segundosFinal}s de trilha 🎵

                        </div>

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
                          onClick={() =>
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO.mp3'
                            )
                          }
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
                          onClick={() =>
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO (2).mp3'
                            )
                          }
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
                          onClick={() =>
                            setTrilhaSelecionada(
                              '/trilhas/TRILHA PARA MERCADO (3).mp3'
                            )
                          }
                        >
                          ✓ Usar esta trilha
                        </button>

                      </div>

                      {/* =================================================
                          MIXAR
                      ================================================= */}

                      {trilhaSelecionada && (

                        <div
                          className="acoes-geracao"
                          style={{
                            marginTop:
                              '22px'
                          }}
                        >

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

                        </div>

                      )}

                    </div>

                  )}

                </div>

              )}

            </div>

            {/* =================================================
                VOLTAR
            ================================================= */}

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