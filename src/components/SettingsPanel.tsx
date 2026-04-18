import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function SettingsPanel() {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  function openAdminPortal() {
    navigate('/admin')
  }

  async function handleLogout() {
    await logout()
    navigate('/gate')
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Settings</p>
        <h3>Cài đặt</h3>
      </div>

      <div className="settings-stack">
        <div className="phone-card">
          <span className="mono-label">{currentUser?.email ?? 'Khách'}</span>
          <h4>{currentUser ? currentUser.name : 'Chưa đăng nhập'}</h4>
        </div>

        <label className="slider-field">
          Âm lượng không gian
          <input defaultValue={45} max={100} min={0} type="range" />
        </label>

        <label className="slider-field">
          Âm lượng đĩa than
          <input defaultValue={30} max={100} min={0} type="range" />
        </label>

        <div className="button-row">
          <button className="phone-button ghost" onClick={openAdminPortal} type="button">
            Mở admin
          </button>
          <button className="phone-button ghost" onClick={() => navigate('/gate')} type="button">
            Về cổng
          </button>
        </div>

        <button className="phone-button ghost" onClick={() => void handleLogout()} type="button">
          {currentUser ? 'Đăng xuất' : 'Về cổng'}
        </button>
      </div>
    </div>
  )
}
