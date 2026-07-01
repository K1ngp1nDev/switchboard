import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { toast } from 'sonner'
import { diffJson } from '../engine/jsonDiff'
import type { Json } from '../engine/types'
import { selectedRun, useStore } from '../store/useStore'
import { UserCheckIcon } from './icons'

const MonacoJson = lazy(() => import('./MonacoJson'))

function DiffView({ current, proposed }: { current: Json; proposed: Json }) {
  const lines = useMemo(() => diffJson(current, proposed), [current, proposed])
  return (
    <div className="mono-nums h-full overflow-y-auto overscroll-contain rounded-lg border border-line bg-s2 p-2 text-[10.5px] leading-relaxed">
      {lines.map((l, i) => {
        if (l.type === 'same') {
          return (
            <div key={i} className="flex gap-2 px-1.5 py-px text-faint">
              <span className="w-3 shrink-0" />
              <span className="truncate">
                {l.path}: {l.after}
              </span>
            </div>
          )
        }
        return (
          <div key={i}>
            {(l.type === 'removed' || l.type === 'changed') && (
              <div className="flex gap-2 rounded-sm bg-err-dim px-1.5 py-px text-err">
                <span className="w-3 shrink-0">−</span>
                <span className="truncate">
                  {l.path}: {l.before}
                </span>
              </div>
            )}
            {(l.type === 'added' || l.type === 'changed') && (
              <div className="flex gap-2 rounded-sm bg-ok-dim px-1.5 py-px text-ok">
                <span className="w-3 shrink-0">+</span>
                <span className="truncate">
                  {l.path}: {l.after}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ApprovalModal() {
  const open = useStore((s) => s.approvalOpen)
  const setOpen = useStore((s) => s.setApprovalOpen)
  const decideGate = useStore((s) => s.decideGate)
  const theme = useStore((s) => s.theme)
  const run = useStore(selectedRun)
  const gate = run.pendingGate

  const [tab, setTab] = useState<'diff' | 'edit'>('diff')
  const [draft, setDraft] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && gate) {
      setTab('diff')
      setDraft(JSON.stringify(gate.proposed, null, 2))
      setJsonError(null)
    }
  }, [open, gate])

  useEffect(() => {
    if (!open || !cardRef.current || !backdropRef.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 14, scale: 0.965 },
      { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'power3.out' },
    )
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open || !gate) return null

  const parsedDraft = (): Json | null => {
    try {
      const v = JSON.parse(draft) as Json
      setJsonError(null)
      return v
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'invalid JSON')
      return null
    }
  }

  const approve = () => {
    if (tab === 'edit') {
      const v = parsedDraft()
      if (v === null) return
      const changed = JSON.stringify(v) !== JSON.stringify(gate.proposed)
      decideGate(changed ? 'edited' : 'approved', changed ? v : undefined)
      toast.success(changed ? 'Approved with edits — run resumed' : 'Approved — run resumed')
      return
    }
    decideGate('approved')
    toast.success('Approved — run resumed')
  }

  const reject = () => {
    decideGate('rejected')
    toast.error('Rejected — run stopped')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={gate.title}
        className="floating relative flex max-h-[86vh] w-full max-w-[620px] flex-col rounded-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent-dim text-accent">
            <UserCheckIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-tight">{gate.title}</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-dim">{gate.reason}</p>
            <p className="mono-nums mt-1.5 text-[9.5px] text-faint">
              run {run.id} · gate {gate.gate} · paused at {(gate.t / 1000).toFixed(1)}s
            </p>
          </div>
        </header>

        <div className="flex items-center gap-1 px-5 pt-3">
          {(['diff', 'edit'] as const).map((t) => (
            <button
              key={t}
              data-active={tab === t}
              onClick={() => setTab(t)}
              className="ctl rounded-[7px] border border-transparent px-2.5 py-1 text-[10.5px] font-medium text-dim data-[active=true]:border-line-strong data-[active=true]:bg-s3 data-[active=true]:text-text"
            >
              {t === 'diff' ? 'State diff' : 'Edit proposal'}
            </button>
          ))}
          {jsonError && tab === 'edit' && (
            <span className="mono-nums ml-auto truncate text-[9.5px] text-err">{jsonError}</span>
          )}
        </div>

        <div className="min-h-[220px] flex-1 overflow-hidden px-5 py-3">
          {tab === 'diff' ? (
            <DiffView current={gate.current} proposed={gate.proposed} />
          ) : (
            <div className="h-[260px] overflow-hidden rounded-lg border border-line">
              <Suspense
                fallback={
                  <pre className="mono-nums h-full overflow-auto bg-s2 p-3 text-[10.5px] text-dim">
                    {draft}
                  </pre>
                }
              >
                <MonacoJson value={draft} onChange={setDraft} theme={theme} />
              </Suspense>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          <span className="mono-nums hidden text-[9.5px] text-faint sm:block">
            decision is appended to the event log · replay includes it
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={reject}
              className="ctl rounded-full border border-err/40 px-4 py-1.5 text-[11.5px] font-medium text-err hover:bg-err-dim"
            >
              Reject
            </button>
            <button
              onClick={approve}
              className="ctl rounded-full bg-accent px-4 py-1.5 text-[11.5px] font-semibold text-accent-ink"
            >
              {tab === 'edit' ? 'Apply & approve' : 'Approve'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
