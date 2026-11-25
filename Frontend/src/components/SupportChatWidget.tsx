import { useState } from 'react'
import { Bot, MessageCircle, X } from 'lucide-react'
import type { AccountRole } from '../service_rout/ApiService'
import { SupportChat } from './SupportChat'
import './SupportChatWidget.css'

export function SupportChatWidget({ role }: { role: AccountRole }) {
  const [isOpen, setIsOpen] = useState(false)

  if (role === 'superadmin') return null

  return <div className="support-chat-widget">
    {isOpen && <section className="support-chat-widget-panel" aria-label="Chat d’assistance">
      <header className="support-chat-widget-header">
        <span><Bot size={17} aria-hidden="true" /> Assistance CyberShield</span>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Fermer le chat"><X size={17} /></button>
      </header>
      <SupportChat role={role} showInbox={false} />
    </section>}
    <button className="support-chat-widget-toggle" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
      {isOpen ? <X size={18} aria-hidden="true" /> : <MessageCircle size={19} aria-hidden="true" />}
      <span>{isOpen ? 'Fermer' : 'Aide / Chat'}</span>
    </button>
  </div>
}
