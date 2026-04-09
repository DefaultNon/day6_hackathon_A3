'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Send,
  Bot,
  User,
  Sparkles,
  MapPin,
  Expand,
  Route
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Attraction, type Itinerary, USER_LOCATION } from '@/lib/attractions'
import { useAppMode } from './travel-app-content'

interface ChatAgentProps {
  attractions: Attraction[]
  selectedAttractions: Attraction[]
  radius: number
  onRadiusChange: (radius: number) => void
  onSelectAttraction: (attraction: Attraction) => void
  onGenerateItinerary: (attractions: Attraction[]) => void
  onShowLocation: (attraction: Attraction) => void
  itinerary: Itinerary | null
  hideButton?: boolean
}

export default function ChatAgent({
  attractions,
  selectedAttractions,
  radius,
  onRadiusChange,
  onSelectAttraction,
  onGenerateItinerary,
  onShowLocation,
  itinerary,
  hideButton = false,
}: ChatAgentProps) {
  const mode = useAppMode()
  const isFramed = mode === 'framed'

  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [input, setInput] = useState('')
  const [locationName, setLocationName] = useState<string | null>(null)
  
  // Use a ref to always have the latest location name in the transport closure
  const locationRef = useRef<string | null>(null)
  useEffect(() => {
    locationRef.current = locationName
  }, [locationName])

  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/chat',
      fetch: async (url, options) => {
        // Inject current location name and coordinates into the body
        if (options?.body) {
          try {
            const body = JSON.parse(options.body as string)
            body.location_name = locationRef.current
            
            // Also ensure we have the latest coordinates
            const currentLat = selectedAttractions[0]?.coordinates[0] || USER_LOCATION[0]
            const currentLng = selectedAttractions[0]?.coordinates[1] || USER_LOCATION[1]
            body.lat = currentLat
            body.lng = currentLng
            body.radius = radius
            
            options.body = JSON.stringify(body)
          } catch (e) {
            console.error("❌ [MANUAL STREAM] Error injecting body params:", e)
          }
        }

        console.log("🚀 [MANUAL STREAM] Starting request to:", url, "with body:", options?.body);
        const response = await fetch(url, options);
        console.log("🌊 [MANUAL STREAM] Response headers received. Content-Type:", response.headers.get('content-type'));

        if (!response.body) {
          console.error("❌ [MANUAL STREAM] No response body found");
          return response;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessageId = `assistant-${Date.now()}`;
        let fullText = "";
        let hasCreatedMessage = false;

        // Start processing the stream
        const stream = new ReadableStream({
          async start(controller) {
            console.log("📖 [MANUAL STREAM] Starting to read chunks...");
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  console.log("🏁 [MANUAL STREAM] Stream completed");
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                console.log("📦 [MANUAL STREAM] Chunk received:", JSON.stringify(chunk));

                // Process chunks as raw text
                fullText += chunk;

                // Update React state manually with a safety check for duplicates
                setMessages((prev: any[]) => {
                  const existingIdx = prev.findIndex(m => m.id === assistantMessageId);
                  
                  if (existingIdx === -1) {
                    // Create new assistant message
                    console.log("🆕 [MANUAL STREAM] Creating new assistant message entry");
                    return [...prev, {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: fullText,
                      parts: [{ type: 'text', text: fullText }],
                      createdAt: new Date()
                    }];
                  } else {
                    // Update existing assistant message
                    const newMessages = [...prev];
                    newMessages[existingIdx] = {
                      ...newMessages[existingIdx],
                      content: fullText,
                      parts: [{ type: 'text', text: fullText }]
                    };
                    return newMessages;
                  }
                });

                controller.enqueue(value);
              }
            } catch (error) {
              console.error("❌ [MANUAL STREAM] Fatal stream error:", error);
              controller.error(error);
            } finally {
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        });
      },
      body: {
        radius,
        lat: selectedAttractions[0]?.coordinates[0] || USER_LOCATION[0],
        lng: selectedAttractions[0]?.coordinates[1] || USER_LOCATION[1],
        location_name: locationName,
      }
    })
  } as any)

  const { messages, sendMessage, status, setMessages } = chatHelpers

  useEffect(() => {
    console.log("🛠 Available Chat Helpers:", Object.keys(chatHelpers))
  }, [])

  // Debug messages array updates
  useEffect(() => {
    console.log("🔄 STATUS CHANGE:", status)
  }, [status])

  useEffect(() => {
    console.log("📩 MESSAGES ARRAY UPDATED (Length:", messages.length, ")")
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      console.log("📑 Last Message:", {
        role: lastMsg.role,
        parts: (lastMsg as any).parts,
        content: (lastMsg as any).content,
      })
    }
  }, [messages])

  const isLoading = status === 'streaming' || status === 'submitted'

  // Tracks which messages have already had their actions processed to prevent infinite loops
  const processedMessageIds = useRef<Set<string>>(new Set())

  // Auto-scroll and check for actions when messages change
  useEffect(() => {
    // Scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    // Check for actions in the latest assistant message
    const lastMessage = messages[messages.length - 1]
    
    if (
      lastMessage && 
      lastMessage.role === 'assistant' && 
      status === 'ready' && 
      !processedMessageIds.current.has(lastMessage.id)
    ) {
      // Lấy nội dung GỐC để quét Action
      let rawText = ''
      const lastMsgAny = lastMessage as any
      if (typeof lastMsgAny.content === 'string') {
        rawText = lastMsgAny.content
      } else if (Array.isArray(lastMsgAny.parts)) {
        rawText = lastMsgAny.parts
          .map((part: any) => (part.type === 'text' ? part.text : (typeof part === 'string' ? part : '')))
          .join('')
      }

      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/)
      
      if (jsonMatch) {
        try {
          const action = JSON.parse(jsonMatch[1])
          processedMessageIds.current.add(lastMessage.id)
          
          if ((action.action === 'BUILD_ITINERARY' || action.action === 'SUGGEST_LOCATIONS') && action.ids) {
            const selected = action.ids
              .map((id: string) => attractions.find(a => a.id === id))
              .filter((a: Attraction | undefined): a is Attraction => !!a)

            if (selected.length > 0) {
              selected.forEach((attraction: Attraction) => {
                if (!selectedAttractions.find(sa => sa.id === attraction.id)) {
                  onSelectAttraction(attraction)
                }
              })
              onGenerateItinerary(selected)
            }
          } else if (action.action === 'SHOW_LOCATION' && action.id) {
            const attraction = attractions.find(a => a.id === action.id)
            if (attraction) {
              if (!selectedAttractions.find(sa => sa.id === attraction.id)) {
                onSelectAttraction(attraction)
              }
              onShowLocation(attraction)
            }
          }
        } catch (e) {
          console.error('Lỗi khi phân tích JSON Action:', e)
        }
      }
    }
  }, [messages, status, attractions, onGenerateItinerary, onShowLocation, selectedAttractions, onSelectAttraction])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Get location name from coordinates with caching
  useEffect(() => {
    const fetchLocationName = async () => {
      // 1. Check localStorage first
      const cachedDistrict = localStorage.getItem('travel_buddy_district')
      if (cachedDistrict) {
        console.log("📍 Using cached location:", cachedDistrict)
        setLocationName(cachedDistrict)
        return
      }

      const lat = selectedAttractions[0]?.coordinates[0] || USER_LOCATION[0]
      const lng = selectedAttractions[0]?.coordinates[1] || USER_LOCATION[1]
      
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/reverse-geocode?lat=${lat}&lng=${lng}`)
        const data = await res.json()
        
        if (data.location_name && data.location_name !== "Unknown location") {
          console.log("📍 Location identified and cached:", data.location_name)
          setLocationName(data.location_name)
          // 2. Save to localStorage
          localStorage.setItem('travel_buddy_district', data.location_name)
        } else {
          // Fallback if API fails or returns unknown
          setLocationName("Hoi An")
        }
      } catch (err) {
        console.error("❌ Failed to fetch location name:", err)
        setLocationName("Hoi An")
      }
    }

    if (isOpen && !locationName) {
      fetchLocationName()
    }
  }, [isOpen, selectedAttractions, locationName])

  // Initialize with greeting when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        parts: [{
          type: 'text',
          text: "Xin chào! hôm nay bạn muốn đi đâu ?"
        }]
      }])
    }
  }, [isOpen, messages.length, setMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    const userMessage = input.trim()
    setInput('')

    try {
      console.log("🚀 Calling sendMessage with:", userMessage)
      // Based on available helpers and documentation, we use 'text' property
      if (typeof (chatHelpers as any).sendMessage === 'function') {
        (chatHelpers as any).sendMessage({
          role: 'user',
          text: userMessage,
        })
      }
    } catch (err) {
      console.error("❌ Send message error:", err)
    }
  }

  const handleQuickAction = (action: string) => {
    if (isLoading) return
    sendMessage({ text: action })
  }

  // Helper to get text from message parts or content and clean JSON actions
  const getMessageText = (message: any): string => {
    let text = ''
    
    // 1. Extract raw text from different possible message formats
    if (typeof message.content === 'string') {
      text = message.content
    } else if (Array.isArray(message.parts)) {
      text = message.parts
        .map((part: any) => {
          if (part.type === 'text') return part.text
          if (typeof part === 'string') return part
          return ''
        })
        .join('')
    } else if (typeof message === 'string') {
      text = message
    }
    
    // 2. Strip out JSON action blocks (e.g., ```json\n...\n```) from display
    // These are processed in an effect but should be hidden from UI
    return text.replace(/```json\n[\s\S]*?\n```/g, '').trim()
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!hideButton && !isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className={cn(
            "rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-105 z-50",
            isFramed ? "fixed right-6 bottom-6 h-12 w-12" : "fixed right-6 bottom-6 h-14 w-14",
            "bg-orange-500 hover:bg-orange-600 text-white border-2 border-white/20"
          )}
        >
          <Bot className={isFramed ? "h-6 w-6" : "h-7 w-7"} />
        </Button>
      )}

      {/* Chat Interface */}
      {isOpen && (
        <Card className={cn(
          "z-50 flex flex-col shadow-2xl border-0 overflow-hidden",
          isFramed
            ? "absolute bottom-2 right-2 left-2 top-14"
            : "fixed bottom-4 right-4 left-4 top-20 sm:left-auto sm:w-[400px] sm:max-h-[600px]"
        )}>
          {/* Header */}
          <div className={cn(
            "bg-primary text-primary-foreground flex items-center justify-between",
            isFramed ? "px-3 py-2" : "px-4 py-3"
          )}>
            <div className={`flex items-center ${isFramed ? 'gap-1.5' : 'gap-2'}`}>
              <Bot className={isFramed ? "h-4 w-4" : "h-5 w-5"} />
              <span className={`font-semibold ${isFramed ? 'text-sm' : 'text-base'}`}>Travel Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-primary-foreground/20 rounded-full p-1 transition-colors"
            >
              <X className={isFramed ? "h-4 w-4" : "h-5 w-5"} />
            </button>
          </div>

          {/* Quick actions bar */}
          <div className={cn(
            "border-b bg-muted/50 flex overflow-x-auto",
            isFramed ? "px-2 py-1.5 gap-1.5" : "px-3 py-2 gap-2"
          )}>
            <Badge
              variant="secondary"
              className={cn(
                "cursor-pointer hover:bg-secondary/80 whitespace-nowrap",
                isFramed ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
              )}
              onClick={() => handleQuickAction("Show me relaxing places")}
            >
              <Sparkles className={`${isFramed ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
              Relaxing
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "cursor-pointer hover:bg-secondary/80 whitespace-nowrap",
                isFramed ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
              )}
              onClick={() => handleQuickAction("I want to explore cultural sites")}
            >
              <MapPin className={`${isFramed ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
              Culture
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "cursor-pointer hover:bg-secondary/80 whitespace-nowrap",
                isFramed ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
              )}
              onClick={() => onRadiusChange(radius + 5)}
            >
              <Expand className={`${isFramed ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
              Expand
            </Badge>
            {selectedAttractions.length >= 2 && (
              <Badge
                variant="default"
                className={cn(
                  "cursor-pointer whitespace-nowrap",
                  isFramed ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
                )}
                onClick={() => onGenerateItinerary(selectedAttractions)}
              >
                <Route className={`${isFramed ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                Route
              </Badge>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className={`flex-1 min-h-0 ${isFramed ? 'px-2 py-2' : 'px-3 py-3'}`}>
            <div className={isFramed ? "space-y-3" : "space-y-4"}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isFramed ? "gap-1.5" : "gap-2",
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      "rounded-full flex items-center justify-center flex-shrink-0",
                      isFramed ? "w-6 h-6" : "w-8 h-8",
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user'
                      ? <User className={isFramed ? "h-3 w-3" : "h-4 w-4"} />
                      : <Bot className={isFramed ? "h-3 w-3" : "h-4 w-4"} />
                    }
                  </div>
                  <div className={cn(
                    "rounded-2xl px-4 py-2",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-foreground"
                  )}>
                    <p className={cn(
                      "whitespace-pre-wrap leading-relaxed",
                      isFramed ? "text-xs" : "text-sm",
                      message.role === 'user' ? "text-white" : ""
                    )}>
                      {getMessageText(message)}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className={`flex ${isFramed ? 'gap-1.5' : 'gap-2'}`}>
                  <div className={cn(
                    "rounded-full flex items-center justify-center bg-muted flex-shrink-0",
                    isFramed ? "w-6 h-6" : "w-8 h-8"
                  )}>
                    <Bot className={isFramed ? "h-3 w-3" : "h-4 w-4"} />
                  </div>
                  <div className={cn(
                    "bg-muted",
                    isFramed ? "rounded-xl px-3 py-1.5" : "rounded-2xl px-4 py-2"
                  )}>
                    <div className="flex flex-row gap-1 w-full relative">
                      <span className={cn(`${isFramed ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-muted-foreground/50 rounded-full animate-bounce`)} style={{ animationDelay: '0ms' }} />
                      <span className={`${isFramed ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-muted-foreground/50 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                      <span className={`${isFramed ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-muted-foreground/50 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Invisible anchor for auto-scrolling */}
              <div ref={messagesEndRef} className="h-px" />
            </div>
          </ScrollArea>

          {/* Selected attractions indicator */}
          {selectedAttractions.length > 0 && (
            <div className={cn(
              "border-t bg-accent/20",
              isFramed ? "px-2 py-1.5" : "px-3 py-2"
            )}>
              <div className={`flex items-center ${isFramed ? 'gap-1.5 text-xs' : 'gap-2 text-sm'}`}>
                <MapPin className={`${isFramed ? 'h-3 w-3' : 'h-4 w-4'} text-primary`} />
                <span className="text-muted-foreground">
                  {selectedAttractions.length} selected
                </span>
                <div className="flex-1 flex gap-1 overflow-x-auto">
                  {selectedAttractions.slice(0, isFramed ? 2 : 3).map(a => (
                    <Badge key={a.id} variant="outline" className={cn(
                      "whitespace-nowrap",
                      isFramed ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
                    )}>
                      {a.name.length > (isFramed ? 12 : 20) ? a.name.slice(0, isFramed ? 12 : 20) + '...' : a.name}
                    </Badge>
                  ))}
                  {selectedAttractions.length > (isFramed ? 2 : 3) && (
                    <Badge variant="outline" className={isFramed ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"}>
                      +{selectedAttractions.length - (isFramed ? 2 : 3)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className={cn(
            "border-t bg-card",
            isFramed ? "p-2" : "p-3"
          )}>
            <div className={`flex ${isFramed ? 'gap-1.5' : 'gap-2'}`}>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className={cn("flex-1", isFramed ? "h-8 text-xs" : "h-10 text-sm")}
              />
              <Button
                type="submit"
                size="icon"
                className={isFramed ? "h-8 w-8" : "h-10 w-10"}
                disabled={isLoading || !input.trim()}
              >
                <Send className={isFramed ? "h-3 w-3" : "h-4 w-4"} />
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  )
}
