import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const COLUMNS = ['Tx', 'From', 'To', 'Collection', 'Token ID', 'Action']

const ACTION_STYLES = {
  SOLD: { label: 'Sale', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  LIST: { label: 'List', color: '#4da6ff', bg: 'rgba(77,166,255,0.1)' },
  CANCEL: { label: 'Cancel', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  UPDATE: { label: 'Update', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  TRANSFER: { label: 'Transfer', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

function UserCell({ address, user }) {
  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {user?.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'hsl(var(--primary) / 0.15)', fontSize: 9,
          color: 'hsl(var(--primary))', fontWeight: 700,
        }}>
          {address?.slice(2, 4).toUpperCase() ?? '?'}
        </span>
      )}
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
        {user?.username || short}
      </span>
    </div>
  )
}

function Activity() {
  const [copied, setCopied] = useState(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { data: activityData, isLoading } = useQuery({
    queryKey: ['/api/activity'],
    queryFn: async () => {
      const res = await fetch('/api/activity?limit=20&page=1');
      if (!res.ok) return { items: [], total: 0 };
      return res.json();
    },
  });

  const handleCopy = (tx, index) => {
    navigator.clipboard.writeText(tx)
    setCopied(index)
    setTimeout(() => setCopied(null), 1500)
  }

  const items = activityData?.items ?? []

  if (isLoading) return (
    <div style={{ padding: '32px 24px', color: 'hsl(var(--muted-foreground))' }}>Loading...</div>
  )

  return (
    <div style={{
      padding: isMobile ? '24px 16px' : '32px 48px',
      minHeight: '100vh',
      color: 'hsl(var(--foreground))',
      backgroundColor: 'hsl(var(--background))',
      fontFamily: 'var(--font-body)',
    }}>
      <h2 style={{
        fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'hsl(var(--muted-foreground))', marginBottom: 20,
        textAlign: 'center', fontFamily: 'var(--font-display)',
      }}>
        Activity
      </h2>

      {/* ── DESKTOP TABLE ── */}
      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1.5fr 0.8fr 1fr',
          marginLeft: 300,
          marginRight: 300,
        }}>
          {COLUMNS.map((col) => (
            <div key={col} style={{
              fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'hsl(var(--muted-foreground))', padding: '12px 12px 12px 0',
              borderBottom: '1px solid hsl(var(--border))', fontFamily: 'var(--font-display)',
            }}>
              {col}
            </div>
          ))}

          {items.map((item, i) => {
            const action = ACTION_STYLES[item.type] ?? { label: item.type, color: '#888', bg: 'rgba(136,136,136,0.1)' }
            return (
              <React.Fragment key={i}>
                <div style={cellStyle}><TxSpan item={item} i={i} copied={copied} onCopy={handleCopy} /></div>
                <div style={cellStyle}><UserCell address={item.from} user={item.fromUser} /></div>
                <div style={cellStyle}><UserCell address={item.to} user={item.toUser} /></div>
                <div style={cellStyle}><CollectionCell item={item} /></div>
                <div style={cellStyle}><TokenBadge tokenId={item.tokenId} /></div>
                <div style={cellStyle}><ActionBadge action={action} /></div> 
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* ── MOBILE CARDS ── */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => {
            const action = ACTION_STYLES[item.type] ?? { label: item.type, color: '#888', bg: 'rgba(136,136,136,0.1)' }
            return (
              <div key={i} style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {/* Top row: action badge + collection + token */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ActionBadge action={action} />
                    <CollectionCell item={item} />
                  </div>
                  <TokenBadge tokenId={item.tokenId} />
                </div>

                {/* Tx hash */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', minWidth: 28 }}>Tx</span>
                  <TxSpan item={item} i={i} copied={copied} onCopy={handleCopy} />
                </div>

                {/* From / To */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>From</div>
                    <UserCell address={item.from} user={item.fromUser} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}>To</div>
                    <UserCell address={item.to} user={item.toUser} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Shared sub-components ── */

function ActionBadge({ action }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      color: action.color, background: action.bg,
      padding: '3px 8px', borderRadius: 6,
      border: `1px solid ${action.color}33`,
      whiteSpace: 'nowrap',
    }}>
      {action.label}
    </span>
  )
}

function TxSpan({ item, i, copied, onCopy }) {
  return (
    <span
      title="Click to copy"
      onClick={() => onCopy(item.tx, i)}
      className="hover:bg-foreground/10 p-1 font-display rounded-md transition-colors"
      style={{
        fontFamily: 'monospace', fontSize: 13,
        color: copied === i ? 'hsl(var(--primary))' : 'hsl(var(--accent))',
        cursor: 'pointer', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
    >
      {copied === i ? 'Copied!' : `${item.tx.slice(0, 25)}…`}
    </span>
  )
}

function CollectionCell({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {item.collectionInfo?.imageUrl && (
        <img src={item.collectionInfo.imageUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}>
        {item.collectionInfo?.name || `${item.collection?.slice(0, 6)}…`}
      </span>
    </div>
  )
}

function TokenBadge({ tokenId }) {
  return (
    <span style={{
      fontFamily: 'monospace', fontSize: 12,
      color: 'hsl(var(--muted-foreground))',
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'calc(var(--radius) - 4px)',
      padding: '3px 8px', whiteSpace: 'nowrap',
    }}>
      #{tokenId}
    </span>
  )
}

const cellStyle = {
  padding: '16px 12px 16px 0',
  borderBottom: '1px solid hsl(var(--border) / 0.6)',
  fontSize: 15, display: 'flex', alignItems: 'center', gap: 8,
}

export default Activity