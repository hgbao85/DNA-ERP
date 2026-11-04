import { Fragment } from 'react'
import { LENH_CODE_SEPARATOR } from '../utils/lenhCode'

/**
 * Phần A – Đợt 2: in mã lệnh (vd "GP-200 + GP-201") mà KHÔNG bẻ dòng giữa một số LSX - trình duyệt mặc định được ngắt sau dấu
 * gạch ("GP-" / "201"). Mỗi số giữ nguyên 1 khối, chỉ xuống dòng ở " + ".
 */
export default function LenhCodeText({ code }: { code: string }) {
  const parts = code.split(LENH_CODE_SEPARATOR)
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && LENH_CODE_SEPARATOR}
          <span style={{ whiteSpace: 'nowrap' }}>{p}</span>
        </Fragment>
      ))}
    </>
  )
}
