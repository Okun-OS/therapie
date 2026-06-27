import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0B1F3A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: 96, height: 76, background: '#F5B800', borderRadius: 12, position: 'relative', display: 'flex' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 20, background: '#0B1F3A', borderRadius: '12px 12px 0 0' }} />
          <div style={{ position: 'absolute', top: 30, left: 14, width: 16, height: 14, background: '#0B1F3A', borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: 30, left: 40, width: 16, height: 14, background: '#0B1F3A', borderRadius: 3 }} />
          <div style={{ position: 'absolute', top: 30, left: 66, width: 16, height: 14, background: '#0B1F3A', borderRadius: 3 }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
