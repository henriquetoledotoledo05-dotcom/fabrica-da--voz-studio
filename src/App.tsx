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
import lourencoLocutor from './assets/lourenco-locutor.png'
import gustavoLocutor from './assets/gustavo-locutor.png'

type Voz = {
  id: string
  nome: string
  foto: string
  demonstrativo: string
}

type HistoricoVinheta = {
  id: string
  user_id: string
  texto: string
  nome_voz: string | null
  estilo: string | null
  arquivo_path: string
  tipo: string
  criado_em: string
  expira_em: string
  url?: string
}

const henriqueLocutor = '/henrique-foto.png'
const rafaelLocutor = '/rafael-foto.png'
const viniciusLocutor = '/vinicius-foto.png'
const vitorLocutor = '/vitor-foto.png'
const flavinhaLocutora = '/flavinha-foto.png'
const aninhaLocutora = '/aninha-foto.png'
const paulinhoLocutor = '/paulinho-foto.png'



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

  const carregarCreditos = async (tentativa = 0) => {
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

      if (error || !data) {
        console.error('Erro ao carregar créditos:', error)

        if (tentativa < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          await carregarCreditos(tentativa + 1)
          return
        }

        setCreditos(null)
        return
      }

      setCreditos(Number(data.creditos ?? 0))
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
        await carregarHistorico()
      } else {
        sessionStorage.removeItem('fabrica_acesso')
        setCreditos(null)
        setHistorico([])
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
            void carregarHistorico()
          }, 0)
        } else {
          sessionStorage.removeItem('fabrica_acesso')
          setCreditos(null)
          setHistorico([])
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
        '✅ Cadastro realizado! Enviamos um link de confirmação para o seu e-mail. Abra seu e-mail e clique no link para confirmar sua conta. Depois, volte aqui e faça login.'
      )
    }
  }
}


  const [vozSelecionada, setVozSelecionada] =
    useState('rz25pon9uanPpUGOW98Y')

  const [estiloSelecionado, setEstiloSelecionado] = useState('normal')

  const [instrucaoPersonalizada, setInstrucaoPersonalizada] = useState('')

  const [reverbAtivo, setReverbAtivo] = useState(false)

  const [efeitoSelecionado, setEfeitoSelecionado] = useState('')
  const [volumeEfeito, setVolumeEfeito] = useState(70)
  const [posicaoEfeito, setPosicaoEfeito] = useState(0)
  const [efeito2Selecionado, setEfeito2Selecionado] = useState('')
  const [volumeEfeito2, setVolumeEfeito2] = useState(70)
  const [posicaoEfeito2, setPosicaoEfeito2] = useState(3)
  const [mostrarSegundoEfeito, setMostrarSegundoEfeito] = useState(false)
    
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

  const [mostrarHistorico, setMostrarHistorico] =
    useState(false)

  const [historico, setHistorico] = useState<HistoricoVinheta[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

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
    useState(70)

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


  // =====================================================
  // HISTÓRICO DE VINHETAS — 3 DIAS
  // =====================================================

  const carregarHistorico = async () => {
    setCarregandoHistorico(true)

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      const usuario = sessionData.session?.user

      if (sessionError || !usuario) {
        setHistorico([])
        return
      }

      const agora = new Date().toISOString()

      const { data: expirados, error: erroExpirados } = await supabase
        .from('historico_vinhetas')
        .select('id, arquivo_path')
        .eq('user_id', usuario.id)
        .lte('expira_em', agora)

      if (!erroExpirados && expirados?.length) {
        const caminhos = expirados
          .map((item) => item.arquivo_path)
          .filter(Boolean)

        if (caminhos.length) {
          await supabase.storage
            .from('historico-vinhetas')
            .remove(caminhos)
        }

        await supabase
          .from('historico_vinhetas')
          .delete()
          .eq('user_id', usuario.id)
          .lte('expira_em', agora)
      }

      const { data, error } = await supabase
        .from('historico_vinhetas')
        .select('*')
        .eq('user_id', usuario.id)
        .gt('expira_em', agora)
        .order('criado_em', { ascending: false })

      if (error) {
        console.error('Erro ao carregar histórico:', error)
        setHistorico([])
        return
      }

      const itens = await Promise.all(
        (data || []).map(async (item) => {
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from('historico-vinhetas')
              .createSignedUrl(item.arquivo_path, 60 * 60)

          return {
            ...item,
            url: signedError ? undefined : signedData?.signedUrl
          } as HistoricoVinheta
        })
      )

      setHistorico(itens)
    } catch (erro) {
      console.error('Erro ao carregar histórico:', erro)
      setHistorico([])
    } finally {
      setCarregandoHistorico(false)
    }
  }

  const salvarNoHistorico = async (
    blob: Blob,
    tipo: string
  ) => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      const usuario = sessionData.session?.user

      if (sessionError || !usuario) {
        console.error('Não foi possível identificar o usuário para salvar o histórico.')
        return
      }

      const id = crypto.randomUUID()
      const caminho = `${usuario.id}/${id}.mp3`

      const { error: uploadError } = await supabase.storage
        .from('historico-vinhetas')
        .upload(caminho, blob, {
          contentType: 'audio/mpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Erro ao salvar áudio no Storage:', uploadError)
        return
      }

      const { error: insertError } = await supabase
        .from('historico_vinhetas')
        .insert({
          id,
          user_id: usuario.id,
          texto: texto.trim() || 'Áudio gerado',
          nome_voz: vozAtual.nome,
          estilo: estiloSelecionado,
          arquivo_path: caminho,
          tipo,
          criado_em: new Date().toISOString(),
          expira_em: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000
          ).toISOString()
        })

      if (insertError) {
        console.error('Erro ao registrar histórico:', insertError)
        await supabase.storage
          .from('historico-vinhetas')
          .remove([caminho])
        return
      }

      await carregarHistorico()
    } catch (erro) {
      console.error('Erro ao salvar histórico:', erro)
    }
  }

  const excluirDoHistorico = async (item: HistoricoVinheta) => {
    const { error: storageError } = await supabase.storage
      .from('historico-vinhetas')
      .remove([item.arquivo_path])

    if (storageError) {
      console.error('Erro ao excluir áudio:', storageError)
      return
    }

    const { error } = await supabase
      .from('historico_vinhetas')
      .delete()
      .eq('id', item.id)

    if (error) {
      console.error('Erro ao excluir registro:', error)
      return
    }

    setHistorico((atual) =>
      atual.filter((itemAtual) => itemAtual.id !== item.id)
    )
  }

  const sairDaFabrica = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('fabrica_acesso')
    setAcessoLiberado(false)
    setCreditos(null)
    setHistorico([])
    setMostrarHistorico(false)
    setEmailAcesso('')
    setSenhaAcesso('')
    setErroAcesso('')
  }

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
          <a
            href="https://wa.me/5512991581880"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              boxSizing: 'border-box',
              padding: '13px 18px',
              marginTop: '18px',
              borderRadius: '11px',
              background: '#25D366',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            💬 Falar no WhatsApp
          </a>

          <div
            style={{
              marginTop: '9px',
              fontSize: '13px',
              opacity: 0.7,
              textAlign: 'center',
            }}
          >
            (12) 99158-1880
          </div>

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
      id: 'DQRaZFBAlsnenMlFVe0R',
      nome: 'Lourenço',
      foto: lourencoLocutor,
      demonstrativo: '/vozes/lourenco.mp3'
    },

    {
      id: 'g2E836wHBXhsWq15NkoD',
      nome: 'Gustavo',
      foto: gustavoLocutor,
      demonstrativo: '/vozes/gustavo.mp3'
    },

    {
      id: 'hble8femyJQR9HY7qel0',
      nome: 'Flavinha',
      foto: flavinhaLocutora,
      demonstrativo: '/vozes infantis/flavinha.mp3'
    },

    {
      id: '3T1fxRR4KTmnl9K43DtE',
      nome: 'Aninha',
      foto: aninhaLocutora,
      demonstrativo: '/vozes infantis/aninha.mp3'
    },

    {
      id: 'aBkeeo9J75PinaG66dNQ',
      nome: 'Paulinho',
      foto: paulinhoLocutor,
      demonstrativo: '/vozes infantis/paulinho.mp3'
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
  ,
    {
      id: 'u1vCfFgLgJ3YbJEqXmbf',
      nome: 'Angelo',
      foto: '/angelo-foto.png',
      demonstrativo: '/vozes/angelo-voz.mp3'
    },

    {
      id: 'exVv2CbwvTu1WNVuSWXs',
      nome: 'Bruno',
      foto: '/bruno-foto.png',
      demonstrativo: '/vozes/bruno-voz.mp3'
    },

    {
      id: 'gyiJ08WU9Wi2LNY7nTcB',
      nome: 'Letícia',
      foto: '/leticia-foto.png',
      demonstrativo: '/vozes/leticia-voz.mp3'
    },

    {
      id: 'qPAKBzRQkQs6EIhLSbMi',
      nome: 'Ricardo',
      foto: '/ricardo-foto.png',
      demonstrativo: '/vozes/ricardo-voz.wav'
    }
  ]

  const vozesMasculinas = vozes.filter(
  (voz) =>
    ['Noah', 'Celso', 'Pedro', 'Henrique', 'Rafael', 'Vinícius', 'Vitor', 'Lourenço', 'Gustavo', 'Angelo', 'Bruno', 'Ricardo'].includes(voz.nome)
)

const vozesFemininas = vozes.filter(
  (voz) =>
    ['Nina', 'Luiza', 'Gaby', 'Letícia'].includes(voz.nome)
)

const vozesInfantis = vozes.filter(
  (voz) =>
    ['Flavinha', 'Aninha', 'Paulinho'].includes(voz.nome)
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

    const creditosNecessarios = Math.max(
      1,
      Math.ceil(textoDigitado.length / 800)
    )

    if (carregandoCreditos) {
      alert('Aguarde o carregamento do seu saldo de créditos.')
      return
    }

    if (creditos === null) {
      await carregarCreditos()
      alert('Não foi possível confirmar seu saldo. Tente novamente.')
      return
    }

    if (creditos < creditosNecessarios) {
      alert(
        `Você precisa de ${creditosNecessarios} crédito${
          creditosNecessarios === 1 ? '' : 's'
        } para gerar essa locução. Seu saldo atual é de ${creditos} crédito${
          creditos === 1 ? '' : 's'
        }.`
      )
      return
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (
      sessionError ||
      !sessionData.session
    ) {
      alert('Sua sessão expirou. Faça login novamente.')
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            texto: textoFinal,
            voiceId: vozAtual.id,
            estilo: estiloSelecionado,
            instrucaoPersonalizada: instrucaoPersonalizada.trim(),
            reverb: reverbAtivo
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

      const urlAudio =
        URL.createObjectURL(audioBlob)

      setAudioUrl(urlAudio)
      setAudioOriginalUrl(urlAudio)
      setMixAudioUrl('')

      await salvarNoHistorico(audioBlob, 'locucao')

      // O servidor já descontou os créditos com segurança.
      // Apenas atualizamos o saldo exibido na tela.
      await carregarCreditos()
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

  const mixarVozComTrilha = async () => {
    if (!audioUrl) {
      alert('Gere uma voz primeiro.')
      return
    }

    if (!trilhaSelecionada && !trilhaArquivo) {
      alert('Escolha uma trilha ou envie sua própria trilha.')
      return
    }

    setMixando(true)

    try {
      const vozResponse = await fetch(audioOriginalUrl)

      if (!vozResponse.ok) {
        throw new Error('Não foi possível acessar o áudio da voz.')
      }

      const vozBuffer = await vozResponse.arrayBuffer()

      let trilhaBuffer: ArrayBuffer

      if (trilhaArquivo) {
        trilhaBuffer = await trilhaArquivo.arrayBuffer()
      } else {
        const trilhaResponse = await fetch(trilhaSelecionada)

        if (!trilhaResponse.ok) {
          throw new Error('Não foi possível carregar a trilha selecionada.')
        }

        trilhaBuffer = await trilhaResponse.arrayBuffer()
      }

      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('Seu navegador não suporta mixagem de áudio.')
      }

      const contexto = new AudioContextClass()

      const voz = await contexto.decodeAudioData(vozBuffer.slice(0))
      const trilha = await contexto.decodeAudioData(trilhaBuffer.slice(0))

      // -----------------------------------------------------
      // CARREGAR EFEITOS
      // -----------------------------------------------------
      // encodeURI evita problemas com nomes como "Transmissão.mp3".
      const carregarEfeito = async (
        caminho: string
      ): Promise<AudioBuffer> => {
        const resposta = await fetch(encodeURI(caminho))

        if (!resposta.ok) {
          throw new Error(`Não foi possível carregar o efeito: ${caminho}`)
        }

        const dados = await resposta.arrayBuffer()

        if (!dados.byteLength) {
          throw new Error(`O efeito está vazio: ${caminho}`)
        }

        return contexto.decodeAudioData(dados.slice(0))
      }

      let efeito: AudioBuffer | null = null
      let efeito2: AudioBuffer | null = null

      if (efeitoSelecionado) {
        efeito = await carregarEfeito(efeitoSelecionado)
      }

      if (mostrarSegundoEfeito && efeito2Selecionado) {
        efeito2 = await carregarEfeito(efeito2Selecionado)
      }

      const inicio = Math.max(0, Number(segundosInicio) || 0)
      const final = Math.max(0, Number(segundosFinal) || 0)

      const pontoInicioTrilha =
        trilha.duration > 0
          ? Math.min(
              Math.max(0, Number(inicioTrilha) || 0),
              Math.max(0, trilha.duration - 0.01)
            )
          : 0

      const duracaoVoz = voz.duration

      // Os efeitos são posicionados em relação ao INÍCIO DA TRILHA,
      // nunca em relação ao início da voz.
      const posicaoEfeitoNormalizada = Math.max(
        0,
        Number(posicaoEfeito) || 0
      )

      const posicaoEfeito2Normalizada = Math.max(
        0,
        Number(posicaoEfeito2) || 0
      )

      // Remove eventual silêncio do começo do arquivo para que o efeito
      // aconteça no segundo escolhido pelo usuário.
      const encontrarOffsetComSom = (buffer: AudioBuffer) => {
        const limiteSom = 0.008

        for (let frame = 0; frame < buffer.length; frame++) {
          let maiorAmostra = 0

          for (let canal = 0; canal < buffer.numberOfChannels; canal++) {
            maiorAmostra = Math.max(
              maiorAmostra,
              Math.abs(buffer.getChannelData(canal)[frame])
            )
          }

          if (maiorAmostra >= limiteSom) {
            return frame / buffer.sampleRate
          }
        }

        return 0
      }

      const offsetSom1 = efeito
        ? encontrarOffsetComSom(efeito)
        : 0

      const offsetSom2 = efeito2
        ? encontrarOffsetComSom(efeito2)
        : 0

      const duracaoEfeito1 = efeito
        ? Math.max(0.01, efeito.duration - offsetSom1)
        : 0

      const duracaoEfeito2 = efeito2
        ? Math.max(0.01, efeito2.duration - offsetSom2)
        : 0

      const fimEfeito1 = efeito
        ? posicaoEfeitoNormalizada + duracaoEfeito1
        : 0

      const fimEfeito2 = efeito2
        ? posicaoEfeito2Normalizada + duracaoEfeito2
        : 0

      // -----------------------------------------------------
      // TEMPOS DO DUCKING
      // -----------------------------------------------------
      // Não existe fade no início.
      // A trilha começa imediatamente no volume escolhido.
      // Depois da voz, reservamos tempo para a trilha subir antes
      // de começar o fade final.
      const duracaoEntradaVoz = Math.min(
        0.8,
        Math.max(0.25, duracaoVoz / 10)
      )

      const duracaoSaidaVoz = Math.min(
        0.8,
        Math.max(0.25, duracaoVoz / 10)
      )

      const fimDaVoz = inicio + duracaoVoz
      const fimSubidaTrilha = fimDaVoz + duracaoSaidaVoz

      // O fade final só começa DEPOIS da subida da trilha.
      const duracaoTotal = Math.max(
        inicio + duracaoVoz + duracaoSaidaVoz + final,
        fimEfeito1,
        fimEfeito2,
        0.01
      )

      const sampleRate = contexto.sampleRate
      const canais = Math.max(2, voz.numberOfChannels)
      const frames = Math.max(
        1,
        Math.ceil(duracaoTotal * sampleRate)
      )

      const offline = new OfflineAudioContext(
        canais,
        frames,
        sampleRate
      )

      // -----------------------------------------------------
      // VOZ
      // -----------------------------------------------------
      const vozSource = offline.createBufferSource()
      vozSource.buffer = voz

      const vozGain = offline.createGain()

      const volumeVozNormalizado = Math.max(
        0,
        Math.min(1.5, volumeVoz / 100)
      )

      vozGain.gain.setValueAtTime(volumeVozNormalizado, 0)
      vozSource.connect(vozGain)

      if (reverbAtivo) {
        const reverbDelay = offline.createDelay(1.0)
        const reverbGain = offline.createGain()

        reverbDelay.delayTime.value = 0.18
        reverbGain.gain.value = 0.15

        vozGain.connect(reverbDelay)
        reverbDelay.connect(reverbGain)
        reverbGain.connect(offline.destination)
      }

      vozGain.connect(offline.destination)
      vozSource.start(inicio)

      // -----------------------------------------------------
      // FUNÇÃO PARA INSERIR EFEITO
      // -----------------------------------------------------
      const adicionarEfeito = (
        buffer: AudioBuffer,
        posicao: number,
        volume: number,
        offsetSom: number,
        duracaoSom: number
      ) => {
        const source = offline.createBufferSource()
        source.buffer = buffer

        const gain = offline.createGain()
        const compressor = offline.createDynamicsCompressor()

        const volumeNormalizado = Math.max(
          0,
          Math.min(2.2, (volume / 100) * 2.2)
        )

        gain.gain.setValueAtTime(volumeNormalizado, 0)

        compressor.threshold.value = -18
        compressor.knee.value = 12
        compressor.ratio.value = 8
        compressor.attack.value = 0.003
        compressor.release.value = 0.15

        source.connect(gain)
        gain.connect(compressor)
        compressor.connect(offline.destination)

        // IMPORTANTE: posição absoluta desde o começo da trilha.
        source.start(posicao, offsetSom, duracaoSom)
      }

      if (efeito) {
        adicionarEfeito(
          efeito,
          posicaoEfeitoNormalizada,
          volumeEfeito,
          offsetSom1,
          duracaoEfeito1
        )
      }

      if (efeito2) {
        adicionarEfeito(
          efeito2,
          posicaoEfeito2Normalizada,
          volumeEfeito2,
          offsetSom2,
          duracaoEfeito2
        )
      }

      // -----------------------------------------------------
      // TRILHA + DUCKING
      // -----------------------------------------------------
      const trilhaGain = offline.createGain()

      const volumeNormal = Math.max(
        0,
        Math.min(1, volumeTrilha / 100)
      )

      // 30% do volume escolhido durante a voz.
      const volumeDuranteVoz = volumeNormal * 0.30

      // SEM FADE NO INÍCIO.
      // A trilha começa imediatamente alta no volume escolhido.
      trilhaGain.gain.setValueAtTime(volumeNormal, 0)

      if (inicio > 0) {
        const inicioDucking = Math.max(
          0,
          inicio - duracaoEntradaVoz
        )

        // Mantém a trilha normal até começar a descida.
        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          inicioDucking
        )

        // Abaixa suavemente até o nível da locução.
        trilhaGain.gain.linearRampToValueAtTime(
          volumeDuranteVoz,
          inicio
        )
      } else {
        // Se a voz começa em 0, apenas fazemos a descida da trilha.
        trilhaGain.gain.linearRampToValueAtTime(
          volumeDuranteVoz,
          Math.min(duracaoEntradaVoz, fimDaVoz)
        )
      }

      // Mantém baixa durante toda a locução.
      trilhaGain.gain.setValueAtTime(
        volumeDuranteVoz,
        fimDaVoz
      )

      // Quando o locutor termina, sobe novamente para o volume normal.
      trilhaGain.gain.linearRampToValueAtTime(
        volumeNormal,
        fimSubidaTrilha
      )

      // -----------------------------------------------------
      // FADE FINAL — SOMENTE NO FINAL
      // -----------------------------------------------------
      if (final > 0) {
        const fadeOutInicio = Math.max(
          fimSubidaTrilha,
          duracaoTotal - final
        )

        // Garante que o fade começa com a trilha já alta.
        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          fadeOutInicio
        )

        trilhaGain.gain.linearRampToValueAtTime(
          0,
          duracaoTotal
        )
      } else {
        // Sem fade configurado, mantém a trilha no volume normal
        // até o final reservado para a subida.
        trilhaGain.gain.setValueAtTime(
          volumeNormal,
          Math.min(fimSubidaTrilha, duracaoTotal)
        )
      }

      trilhaGain.connect(offline.destination)

      // -----------------------------------------------------
      // REPETIR TRILHA
      // -----------------------------------------------------
      let trilhaAtual = 0
      let primeiraParteTrilha = true

      while (trilhaAtual < duracaoTotal) {
        const trilhaSource = offline.createBufferSource()
        trilhaSource.buffer = trilha
        trilhaSource.connect(trilhaGain)

        const restante = duracaoTotal - trilhaAtual

        const offsetFonte = primeiraParteTrilha
          ? pontoInicioTrilha
          : 0

        const duracaoDisponivel = trilha.duration - offsetFonte
        const duracaoFonte = Math.min(
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

        trilhaAtual += duracaoFonte
        primeiraParteTrilha = false
      }

      // -----------------------------------------------------
      // RENDERIZAR
      // -----------------------------------------------------
      const renderizado = await offline.startRendering()

      const wavBlob = audioBufferParaWav(renderizado)

      const respostaMix = await fetch(
        '/api/converter-mp3',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/wav',
          },
          body: wavBlob,
        }
      )

      if (!respostaMix.ok) {
        throw new Error(
          'Não foi possível converter a mixagem para MP3.'
        )
      }

      const mp3Blob = await respostaMix.blob()

      if (!mp3Blob.size) {
        throw new Error('A mixagem retornou um áudio vazio.')
      }

      const mixUrl = URL.createObjectURL(mp3Blob)
      setMixAudioUrl(mixUrl)

      await salvarNoHistorico(mp3Blob, 'mixagem')

      await contexto.close()
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
            Seu estúdio de voz profissional
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


        {mostrarHistorico && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              background: 'rgba(0,0,0,0.82)',
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
                maxWidth: '900px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '26px',
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
                  gap: '12px',
                  marginBottom: '18px'
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>🕘 Histórico de vinhetas</h2>
                  <div style={{ marginTop: '5px', color: '#aaa', fontSize: '13px' }}>
                    Seus áudios ficam disponíveis por 3 dias e não consomem novos créditos.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarHistorico(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#c084fc',
                    fontSize: '28px',
                    cursor: 'pointer'
                  }}
                  aria-label="Fechar histórico"
                >
                  ×
                </button>
              </div>

              {carregandoHistorico ? (
                <div style={{ padding: '35px 10px', textAlign: 'center', color: '#c084fc', fontWeight: 700 }}>
                  ⏳ Carregando seu histórico...
                </div>
              ) : historico.length === 0 ? (
                <div style={{ padding: '35px 10px', textAlign: 'center', color: '#aaa' }}>
                  Você ainda não tem vinhetas no histórico.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {historico.map((item) => {
                    const criado = new Date(item.criado_em)
                    const expira = new Date(item.expira_em)

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '17px',
                          borderRadius: '15px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.10)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '7px' }}>
                          <strong>
                            {item.tipo === 'mixagem' ? '🎵 Mixagem' : '🎙️ Locução'}
                            {item.nome_voz ? ` — ${item.nome_voz}` : ''}
                          </strong>
                          <span style={{ color: '#c084fc', fontSize: '12px' }}>
                            {item.estilo || 'Natural'}
                          </span>
                        </div>

                        <div style={{ color: '#999', fontSize: '12px', marginBottom: '8px' }}>
                          Gerada em {criado.toLocaleString('pt-BR')} · expira em {expira.toLocaleString('pt-BR')}
                        </div>

                        <div style={{ color: '#ddd', fontSize: '13px', lineHeight: 1.45, marginBottom: '11px' }}>
                          {item.texto}
                        </div>

                        {item.url ? (
                          <>
                            <audio
                              className="player-audio"
                              controls
                              preload="none"
                              src={item.url}
                              style={{ width: '100%' }}
                            />

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '9px' }}>
                              <a
                                className="botao-download"
                                href={item.url}
                                download={`fabrica-da-voz-${item.id}.mp3`}
                              >
                                ⬇️ Baixar novamente
                              </a>

                              <button
                                type="button"
                                onClick={() => void excluirDoHistorico(item)}
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: '9px',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: '#aaa',
                                  cursor: 'pointer'
                                }}
                              >
                                🗑️ Excluir
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: '#facc15', fontSize: '13px' }}>
                            Não foi possível carregar este áudio agora.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => void carregarHistorico()}
                disabled={carregandoHistorico}
                style={{
                  width: '100%',
                  marginTop: '18px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.45)',
                  background: 'rgba(124,58,237,0.12)',
                  color: '#c084fc',
                  fontWeight: 700,
                  cursor: carregandoHistorico ? 'wait' : 'pointer'
                }}
              >
                🔄 Atualizar histórico
              </button>
            </div>
          </div>
        )}

        <main className="main">

          <section className="hero">

            <span className="tag">
              ESTÚDIO DE VOZ
            </span>

            <h2>
              Crie sua voz profissional com inteligência artificial.
            </h2>

            <p>
              Transforme seu texto em uma locução profissional em poucos segundos.
            </p>

          </section>

          <section className="editor-area">

            <div className="editor">

              <h3>
                Crie seu áudio
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
                <span>
                  💳 Créditos disponíveis:{' '}
                  <strong>{creditos === null ? '...' : creditos}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => void carregarCreditos()}
                  disabled={carregandoCreditos}
                  title="Atualizar saldo de créditos"
                  style={{
                    padding: '8px 11px',
                    borderRadius: '9px',
                    border: '1px solid rgba(192,132,252,0.45)',
                    background: 'rgba(124,58,237,0.16)',
                    color: '#c084fc',
                    cursor: carregandoCreditos ? 'wait' : 'pointer',
                    fontWeight: 700,
                    opacity: carregandoCreditos ? 0.65 : 1
                  }}
                >
                  {carregandoCreditos ? '⏳' : '🔄'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMostrarHistorico(true)
                    void carregarHistorico()
                  }}
                  style={{
                    padding: '8px 13px',
                    borderRadius: '9px',
                    border: '1px solid rgba(255,255,255,0.20)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🕘 Histórico (3 dias)
                </button>

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
                <button
                  type="button"
                  onClick={sairDaFabrica}
                  style={{
                    padding: '8px 13px',
                    borderRadius: '9px',
                    border: '1px solid rgba(255,255,255,0.20)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Sair
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
        preload="metadata"
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
        preload="metadata"
        src={voz.demonstrativo}
      />
    </div>
  )
)}

<h3 className="titulo-sexo-voz">
  INFANTIL
</h3>

{vozesInfantis.map(
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
        preload="metadata"
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

                <div style={{
                  marginTop: '14px'
                }}>
                  <label>
                    🎙️ Como você quer que o locutor fale?
                  </label>

                  <textarea
                    value={instrucaoPersonalizada}
                    onChange={(e) =>
                      setInstrucaoPersonalizada(e.target.value.slice(0, 300))
                    }
                    maxLength={300}
                    placeholder="Ex.: fale como locutor de rádio, com bastante energia e entusiasmo..."
                    rows={3}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(139, 92, 246, 0.55)',
                      background: '#171020',
                      color: '#ffffff',
                      fontSize: '14px',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{
                    marginTop: '5px',
                    textAlign: 'right',
                    color: '#aaa',
                    fontSize: '12px'
                  }}>
                    {instrucaoPersonalizada.length}/300 caracteres
                  </div>
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
  id="campoTextoLocucao"
  className="campo-texto"
  value={texto}
  onChange={(e) => setTexto(e.target.value)}
  
  placeholder="Digite aqui o texto que você quer transformar..."
/>

<div
  className="contador-caracteres"
  style={{
    marginTop: '7px',
    textAlign: 'right',
    color: '#aaa',
    fontSize: '12px',
    fontWeight: 400,
    opacity: 0.85
  }}
>
  {texto.length} caracteres • {texto.length === 0 ? 0 : Math.ceil(texto.length / 800)} créditos
</div>
<button
  type="button"
  className="botao-corrigir"
  onClick={corrigirTextoComIA}
  disabled={corrigindoTexto}
>
  {corrigindoTexto ? 'Corrigindo texto...' : '✨ Corrigir texto com IA'}
</button>

              <div style={{
                marginTop: '14px',
                marginBottom: '18px',
                padding: '16px 18px',
                borderRadius: '14px',
                border: '1px solid rgba(192, 132, 252, 0.28)',
background: 'rgba(124, 58, 237, 0.08)',
color: '#d8c7ef',
boxShadow: 'none',
lineHeight: 1.45,
fontSize: '12px',
fontWeight: 400
              }}>
                <div style={{ fontSize: '13px', marginBottom: '5px', color: '#c084fc', fontWeight: 600 }}>
                  ⚠️ ATENÇÃO
                </div>
                <div>
                  Não nos responsabilizamos por erros de escrita do usuário,
                  corrigiremos apenas erros de pronúncia ou devaneios da IA.
                </div>
              </div>

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
                          FINALIZAÇÃO DO ÁUDIO
                      ================================================= */}

                      {(trilhaSelecionada || trilhaArquivo) && (
                        <div
                          style={{
                            marginTop: '20px',
                            padding: '18px',
                            borderRadius: '14px',
                            background: 'rgba(124, 58, 237, 0.08)',
                            border: '1px solid rgba(139, 92, 246, 0.35)'
                          }}
                        >
                          <div
                            style={{
                              color: '#ffffff',
                              fontSize: '17px',
                              fontWeight: 800,
                              marginBottom: '14px'
                            }}
                          >
                            🎛️ Finalização do áudio
                          </div>

                          <button
                            type="button"
                            onClick={() => setReverbAtivo(!reverbAtivo)}
                            style={{
                              width: '100%',
                              padding: '14px 18px',
                              borderRadius: '12px',
                              border: reverbAtivo
                                ? '1px solid #a855f7'
                                : '1px solid rgba(139, 92, 246, 0.55)',
                              background: reverbAtivo
                                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                                : '#171020',
                              color: '#ffffff',
                              fontSize: '16px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: '0.2s'
                            }}
                          >
                            {reverbAtivo ? '✨ Reverb: ATIVADO' : '✨ Reverb: DESLIGADO'}
                          </button>

                          <div style={{ marginTop: '12px' }}>
                            <div
                              style={{
                                color: '#ffffff',
                                fontSize: '16px',
                                fontWeight: 700,
                                marginBottom: '8px'
                              }}
                            >
                              🎧 Efeitos sonoros
                            </div>

                            <select
                              value={efeitoSelecionado}
                              onChange={(e) => setEfeitoSelecionado(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(139, 92, 246, 0.55)',
                                background: '#171020',
                                color: '#ffffff',
                                fontSize: '15px',
                                outline: 'none'
                              }}
                            >
                              <option value="">Nenhum efeito</option>
                              <option value="/efeitos/Laser.mp3">Laser</option>
                              <option value="/efeitos/Impacto.mp3">Impacto</option>
                              <option value="/efeitos/Transmissão.mp3">Transmissão</option>
                              <option value="/efeitos/Buzina.mp3">Buzina</option>
                              <option value="/efeitos/WhatsApp.mp3">WhatsApp</option>
                              <option value="/efeitos/Demonstrativo.mp3">Demonstrativo</option>
                            </select>

                            {efeitoSelecionado && (
                              <div
                                style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  borderRadius: '12px',
                                  background: 'rgba(139,92,246,0.08)',
                                  border: '1px solid rgba(139,92,246,0.18)'
                                }}
                              >
                                <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: '10px' }}>
                                  Efeito 1
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', fontSize: '14px', marginBottom: '6px' }}>
                                  <span>Volume</span>
                                  <strong style={{ color: '#facc15' }}>{volumeEfeito}%</strong>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={volumeEfeito}
                                  onChange={(e) => setVolumeEfeito(Number(e.target.value))}
                                  style={{ width: '100%', accentColor: '#a855f7' }}
                                />

                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', fontSize: '14px', margin: '10px 0 6px' }}>
                                  <span>Posição na locução</span>
                                  <strong style={{ color: '#facc15' }}>{posicaoEfeito.toFixed(1)}s</strong>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="60"
                                  step="0.1"
                                  value={posicaoEfeito}
                                  onChange={(e) => setPosicaoEfeito(Number(e.target.value))}
                                  style={{ width: '100%', accentColor: '#a855f7' }}
                                />
                              </div>
                            )}

                            {efeitoSelecionado && !mostrarSegundoEfeito && (
                              <button
                                type="button"
                                onClick={() => setMostrarSegundoEfeito(true)}
                                style={{
                                  width: '100%',
                                  marginTop: '10px',
                                  padding: '11px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(250,204,21,0.45)',
                                  background: 'rgba(250,204,21,0.08)',
                                  color: '#facc15',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ➕ Adicionar segundo efeito
                              </button>
                            )}

                            {mostrarSegundoEfeito && (
                              <div
                                style={{
                                  marginTop: '12px',
                                  padding: '12px',
                                  borderRadius: '12px',
                                  background: 'rgba(139,92,246,0.08)',
                                  border: '1px solid rgba(139,92,246,0.18)'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ color: '#c084fc', fontWeight: 700 }}>Efeito 2</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMostrarSegundoEfeito(false)
                                      setEfeito2Selecionado('')
                                    }}
                                    style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Remover
                                  </button>
                                </div>

                                <select
                                  value={efeito2Selecionado}
                                  onChange={(e) => setEfeito2Selecionado(e.target.value)}
                                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.55)', background: '#171020', color: '#ffffff', fontSize: '15px', outline: 'none' }}
                                >
                                  <option value="">Nenhum efeito</option>
                                  <option value="/efeitos/Laser.mp3">Laser</option>
                                  <option value="/efeitos/Impacto.mp3">Impacto</option>
                                  <option value="/efeitos/Transmissão.mp3">Transmissão</option>
                                  <option value="/efeitos/Buzina.mp3">Buzina</option>
                                  <option value="/efeitos/WhatsApp.mp3">WhatsApp</option>
                                </select>

                                {efeito2Selecionado && (
                                  <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', fontSize: '14px', margin: '10px 0 6px' }}>
                                      <span>Volume</span>
                                      <strong style={{ color: '#facc15' }}>{volumeEfeito2}%</strong>
                                    </div>
                                    <input type="range" min="0" max="100" value={volumeEfeito2} onChange={(e) => setVolumeEfeito2(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7' }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d1d5db', fontSize: '14px', margin: '10px 0 6px' }}>
                                      <span>Posição na locução</span>
                                      <strong style={{ color: '#facc15' }}>{posicaoEfeito2.toFixed(1)}s</strong>
                                    </div>
                                    <input type="range" min="0" max="60" step="0.1" value={posicaoEfeito2} onChange={(e) => setPosicaoEfeito2(Number(e.target.value))} style={{ width: '100%', accentColor: '#a855f7' }} />
                                  </>
                                )}
                              </div>
                            )}
                          </div>
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

                          <div
                            style={{
                              margin: '0 0 12px',
                              padding: '13px 15px',
                              borderRadius: '12px',
                              border: '1px solid rgba(234,179,8,0.45)',
                              background: 'rgba(234,179,8,0.08)',
                              color: '#facc15',
                              lineHeight: 1.45,
                              fontSize: '14px'
                            }}
                          >
                            <strong>💡 DICA IMPORTANTE</strong>
                            <div style={{ marginTop: '5px', color: '#f3f3f3' }}>
                              Você pode trocar a trilha, os efeitos, o volume e a posição dos efeitos
                              e <strong>mixar novamente quantas vezes quiser sem gastar novos créditos.</strong>
                              O crédito é descontado somente ao gerar a locução.
                            </div>
                          </div>

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









