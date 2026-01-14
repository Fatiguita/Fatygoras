import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage, Logger } from '../types';
import { sendChatMessage } from '../services/geminiService';
import Button from './Button';

interface ChatBotProps {
  apiKey: string;
  model: string;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  logger?: Logger;
  context?: string;
  isOpen: boolean;
  toggleOpen: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ 
  apiKey, model, history, setHistory, logger, context = '', isOpen, toggleOpen 
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isOpen, selectedImage]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
        if (!isOpen) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.indexOf("image") === 0) {
                const blob = item.getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        setSelectedImage(ev.target?.result as string);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setSelectedImage(ev.target?.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleRestart = () => {
      if (history.length === 0) return;
      if (window.confirm("Start a new conversation? This will clear the current chat history.")) {
          setHistory([]);
          setInput('');
          setSelectedImage(null);
      }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || !apiKey) return;

    let rawImage: string | undefined = undefined;
    if (selectedImage) {
        rawImage = selectedImage.replace(/^data:image\/[a-z]+;base64,/, "");
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: rawImage, 
      timestamp: Date.now(),
    };

    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(
          apiKey, 
          history, 
          userMsg.content, 
          context, 
          model, 
          logger,
          rawImage 
      );
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
      };
      setHistory([...newHistory, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "Error: Could not connect to AI. Please check your API Key.",
        timestamp: Date.now(),
      };
      setHistory([...newHistory, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={toggleOpen}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 ${isOpen ? 'hidden sm:flex' : 'flex'}`}
        aria-label="Open Chat Assistant"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      <div 
        className={`fixed z-50 bg-white dark:bg-gray-800 shadow-2xl flex flex-col transition-all duration-300 transform border border-gray-200 dark:border-gray-700 
          ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-0 opacity-0 pointer-events-none origin-bottom-right'}
          sm:bottom-24 sm:right-6 sm:w-96 sm:rounded-2xl sm:h-[600px]
          inset-0 w-full h-full rounded-none bottom-0 right-0
        `}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-none sm:rounded-t-2xl flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Bruno</h3>
            <p className="text-xs text-gray-500">Teacher Assistant</p>
          </div>
          <div className="flex items-center gap-1">
              <button 
                onClick={handleRestart} 
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Restart Conversation"
              >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button onClick={toggleOpen} className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
          {history.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-10">
              No messages yet. Ask me anything or paste an image!
            </div>
          )}
          {history.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-bl-none'
              }`}>
                {msg.image && (
                    <img 
                        src={`data:image/png;base64,${msg.image}`} 
                        alt="User Upload" 
                        className="max-w-full rounded-lg mb-2 border border-white/20"
                    />
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
               <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-none px-4 py-3 border border-gray-200 dark:border-gray-700">
                 <div className="flex space-x-1">
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                 </div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedImage && (
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <div className="relative group">
                    <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-md border border-gray-300" />
                    <button 
                        onClick={() => setSelectedImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <span className="text-xs text-gray-500 italic">Image attached</span>
            </div>
        )}

        <form onSubmit={handleSend} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-none sm:rounded-b-2xl">
          <div className="flex gap-2 items-end">
            <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                title="Attach Image"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleImageSelect} 
                className="hidden" 
            />
            
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
            <Button type="submit" size="sm" disabled={isLoading || (!input.trim() && !selectedImage)} className="rounded-lg w-10 h-10 p-0 flex items-center justify-center">
               <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ChatBot;
