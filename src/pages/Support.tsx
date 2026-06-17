import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, CreditCard, Ticket, Bot, User, Clock, Loader2, FileText } from "lucide-react";
import { useUser } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: Date;
  isAction?: boolean;
}

export default function SupportPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      content: "Hello! I'm Aczen's AI Support Agent. How can I help you today? You can ask me anything about our platform, or use the quick actions below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const simulateAIResponse = (userMessage: string, customResponse?: string) => {
    setIsTyping(true);
    
    // Simulate network delay for AI thinking
    setTimeout(() => {
      const defaultResponse = "Based on the Aczen documentation, I can help you with that. However, right now I'm in simulation mode! Once fully connected to the backend, I'll provide a direct answer using our Mintlify knowledge base.";
      
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "ai",
          content: customResponse || defaultResponse,
          timestamp: new Date(),
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    simulateAIResponse(userMessage);
  };

  const handleQuickAction = (action: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "user",
        content: action,
        timestamp: new Date(),
        isAction: true,
      },
    ]);

    if (action === "Check Settlement Status") {
      simulateAIResponse("", "Checking Razorpay for your recent settlements...\n\nGood news! Your latest payout of ₹24,500 for Invoice #102 is processing and is expected to settle to your registered bank account by tomorrow at 4:00 PM.");
    } else if (action === "Create a Ticket") {
      simulateAIResponse("", "I've created a priority support ticket for you. Ticket #ACZ-8924 has been assigned to our human support team. They will email you at your registered address within 2 hours.");
    } else if (action === "View Documentation") {
      simulateAIResponse("", "You can view all our comprehensive guides and API references on our Mintlify portal: https://aczen-d43c4738.mintlify.app/");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-120px)] flex-col space-y-4">
        {/* Header section with glassmorphism */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background backdrop-blur-xl shadow-lg border-b border-border/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  AI Support Hub
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Agent Online
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Main Chat Area */}
          <Card className="flex-1 flex flex-col shadow-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-transparent to-muted/10 scroll-smooth"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className={`h-10 w-10 shadow-md border-2 ${msg.sender === "user" ? "border-primary/20" : "border-emerald-500/20"}`}>
                    {msg.sender === "user" ? (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                        <Bot className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <div className={`flex flex-col gap-1 max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-card border border-border/50 rounded-tl-sm"
                      } ${msg.isAction ? "bg-primary/80" : ""}`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10 shadow-md border-2 border-emerald-500/20">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border/50 bg-card/80 backdrop-blur-md">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <Input
                  placeholder="Ask the AI anything or describe your issue..."
                  className="flex-1 rounded-full px-6 border-primary/20 focus-visible:ring-primary/30 h-12 shadow-inner"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                />
                <Button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="rounded-full h-12 w-12 p-0 shadow-lg hover:shadow-primary/25 transition-all duration-200"
                >
                  {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-1" />}
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Actions Sidebar */}
          <div className="hidden lg:flex w-80 flex-col gap-4">
            <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                <Button 
                  variant="outline" 
                  className="justify-start h-14 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all group"
                  onClick={() => handleQuickAction("Check Settlement Status")}
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">Settlement Status</div>
                    <div className="text-xs text-muted-foreground">Check Razorpay payouts</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="justify-start h-14 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all group"
                  onClick={() => handleQuickAction("Create a Ticket")}
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">Create a Ticket</div>
                    <div className="text-xs text-muted-foreground">Get human assistance</div>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  className="justify-start h-14 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all group"
                  onClick={() => handleQuickAction("View Documentation")}
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">Knowledge Base</div>
                    <div className="text-xs text-muted-foreground">Read the Mintlify docs</div>
                  </div>
                </Button>

                <div className="mt-auto p-4 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10">
                  <h3 className="font-semibold text-sm mb-1 text-primary">How it works</h3>
                  <p className="text-xs text-muted-foreground">
                    This AI agent is connected directly to the Aczen knowledge base and your Razorpay account to provide instant, contextual support.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
