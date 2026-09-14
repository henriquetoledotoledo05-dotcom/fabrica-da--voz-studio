import logoFabrica from './assets/logo-fabrica.png'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import noahLocutor from './assets/noah-locutor.png'
import ninaLocutora from './assets/nina-locutora-1.png'

const API_BASE = ''

type Voice = 'masculina' | 'feminina'
type Style = 'normal' | 'animado' | 'muitoAnimado' | 'superImpacto'

function App() {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null)
  const [vozSelecionada, setVozSelecionada] = useState<Voice>('masculina')
  const [estiloSelecionado, setEstiloSelecionado] = useState<Style>('normal')
  const [velocidade, setVelocidade] = useState('normal')
  const [texto, setTexto] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [vozGeradaUrl, setVozGeradaUrl] = useState('')
  const [gerando, setGerando] = useState(false)
  const [mixando, setMixando] = useState(false)
  const [mostrarTrilhas, setMostrarTrilhas] = useState(false)
  const [trilhaSelecionada, setTrilhaSelecionada] = useState('')
  const [trilhaUpload, setTrilhaUpload] = useState<File | null>(null)
  const [segundosInicio, setSegundosInicio] = useState(5)
  const [segundosFinal, setSegundosFinal] = useState(5)

  const [volumeVoz, setVolumeVoz] = useState(1)
  const [volumeTrilha, setVolumeTrilha] = useState(0.2)
  const [ducking, setDucking] = useState(0.2)
  const [fadeFinal, setFadeFinal] = useState(2)

  const playerRef = useRef<HTMLAudioElement | null>(null)

  const velocidadeSelecionada =
    velocidade === 'normal' ? 1 : velocidade === 'rapido' ? 1.25 : 1.45

  /*
    IMPORTANTE:
    Estes são os IDs que o projeto já estava usando.
    A troca para uma voz realmente brasileira deve ser feita
    com os IDs das vozes brasileiras existentes na sua conta ElevenLabs.
  */
  const voiceId =
    vozSelecionada === 'feminina'
      ? '21m00Tcm4TlvDq8ikWAM'
      : 'IKne3meq5aSn9XLyUdCD'

  useEffect(() => {
    return () => {
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl)
      if (vozGeradaUrl.startsWith('blob:')) URL.revokeObjectURL(vozGeradaUrl)
    }
  }, [audioUrl, vozGeradaUrl])

  const blobParaBase64 = async (blob: Blob) => {
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const tamanho = 0x8000

    for (let i = 0; i < bytes.length; i += tamanho) {
      binary += String.fromCharCode(...bytes.subarray(i, i + tamanho))
    }

    return btoa(binary)
  }

  const gerarVoz = async () => {
    if (!texto.trim()) {
      alert('Digite um texto para gerar a voz.')
      return
    }

    setGerando(true)

    try {
      let textoFinal = texto.trim()

      if (estiloSelecionado === 'animado') {
        textoFinal = `[excited] ${textoFinal}`
      }

      if (estiloSelecionado === 'muitoAnimado') {
        textoFinal = `[excited] [happily] ${textoFinal}`
      }

      if (estiloSelecionado === 'superImpacto') {
        textoFinal = `[excited] [shouts] ${textoFinal}`
      }

      const resposta = await fetch(`${API_BASE}/api/gerar-voz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: textoFinal,
          voiceId,
          speed: velocidadeSelecionada,
        }),
      })

      if (!resposta.ok) {
        let mensagem = 'Erro ao gerar a voz.'

        try {
          const erro = await resposta.json()
          mensagem = erro.erro || mensagem
        } catch {
          const textoErro = await resposta.text()
          if (textoErro) mensagem = textoErro
        }

        throw new Error(mensagem)
      }

      const blob = await resposta.blob()
      const novaUrl = URL.createObjectURL(blob)

      if (vozGeradaUrl.startsWith('blob:')) URL.revokeObjectURL(vozGeradaUrl)
      if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl)

      setVozGeradaUrl(novaUrl)
      setAudioUrl(novaUrl)
      setTrilhaSelecionada('')
      setTrilhaUpload(null)

      setTimeout(() => {
        playerRef.current?.play().catch(() => {})
      }, 50)
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

  const mixar = async () => {
    if (!vozGeradaUrl) {
      alert('Gere uma voz primeiro.')
      return
    }

    if (!trilhaSelecionada && !trilhaUpload) {
      alert('Escolha uma trilha ou envie sua própria trilha.')
      return
    }

    setMixando(true)

    try {
      const vozResponse = await fetch(vozGeradaUrl)

      if (!vozResponse.ok) {
        throw new Error('Não foi possível acessar a voz gerada.')
      }

      const audioBase64 = await blobParaBase64(await vozResponse.blob())
      let respostaMixagem: Response

      const dadosMixagem = {
        audioBase64,
        segundosInicio,
        segundosFinal,
        volumeVoz,
        volumeTrilha,
        ducking,
        fadeFinal,
      }

      if (trilhaUpload) {
        const trilhaBase64 = await blobParaBase64(trilhaUpload)

        respostaMixagem = await fetch(`${API_BASE}/api/mixar-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dadosMixagem,
            trilhaBase64,
          }),
        })
      } else {
        respostaMixagem = await fetch(`${API_BASE}/api/mixar-voz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dadosMixagem,
            trilhaSelecionada,
          }),
        })
      }

      if (!respostaMixagem.ok) {
        let mensagem = 'Erro ao realizar a mixagem.'

        try {
          const erro = await respostaMixagem.json()
          mensagem = erro.erro || mensagem
        } catch {
          const textoErro = await respostaMixagem.text()
          if (textoErro) mensagem = textoErro
        }

        throw new Error(mensagem)
      }

      const mixBlob = await respostaMixagem.blob()
      const mixUrl = URL.createObjectURL(mixBlob)

      if (audioUrl.startsWith('blob:') && audioUrl !== vozGeradaUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      setAudioUrl(mixUrl)

      setTimeout(() => {
        playerRef.current?.play().catch(() => {})
      }, 50)
    } catch (erro) {
      console.error('Erro na mixagem:', erro)
      alert(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível mixar a voz com a trilha.'
      )
    } finally {
      setMixando(false)
    }
  }

  const categorias = [
    {
      emoji: '📻',
      titulo: 'Spot de Rádio',
      descricao: 'Crie spots profissionais para sua programação',
    },
    {
      emoji: '🎉',
      titulo: 'Chamadas de Festa',
      descricao: 'Divulgue festas, eventos e shows',
    },
    {
      emoji: '🙏',
      titulo: 'Chamadas Religiosas',
      descricao: 'Produza chamadas para igrejas e eventos religiosos',
    },
    {
      emoji: '📢',
      titulo: 'Propaganda Comercial',
      descricao: 'Crie comerciais para empresas e lojas',
    },
  ]

  const trilhas = [
    {
      nome: 'Trilha para Mercado',
      caminho: '/trilhas/TRILHA PARA MERCADO.mp3',
    },
    {
      nome: 'Trilha para Mercado 2',
      caminho: '/trilhas/TRILHA PARA MERCADO (2).mp3',
    },
    {
      nome: 'Trilha para Mercado 3',
      caminho: '/trilhas/TRILHA PARA MERCADO (3).mp3',
    },
  ]

  if (categoriaSelecionada) {
    return (
      <div className="app">
        <header>
          <h1>FÁBRICA DA VOZ</h1>
          <p style={{ marginTop: '25px' }}>
            Seu estúdio de locução profissional
          </p>
        </header>

        <main className="main">
          <section className="hero">
            <span className="tag">ESTÚDIO DE LOCUÇÃO</span>
            <h2>{categoriaSelecionada}</h2>
            <p>
              Crie sua locução profissional com inteligência artificial.
            </p>
          </section>

          <section className="categorias">
            <div className="editor">
              <h3>Crie sua locução</h3>

              <div className="vozes">
                <label>Escolha a voz</label>

                <div className="opcoes-voz">
                  <div className="voz-card">
                    <button
                      type="button"
                      className={
                        vozSelecionada === 'masculina'
                          ? 'voz ativo'
                          : 'voz'
                      }
                      onClick={() => setVozSelecionada('masculina')}
                    >
                      <img src={noahLocutor} alt="Noah" />
                      <span>Noah</span>
                    </button>

                    <audio controls src="/noah-amostra.mp3" />
                  </div>

                  <div className="voz-card">
                    <button
                      type="button"
                      className={
                        vozSelecionada === 'feminina'
                          ? 'voz ativo'
                          : 'voz'
                      }
                      onClick={() => setVozSelecionada('feminina')}
                    >
                      <img src={ninaLocutora} alt="Nina" />
                      <span>Nina</span>
                    </button>

                    <audio controls src="/nina-amostra.mp3" />
                  </div>
                </div>
              </div>

              <div className="estilos">
                <label>Escolha o estilo da locução</label>

                <div className="opcoes-estilo">
                  {[
                    ['normal', '🎙️', 'Normal', 'Voz natural e profissional'],
                    ['animado', '🔥', 'Animado', 'Mais energia e entusiasmo'],
                    ['muitoAnimado', '🚀', 'Muito Animado', 'Mais ritmo e empolgação'],
                    ['superImpacto', '💥', 'Super Impacto', 'Forte, intenso e marcante'],
                  ].map(([id, emoji, titulo, descricao]) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        estiloSelecionado === id
                          ? 'estilo ativo'
                          : 'estilo'
                      }
                      onClick={() => setEstiloSelecionado(id as Style)}
                    >
                      <span>{emoji}</span>
                      <strong>{titulo}</strong>
                      <small>{descricao}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="opcoes-velocidade">
                <label>Velocidade</label>

                {[
                  ['normal', 'Normal'],
                  ['rapido', 'Rápido'],
                  ['superRapido', 'Super rápido'],
                ].map(([id, titulo]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      velocidade === id
                        ? 'velocidade ativa'
                        : 'velocidade'
                    }
                    onClick={() => setVelocidade(id)}
                  >
                    {titulo}
                  </button>
                ))}
              </div>

              <div style={{ height: '20px' }} />

              <label>Texto da locução</label>

              <textarea
                className="campo-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Digite aqui o texto que você quer transformar em voz..."
              />

              <div className="editor-tempo">
                <h3>⏱️ Editor de tempo</h3>

                <p>
                  Defina os segundos de trilha antes e depois da locução.
                </p>

                <div className="tempo-opcoes">
                  <div className="tempo-campo">
                    <label>⏮️ Início</label>

                    <div className="tempo-presets">
                      {[0, 5, 10, 15, 20].map((valor) => (
                        <button
                          key={valor}
                          type="button"
                          className={
                            segundosInicio === valor
                              ? 'velocidade ativa'
                              : 'velocidade'
                          }
                          onClick={() => setSegundosInicio(valor)}
                        >
                          {valor}s
                        </button>
                      ))}
                    </div>

                    <label>Personalizado</label>

                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={segundosInicio}
                      onChange={(e) =>
                        setSegundosInicio(
                          Math.min(
                            60,
                            Math.max(0, Number(e.target.value))
                          )
                        )
                      }
                    />
                  </div>

                  <div className="tempo-campo">
                    <label>⏭️ Final</label>

                    <div className="tempo-presets">
                      {[0, 5, 10, 15, 20].map((valor) => (
                        <button
                          key={valor}
                          type="button"
                          className={
                            segundosFinal === valor
                              ? 'velocidade ativa'
                              : 'velocidade'
                          }
                          onClick={() => setSegundosFinal(valor)}
                        >
                          {valor}s
                        </button>
                      ))}
                    </div>

                    <label>Personalizado</label>

                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={segundosFinal}
                      onChange={(e) =>
                        setSegundosFinal(
                          Math.min(
                            60,
                            Math.max(0, Number(e.target.value))
                          )
                        )
                      }
                    />
                  </div>
                </div>

                <div className="resumo-tempo">
                  🎵 Trilha: <strong>{segundosInicio}s</strong>
                  {' → '}
                  🎙️ Voz
                  {' → '}
                  <strong>{segundosFinal}s</strong> 🎵
                </div>
              </div>

              <div className="controles-mixagem">
                <h3>🎚️ Controle da mixagem</h3>

                <div className="controle">
                  <label>
                    🎙️ Volume da voz:{' '}
                    <strong>{Math.round(volumeVoz * 100)}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={volumeVoz}
                    onChange={(e) => setVolumeVoz(Number(e.target.value))}
                  />
                </div>

                <div className="controle">
                  <label>
                    🎵 Volume da trilha:{' '}
                    <strong>{Math.round(volumeTrilha * 100)}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volumeTrilha}
                    onChange={(e) =>
                      setVolumeTrilha(Number(e.target.value))
                    }
                  />
                </div>

                <div className="controle">
                  <label>
                    🔉 Trilha durante a voz:{' '}
                    <strong>{Math.round(ducking * 100)}%</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={ducking}
                    onChange={(e) => setDucking(Number(e.target.value))}
                  />
                  <small>
                    A trilha abaixa automaticamente enquanto o locutor fala.
                  </small>
                </div>

                <div className="controle">
                  <label>
                    🌅 Fade final: <strong>{fadeFinal}s</strong>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={fadeFinal}
                    onChange={(e) => setFadeFinal(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="acoes-geracao">
                <button
                  className="botao-gerar"
                  onClick={gerarVoz}
                  disabled={gerando}
                >
                  {gerando ? '⏳ Gerando...' : '🔊 Gerar voz'}
                </button>

                {vozGeradaUrl && (
                  <a
                    className="botao-download"
                    href={vozGeradaUrl}
                    download="fabrica-da-voz-voz.mp3"
                  >
                    ⬇️ Baixar voz
                  </a>
                )}

                {audioUrl && (
                  <a
                    className="botao-download"
                    href={audioUrl}
                    download="fabrica-da-voz.mp3"
                  >
                    ⬇️ Baixar MP3
                  </a>
                )}

                {vozGeradaUrl && (
                  <button
                    type="button"
                    className="botao-trilha"
                    onClick={() => setMostrarTrilhas(!mostrarTrilhas)}
                  >
                    🎵 Adicionar trilha
                  </button>
                )}

                {mostrarTrilhas && (
                  <div className="painel-trilhas">
                    <h3>🎵 Escolha uma trilha</h3>

                    {trilhas.map((trilha) => (
                      <div className="trilha-item" key={trilha.caminho}>
                        <strong>{trilha.nome}</strong>

                        <audio controls src={trilha.caminho} />

                        <button
                          type="button"
                          className={
                            trilhaSelecionada === trilha.caminho
                              ? 'botao-trilha ativo'
                              : 'botao-trilha'
                          }
                          onClick={() => {
                            setTrilhaSelecionada(trilha.caminho)
                            setTrilhaUpload(null)
                          }}
                        >
                          ✓ Usar esta trilha
                        </button>
                      </div>
                    ))}

                    <div className="trilha-item">
                      <strong>📁 Enviar minha própria trilha</strong>

                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg"
                        onChange={(e) => {
                          setTrilhaUpload(e.target.files?.[0] || null)
                          setTrilhaSelecionada('')
                        }}
                      />

                      {trilhaUpload && (
                        <small>{trilhaUpload.name}</small>
                      )}
                    </div>
                  </div>
                )}

                {(trilhaSelecionada || trilhaUpload) && (
                  <button
                    type="button"
                    className="botao-trilha"
                    onClick={mixar}
                    disabled={mixando}
                  >
                    {mixando
                      ? '⏳ Mixando...'
                      : '🎚️ Mixar voz + trilha'}
                  </button>
                )}

                {audioUrl && (
                  <>
                    <div className="titulo-previa">
                      🎧 Prévia da sua locução
                    </div>

                    <audio
                      ref={playerRef}
                      className="player-audio"
                      controls
                      src={audioUrl}
                    />
                  </>
                )}
              </div>
            </div>

            <button
              className="voltar"
              onClick={() => setCategoriaSelecionada(null)}
            >
              ← Voltar
            </button>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="logo">
          <img src={logoFabrica} alt="Fábrica da Voz" />
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <span className="tag">INTELIGÊNCIA ARTIFICIAL</span>

          <h2>
            Transforme suas ideias
            <br />
            em voz profissional.
          </h2>

          <p>
            Crie spots, chamadas e propagandas com vozes realistas para rádio,
            eventos e empresas.
          </p>
        </section>

        <section className="categorias">
          <h3>O que você quer produzir?</h3>

          <div className="grid">
            {categorias.map((categoria) => (
              <button
                className="card"
                key={categoria.titulo}
                onClick={() =>
                  setCategoriaSelecionada(categoria.titulo)
                }
              >
                <span className="cardEmoji">{categoria.emoji}</span>

                <div className="cardTexto">
                  <h4>{categoria.titulo}</h4>
                  <p>{categoria.descricao}</p>
                </div>

                <span className="seta">→</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <p>© 2026 Fábrica da Voz • Estúdio de Locução com IA</p>
      </footer>
    </div>
  )
}

export default App
