import { useRef, useState, type ChangeEvent } from 'react'
import logoFabrica from './assets/logo-fabrica.png'
import './App.css'

import noahLocutor from './assets/noah-locutor.png'
import ninaLocutora from './assets/nina-locutora-1.png'
import celsoLocutor from './assets/celso-locutor.png'
import pedroLocutor from './assets/pedro-locutor.png'
import luizaLocutora from './assets/luisa-locutor.png'
import gabyLocutora from './assets/gaby-locutor.png'

type Voz = {
  id: string
  nome: string
  foto: string
  demonstrativo: string
}

const vozes: Voz[] = [
  { id: 'IKne3meq5aSn9XLyUdCD', nome: 'Noah', foto: noahLocutor, demonstrativo: '/noah-amostra.mp3' },
  { id: '21m00Tcm4TlvDq8ikWAM', nome: 'Nina', foto: ninaLocutora, demonstrativo: '/nina-amostra.mp3' },
  { id: 'rpNe0HOx7heUulPiOEaG', nome: 'Celso', foto: celsoLocutor, demonstrativo: '/vozes/celso.mp3' },
  { id: 'zhza6dIY7yb1xz5MKTvQ', nome: 'Pedro', foto: pedroLocutor, demonstrativo: '/vozes/pedro.mp3' },
  { id: 'x8FWrDHAK5xiFTJLpnHq', nome: 'Luiza', foto: luizaLocutora, demonstrativo: '/vozes/luiza.mp3' },
  { id: 'iScHbNW8K33gNo3lGgbo', nome: 'Gaby', foto: gabyLocutora, demonstrativo: '/vozes/gaby.mp3' }
]

const categorias = [
  { emoji: '📻', titulo: 'Spot de Rádio', descricao: 'Crie spots profissionais para sua programação' },
  { emoji: '🎉', titulo: 'Chamadas de Festa', descricao: 'Divulgue festas, eventos e shows' },
  { emoji: '🙏', titulo: 'Chamadas Religiosas', descricao: 'Produza chamadas para igrejas e eventos religiosos' },
  { emoji: '📢', titulo: 'Propaganda Comercial', descricao: 'Crie comerciais para empresas e lojas' }
]

// IMPORTANTE: vazio = usa o mesmo domínio.
// Assim funciona no notebook e no celular em produção.
const API_URL = ''

function App() {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null)
  const [vozSelecionada, setVozSelecionada] = useState(vozes[0].id)
  const [estiloSelecionado, setEstiloSelecionado] = useState('normal')
  const [velocidade, setVelocidade] = useState('normal')
  const [texto, setTexto] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [gerando, setGerando] = useState(false)
  const [mixando, setMixando] = useState(false)
  const [mostrarTrilhas, setMostrarTrilhas] = useState(false)
  const [trilhaSelecionada, setTrilhaSelecionada] = useState('')
  const [trilhaArquivo, setTrilhaArquivo] = useState<File | null>(null)
  const [nomeTrilhaArquivo, setNomeTrilhaArquivo] = useState('')
  const [segundosInicio, setSegundosInicio] = useState(5)
  const [segundosFinal, setSegundosFinal] = useState(5)
  const textoRef = useRef<HTMLTextAreaElement | null>(null)

  const vozAtual = vozes.find(v => v.id === vozSelecionada) ?? vozes[0]

  const velocidadeSelecionada =
    velocidade === 'normal' ? 1 :
    velocidade === 'rapido' ? 1.25 :
    1.45

  const gerarVoz = async () => {
  const textoDigitado = texto.trim()

if (!textoDigitado) {
  alert('Digite um texto para gerar a voz.')
  textoRef.current?.focus()
  return
}

    // Garante que o React tenha exatamente o texto que será enviado.
    if (texto !== textoDigitado) {
      setTexto(textoDigitado)
    }

    let textoFinal = textoDigitado

    if (estiloSelecionado === 'animado') {
      textoFinal = `[excited] ${textoFinal}`
    }

    if (estiloSelecionado === 'muitoAnimado') {
      textoFinal = `[excited] [happily] ${textoFinal}`
    }

    if (estiloSelecionado === 'superImpacto') {
      textoFinal = `[excited] [shouts] ${textoFinal}`
    }

    setGerando(true)

    try {
      const resposta = await fetch(`${API_URL}/api/gerar-voz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: textoFinal,
          voiceId: vozAtual.id,
          speed: velocidadeSelecionada
        })
      })

      if (!resposta.ok) {
        let mensagem = 'Erro ao gerar a voz.'

        try {
          const erroTexto = await resposta.text()
          try {
            const erro = JSON.parse(erroTexto)
            mensagem = erro?.erro || erro?.error || erroTexto || mensagem
          } catch {
            if (erroTexto) mensagem = erroTexto
          }
        } catch {
          // O corpo já foi tratado; não tente lê-lo novamente.
        }

        throw new Error(mensagem)
      }

      const blob = await resposta.blob()

      if (!blob.size) {
        throw new Error('O servidor retornou um áudio vazio.')
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      const novaUrl = URL.createObjectURL(blob)
      setAudioUrl(novaUrl)
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

  const arquivoParaBase64 = async (arquivo: Blob) => {
    const buffer = await arquivo.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    let binario = ''
    const tamanho = 0x8000

    for (let i = 0; i < bytes.length; i += tamanho) {
      binario += String.fromCharCode(
        ...bytes.subarray(i, i + tamanho)
      )
    }

    return btoa(binario)
  }

  const selecionarTrilhaArquivo = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const arquivo = e.target.files?.[0]

    if (!arquivo) return

    if (
      arquivo.type &&
      !arquivo.type.startsWith('audio/')
    ) {
      alert(
        'Escolha um arquivo de áudio MP3, WAV, OGG, M4A ou AAC.'
      )

      e.target.value = ''
      return
    }

    setTrilhaArquivo(arquivo)
    setNomeTrilhaArquivo(arquivo.name)
    setTrilhaSelecionada('')
  }

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
      const vozResposta = await fetch(audioUrl)

      if (!vozResposta.ok) {
        throw new Error(
          'Não foi possível acessar o áudio da voz.'
        )
      }

      const audioBase64 = await arquivoParaBase64(
        await vozResposta.blob()
      )

      let endpoint = '/api/mixar-voz'

      let body: Record<string, unknown> = {
        audioBase64,
        trilhaSelecionada,
        segundosInicio,
        segundosFinal
      }

      if (trilhaArquivo) {
        endpoint = '/api/mixar-upload'

        body = {
          audioBase64,
          trilhaBase64:
            await arquivoParaBase64(trilhaArquivo),
          segundosInicio,
          segundosFinal
        }
      }

      const resposta = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      )

      if (!resposta.ok) {
        let mensagem = 'Erro ao realizar a mixagem.'

        try {
          const erroTexto = await resposta.text()
          try {
            const erro = JSON.parse(erroTexto)
            mensagem =
              erro?.erro ||
              erro?.error ||
              erroTexto ||
              mensagem
          } catch {
            if (erroTexto) {
              mensagem = erroTexto
            }
          }
        } catch {
          // O corpo já foi tratado; não tente lê-lo novamente.
        }

        throw new Error(mensagem)
      }

      const blob = await resposta.blob()

      if (!blob.size) {
        throw new Error(
          'A mixagem retornou um áudio vazio.'
        )
      }

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }

      setAudioUrl(
        URL.createObjectURL(blob)
      )

      setMostrarTrilhas(false)
    } catch (erro) {
      console.error(
        'Erro na mixagem:',
        erro
      )

      alert(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível mixar os áudios.'
      )
    } finally {
      setMixando(false)
    }
  }

  // =========================
  // TELA INICIAL
  // =========================

  if (!categoriaSelecionada) {
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
              Crie spots, chamadas e propagandas
              com vozes realistas para rádio,
              eventos e empresas.
            </p>
          </section>

          <section className="categorias">
            <h3>
              O que você quer produzir?
            </h3>

            <div className="grid">
              {categorias.map(categoria => (
                <button
                  type="button"
                  className="card"
                  key={categoria.titulo}
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
              ))}
            </div>
          </section>
        </main>

        <footer>
          <p>
            © 2026 Fábrica da Voz •
            Estúdio de Locução com IA
          </p>
        </footer>
      </div>
    )
  }

  // =========================
  // EDITOR
  // =========================

  return (
    <div className="app">
      <header>
        <h1>
          FÁBRICA DA VOZ
        </h1>

        <p
          style={{
            marginTop: '25px'
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
            Crie sua locução profissional
            com inteligência artificial.
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
                {vozes.map(voz => (
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
                        setVozSelecionada(
                          voz.id
                        )
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
                      src={
                        voz.demonstrativo
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ESTILOS */}

            <div className="estilos">
              <label>
                Escolha o estilo da locução
              </label>

              <div className="opcoes-estilo">
                {[
                  [
                    'normal',
                    '🎙️',
                    'Normal',
                    'Voz natural e profissional'
                  ],
                  [
                    'animado',
                    '🔥',
                    'Animado',
                    'Mais energia e entusiasmo'
                  ],
                  [
                    'muitoAnimado',
                    '🚀',
                    'Muito Animado',
                    'Mais ritmo e empolgação'
                  ],
                  [
                    'superImpacto',
                    '💥',
                    'Super Impacto',
                    'Forte, intenso e marcante'
                  ]
                ].map(
                  ([
                    id,
                    emoji,
                    titulo,
                    descricao
                  ]) => (
                    <button
                      key={id}
                      type="button"
                      className={
                        estiloSelecionado === id
                          ? 'estilo ativo'
                          : 'estilo'
                      }
                      onClick={() =>
                        setEstiloSelecionado(
                          id
                        )
                      }
                    >
                      <span>
                        {emoji}
                      </span>

                      <strong>
                        {titulo}
                      </strong>

                      <small>
                        {descricao}
                      </small>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* VELOCIDADE */}

            <div className="opcoes-velocidade">
              <label>
                Velocidade
              </label>

              {[
                ['normal', 'Normal'],
                ['rapido', 'Rápido'],
                [
                  'superRapido',
                  'Super rápido'
                ]
              ].map(
                ([id, titulo]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      velocidade === id
                        ? 'velocidade ativo'
                        : 'velocidade'
                    }
                    onClick={() =>
                      setVelocidade(id)
                    }
                  >
                    {titulo}
                  </button>
                )
              )}
            </div>

            <div
              style={{
                height: '20px'
              }}
            />

            {/* TEXTO */}

            <label>
              Texto da locução
            </label>

            <textarea
              ref={textoRef}
              className="campo-texto"
              value={texto}
              onChange={e =>
                setTexto(e.target.value)
              }
              placeholder="Digite aqui o texto que você quer transformar em voz..."
            />

            {/* GERAR */}

            <div className="acoes-geracao">
              <button
                type="button"
                className="botao-gerar"
                onClick={gerarVoz}
                disabled={gerando}
              >
                {gerando
                  ? '⏳ Gerando...'
                  : '🔊 Gerar voz'}
              </button>
            </div>

            {/* RESULTADO */}

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
                      setMostrarTrilhas(
                        v => !v
                      )
                    }
                  >
                    🎵{' '}
                    {mostrarTrilhas
                      ? 'Fechar trilhas'
                      : 'Adicionar trilha'}
                  </button>
                </div>

                {/* TRILHAS */}

                {mostrarTrilhas && (
                  <div className="painel-trilhas">
                    <h3>
                      🎵 Escolha uma trilha
                    </h3>

                    {/* TEMPO */}

                    <div className="editor-tempo">
                      <h3>
                        ⏱️ Ajuste da trilha
                      </h3>

                      <p>
                        Escolha quanto tempo
                        de trilha ficará antes
                        e depois da sua locução.
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
                            value={
                              segundosInicio
                            }
                            onChange={e =>
                              setSegundosInicio(
                                Math.min(
                                  60,
                                  Math.max(
                                    0,
                                    Number(
                                      e.target.value
                                    ) || 0
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
                            value={
                              segundosFinal
                            }
                            onChange={e =>
                              setSegundosFinal(
                                Math.min(
                                  60,
                                  Math.max(
                                    0,
                                    Number(
                                      e.target.value
                                    ) || 0
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
                        🎵 {segundosInicio}s
                        de trilha →
                        🎙️ Locução →
                        {segundosFinal}s
                        de trilha 🎵
                      </div>
                    </div>

                    {/* TRILHA DO CLIENTE */}

                    <div className="trilha-item">
                      <strong>
                        📤 Enviar minha própria trilha
                      </strong>

                      <p>
                        Escolha uma música ou trilha
                        de áudio do computador ou celular.
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

                    {/* TRILHAS DA FÁBRICA */}

                    {[
                      [
                        '/trilhas/TRILHA PARA MERCADO.mp3',
                        'Trilha para Mercado'
                      ],
                      [
                        '/trilhas/TRILHA PARA MERCADO (2).mp3',
                        'Trilha para Mercado 2'
                      ],
                      [
                        '/trilhas/TRILHA PARA MERCADO (3).mp3',
                        'Trilha para Mercado 3'
                      ]
                    ].map(
                      ([arquivo, nome]) => (
                        <div
                          className="trilha-item"
                          key={arquivo}
                        >
                          <strong>
                            {nome}
                          </strong>

                          <audio
                            controls
                            src={arquivo}
                          />

                          <button
                            type="button"
                            className={
                              trilhaSelecionada ===
                              arquivo
                                ? 'botao-trilha ativo'
                                : 'botao-trilha'
                            }
                            onClick={() => {
                              setTrilhaSelecionada(
                                arquivo
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
                      )
                    )}

                    {/* MIXAR */}

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
                          onClick={
                            mixarVozComTrilha
                          }
                          disabled={mixando}
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

            {/* VOLTAR */}

            <button
              type="button"
              className="voltar"
              onClick={() =>
                setCategoriaSelecionada(
                  null
                )
              }
            >
              ← Voltar
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
