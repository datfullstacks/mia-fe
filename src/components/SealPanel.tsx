import { useState } from 'react'
import { createAmber } from '../lib/api'
import { notifyAmbersChanged } from '../lib/amberEvents'
import { useAuth } from '../lib/auth'

function createInitialOpenAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function SealPanel() {
  const { currentUser, token, refreshSession } = useAuth()
  const [form, setForm] = useState(() => ({
    recipientEmail: '',
    message: '',
    openAt: createInitialOpenAt(),
    passcode: '',
  }))
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasscodeVisible, setIsPasscodeVisible] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để tạo amber')
      }

      const response = await createAmber(token, {
        recipientEmail: form.recipientEmail.trim().toLowerCase(),
        message: form.message.trim(),
        openAt: new Date(form.openAt).toISOString(),
        passcode: form.passcode.trim(),
      })

      const nextOpenAt = createInitialOpenAt()
      setResult(`Đã tạo ${response.item.code} cho ${response.item.recipientEmail}`)
      setForm({
        recipientEmail: '',
        message: '',
        openAt: nextOpenAt,
        passcode: '',
      })
      await refreshSession()
      notifyAmbersChanged()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Không thể tạo amber')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="phone-panel">
      <div className="panel-heading">
        <p className="panel-tag">Seal</p>
        <h3>Tạo amber mới</h3>
      </div>

      {currentUser ? (
        <div className="seal-quota-copy">
          <p className="helper-copy">Đang dùng với tài khoản {currentUser.name}</p>
          <p className="helper-copy">
            Còn lại: {currentUser.amberQuota.remainingCredits} / {currentUser.amberQuota.totalCredits} amber
          </p>
        </div>
      ) : (
        <p className="feedback error">Bạn cần đăng nhập để dùng chức năng tạo amber.</p>
      )}

      <form className="phone-form" onSubmit={handleSubmit}>
        <label>
          Email người nhận
          <input
            required
            type="email"
            value={form.recipientEmail}
            onChange={(event) =>
              setForm((current) => ({ ...current, recipientEmail: event.target.value }))
            }
          />
        </label>

        <label>
          Nội dung
          <textarea
            required
            minLength={10}
            value={form.message}
            onChange={(event) =>
              setForm((current) => ({ ...current, message: event.target.value }))
            }
          />
        </label>

        <label>
          Mở vào lúc
          <input
            required
            type="datetime-local"
            value={form.openAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, openAt: event.target.value }))
            }
          />
        </label>

        <label>
          Mật mã mở
          <div className="password-field">
            <input
              required
              minLength={4}
              type={isPasscodeVisible ? 'text' : 'password'}
              value={form.passcode}
              onChange={(event) =>
                setForm((current) => ({ ...current, passcode: event.target.value }))
              }
            />
            <button
              aria-label={isPasscodeVisible ? 'Ẩn mật mã' : 'Hiện mật mã'}
              className="password-toggle"
              onClick={() => setIsPasscodeVisible((current) => !current)}
              type="button"
            >
              {isPasscodeVisible ? 'Ẩn' : 'Xem'}
            </button>
          </div>
        </label>

        <button
          className="phone-button primary"
          disabled={isSubmitting || !currentUser || currentUser.amberQuota.remainingCredits < 1}
          type="submit"
        >
          {isSubmitting ? 'Đang niêm phong...' : 'Tạo amber'}
        </button>
      </form>

      {error ? <p className="feedback error">{error}</p> : null}
      {result ? <p className="feedback success">{result}</p> : null}
    </div>
  )
}
