import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function SettingsPanel() {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/gate')
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Settings</p>
        <h3>System settings shell</h3>
      </div>

      <div className="settings-stack">
        <div className="phone-card">
          <span className="mono-label">{currentUser?.email ?? 'Guest session'}</span>
          <h4>{currentUser ? currentUser.name : 'No active account'}</h4>
        </div>

        <label className="slider-field">
          Ambient volume
          <input defaultValue={45} max={100} min={0} type="range" />
        </label>

        <label className="slider-field">
          Vinyl volume
          <input defaultValue={30} max={100} min={0} type="range" />
        </label>

        <button className="phone-button ghost" onClick={() => void handleLogout()} type="button">
          {currentUser ? 'Logout' : 'Return to Gate'}
        </button>
      </div>
    </div>
  )
}
