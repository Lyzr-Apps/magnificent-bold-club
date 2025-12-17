'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, RotateCcw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  text: string
  sender: 'user' | 'agent'
  timestamp: Date
}

interface ConversationState {
  isListening: boolean
  isProcessing: boolean
  isSpeaking: boolean
  hasStarted: boolean
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<ConversationState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    hasStarted: false,
  })

  const recognitionRef = useRef<any>(null)
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const conversationHistoryRef = useRef<string>('')

  // Initialize Speech Recognition and Speech Synthesis
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onstart = () => {
        setState((prev) => ({ ...prev, isListening: true }))
      }

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript

          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          recognitionRef.current.stop()
          handleUserMessage(finalTranscript)
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error)
        setState((prev) => ({ ...prev, isListening: false }))
      }

      recognitionRef.current.onend = () => {
        setState((prev) => ({ ...prev, isListening: false }))
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight
        }, 0)
      }
    }
  }, [messages])

  const handleUserMessage = async (userText: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    conversationHistoryRef.current += `User: ${userText}\n`

    setState((prev) => ({ ...prev, isProcessing: true }))

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          agent_id: '6942889a4659bbff85718a12',
          session_id: 'voice-conversation-session',
        }),
      })

      const data = await response.json()

      if (data.success && data.response) {
        // Handle different response formats
        let agentResponse = ''

        if (typeof data.response === 'string') {
          agentResponse = data.response
        } else if (data.response?.response) {
          agentResponse = data.response.response
        } else if (data.response?.text) {
          agentResponse = data.response.text
        } else if (data.response?.message) {
          agentResponse = data.response.message
        }

        if (!agentResponse && data.raw_response) {
          try {
            const parsed = JSON.parse(data.raw_response)
            agentResponse = parsed.response || JSON.stringify(parsed)
          } catch {
            agentResponse = data.raw_response
          }
        }

        agentResponse = agentResponse || "I'm sorry, I couldn't generate a response."

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: agentResponse,
          sender: 'agent',
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, agentMessage])
        conversationHistoryRef.current += `Agent: ${agentResponse}\n`

        setState((prev) => ({ ...prev, isProcessing: false, isSpeaking: true }))
        speakResponse(agentResponse)
      } else {
        setState((prev) => ({ ...prev, isProcessing: false }))
        console.error('Failed to get agent response')
      }
    } catch (error) {
      console.error('Error calling agent API:', error)
      setState((prev) => ({ ...prev, isProcessing: false }))
    }
  }

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis) {
      setState((prev) => ({ ...prev, isSpeaking: false }))
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onend = () => {
      setState((prev) => ({ ...prev, isSpeaking: false }))
      if (state.hasStarted && recognitionRef.current) {
        setTimeout(() => {
          recognitionRef.current.start()
        }, 500)
      }
    }

    synthesisRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition not supported in this browser')
      return
    }

    if (state.isListening) {
      recognitionRef.current.stop()
      setState((prev) => ({ ...prev, isListening: false }))
    } else {
      if (!state.hasStarted) {
        setState((prev) => ({ ...prev, hasStarted: true }))
      }
      recognitionRef.current.start()
    }
  }

  const handleEndConversation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setState({
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      hasStarted: false,
    })
    setMessages([])
    conversationHistoryRef.current = ''
  }

  const handleClearConversation = () => {
    setMessages([])
    conversationHistoryRef.current = ''
  }

  const getStatusText = () => {
    if (state.isProcessing) return 'Thinking...'
    if (state.isSpeaking) return 'Speaking...'
    if (state.isListening) return 'Listening...'
    if (state.hasStarted) return 'Ready to speak'
    return 'Tap to speak'
  }

  const getMicIcon = () => {
    if (state.isListening || state.isProcessing || state.isSpeaking) {
      return <MicOff className="w-8 h-8" />
    }
    return <Mic className="w-8 h-8" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="pt-8 px-6 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Voice Conversation</h1>
        <p className="text-gray-300 text-sm">Speak naturally with your AI assistant</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Avatar with animated ring */}
        <div className="mb-8">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {(state.isListening || state.isSpeaking) && (
              <div className="absolute inset-0 rounded-full border-2 border-purple-500 pulse-ring"></div>
            )}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-4xl text-white font-bold">A</span>
            </div>
          </div>
        </div>

        {/* Waveform Visualizer */}
        {state.isListening && (
          <div className="flex gap-1 h-12 items-center justify-center mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-purple-500 to-blue-400 rounded-full waveform-bar"
                style={{ animationDelay: `${i * 0.1}s` }}
              ></div>
            ))}
          </div>
        )}

        {/* Status Text */}
        <div className="h-8 mb-8">
          {state.isProcessing ? (
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-sm">{getStatusText()}</span>
              <div className="dots-bounce flex gap-1">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
              </div>
            </div>
          ) : (
            <p className="text-gray-300 text-sm">{getStatusText()}</p>
          )}
        </div>

        {/* Main Voice Button */}
        <button
          onClick={toggleListening}
          disabled={state.isProcessing}
          className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
            state.isListening
              ? 'bg-gradient-to-br from-red-500 to-red-600 scale-110'
              : 'bg-gradient-to-br from-purple-600 to-blue-600 hover:scale-105 active:scale-95'
          } ${state.isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="text-white">{getMicIcon()}</div>
        </button>

        {/* Conversation Transcript */}
        {state.hasStarted && (
          <div className="w-full mt-12 flex-1 max-w-2xl">
            <ScrollArea className="h-80 rounded-lg border border-slate-700 bg-slate-800/50 p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-center text-sm py-8">Start speaking to begin the conversation</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-4 py-3 rounded-lg ${
                          message.sender === 'user'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-none'
                            : 'bg-slate-700 text-gray-100 rounded-bl-none'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.text}</p>
                        <span className="text-xs mt-1 block opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Control Bar */}
      {state.hasStarted && (
        <div className="flex gap-4 justify-center pb-8 px-6">
          <Button
            onClick={handleClearConversation}
            variant="outline"
            className="border-gray-500 text-gray-300 hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Conversation
          </Button>
          <Button
            onClick={handleEndConversation}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            End Conversation
          </Button>
        </div>
      )}
    </div>
  )
}
