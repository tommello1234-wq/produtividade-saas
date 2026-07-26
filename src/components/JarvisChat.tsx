import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse, LiveServerMessage, Modality } from '@google/genai';
import { Send, Bot, X, Loader2, Maximize2, Minimize2, ImagePlus, Mic, MicOff, AudioLines } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { AudioRecorder, AudioPlayer } from '../lib/audioUtils';

export function JarvisChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Olá! Eu sou o Jarvis, seu assistente pessoal. Como posso ajudar com suas tarefas, finanças ou hábitos hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const chatRef = useRef<any>(null);
  const sessionPromiseRef = useRef<any>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const recognitionRef = useRef<any>(null);

  const getTools = () => {
    const getProfileDeclaration: FunctionDeclaration = {
      name: 'get_profile',
      description: 'Retorna o perfil do usuário, incluindo XP total e nível.'
    };

    const getTasksDeclaration: FunctionDeclaration = {
      name: 'get_tasks',
      description: 'Retorna a lista atual de todas as tarefas de trabalho.'
    };

    const createTaskDeclaration: FunctionDeclaration = {
      name: 'create_task',
      description: 'Cria uma nova tarefa de trabalho.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Título da tarefa' },
          description: { type: Type.STRING, description: 'Descrição da tarefa' },
          priority: { type: Type.STRING, description: 'Prioridade: "low", "medium", ou "high"' },
          deadline: { type: Type.STRING, description: 'Data limite no formato YYYY-MM-DD' },
          responsible: { type: Type.STRING, description: 'Nome do responsável' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Lista de tags' },
          xp_reward: { type: Type.NUMBER, description: 'Recompensa em XP (padrão: 10 para low, 20 para medium, 30 para high)' }
        },
        required: ['title', 'priority']
      }
    };

    const updateTaskDeclaration: FunctionDeclaration = {
      name: 'update_task',
      description: 'Atualiza uma tarefa de trabalho existente.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'ID da tarefa' },
          title: { type: Type.STRING, description: 'Novo título' },
          description: { type: Type.STRING, description: 'Nova descrição' },
          priority: { type: Type.STRING, description: 'Nova prioridade: "low", "medium", ou "high"' },
          status: { type: Type.STRING, description: 'Novo status: "backlog", "doing", ou "done"' },
          deadline: { type: Type.STRING, description: 'Nova data limite no formato YYYY-MM-DD' },
          responsible: { type: Type.STRING, description: 'Novo responsável' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Nova lista de tags' },
          xp_reward: { type: Type.NUMBER, description: 'Nova recompensa em XP' }
        },
        required: ['id']
      }
    };

    const deleteTaskDeclaration: FunctionDeclaration = {
      name: 'delete_task',
      description: 'Remove uma tarefa de trabalho existente.',
      parameters: {
        type: Type.OBJECT,
        properties: { id: { type: Type.STRING, description: 'ID da tarefa' } },
        required: ['id']
      }
    };

    const getTransactionsDeclaration: FunctionDeclaration = {
      name: 'get_transactions',
      description: 'Retorna a lista de transações financeiras (receitas e despesas).'
    };

    const createTransactionDeclaration: FunctionDeclaration = {
      name: 'create_transaction',
      description: 'Cria uma nova transação financeira.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: 'Descrição da transação' },
          category: { type: Type.STRING, description: 'Categoria (ex: Alimentação, Salário)' },
          amount: { type: Type.NUMBER, description: 'Valor (positivo para receita, negativo para despesa)' },
          type: { type: Type.STRING, description: '"income" para receita, "expense" para despesa' },
          date: { type: Type.STRING, description: 'Data no formato YYYY-MM-DD' }
        },
        required: ['description', 'category', 'amount', 'type', 'date']
      }
    };

    const getAssetsDeclaration: FunctionDeclaration = {
      name: 'get_assets',
      description: 'Retorna a lista de ativos financeiros (investimentos).'
    };

    const getHabitsDeclaration: FunctionDeclaration = {
      name: 'get_habits',
      description: 'Retorna a lista de hábitos do usuário.'
    };

    const getAcademyDataDeclaration: FunctionDeclaration = {
      name: 'get_academy_data',
      description: 'Retorna os dados da aba Academy (cursos, módulos, aulas, checks).'
    };

    const updateAcademyDataDeclaration: FunctionDeclaration = {
      name: 'update_academy_data',
      description: 'Atualiza os dados da aba Academy. Você deve passar o objeto JSON completo com a nova estrutura. O objeto deve ter a forma { nodes: AcademyNode[], globalChecks: GlobalCheck[] }. AcademyNode: { id: string, title: string, parentId: string | null, isExpanded: boolean, columns: Column[] }. Column: { id: string, title: string, cards: Card[] }. Card: { id: string, title: string, description?: string, link?: string, checks?: Record<string, boolean> }. GlobalCheck: { id: string, label: string, color: string }.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          data: { type: Type.OBJECT, description: 'O objeto JSON completo com a nova estrutura da Academy (nodes e globalChecks)' }
        },
        required: ['data']
      }
    };

    return [
      getProfileDeclaration,
      getTasksDeclaration, createTaskDeclaration, updateTaskDeclaration, deleteTaskDeclaration,
      getTransactionsDeclaration, createTransactionDeclaration,
      getAssetsDeclaration,
      getHabitsDeclaration,
      getAcademyDataDeclaration, updateAcademyDataDeclaration
    ];
  };

  const systemInstruction = `Você é o Jarvis, um assistente pessoal geral focado em produtividade, finanças e desenvolvimento pessoal.
Você tem acesso a todos os dados do perfil do usuário: tarefas, finanças (transações e investimentos), hábitos, perfil geral e dados da Academy (cursos, aulas, checks).
A data e hora atual é: ${new Date().toLocaleString('pt-BR')}.
Seja conciso, direto e prestativo.
Você pode criar, atualizar e deletar tarefas e transações. Para outras áreas, você pode consultar e dar dicas.
Se o usuário enviar uma imagem de um curso ou estrutura de aulas, você pode usar a ferramenta update_academy_data para adicionar esses cursos à Academy dele. Primeiro chame get_academy_data para ver a estrutura atual, depois chame update_academy_data com a estrutura atualizada (MANTENHA OS DADOS ANTIGOS E APENAS ADICIONE OS NOVOS). GERE IDs ÚNICOS PARA TODOS OS NOVOS NODES, COLUMNS E CARDS (ex: node_123, col_456, card_789).
Sempre que o usuário pedir para criar, atualizar ou remover algo, use a ferramenta apropriada.
Se precisar do ID de algo para atualizar ou deletar, chame a função de "get" apropriada primeiro.
Dê dicas proativas baseadas nos dados do usuário quando apropriado.`;

  useEffect(() => {
    if (!chatRef.current) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('GEMINI_API_KEY is not defined');
        setMessages([{ role: 'model', text: 'Erro: GEMINI_API_KEY não configurada. O Jarvis não pode funcionar sem ela.' }]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      aiRef.current = ai;
      
      chatRef.current = ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: getTools() }]
        }
      });
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'pt-BR';

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInput(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsDictating(false);
        };

        recognitionRef.current.onend = () => {
          setIsDictating(false);
        };
      }
    }
  }, []);

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsDictating(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        alert("Reconhecimento de voz não suportado neste navegador.");
      }
    }
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      audioRecorderRef.current?.stop();
      audioPlayerRef.current?.stop();
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((session: any) => session.close());
        sessionPromiseRef.current = null;
      }
      setIsVoiceMode(false);
      setMessages(prev => [...prev, { role: 'model', text: 'Modo de voz desativado.' }]);
      return;
    }

    setIsVoiceMode(true);
    setMessages(prev => [...prev, { role: 'model', text: 'Modo de voz ativado. Pode falar!' }]);

    if (!aiRef.current) {
      setMessages(prev => [...prev, { role: 'model', text: 'Erro: Jarvis não inicializado.' }]);
      setIsVoiceMode(false);
      return;
    }

    audioRecorderRef.current = new AudioRecorder();
    audioPlayerRef.current = new AudioPlayer();
    audioPlayerRef.current.init();

    const { data: { user } } = await supabase.auth.getUser();

    sessionPromiseRef.current = aiRef.current.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      callbacks: {
        onopen: () => {
          audioRecorderRef.current?.start((base64Data) => {
            sessionPromiseRef.current?.then((session: any) => {
              session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            });
          }).catch((err) => {
            console.error("Microphone access denied or failed:", err);
            setMessages(prev => [...prev, { role: 'model', text: 'Erro ao acessar o microfone. Verifique as permissões.' }]);
            audioRecorderRef.current?.stop();
            audioPlayerRef.current?.stop();
            if (sessionPromiseRef.current) {
              sessionPromiseRef.current.then((session: any) => session.close());
              sessionPromiseRef.current = null;
            }
            setIsVoiceMode(false);
          });
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData && part.inlineData.data) {
                audioPlayerRef.current?.playBase64(part.inlineData.data);
              }
              if (part.text) {
                console.log("Jarvis (voz):", part.text);
              }
            }
          }
          if (message.serverContent?.interrupted) {
            audioPlayerRef.current?.clearQueue();
          }
          if (message.toolCall) {
            const functionResponses = [];
            for (const call of message.toolCall.functionCalls) {
              const { name, args, id } = call;
              const result = await executeTool(name, args, user);
              functionResponses.push({
                id: id,
                name: name,
                response: result
              });
            }
            sessionPromiseRef.current?.then((session: any) => {
              session.sendToolResponse({ functionResponses });
            });
          }
        },
        onerror: (error: any) => {
          console.error("Live API error:", error);
          setMessages(prev => [...prev, { role: 'model', text: 'Erro na conexão de voz.' }]);
          setIsVoiceMode(false);
        },
        onclose: () => {
          console.log("Live API connection closed");
          setIsVoiceMode(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction,
        tools: [{ functionDeclarations: getTools() }]
      },
    });
  };

  const executeTool = async (name: string, args: any, user: any) => {
    let result: any = {};
    try {
      if (!user) {
        result = { status: 'error', message: 'Modo Teste ativo. O Jarvis não pode acessar ou modificar o banco de dados sem login.' };
      } else if (name === 'get_profile') {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        result = { status: 'success', profile: data };
      } else if (name === 'get_tasks') {
        const { data } = await supabase.from('work_tasks').select('*').eq('user_id', user.id);
        result = { status: 'success', tasks: data };
      } else if (name === 'create_task') {
        const { data, error } = await supabase.from('work_tasks').insert([{ user_id: user.id, ...args as any, status: 'backlog' }]).select();
        if (error) throw error;
        result = { status: 'success', message: 'Tarefa criada com sucesso.', task: data[0] };
        window.dispatchEvent(new Event('app_data_changed'));
      } else if (name === 'update_task') {
        const { id, ...updates } = args as any;
        const { error } = await supabase.from('work_tasks').update(updates).eq('id', id).eq('user_id', user.id);
        if (error) throw error;
        result = { status: 'success', message: 'Tarefa atualizada com sucesso.' };
        window.dispatchEvent(new Event('app_data_changed'));
      } else if (name === 'delete_task') {
        const { error } = await supabase.from('work_tasks').delete().eq('id', (args as any).id).eq('user_id', user.id);
        if (error) throw error;
        result = { status: 'success', message: 'Tarefa removida com sucesso.' };
        window.dispatchEvent(new Event('app_data_changed'));
      } else if (name === 'get_transactions') {
        const { data } = await supabase.from('financial_transactions').select('*').eq('user_id', user.id).limit(50000);
        result = { status: 'success', transactions: data?.filter(t => t.description !== '__FINANCIAL_TAGS__') };
      } else if (name === 'create_transaction') {
        const { data, error } = await supabase.from('financial_transactions').insert([{ user_id: user.id, ...args as any }]).select();
        if (error) throw error;
        result = { status: 'success', message: 'Transação criada com sucesso.', transaction: data[0] };
        window.dispatchEvent(new Event('app_data_changed'));
      } else if (name === 'get_assets') {
        const { data } = await supabase.from('financial_assets').select('*').eq('user_id', user.id);
        result = { status: 'success', assets: data };
      } else if (name === 'get_habits') {
        const { data } = await supabase.from('habits').select('*').eq('user_id', user.id);
        result = { status: 'success', habits: data };
      } else if (name === 'get_academy_data') {
        const { data } = await supabase.from('academy_data').select('data').eq('user_id', user.id).single();
        if (data) {
          result = { status: 'success', academy_data: data.data };
        } else {
          const localData = localStorage.getItem('academy_data_v2');
          if (localData) {
            result = { status: 'success', academy_data: JSON.parse(localData) };
          } else {
            result = { status: 'success', academy_data: { nodes: [], globalChecks: [] } };
          }
        }
      } else if (name === 'update_academy_data') {
        const { data: academyData } = args as any;
        
        if (!academyData || typeof academyData !== 'object' || !Array.isArray(academyData.nodes)) {
          throw new Error("Formato de dados inválido. 'nodes' deve ser um array.");
        }

        const { error } = await supabase.from('academy_data').upsert({
          user_id: user.id,
          data: academyData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
        localStorage.setItem('academy_data_v2', JSON.stringify(academyData));
        
        if (error) {
          console.error('Error saving academy data:', error);
          result = { status: 'success_local_only', message: 'Dados da Academy atualizados localmente (erro ao salvar na nuvem).' };
        } else {
          result = { status: 'success', message: 'Dados da Academy atualizados com sucesso.' };
        }
        window.dispatchEvent(new Event('app_data_changed'));
      }
    } catch (err: any) {
      result = { status: 'error', message: err.message || 'Erro ao executar a função.' };
    }
    return result;
  };

  const handleSend = async () => {
    if ((!input.trim() && !image) || isLoading) return;
    if (!chatRef.current) {
      setMessages(prev => [...prev, { role: 'model', text: 'O Jarvis não pôde ser inicializado. Verifique a configuração da API Key.' }]);
      return;
    }

    const userMessage = input.trim();
    const currentImage = image;
    const currentImagePreview = imagePreview;
    
    setInput('');
    setImage(null);
    setImagePreview(null);
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: userMessage + (currentImagePreview ? '\n[Imagem anexada]' : '') 
    }]);
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let messageContent: any = userMessage;

      if (currentImage) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(currentImage);
        });

        messageContent = [
          { text: userMessage || 'Analise esta imagem.' },
          {
            inlineData: {
              data: base64,
              mimeType: currentImage.type
            }
          }
        ];
      }

      let response: GenerateContentResponse = await chatRef.current.sendMessage({ message: messageContent });
      
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        
        for (const call of response.functionCalls) {
          const { name, args } = call;
          const result = await executeTool(name, args, user);
          
          functionResponses.push({
            functionResponse: {
              name: name,
              id: call.id,
              response: result
            }
          });
        }
        
        response = await chatRef.current.sendMessage({ message: functionResponses });
      }

      if (response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }
    } catch (error: any) {
      console.error('Error in chat:', error);
      let errorMessage = error?.message || 'Erro desconhecido';
      if (errorMessage.includes('unregistered callers') || errorMessage.includes('API Key') || errorMessage.includes('PERMISSION_DENIED')) {
        errorMessage = 'A chave da API do Gemini (GEMINI_API_KEY) não está configurada ou é inválida. Se você exportou este projeto, certifique-se de adicionar uma chave válida no seu arquivo .env.';
      }
      setMessages(prev => [...prev, { role: 'model', text: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-error text-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-50"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {isVoiceMode && (
        <div className="fixed inset-0 z-[100] bg-bg/95 backdrop-blur-md flex flex-col items-center justify-center">
          <button 
            onClick={toggleVoiceMode}
            className="absolute top-8 right-8 text-text-muted hover:text-error transition-colors p-4"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Orb animations */}
            <div className="absolute inset-0 bg-accent/10 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-8 bg-accent/20 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
            <div className="absolute inset-12 bg-accent/40 rounded-full animate-pulse" style={{ animationDuration: '1s' }}></div>
            <div className="absolute inset-16 bg-accent rounded-full shadow-[0_0_100px_rgba(217,184,115,0.8)] flex items-center justify-center z-10">
              <Bot className="w-12 h-12 text-black" />
            </div>
          </div>
          
          <div className="mt-16 text-center space-y-4">
            <h2 className="text-3xl font-black uppercase tracking-widest text-text-main">Jarvis Protocol</h2>
            <p className="text-accent font-mono animate-pulse text-lg">Conexão neural ativa. Pode falar...</p>
          </div>
        </div>
      )}

      <div className={`fixed bottom-6 right-6 bg-surface-2 border border-border-subtle shadow-2xl flex flex-col z-50 transition-all duration-300 ${isExpanded ? 'w-[600px] h-[80vh]' : 'w-[380px] h-[500px]'}`}>
      <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-3/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-error/20 flex items-center justify-center text-error">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">Jarvis</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
              <span className="text-[10px] font-mono text-text-muted uppercase">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-text-muted hover:text-text-main transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-error transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-error text-black rounded-l-xl rounded-tr-xl' 
                : 'bg-surface border border-border-subtle text-text-main rounded-r-xl rounded-tl-xl'
            }`}>
              {msg.role === 'model' ? (
                <div className="markdown-body prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border-subtle text-text-main rounded-r-xl rounded-tl-xl p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-error" />
              <span className="text-xs font-mono text-text-muted uppercase">Processando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border-subtle bg-surface-3/30">
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded border border-border-subtle object-cover" />
            <button
              onClick={() => { setImage(null); setImagePreview(null); }}
              className="absolute -top-2 -right-2 bg-error text-black rounded-full p-1 hover:scale-110 transition-transform"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <label className="cursor-pointer p-2.5 text-text-muted hover:text-accent hover:bg-surface-3 rounded transition-colors">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImage(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <ImagePlus className="w-5 h-5" />
          </label>
          <button
            type="button"
            onClick={toggleDictation}
            className={`p-2.5 rounded transition-colors ${isDictating ? 'text-error bg-error/10' : 'text-text-muted hover:text-accent hover:bg-surface-3'}`}
            title={isDictating ? "Parar ditado" : "Ditar texto"}
          >
            {isDictating ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={toggleVoiceMode}
            className={`p-2.5 rounded transition-colors ${isVoiceMode ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-accent hover:bg-surface-3'}`}
            title="Modo Jarvis Live (Voz em tempo real)"
          >
            <AudioLines className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isDictating ? "Ouvindo... Fale agora." : "Digite seu comando..."}
            className="flex-1 bg-surface border border-border-subtle px-4 py-2.5 text-sm font-mono text-text-main focus:outline-none focus:border-error transition-colors disabled:opacity-50"
            disabled={isLoading || isVoiceMode}
          />
          <button 
            type="submit"
            disabled={(!input.trim() && !image) || isLoading || isVoiceMode}
            className="bg-error text-black p-2.5 hover:bg-error/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
