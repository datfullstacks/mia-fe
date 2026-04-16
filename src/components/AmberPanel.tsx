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
          <h3>Kho amber</h3>
        </div>
        <p className="feedback error">Bạn cần đăng nhập để quản lý số amber của mình.</p>
      </div>
    )
  }

  const quota = currentUser.amberQuota

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Amber</p>
        <h3>Số amber hiện có</h3>
      </div>

      <div className="metric-grid amber-metric-grid">
        <article className="metric-card">
          <span>Còn lại</span>
          <strong>{quota.remainingCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Đã dùng</span>
          <strong>{quota.usedCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Tặng đầu</span>
          <strong>{quota.freeCredits}</strong>
        </article>
        <article className="metric-card">
          <span>Đã mua</span>
          <strong>{quota.purchasedCredits}</strong>
        </article>
      </div>

      <article className="phone-card">
        <div className="phone-card-head">
          <div>
            <span className="mono-label">Hạn mức</span>
            <h4>{quota.totalCredits} amber tổng</h4>
          </div>
        </div>
        <p>
          Tài khoản mới có sẵn 3 amber miễn phí. Mỗi lần niêm phong một amber mới sẽ trừ 1 lượt.
          Khi hết lượt, bạn chỉ cần mua thêm gói amber.
        </p>
        <div className="button-row">
          <button className="phone-button primary" onClick={onOpenSeal} type="button">
            Tạo amber
          </button>
          <button className="phone-button ghost" onClick={onOpenHistory} type="button">
            Xem lịch sử
          </button>
          <button className="phone-button ghost" onClick={onOpenPricing} type="button">
            Mua thêm amber
          </button>
        </div>
      </article>
    </div>
  )
}
