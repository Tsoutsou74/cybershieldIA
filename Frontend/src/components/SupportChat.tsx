import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, CheckCircle2, CircleHelp, LoaderCircle, MessageCircle, Search, Send, UserRound } from 'lucide-react'
import type { AccountRole, SupportMessage } from '../service_rout/ApiService'
import { getSupportChat, getSupportConversation, getSupportInbox, replyToSupportConversation, sendSupportMessage } from '../service_rout/ApiService'
import './SupportChat.css'

const formatTime = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: 'short',
}).format(new Date(value))

export function SupportChat({ role, showInbox = true }: { role: AccountRole; showInbox?: boolean }) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [inbox, setInbox] = useState<SupportMessage[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [conversationFilter, setConversationFilter] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messageEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const load = role === 'superadmin' && showInbox
      ? getSupportInbox().then(async (pending) => {
          if (!active) return
          setInbox(pending)
          const firstUser = pending.find((item) => item.user_id != null)?.user_id ?? null
          setSelectedUserId(firstUser)
          setMessages(firstUser == null ? [] : await getSupportConversation(firstUser))
        })
      : getSupportChat().then((history) => { if (active) setMessages(history) })
    load
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Le chat ne peut pas Ãªtre chargÃ©.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, showInbox])

  useEffect(() => {
    if (role !== 'superadmin' || selectedUserId == null) return
    let active = true
    getSupportConversation(selectedUserId).then((thread) => { if (active) setMessages(thread) }).catch(() => undefined)
    return () => { active = false }
  }, [role, selectedUserId])

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => {
    if (role !== 'user') return
    const interval = window.setInterval(() => {
      getSupportChat().then(setMessages).catch(() => undefined)
    }, 12000)
    return () => window.clearInterval(interval)
  }, [role])

  useEffect(() => {
    if (role !== 'superadmin' || !showInbox) return
    const refreshInbox = () => {
      getSupportInbox().then(setInbox).catch(() => undefined)
    }
    const interval = window.setInterval(refreshInbox, 15000)
    return () => window.clearInterval(interval)
  }, [role, showInbox])

  useEffect(() => {
    if (role !== 'superadmin' || selectedUserId == null) return
    const interval = window.setInterval(() => {
      getSupportConversation(selectedUserId).then(setMessages).catch(() => undefined)
    }, 12000)
    return () => window.clearInterval(interval)
  }, [role, selectedUserId])

  const send = async (value: string) => {
    const message = value.trim()
    if (!message || sending) return
    setDraft('')
    setSending(true)
    setError('')
    try {
      if (role === 'superadmin') {
        if (selectedUserId == null) throw new Error('SÃ©lectionnez une conversation avant de rÃ©pondre.')
        const reply = await replyToSupportConversation(selectedUserId, message)
        setMessages((current) => [...current, reply])
      } else {
        const result = await sendSupportMessage(message, true)
        setMessages((current) => [...current, ...result.messages])
      }
      if (role === 'superadmin' && showInbox) setInbox(await getSupportInbox())
    } catch (cause) {
      setDraft(message)
      setError(cause instanceof Error ? cause.message : 'Le message nâ€™a pas pu Ãªtre envoyÃ©.')
    } finally {
      setSending(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send(draft)
  }

  const conversations = [...new Map(inbox.filter((item) => item.user_id != null).map((item) => [item.user_id as number, item])).values()]
    .filter((item) => `${item.user_email ?? ''} ${item.message}`.toLowerCase().includes(conversationFilter.toLowerCase()))
  const showSuperadminContact = 'equipe superadmin support'.includes(conversationFilter.toLowerCase())
  const lastUserMessage = messages[messages.length - 1]
  const activeContact = role === 'superadmin'
    ? inbox.find((item) => item.user_id === selectedUserId)?.user_email ?? 'Utilisateur'
    : 'Équipe superadmin'

  return <div className={`support-chat-layout ${showInbox ? 'has-inbox' : 'user-chat'}`}>
    <section className="support-chat-card" aria-label="Discussion avec l equipe superadmin">
      <div className="support-chat-heading">
        <span className="support-chat-bot-icon"><UserRound size={19} aria-hidden="true" /></span>
        <div><strong>{role === "superadmin" && selectedUserId != null ? (inbox.find((item) => item.user_id === selectedUserId)?.user_email ?? "Conversation utilisateur") : role === "superadmin" ? "Messagerie support" : "Équipe superadmin"}</strong><span><i />{role === "superadmin" ? "Réponse directe au demandeur" : "Échange direct avec un superadmin"}</span></div>
        <span className="support-auto-tag"><CheckCircle2 size={13} />Humain</span>
      </div>
      <div className="message-thread-header">
        <span className="message-contact-avatar large">{activeContact.slice(0, 2).toUpperCase()}</span>
        <div><strong>{activeContact}</strong><span>{role === 'superadmin' ? 'Conversation utilisateur' : 'Messagerie directe avec le support'}</span></div>
        <span className="message-thread-status"><i />Direct</span>
      </div>
      <div className="support-chat-messages" aria-live="polite" aria-busy={loading}>
        {loading ? <div className="support-chat-loading"><LoaderCircle size={17} /> Chargement de la discussionâ€¦</div> : messages.length === 0
          ? <div className="support-chat-welcome"><span><MessageCircle size={20} /></span><strong>{role === "superadmin" ? "Choisissez une conversation" : "Écrivez à l’équipe superadmin"}</strong><p>{role === "superadmin" ? "Les messages des utilisateurs apparaissent ici. Ouvrez une conversation pour répondre." : "Votre message est transmis directement à l’équipe superadmin. Vous recevrez sa réponse dans cette discussion."}</p></div>
          : messages.map((item) => <article className={`support-message ${item.sender === 'assistant' || item.sender !== role ? 'assistant' : 'user'}`} key={item.id}>
            <span className="support-message-avatar">{item.sender === 'assistant' ? <Bot size={15} /> : <UserRound size={15} />}</span>
            <div className="support-message-body"><div className="support-message-meta"><strong>{item.sender === 'assistant' ? 'Assistant CyberShield' : item.sender === 'superadmin' ? 'Superadmin CyberShield' : role === 'superadmin' ? item.user_email ?? 'Utilisateur' : 'Vous'}</strong><time dateTime={item.created_at}>{formatTime(item.created_at)}</time></div><p>{item.message}</p></div>
          </article>)}
        {sending && <div className="support-chat-thinking"><span /><span /><span /> Envoi du message</div>}
        <div ref={messageEnd} />
      </div>
      {error && <p className="support-chat-error" role="alert">{error}</p>}
      <form className="support-chat-form" onSubmit={submit}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft) } }} placeholder={role === "superadmin" ? "Répondre à l’utilisateur" : "Écrivez votre message à l’équipe"} aria-label="Votre message" maxLength={2000} rows={2} disabled={loading || sending || (role === "superadmin" && selectedUserId == null)} />
        <div className="support-chat-actions">
          
          <button className="primary-action" type="submit" disabled={!draft.trim() || loading || sending} aria-label="Envoyer le message"><Send size={15} /> Envoyer</button>
        </div>
      </form>
      <p className="support-chat-note"><CircleHelp size={13} />{role === "superadmin" ? "Votre reponse est envoyee directement dans la discussion utilisateur." : "Votre message est transmis directement a l equipe superadmin."}</p>
    </section>

    {role === 'user' && showInbox && <aside className="support-inbox-card message-inbox">
      <div className="message-inbox-heading"><div><span className="message-inbox-mark"><MessageCircle size={17} /></span><div><h3>Messages</h3><p>1 conversation</p></div></div><span className="support-inbox-count">1</span></div>
      <label className="message-search"><Search size={15} aria-hidden="true" /><input value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} placeholder="Rechercher une conversation" aria-label="Rechercher une conversation" /></label>
      {showSuperadminContact && <div className="support-inbox-list"><button className="support-inbox-conversation active" type="button" aria-current="page" title="Actualiser cette conversation" onClick={() => { setLoading(true); setError(""); getSupportChat().then(setMessages).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "La discussion ne peut pas être chargée.")).finally(() => setLoading(false)) }}><span className="message-contact-avatar">CS</span><span className="message-contact-copy"><span><strong>Équipe superadmin</strong><small>Assistance CyberShield</small></span><p>{lastUserMessage?.message ?? 'Envoyez un message pour commencer'}</p></span></button></div>}
      {!showSuperadminContact && <div className="support-inbox-empty"><MessageCircle size={18} /><span>Aucune conversation ne correspond à cette recherche.</span></div>}
    </aside>}

    {role === 'superadmin' && showInbox && <aside className="support-inbox-card message-inbox">
      <div className="message-inbox-heading"><div><span className="message-inbox-mark"><MessageCircle size={17} /></span><div><h3>Messages</h3><p>{conversations.length} conversation{conversations.length === 1 ? '' : 's'}</p></div></div><span className="support-inbox-count">{conversations.length}</span></div>
      <label className="message-search"><Search size={15} aria-hidden="true" /><input value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value)} placeholder="Rechercher une conversation" aria-label="Rechercher une conversation" /></label>
      <div className="section-card-heading"><div><h3>Demandes transmises</h3><p>Questions que lâ€™assistant nâ€™a pas pu rÃ©soudre</p></div><span className="support-inbox-count">{inbox.length}</span></div>
      {conversations.length ? <div className="support-inbox-list">{conversations.map((item) => <button className={`support-inbox-conversation${item.user_id === selectedUserId ? ' active' : ''}`} type="button" key={item.user_id} onClick={() => setSelectedUserId(item.user_id ?? null)}><div><strong>{item.user_email ?? 'Utilisateur'}</strong><time dateTime={item.created_at}>{formatTime(item.created_at)}</time></div><p>{item.message}</p></button>)}</div> : <div className="support-inbox-empty"><CheckCircle2 size={18} /><span>Aucune demande transmise pour le moment. Les nouvelles demandes des utilisateurs apparaÃ®tront ici.</span></div>}
    </aside>}
  </div>
}
