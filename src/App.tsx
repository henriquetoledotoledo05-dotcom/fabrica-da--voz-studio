import logoFabrica from './assets/logo-fabrica.png'
import { useEffect, useState, type ChangeEvent } from 'react'
import './App.css'
import { supabase } from './supabase'

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
const rafaelLocutor = '/rafael-foto.png'
const viniciusLocutor = '/vinicius-foto.png'
const vitorLocutor = '/vitor-foto.png'

function App() {
    const [acessoLiberado, setAcessoLiberado] = useState(false)

  const [senhaAcesso, setSenhaAcesso] = useState('')
  const [erroAcesso, setErroAcesso] = useState('')
  const [emailAcesso, setEmailAcesso] = useState('')
  const [creditos, setCreditos] = useState<number | null>(null)
  const [carregandoCreditos, setCarregandoCreditos] = useState(false)
  const [mostrarCompraCreditos, setMostrarCompraCreditos] = useState(false)
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [nomeCadastro, setNomeCadastro] = useState('')
  const [emailCadastro, setEmailCadastro] = useState('')
  const [senhaCadastro, setSenhaCadastro] = useState('')
  const [confirmarSenhaCadastro, setConfirmarSenhaCadastro] = useState('')
  const [erroCadastro, setErroCadastro] = useState('')

  const carregarCreditos = async () => {
    setCarregandoCreditos(true)

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError || !userData.user) {
        setCreditos(null)
        return
      }

      const { data, error } = await supabase
        .from('perfis')
        .select('creditos')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (error) {
        console.error('Erro ao carregar créditos:', error)
        setCreditos(null)
        return
      }

      setCreditos(Number(data?.creditos ?? 0))
    } finally {
      setCarregandoCreditos(false)
    }
  }

  useEffect(() => {
    let ativo = true

    const iniciarSessao = async () => {
      const { data } = await supabase.auth.getSession()

      if (!ativo) return

      const liberado = Boolean(data.session)
      setAcessoLiberado(liberado)

      if (liberado) {
        sessionStorage.setItem('fabrica_acesso', 'liberado')
        await carregarCreditos()
      } else {
        sessionStorage.removeItem('fabrica_acesso')
        setCreditos(null)
      }
    }

    iniciarSessao()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const liberado = Boolean(session)

        setAcessoLiberado(liberado)

        if (liberado) {
          sessionStorage.setItem('fabrica_acesso', 'liberado')
          setTimeout(() => {
            void carregarCreditos()
          }, 0)
        } else {
          sessionStorage.removeItem('fabrica_acesso')
          setCreditos(null)
        }
      }
    )

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const entrarNaFabrica = async () => {
    const email = emailAcesso.trim()

    if (!email || !senhaAcesso) {
      setErroAcesso('Digite seu e-mail e sua senha.')
      return
    }

    setErroAcesso('Entrando...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senhaAcesso,
    })

    if (error) {
      console.error('Erro no login:', error)

      const mensagem =
        error.message?.toLowerCase().includes('email not confirmed')
          ? 'Confirme seu e-mail antes de entrar.'
          : 'E-mail ou senha incorretos.'

      setErroAcesso(mensagem)
      setSenhaAcesso('')
      return
    }

    if (data.session) {
      sessionStorage.setItem('fabrica_acesso', 'liberado')
      setAcessoLiberado(true)
      setErroAcesso('')
      setSenhaAcesso('')
      await carregarCreditos()
    }
  }

  const validarCadastro = async () => {
  const nome = nomeCadastro.trim()
  const email = emailCadastro.trim()

  if (!nome || !email || !senhaCadastro || !confirmarSenhaCadastro) {
    setErroCadastro('Preencha todos os campos.')
    return
  }

  if (!email.includes('@') || !email.includes('.')) {
    setErroCadastro('Digite um e-mail válido.')
    return
  }

  if (senhaCadastro.length < 6) {
    setErroCadastro('A senha precisa ter pelo menos 6 caracteres.')
    return
  }

  if (senhaCadastro !== confirmarSenhaCadastro) {
    setErroCadastro('As senhas não coincidem.')
    return
  }

  setErroCadastro('Criando sua conta...')

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senhaCadastro,
    options: {
      data: {
        nome,
      },
    },
  })

  if (error) {
    console.error('Erro no cadastro:', error)
    setErroCadastro(error.message)
    return
  }

  if (data.user) {
    if (data.session) {
      sessionStorage.setItem('fabrica_acesso', 'liberado')
      setAcessoLiberado(true)
      setMostrarCadastro(false)
      setErroCadastro('')
      setSenhaCadastro('')
      setConfirmarSenhaCadastro('')
      await carregarCreditos()
    } else {
      setErroCadastro(
        'Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.'
      )
    }
  }
}


  const [vozSelecionada, setVozSelecionada] =
    useState('rz25pon9uanPpUGOW98Y')

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

  const [estiloTrilhaSelecionado, setEstiloTrilhaSelecionado] =
    useState('comercial')

  const [trilhaArquivo, setTrilhaArquivo] =
    useState<File | null>(null)

  const [trilhaArquivoUrl, setTrilhaArquivoUrl] =
    useState('')

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

  const [inicioTrilha, setInicioTrilha] =
    useState(0)

  const [trilhaEmPrevia, setTrilhaEmPrevia] =
    useState('')

  const [tempoPreviaTrilha, setTempoPreviaTrilha] =
    useState(0)

  const [pontoTrilhaConfirmado, setPontoTrilhaConfirmado] =
    useState(false)

  if (!acessoLiberado) {
    if (mostrarCadastro) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box', background: 'radial-gradient(circle at top, #24103d 0%, #090909 55%)', color: '#fff' }}>
          <div style={{ width: '100%', maxWidth: '460px', padding: '34px', boxSizing: 'border-box', borderRadius: '24px', background: 'rgba(21,16,32,0.96)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)', textAlign: 'center' }}>
            <img src={logoFabrica} alt="Fábrica da Voz" style={{ width: '190px', maxWidth: '80%', marginBottom: '18px' }} />
            <h2 style={{ margin: '0 0 8px' }}>Criar sua conta</h2>
            <p style={{ opacity: 0.72, margin: '0 0 24px' }}>Cadastre seus dados para acessar a Fábrica da Voz.</p>
            <div style={{ display: 'grid', gap: '12px', textAlign: 'left' }}>
              <label style={{ fontWeight: 700 }}>Nome</label>
              <input type="text" value={nomeCadastro} onChange={(e) => { setNomeCadastro(e.target.value); setErroCadastro('') }} placeholder="Seu nome" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '11px', border: '1px solid rgba(139,92,246,0.45)', background: '#171020', color: '#fff', fontSize: '16px' }} />
              <label style={{ fontWeight: 700, marginTop: '4px' }}>E-mail</label>
              <input type="email" value={emailCadastro} onChange={(e) => { setEmailCadastro(e.target.value); setErroCadastro('') }} placeholder="seu@email.com" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '11px', border: '1px solid rgba(139,92,246,0.45)', background: '#171020', color: '#fff', fontSize: '16px' }} />
              <label style={{ fontWeight: 700, marginTop: '4px' }}>Senha</label>
              <input type="password" value={senhaCadastro} onChange={(e) => { setSenhaCadastro(e.target.value); setErroCadastro('') }} placeholder="Crie uma senha" style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '11px', border: '1px solid rgba(139,92,246,0.45)', background: '#171020', color: '#fff', fontSize: '16px' }} />
              <label style={{ fontWeight: 700, marginTop: '4px' }}>Confirmar senha</label>
              <input type="password" value={confirmarSenhaCadastro} onChange={(e) => { setConfirmarSenhaCadastro(e.target.value); setErroCadastro('') }} placeholder="Digite a senha novamente" onKeyDown={(e) => { if (e.key === 'Enter') validarCadastro() }} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '11px', border: '1px solid rgba(139,92,246,0.45)', background: '#171020', color: '#fff', fontSize: '16px' }} />
              <button type="button" onClick={validarCadastro} style={{ width: '100%', padding: '15px', marginTop: '6px', border: '1px solid #8b5cf6', borderRadius: '11px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #4c1d95)' }}>Criar minha conta</button>
            </div>
            {erroCadastro && <p style={{ color: '#c084fc', marginTop: '14px', fontWeight: 600 }}>{erroCadastro}</p>}
            <button type="button" onClick={() => { setMostrarCadastro(false); setErroCadastro('') }} style={{ marginTop: '20px', padding: '10px 16px', border: 'none', background: 'transparent', color: '#c084fc', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}>← Voltar para entrar</button>
          </div>
        </div>
      )
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box', background: 'radial-gradient(circle at top, #24103d 0%, #090909 55%)', color: '#fff' }}>
        <div style={{ width: '100%', maxWidth: '460px', padding: '34px', boxSizing: 'border-box', borderRadius: '24px', background: 'rgba(21,16,32,0.96)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)', textAlign: 'center' }}>
          <img src={logoFabrica} alt="Fábrica da Voz" style={{ width: '190px', maxWidth: '80%', marginBottom: '18px' }} />
          <h2 style={{ margin: '0 0 8px' }}>Entre na Fábrica da Voz</h2>
          <p style={{ opacity: 0.72, margin: '0 0 24px' }}>Crie sua conta ou entre para usar seu saldo de créditos.</p>
          <div style={{ display: 'grid', gap: '12px', textAlign: 'left' }}>
            <label style={{ fontWeight: 700 }}>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={emailAcesso}
              onChange={(e) => {
                setEmailAcesso(e.target.value)
                setErroAcesso('')
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                borderRadius: '11px',
                border: '1px solid rgba(139,92,246,0.45)',
                background: '#171020',
                color: '#fff',
                fontSize: '16px'
              }}
            />
            <label style={{ fontWeight: 700, marginTop: '4px' }}>Senha</label>
            <input type="password" placeholder="Digite sua senha" value={senhaAcesso} onChange={(e) => { setSenhaAcesso(e.target.value); setErroAcesso('') }} onKeyDown={(e) => { if (e.key === 'Enter') entrarNaFabrica() }} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: '11px', border: '1px solid rgba(139,92,246,0.45)', background: '#171020', color: '#fff', fontSize: '16px' }} />
            <button type="button" onClick={entrarNaFabrica} style={{ width: '100%', padding: '15px', marginTop: '6px', border: '1px solid #8b5cf6', borderRadius: '11px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #4c1d95)' }}>Entrar</button>
          </div>
          {erroAcesso && <p style={{ color: '#ff6b6b', marginTop: '14px', fontWeight: 600 }}>{erroAcesso}</p>}
          <div style={{ margin: '26px 0', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <p style={{ margin: '0 0 10px', fontWeight: 700 }}>Ainda não tem uma conta?</p>
          <button type="button" onClick={() => { setMostrarCadastro(true); setErroCadastro('') }} style={{ width: '100%', padding: '14px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '11px', cursor: 'pointer', fontWeight: 700, fontSize: '16px', color: '#fff', background: '#171020' }}>Criar minha conta</button>
          <p style={{ margin: '18px 0 0', fontSize: '13px', opacity: 0.55 }}>💳 Depois do cadastro, você poderá comprar créditos para gerar suas locuções.</p>
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

  const pacotesCreditos = [
    { creditos: 1, preco: 'R$ 4,90', destaque: false },
    { creditos: 10, preco: 'R$ 19,90', destaque: false },
    { creditos: 50, preco: 'R$ 69,90', destaque: true },
    { creditos: 100, preco: 'R$ 119,90', destaque: false },
  ]

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
      nome: 'Rafael',
      foto: rafaelLocutor,
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
    ['Noah', 'Celso', 'Pedro', 'Henrique', 'Rafael', 'Vinícius', 'Vitor'].includes(voz.nome)
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
const iniciarPagamento = async (pacote: {
  creditos: number
  preco: string
  destaque?: boolean
}) => {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError || !sessionData.session) {
      alert('Faça login para comprar créditos.')
      return
    }

    const mapaPacotes: Record<number, string> = {
      1: 'credito1',
      10: 'credito10',
      50: 'credito50',
      100: 'credito100',
    }

    const pacoteId = mapaPacotes[pacote.creditos]

    if (!pacoteId) {
      alert('Pacote de créditos inválido.')
      return
    }

    const resposta = await fetch('/api/criar-pagamento', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        pacote: pacoteId,
      }),
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      throw new Error(
        dados.erro || 'Não foi possível iniciar o pagamento.'
      )
    }

    if (!dados.init_point) {
      throw new Error('O Mercado Pago não retornou o link de pagamento.')
    }

    window.location.href = dados.init_point
  } catch (erro) {
    console.error('Erro ao iniciar pagamento:', erro)

    alert(
      erro instanceof Error
        ? erro.message
        : 'Não foi possível iniciar o pagamento.'
    )
  }
}  
const gerarVoz = async () => {
    const textoDigitado = texto.trim()

    if (!textoDigitado) {
      alert('Digite um texto para gerar a voz.')
      return
    }

    if (textoDigitado.length > 800) {
      alert('Cada locução pode ter no máximo 800 caracteres.')
      return
    }

    if (carregandoCreditos) {
      alert('Aguarde o carregamento do seu saldo de créditos.')
      return
    }

    if (creditos === null) {
      await carregarCreditos()
      alert('Não foi possível confirmar seu saldo. Tente novamente.')
      return
    }

    if (creditos <= 0) {
      alert('Você não tem créditos suficientes. Compre créditos para gerar uma nova locução.')
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

      const audioBlob = await resposta.blob()

      if (!audioBlob.size) {
        throw new Error('O servidor retornou um áudio vazio.')
      }

      const urlAudio = URL.createObjectURL(audioBlob)

      setAudioUrl(urlAudio)
      setAudioOriginalUrl(urlAudio)
      setMixAudioUrl('')

      // Desconta 1 crédito somente depois que a geração deu certo.
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        throw new Error('A locução foi gerada, mas não foi possível identificar sua conta para atualizar os créditos.')
      }

      const novoSaldo = Math.max(0, creditos - 1)

      const { data: perfilAtualizado, error: erroCredito } =
        await supabase
          .from('perfis')
          .update({ creditos: novoSaldo })
          .eq('id', userData.user.id)
          .select('creditos')
          .maybeSingle()

      if (erroCredito) {
        console.error('Erro ao descontar crédito:', erroCredito)
        await carregarCreditos()
        throw new Error('A locução foi gerada, mas não foi possível atualizar seu saldo de créditos. Não gere novamente até conferir o saldo.')
      }

      if (!perfilAtualizado) {
        await carregarCreditos()
        throw new Error('A locução foi gerada, mas não foi possível confirmar o desconto do crédito.')
      }

      setCreditos(Number(perfilAtualizado.creditos))
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
  // TRILHAS POR ESTILO
  // =====================================================

  const trilhasPorEstilo = {
    comercial: [
      { nome: 'Comercial 01', arquivo: '/trilhas/comercial/01-comercial.mp3' },
      { nome: 'Comercial 02', arquivo: '/trilhas/comercial/02-comercial.mp3' },
      { nome: 'Comercial 03', arquivo: '/trilhas/comercial/03-comercial.mp3' },
    ],
    forro: [
      { nome: 'Forró 01', arquivo: '/trilhas/forro/01- Forró.mp3' },
      { nome: 'Forró 02', arquivo: '/trilhas/forro/02- Forró.mp3' },
      { nome: 'Forró 03', arquivo: '/trilhas/forro/03- Forró.mp3' },
    ],
    institucional: [
      { nome: 'Institucional 01', arquivo: '/trilhas/institucional/01-Trilha institucional.mp3' },
      { nome: 'Institucional 02', arquivo: '/trilhas/institucional/02-Trilha institucional.mp3' },
      { nome: 'Institucional 03', arquivo: '/trilhas/institucional/03-Trilha institucional.mp3' },
    ],
    impacto: [
      { nome: 'Impacto 01', arquivo: '/trilhas/impacto/01- Impacto.mp3' },
      { nome: 'Impacto 02', arquivo: '/trilhas/impacto/02- Impacto.mp3' },
      { nome: 'Impacto 03', arquivo: '/trilhas/impacto/03- Impacto.mp3' },
    ],
    gospel: [
      { nome: 'Gospel 01', arquivo: '/trilhas/gospel/01- Gospel.mp3' },
      { nome: 'Gospel 02', arquivo: '/trilhas/gospel/02- Gospel.mp3' },
      { nome: 'Gospel 03', arquivo: '/trilhas/gospel/03- Gospel.mp3' },
    ],
    jornalistica: [
      { nome: 'Jornalística 01', arquivo: '/trilhas/jornalistica/01-Trilha jornaslística.mp3' },
      { nome: 'Jornalística 02', arquivo: '/trilhas/jornalistica/02-Trilha jornalística.mp3' },
      { nome: 'Jornalística 03', arquivo: '/trilhas/jornalistica/03-Trilha jornalística.mp3' },
    ],
    gaucha: [
      { nome: 'Gaúcha 01', arquivo: '/trilhas/gaucha/01- Gaúcha.mp3' },
      { nome: 'Gaúcha 02', arquivo: '/trilhas/gaucha/02- Gaúcha.mp3' },
      { nome: 'Gaúcha 03', arquivo: '/trilhas/gaucha/03- Gaúcha.mp3' },
    ],
    natal: [
      { nome: 'Natal 01', arquivo: '/trilhas/natal/01-natal.mp3' },
      { nome: 'Natal 02', arquivo: '/trilhas/natal/02-Natal.mp3' },
      { nome: 'Natal 03', arquivo: '/trilhas/natal/03- Natal.mp3' },
    ],
    sertanejo: [
      { nome: 'Sertanejo 01', arquivo: '/trilhas/sertanejo/01- Sertanejo.mp3' },
      { nome: 'Sertanejo 02', arquivo: '/trilhas/sertanejo/02- Sertanejo.mp3' },
      { nome: 'Sertanejo 03', arquivo: '/trilhas/sertanejo/03- Sertanejo.mp3' },
    ],
    eletronica: [
      { nome: 'Eletrônica 01', arquivo: '/trilhas/eletronica/01- Eletrônica.mp3' },
      { nome: 'Eletrônica 02', arquivo: '/trilhas/eletronica/02- Eletrônica.mp3' },
      { nome: 'Eletrônica 03', arquivo: '/trilhas/eletronica/03- Eletrônica.mp3' },
    ],
  }

  const estilosDeTrilha = [
    { valor: 'comercial', nome: '🎙️ Comercial' },
    { valor: 'forro', nome: '💃 Forró' },
    { valor: 'institucional', nome: '🏢 Institucional' },
    { valor: 'impacto', nome: '⚡ Impacto' },
    { valor: 'gospel', nome: '✝️ Gospel' },
    { valor: 'jornalistica', nome: '📰 Jornalística' },
    { valor: 'gaucha', nome: '🤠 Gaúcha' },
    { valor: 'natal', nome: '🎄 Natal' },
    { valor: 'sertanejo', nome: '🤠 Sertanejo' },
    { valor: 'eletronica', nome: '🎧 Eletrônica' },
  ]

  const trilhasAtuais =
    trilhasPorEstilo[
      estiloTrilhaSelecionado as keyof typeof trilhasPorEstilo
    ]

  // =====================================================
  // SELECIONAR TRILHA DO COMPUTADOR
  // =====================================================

  const selecionarTrilhaArquivo = (
    e: ChangeEvent<HTMLInputElement>
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
    setTrilhaArquivoUrl(
      URL.createObjectURL(arquivo)
    )
    setMixAudioUrl('')

    setNomeTrilhaArquivo(
      arquivo.name
    )

    setTrilhaSelecionada('')
    setInicioTrilha(0)
    setPontoTrilhaConfirmado(false)
    setTrilhaEmPrevia('')
    setTempoPreviaTrilha(0)
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

        const pontoInicioTrilha =
          trilha.duration > 0
            ? Math.min(
                Math.max(0, Number(inicioTrilha) || 0),
                Math.max(0, trilha.duration - 0.01)
              )
            : 0

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
        // TRILHA / DUCKING AUTOMÁTICO
        // =================================================
        // A trilha começa no volume escolhido,
        // abaixa suavemente quando a voz entra,
        // permanece baixa durante a locução
        // e sobe novamente quando a voz termina.

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

        // 30% do volume escolhido durante a voz.
        const volumeDuranteVoz =
          volumeNormal * 0.30

        // Tempo da transição do ducking.
        const duracaoEntradaVoz =
          Math.min(
            0.8,
            Math.max(
              0.25,
              duracaoVoz / 10
            )
          )

        const duracaoSaidaVoz =
          Math.min(
            0.8,
            Math.max(
              0.25,
              duracaoVoz / 10
            )
          )

        const fimDaVoz =
          inicio +
          duracaoVoz

        // Volume normal desde o começo.
        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          0
        )

        if (inicio > 0) {
          // Trilha começa alta e abaixa suavemente
          // exatamente na entrada da locução.
          const inicioDucking =
            Math.max(
              0,
              inicio -
                duracaoEntradaVoz
            )

          trilhaGain.gain.setValueAtTime(
            volumeNormal,
            inicioDucking
          )

          trilhaGain.gain.linearRampToValueAtTime(
            volumeDuranteVoz,
            inicio
          )
        } else {
          // Se a locução começar imediatamente,
          // a trilha começa no volume normal e
          // abaixa suavemente logo no início.
          trilhaGain.gain.setValueAtTime(
            volumeNormal,
            0
          )

          const fimEntradaDucking =
            Math.min(
              duracaoTotal,
              duracaoEntradaVoz
            )

          if (fimEntradaDucking > 0) {
            trilhaGain.gain.linearRampToValueAtTime(
              volumeDuranteVoz,
              fimEntradaDucking
            )
          }
        }

        // Mantém a trilha baixa durante toda a locução.
        trilhaGain.gain.setValueAtTime(
          volumeDuranteVoz,
          fimDaVoz
        )

        // Depois que o locutor termina,
        // a trilha sobe suavemente novamente.
        const fimSubidaTrilha =
          Math.min(
            duracaoTotal,
            fimDaVoz +
              duracaoSaidaVoz
          )

        if (
          fimSubidaTrilha >
          fimDaVoz
        ) {
          trilhaGain.gain.linearRampToValueAtTime(
            volumeNormal,
            fimSubidaTrilha
          )
        } else {
          trilhaGain.gain.setValueAtTime(
            volumeNormal,
            fimDaVoz
          )
        }

        // =================================================
        // FADE FINAL
        // =================================================

        if (final > 0) {
          const fadeOutInicio =
            duracaoTotal -
            final

          // Garante que o fade final comece
          // sempre no volume normal da trilha.
          trilhaGain.gain.setValueAtTime(
            volumeNormal,
            Math.max(
              0,
              fadeOutInicio
            )
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
        let primeiraParteTrilha = true

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

          const offsetFonte =
            primeiraParteTrilha
              ? pontoInicioTrilha
              : 0

          const duracaoDisponivel =
            trilha.duration -
            offsetFonte

          const duracaoFonte =
            Math.min(
              duracaoDisponivel,
              restante
            )

          if (duracaoFonte <= 0) {
            break
          }

          trilhaSource.start(
            trilhaAtual,
            offsetFonte,
            duracaoFonte
          )

          trilhaAtual +=
            duracaoFonte

          primeiraParteTrilha = false
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

        const respostaMix =
          await fetch(
            '/api/converter-mp3',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'audio/wav',
              },
              body: wavBlob,
            }
          )

        if (!respostaMix.ok) {
          throw new Error(
            'Não foi possível converter a mixagem para MP3.'
          )
        }

        const mp3Blob =
          await respostaMix.blob()

        const mixUrl =
          URL.createObjectURL(
            mp3Blob
          )

        setMixAudioUrl(
          mixUrl
        )

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

        {mostrarCompraCreditos && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0,0,0,0.78)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              boxSizing: 'border-box',
              overflowY: 'auto'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '850px',
                padding: '28px',
                borderRadius: '22px',
                background: '#151020',
                border: '1px solid rgba(139,92,246,0.45)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
                color: '#fff',
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '15px',
                  marginBottom: '8px'
                }}
              >
                <h2 style={{ margin: 0 }}>💳 Comprar créditos</h2>
                <button
                  type="button"
                  onClick={() => setMostrarCompraCreditos(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#c084fc',
                    fontSize: '26px',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <p style={{ margin: '0 0 20px', opacity: 0.72 }}>
                1 crédito = 1 locução de até 800 caracteres.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '14px'
                }}
              >
                {pacotesCreditos.map((pacote) => (
                  <div
                    key={pacote.creditos}
                    style={{
                      position: 'relative',
                      padding: '22px 16px',
                      borderRadius: '16px',
                      background: pacote.destaque
                        ? 'linear-gradient(145deg, rgba(124,58,237,0.32), rgba(76,29,149,0.28))'
                        : 'rgba(255,255,255,0.04)',
                      border: pacote.destaque
                        ? '1px solid #8b5cf6'
                        : '1px solid rgba(255,255,255,0.10)',
                      textAlign: 'center'
                    }}
                  >
                    {pacote.destaque && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: '#8b5cf6',
                          fontSize: '11px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        MAIS ESCOLHIDO
                      </div>
                    )}

                    <div style={{ fontSize: '30px', fontWeight: 800 }}>
                      {pacote.creditos}
                    </div>
                    <div style={{ opacity: 0.72, marginBottom: '10px' }}>
                      {pacote.creditos === 1 ? 'crédito' : 'créditos'}
                    </div>
                    <div style={{ fontSize: '21px', fontWeight: 800, color: '#c084fc', marginBottom: '16px' }}>
                      {pacote.preco}
                    </div>
                    <button
                      type="button"
                      onClick={() => iniciarPagamento(pacote)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid #8b5cf6',
                        background: pacote.destaque
                          ? 'linear-gradient(135deg, #7c3aed, #4c1d95)'
                          : '#171020',
                        color: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Comprar
                    </button>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: '20px',
                  padding: '13px 15px',
                  borderRadius: '11px',
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.20)',
                  color: '#c084fc',
                  textAlign: 'center',
                  fontSize: '13px'
                }}
              >
                🔒 O pagamento será integrado depois. Esta tela já está pronta com os pacotes de créditos.
              </div>
            </div>
          </div>
        )}

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

              <div
                style={{
                  margin: '8px 0 18px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.10)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  color: '#c084fc',
                  fontWeight: 700,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <span>💳 Créditos disponíveis: {creditos === null ? '...' : creditos}</span>
                <button
                  type="button"
                  onClick={() => setMostrarCompraCreditos(true)}
                  style={{
                    padding: '8px 13px',
                    borderRadius: '9px',
                    border: '1px solid #8b5cf6',
                    background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Comprar créditos
                </button>
              </div>

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
  onChange={(e) => setTexto(e.target.value.slice(0, 800))}
  maxLength={800}
  placeholder="Digite aqui o texto que você quer transformar..."
/>

<div className="contador-caracteres">
  {texto.length}/800 caracteres
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
                          <>
                            <audio
                              controls
                              style={{
                                width: '100%',
                                marginTop: '10px'
                              }}
                              src={trilhaArquivoUrl}
                              onTimeUpdate={(e) => {
                                setTrilhaEmPrevia('__arquivo__')
                                setTempoPreviaTrilha(e.currentTarget.currentTime)
                              }}
                            />

                            <button
                              type="button"
                              className="botao-trilha"
                              style={{
                                marginTop: '10px',
                                width: '100%'
                              }}
                              onClick={() => {
                                setInicioTrilha(tempoPreviaTrilha)
                                setTrilhaSelecionada('')
                                setPontoTrilhaConfirmado(true)
                                setMixAudioUrl('')
                              }}
                            >
                              {pontoTrilhaConfirmado && trilhaEmPrevia === '__arquivo__'
                                ? `✓ Ponto selecionado (${Math.floor(inicioTrilha / 60).toString().padStart(2, '0')}:${Math.floor(inicioTrilha % 60).toString().padStart(2, '0')})`
                                : `📍 Usar este ponto (${Math.floor(tempoPreviaTrilha / 60).toString().padStart(2, '0')}:${Math.floor(tempoPreviaTrilha % 60).toString().padStart(2, '0')})`}
                            </button>
                          </>
                        )}

                      </div>

                      {/* =================================================
                          TRILHAS POR ESTILO
                      ================================================= */}

                      <div className="estilos" style={{ marginTop: '20px' }}>
                        <label>
                          🎵 Estilo da trilha
                        </label>

                        <select
                          className="seletor-estilo"
                          value={estiloTrilhaSelecionado}
                          onChange={(e) => {
                            setEstiloTrilhaSelecionado(e.target.value)
                            setTrilhaSelecionada('')
                            setTrilhaArquivo(null)
                             setTrilhaArquivoUrl('')
                            setNomeTrilhaArquivo('')
                            setMixAudioUrl('')
                            setInicioTrilha(0)
                            setTrilhaEmPrevia('')
                            setTempoPreviaTrilha(0)
                          }}
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
                          {estilosDeTrilha.map((estilo) => (
                            <option key={estilo.valor} value={estilo.valor}>
                              {estilo.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gap: '14px',
                          marginTop: '18px'
                        }}
                      >
                        {trilhasAtuais.map((trilha) => (
                          <div className="trilha-item" key={trilha.arquivo}>
                            <strong>{trilha.nome}</strong>

                            <audio
                              controls
                              preload="none"
                              style={{
                                width: '100%',
                                marginTop: '10px'
                              }}
                              src={trilha.arquivo}
                              onTimeUpdate={(e) => {
                                setTrilhaEmPrevia(trilha.arquivo)
                                setTempoPreviaTrilha(e.currentTarget.currentTime)
                              }}
                            />

                            <button
                              type="button"
                              className="botao-trilha"
                              style={{
                                marginTop: '10px',
                                width: '100%'
                              }}
                              onClick={() => {
                                setTrilhaSelecionada(trilha.arquivo)
                             setTrilhaArquivoUrl('')
                                setTrilhaArquivo(null)
                                setNomeTrilhaArquivo('')
                                setInicioTrilha(
                                  trilhaEmPrevia === trilha.arquivo
                                    ? tempoPreviaTrilha
                                    : 0
                                )
                                setPontoTrilhaConfirmado(true)
                                setMixAudioUrl('')
                              }}
                            >
                              {pontoTrilhaConfirmado && trilhaSelecionada === trilha.arquivo
                                ? `✓ Ponto selecionado (${Math.floor(inicioTrilha / 60).toString().padStart(2, '0')}:${Math.floor(inicioTrilha % 60).toString().padStart(2, '0')})`
                                : `📍 Usar este ponto (${Math.floor(tempoPreviaTrilha / 60).toString().padStart(2, '0')}:${Math.floor(tempoPreviaTrilha % 60).toString().padStart(2, '0')})`}
                            </button>

                            <button
                              type="button"
                              className={
                                trilhaSelecionada === trilha.arquivo
                                  ? 'botao-trilha ativo'
                                  : 'botao-trilha'
                              }
                              onClick={() => {
                                setTrilhaSelecionada(trilha.arquivo)
                             setTrilhaArquivoUrl('')
                                setMixAudioUrl('')
                                setTrilhaArquivo(null)
                                setNomeTrilhaArquivo('')
                                 setInicioTrilha(0)
                                 setPontoTrilhaConfirmado(false)
                              }}
                            >
                              {trilhaSelecionada === trilha.arquivo
                                ? '✓ Trilha selecionada'
                                : `✓ Usar ${trilha.nome}`}
                            </button>
                          </div>
                        ))}
                      </div>

                       {trilhaSelecionada || trilhaArquivo ? (
                         <div
                           style={{
                             marginTop: '18px',
                             padding: '16px',
                             borderRadius: '12px',
                             background: 'rgba(139, 92, 246, 0.10)',
                             border: '1px solid rgba(139, 92, 246, 0.35)',
                             textAlign: 'center'
                           }}
                         >
                            {pontoTrilhaConfirmado
                              ? <>✓ <strong>Ponto de início selecionado:</strong>{' '}
                                  {Math.floor(inicioTrilha / 60).toString().padStart(2, '0')}
                                  :
                                  {Math.floor(inicioTrilha % 60).toString().padStart(2, '0')}
                                </>
                              : <>📍 <strong>Início da trilha:</strong> 00:00</>}
                            <div
                              style={{
                                marginTop: '6px',
                                fontSize: '13px',
                                opacity: 0.75
                              }}
                            >
                              {pontoTrilhaConfirmado
                                ? '✓ Ponto confirmado. Agora é só mixar a voz com a trilha.'
                                : 'Ouça a trilha, posicione no trecho desejado e clique em “Usar este ponto”.'}
                           </div>
                         </div>
                       ) : null}

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


