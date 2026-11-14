'use client'

/**
 * Trạng thái đăng nhập PIN của màn quét. 3 bước, KHÔNG có nút "lần đầu đăng nhập" (công nhân mới không phải gõ PIN giả):
 *   1) nhập tên -> 2) BE cho biết tài khoản đã có PIN chưa -> 3a) đã có: chỉ nhập PIN; 3b) chưa có: đặt PIN + nhập lại.
 * Tên đã nhớ từ lần trước thì tự bước qua bước 1. BE chống dò tài khoản nên tên lạ cũng vào bước "nhập PIN":
 * lỗi thật hiện sau khi bấm Đăng nhập.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, type User } from '../../../../context/AuthContext'
import { getPinStatus, loginUser, PIN_SETUP_REQUIRED, setupWorkerPin } from '../../../../services/api'
import { ApiError, isInvalidCredentials } from '../../../../services/core/apiError'
import { describeError } from '../floorUi'
import { errText, LAST_USER_KEY, safeGet, safeSet } from './scanModel'

export type LoginStep = { kind: 'username' } | { kind: 'pin' } | { kind: 'setup'; expired: boolean }

export function usePinLogin() {
  const { login } = useAuth()
  const [username, setUsername] = useState(() => safeGet(LAST_USER_KEY) ?? '')
  const [step, setStep] = useState<LoginStep>({ kind: 'username' })
  // Có tên nhớ sẵn: tự hỏi BE ngay khi mở màn, trong lúc chờ hiện dòng "Đang kiểm tra…" thay vì ô nhập nhấp nháy.
  const [auto, setAuto] = useState(() => (safeGet(LAST_USER_KEY) ?? '').trim().length >= 3)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoRan = useRef(false)
  const name = username.trim().toLowerCase()

  const finish = (data: { accessToken: string; user: unknown }) => {
    safeSet(LAST_USER_KEY, name)
    login(data.accessToken, data.user as User)
  }
  const resetSecrets = () => { setPin(''); setPin2(''); setShow(false) }
  const changeUser = () => { setStep({ kind: 'username' }); resetSecrets(); setError(null); setAuto(false) }

  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) { setError('Nhập tên đăng nhập'); return }
    setBusy(true); setError(null)
    try {
      const st = await getPinStatus(value)
      setStep(st.needsPin ? { kind: 'setup', expired: st.expired } : { kind: 'pin' })
    } catch (err) {
      setError(describeError(err).text)
    } finally { setBusy(false); setAuto(false) }
  }, [])

  // Tự kiểm tra tên đã nhớ - chỉ 1 lần (Strict Mode dev chạy effect 2 lần).
  useEffect(() => {
    if (!auto || autoRan.current) return
    autoRan.current = true
    void checkUsername(name)
  }, [auto, name, checkUsername])

  const submitUsername = (e: React.FormEvent) => { e.preventDefault(); void checkUsername(name) }

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 6) { setError('PIN phải đủ 6 số'); return }
    setBusy(true); setError(null)
    try {
      finish(await loginUser({ username: name, password: pin }))
    } catch (err) {
      if (err instanceof ApiError && err.message === PIN_SETUP_REQUIRED) {
        // Dự phòng: BE vừa chuyển tài khoản sang "chưa có PIN" (QLSX vừa cho đặt lại) - sang bước đặt PIN.
        resetSecrets(); setStep({ kind: 'setup', expired: false })
      } else {
        // BE trả "còn N lần thử" / "khoá tạm" cho công nhân; lỗi sai chung chung thì hiện câu thân thiện.
        setError(isInvalidCredentials(err) ? 'Sai tên đăng nhập hoặc PIN' : errText(err))
        setPin('')
      }
    } finally { setBusy(false) }
  }

  const submitSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 6) { setError('PIN phải đủ 6 số'); return }
    if (pin !== pin2) { setError('Hai lần nhập PIN chưa giống nhau'); return }
    setBusy(true); setError(null)
    try {
      finish(await setupWorkerPin(name, pin, pin2))
    } catch (err) { setError(errText(err)); setPin2('') } finally { setBusy(false) }
  }

  return {
    username, setUsername, name, step, auto, pin, setPin, pin2, setPin2, show, setShow, busy, error,
    changeUser, submitUsername, submitPin, submitSetup,
  }
}

export type PinLoginState = ReturnType<typeof usePinLogin>
