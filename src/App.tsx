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

type Voz = {  id: string
  nome: string
  foto: string
  demonstrativo: string
  especialidade?: string
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
  const [mostrarEditor, setMostrarEditor] = useState(false)
  const [baixandoAudio, setBaixandoAudio] = useState(false)
  const [baixandoMixagem, setBaixandoMixagem] = useState(false)
  const [baixandoMasterizado, setBaixandoMasterizado] = useState(false)
    const [acessoLiberado, setAcessoLiberado] = useState(false)

  const [senhaAcesso, setSenhaAcesso] = useState('')
  const [erroAcesso, setErroAcesso] = useState('')
  const [emailAcesso, setEmailAcesso] = useState('')
  const [creditos, setCreditos] = useState<number | null>(null)
  const [regeneracoes, setRegeneracoes] = useState(0)
  const [ultimaGeracao, setUltimaGeracao] = useState<{ texto: string; voiceId: string; estilo: string; instrucaoPersonalizada: string; reverb: boolean; volumeReverb: number } | null>(null)
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
        .select('creditos, regeneracoes')
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
      setRegeneracoes(Number(data.regeneracoes ?? 0))
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


  const [mostrarDJExpress, setMostrarDJExpress] = useState(false)
  const [mostrarFabricaStudio, setMostrarFabricaStudio] = useState(false)
const [studioVozArquivo, setStudioVozArquivo] = useState<File | null>(null)
const [studioTrilhaArquivo, setStudioTrilhaArquivo] = useState<File | null>(null)
const [studioEstiloTrilha, setStudioEstiloTrilha] = useState('comercial')
const [studioTrilhaSelecionada, setStudioTrilhaSelecionada] = useState('')
const [studioReverbAtivo, setStudioReverbAtivo] = useState(false)
const [studioVolumeReverb, setStudioVolumeReverb] = useState(30)
const [studioEfeito1, setStudioEfeito1] = useState('')
const [studioVolumeEfeito1, setStudioVolumeEfeito1] = useState(70)
const [studioPosicaoEfeito1, setStudioPosicaoEfeito1] = useState(0)
const [studioEfeito2, setStudioEfeito2] = useState('')
const [studioVolumeEfeito2, setStudioVolumeEfeito2] = useState(70)
const [studioPosicaoEfeito2, setStudioPosicaoEfeito2] = useState(3)
const [studioVolumeVoz, setStudioVolumeVoz] = useState(100)
const [studioVolumeTrilha, setStudioVolumeTrilha] = useState(25)
const [studioDucking, setStudioDucking] = useState(true)
const [studioAtrasoVoz, setStudioAtrasoVoz] = useState(3)
const [studioPontoTrilha, setStudioPontoTrilha] = useState(0)
const [studioSegundosFinais, setStudioSegundosFinais] = useState(3)
const [studioMixando, setStudioMixando] = useState(false)
const [studioMixAudioUrl, setStudioMixAudioUrl] = useState('')
  const [nomeDJ, setNomeDJ] = useState('')
  const [vozDJSelecionada, setVozDJSelecionada] = useState('rz25pon9uanPpUGOW98Y')
  const [estiloDJ, setEstiloDJ] = useState('pancadao')
  const [textoDJ, setTextoDJ] = useState('')
  const [gerandoDJ, setGerandoDJ] = useState(false)
  const [audioDJUrl, setAudioDJUrl] = useState('')
  const [vozSelecionada, setVozSelecionada] =
    useState('rz25pon9uanPpUGOW98Y')

  const [estiloSelecionado, setEstiloSelecionado] = useState('normal')

  const [instrucaoPersonalizada, setInstrucaoPersonalizada] = useState('')

  const [reverbAtivo, setReverbAtivo] = useState(false)
  const [volumeReverb, setVolumeReverb] = useState(30)

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

  const [masterizando, setMasterizando] = useState(false);
  const [audioMasterizadoUrl, setAudioMasterizadoUrl] = useState("");

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
,
      especialidade: 'Institucional'
    },

    {
      id: 'cxaKsaoZvZoce6kBBu0n',
      nome: 'Nina',
      foto: ninaLocutora,
      demonstrativo: '/nina-amostra-novo.mp3'
,
      especialidade: 'Comercial'
    },

    {
      id: 'rpNe0HOx7heUulPiOEaG',
      nome: 'Celso',
      foto: celsoLocutor,
      demonstrativo: '/vozes/celso.mp3'
,
      especialidade: 'Promocional'
    },

    {
      id: '0utPdY4y5ppoXQxzubar',
      nome: 'Pedro',
      foto: pedroLocutor,
      demonstrativo: '/vozes/pedro-amostra-novo.mp3'
,
      especialidade: 'Comercial'
    },
        {
      id: 'xyyAflT5WWJ3HeqszUn0',
      nome: 'Henrique',
      foto: henriqueLocutor,
      demonstrativo: '/vozes/henrique-voz.mp3'
,
      especialidade: 'Institucional'
    },
        {
      id: 'xqmVsyH6TEc0qQYSNT8P',
      nome: 'Rafael',
      foto: rafaelLocutor,
      demonstrativo: '/vozes/mateus-voz.mp3'
,
      especialidade: 'Promocional'
    },
        {
      id: 'B7HqRIxroDpybJI9vXMj',
      nome: 'Vinícius',
      foto: viniciusLocutor,
      demonstrativo: '/vozes/vinicius-voz.mp3'
,
      especialidade: 'Comercial'
    },
        {
      id: 'a5zGngtwpITbxmy3Sekk',
      nome: 'Vitor',
      foto: vitorLocutor,
      demonstrativo: '/vozes/vitor-voz.mp3'
,
      especialidade: 'Animado'
    },

    {
      id: 'DQRaZFBAlsnenMlFVe0R',
      nome: 'Lourenço',
      foto: lourencoLocutor,
      demonstrativo: '/vozes/lourenco.mp3'
,
      especialidade: 'Impacto'
    },

    {
      id: 'g2E836wHBXhsWq15NkoD',
      nome: 'Gustavo',
      foto: gustavoLocutor,
      demonstrativo: '/vozes/gustavo.mp3'
,
      especialidade: 'Promocional'
    },

    {
      id: '8Rw0UhFNLhw1t75pidLJ',
      nome: 'Flavinha',
      foto: flavinhaLocutora,
      demonstrativo: '/vozes/flavinha-voz-nova.mp3'
,
      especialidade: 'Animada'
    },

    {
      id: '3T1fxRR4KTmnl9K43DtE',
      nome: 'Aninha',
      foto: aninhaLocutora,
      demonstrativo: '/vozes infantis/aninha.mp3'
,
      especialidade: 'Infantil'
    },

    {
      id: 'Tkf2paIF3z04RS9egsf2',
      nome: 'Paulinho',
      foto: paulinhoLocutor,
      demonstrativo: '/vozes/paulinho-voz-nova.mp3'
,
      especialidade: 'Infantil'
    },

    {
      id: 'myEJoaX0UkuoJmX7w2Rf',
      nome: 'Luiza',
      foto: luizaLocutora,
      demonstrativo: '/vozes/luiza.mp3'
,
      especialidade: 'Comercial'
    },

    {
      id: 'qn85SVnJvSWg5wutkjZa',
      nome: 'Gaby',
      foto: gabyLocutora,
      demonstrativo: '/vozes/gaby.mp3'
,
      especialidade: 'Animada'
    }
  ,
    {
      id: 'u1vCfFgLgJ3YbJEqXmbf',
      nome: 'Angelo',
      foto: '/angelo-foto.png',
      demonstrativo: '/vozes/angelo-voz.mp3'
,
      especialidade: 'Impacto'
    },

    {
      id: 'exVv2CbwvTu1WNVuSWXs',
      nome: 'Bruno',
      foto: '/bruno-foto.png',
      demonstrativo: '/vozes/bruno-voz.mp3'
,
      especialidade: 'Promocional'
    },

    {
      id: 'gyiJ08WU9Wi2LNY7nTcB',
      nome: 'Letícia',
      foto: '/leticia-foto.png',
      demonstrativo: '/vozes/leticia-voz.mp3'
,
      especialidade: 'Comercial'
    },

    {
      id: 'Oxtl4GQ22m0Q0rh8YGCI',
      nome: 'Regiane',
      foto: '/regiane-foto.png',
      demonstrativo: '/vozes/regiane-voz.mp3'
,
      especialidade: 'Institucional'
    },

    {
      id: '0Np4P6bO9DGhECZoT8Ls',
      nome: 'Belkis',
      foto: '/belkis-foto.png',
      demonstrativo: '/vozes/belkis-voz.mp3'
,
      especialidade: 'Comercial'
    },
    {
      id: 'qPAKBzRQkQs6EIhLSbMi',
      nome: 'Ricardo',
      foto: '/ricardo-foto.png',
      demonstrativo: '/vozes/ricardo-voz.wav'
,
      especialidade: 'Grave'
    },
    {
      id: 'UaeEQHfiDI8l58WWXiwS',
      nome: 'Leonardo',
      foto: '/leonardo-foto.png',
      demonstrativo: '/vozes/leonardo-voz.mp3'
,
      especialidade: 'Institucional'
    },
    {
      id: 'oQL5kq26ctJzupM0mJot',
      nome: 'Noel',
      foto: '/noel-foto.png',
      demonstrativo: '/vozes/noel-voz.mp3'
,
      especialidade: 'Promocional'
    },
    {
      id: 'mmUpm90TBHi5276nYDJk',
      nome: 'Marcos',
      foto: '/marcos-foto.png',
      demonstrativo: '/vozes/marcos-voz.mp3',
      especialidade: 'Impacto'
    },
    {
      id: '5ZHkTB2DBtlPdKeuCgxu',
      nome: 'Rodrigo',
      foto: '/rodrigo-foto.png',
      demonstrativo: '/vozes/rodrigo-voz.mp3',
      especialidade: 'Comercial'
    },
    {
      id: 'g0iauLqQtYFe6LlIx8oy',
      nome: 'Roger',
      foto: '/roger-foto.png',
      demonstrativo: '/vozes/roger-voz.mp3',
      especialidade: 'Institucional'
    },
    {
      id: 'QbKKWw1Bp1k0ycDNqoY7',
      nome: 'Thiago',
      foto: '/thiago-foto.png',
      demonstrativo: '/vozes/thiago-voz.mp3',
      especialidade: 'Jovem'
    },
    {
      id: 'GiNbP6xPhrH6X8DJBD08',
      nome: 'André',
      foto: '/andré-foto.png',
      demonstrativo: '/vozes/andré-voz.mp3',
      especialidade: 'Impacto'
    },
    {
      id: 'Gxi5hLxJ4skjTWK8XHBJ',
      nome: 'Toledo',
      foto: '/toledo-foto.png',
      demonstrativo: '/vozes/toledo-voz.mp3',
      especialidade: 'Comercial'
    }
  ]

  const vozesMasculinas = vozes.filter(
  (voz) =>
    ['Noah', 'Celso', 'Pedro', 'Henrique', 'Rafael', 'Vinícius', 'Vitor', 'Lourenço', 'Gustavo', 'Angelo', 'Bruno', 'Ricardo', 'Leonardo', 'Noel', 'Marcos', 'André', 'Rodrigo', 'Roger', 'Thiago', 'Toledo'].includes(voz.nome)
)

const vozesFemininas = vozes.filter(
  (voz) =>
    ['Nina', 'Luiza', 'Gaby', 'Letícia', 'Regiane', 'Belkis'].includes(voz.nome)
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
const regenerarVoz = async () => {
    if (!ultimaGeracao || !audioUrl) {
      alert('Gere uma locucao primeiro.');
      return;
    }

    if (regeneracoes <= 0) {
      alert('Voce nao possui regeneracoes disponiveis.');
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      alert('Sua sessao expirou. Faca login novamente.');
      return;
    }

    setGerando(true);
    try {
      const resposta = await fetch('/api/gerar-voz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ ...ultimaGeracao, texto: texto.trim(), regenerar: true }),
      });

      if (!resposta.ok) {
        const corpoErro = await resposta.text();
        let mensagem = 'Erro ao regenerar a voz.';
        try {
          const dadosErro = JSON.parse(corpoErro);
          mensagem = dadosErro.erro || dadosErro.error || dadosErro.message || mensagem;
        } catch {
          if (corpoErro.trim()) mensagem = corpoErro;
        }
        throw new Error(mensagem);
      }

      const audioBlob = await resposta.blob();
      if (!audioBlob.size) throw new Error('O servidor retornou um audio vazio.');

      const urlAudio = URL.createObjectURL(audioBlob);
      setAudioUrl(urlAudio);
      setAudioOriginalUrl(urlAudio);
      setMixAudioUrl('');
      await salvarNoHistorico(audioBlob, 'locucao');
      await carregarCreditos();
    } catch (erro) {
      console.error('Erro ao regenerar voz:', erro);
      await carregarCreditos();
      alert(erro instanceof Error ? erro.message : 'Nao foi possivel regenerar a voz.');
    } finally {
      setGerando(false);
    }
  };

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
            reverb: reverbAtivo,
            volumeReverb: volumeReverb
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

      setUltimaGeracao({ texto: textoFinal, voiceId: vozAtual.id, estilo: estiloSelecionado, instrucaoPersonalizada: instrucaoPersonalizada.trim(), reverb: reverbAtivo, volumeReverb })
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
  // GERADOR EXCLUSIVO DJ EXPRESS
  // =====================================================

  const gerarJingleDJ = async () => {
    const nomeLimpo = nomeDJ.trim()
    const textoLimpo = textoDJ.trim()

    if (!nomeLimpo) {
      alert('Digite seu nome artístico de DJ.')
      return
    }

    if (!textoLimpo) {
      alert('Digite o texto da sua vinheta.')
      return
    }

    if (nomeLimpo.length > 60 || textoLimpo.length > 800) {
      alert('Confira os limites: nome artístico até 60 caracteres e texto até 800.')
      return
    }

    if (gerandoDJ) return

    setGerandoDJ(true)

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError || !sessionData.session) {
        throw new Error('Faça login para gerar sua vinheta DJ.')
      }

      const resposta = await fetch('/api/gerar-jingle-dj', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          nomeDJ: nomeLimpo,
          texto: textoLimpo,
          voiceId: vozDJSelecionada,
          estilo: estiloDJ,
        }),
      })

      if (!resposta.ok) {
        let mensagem = 'Não foi possível gerar a vinheta DJ.'

        try {
          const dadosErro = await resposta.json()
          mensagem = dadosErro.erro || mensagem
        } catch {
          // Mantém a mensagem padrão se a resposta não for JSON.
        }

        await carregarCreditos()
        throw new Error(mensagem)
      }

      const audioBlob = await resposta.blob()

      if (!audioBlob.size) {
        throw new Error('O servidor retornou um áudio vazio.')
      }

      const novaUrl = URL.createObjectURL(audioBlob)

      setAudioDJUrl((urlAnterior) => {
        if (urlAnterior) URL.revokeObjectURL(urlAnterior)
        return novaUrl
      })

      await carregarCreditos()
    } catch (erro) {
      console.error('Erro ao gerar vinheta DJ:', erro)

      alert(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível gerar a vinheta DJ.'
      )
    } finally {
      setGerandoDJ(false)
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
      { nome: 'Comercial 04', arquivo: '/trilhas/comercial/04-comercial.wav' },
      { nome: 'Comercial 05', arquivo: '/trilhas/comercial/05-comercial.wav' },
      { nome: 'Comercial 06', arquivo: '/trilhas/comercial/06-comercial.wav' },
      { nome: 'Comercial 07', arquivo: '/trilhas/comercial/07-comercial.mp3' },
      { nome: 'Comercial 08', arquivo: '/trilhas/comercial/08-comercial.mp3' },
      { nome: 'Comercial 09', arquivo: '/trilhas/comercial/09-comercial.mp3' },
      { nome: 'Comercial 10', arquivo: '/trilhas/comercial/10-comercial.mp3' },
    ],
    forro: [
      { nome: 'Forró 01', arquivo: '/trilhas/forro/01-forro.mp3' },
      { nome: 'Forró 02', arquivo: '/trilhas/forro/02-forro.mp3' },
      { nome: 'Forró 03', arquivo: '/trilhas/forro/03-forro.mp3' },
      { nome: 'Forró 04', arquivo: '/trilhas/forro/04-forro.mp3' },
      { nome: 'Forró 05', arquivo: '/trilhas/forro/05-forro.mp3' },
      { nome: 'Forró 06', arquivo: '/trilhas/forro/06-forro.mp3' },
      { nome: 'Forró 07', arquivo: '/trilhas/forro/07-forro.mp3' },
      { nome: 'Forró 08', arquivo: '/trilhas/forro/08-forro.mp3' },
      { nome: 'Forró 09', arquivo: '/trilhas/forro/09-forro.mp3' },
      { nome: 'Forró 10', arquivo: '/trilhas/forro/10-forro.mp3' },
      { nome: 'Forró 11', arquivo: '/trilhas/forro/11-forro.mp3' },
    ],
    institucional: [
      { nome: 'Institucional 01', arquivo: '/trilhas/institucional/01-Trilha institucional.mp3' },
      { nome: 'Institucional 02', arquivo: '/trilhas/institucional/02-Trilha institucional.mp3' },
      { nome: 'Institucional 03', arquivo: '/trilhas/institucional/03-Trilha institucional.mp3' },
      { nome: 'Institucional 04', arquivo: '/trilhas/institucional/04-Trilha institucional.mp3' },
      { nome: 'Institucional 05', arquivo: '/trilhas/institucional/05-Trilha institucional.mp3' },
      { nome: 'Institucional 06', arquivo: '/trilhas/institucional/06-Trilha institucional.mp3' },
    ],
    impacto: [
      { nome: 'Impacto 01', arquivo: '/trilhas/impacto/01- Impacto.mp3' },
      { nome: 'Impacto 02', arquivo: '/trilhas/impacto/02- Impacto.mp3' },
      { nome: 'Impacto 03', arquivo: '/trilhas/impacto/03- Impacto.mp3' },
      { nome: 'Impacto 04', arquivo: '/trilhas/impacto/04- Impacto.mp3' },
      { nome: 'Impacto 05', arquivo: '/trilhas/impacto/05- Impacto.mp3' },
    ],
    gospel: [
      { nome: 'Gospel 01', arquivo: '/trilhas/gospel/01- Gospel.mp3' },
      { nome: 'Gospel 02', arquivo: '/trilhas/gospel/02- Gospel.mp3' },
      { nome: 'Gospel 03', arquivo: '/trilhas/gospel/03- Gospel.mp3' },
      { nome: 'Gospel 04', arquivo: '/trilhas/gospel/04- Gospel.mp3' },
      { nome: 'Gospel 05', arquivo: '/trilhas/gospel/05- Gospel.mp3' },
      { nome: 'Gospel 06', arquivo: '/trilhas/gospel/06- Gospel.mp3' },
    ],
    jornalistica: [
      { nome: 'Jornalística 01', arquivo: '/trilhas/jornalistica/01-Trilha jornaslística.mp3' },
      { nome: 'Jornalística 02', arquivo: '/trilhas/jornalistica/02-Trilha jornalística.mp3' },
      { nome: 'Jornalística 03', arquivo: '/trilhas/jornalistica/03-Trilha jornalística.mp3' },
      { nome: 'Jornalística 04', arquivo: '/trilhas/jornalistica/04-Trilha jornalística.mp3' },
      { nome: 'Jornalística 05', arquivo: '/trilhas/jornalistica/05-Trilha jornalística.mp3' },
      { nome: 'Jornalística 06', arquivo: '/trilhas/jornalistica/06-Trilha jornalística.mp3' },
    ],
    gaucha: [
      { nome: 'Gaúcha 01', arquivo: '/trilhas/gaucha/01- Gaúcha.mp3' },
      { nome: 'Gaúcha 02', arquivo: '/trilhas/gaucha/02- Gaúcha.mp3' },
      { nome: 'Gaúcha 03', arquivo: '/trilhas/gaucha/03- Gaúcha.mp3' },
      { nome: 'Gaúcha 04', arquivo: '/trilhas/gaucha/04- Gaúcha.mp3' },
      { nome: 'Gaúcha 05', arquivo: '/trilhas/gaucha/05- Gaúcha.mp3' },
      { nome: 'Gaúcha 06', arquivo: '/trilhas/gaucha/06- Gaúcha.mp3' },
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
      { nome: 'Eletrônica 04', arquivo: '/trilhas/eletronica/04- Eletrõnica.mp3' },
      { nome: 'Eletrônica 05', arquivo: '/trilhas/eletronica/05- Eletrônica.mp3' },
      { nome: 'Eletrônica 06', arquivo: '/trilhas/eletronica/06- Eletrônica.mp3' },
    ],
    infantil: [
      { nome: 'Infantil 01', arquivo: '/trilhas/infantil/01-Infantil.mp3' },
      { nome: 'Infantil 02', arquivo: '/trilhas/infantil/02-Infantil.mp3' },
      { nome: 'Infantil 03', arquivo: '/trilhas/infantil/03-Infantil.mp3' },
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
    { valor: 'infantil', nome: '🧸 Infantil' },
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

    let contexto: AudioContext | null = null

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

      contexto = new AudioContextClass()

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

      const sampleRate = Math.min(contexto.sampleRate, 32000)
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
        reverbGain.gain.value = Math.max(0, Math.min(1, volumeReverb / 100))

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
        Math.min(2, volumeTrilha / 100)
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

    } catch (erro) {
      console.error('Erro na mixagem:', erro)

      alert(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível mixar a voz com a trilha.'
      )
    } finally {
      try {
        if (contexto && contexto.state !== 'closed') {
          await contexto.close()
        }
      } catch (erroFechamento) {
        console.warn('Falha ao fechar o contexto de audio:', erroFechamento)
      }
      setMixando(false)
    }
  }


  const mixarFabricaStudio = async () => {
    if (!studioVozArquivo || (!studioTrilhaArquivo && !studioTrilhaSelecionada)) {
      alert('Selecione a locucao e uma trilha musical.')
      return
    }

    setStudioMixando(true)

    let contexto: AudioContext | null = null
    let novaUrl = ''

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }).webkitAudioContext

      if (!AudioContextClass) {
        throw new Error('Seu navegador nao suporta mixagem de audio.')
      }

      contexto = new AudioContextClass()

      const respostaTrilha = studioTrilhaSelecionada
        ? await fetch(encodeURI(studioTrilhaSelecionada))
        : null

      if (respostaTrilha && !respostaTrilha.ok) {
        throw new Error('Não foi possível carregar a trilha selecionada.')
      }

      const [vozDados, trilhaDados] = await Promise.all([
        studioVozArquivo.arrayBuffer(),
        respostaTrilha ? respostaTrilha.arrayBuffer() : studioTrilhaArquivo!.arrayBuffer()
      ])

      const voz = await contexto.decodeAudioData(vozDados.slice(0))
      const trilha = await contexto.decodeAudioData(trilhaDados.slice(0))

      const carregarEfeitoStudio = async (caminho: string): Promise<AudioBuffer | null> => {
        if (!caminho) return null
        const resposta = await fetch(encodeURI(caminho))
        if (!resposta.ok) throw new Error("Não foi possível carregar o efeito: " + caminho)
        return await contexto!.decodeAudioData(await resposta.arrayBuffer())
      }

      const [bufferEfeito1, bufferEfeito2] = await Promise.all([
        carregarEfeitoStudio(studioEfeito1),
        carregarEfeitoStudio(studioEfeito2)
      ])

      const sampleRate = Math.min(contexto.sampleRate, 32000)
      const canais = Math.max(2, voz.numberOfChannels)
      const duracaoVoz = voz.duration
      const subida = Math.min(0.8, Math.max(0.25, duracaoVoz / 10))
      const atrasoVoz = Math.max(0, Math.min(30, studioAtrasoVoz))
      const pontoTrilha = Math.max(0, Math.min(Math.max(0, trilha.duration - 0.05), studioPontoTrilha))
      const duracaoFimVoz = atrasoVoz + duracaoVoz
      const segundosFinais = Math.max(0, Math.min(60, studioSegundosFinais))
      const duracaoBase = atrasoVoz + duracaoVoz + segundosFinais
      const fimEfeito1 = bufferEfeito1 ? atrasoVoz + Math.max(0, studioPosicaoEfeito1) + bufferEfeito1.duration : 0
      const fimEfeito2 = bufferEfeito2 ? atrasoVoz + Math.max(0, studioPosicaoEfeito2) + bufferEfeito2.duration : 0
      const duracaoTotal = Math.max(duracaoBase, fimEfeito1, fimEfeito2)
      const frames = Math.max(1, Math.ceil(duracaoTotal * sampleRate))

      const offline = new OfflineAudioContext(canais, frames, sampleRate)

      const vozSource = offline.createBufferSource()
      vozSource.buffer = voz

      const vozGain = offline.createGain()
      vozGain.gain.value = Math.max(0, Math.min(1.5, studioVolumeVoz / 100))
      vozSource.connect(vozGain)
      vozGain.connect(offline.destination)

      if (studioReverbAtivo && studioVolumeReverb > 0) {
        const tamanhoImpulso = Math.floor(sampleRate * 1.8)
        const impulso = offline.createBuffer(2, tamanhoImpulso, sampleRate)
        for (let canal = 0; canal < impulso.numberOfChannels; canal++) {
          const dados = impulso.getChannelData(canal)
          for (let i = 0; i < tamanhoImpulso; i++) {
            const decaimento = Math.pow(1 - i / tamanhoImpulso, 2.8)
            dados[i] = (Math.random() * 2 - 1) * decaimento
          }
        }

        const convolver = offline.createConvolver()
        convolver.buffer = impulso
        const reverbGain = offline.createGain()
        reverbGain.gain.value = Math.max(0, Math.min(0.7, studioVolumeReverb / 100 * 0.7))
        vozGain.connect(convolver)
        convolver.connect(reverbGain)
        reverbGain.connect(offline.destination)
      }

      vozSource.start(atrasoVoz)

      const adicionarEfeitoStudio = (
        buffer: AudioBuffer | null,
        volume: number,
        posicao: number
      ) => {
        if (!buffer) return
        const source = offline.createBufferSource()
        source.buffer = buffer
        const gain = offline.createGain()
        gain.gain.value = Math.max(0, Math.min(1, volume / 100))
        source.connect(gain)
        gain.connect(offline.destination)
        source.start(Math.max(0, posicao))
      }

      adicionarEfeitoStudio(bufferEfeito1, studioVolumeEfeito1, studioPosicaoEfeito1)
      adicionarEfeitoStudio(bufferEfeito2, studioVolumeEfeito2, studioPosicaoEfeito2)

      const trilhaGain = offline.createGain()
      const volumeNormal = Math.max(0, Math.min(2, studioVolumeTrilha / 100))
      const volumeBaixo = studioDucking ? volumeNormal * 0.30 : volumeNormal

      trilhaGain.gain.setValueAtTime(volumeNormal, 0)

      if (studioDucking) {
        if (atrasoVoz > 0) {
          trilhaGain.gain.setValueAtTime(volumeNormal, atrasoVoz)
          trilhaGain.gain.linearRampToValueAtTime(
            volumeBaixo,
            Math.min(duracaoFimVoz, atrasoVoz + 0.2)
          )
        } else {
          trilhaGain.gain.setValueAtTime(volumeBaixo, 0)
        }

        trilhaGain.gain.setValueAtTime(volumeBaixo, duracaoFimVoz)
        trilhaGain.gain.linearRampToValueAtTime(
          volumeNormal,
          Math.min(duracaoTotal, duracaoFimVoz + 0.3)
        )
      }

      if (segundosFinais > 0) {
        const inicioFade = Math.max(
          duracaoFimVoz,
          duracaoTotal - Math.min(3, segundosFinais)
        )
        trilhaGain.gain.setValueAtTime(volumeNormal, inicioFade)
        trilhaGain.gain.linearRampToValueAtTime(0, duracaoTotal)
      } else {
        trilhaGain.gain.setValueAtTime(0, duracaoTotal)
      }

      trilhaGain.connect(offline.destination)

      let tempo = 0
      let primeiraParte = true
      while (tempo < duracaoTotal) {
        const source = offline.createBufferSource()
        source.buffer = trilha
        source.connect(trilhaGain)

        const inicioFonte = primeiraParte ? pontoTrilha : 0
        const disponivel = trilha.duration - inicioFonte
        const duracaoParte = Math.min(disponivel, duracaoTotal - tempo)
        if (duracaoParte <= 0) break

        source.start(tempo, inicioFonte, duracaoParte)
        tempo += duracaoParte
        primeiraParte = false
      }

      const renderizado = await offline.startRendering()
      const wavBlob = audioBufferParaWav(renderizado)

      const resposta = await fetch('/api/converter-mp3', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob
      })

      if (!resposta.ok) {
        throw new Error('Nao foi possivel converter a mixagem para MP3.')
      }

      const mp3Blob = await resposta.blob()
      if (!mp3Blob.size) {
        throw new Error('O arquivo MP3 gerado esta vazio.')
      }

      novaUrl = URL.createObjectURL(mp3Blob)

      setStudioMixAudioUrl((urlAnterior) => {
        if (urlAnterior) URL.revokeObjectURL(urlAnterior)
        return novaUrl
      })
    } catch (erro) {
      console.error('Erro na mixagem do Studio:', erro)
      alert(erro instanceof Error ? erro.message : 'Falha ao mixar os audios.')
    } finally {
      try {
        if (contexto && contexto.state !== 'closed') {
          await contexto.close()
        }
      } catch (erroFechamento) {
        console.warn('Falha ao fechar o contexto de audio:', erroFechamento)
      }

      setStudioMixando(false)
    }
  }
  const masterizarAudio = async () => {
    if (!mixAudioUrl || masterizando) return;

    setMasterizando(true);

    try {
      const respostaOriginal = await fetch(mixAudioUrl);

      if (!respostaOriginal.ok) {
        throw new Error("Não foi possível carregar a mixagem original.");
      }

      const arquivoOriginal = await respostaOriginal.blob();

      const resposta = await fetch("/api/masterizar-audio", {
        method: "POST",
        headers: {
          "Content-Type": "audio/mpeg",
        },
        body: arquivoOriginal,
      });

      if (!resposta.ok) {
        let mensagem = "Não foi possível masterizar o áudio.";

        try {
          const dados = await resposta.json();
          if (dados && dados.erro) mensagem = dados.erro;
        } catch {}

        throw new Error(mensagem);
      }

      const arquivoMasterizado = await resposta.blob();

      if (!arquivoMasterizado.size) {
        throw new Error("O áudio masterizado ficou vazio.");
      }

      const novaUrl = URL.createObjectURL(arquivoMasterizado);

      setAudioMasterizadoUrl((urlAnterior) => {
        if (urlAnterior) URL.revokeObjectURL(urlAnterior);
        return novaUrl;
      });
    } catch (erro) {
      console.error("Erro na masterização:", erro);

      alert(
        erro instanceof Error
          ? erro.message
          : "Ocorreu um erro ao masterizar o áudio."
      );
    } finally {
      setMasterizando(false);
    }
  };

  // =====================================================
  // DJ EXPRESS - ESTUDIO EXCLUSIVO
  // =====================================================

  if (mostrarDJExpress) {
    const estilosDJ = [
      { id: 'pancadao', nome: 'Pancadão', descricao: 'Voz forte e impacto curto', simbolo: '💥' },
      { id: 'reiDaPista', nome: 'Rei da Pista', descricao: 'Voz poderosa e final marcante', simbolo: '👑' },
      { id: 'fantasma', nome: 'Fantasma', descricao: 'Eco longo e misterioso', simbolo: '👻' },
      { id: 'explosao', nome: 'Explosão', descricao: 'Impacto no começo e no fim', simbolo: '⚡' },
      { id: 'assinaturaDJ', nome: 'Assinatura DJ', descricao: 'Destaque para o nome artístico', simbolo: '🎧' },
      { id: 'alerta', nome: 'Alerta', descricao: 'Chamada intensa e vibrante', simbolo: '🚨' },
    ]

    return (
      <div style={{
        minHeight: '100vh',
        padding: '32px 20px 48px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at top, #28113b 0%, #100b16 42%, #08080c 100%)',
        color: '#fff',
      }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => setMostrarDJExpress(false)}
            style={{
              border: '1px solid rgba(216,180,254,0.35)',
              borderRadius: '12px',
              padding: '10px 15px',
              color: '#e9d5ff',
              background: '#21152c',
              cursor: 'pointer',
              marginBottom: '22px',
              fontWeight: 700,
            }}
          >
            ← Voltar à Fábrica da Voz
          </button>

          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            borderRadius: '24px',
            border: '1px solid rgba(168,85,247,0.5)',
            background: 'linear-gradient(145deg, rgba(65,27,92,0.92), rgba(20,12,28,0.96))',
            boxShadow: '0 0 35px rgba(147,51,234,0.16)',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '46px' }}>🎧</div>
            <h1 style={{
              margin: '8px 0',
              fontSize: 'clamp(28px, 6vw, 42px)',
              fontWeight: 900,
              letterSpacing: '1px',
            }}>
              <span style={{ color: '#fff' }}>DJ </span>
              <span style={{ color: '#facc15' }}>EXPRESS</span>
            </h1>
            <p style={{ color: '#d8b4fe', margin: 0 }}>
              Crie sua vinheta com efeitos exclusivos
            </p>
            <p style={{ color: '#facc15', fontWeight: 800, marginBottom: 0 }}>
              2 créditos por geração · Até 800 caracteres
            </p>
          </div>

          <div style={{
            display: 'grid',
            gap: '18px',
            padding: '22px',
            borderRadius: '22px',
            background: 'rgba(25,18,34,0.96)',
            border: '1px solid rgba(216,180,254,0.2)',
          }}>
            <label style={{ display: 'grid', gap: '8px', fontWeight: 700 }}>
              Nome artístico do DJ
              <input
                value={nomeDJ}
                onChange={(e) => setNomeDJ(e.target.value)}
                maxLength={60}
                placeholder="Ex.: DJ Henrique"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '14px',
                  borderRadius: '12px', border: '1px solid #70429a',
                  background: '#110c18', color: '#fff', fontSize: '16px',
                }}
              />
            </label>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label htmlFor="seletorLocutorDJ" style={{ fontWeight: 700 }}>
                Escolha o locutor
              </label>
              <select
                id="seletorLocutorDJ"
                value={vozDJSelecionada}
                onChange={(e) => setVozDJSelecionada(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #a855f7',
                  background: '#110c18',
                  color: '#fff',
                  fontSize: '15px',
                }}
              >
                {['mmUpm90TBHi5276nYDJk', 'a5zGngtwpITbxmy3Sekk', 'u1vCfFgLgJ3YbJEqXmbf', 'GiNbP6xPhrH6X8DJBD08', 'DQRaZFBAlsnenMlFVe0R', 'g0iauLqQtYFe6LlIx8oy', 'g2E836wHBXhsWq15NkoD', 'QbKKWw1Bp1k0ycDNqoY7', 'rpNe0HOx7heUulPiOEaG', 'gyiJ08WU9Wi2LNY7nTcB'].map((id) => {
                  const voz = vozes.find((item) => item.id === id);
                  return voz ? <option key={voz.id} value={voz.id}>{voz.nome}</option> : null;
                })}
              </select>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '56px minmax(0, 1fr)',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                background: '#191120',
                border: '1px solid #5b3a70',
              }}>
                <img
                  src={vozes.find((voz) => voz.id === vozDJSelecionada)?.foto}
                  alt={vozes.find((voz) => voz.id === vozDJSelecionada)?.nome || 'Locutor'}
                  style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%' }}
                />
                <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
                  <strong style={{ color: '#fff' }}>
                    {vozes.find((voz) => voz.id === vozDJSelecionada)?.nome || 'Selecione uma voz'}
                  </strong>
                  <audio
                    controls
                    preload="none"
                    src={vozes.find((voz) => voz.id === vozDJSelecionada)?.demonstrativo}
                    style={{ width: '100%', height: '36px' }}
                  />
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, marginBottom: '12px' }}>
                Escolha o efeito
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}>
                {estilosDJ.map((estilo) => {
                  const selecionado = estiloDJ === estilo.id
                  return (
                    <button
                      key={estilo.id}
                      type="button"
                      onClick={() => setEstiloDJ(estilo.id)}
                      style={{
                        minWidth: 0,
                        textAlign: 'left',
                        padding: '14px',
                        borderRadius: '14px',
                        border: selecionado ? '2px solid #facc15' : '1px solid #5b3a70',
                        background: selecionado ? '#43205b' : '#191120',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '22px' }}>{estilo.simbolo}</span>
                      <div style={{ fontWeight: 800, marginTop: '5px' }}>{estilo.nome}</div>
                      <div style={{ color: '#d8c8e5', fontSize: '13px', marginTop: '4px' }}>
                        {estilo.descricao}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <label style={{ display: 'grid', gap: '8px', fontWeight: 700 }}>
              Texto da vinheta
              <textarea
                value={textoDJ}
                onChange={(e) => setTextoDJ(e.target.value)}
                maxLength={800}
                rows={5}
                placeholder="Digite aqui o texto que o locutor vai falar..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '14px',
                  borderRadius: '12px', border: '1px solid #70429a',
                  background: '#110c18', color: '#fff', fontSize: '16px',
                  resize: 'vertical', lineHeight: 1.5,
                }}
              />
              <span style={{
                textAlign: 'right',
                color: textoDJ.length >= 800 ? '#facc15' : '#c4b5d0',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                {textoDJ.length}/800 caracteres
              </span>
            </label>

            <button
              type="button"
              disabled={gerandoDJ}
              onClick={() => void gerarJingleDJ()}
              style={{
                width: '100%',
                minHeight: '58px',
                padding: '15px',
                borderRadius: '14px',
                border: '1px solid #facc15',
                background: gerandoDJ ? '#51445c' : 'linear-gradient(90deg, #8b2be2, #6420a0)',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 900,
                cursor: gerandoDJ ? 'wait' : 'pointer',
                opacity: gerandoDJ ? 0.75 : 1,
              }}
            >
              {gerandoDJ ? 'GERANDO SUA VINHETA...' : '🎙️ GERAR VINHETA · 2 CRÉDITOS'}
            </button>

            {audioDJUrl && (
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(250,204,21,0.5)',
                background: '#130e19',
              }}>
                <div style={{ color: '#facc15', fontWeight: 800, marginBottom: '12px' }}>
                  Sua vinheta está pronta!
                </div>
                <audio controls src={audioDJUrl} style={{ width: '100%' }} />
                <a
                  href={audioDJUrl}
                  download="vinheta-dj-express.mp3"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginTop: '14px',
                    padding: '13px',
                    borderRadius: '12px',
                    background: '#facc15',
                    color: '#21132f',
                    textDecoration: 'none',
                    fontWeight: 900,
                  }}
                >
                  ⬇ Baixar MP3
                </a>
              </div>
            )}

            <div style={{
              textAlign: 'center',
              color: '#c4b5d0',
              fontSize: '13px',
              lineHeight: 1.6,
            }}>
              Efeitos de voz exclusivos. Não inclui trilha musical.
              <br />
              Saldo disponível: {creditos === null ? '...' : creditos} créditos.
            </div>
          </div>
        </div>
      </div>
    )
  }
  // =====================================================
  // =====================================================
  // FABRICA_STUDIO_TELA
  if (mostrarFabricaStudio) {
    return (
      <div style={{ minHeight: '100vh', padding: '32px 20px 48px', boxSizing: 'border-box', background: 'radial-gradient(ellipse at top, #28113b 0%, #100b16 42%, #08080c 100%)', color: '#fff' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <button type="button" onClick={() => setMostrarFabricaStudio(false)} style={{ border: '1px solid rgba(216,180,254,0.35)', borderRadius: '12px', padding: '10px 15px', color: '#e9d5ff', background: '#21152c', cursor: 'pointer', marginBottom: '22px', fontWeight: 700 }}>
            Voltar ao menu
          </button>
<h1 style={{ color: '#fff', fontSize: 'clamp(32px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '8px', textShadow: '0 0 28px rgba(168,85,247,0.28)' }}>FÁBRICA <span style={{ color: '#d8b4fe' }}>STUDIO</span></h1>
          <p style={{ color: '#e9d5ff', marginTop: 0 }}>Seu estúdio de áudio online</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px', marginTop: '32px' }}>
            <section style={{ border: '1px solid rgba(192,132,252,0.20)', borderRadius: '16px', padding: '24px', background: 'linear-gradient(145deg, rgba(31,22,43,0.98), rgba(18,14,25,0.98))', boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
              <h2 style={{ color: '#facc15', fontSize: '20px' }}>1. Sua locução</h2>
              <p style={{ color: '#e9d5ff', lineHeight: 1.5 }}>Escolha a gravação de voz no seu computador.</p>
              <input type="file" accept="audio/*" onChange={(e) => {
                const arquivo = e.target.files?.[0] || null;
                setStudioVozArquivo(arquivo);
                const audio = document.getElementById('studio-locucao') as HTMLAudioElement | null;
                if (audio) {
                  audio.src = arquivo ? URL.createObjectURL(arquivo) : '';
                  audio.load();
                }
              }} style={{ width: '100%', color: '#fff', margin: '10px 0' }} />
              <audio id="studio-locucao" controls style={{ width: '100%', marginTop: '10px' }} />
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', border: '1px solid rgba(250,204,21,0.35)', background: 'rgba(15,10,22,0.65)' }}>
                <h3 style={{ color: '#facc15', margin: '0 0 10px', fontSize: '16px' }}>Reverb da voz</h3>
                <label style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <input type="checkbox" checked={studioReverbAtivo} onChange={(e) => setStudioReverbAtivo(e.target.checked)} />
                  Ativar reverb somente na locução
                </label>
                <label htmlFor="studio-reverb-volume">Intensidade: {studioVolumeReverb}%</label>
                <input id="studio-reverb-volume" type="range" min="0" max="100" value={studioVolumeReverb} onChange={(e) => setStudioVolumeReverb(Number(e.target.value))} style={{ display: 'block', width: '100%', marginTop: '10px' }} />
              </div>
            </section>

            <section style={{ border: '1px solid rgba(192,132,252,0.20)', borderRadius: '16px', padding: '24px', background: 'linear-gradient(145deg, rgba(31,22,43,0.98), rgba(18,14,25,0.98))', boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
              <h2 style={{ color: '#facc15', fontSize: '20px' }}>2. Trilha musical</h2>
              <label htmlFor="studio-estilo-trilha" style={{ display: 'block', color: '#e9d5ff', margin: '12px 0 6px' }}>Categoria da trilha</label>
              <select id="studio-estilo-trilha" value={studioEstiloTrilha} onChange={(e) => { setStudioEstiloTrilha(e.target.value); setStudioTrilhaSelecionada(''); setStudioTrilhaArquivo(null); }} style={{ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '12px', background: '#171020', color: '#fff' }}>
                {estilosDeTrilha.map((estilo) => <option key={estilo.valor} value={estilo.valor}>{estilo.nome}</option>)}
              </select>
              <label htmlFor="studio-trilha-pronta" style={{ display: 'block', color: '#e9d5ff', margin: '8px 0 6px' }}>Trilha da biblioteca</label>
              <select id="studio-trilha-pronta" value={studioTrilhaSelecionada} onChange={(e) => { const caminho = e.target.value; setStudioTrilhaSelecionada(caminho); setStudioTrilhaArquivo(null); const audio = document.getElementById('studio-trilha') as HTMLAudioElement | null; if (audio) { audio.src = caminho ? encodeURI(caminho) : ''; audio.load(); } }} style={{ width: '100%', padding: '12px', borderRadius: '10px', marginBottom: '12px', background: '#171020', color: '#fff' }}>
                <option value="">Usar arquivo do computador</option>
                {trilhasPorEstilo[studioEstiloTrilha as keyof typeof trilhasPorEstilo].map((trilha) => <option key={trilha.arquivo} value={trilha.arquivo}>{trilha.nome}</option>)}
              </select>
              <p style={{ color: '#e9d5ff', lineHeight: 1.5 }}>Escolha a música de fundo para acompanhar sua locução.</p>
              <input type="file" accept="audio/*" onChange={(e) => {
                const arquivo = e.target.files?.[0] || null;
                setStudioTrilhaArquivo(arquivo);
                const audio = document.getElementById('studio-trilha') as HTMLAudioElement | null;
                if (audio) {
                  audio.src = arquivo ? URL.createObjectURL(arquivo) : '';
                  audio.load();
                }
              }} style={{ width: '100%', color: '#fff', margin: '10px 0' }} />
              <audio id="studio-trilha" controls style={{ width: '100%', marginTop: '10px' }} />
              <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', border: '1px solid rgba(250,204,21,0.3)', background: 'rgba(15,10,22,0.65)' }}>
                <label htmlFor="studio-ponto-trilha" style={{ display: 'block', color: '#facc15', fontWeight: 700 }}>Ponto inicial da trilha (segundos)</label>
                <p style={{ color: '#e9d5ff', fontSize: '13px', margin: '6px 0 10px' }}>Escolha de qual segundo da música a mixagem deve começar.</p>
                <input id="studio-ponto-trilha" type="number" min="0" max="3600" step="1" value={studioPontoTrilha} onChange={(e) => setStudioPontoTrilha(Math.max(0, Number(e.target.value) || 0))} style={{ display: 'block', width: '100%', padding: '10px', borderRadius: '8px', background: '#171020', color: '#fff', border: '1px solid rgba(216,180,254,0.35)', boxSizing: 'border-box' }} />
              </div>
            </section>
          </div>

          <section style={{ border: '1px solid rgba(216,180,254,0.25)', borderRadius: '18px', padding: '22px', marginTop: '18px', background: 'rgba(48,33,61,0.72)' }}>
            <h2 style={{ color: '#facc15', fontSize: '20px' }}>3. Ajustes da mixagem</h2>
            <label htmlFor="studio-volume-voz">Volume da locução: {studioVolumeVoz}%</label>
            <input id="studio-volume-voz" type="range" min="0" max="150" value={studioVolumeVoz} onChange={(e) => {
              const valor = Number(e.target.value);
              setStudioVolumeVoz(valor);
              const audio = document.getElementById('studio-locucao') as HTMLAudioElement | null;
              if (audio) audio.volume = Math.min(1, valor / 100);
            }} style={{ display: 'block', width: '100%', margin: '10px 0 20px' }} />

            <label htmlFor="studio-volume-trilha">Volume da trilha: {studioVolumeTrilha}%</label>
            <input id="studio-volume-trilha" type="range" min="0" max="200" value={studioVolumeTrilha} onChange={(e) => {
              const valor = Number(e.target.value);
              setStudioVolumeTrilha(valor);
              const audio = document.getElementById('studio-trilha') as HTMLAudioElement | null;
              if (audio) audio.volume = Math.min(1, valor / 100);
            }} style={{ display: 'block', width: '100%', margin: '10px 0 20px' }} />

            <label htmlFor="studio-atraso-voz">Segundos de musica antes da voz: {studioAtrasoVoz}s</label>
            <input id="studio-atraso-voz" type="range" min="0" max="30" value={studioAtrasoVoz} onChange={(e) => setStudioAtrasoVoz(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '10px 0 20px' }} />
            <label htmlFor="studio-segundos-finais">Segundos de música após a voz: {studioSegundosFinais}s</label>
            <input id="studio-segundos-finais" type="range" min="0" max="60" value={studioSegundosFinais} onChange={(e) => setStudioSegundosFinais(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '10px 0 20px' }} />
            <div style={{ borderTop: '1px solid rgba(216,180,254,0.25)', marginTop: '20px', paddingTop: '18px' }}>

              <h3 style={{ color: '#facc15' }}>Efeitos sonoros</h3>
              <label htmlFor="studio-efeito1">Primeiro efeito</label>
              <select id="studio-efeito1" value={studioEfeito1} onChange={(e) => setStudioEfeito1(e.target.value)} style={{ display: 'block', width: '100%', padding: '12px', margin: '8px 0 14px', background: '#171020', color: '#fff', borderRadius: '10px' }}>
                <option value="">Nenhum efeito</option>
                <option value="/efeitos/Laser.mp3">Laser</option>
                <option value="/efeitos/Impacto.mp3">Impacto</option>
                <option value="/efeitos/Transmiss%C3%A3o.mp3">Transmissão</option>
                <option value="/efeitos/Buzina.mp3">Buzina</option>
                <option value="/efeitos/WhatsApp.mp3">WhatsApp</option>
                <option value="/efeitos/Assobio.mp3">Assobio</option>
                <option value="/efeitos/Buzina carro.wav">Buzina de carro</option>
                <option value="/efeitos/Liquido no copo.mp3">Líquido no copo</option>
                <option value="/efeitos/Motor.wav">Motor</option>
                <option value="/efeitos/Telefone.mp3">Telefone</option>
              </select>
              <label htmlFor="studio-efeito1-volume">Volume do primeiro efeito: {studioVolumeEfeito1}%</label>
              <input id="studio-efeito1-volume" type="range" min="0" max="100" value={studioVolumeEfeito1} onChange={(e) => setStudioVolumeEfeito1(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '8px 0 14px' }} />
              <label htmlFor="studio-efeito1-posicao">Posição do primeiro efeito: {studioPosicaoEfeito1.toFixed(1)}s</label>
              <input id="studio-efeito1-posicao" type="range" min="0" max="60" step="0.1" value={studioPosicaoEfeito1} onChange={(e) => setStudioPosicaoEfeito1(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '8px 0 18px' }} />

              <label htmlFor="studio-efeito2">Segundo efeito (opcional)</label>
              <select id="studio-efeito2" value={studioEfeito2} onChange={(e) => setStudioEfeito2(e.target.value)} style={{ display: 'block', width: '100%', padding: '12px', margin: '8px 0 14px', background: '#171020', color: '#fff', borderRadius: '10px' }}>
                <option value="">Nenhum efeito</option>
                <option value="/efeitos/Laser.mp3">Laser</option>
                <option value="/efeitos/Impacto.mp3">Impacto</option>
                <option value="/efeitos/Transmiss%C3%A3o.mp3">Transmissão</option>
                <option value="/efeitos/Buzina.mp3">Buzina</option>
                <option value="/efeitos/WhatsApp.mp3">WhatsApp</option>
                <option value="/efeitos/Assobio.mp3">Assobio</option>
                <option value="/efeitos/Buzina carro.wav">Buzina de carro</option>
                <option value="/efeitos/Liquido no copo.mp3">Líquido no copo</option>
                <option value="/efeitos/Motor.wav">Motor</option>
                <option value="/efeitos/Telefone.mp3">Telefone</option>
              </select>
              <label htmlFor="studio-efeito2-volume">Volume do segundo efeito: {studioVolumeEfeito2}%</label>
              <input id="studio-efeito2-volume" type="range" min="0" max="100" value={studioVolumeEfeito2} onChange={(e) => setStudioVolumeEfeito2(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '8px 0 14px' }} />
              <label htmlFor="studio-efeito2-posicao">Posição do segundo efeito: {studioPosicaoEfeito2.toFixed(1)}s</label>
              <input id="studio-efeito2-posicao" type="range" min="0" max="60" step="0.1" value={studioPosicaoEfeito2} onChange={(e) => setStudioPosicaoEfeito2(Number(e.target.value))} style={{ display: 'block', width: '100%', margin: '8px 0 18px' }} />
            </div>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '12px 0 20px' }}>
              <input type="checkbox" checked={studioDucking} onChange={(e) => setStudioDucking(e.target.checked)} />
              Reduzir a trilha automaticamente durante a locução
            </label>

            <button type="button" disabled={studioMixando || !studioVozArquivo || (!studioTrilhaArquivo && !studioTrilhaSelecionada)} onClick={() => void mixarFabricaStudio()} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #facc15', background: studioMixando ? '#51445c' : 'linear-gradient(90deg, #8b2be2, #6420a0)', color: '#fff', fontSize: '17px', fontWeight: 900, cursor: studioMixando ? 'wait' : 'pointer', opacity: studioMixando ? 0.7 : 1 }}>
              {studioMixando ? 'MIXANDO OS ÁUDIOS...' : 'MIXAR E GERAR MP3'}
            </button>
          </section>

          {studioMixAudioUrl && (
            <section style={{ border: '1px solid rgba(250,204,21,0.5)', borderRadius: '18px', padding: '22px', marginTop: '18px', background: 'rgba(48,33,61,0.72)' }}>
              <h2 style={{ color: '#facc15', fontSize: '20px' }}>Mixagem pronta</h2>
              <audio controls src={studioMixAudioUrl} style={{ width: '100%' }} />
              <a href={studioMixAudioUrl} download="fabrica-studio-mixagem.mp3" style={{ display: 'block', textAlign: 'center', marginTop: '14px', padding: '14px', borderRadius: '12px', background: '#facc15', color: '#21132f', textDecoration: 'none', fontWeight: 900 }}>
                Baixar MP3
              </a>
            </section>
          )}
          <p style={{ color: '#c4b5d0', marginTop: '24px', lineHeight: 1.6 }}>
            A trilha fica em volume reduzido durante toda a locução e volta ao volume escolhido quando a voz termina.
          </p>
        </div>
      </div>
    );
  }
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
  <h2>Crie locuções profissionais com IA</h2>
  <p>Transforme seu texto em áudio em segundos</p>
</section>

          <section className="editor-area">

            <div className="editor">

              <h3>
                Crie seu áudio
              </h3>


<div style={{
  margin: '8px 0 24px',
  padding: '22px',
  borderRadius: '28px',
  background: '#100819',
  border: '1px solid rgba(192,132,252,0.22)',
  color: '#fff',
  boxSizing: 'border-box',
  width: '100%',
  boxShadow: '0 12px 35px rgba(0,0,0,0.25)'
}}>
  <div style={{
    padding: '24px',
    borderRadius: '30px',
    background: '#211431',
    border: '1px solid rgba(192,132,252,0.35)',
    boxSizing: 'border-box'
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      paddingBottom: '26px',
      borderBottom: '1px solid rgba(216,180,254,0.22)'
    }}>
      <div style={{
        width: '76px',
        height: '76px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '22px',
        background: '#38234b',
        color: '#facc15',
        fontSize: '36px'
      }}>&#128188;</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: '18px', color: '#d8b4fe', marginBottom: '4px'}}>Seus créditos</div>
        <div style={{fontSize: 'clamp(22px, 5vw, 40px)', fontWeight: 800, lineHeight: 1.15, whiteSpace: 'nowrap', overflowWrap: 'normal'}}>
          {creditos === null ? '...' : creditos} créditos
        </div>
      </div>
      <button type="button" onClick={() => void carregarCreditos()} disabled={carregandoCreditos} title="Atualizar saldo de créditos" style={{
        border: 0, background: 'transparent', color: '#d8b4fe',
        fontSize: '30px', padding: '8px', cursor: carregandoCreditos ? 'wait' : 'pointer'
      }}>{carregandoCreditos ? '...' : '↻'}</button>
    </div>


    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      marginTop: '24px', marginBottom: '22px'
    }}>

      <button type="button" onClick={() => { setMostrarEditor(true); window.setTimeout(() => document.querySelector('.vozes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #a855f7',
        background: 'linear-gradient(145deg, #21102e, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#127916;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>Criar Vinhetas e Spots</span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}></span>
        </span>

      </button>

      <button type="button" onClick={() => { window.open('https://www.fabricadavozstudio.com.br/central-demonstrativos', '_blank', 'noopener,noreferrer'); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #7c3aed',
        background: 'linear-gradient(145deg, #160d20, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#127908;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>Central de Vozes</span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}>Conhe&#231;a e teste nossos locutores.</span>
        </span>

      </button>

      <button type="button" onClick={() => { setMostrarHistorico(true); void carregarHistorico(); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #7c3aed',
        background: 'linear-gradient(145deg, #160d20, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#128340;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>Hist&#243;rico</span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}>Seus &#225;udios recentes.</span>
        </span>

      </button>

      <button type="button" onClick={() => { setMostrarFabricaStudio(true); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #7c3aed',
        background: 'linear-gradient(145deg, #160d20, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#127925;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>F&#225;brica Studio<span style={{background: "#f5c542", color: "#211333", fontSize: "11px", fontWeight: 900, padding: "4px 7px", borderRadius: "8px", marginLeft: "8px"}}>NOVO</span></span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}>Mixagem, trilhas e efeitos.</span>
        </span>

      </button>

      <button type="button" onClick={() => { setMostrarDJExpress(true); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #a855f7',
        background: 'linear-gradient(145deg, #21102e, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#127911;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>DJ Express<span style={{background: "#f5c542", color: "#211333", fontSize: "11px", fontWeight: 900, padding: "4px 7px", borderRadius: "8px", marginLeft: "8px"}}>NOVO</span></span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}>Vinhetas de DJ com efeitos.</span>
        </span>

      </button>

      <button type="button" onClick={() => { setMostrarCompraCreditos(true); }} style={{
        width: '100%', minWidth: 0, height: '88px', minHeight: '88px', maxHeight: '88px', padding: '12px 14px',
        boxSizing: 'border-box', borderRadius: '17px',
        border: '1px solid #7c3aed',
        background: 'linear-gradient(145deg, #160d20, #09070d)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        justifyContent: 'flex-start', gap: '14px', textAlign: 'left'
      }}>
        <span style={{
          width: '46px', height: '46px', flex: '0 0 46px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '13px', background: '#291536',
          color: '#f5c542', fontSize: '24px'
        }}>&#128722;</span>
        <span style={{flex: 1, minWidth: 0, display: 'block'}}>
          <span style={{display: 'block', fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2}}>Comprar cr&#233;ditos</span>
          <span style={{display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 400, color: '#d4c5df', lineHeight: 1.4}}>Adicione cr&#233;ditos &#224; sua conta.</span>
        </span>

      </button>




    </div>

    <div style={{display: 'flex', justifyContent: 'center', paddingTop: '22px'}}>
      <button type="button" onClick={() => void sairDaFabrica()} style={{
        padding: '10px 18px', border: 0, background: 'transparent',
        color: '#bbaec8', fontSize: '17px', cursor: 'pointer'
      }}>Sair da conta</button>
    </div>
  </div>
</div>

                            {/* =================================================
                  VOZES
              ================================================= */}

              {mostrarEditor && (<>

<div style={{ display: "flex", justifyContent: "flex-start", margin: "0 0 18px" }}>
  <button
    type="button"
    onClick={() => setMostrarEditor(false)}
    style={{
      background: "#211333",
      color: "#e4c8ff",
      border: "1px solid #8b5cf6",
      borderRadius: "10px",
      padding: "10px 18px",
      cursor: "pointer",
      fontWeight: 600
    }}
  >
    &#8592; Voltar ao menu
  </button>
</div>
<div className="vozes vozes-compactas">
                <label htmlFor="seletorLocutor">Escolha o locutor</label>

                <select
                  id="seletorLocutor"
                  className="seletor-locutor-compacto"
                  value={vozSelecionada}
                  onChange={(e) => setVozSelecionada(e.target.value)}
                >
                  <optgroup label="Masculino">
                    {vozesMasculinas.map((voz) => (
                      <option key={voz.id} value={voz.id}>
                        {voz.nome}{voz.especialidade ? " - " + voz.especialidade : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Feminino">
                    {vozesFemininas.map((voz) => (
                      <option key={voz.id} value={voz.id}>
                        {voz.nome}{voz.especialidade ? " - " + voz.especialidade : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Infantil">
                    {vozesInfantis.map((voz) => (
                      <option key={voz.id} value={voz.id}>
                        {voz.nome}{voz.especialidade ? " - " + voz.especialidade : ""}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <div className="voz-demo-compacto">
                  <div className="voz-demo-identificacao">
                    <img src={vozAtual.foto} alt={vozAtual.nome} />
                    <div className="voz-demo-nome">
                      <strong>{vozAtual.nome}</strong>
                      {vozAtual.especialidade && (
                        <small className="voz-especialidade">
                          {vozAtual.especialidade}
                        </small>
                      )}
                    </div>
                  </div>
                  <audio
                    className="audio-demo-compacto"
                    controls
                    preload="metadata"
                    src={vozAtual.demonstrativo}
                  />
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

                  <option value="aoVivoLoja">
                    Ao Vivo &#8212; Loja e Ofertas
                  </option>
</select>

                {estiloSelecionado === 'aoVivoLoja' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(234, 179, 8, 0.45)',
                    background: 'rgba(139, 92, 246, 0.12)',
                    color: '#f3e8ff',
                    fontSize: '14px',
                    lineHeight: 1.6
                  }}>
                    <div style={{
                      color: '#facc15',
                      fontWeight: 800,
                      marginBottom: '6px'
                    }}>
                      LOCAÇÃO DE LOJA E OFERTAS
                    </div>
                    Ideal para supermercados, lojas, feirões, queimas de estoque e promoções. Voz animada com efeito de reverberação para dar sensação de anúncio no microfone da loja.
                    <div style={{
                      marginTop: '8px',
                      color: '#d8b4fe',
                      fontWeight: 700
                    }}>
                      Disponível com Celso, Henrique e Gustavo.
                    </div>
                    {!['Celso', 'Henrique', 'Gustavo'].includes(vozAtual.nome) && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(250, 204, 21, 0.12)',
                        border: '1px solid rgba(250, 204, 21, 0.6)',
                        color: '#facc15',
                        fontWeight: 700
                      }}>
                        Atenção: para usar este estilo, selecione o locutor Celso, Henrique ou Gustavo.
                      </div>
                    )}
                  </div>
                )}



              </div>
              {/* TEXTO */}

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
                border: '1px solid rgba(250, 204, 21, 0.45)',
background: 'rgba(245, 158, 11, 0.08)',
color: '#f3f3f3',
boxShadow: 'none',
lineHeight: 1.45,
fontSize: '12px',
fontWeight: 400
              }}>
                <div style={{ fontSize: '13px', marginBottom: '5px', color: '#facc15', fontWeight: 700 }}>
                  ⚠️ ATENÇÃO
                </div>
                <div>
                  Não nos responsabilizamos por erros de escrita do usuário,
                  corrigiremos apenas erros de pronúncia ou devaneios da IA.
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

                    <button
                      type="button"
                      className="botao-download"
                      disabled={baixandoAudio}
                      onClick={() => {
                        setBaixandoAudio(true)
                        const link = document.createElement('a')
                        link.href = audioUrl
                        link.download = 'fabrica-da-voz.mp3'
                        document.body.appendChild(link)
                        link.click()
                        link.remove()
                        window.setTimeout(() => setBaixandoAudio(false), 1500)
                      }}
                    >
                      {baixandoAudio ? 'Preparando download...' : 'Baixar audio'}
                    </button>

                    <button
                      type="button"
                      className="botao-trilha"
                      style={{ background: 'linear-gradient(135deg, #6d28d9, #4c1d95)', border: '1px solid #a855f7' }}
                      disabled={gerando || regeneracoes <= 0 || !ultimaGeracao}
                      onClick={() => void regenerarVoz()}
                      title={"Regeneracoes disponiveis: " + regeneracoes}
                    >
                      {gerando ? 'Regenerando...' : 'Regenerar voz (' + regeneracoes + ')'}
                    </button>

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
                            max="200"
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
                            background: 'rgba(245, 158, 11, 0.08)',
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
                          {reverbAtivo && (
                            <div
                              style={{
                                marginTop: '12px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: 'rgba(139,92,246,0.08)',
                                border: '1px solid rgba(139,92,246,0.18)'
                              }}
                            >
                              <div
                                style={{
                                  color: '#ffffff',
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  marginBottom: '7px'
                                }}
                              >
                                🔊 Volume do Reverb: {volumeReverb}%
                              </div>

                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={volumeReverb}
                                onChange={(e) =>
                                  setVolumeReverb(Number(e.target.value))
                                }
                                style={{
                                  width: '100%',
                                  accentColor: '#a855f7',
                                  cursor: 'pointer'
                                }}
                              />
                            </div>
                          )}

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
                              <option value="/efeitos/Assobio.mp3">Assobio</option>
                              <option value="/efeitos/Buzina carro.wav">Buzina de carro</option>
                              <option value="/efeitos/Liquido no copo.mp3">Liquido no copo</option>
                              <option value="/efeitos/Motor.wav">Motor</option>
                              <option value="/efeitos/Telefone.mp3">Telefone</option>
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
                                <option value="/efeitos/Assobio.mp3">Assobio</option>
                                <option value="/efeitos/Buzina carro.wav">Buzina de carro</option>
                                <option value="/efeitos/Liquido no copo.mp3">Liquido no copo</option>
                                <option value="/efeitos/Motor.wav">Motor</option>
                                <option value="/efeitos/Telefone.mp3">Telefone</option>
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

                          <button
                            type="button"
                            className="botao-download-mixagem"
                            disabled={baixandoMixagem}
                            onClick={() => {
                              setBaixandoMixagem(true)
                              const link = document.createElement('a')
                              link.href = mixAudioUrl
                              link.download = 'fabrica-da-voz-mixagem.mp3'
                              document.body.appendChild(link)
                              link.click()
                              link.remove()
                              window.setTimeout(() => setBaixandoMixagem(false), 1500)
                            }}
                          >
                            {baixandoMixagem ? 'Preparando download...' : 'Baixar mixagem'}
                          </button>

                          <button
                            type="button"
                            className="botao-trilha"
                            onClick={masterizarAudio}
                            disabled={masterizando}
                            style={{ width: "100%", marginTop: "12px" }}
                          >
                            {masterizando
                              ? "Masterizando áudio..."
                              : "Masterizar áudio"}
                          </button>

                          {audioMasterizadoUrl && (
                            <div style={{ marginTop: "18px" }}>
                              <div className="titulo-previa">
                                Áudio masterizado
                              </div>
                              <audio
                                className="player-audio"
                                controls
                                src={audioMasterizadoUrl}
                              />
                              <button
                                type="button"
                                className="botao-download-mixagem"
                                disabled={baixandoMasterizado}
                                onClick={() => {
                                  setBaixandoMasterizado(true)
                                  const link = document.createElement('a')
                                  link.href = audioMasterizadoUrl
                                  link.download = 'fabrica-da-voz-masterizado.mp3'
                                  document.body.appendChild(link)
                                  link.click()
                                  link.remove()
                                  window.setTimeout(() => setBaixandoMasterizado(false), 1500)
                                }}
                              >
                                {baixandoMasterizado ? 'Preparando download...' : 'Baixar audio masterizado'}
                              </button>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  )}

                </div>
              )}



              </>)}

          </div>

          </section>

        </main>

      </div>
    )
  }

}

export default App




