import { useAuth } from '../lib/auth'

interface AmberPanelProps {
  onOpenSeal: () => void
  onOpenHistory: () => void
  onOpenPricing: () => void
}

export function AmberPanel({ onOpenSeal, onOpenHistory, onOpenPricing }: AmberPanelProps) {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return (
      <div className="phone-panel">
        <div className="panel-heading">
          <p className="panel-tag">Amber</p>
          <h3>Amber balance</h3>
        </div>
        <p className="feedback error">Login is required to manage your amber allowance.</p>
      </div>
    )
  }

  const quota = currentUser.amberQuota

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Amber</p>
        <h3>Your amber balance</h3>
      </div>

      <div className="metric-grid amber-metric-grid">
        <article className="metric-card">
          <span>Remaining</span>
          <strong>{quota.remainingCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Used</span>
          <strong>{quota.usedCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Free start</span>
          <strong>{quota.freeCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Purchased</span>
          <strong>{quota.purchasedCredits}</strong>
        </article>
      </div>

      <article className="phone-card">
        <div className="phone-card-head">
          <div>
            <span className="mono-label">Allowance</span>
            <h4>{quota.totalCredits} amber total</h4>
          </div>
        </div>
        <p>
          New accounts start with 3 free amber. Every time you seal a new amber, one slot is used.
          Buy a package whenever the remaining balance reaches zero.
        </p>
        <div className="button-row">
          <button className="phone-button primary" onClick={onOpenSeal} type="button">
            Seal amber
          </button>
          <button className="phone-button ghost" onClick={onOpenHistory} type="button">
            Open history
          </button>
          <button className="phone-button ghost" onClick={onOpenPricing} type="button">
            Buy more amber
          </button>
        </div>
      </article>
    </div>
  )
}
