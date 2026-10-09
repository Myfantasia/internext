import React, { useState } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

interface FloatingWhatsAppProps {
  productContext?: string;
}

export const FloatingWhatsApp: React.FC<FloatingWhatsAppProps> = ({ productContext }) => {
  const { settings } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [customMsg, setCustomMsg] = useState(
    productContext
      ? `Hello ${settings.storeName}, I am interested in ${productContext}. Is it currently available?`
      : `Hello ${settings.storeName}, I have an inquiry about your products/services.`
  );

  const cleanPhone = settings.whatsappNumber.replace(/\D/g, '');

  const handleSend = () => {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMsg)}`;
    window.open(url, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {/* Pop-up Chat Card */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-3rem)] max-w-80 sm:w-96 sm:max-w-none bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-emerald-700 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{settings.storeName} Live Support</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                  <span>Online | Typically replies in 2 mins</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 bg-slate-950/90 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-xl text-slate-300 border border-slate-700">
              <p className="font-semibold text-white mb-1">Jambo! 👋 How can we help you today?</p>
              <p>Ask about stock availability, same-day delivery to your county, M-Pesa payments, or custom PC builds.</p>
            </div>

            <textarea
              rows={3}
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Type your WhatsApp inquiry..."
            />

            <button
              type="button"
              onClick={handleSend}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-xs"
            >
              <Send className="w-4 h-4" />
              <span>Start WhatsApp Conversation</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-full shadow-2xl shadow-emerald-600/40 hover:scale-105 transition-all group font-bold text-xs"
        title={`Chat with ${settings.storeName} on WhatsApp`}
      >
        <MessageCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline">WhatsApp Help</span>
      </button>
    </div>
  );
};
